import { MIDIControllers } from 'spessasynth_core'
import { Sequencer, WorkletSynthesizer } from 'spessasynth_lib'
import processorUrl from 'spessasynth_lib/dist/spessasynth_processor.min.js?url'

const SOUNDFONT_URL = `${import.meta.env.BASE_URL}soundfonts/openstand.sf3`
const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'keydown'] as const

// Download a file, reporting the share received so far
async function fetchWithProgress(url: string, onProgress: (ratio: number) => void): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error(`Could not download the sound bank (${res.status})`)
  const total = Number(res.headers.get('content-length')) || 0
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    if (total) onProgress(loaded / total)
  }
  const out = new Uint8Array(loaded)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out.buffer
}

// About +10 dB: brings the band from around -28 dBFS (RMS) to the level of other music
const MASTER_GAIN = 3.2
const LIVE_PIANO_CHANNEL = 2
// An "ended" this soon after a song started may belong to the song it replaced (see Player.ended)
const LATE_END_MS = 2000
// After a hand-over, the synthesizer that played rings out this long before it loads the next chunk
const RING_OUT_MS = 2500
// Master gain for a volume from 0 to 100 (squared, so the slider feels even)
const masterGainFor = (volume: number) => MASTER_GAIN * (volume / 100) ** 2

/** A synthesizer with the sequencer that plays songs on it. */
interface Deck { synth: WorkletSynthesizer; seq: Sequencer }

// Thin layer over SpessaSynth: sound bank loading, MIDI playback, mixer.
//
// Endless exercises hand over from one chunk to the next without a gap: loading a song makes
// SpessaSynth reset its synthesizer (cutting the reverb and the notes still ringing) and takes
// a moment, so the next chunk is loaded ahead on a second synthesizer (`queue`), paused, and
// started exactly at the hand-over (`startQueued`) while the first lets its last notes ring.
export class Player {
  private ctx: AudioContext
  private synth: WorkletSynthesizer | null = null // the synthesizer playing now
  private seq: Sequencer | null = null // and its sequencer
  private live: WorkletSynthesizer | null = null // the synthesizer of the live piano: always the first one
  private spare: Deck | null = null // the second synthesizer, made for the first hand-over
  private spareMaking: Promise<Deck> | null = null
  private bank: ArrayBuffer | null = null // a copy of the sound bank, for the second synthesizer
  private queued: Uint8Array | null = null // the song waiting on the spare synthesizer
  private queuedReady = false
  private startedAt = 0 // when the playing song was started (performance.now())
  private volumes = new Map<number, number>()
  // Loads go one at a time, so a warm-up load can't replace the song the user asked for
  private loading: Promise<void> = Promise.resolve()
  private playRequested = false
  onEnded: () => void = () => {}

