import { describe, expect, test } from 'vitest'
import { chordText, melodyToAbc, spellPitch } from '../src/music/abc'
import { hasMelody, withoutMelody, type Chart, type ChartBar } from '../src/music/chart'
import { isMelody, notesByBar, type MelodyNote } from '../src/music/melody'
import { DEFAULT_DISPLAY } from '../src/ui/display'
import { melodyEvents } from '../src/engine/melody'
import { buildTimeline } from '../src/engine/timeline'
import { PPQ } from '../src/engine/events'

/** A 4/4 chart in `key` with one chord per bar and the given melody notes. */
function chart(notes: MelodyNote[], bars: Partial<ChartBar>[] = [{}, {}], key = 0, extra: Partial<Chart> = {}): Chart {
  return {
    format: 'openstand-chart', version: 1, title: 'T', style: 'swing', key, bpm: 120, time: [4, 4],
    bars: bars.map((b) => ({ chords: [{ symbol: 'C^7', beats: 4 }], cells: 4, ...b })),
    melody: { notes }, ...extra,
  }
}

/** The music lines of the ABC (without the header). */
const body = (c: Chart, transpose = 0) => melodyToAbc(c, transpose, DEFAULT_DISPLAY).abc.split('\n').filter((l) => l && !/^[A-Z]:|^%%/.test(l)).join('\n')
const note = (bar: number, at: number, beats: number, pitch: number): MelodyNote => ({ bar, at, beats, pitch })

describe('spelling', () => {
  test('notes of the key follow the signature, chromatic notes the key\'s accidentals', () => {
    expect(spellPitch(66, 10)).toEqual({ letter: 'G', accidental: -1, octave: 4 }) // Gb in Bb
    expect(spellPitch(66, 7)).toEqual({ letter: 'F', accidental: 1, octave: 4 }) // F# in G
    expect(spellPitch(70, 0)).toEqual({ letter: 'B', accidental: -1, octave: 4 }) // Bb in C
    expect(spellPitch(66, 0)).toEqual({ letter: 'F', accidental: 1, octave: 4 }) // F# (raised 4th) in C
    expect(spellPitch(60, 0).octave).toBe(4)
  })
})

