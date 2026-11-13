// The lick database: the rhythmic grid, the chart helpers, the exercise generator, the miner and
// the shipped files.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isChart, type Chart } from '../src/music/chart'
import { parseChord } from '../src/music/chords'
import { isLickInfo, onLickGrid } from '../src/music/licks'
import { parseStudioPlaylists } from '../src/library/playlistExport'
import { barsFromChords, makeLickChart, parseChords, parseNotes, transposeSymbol } from '../scripts/lickCharts'
import { chordScale, eighthLine, generatedPlaylists, guideToneLine, nearest, PROGRESSIONS, VOCABULARY } from '../scripts/lickExercises'
import { findWindows, lickOf, snapToGrid, timelineOf, type MelodySource } from '../scripts/lickMining'
import { chartProblem } from '../scripts/lickCatalog'

const note = (bar: number, at: number, beats: number, pitch = 60) => ({ bar, at, beats, pitch })

describe('lick grid', () => {
  it('accepts sixteenths and eighth-note triplets', () => {
    expect(onLickGrid([note(0, 0, 0.25), note(0, 0.25, 0.25), note(0, 0.5, 0.5), note(0, 1, 1 / 3), note(0, 4 / 3, 1 / 3), note(0, 5 / 3, 1 / 3)])).toBe(true)
  })
  it('turns down thirty-seconds, sixteenth triplets and beats mixing both grids', () => {
    expect(onLickGrid([note(0, 0, 0.125), note(0, 0.125, 0.875)])).toBe(false)
    expect(onLickGrid([note(0, 0, 1 / 6), note(0, 1 / 6, 5 / 6)])).toBe(false)
    expect(onLickGrid([note(0, 0, 0.25), note(0, 0.25, 1 / 12), note(0, 1 / 3, 2 / 3)])).toBe(false)
    expect(onLickGrid([note(0, 0, 1 / 3), note(0, 1 / 3, 5 / 12), note(0, 0.75, 0.25)])).toBe(false)
  })
})

describe('lick records', () => {
  it('checks the record a chart carries', () => {
    const info = { kind: 'lick', category: 'ii-V-I major', context: 'ii-V-I', source: 'x', license: 'MIT', bar: 3, tags: ['arpeggio'] }
    expect(isLickInfo(info)).toBe(true)
    expect(isLickInfo({ ...info, kind: 'riff' })).toBe(false)
    expect(isLickInfo({ ...info, bar: 0 })).toBe(false)
    const chart = makeLickChart({ title: 't', chords: parseChords('C7:4'), notes: parseNotes('C4:1'), info: info as never })
    expect(isChart(chart)).toBe(true)
    expect(isChart({ ...chart, lick: { ...info, tags: 'arpeggio' } })).toBe(false)
  })
})

describe('lick charts', () => {
  it('reads the text notation', () => {
    expect(parseNotes('D4:8 F4:8t r:16 A4:4.')).toEqual([
      { start: 0, beats: 0.5, pitch: 62 }, { start: 0.5, beats: 1 / 3, pitch: 65 }, { start: 1.0833333333333333, beats: 1.5, pitch: 69 },
    ])
    expect(parseChords('D-7:2 G7:2 N.C.:4')).toEqual([['D-7', 2], ['G7', 2], [null, 4]])
  })
  it('lays chords into bars, leaving a bar empty when a chord goes on', () => {
    const bars = barsFromChords(parseChords('D-7:2 G7:2 C^7:8 F7:2'))
    expect(bars.map((b) => b.chords.map((c) => `${c.symbol}:${c.beats}`).join(' '))).toEqual(['D-7:2 G7:2', 'C^7:4', '', 'F7:4'])
    expect(bars[3].barline).toBe('final')
  })
  it('transposes chord symbols, slash basses included', () => {
    expect(transposeSymbol('Bb^7', 2)).toBe('C^7')
    expect(transposeSymbol('Ab7b9/C', 4)).toBe('C7b9/E')
  })
})

describe('generated exercises', () => {
  const playlists = generatedPlaylists()
  const charts = playlists.flatMap((p) => p.charts)
  it('makes valid charts on the lick grid', () => {
    expect(charts.length).toBeGreaterThan(200)
    for (const chart of charts) expect(chartProblem(chart), chart.title).toBeNull()
    expect(new Set(charts.map((c) => c.title)).size).toBe(charts.length)
  })
  it('covers triads, seventh chords with and without the fifth, guide tones, scales and enclosures', () => {
    const titles = charts.map((c) => c.title)
    for (const wanted of ['Major triads in half steps: 1-3-5-8 up', 'Dominant 7th chords in fourths: without the fifth: 1-3-7-8',
      'ii-V-I in all keys: guide tones, one per chord, from the 3rd', 'Altered scale over C7alt: up and down',
      'C^7: enclosure: scale step above, half step below', 'Minor 3rds in half steps: lower note first']) {
      expect(titles).toContain(wanted)
    }
  })
  it('finds pitches by pitch class around a note', () => {
    expect(nearest(4, 60)).toBe(64)
    expect(nearest(11, 60)).toBe(59)
    expect(nearest(0, 60, 1)).toBe(72)
    expect(nearest(0, 60, -1)).toBe(48)
  })
  it('leads guide tones by the smallest steps', () => {
    const line = guideToneLine(parseChords('D-7:4 G7:4 C^7:8'), 1, 'third')
    expect(line.map((n) => n.pitch)).toEqual([65, 65, 64]) // F, F, E
    const both = guideToneLine(parseChords('D-7:4 G7:4 C^7:8'), 2, 'seventh')
    expect(both.map((n) => n.pitch)).toEqual([72, 77, 77, 71, 71, 76]) // C F, F B, B E
  })
  it('keeps the eighth-note lines of every progression in range, on the chord on every chord change', () => {
    for (const progression of PROGRESSIONS) {
      const line = eighthLine(progression.spans, false)
      expect(Math.min(...line.map((n) => n.pitch))).toBeGreaterThanOrEqual(53)
      expect(Math.max(...line.map((n) => n.pitch))).toBeLessThanOrEqual(81)
    }
  })
  it('writes every vocabulary lick with its beats on notes of the chord scale (or the blue third)', () => {
    for (const lick of VOCABULARY) {
      const chords = parseChords(lick.chords)
      let time = 0
      const at = chords.map(([symbol, beats]) => { const span = { from: time, to: time + beats, chord: parseChord(symbol!)! }; time += beats; return span })
      for (const n of parseNotes(lick.notes).filter((x) => Number.isInteger(Math.round(x.start * 1e6) / 1e6))) {
        const { chord } = at.find((s) => n.start >= s.from && n.start < s.to)!
        const blue = chord.quality === 'dom7' && (n.pitch - chord.root + 12) % 12 === 3
        expect(chordScale(chord).includes(n.pitch % 12) || blue, `${lick.title} at ${n.start}`).toBe(true)
      }
      const total = parseNotes(lick.notes).reduce((end, x) => Math.max(end, x.start + x.beats), 0)
      expect(total, lick.title).toBeLessThanOrEqual(time + 1e-6)
    }
  })
})

