// Build a chart with a melody from bars read out of a score file (MusicXML, ABC). Both readers
// fill the same ReadMeasure records; this module turns them into chart bars with chords, marks
// and melody notes, so the two formats are laid out, timed and checked the same way.

import type { BarChord, Chart, ChartBar, TimeSignature } from '../music/chart'
import type { MelodyNote } from '../music/melody'

const ROW = 4 // bars to a row of the chord chart
const EPS = 1e-6

/** One bar as read from a score. */
export interface ReadMeasure {
  meter: TimeSignature // the time signature in force
  content: number // quarter notes its notes and rests fill (0 when it holds nothing)
  notes: MelodyNote[] // `bar` is this measure's index, `at` from its start
  chords: { at: number; symbol: string | null }[]
  marks: Partial<ChartBar>
  joinNext?: boolean // its closing bar line is invisible: the next measure is the rest of this bar
}

/** Merge measures split by an invisible bar line (a line break inside a long bar). */
function joinSplitMeasures(measures: ReadMeasure[]): ReadMeasure[] {
  const out: ReadMeasure[] = []
  for (const m of measures) {
    const before = out[out.length - 1]
    if (before?.joinNext) {
      const shift = before.content
      before.notes.push(...m.notes.map((n) => ({ ...n, bar: out.length - 1, at: n.at + shift })))
      before.chords.push(...m.chords.map((c) => ({ ...c, at: c.at + shift })))
      before.content += m.content
      before.marks = { ...before.marks, ...m.marks }
      before.joinNext = m.joinNext
    } else {
      out.push({ ...m, notes: m.notes.map((n) => ({ ...n, bar: out.length })) })
    }
  }
  return out
}

/**
 * The meter of a score that writes none: the bar length most bars have (a pickup and a short
 * last bar aside), in quarter notes, or eighths for a half-beat length.
 */
export function inferredMeter(measures: ReadMeasure[]): TimeSignature {
  const lengths = new Map<number, number>()
  for (const m of measures) if (m.content > 1e-6) lengths.set(m.content, (lengths.get(m.content) ?? 0) + 1)
  const common = [...lengths].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 4
  return Number.isInteger(common) ? [common, 4] : [Math.round(common * 2), 8]
}

/** What the chart is called, in what key, style and tempo. */
export interface LeadSheetMeta {
  title: string
  composer?: string
  key: number
  minor?: boolean
  bpm: number
  style: string
  program?: number
  source: string
}

/** Length of a meter in quarter notes. */
export const meterLength = ([beats, unit]: TimeSignature) => (beats * 4) / unit

/**
 * The time signature of a bar `quarters` long, written in the meter's unit or a smaller one:
 * a one-eighth pickup in 6/8 is 1/8, a one-beat pickup in 4/4 is 1/4.
 */
export function partialTime(quarters: number, meter: TimeSignature): TimeSignature {
  let unit = meter[1]
  while (unit < 64 && Math.abs((quarters * unit) / 4 - Math.round((quarters * unit) / 4)) > EPS) unit *= 2
  return [Math.max(1, Math.round((quarters * unit) / 4)), unit]
}

/**
 * Chords written at one point (several symbols over a whole note, told apart only by where they
 * are drawn) share the time until the next chord evenly, on whole beats when they can: two
 * chords over a whole note in 4/4 fall on beats 1 and 3.
 */
function spreadStacked(chords: ReadMeasure['chords'], length: number): ReadMeasure['chords'] {
  const sorted = chords.map((c, i) => ({ ...c, i })).sort((a, b) => a.at - b.at || a.i - b.i)
  const out: ReadMeasure['chords'] = []
  for (let i = 0; i < sorted.length;) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1].at - sorted[i].at < EPS) j++
    const count = j - i + 1
    const span = (sorted[j + 1]?.at ?? length) - sorted[i].at
    const step = span / count >= 1 ? Math.floor(span / count) : span / count
    for (let k = 0; k < count; k++) out.push({ at: sorted[i].at + k * step, symbol: sorted[i + k].symbol })
    i = j + 1
  }
  return out
}

/** Round a position to a 1/960 of a quarter note, so files stay small and sums stay exact. */
const round = (x: number) => Math.round(x * 960) / 960

/**
 * Lay the read bars out as a chart. A bar whose notes fill more or less than its meter (a pickup,
 * the bar that completes one before a repeat) keeps its own length as a partial bar, so the band
 * plays exactly what is written; a bar with nothing in it gets the whole meter.
 */
export function leadSheetChart(meta: LeadSheetMeta, measures: ReadMeasure[]): Chart {
  measures = joinSplitMeasures(measures)
  if (!measures.length) throw new Error('The score has no bars')
  let playing: string | null = null // the chord sounding at the end of the bar before
  let written = measures[0].meter // the meter the chart's bars carry (partial bars leave it alone)
  const bars: ChartBar[] = measures.map((m, index) => {
    const full = meterLength(m.meter)
    const length = m.content > EPS ? m.content : full
    const partial = Math.abs(length - full) > EPS
    const changes = spreadStacked(m.chords.filter((c) => c.at < length - EPS), length)
    const chords: BarChord[] = []
    if (changes.length && changes[0].at > EPS) chords.push({ symbol: playing, beats: round(changes[0].at) })
    changes.forEach((change, i) => {
      const next = changes[i + 1]?.at ?? length
      chords.push({ symbol: change.symbol, beats: round(next - change.at) })
    })
    if (!chords.length && index === 0) chords.push({ symbol: null, beats: round(length) })
    if (chords.length) playing = chords[chords.length - 1].symbol
    const bar: ChartBar = { chords, cells: 4, ...(index % ROW === 0 ? { rowStart: true } : {}), ...m.marks }
    if (partial) {
      bar.time = partialTime(length, m.meter)
      bar.partial = true
    } else if (m.meter[0] !== written[0] || m.meter[1] !== written[1]) {
      // A change of meter, written on the first whole bar in it (after a pickup in the new meter)
      bar.time = m.meter
      written = m.meter
    }
    return bar
  })
  const last = bars[bars.length - 1]
  if (!last.barline && !last.repeatEnd) last.barline = 'final'
  const notes = measures.flatMap((m) => m.notes)
    .filter((n) => n.beats > EPS)
    .map((n) => ({ ...n, at: round(n.at), beats: round(n.beats) }))
  if (!notes.length) throw new Error('No melody notes found')
  return {
    format: 'openstand-chart',
    version: 1,
    title: meta.title,
    ...(meta.composer ? { composer: meta.composer } : {}),
    style: meta.style,
    key: meta.key,
    ...(meta.minor ? { minor: true } : {}),
    bpm: Math.round(Math.min(300, Math.max(40, meta.bpm))),
    time: measures[0].meter,
    bars,
    melody: { notes, ...(meta.program !== undefined ? { program: meta.program } : {}), source: meta.source },
  }
}