describe('melody to ABC', () => {
  test('header: key, meter, clef', () => {
    const abc = melodyToAbc(chart([note(0, 0, 4, 72)]), 2, DEFAULT_DISPLAY).abc
    expect(abc).toContain('M:4/4')
    expect(abc).toContain('K:D clef=treble')
    expect(melodyToAbc(chart([note(0, 0, 4, 45)], [{}], 9, { minor: true }), 0, DEFAULT_DISPLAY).abc).toContain('K:Am clef=bass')
  })

  test('straight eighths and quarters, beamed by beat, with the chord over the first note', () => {
    const c = chart([note(0, 0, 0.5, 60), note(0, 0.5, 0.5, 62), note(0, 1, 1, 64), note(0, 2, 2, 65)], [{}])
    expect(body(c)).toBe('"C\u03947"C2D2 E4 F8 |')
  })

  test('triplets are written as triplet eighths', () => {
    const c = chart([note(0, 0, 1 / 3, 60), note(0, 1 / 3, 1 / 3, 62), note(0, 2 / 3, 1 / 3, 64), note(0, 1, 3, 65)], [{}])
    expect(body(c)).toBe('(3:2:3"C\u03947"C2D2E2 F12 |')
  })

  test('a note over the bar line is tied into the next bar', () => {
    const c = chart([note(0, 2, 4, 67)])
    expect(body(c)).toBe('"C\u03947"z8 G8- | "C\u03947"G8 z8 |')
  })

  test('a note is cut at a chord change and at odd beat crossings', () => {
    const c = chart([note(0, 1, 2, 60), note(0, 3.25, 0.75, 62)],
      [{ chords: [{ symbol: 'D-7', beats: 2 }, { symbol: 'G7', beats: 2 }] }])
    expect(body(c)).toBe('"D-7"z4 C4- "G7"C4 zD3 |')
  })

  test('accidentals last for the bar, and a natural cancels them', () => {
    const c = chart([note(0, 0, 1, 66), note(0, 1, 1, 66), note(0, 2, 1, 65), note(1, 0, 1, 66)])
    expect(body(c)).toBe('"C\u03947"^F4 F4 =F4 z4 | "C\u03947"^F4 z12 |')
  })

  test('a bar without notes is a whole-bar rest', () => {
    expect(body(chart([note(0, 0, 4, 60)]))).toBe('"C\u03947"C16 | "C\u03947"Z |')
  })

  test('repeats and endings are drawn', () => {
    const c = chart([note(0, 0, 4, 60)], [{ repeatStart: true }, { ending: 1, repeatEnd: true }, { ending: 2, barline: 'final' }])
    expect(body(c)).toBe('|:"C\u03947"C16 |[1 "C\u03947"Z :|[2 "C\u03947"Z |]')
  })

  test('a rehearsal mark starts a new staff line', () => {
    const c = chart([], [{}, {}, { section: 'B' }])
    expect(body(c).split('\n')).toHaveLength(2)
  })

  test('one drawn event per note and rest, in order', () => {
    const c = chart([note(0, 0, 0.5, 60), note(0, 1, 1, 62)])
    const { events } = melodyToAbc(c, 0, DEFAULT_DISPLAY)
    expect(events.map((e) => [e.bar, e.at, e.beats, e.rest])).toEqual([
      [0, 0, 0.5, false], [0, 0.5, 0.5, true], [0, 1, 1, false], [0, 2, 2, true], [1, 0, 4, true]])
  })

  test('chord symbols follow the display settings and the transposition', () => {
    expect(chordText('D-7', 2, 2, { ...DEFAULT_DISPLAY, minor: 'm' })).toBe('Em7')
    expect(chordText('Bh7', 0, 0, DEFAULT_DISPLAY)).toBe('B\u00f87')
    expect(chordText('C7no5', 0, 0, DEFAULT_DISPLAY)).toBe('C7no5')
    expect(chordText(null, 0, 0, DEFAULT_DISPLAY)).toBe('N.C.')
  })
})

describe('melody model', () => {
  test('validation', () => {
    expect(isMelody({ notes: [note(0, 0, 1, 60)], program: 66 })).toBe(true)
    expect(isMelody({ notes: [note(0, 0, 0, 60)] })).toBe(false)
    expect(isMelody({ notes: [note(0, 0, 1, 128)] })).toBe(false)
  })

  test('the chord player leaves the melody out', () => {
    const c = chart([note(0, 0, 1, 60)])
    expect(hasMelody(c)).toBe(true)
    expect(hasMelody(withoutMelody(c))).toBe(false)
    expect(withoutMelody(c).bars).toBe(c.bars)
    expect(hasMelody(chart([]))).toBe(false)
  })

  test('notes grouped by bar', () => {
    expect([...notesByBar({ notes: [note(1, 0, 1, 60), note(0, 0, 1, 62)] }).keys()]).toEqual([1, 0])
  })
})

describe('melody playback', () => {
  test('notes follow repeats and choruses, swung, in each chorus\'s key', () => {
    const c = chart([note(0, 0.5, 0.5, 60)], [{ repeatStart: true }, { repeatEnd: true }])
    const timeline = buildTimeline(c, 0, 2, { keyStep: 5 })
    const events = melodyEvents(c, timeline, 3, 0.66, 0, 5)
    expect(events).toHaveLength(4) // two passes through the repeat, two choruses
    const first = timeline.bars.find((b) => b.measure === 0)!
    expect(events[0].tick).toBe(Math.round((first.start + 0.66) * PPQ))
    expect(events.map((e) => e.note)).toEqual([60, 60, 65, 65])
    expect(events.every((e) => e.channel === 3)).toBe(true)
  })
})
