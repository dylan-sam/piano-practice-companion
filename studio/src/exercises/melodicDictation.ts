// Melodic Dictation: hear a short excerpt of a lead sheet or a lick, then write its hidden notes.
//
// An excerpt is at most four bars of one meter, cut from a song or a lick of the lick database,
// whose notes keep to the lick grid (no value shorter than a sixteenth, eighth-note triplets).
// The first and last notes are always shown; a run of notes between them is hidden: drawn as
// slashes that keep the rhythm without the pitch. The player places each hidden note on the
// staff, then checks the answer: the pitch counts with its octave, in any spelling.

import { barMeters, type Chart, type ChartBar } from '../music/chart'
import { onLickGrid } from '../music/licks'
import { spellPitch, type Spelled } from '../music/abc'
import type { MelodyNote } from '../music/melody'
import type { Tune } from '../music/songs'
import type { StyleDefinition } from '../styles/types'
import { CHANNELS, BASE_BPM } from '../engine/arrange'
import { generateDrums } from '../engine/drums'
import { melodyEvents } from '../engine/melody'
import { writeMidi } from '../engine/midiWriter'
import { buildTimeline, type Timeline } from '../engine/timeline'

/** The most bars an excerpt has. */
export const MAX_BARS = 4
/** How many notes to write: a number of notes, or every note between the first and the last. */
export type Guesses = number | 'all'
export const GUESS_CHOICES: Guesses[] = [1, 2, 3, 4, 5, 6, 8, 10, 12, 'all']
/** With "all", an excerpt has at most this many notes, so a run of sixteenths stays playable by ear. */
export const MAX_ALL_NOTES = 16
/** Where excerpts come from: songs (lead sheets), licks, or both. */
export type DictationSource = 'both' | 'songs' | 'licks'

/** An excerpt to write down: its chart (bars from 0), where it comes from, and the notes to find. */
export interface Excerpt {
  id: string // the tune and the first bar, so the next excerpt can differ
  chart: Chart // the excerpt alone: its melody, chords and meter, in the key of the source
  title: string // the song or lick it comes from
  detail: string // the composer or the lick's source, and the bars, e.g. "bars 5-8"
  hidden: number[] // indexes of the hidden notes in chart.melody.notes, in time order
}

/** A placed note: the pitch it sounds (in the key on the stand) and how it is written. */
export interface Guess {
  pitch: number
  spelled?: Spelled // as placed on the staff; without it the key spells it
}

/** How a hidden note was answered. */
export type NoteResult = 'correct' | 'wrong' | 'missing'

const EPS = 1e-6

/** The key (tonic pitch class and mode) in force at a written bar: the chart's, then its changes. */
function keyAt(chart: Chart, bar: number): { key: number; minor: boolean } {
  let key = chart.key
  let minor = !!chart.minor
  for (let i = 0; i <= bar; i++) {
    for (const change of chart.bars[i]?.keys ?? []) {
      if (i < bar || change.beats === 0) {
        key = change.key
        minor = !!change.minor
      }
    }
  }
  return { key, minor }
}

/** Whether bars first..last (written order) can be an excerpt: one simple meter, no jumps, no key change inside. */
function playableRun(chart: Chart, first: number, last: number): boolean {
  const meters = barMeters(chart)
  const meter = meters[first]
  if (!meter || meter.compound || !Number.isInteger(meter.beats)) return false
  for (let i = first; i <= last; i++) {
    const bar = chart.bars[i]
    if (!bar || bar.spacer || bar.partial || bar.end) return false
    if (meters[i].time[0] !== meter.time[0] || meters[i].time[1] !== meter.time[1]) return false
    // A key change inside the run, a jump back (repeat end) before its last bar, or an ending after its first
    if (bar.keys?.some((k) => i > first || k.beats > 0)) return false
    if (i < last && bar.repeatEnd) return false
    if (i > first && bar.ending) return false
  }
  return true
}

/** The bar lengths of bars first..last, in quarter notes, and where each bar starts in the run. */
function runStarts(chart: Chart, first: number, last: number): number[] {
  const meters = barMeters(chart)
  const starts: number[] = []
  let time = 0
  for (let i = first; i <= last; i++) {
    starts.push(time)
    time += meters[i].beats
  }
  starts.push(time)
  return starts
}

