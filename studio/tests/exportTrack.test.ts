import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { BasicMIDI } from 'spessasynth_core'
import { encodeWav } from '../src/audio/exportAudio'
import { synthesize } from '../src/audio/synthesize'
import { CHANNELS, type Part } from '../src/engine/arrange'
import { conductorFor, exportMidi, trackFilename } from '../src/engine/exportTrack'
import { PPQ } from '../src/engine/events'
import { buildTimeline } from '../src/engine/timeline'
import { chartFromMeasures } from '../src/music/chart'
import { NO_PRACTICE } from '../src/music/practice'
import { getStyle } from '../src/styles'

const chart = chartFromMeasures({ title: 'Blue: Test?', style: 'swing', key: 10, bpm: 120 }, [['Bb7'], ['Eb7'], ['Bb7'], ['F7']])
const UNMUTED: Record<Part, boolean> = { bass: false, comp: false, melody: false, click: true, drums: false }
const request = { chart, style: getStyle('swing'), patternId: null, transpose: 0, choruses: 3, practice: NO_PRACTICE, bpm: 150, muted: UNMUTED }

/** The channels a MIDI file plays notes on. */
function noteChannels(midi: Uint8Array): Set<number> {
  const parsed = BasicMIDI.fromArrayBuffer(midi.slice().buffer)
  return new Set(parsed.tracks.flatMap((track) => track.events.filter((e) => (e.statusByte & 0xf0) === 0x90).map((e) => e.statusByte & 0x0f)))
}

describe('the band track download', () => {
  test('the MIDI file plays at the real tempo, faster each chorus with the speed-up', () => {
    const plain = BasicMIDI.fromArrayBuffer(exportMidi(request).slice().buffer)
    expect(plain.tempoChanges.map((t) => t.tempo)).toContain(150)
    const ramped = { ...request, practice: { ...NO_PRACTICE, ramp: 10 } }
    const timeline = buildTimeline(chart, 0, 3)
    const { tempos } = conductorFor(timeline, 150, ramped.practice)
    expect(tempos.map((t) => t.bpm)).toEqual([150, 160, 170])
    const second = timeline.bars.find((bar) => bar.chorus === 1)!
    expect(tempos[1].tick).toBe(Math.round(second.start * PPQ))
  })

  test('time signatures follow the meter, 6/8 written in eighths', () => {
    const waltz = chartFromMeasures({ title: 'W', style: 'swing', key: 0, bpm: 120, time: [6, 8] }, [['C'], ['G7']])
    expect(conductorFor(buildTimeline(waltz, 0, 1), 120, NO_PRACTICE).meters[0]).toEqual({ tick: 0, numerator: 6, denominator: 8 })
    expect(conductorFor(buildTimeline(chart, 0, 1), 120, NO_PRACTICE).meters).toEqual([{ tick: 0, numerator: 4, denominator: 4 }])
  })

  test('muted parts are left out, the click only when it is on', () => {
    expect(noteChannels(exportMidi(request)).has(CHANNELS.click)).toBe(false)
    const withClick = noteChannels(exportMidi({ ...request, muted: { ...UNMUTED, click: false, drums: true } }))
    expect(withClick.has(CHANNELS.click)).toBe(true)
    expect(withClick.has(CHANNELS.drums)).toBe(false)
  })

  test('a file name with the title, key and tempo', () => {
    expect(trackFilename(chart, 0, 150, 'mp3')).toBe('Blue Test - Bb - 150 bpm.mp3')
    expect(trackFilename({ ...chart, minor: true }, 2, 90, 'wav')).toBe('Blue Test - Cm - 90 bpm.wav')
  })

  test('a WAV file of 16-bit stereo samples', () => {
    const wav = encodeWav({ left: new Float32Array([0, 1, -1]), right: new Float32Array([0.5, 0, 2]) }, 44100)
    const view = new DataView(wav.buffer)
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF')
    expect(view.getUint16(22, true)).toBe(2)
    expect(view.getUint32(40, true)).toBe(12)
    expect([view.getInt16(44, true), view.getInt16(48, true), view.getInt16(52, true), view.getInt16(54, true)]).toEqual([0, 32767, -32768, 32767])
  })

  test('the band renders through the sound bank, silent when every part is at 0', async () => {
    const file = readFileSync('public/soundfonts/openstand.sf3')
    const soundBank = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
    const short = { ...request, choruses: 1 }
    const rms = (samples: Float32Array) => Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length)
    const loud = await synthesize({ midi: exportMidi(short).slice().buffer, soundBank, volumes: {} }, () => {})
    expect(rms(loud.left)).toBeGreaterThan(0.001)
    const zero = Object.fromEntries(Object.values(CHANNELS).map((channel) => [channel, 0]))
    const silent = await synthesize({ midi: exportMidi(short).slice().buffer, soundBank, volumes: zero }, () => {})
    expect(rms(silent.left)).toBeLessThan(rms(loud.left) / 100)
  }, 60_000)
})
