// Play a MIDI file through the sound bank faster than real time (SpessaSynth's core synthesizer,
// the one the live player runs in an audio worklet), for the audio download. Runs in a worker
// (synthWorker.ts), or on the page where workers are missing.

import { BasicMIDI, SoundBankLoader, SpessaSynthProcessor, SpessaSynthSequencer } from 'spessasynth_core'
import { lockVolume } from './mastering'

export const RENDER_RATE = 44100
const BLOCK = 128 // samples rendered at a time, as in an audio worklet
const TAIL_SECONDS = 2.5 // the last notes and the reverb ring out
const YIELD_EVERY = Math.floor(RENDER_RATE / BLOCK) // about one second of audio between progress reports

/** What to render: the MIDI file, the sound bank, and the mixer's volume of each channel. */
export interface SynthRequest {
  midi: ArrayBuffer
  soundBank: ArrayBuffer
  volumes: Record<number, number>
}

/** The error a stopped render ends with. */
export function abortError(): Error {
  return new DOMException('The download was cancelled', 'AbortError')
}

/** Let other work run (and a cancel arrive) between stretches of rendering. */
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** Render the song (dry of the master stage) to two channels of samples at RENDER_RATE. */
export async function synthesize(request: SynthRequest, onProgress: (ratio: number) => void,
  signal?: AbortSignal): Promise<{ left: Float32Array; right: Float32Array }> {
  const synth = new SpessaSynthProcessor(RENDER_RATE)
  try {
    await synth.ready
    synth.soundBankManager.addSoundBank(SoundBankLoader.fromArrayBuffer(request.soundBank), 'main')
    const midi = BasicMIDI.fromArrayBuffer(request.midi)
    const total = Math.ceil((midi.duration + TAIL_SECONDS) * RENDER_RATE)
    const seq = new SpessaSynthSequencer(synth)
    seq.skipToFirstNoteOn = false // keep the count-in's place
    seq.loopCount = 0
    seq.loadNewSongList([midi])
    seq.play()
    for (const [channel, volume] of Object.entries(request.volumes)) lockVolume(synth, Number(channel), volume)
    const left = new Float32Array(total)
    const right = new Float32Array(total)
    for (let done = 0, blocks = 0; done < total; done += BLOCK) {
      if (!seq.isFinished) seq.processTick()
      synth.process(left, right, done, Math.min(BLOCK, total - done))
      if (++blocks % YIELD_EVERY === 0) {
        onProgress(done / total)
        await breathe()
        if (signal?.aborted) throw abortError()
      }
    }
    onProgress(1)
    return { left, right }
  } finally {
    synth.destroy()
  }
}
