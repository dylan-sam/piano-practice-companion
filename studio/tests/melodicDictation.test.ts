// Melodic Dictation: excerpts, hidden notes, the staff, judging, and how hidden notes are written.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Chart } from '../src/music/chart'
import { onLickGrid } from '../src/music/licks'
import { melodyToAbc } from '../src/music/abc'
import { diatonicStep, moveBySteps, nearestLetter, noteAtPosition, positionOf, signatureKey, spelledName, spelledPitch } from '../src/music/staff'
import { parseStudioPlaylists } from '../src/library/playlistExport'
import type { Tune } from '../src/music/songs'
import { getStyle } from '../src/styles'
import { DEFAULT_DISPLAY } from '../src/ui/display'
import {
  answerChart, cutExcerpt, excerptAt, fromSource, hiddenRun, judge, MAX_ALL_NOTES, MAX_BARS, melodyAloneMidi, pickExcerpt,
  transposeGuesses, type Excerpt,
} from '../src/exercises/melodicDictation'
import { makeLickChart, parseChords, parseNotes } from '../scripts/lickCharts'

const info = { kind: 'lick' as const, category: 'Vocabulary', context: 'ii-V', source: 'test', license: 'CC BY 4.0' }

/** A song chart (no lick record) from chords and notes in the lick text notation. */
function song(chords: string, notes: string): Chart {
  const { lick: _lick, ...chart } = makeLickChart({ title: 'Song', composer: 'Someone', chords: parseChords(chords), notes: parseNotes(notes), info })
  return chart as Chart
}