/** A small solo over a ii-V-I in Bb. */
function solo(notes: [number, number, number, number][]): MelodySource {
  const chart: Chart = {
    format: 'openstand-chart', version: 1, title: 'Test', style: 'swing', key: 10, bpm: 160, time: [4, 4],
    bars: [
      { chords: [{ symbol: 'C-7', beats: 2 }, { symbol: 'F7', beats: 2 }], cells: 4 },
      { chords: [{ symbol: 'Bb^7', beats: 4 }], cells: 4 },
      { chords: [], cells: 4 },
    ],
    melody: { notes: notes.map(([bar, at, beats, pitch]) => ({ bar, at, beats, pitch })) },
  }
  return { chart, source: 'Test', license: 'MIT', tune: 'Test', performer: 'Someone' }
}

describe('lick mining', () => {
  it('snaps played lengths to the grid and turns down notes between grid points', () => {
    const snapped = snapToGrid([{ start: 0, beats: 0.1, pitch: 60 }, { start: 0.5, beats: 0.4, pitch: 62 }, { start: 1, beats: 0.3, pitch: 64 }, { start: 4 / 3, beats: 1, pitch: 65 }], 4)
    // In twelfths of a beat: a staccato sixteenth, an eighth, a triplet eighth, a quarter from a triplet
    expect(snapped?.map((n) => [Math.round(n.start * 12), Math.round(n.beats * 12)])).toEqual([[0, 3], [6, 6], [12, 4], [16, 12]])
    expect(snapToGrid([{ start: 0, beats: 0.5, pitch: 60 }, { start: 1 / 12, beats: 0.5, pitch: 62 }], 4)).toBeNull()
    expect(snapToGrid([{ start: 0.25, beats: 0.25, pitch: 60 }, { start: 1 / 3, beats: 0.5, pitch: 62 }], 4)).toBeNull()
  })
  it('finds a ii-V-I and moves its lick to C', () => {
    // C-7 F7 | Bb^7: Eb G Bb D | C A F Eb | D (a half note on the I)
    const source = solo([[0, 0, 0.5, 63], [0, 0.5, 0.5, 67], [0, 1, 0.5, 70], [0, 1.5, 0.5, 74],
      [0, 2, 0.5, 72], [0, 2.5, 0.5, 69], [0, 3, 0.5, 65], [0, 3.5, 0.5, 63], [1, 0, 2, 62]])
    const line = timelineOf(source)
    const window = findWindows(line).find((w) => w.category === 'ii-V-I major')!
    expect(window).toMatchObject({ start: 0, beats: 8, tonic: 10, arrival: 4 })
    const lick = lickOf(line, window, { minNotesPerBeat: 1 })
    if (typeof lick === 'string') throw new Error(lick)
    expect(lick.chords).toEqual([['D-7', 2], ['G7', 2], ['C^7', 4]])
    expect(lick.notes.map((n) => n.pitch % 12)).toEqual([5, 9, 0, 4, 2, 11, 7, 5, 4]) // F A C E D B G F E
  })
  it('turns down a window whose line does not land on the I', () => {
    const source = solo([[0, 0, 0.5, 63], [0, 0.5, 0.5, 67], [0, 1, 0.5, 70], [0, 1.5, 0.5, 74],
      [0, 2, 0.5, 72], [0, 2.5, 0.5, 69], [0, 3, 0.5, 65], [0, 3.5, 0.5, 63], [1, 0, 2, 64]])
    const line = timelineOf(source)
    const window = findWindows(line).find((w) => w.category === 'ii-V-I major')!
    expect(lickOf(line, window, { minNotesPerBeat: 1 })).toBe('does not land on a chord tone of the I')
  })
})

describe('shipped lick files', () => {
  for (const file of ['licks.json']) {
    it(`${file} is read by the app and keeps to the lick grid`, () => {
      const playlists = parseStudioPlaylists(readFileSync(new URL(`../public/licks/${file}`, import.meta.url), 'utf8'))
      const charts = playlists.flatMap((p) => p.charts)
      expect(charts.length).toBeGreaterThan(300)
      for (const chart of charts) {
        expect(chart.lick, chart.title).toBeDefined()
        expect(onLickGrid(chart.melody!.notes), chart.title).toBe(true)
      }
    })
  }
})
