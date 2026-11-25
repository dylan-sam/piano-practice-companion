// The band's track as an audio file (WAV or MP3): the MIDI file is rendered through the sound
// bank (synthesize.ts, in a worker), then through the live player's output stage (mastering.ts)
// on an offline audio context, so the download sounds like the band in the app.

import { outputStage, SOUNDFONT_URL } from './mastering'
import { abortError, RENDER_RATE, synthesize, type SynthRequest } from './synthesize'
import type { SynthReply } from './synthWorker'

export type AudioFormat = 'wav' | 'mp3'

const MP3_KBPS = 192
const MP3_FRAME = 1152 // samples per MP3 frame
// Shares of the progress bar: the band (the long part), the output stage, the encoding
const SYNTH_SHARE = 0.85
const MASTER_SHARE = 0.05

/** The mixer as it is now: each channel's volume (0 for a muted part) and the master fader. */
export interface AudioMix {
  volumes: Record<number, number>
  master: number
}

type Samples = { left: Float32Array; right: Float32Array }

/** Render in a worker; reject with an AbortError when `signal` cancels (the worker is ended). */
function synthesizeInWorker(request: SynthRequest, onProgress: (ratio: number) => void, signal?: AbortSignal): Promise<Samples> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./synthWorker.ts', import.meta.url), { type: 'module' })
    const finish = () => {
      signal?.removeEventListener('abort', cancel)
      worker.terminate()
    }
    const cancel = () => {
      finish()
      reject(abortError())
    }
    signal?.addEventListener('abort', cancel, { once: true })
    worker.addEventListener('message', (event: MessageEvent<SynthReply>) => {
      const message = event.data
      if (message.type === 'progress') return onProgress(message.ratio)
      finish()
      if (message.type === 'done') resolve({ left: message.left, right: message.right })
      else reject(new Error(message.message))
    })
    worker.addEventListener('error', (event) => {
      finish()
      reject(new Error(event.message || 'The audio worker failed'))
    })
    worker.postMessage(request, [request.midi])
  })
}

/** Render the band, in a worker when the browser has them, otherwise on the page. */
async function synthesizeBand(request: SynthRequest, onProgress: (ratio: number) => void, signal?: AbortSignal): Promise<Samples> {
  if (typeof Worker === 'undefined') return synthesize(request, onProgress, signal)
  try {
    return await synthesizeInWorker({ ...request, midi: request.midi.slice(0) }, onProgress, signal)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return synthesize(request, onProgress, signal) // a worker that could not start: render here
  }
}

/** Pass the band through the master fader and the limiter, as the live player does. */
async function master({ left, right }: Samples, volume: number): Promise<Samples> {
  const ctx = new OfflineAudioContext(2, left.length, RENDER_RATE)
  const buffer = ctx.createBuffer(2, left.length, RENDER_RATE)
  buffer.copyToChannel(left as Float32Array<ArrayBuffer>, 0)
  buffer.copyToChannel(right as Float32Array<ArrayBuffer>, 1)
  const source = new AudioBufferSourceNode(ctx, { buffer })
  const { input, output } = outputStage(ctx, volume)
  source.connect(input)
  output.connect(ctx.destination)
  source.start()
  const out = await ctx.startRendering()
  return { left: out.getChannelData(0), right: out.getChannelData(1) }
}

/** A sample as a signed 16-bit integer. */
const int16 = (sample: number) => Math.round(Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 0x8000 : 0x7fff))

/** A 16-bit stereo WAV file of the samples. */
export function encodeWav({ left, right }: Samples, rate = RENDER_RATE): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(44 + left.length * 4)
  const view = new DataView(bytes.buffer)
  const ascii = (at: number, text: string) => [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)))
  ascii(0, 'RIFF')
  view.setUint32(4, bytes.length - 8, true)
  ascii(8, 'WAVEfmt ')
  view.setUint32(16, 16, true) // the format chunk's size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 2, true) // stereo
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 4, true) // bytes per second
  view.setUint16(32, 4, true) // bytes per sample frame
  view.setUint16(34, 16, true) // bits per sample
  ascii(36, 'data')
  view.setUint32(40, left.length * 4, true)
  for (let i = 0, at = 44; i < left.length; i++, at += 4) {
    view.setInt16(at, int16(left[i]), true)
    view.setInt16(at + 2, int16(right[i]), true)
  }
  return bytes
}

/** A 192 kbps stereo MP3 of the samples (the encoder, LAME in JavaScript, is loaded only for this). */
async function encodeMp3({ left, right }: Samples, onProgress: (ratio: number) => void, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>[]> {
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const encoder = new Mp3Encoder(2, RENDER_RATE, MP3_KBPS)
  const l = new Int16Array(MP3_FRAME)
  const r = new Int16Array(MP3_FRAME)
  const chunks: Uint8Array<ArrayBuffer>[] = []
  // The encoder gives views of its own memory: keep a copy of each
  const keep = (data: Uint8Array) => {
    if (data.length) chunks.push(Uint8Array.from(data))
  }
  for (let at = 0, frames = 0; at < left.length; at += MP3_FRAME) {
    const size = Math.min(MP3_FRAME, left.length - at)
    for (let i = 0; i < size; i++) {
      l[i] = int16(left[at + i])
      r[i] = int16(right[at + i])
    }
    keep(encoder.encodeBuffer(l.subarray(0, size), r.subarray(0, size)))
    if (++frames % 200 === 0) {
      onProgress(at / left.length)
      await new Promise((resolve) => setTimeout(resolve, 0))
      if (signal?.aborted) throw abortError()
    }
  }
  keep(encoder.flush())
  return chunks
}

/**
 * Render a MIDI file of the band to a WAV or MP3 file with the mixer's volumes. `onProgress`
 * goes from 0 to 1; `signal` cancels (the promise rejects with an AbortError).
 */
export async function renderAudio(midi: Uint8Array, mix: AudioMix, format: AudioFormat,
  onProgress: (ratio: number) => void, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(SOUNDFONT_URL, { signal })
  if (!response.ok) throw new Error(`Could not download the sound bank (${response.status})`)
  const soundBank = await response.arrayBuffer()
  const midiBuffer = midi.slice().buffer
  const band = await synthesizeBand({ midi: midiBuffer, soundBank, volumes: mix.volumes },
    (ratio) => onProgress(ratio * SYNTH_SHARE), signal)
  if (signal?.aborted) throw abortError()
  const mastered = await master(band, mix.master)
  onProgress(SYNTH_SHARE + MASTER_SHARE)
  const encodeFrom = SYNTH_SHARE + MASTER_SHARE
  const parts = format === 'mp3'
    ? await encodeMp3(mastered, (ratio) => onProgress(encodeFrom + ratio * (1 - encodeFrom)), signal)
    : [encodeWav(mastered)]
  onProgress(1)
  return new Blob(parts, { type: format === 'mp3' ? 'audio/mpeg' : 'audio/wav' })
}
