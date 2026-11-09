// The OpenStand chart format (version 1).
//
// A chart is a list of bars laid out in rows of 16 cells, like a hand-written
// lead sheet. Each bar carries its chords with their length in beats, plus the
// markings a player reads: rehearsal marks, repeats, endings, D.C./D.S., coda.

import { isMelody, type Melody } from './melody'
import { isLickInfo, type LickInfo } from './licks'

export type TimeSignature = [beats: number, unit: number]

export interface BarChord {
  symbol: string | null // null = N.C. (no chord)
  beats: number
  hidden?: boolean // an exercise answer: drawn as a blank until revealed
}

// A change of key at a point of a bar: from `beats` beats into the bar (0 = the downbeat)
export interface KeyChange {
  beats: number
  key: number // pitch class of the new tonic
  minor?: boolean | null // null when the mode is unknown
}

export interface ChartBar {
  chords: BarChord[] // empty = keep playing the previous chord
  cells: number // width in the 16-cell row
  rowStart?: boolean
  section?: string // rehearsal mark: A, B, C, i (intro), v (verse)...
  time?: TimeSignature // time signature change at this bar
  partial?: boolean // a pickup or the bar completing one: `time` is its length, the meter goes on unchanged
  repeatStart?: boolean
  repeatEnd?: boolean
  repeatTimes?: number // total passes through a repeat (default 2)
  ending?: number // first/second/third ending bracket starts here
  barline?: 'double' | 'final' // closing barline
  segno?: boolean
  coda?: boolean
  fermata?: boolean
  directive?: string // D.C. al Coda, D.S. al Fine, Fine...
  comment?: string
  keys?: KeyChange[] // changes of key inside the bar (catalog charts), for Roman numerals
  end?: boolean // the player stops here (iReal "U")
  spacer?: boolean // blank room on the row (e.g. before a coda); not played
}

export interface Chart {
  format: 'openstand-chart'
  version: 1
  title: string
  composer?: string
  style: string // OpenStand style id
  sourceStyle?: string // style name in the source file, e.g. "Up Tempo Swing"
  key: number // pitch class of the written key
  minor?: boolean
  bpm: number
  time: TimeSignature
  bars: ChartBar[]
  melody?: Melody // a melody line over the chords: the chart is then drawn as a lead sheet
  lick?: LickInfo // a lick or an exercise from the lick database: what it is and where it comes from
}

export const ROW_CELLS = 16

/** Whether a chart carries a melody (it is then a lead sheet). */
export const hasMelody = (chart: Chart): boolean => !!chart.melody?.notes.length

/** The chart without its melody, for players that only accompany (the chord player). */
export function withoutMelody(chart: Chart): Chart {
  if (!chart.melody) return chart
  const { melody: _melody, ...chords } = chart
  return chords
}

/** Check a two-part time signature used by a chart or bar. */
function isTimeSignature(value: unknown): value is TimeSignature {
  return Array.isArray(value) && value.length === 2 &&
    value.every((part) => Number.isInteger(part) && part > 0)
}

/** Check a change of key inside a bar. */
function isKeyChange(value: unknown): value is KeyChange {
  const change = value as Record<string, unknown> | null
  return !!change && typeof change.beats === 'number' && change.beats >= 0 &&
    Number.isInteger(change.key) && Number(change.key) >= 0 && Number(change.key) < 12 &&
    (change.minor === undefined || change.minor === null || typeof change.minor === 'boolean')
}