/**
 * The notes of bars first..last, moved to bars from 0 and cut at the end of the run, or null
 * when a note runs in from before the run or the notes leave the lick grid.
 */
function runNotes(chart: Chart, first: number, last: number): MelodyNote[] | null {
  const starts = runStarts(chart, first, last)
  const allStarts = runStarts(chart, 0, chart.bars.length - 1)
  const runStart = allStarts[first]
  const end = starts[starts.length - 1]
  const notes: MelodyNote[] = []
  for (const note of chart.melody?.notes ?? []) {
    const start = allStarts[note.bar] + note.at - runStart
    if (start < -EPS) {
      // A note from before the run that still sounds at its start
      if (start + note.beats > EPS) return null
      continue
    }
    if (start >= end - EPS) continue
    const bar = note.bar - first
    notes.push({ bar, at: note.at, beats: Math.min(note.beats, end - start), pitch: note.pitch })
  }
  notes.sort((a, b) => starts[a.bar] + a.at - (starts[b.bar] + b.at))
  const barBeats = barMeters(chart)[first].beats
  return onLickGrid(notes, barBeats) ? notes : null
}

/** A bar of the excerpt: the source bar's chords and length, without its marks (repeats, sections...). */
const plainBar = (bar: ChartBar): ChartBar => ({
  chords: bar.chords.map(({ symbol, beats }) => ({ symbol, beats })),
  cells: 4,
})

/** Cut bars first..last of a chart as an excerpt chart, or null when they cannot be one. */
export function cutExcerpt(chart: Chart, first: number, last: number): Chart | null {
  if (!playableRun(chart, first, last)) return null
  const notes = runNotes(chart, first, last)
  if (!notes?.length) return null
  const { key, minor } = keyAt(chart, first)
  // The chord in force at the start, when the first bar keeps the chord of the bar before
  const bars = chart.bars.slice(first, last + 1).map(plainBar)
  if (!bars[0].chords.length) {
    const before = chart.bars.slice(0, first).findLast((bar) => bar.chords.length)?.chords.at(-1)
    bars[0].chords = [{ symbol: before?.symbol ?? null, beats: barMeters(chart)[first].beats }]
  }
  return {
    format: 'openstand-chart',
    version: 1,
    title: chart.title,
    ...(chart.composer ? { composer: chart.composer } : {}),
    style: chart.style,
    key,
    ...(minor ? { minor } : {}),
    bpm: chart.bpm,
    time: barMeters(chart)[first].time,
    bars,
    melody: { notes, ...(chart.melody?.program !== undefined ? { program: chart.melody.program } : {}) },
  }
}

/** Whether a bar of a chart holds the start of a melody note. */
const startsNote = (chart: Chart, bar: number) => !!chart.melody?.notes.some((n) => n.bar === bar)

/**
 * Find an excerpt of a chart starting at a bar, for `guesses` hidden notes: the shortest run of
 * at least two bars (at most four) with enough notes, or for "all" a run of a random length
 * with 3 to MAX_ALL_NOTES notes. Null when there is none at that bar.
 */
export function excerptAt(chart: Chart, first: number, guesses: Guesses, random: () => number = Math.random): Chart | null {
  if (!startsNote(chart, first)) return null
  if (guesses === 'all') {
    const length = 1 + Math.floor(random() * MAX_BARS)
    const last = first + length - 1
    if (!startsNote(chart, last)) return null
    const excerpt = cutExcerpt(chart, first, last)
    const count = excerpt?.melody?.notes.length ?? 0
    return count >= 3 && count <= MAX_ALL_NOTES ? excerpt : null
  }
  for (let length = 2; length <= MAX_BARS; length++) {
    const excerpt = cutExcerpt(chart, first, first + length - 1)
    if (!excerpt) return null // a longer run would hold the same problem
    if ((excerpt.melody?.notes.length ?? 0) >= guesses + 2) return excerpt
  }
  return null
}

/** The run of notes to hide: `guesses` notes in a row between the first note and the last. */
export function hiddenRun(noteCount: number, guesses: Guesses, random: () => number = Math.random): number[] {
  const middle = Math.max(0, noteCount - 2)
  const count = guesses === 'all' ? middle : Math.min(guesses, middle)
  const start = 1 + Math.floor(random() * (middle - count + 1))
  return Array.from({ length: count }, (_, i) => start + i)
}

