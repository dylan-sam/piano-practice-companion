// Building lick and exercise charts: chords laid into 4/4 bars, note lines, a compact text
// notation for hand-written licks, and chord transposition. Shared by the exercise generator
// (lickExercises.ts), the miner (lickMining.ts) and the catalog (lickCatalog.ts).

import type { Chart, ChartBar } from '../src/music/chart'
import type { MelodyNote } from '../src/music/melody'
import type { LickInfo } from '../src/music/licks'

export const BAR_BEATS = 4

/** A chord and how long it lasts, in quarter notes (null is N.C.). */
export type ChordSpan = [symbol: string | null, beats: number]

/** A note placed in beats from the start of the lick, before it is split into bars. */
export interface TimedNote {
  start: number
  beats: number
  pitch: number
}

// Roots spelled as a lick in C spells them (flats, except F#)
const NAMES_IN_C = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']
const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** The pitch class of a note name (C, Eb, F#). */
export function pitchClass(name: string): number {
  let pc = LETTERS[name[0]]
  for (const sign of name.slice(1)) pc += sign === '#' ? 1 : sign === 'b' ? -1 : 0
  return (pc + 12) % 12
}

/** The name of a pitch class as written in the key of C. */
export const nameInC = (pc: number): string => NAMES_IN_C[((pc % 12) + 12) % 12]

/** Transpose a chart chord symbol (root and slash bass) by semitones. */
export function transposeSymbol(symbol: string, semitones: number): string {
  const match = /^([A-G][b#]?)([^/]*)(?:\/([A-G][b#]?))?$/.exec(symbol)
  if (!match) return symbol
  const [, root, suffix, bass] = match
  const moved = nameInC(pitchClass(root) + semitones) + suffix
  return bass ? `${moved}/${nameInC(pitchClass(bass) + semitones)}` : moved
}

/**
 * Lay chords into 4/4 bars (at least `minBars`). A chord going on through a whole bar leaves the
 * bar empty, as charts write it; one going on into a bar shared with other chords is written again.
 * The last chord lasts to the end of its bar.
 */
export function barsFromChords(spans: ChordSpan[], minBars = 1): ChartBar[] {
  const total = spans.reduce((sum, [, beats]) => sum + beats, 0)
  const count = Math.max(minBars, Math.ceil(total / BAR_BEATS - 1e-9))
  const pieces: { symbol: string | null; beats: number; goesOn: boolean }[][] = Array.from({ length: count }, () => [])
  let time = 0
  for (const [symbol, beats] of spans) {
    for (let at = time; at < time + beats - 1e-9;) {
      const bar = Math.floor(at / BAR_BEATS + 1e-9)
      const part = Math.min(time + beats - at, (bar + 1) * BAR_BEATS - at)
      pieces[bar].push({ symbol, beats: part, goesOn: at > time })
      at += part
    }
    time += beats
  }
  return pieces.map((list, i) => {
    const filled = list.reduce((sum, piece) => sum + piece.beats, 0)
    if (list.length && filled < BAR_BEATS - 1e-9) list[list.length - 1].beats += BAR_BEATS - filled
    const goesOn = list.length === 0 || (list.length === 1 && list[0].goesOn)
    return {
      chords: goesOn ? [] : list.map(({ symbol, beats }) => ({ symbol, beats })),
      cells: 4,
      rowStart: i % 4 === 0 || undefined,
      barline: i === count - 1 ? 'final' as const : undefined,
    }
  })
}

/** Split notes timed from the start of the lick into the chart's bars. */
export function toMelodyNotes(notes: TimedNote[]): MelodyNote[] {
  const round = (value: number) => Math.round(value * 1e6) / 1e6
  return [...notes].sort((a, b) => a.start - b.start).map((note) => {
    const bar = Math.floor(note.start / BAR_BEATS + 1e-9)
    return { bar, at: round(note.start - bar * BAR_BEATS), beats: round(note.beats), pitch: note.pitch }
  })
}

/** Pitches played one after another from a start beat; a null pitch is a rest. */
export function line(start: number, pitches: (number | null)[], lengths: number | number[]): TimedNote[] {
  const out: TimedNote[] = []
  let time = start
  pitches.forEach((pitch, i) => {
    const beats = typeof lengths === 'number' ? lengths : lengths[i % lengths.length]
    if (pitch !== null) out.push({ start: time, beats, pitch })
    time += beats
  })
  return out
}

// Note lengths of the text notation, in quarter notes: 16 sixteenth, 8 eighth, 8t triplet
// eighth, 4t triplet quarter, 4 quarter, 2 half, 1 whole; a dot adds half
const LENGTHS: Record<string, number> = { '16': 0.25, '8': 0.5, '8t': 1 / 3, '4t': 2 / 3, '4': 1, '2': 2, '1': 4 }

/**
 * Read a lick written as text: "D4:8 F4:8 A4:4. r:8" is D4 and F4 as eighths, A4 as a dotted
 * quarter, then an eighth rest. Middle C is C4 (MIDI 60).
 */
export function parseNotes(text: string, start = 0): TimedNote[] {
  const out: TimedNote[] = []
  let time = start
  for (const token of text.trim().split(/\s+/)) {
    const [name, value] = token.split(':')
    const dotted = value.endsWith('.')
    const base = LENGTHS[dotted ? value.slice(0, -1) : value]
    if (base === undefined) throw new Error(`Unknown length in "${token}"`)
    const beats = dotted ? base * 1.5 : base
    if (name !== 'r') {
      const match = /^([A-G][b#]*)(-?\d)$/.exec(name)
      if (!match) throw new Error(`Unknown note in "${token}"`)
      out.push({ start: time, beats, pitch: 12 * (Number(match[2]) + 1) + pitchClass(match[1]) })
    }
    time += beats
  }
  return out
}

/** Read chords written as text: "D-7:4 G7:4 C^7:8" (N.C. for no chord), lengths in quarter notes. */
export function parseChords(text: string): ChordSpan[] {
  return text.trim().split(/\s+/).map((token) => {
    const at = token.lastIndexOf(':')
    const symbol = token.slice(0, at)
    return [symbol === 'N.C.' ? null : symbol, Number(token.slice(at + 1))]
  })
}

/** What a lick chart is made of. */
export interface LickChartInput {
  title: string
  composer?: string
  chords: ChordSpan[]
  notes: TimedNote[]
  info: LickInfo
  bpm?: number
  style?: string
  key?: number
  minor?: boolean
}

/** A chart holding a lick or an exercise: its chords, its melody and its lick record. */
export function makeLickChart(input: LickChartInput): Chart {
  const end = Math.max(0, ...input.notes.map((note) => note.start + note.beats))
  const melody = toMelodyNotes(input.notes)
  return {
    format: 'openstand-chart',
    version: 1,
    title: input.title,
    composer: input.composer,
    style: input.style ?? 'swing',
    key: input.key ?? 0,
    minor: input.minor || undefined,
    bpm: input.bpm ?? 100,
    time: [4, 4],
    bars: barsFromChords(input.chords, Math.ceil(end / BAR_BEATS - 1e-9)),
    melody: { notes: melody, source: input.info.source },
    lick: input.info,
  }
}