/** Check the chart fields needed to display and play an imported chart safely. */
export function isChart(value: unknown): value is Chart {
  if (!value || typeof value !== 'object') return false
  const chart = value as Record<string, unknown>
  return chart.format === 'openstand-chart' && chart.version === 1 &&
    typeof chart.title === 'string' && typeof chart.style === 'string' &&
    (chart.composer === undefined || typeof chart.composer === 'string') &&
    (chart.sourceStyle === undefined || typeof chart.sourceStyle === 'string') &&
    (chart.minor === undefined || typeof chart.minor === 'boolean') &&
    Number.isInteger(chart.key) && Number(chart.key) >= 0 && Number(chart.key) < 12 &&
    typeof chart.bpm === 'number' && Number.isFinite(chart.bpm) && chart.bpm > 0 &&
    isTimeSignature(chart.time) &&
    (chart.melody === undefined || isMelody(chart.melody)) &&
    (chart.lick === undefined || isLickInfo(chart.lick)) &&
    Array.isArray(chart.bars) && chart.bars.length > 0 && chart.bars.every((item: unknown) => {
      if (!item || typeof item !== 'object') return false
      const bar = item as Record<string, unknown>
      return Number.isInteger(bar.cells) && Number(bar.cells) > 0 &&
        (bar.time === undefined || isTimeSignature(bar.time)) &&
        ['section', 'directive', 'comment'].every((field) => bar[field] === undefined || typeof bar[field] === 'string') &&
        ['rowStart', 'repeatStart', 'repeatEnd', 'segno', 'coda', 'fermata', 'end', 'spacer', 'partial']
          .every((field) => bar[field] === undefined || typeof bar[field] === 'boolean') &&
        ['repeatTimes', 'ending'].every((field) => bar[field] === undefined ||
          (Number.isInteger(bar[field]) && Number(bar[field]) > 0)) &&
        (bar.barline === undefined || bar.barline === 'double' || bar.barline === 'final') &&
        (bar.keys === undefined || (Array.isArray(bar.keys) && bar.keys.every(isKeyChange))) &&
        Array.isArray(bar.chords) && bar.chords.every((item: unknown) => {
          if (!item || typeof item !== 'object') return false
          const chord = item as Record<string, unknown>
          return (chord.symbol === null || typeof chord.symbol === 'string') &&
            typeof chord.beats === 'number' && Number.isFinite(chord.beats) && chord.beats > 0 &&
            (chord.hidden === undefined || typeof chord.hidden === 'boolean')
        })
    })
}

// Beats per bar counted in quarter notes
export function beatsPerBar([beats, unit]: TimeSignature): number {
  // Eighth-note meters are counted in quarter notes (6/8 -> 3 beats)
  return unit === 8 ? beats / 2 : unit === 2 ? beats * 2 : beats
}

/**
 * The meter in force at each written bar, with its length in quarter notes. A partial bar (a
 * pickup) has its own length and leaves the meter of the bars after it unchanged.
 */
export function barMeters(chart: Chart): { time: TimeSignature; beats: number; compound?: boolean }[] {
  let time: TimeSignature = chart.time
  return chart.bars.map((bar) => {
    if (bar.time && !bar.partial) time = bar.time
    const own = bar.partial && bar.time ? bar.time : time
    return { time: own, beats: beatsPerBar(own), compound: isCompound(time) || undefined }
  })
}

// 6/8, 9/8 and 12/8 are felt in dotted quarters; 3/8 is felt in one, like a fast 3/4
export function isCompound([beats, unit]: TimeSignature): boolean {
  return unit === 8 && beats % 3 === 0 && beats > 3
}

// Split a bar between its chords: 1 -> whole bar, 2 -> halves, 3 -> 2+1+1 in 4/4.
// Two chords in 3/4 are 2+1; in 6/8 they take a dotted quarter each.
export function evenSplit(count: number, time: TimeSignature): number[] {
  const barBeats = beatsPerBar(time)
  if (count <= 1) return [barBeats]
  if (count === 3 && barBeats === 4) return [2, 1, 1]
  if (count === 2 && barBeats === 3 && !isCompound(time)) return [2, 1]
  return Array.from({ length: count }, () => barBeats / count)
}

// A tuplet of a bar: chords first..last (indexes) share their beats as `count` equal notes, e.g.
// three chords of 1 1/3 beats in 4/4 are a quarter-note triplet, marked "3" over them
export type Tuplet = { first: number; last: number; count: number }

// Lengths that plain notes can write: whole, half and quarter beats (dotted values included)
const isPlain = (beats: number) => Math.abs(beats * 4 - Math.round(beats * 4)) < 1e-4

// Greatest common divisor
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

const MAX_TUPLET = 7 // the most notes a printed tuplet groups

// Smallest denominator (up to 64) writing a length as a fraction of a beat
function denominator(beats: number): number {
  for (let q = 1; q <= 64; q++) if (Math.abs(beats * q - Math.round(beats * q)) < 1e-4) return q
  return 1
}

/**
 * Tuplets of a bar from its chord lengths in beats. Consecutive chords with lengths plain notes
 * cannot write (1 1/3, 2/3, 0.8) are grouped until they fill a plain length together; the group
 * is written as `count` equal notes of the largest length that divides all of them: 3 x 4/3 in
 * 4/4 is "3", 4/3 + 8/3 is "3" too, five chords of 0.8 are "5". A lone chord is not marked, nor a
 * group of more than MAX_TUPLET notes or more than two notes a beat (a crowded bar).
 */