/** Whether a tune can give excerpts from a source: a lead sheet (song), or a lick or pattern (not a drill). */
export const fromSource = (source: DictationSource) => (tune: Tune): boolean => {
  if (!tune.chart.melody?.notes.length) return false
  const lick = tune.chart.lick
  if (lick) return source !== 'songs' && lick.kind !== 'exercise'
  return source !== 'licks'
}

/** The name of where an excerpt comes from: the composer, or who played the lick (else its collection), and its bars. */
function excerptDetail(chart: Chart, first: number, last: number): string {
  const bars = first === last ? `bar ${first + 1}` : `bars ${first + 1}–${last + 1}`
  const who = chart.lick ? chart.lick.performer ?? chart.lick.source : chart.composer
  return who ? `${who} · ${bars}` : bars
}

/** Pick a random excerpt from some tunes, other than the one just asked; null when none fits. */
export function pickExcerpt(tunes: Tune[], guesses: Guesses, random: () => number = Math.random,
  avoid = '', attempts = 400): Excerpt | null {
  if (!tunes.length) return null
  for (let i = 0; i < attempts; i++) {
    const tune = tunes[Math.floor(random() * tunes.length)]
    const chart = tune.chart
    const first = Math.floor(random() * chart.bars.length)
    const excerpt = excerptAt(chart, first, guesses, random)
    if (!excerpt?.melody) continue
    const last = first + excerpt.bars.length - 1
    const id = `${tune.id}:${first}`
    if (id === avoid && tunes.length > 1) continue
    return {
      id,
      chart: excerpt,
      title: chart.title,
      detail: excerptDetail(chart, first, last),
      hidden: hiddenRun(excerpt.melody.notes.length, guesses, random),
    }
  }
  return null
}

/** The written form of a pitch: its spelling as placed, else the key's spelling. */
export const spellingOf = (guess: Guess, majorPc: number): Spelled => guess.spelled ?? spellPitch(guess.pitch, majorPc)

// ---- Answers ----

/** Judge the placed notes: right when the pitch (with its octave) is the hidden note's, in any spelling. */
export function judge(excerpt: Excerpt, guesses: Record<number, Guess>, transpose: number): Record<number, NoteResult> {
  const notes = excerpt.chart.melody?.notes ?? []
  return Object.fromEntries(excerpt.hidden.map((index) => {
    const guess = guesses[index]
    const result: NoteResult = !guess ? 'missing' : guess.pitch === notes[index].pitch + transpose ? 'correct' : 'wrong'
    return [index, result]
  }))
}

/** The excerpt with the placed notes instead of the hidden ones (unplaced ones are left out), to hear an answer. */
export function answerChart(excerpt: Excerpt, guesses: Record<number, Guess>, transpose: number): Chart {
  const melody = excerpt.chart.melody
  if (!melody) return excerpt.chart
  const hidden = new Set(excerpt.hidden)
  const notes = melody.notes.flatMap((note, index) => {
    if (!hidden.has(index)) return [note]
    const guess = guesses[index]
    return guess ? [{ ...note, pitch: guess.pitch - transpose }] : []
  })
  return { ...excerpt.chart, melody: { ...melody, notes } }
}

/** Move placed notes to another key: the pitches follow, the key spells them again. */
export function transposeGuesses(guesses: Record<number, Guess>, semitones: number): Record<number, Guess> {
  return Object.fromEntries(Object.entries(guesses).map(([index, guess]) => [index, { pitch: guess.pitch + semitones }]))
}

/**
 * The melody of a chart alone, after a count-in on the cross-stick, `repeats` times: what is
 * played for the dictation when the band is off.
 */
export function melodyAloneMidi(chart: Chart, style: StyleDefinition, transpose: number, repeats: number): { midi: Uint8Array; timeline: Timeline } {
  const timeline = buildTimeline(chart, transpose, repeats, { ending: false })
  const program = chart.melody?.program ?? 65
  const midi = writeMidi(BASE_BPM, [
    { name: 'Count-in', channel: CHANNELS.drums, program: style.drums.kit, pan: 64, reverb: 20,
      events: generateDrums([], style.drums, style.swing, timeline.clicks) },
    { name: 'Melody', channel: CHANNELS.melody, program, pan: 54, reverb: 45,
      events: melodyEvents(chart, timeline, CHANNELS.melody, style.swing, transpose) },
  ])
  return { midi, timeline }
}