  constructor() {
    this.ctx = new AudioContext({ sampleRate: 44100 })
    // On iPhone, Web Audio is silenced by the ring/silent switch unless the session is "playback"
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
    if (session) session.type = 'playback'
    // Phones open the audio output on the first touch; doing it then, rather than on play, saves that wait
    const unlock = () => {
      if (this.ctx.state === 'running') {
        for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock, true)
        return
      }
      void this.ctx.resume()
    }
    for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock, true)
  }

  /**
   * Whether playback can start without a tap first: browsers only let a page make sound once the
   * user has touched or clicked it (here or on an earlier screen of the app).
   */
  get canPlayWithoutTap(): boolean {
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
    return this.ctx.state === 'running' || !!activation?.hasBeenActive
  }

  // The output stage: the General MIDI sound bank plays well below full scale, so the band is
  // raised by about 10 dB, and a fast limiter catches the peaks so nothing distorts.
  // The mixer's master fader sets `masterGain`; the meter reads what leaves the limiter.
  private masterGain: GainNode | null = null
  private masterVolume = 100
  private meter: AnalyserNode | null = null
  private meterBuffer = new Float32Array(1024)

  private master(): AudioNode {
    if (this.masterGain) return this.masterGain
    this.masterGain = new GainNode(this.ctx, { gain: masterGainFor(this.masterVolume) })
    this.meter = new AnalyserNode(this.ctx, { fftSize: 1024 })
    const limiter = new DynamicsCompressorNode(this.ctx, { threshold: -8, knee: 4, ratio: 12, attack: 0.002, release: 0.15 })
    this.masterGain.connect(limiter).connect(this.ctx.destination)
    limiter.connect(this.meter)
    return this.masterGain
  }

  // Master volume on the mixer's 0-127 scale; 100 is the normal level, 127 about 4 dB more
  setMasterVolume(volume: number): void {
    this.masterVolume = volume
    this.masterGain?.gain.setTargetAtTime(masterGainFor(volume), this.ctx.currentTime, 0.02)
  }

  // Output level now, in dBFS: the peak and the average (RMS) of the last 23 ms
  level(): { peak: number; rms: number } {
    const buffer = this.meterBuffer
    if (!this.meter) return { peak: -100, rms: -100 }
    this.meter.getFloatTimeDomainData(buffer)
    let peak = 0
    let sum = 0
    for (const v of buffer) {
      peak = Math.max(peak, Math.abs(v))
      sum += v * v
    }
    // Convert a level to decibels (-100 for silence)
    const db = (x: number) => (x > 1e-5 ? 20 * Math.log10(x) : -100)
    return { peak: db(peak), rms: db(Math.sqrt(sum / buffer.length)) }
  }

  async init(onProgress: (ratio: number) => void): Promise<void> {
    const [soundfont] = await Promise.all([
      fetchWithProgress(SOUNDFONT_URL, onProgress),
      this.ctx.audioWorklet.addModule(processorUrl),
    ])
    this.bank = soundfont.slice(0)
    const { synth, seq } = await this.makeDeck(soundfont)
    this.synth = synth
    this.seq = seq
    this.live = synth
  }

  /** A synthesizer with the sound bank, and its sequencer (paused, playing each song once). */
  private async makeDeck(soundfont: ArrayBuffer): Promise<Deck> {
    const synth = new WorkletSynthesizer(this.ctx)
    synth.connect(this.master())
    await synth.soundBankManager.addSoundBank(soundfont, 'main')
    await synth.isReady
    const seq = new Sequencer(synth, { skipToFirstNoteOn: false })
    seq.loopCount = 0
    seq.eventHandler.addEvent('songEnded', 'player', () => this.ended(seq))
    return { synth, seq }
  }

  /**
   * A song ended. Only the playing synthesizer's end counts (the other one finishing the chunk
   * it handed over is not the end). An end arriving just after a song started, while that song
   * is far from its end, belongs to the song it replaced: the message comes from the audio thread
   * late, and the sequencer then believes it is paused, which would freeze the clock (and the
   * highlight) while the music goes on; its clock is set going again instead.
   */
  private ended(seq: Sequencer): void {
    if (seq !== this.seq) return
    const late = performance.now() - this.startedAt < LATE_END_MS && seq.currentTime < seq.duration - 0.5
    if (late) {
      // SpessaSynth keeps the paused time privately; clearing it lets the clock run again
      ;(seq as unknown as { pausedTime?: number }).pausedTime = undefined
      seq.isFinished = false
      return
    }
    this.onEnded()
  }

  // Loads the MIDI and starts playing from the given time (seconds of MIDI time)
  async play(midi: Uint8Array, fromSeconds = 0): Promise<void> {
    const seq = this.requireSeq()
    this.playRequested = true
    // A song replacing a playing one (the next chunk of an endless exercise, a new arrangement
    // going on from where the band is) never sends the note-offs of the notes still sounding
    this.releaseBand()
    this.silenceSpare()
    const resumed = this.ctx.resume()
    await this.load(midi, 'arrangement.mid')
    await resumed
    this.applyVolumes()
    if (fromSeconds > 0) seq.currentTime = fromSeconds
    this.startedAt = performance.now()
    seq.play()
  }

  /**
   * Get the next song ready on the second synthesizer, paused at its start, for `startQueued`.
   * A later call replaces the waiting song.
   */
  async queue(midi: Uint8Array): Promise<void> {
    if (!this.bank || !this.seq) return
    this.queued = midi
    this.queuedReady = false
    this.spareMaking ??= this.makeDeck(this.bank.slice(0)).then((deck) => (this.spare = deck))
    const spare = await this.spareMaking
    // Loading resets that synthesizer: the chunk it just handed over first rings out
    const ringing = this.startedAt + RING_OUT_MS - performance.now()
    if (ringing > 0) await new Promise((resolve) => window.setTimeout(resolve, ringing))
    if (this.queued !== midi) return
    this.loading = this.loading.then(async () => {
      if (this.queued !== midi) return // replaced meanwhile
      // The spare synthesizer may still be ringing out the chunk it handed over
      spare.seq.pause()
      await this.loadOn(spare.seq, midi, 'next.mid')
      spare.seq.playbackRate = this.seq?.playbackRate ?? 1
      this.applyVolumes(spare.synth)
      if (this.queued === midi) this.queuedReady = true
    })
    await this.loading
  }

  /**
   * Start the queued song now, if it is this one and ready: the synthesizers swap, and the one
   * that played goes on to the end of its song, so its last notes ring. False when it is not
   * ready (then `play` it).
   */
  startQueued(midi: Uint8Array): boolean {
    const spare = this.spare
    if (!spare || !this.synth || !this.seq || this.queued !== midi || !this.queuedReady) return false
    this.playRequested = true
    spare.seq.play()
    this.startedAt = performance.now()
    this.spare = { synth: this.synth, seq: this.seq }
    this.spareMaking = Promise.resolve(this.spare)
    this.synth = spare.synth
    this.seq = spare.seq
    this.queued = null
    this.queuedReady = false
    return true
  }

  /** Stop the second synthesizer (a song started from the beginning replaces everything). */
  private silenceSpare(): void {
    this.queued = null
    this.queuedReady = false
    if (!this.spare) return
    this.spare.seq.pause()
    this.spare.synth.stopAll(true)
  }

  // Loads silent songs so their samples are decoded before they are needed.
  // Stops as soon as the user presses play; the rest is decoded on the way.
  async warmUp(songs: Uint8Array[]): Promise<void> {
    for (const midi of songs) {
      if (this.playRequested) return
      await this.load(midi, 'warm-up.mid')
    }
  }

  private load(midi: Uint8Array, fileName: string): Promise<void> {
    const seq = this.requireSeq()
    const next = this.loading.then(() => this.loadOn(seq, midi, fileName))
    this.loading = next
    return next
  }

  /** Load a song on a sequencer, resolving once it is loaded. */
  private loadOn(seq: Sequencer, midi: Uint8Array, fileName: string): Promise<void> {
    return new Promise<void>((resolve) => {
      seq.eventHandler.addEvent('songChange', 'player-load', () => {
        seq.eventHandler.removeEvent('songChange', 'player-load')
        resolve()
      })
      seq.loadNewSongList([{ binary: midi.slice().buffer, fileName }])
    })
  }

  stop(): void {
    if (!this.seq || !this.synth) return
    this.seq.pause()
    this.seq.currentTime = 0
    this.synth.stopAll(true)
    this.silenceSpare()
  }

  async dispose(): Promise<void> {
    this.stop()
    await this.ctx.close()
  }

  get isPlaying(): boolean {
    return !!this.seq && !this.seq.paused && !this.seq.isFinished
  }

  // Position inside the playing MIDI (seconds at the base tempo)
  get position(): number {
    return this.seq?.currentTime ?? 0
  }

  // Position of what can be heard right now: the output (phone speaker, Bluetooth) plays a little
  // behind the synthesizer, so the chart follows the ears rather than the synthesizer.
  // The audio clock moves in steps; the smoothed clock keeps the chart's highlight gliding.
  get heardPosition(): number {
    const seq = this.seq
    if (!seq) return 0
    const latency = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0)
    return Math.max(0, seq.currentHighResolutionTime - latency * seq.playbackRate)
  }

  setRate(rate: number): void {
    if (this.seq) this.seq.playbackRate = rate
    if (this.spare) this.spare.seq.playbackRate = rate
  }

  setVolume(channel: number, volume: number): void {
    this.volumes.set(channel, volume)
    for (const synth of this.synths()) this.applyVolume(synth, channel, volume)
  }

  /** Sound a player's MIDI key on a separate acoustic piano channel (always on the first synthesizer). */
  liveNoteOn(note: number, velocity: number): void {
    if (!this.live) return
    this.live.programChange(LIVE_PIANO_CHANNEL, 0)
    this.live.noteOn(LIVE_PIANO_CHANNEL, note, velocity)
  }

  /** Release a player's monitored MIDI key without changing the backing track. */
  liveNoteOff(note: number): void {
    this.live?.noteOff(LIVE_PIANO_CHANNEL, note)
  }

  /** The synthesizers made so far. */
  private synths(): WorkletSynthesizer[] {
    return [this.synth, this.spare?.synth].filter((synth): synth is WorkletSynthesizer => !!synth)
  }

  /** Release every note of the band (all channels but the live piano) and lift the sustain pedal. */
  private releaseBand(): void {
    if (!this.synth) return
    for (let channel = 0; channel < 16; channel++) {
      if (channel === LIVE_PIANO_CHANNEL) continue
      this.synth.controllerChange(channel, MIDIControllers.sustainPedal, 0)
      this.synth.controllerChange(channel, MIDIControllers.allNotesOff, 0)
    }
  }

  // The mixer's volumes on a synthesizer (the playing one by default), after a song is loaded
  private applyVolumes(synth = this.synth): void {
    if (!synth) return
    this.volumes.forEach((v, ch) => this.applyVolume(synth, ch, v))
  }

  // Locks the volume so controllers in the MIDI file cannot override the mixer
  private applyVolume(synth: WorkletSynthesizer, channel: number, volume: number): void {
    const midiChannel = synth.midiChannels[channel]
    if (!midiChannel) return
    midiChannel.lockController(MIDIControllers.mainVolume, false)
    synth.controllerChange(channel, MIDIControllers.mainVolume, Math.round(volume))
    midiChannel.lockController(MIDIControllers.mainVolume, true)
  }

  private requireSeq(): Sequencer {
    if (!this.seq) throw new Error('Player is not ready yet')
    return this.seq
  }
}
