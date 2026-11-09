// Lick Sightreading: a one-chord lick written over every chord of a chart.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Chart } from '../src/music/chart'
import { chordTones, parseChord } from '../src/music/chords'
import { parseStudioPlaylists } from '../src/library/playlistExport'
import { chordSlots, isOneChordLick, lickShape, withLick } from '../src/exercises/lickReading'
import { makeLickChart, parseChords, parseNotes } from '../scripts/lickCharts'

const info = { kind: 'lick' as const, category: 'Vocabulary', context: 'min7', source: 'test', license: 'CC BY 4.0' }
// "The Lick" over C-7: C D Eb F D(quarter) Bb C
const theLick = makeLickChart({ title: 'The Lick', chords: parseChords('C-7:4'), notes: parseNotes('C4:8 D4:8 Eb4:8 F4:8 D4:4 Bb3:8 C4:8'), info })

/** A chart of chords only, in 4/4. */
function chordChart(chords: string): Chart {
  return makeLickChart({ title: 'Song', chords: parseChords(chords), notes: [], info }) as Chart
}

const pitches = (chart: Chart) => chart.melody!.notes.map((n) => n.pitch)

describe('chord slots', () => {
  it('put the chord tones on slots 1, 3, 5 and 7', () => {
    for (const symbol of ['C^7', 'C-7', 'C7', 'Ch7', 'Co7', 'C-^7', 'C7alt', 'C7b9', 'C^7#11', 'C7#11', 'F#-7', 'Bb7']) {
      const chord = parseChord(symbol)!
      const slots = chordSlots(chord)
      expect([0, 2, 4, 6].map((i) => slots[i]), symbol).toEqual(chordTones(chord))
      expect(slots.every((value, i) => i === 0 || value >= slots[i - 1]), symbol).toBe(true)
    }
  })
  it('alter the tensions as the chord scale does', () => {
    expect(chordSlots(parseChord('C7alt')!)).toEqual([0, 1, 4, 6, 8, 8, 10])
    expect(chordSlots(parseChord('C7b9')!)).toEqual([0, 1, 4, 5, 7, 8, 10])
    expect(chordSlots(parseChord('Ch7')!)).toEqual([0, 1, 3, 5, 6, 8, 10])
  })
})

describe('lick shapes', () => {
  it('read a lick as slots of its chord, with chromatic steps', () => {
    const shape = lickShape(theLick)!
    expect(shape.length).toBe(4)
    expect(shape.notes.map((n) => [n.degree, n.alter])).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [1, 0], [-1, 0], [0, 0]])
    // A chromatic note between two slots counts from the slot above it (an approach from below)
    const approach = makeLickChart({ title: 'x', chords: parseChords('C7:4'), notes: parseNotes('D#4:4 E4:4 F#4:4 G4:4'), info })
    expect(lickShape(approach)!.notes.map((n) => [n.degree, n.alter])).toEqual([[2, -1], [2, 0], [4, -1], [4, 0]])
  })
  it('only take licks over one chord', () => {
    expect(isOneChordLick(theLick)).toBe(true)
    const twoChords = makeLickChart({ title: 'x', chords: parseChords('D-7:2 G7:2'), notes: parseNotes('D4:1'), info })
    expect(isOneChordLick(twoChords)).toBe(false)
  })
})

describe('a lick over a chart', () => {
  it('follows every chord change, in the middle of the lick too, staying close to the note before', () => {
    const chart = withLick(chordChart('D-7:2 G7:2 C^7:4'), lickShape(theLick)!, { rest: false })
    // D-7: D E F G; G7 from beat 3: the 9th A, the 7th F, the root G; C^7: the major Lick C D E F D B C
    expect(pitches(chart)).toEqual([62, 64, 65, 67, 69, 65, 67, 60, 62, 64, 65, 62, 59, 60])
    expect(chart.melody!.notes.slice(7).every((n) => n.bar === 1)).toBe(true)
  })
  it('leaves a rest as long as the lick between licks when asked', () => {
    const chart = withLick(chordChart('C-7:4 F7:4 Bb^7:4'), lickShape(theLick)!, { rest: true })
    expect([...new Set(chart.melody!.notes.map((n) => n.bar))]).toEqual([0, 2])
  })
  it('starts after the bars of rest asked for (the top of an infinite sheet)', () => {
    const chart = withLick(chordChart('C-7:4 F7:4 Bb^7:4'), lickShape(theLick)!, { rest: false, leadIn: 1 })
    expect([...new Set(chart.melody!.notes.map((n) => n.bar))]).toEqual([1, 2])
  })
  it('keeps a held note when the chord changes under it and leaves out notes over N.C.', () => {
    const held = makeLickChart({ title: 'x', chords: parseChords('C7:4'), notes: parseNotes('E4:2 G4:2'), info })
    const chart = withLick(chordChart('C7:1 F7:3 N.C.:4'), lickShape(held)!, { rest: false })
    // E is held over the change to F7; the next note, the 5th, is F7's C, closest to that E
    expect(chart.melody!.notes.map((n) => [n.bar, n.at, n.pitch])).toEqual([[0, 0, 64], [0, 2, 60]])
  })
})

describe('the shipped one-chord licks', () => {
  const charts = ['licks.json', 'licks_weimar.json'].flatMap((file) =>
    parseStudioPlaylists(readFileSync(new URL(`../public/licks/${file}`, import.meta.url), 'utf8')).flatMap((p) => p.charts))
  const licks = charts.filter(isOneChordLick)
  it('are many', () => {
    expect(licks.length).toBeGreaterThan(400)
  })
  it('come back unchanged when written over their own chord', () => {
    for (const lick of licks) {
      const again = withLick({ ...lick, melody: undefined }, lickShape(lick)!, { rest: false })
      expect(pitches(again), lick.title).toEqual(pitches(lick))
    }
  })
})
