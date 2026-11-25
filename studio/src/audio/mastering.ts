// The band's output stage, shared by the live player and the audio export so a downloaded track
// sounds like the band in the app: the mixer's channel volumes, the master gain and the limiter.
// No SpessaSynth import here, so the export can use it without loading the live player.

export const SOUNDFONT_URL = `${import.meta.env.BASE_URL}soundfonts/openstand.sf3`

// About +10 dB: brings the band from around -28 dBFS (RMS) to the level of other music
const MASTER_GAIN = 3.2
// MIDI controller 7, the channel volume the mixer's faders set
const MAIN_VOLUME = 7

/** Master gain for the mixer's master fader (0-127, 100 normal): squared, so the slider feels even. */
export function masterGainFor(volume: number): number {
  return MASTER_GAIN * (volume / 100) ** 2
}

/**
 * The output chain on an audio context (live or offline): the master gain, then a fast limiter
 * that catches the peaks so nothing distorts. Connect the band to `input`; `output` is the limiter.
 */
export function outputStage(ctx: BaseAudioContext, volume: number): { input: GainNode; output: AudioNode } {
  const input = new GainNode(ctx, { gain: masterGainFor(volume) })
  const output = new DynamicsCompressorNode(ctx, { threshold: -8, knee: 4, ratio: 12, attack: 0.002, release: 0.15 })
  input.connect(output)
  return { input, output }
}

/** A synthesizer whose channel volumes can be set and locked (SpessaSynth's live and offline ones). */
export interface VolumeTarget {
  midiChannels: readonly ({ lockController(controller: number, isLocked: boolean): void } | undefined)[]
  controllerChange(channel: number, controller: number, value: number): void
}

/** Set a channel's volume and lock it, so the volume controllers in the MIDI file cannot override the mixer. */
export function lockVolume(synth: VolumeTarget, channel: number, volume: number): void {
  const midiChannel = synth.midiChannels[channel]
  if (!midiChannel) return
  midiChannel.lockController(MAIN_VOLUME, false)
  synth.controllerChange(channel, MAIN_VOLUME, Math.round(volume))
  midiChannel.lockController(MAIN_VOLUME, true)
}
