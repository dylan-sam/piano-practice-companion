import { describe, expect, test } from 'vitest'
import { buildTimeline } from '../src/engine/timeline'
import { attackBeats } from '../src/engine/arrange'
import { chartFromMeasures } from '../src/music/chart'
import { writeLine, writtenPosition, type PlayedKey } from '../src/exercises/improvisation'

// Two bars of C7 then F7, played twice (two choruses), no count-in
const chart = chartFromMeasures({ title: 'Blues', style: 'swing', key: 0, bpm: 120 }, [['C7'], ['F7']])
const timeline = buildTimeline(chart, 0, 2, { countIn: false, ending: false })
const key = (pitch: number, start: number, end: number | null = start + 0.4): PlayedKey => ({ pitch, start, end })

describe('the written grid', () => {
  test('straight styles write sixteenths, swung styles eighths', () => {
    expect(writtenPosition(1.3, 0.5)).toBe(1.25)
    expect(writtenPosition(1.6, 0.66)).toBe(1.5)
    expect(writtenPosition(1.9, 0.66)).toBe(2)
  })
})

describe('the line written out', () => {
  test('keys become notes in their bars, coloured on their chord', () => {
    const line = writeLine([key(64, 0.02), key(66, 1), key(67, 2.1), key(65, 4)], timeline, 0, 0, 0.5, 8)
    expect(line.notes.map((n) => [n.bar, n.at, n.pitch])).toEqual([[0, 0, 64], [0, 1, 66], [0, 2, 67], [1, 0, 65]])
    // E chord tone; F# outside then G a half step up: an approach; G chord tone; F the root of F7
    expect(line.colors).toEqual(['chord', 'approach', 'chord', 'chord'])
    expect(line.counts).toEqual({ chord: 3, color: 0, approach: 1, outside: 0 })
  })

  test('only the chorus asked for, keys struck together keep the highest', () => {
    const keys = [key(60, 0), key(48, 8), key(64, 8.01), key(70, 9)]
    expect(writeLine(keys, timeline, 1, 0, 0.5, 12).notes.map((n) => [n.bar, n.at, n.pitch])).toEqual([[0, 0, 64], [0, 1, 70]])
  })

  test('a note lasts until its key goes up or the next note, held keys until now, in the written key', () => {
    const line = writeLine([key(62, 0, 1.5), key(64, 1, null)], timeline, 0, 2, 0.5, 3)
    expect(line.notes.map((n) => [n.at, n.beats, n.pitch])).toEqual([[0, 1, 60], [1, 2, 62]])
  })
})

describe("the band piano's attacks", () => {
  test('a rolled chord counts once', () => {
    expect(attackBeats([0, 12, 24, 480, 960].map((tick) => ({ tick, channel: 1, note: 60, velocity: 80, duration: 100 })))).toEqual([0, 1, 2])
  })
})

describe('long outside notes', () => {
  test('a long outside note on a strong beat stays outside, a short one resolves', () => {
    // Db over C7 (no key given), then C: short on the "and" -> approach; long on beat 1 -> outside
    expect(writeLine([key(61, 1.5, 1.9), key(60, 2)], timeline, 0, 0, 0.5, 4).colors[0]).toBe('approach')
    expect(writeLine([key(61, 0, 1.9), key(60, 2)], timeline, 0, 0, 0.5, 4).colors[0]).toBe('outside')
  })

  test("the key of the bar makes the key's scales colour tones", () => {
    expect(writeLine([key(63, 0)], timeline, 0, 0, 0.5, 1).colors).toEqual(['outside'])
    expect(writeLine([key(63, 0)], timeline, 0, 0, 0.5, 1, [0, 0]).colors).toEqual(['color'])
  })
})