export function tuplets(beats: number[]): Tuplet[] {
  const out: Tuplet[] = []
  let first = -1
  let total = 0
  beats.forEach((length, i) => {
    if (first < 0) {
      if (isPlain(length)) return
      first = i
      total = 0
    }
    total += length
    if (!isPlain(total) && i < beats.length - 1) return
    const group = beats.slice(first, i + 1)
    const common = group.map(denominator).reduce((a, b) => (a * b) / gcd(a, b), 1)
    const units = group.map((l) => Math.round(l * common))
    const count = units.reduce((a, b) => a + b, 0) / units.reduce(gcd)
    // Marked like printed tuplets: 3 to 7 equal notes, at most two to a beat. More chords than that
    // in a bar (an iReal chart crowding a melody into one bar) are an even share, not a rhythm
    const span = group.reduce((a, b) => a + b, 0)
    if (group.length > 1 && count >= 3 && count <= MAX_TUPLET && count <= 2 * span + 1e-6) out.push({ first, last: i, count })
    first = -1
  })
  return out
}

// Build a plain chart from lists of chords per bar, four bars to a row
export function chartFromMeasures(
  meta: Omit<Chart, 'format' | 'version' | 'bars' | 'time'> & { time?: TimeSignature },
  measures: string[][],
): Chart {
  const time = meta.time ?? [4, 4]
  return {
    format: 'openstand-chart',
    version: 1,
    ...meta,
    time,
    bars: measures.map((symbols, i) => {
      const split = evenSplit(symbols.length, time)
      return {
        chords: symbols.map((symbol, j) => ({ symbol, beats: split[j] })),
        cells: 4,
        rowStart: i % 4 === 0 || undefined,
        barline: i === measures.length - 1 ? 'final' : undefined,
      }
    }),
  }
}

// The order bars are played in, following repeats, endings, D.C./D.S., coda and fine
export function playbackOrder(chart: Chart): number[] {
  const { bars } = chart
  const order: number[] = []
  const segno = bars.findIndex((b) => b.segno)
  const codas = bars.flatMap((b, i) => (b.coda ? [i] : []))
  const lastEnding = Math.max(1, ...bars.map((b) => b.ending ?? 0))

  let jump: { to: 'coda' | 'fine' | 'end'; ending?: number } | null = null
  let repeatStart = 0
  let pass = 1
  let i = 0

  while (i < bars.length && order.length < 4000) {
    const bar = bars[i]
    if (bar.spacer) {
      i++
      continue
    }

    if (bar.repeatStart && repeatStart !== i) {
      repeatStart = i
      pass = 1
    }

    // Endings: play only the bracket that matches this pass
    if (bar.ending) {
      const wanted = jump ? (jump.ending ?? lastEnding) : pass
      if (bar.ending !== wanted) {
        const next = bars.findIndex((b, j) => j > i && b.ending === wanted)
        if (next !== -1) {
          i = next
          continue
        }
        const close = bars.findIndex((b, j) => j >= i && b.repeatEnd)
        i = close === -1 ? i + 1 : close + 1
        continue
      }
    }

    order.push(i)
    if (bar.end && jump) break
    // After any jump, Fine ends the tune
    if (jump && bar.directive?.toLowerCase() === 'fine') break

    // After a D.C./D.S. al Coda, the first coda sign sends the band to the second one
    if (jump?.to === 'coda' && bar.coda && codas.length > 1 && i === codas[0]) {
      i = codas[1]
      jump = { to: 'end' }
      continue
    }

    if (bar.repeatEnd && !jump && pass < (bar.repeatTimes ?? 2)) {
      pass++
      i = repeatStart
      continue
    }

    const directive = bar.directive?.toLowerCase() ?? ''
    if (!jump && /^d\.[cs]\./.test(directive)) {
      const ending = /(\d)(st|nd|rd|th) end/.exec(directive)
      jump = {
        to: directive.includes('coda') ? 'coda' : directive.includes('fine') ? 'fine' : 'end',
        ending: ending ? Number(ending[1]) : undefined,
      }
      i = directive.startsWith('d.s.') && segno !== -1 ? segno : 0
      repeatStart = i
      pass = 1
      continue
    }

    i++
  }

  return order
}