/** A seeded random source, so picks can be repeated. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

// Eight bars of eighths, quarters and halves; the dotted half at the end of bar 6 runs into bar 7
const eightBars = song('D-7:4 G7:4 C^7:4 C^7:4 D-7:4 G7:4 C^7:4 C^7:4',
  'D4:8 E4:8 F4:8 G4:8 A4:4 F4:4 ' + 'B4:8 A4:8 G4:8 F4:8 D4:2 ' + 'E4:4 G4:4 B4:4 D5:4 ' + 'C5:1 ' +
  'D5:8 C5:8 A4:8 F4:8 D4:2 ' + 'F4:4 B4:4 A4:2. ' + 'G4:2 E4:2 ' + 'C4:1')

describe('cutting an excerpt', () => {
  it('moves the bars to the start and keeps the chords, meter and key', () => {
    const excerpt = cutExcerpt(eightBars, 2, 3)!
    expect(excerpt.bars).toHaveLength(2)
    expect(excerpt.bars[0].chords[0].symbol).toBe('C^7')
    expect(excerpt.time).toEqual([4, 4])
    expect(excerpt.melody!.notes.map((n) => [n.bar, n.at, n.pitch])).toEqual([[0, 0, 64], [0, 1, 67], [0, 2, 71], [0, 3, 74], [1, 0, 72]])
  })

  it('refuses a run that starts in the middle of a held note', () => {
    // Bar 6 ends with a dotted half that runs a beat into bar 7
    expect(cutExcerpt(eightBars, 6, 7)).toBeNull()
    expect(cutExcerpt(eightBars, 5, 6)).not.toBeNull()
    const tied = song('C:4 C:4', 'C4:2 D4:1 E4:2')
    expect(cutExcerpt(tied, 1, 1)).toBeNull()
  })

  it('cuts a note that runs past the end of the run', () => {
    const tied = song('C:4 C:4', 'C4:2 D4:1 E4:2')
    const excerpt = cutExcerpt(tied, 0, 0)!
    expect(excerpt.melody!.notes.at(-1)).toMatchObject({ at: 2, beats: 2, pitch: 62 })
  })

  it('refuses notes off the lick grid (shorter than a sixteenth)', () => {
    const chart = song('C:4', 'C4:4 D4:4 E4:4 F4:4')
    chart.melody!.notes[1] = { ...chart.melody!.notes[1], beats: 0.125 }
    expect(cutExcerpt(chart, 0, 0)).toBeNull()
  })

  it('finds the shortest run of two to four bars with enough notes', () => {
    const excerpt = excerptAt(eightBars, 0, 3)!
    expect(excerpt.bars).toHaveLength(2)
    expect(excerptAt(eightBars, 0, 12)!.bars).toHaveLength(3)
    // No four bars from bar 4 hold 25 notes
    expect(excerptAt(eightBars, 4, 23)).toBeNull()
  })
})

describe('hidden notes', () => {
  it('never hide the first or the last note', () => {
    for (let seed = 1; seed < 50; seed++) {
      const run = hiddenRun(9, 3, seeded(seed))
      expect(run).toHaveLength(3)
      expect(run[0]).toBeGreaterThanOrEqual(1)
      expect(run.at(-1)).toBeLessThanOrEqual(7)
      expect(run.every((index, i) => i === 0 || index === run[i - 1] + 1)).toBe(true)
    }
  })
  it('hide every middle note for "all"', () => {
    expect(hiddenRun(6, 'all')).toEqual([1, 2, 3, 4])
  })
})

describe('the staff', () => {
  it('names the lines and spaces of each clef', () => {
    expect(noteAtPosition(0, 'treble', 0)).toEqual({ letter: 'F', accidental: 0, octave: 5 })
    expect(noteAtPosition(8, 'treble', 0)).toEqual({ letter: 'E', accidental: 0, octave: 4 })
    expect(noteAtPosition(10, 'treble', 0)).toEqual({ letter: 'C', accidental: 0, octave: 4 })
    expect(noteAtPosition(0, 'bass', 0)).toEqual({ letter: 'A', accidental: 0, octave: 3 })
    expect(noteAtPosition(-2, 'bass', 0)).toEqual({ letter: 'C', accidental: 0, octave: 4 })
  })
  it('takes the key signature', () => {
    // B in F major is B-flat; F in D major is F-sharp; E-flat major from C minor
    expect(spelledName(noteAtPosition(4, 'treble', 5))).toBe('B♭4')
    expect(spelledName(noteAtPosition(0, 'treble', 2))).toBe('F♯5')
    expect(signatureKey(0, true)).toBe(3)
  })
  it('goes back and forth between notes and places', () => {
    for (let position = -6; position <= 14; position++) {
      expect(positionOf(noteAtPosition(position, 'treble', 0), 'treble')).toBe(position)
    }
    expect(spelledPitch({ letter: 'C', accidental: 0, octave: 4 })).toBe(60)
    expect(spelledPitch({ letter: 'B', accidental: 1, octave: 3 })).toBe(60)
    expect(diatonicStep({ letter: 'C', accidental: 0, octave: 4 })).toBe(28)
  })
  it('moves by steps and finds the nearest letter', () => {
    expect(moveBySteps({ letter: 'B', accidental: 0, octave: 4 }, 1, 0)).toEqual({ letter: 'C', accidental: 0, octave: 5 })
    expect(moveBySteps({ letter: 'C', accidental: 0, octave: 5 }, -7, 0)).toEqual({ letter: 'C', accidental: 0, octave: 4 })
    expect(nearestLetter('B', 60, 0)).toEqual({ letter: 'B', accidental: 0, octave: 3 })
    expect(nearestLetter('E', 60, 3)).toEqual({ letter: 'E', accidental: -1, octave: 4 })
  })
})

describe('answers', () => {
  const chart = song('C:4', 'C4:4 D4:4 E4:4 G4:4')
  const excerpt: Excerpt = { id: 'x', chart, title: 'Song', detail: 'bar 1', hidden: [1, 2] }

  it('count the pitch with its octave, in any spelling', () => {
    expect(judge(excerpt, { 1: { pitch: 62 }, 2: { pitch: 76 } }, 0)).toEqual({ 1: 'correct', 2: 'wrong' })
    expect(judge(excerpt, { 1: { pitch: 64 } }, 2)).toEqual({ 1: 'correct', 2: 'missing' })
    expect(judge(excerpt, { 2: { pitch: 64, spelled: { letter: 'F', accidental: -1, octave: 4 } } }, 0)[2]).toBe('correct')
  })

  it('play the placed notes, leaving out the empty ones', () => {
    const answer = answerChart(excerpt, { 1: { pitch: 65 } }, 0)
    expect(answer.melody!.notes.map((n) => n.pitch)).toEqual([60, 65, 67])
  })

  it('follow a change of key', () => {
    expect(transposeGuesses({ 1: { pitch: 62, spelled: { letter: 'D', accidental: 0, octave: 4 } } }, 3)).toEqual({ 1: { pitch: 65 } })
  })

  it('play the melody alone after a count-in', () => {
    const { midi, timeline } = melodyAloneMidi(chart, getStyle('swing'), 0, 1)
    expect(new TextDecoder().decode(midi.slice(0, 4))).toBe('MThd')
    expect(timeline.countIn).toBe(8)
  })
})

describe('writing hidden and placed notes', () => {
  const chart = song('C:4', 'C4:4 D4:4 E4:2')

  it('draws hidden notes as slashes on the middle line, with the note they come from', () => {
    const { abc, events } = melodyToAbc(chart, 0, DEFAULT_DISPLAY, 4, { rhythmOnly: (i) => i === 1, chords: false })
    expect(abc).toContain('!style=rhythm!B4')
    expect(abc).not.toContain('"C"')
    expect(events.filter((e) => !e.rest).map((e) => e.note)).toEqual([0, 1, 2])
  })

  it('keeps a slash with no accidental in a key with flats, and in the bass clef on D', () => {
    const flat = { ...chart, key: 5 }
    expect(melodyToAbc(flat, 0, DEFAULT_DISPLAY, 4, { rhythmOnly: (i) => i === 1 }).abc).toContain('!style=rhythm!B4')
    expect(melodyToAbc(chart, 0, DEFAULT_DISPLAY, 4, { rhythmOnly: (i) => i === 1, clef: 'bass' }).abc).toContain('!style=rhythm!D,4')
  })

  it('writes a placed note as it was spelled', () => {
    const sharp = { ...chart, melody: { notes: chart.melody!.notes.map((n, i) => (i === 1 ? { ...n, pitch: 63 } : n)) } }
    const { abc } = melodyToAbc(sharp, 0, DEFAULT_DISPLAY, 4, { spelling: (i) => (i === 1 ? { letter: 'D', accidental: 1, octave: 4 } : undefined) })
    expect(abc).toContain('^D4')
    expect(melodyToAbc(sharp, 0, DEFAULT_DISPLAY).abc).toContain('_E4')
  })

  it('ties the slashes of a hidden note held over a bar line', () => {
    const held = song('C:4 C:4', 'C4:2 D4:4 E4:2 F4:2')
    const { abc, events } = melodyToAbc(held, 0, DEFAULT_DISPLAY, 4, { rhythmOnly: (i) => i === 2 })
    expect(abc).toMatch(/!style=rhythm!B4-.*\|.*!style=rhythm!B4/)
    expect(events.filter((e) => e.note === 2)).toHaveLength(2)
  })
})

describe('excerpts of the shipped songs and licks', () => {
  /** The tunes of a shipped file, as the app reads them. */
  const read = (path: string): Tune[] => parseStudioPlaylists(readFileSync(path, 'utf8'))
    .flatMap((list) => list.charts.map((chart) => ({ id: `${list.name}:${chart.title}`, chart, source: 'bundled' as const, addedAt: 0 })))
  const licks = read('public/licks/licks.json')
  const songs = read('public/leadsheets/catalog.json')

  it('are short, on the lick grid, and hide notes between the first and the last', () => {
    for (const [tunes, source] of [[licks, 'licks'], [songs, 'songs']] as const) {
      const pool = tunes.filter(fromSource(source))
      expect(pool.length, source).toBeGreaterThan(50)
      const random = seeded(7)
      for (const guesses of [1, 3, 8, 'all'] as const) {
        for (let i = 0; i < 40; i++) {
          const excerpt = pickExcerpt(pool, guesses, random)!
          expect(excerpt, `${source} ${guesses}`).not.toBeNull()
          const notes = excerpt.chart.melody!.notes
          expect(excerpt.chart.bars.length).toBeLessThanOrEqual(MAX_BARS)
          expect(onLickGrid(notes, excerpt.chart.time[0] * 4 / excerpt.chart.time[1])).toBe(true)
          expect(excerpt.hidden).not.toContain(0)
          expect(excerpt.hidden).not.toContain(notes.length - 1)
          if (guesses === 'all') expect(notes.length).toBeLessThanOrEqual(MAX_ALL_NOTES)
          else expect(excerpt.hidden).toHaveLength(guesses)
        }
      }
    }
  })

  it('leave the drills of the lick database out', () => {
    expect(licks.filter(fromSource('licks')).every((tune) => tune.chart.lick?.kind !== 'exercise')).toBe(true)
    expect(songs.filter(fromSource('licks'))).toHaveLength(0)
  })
})
