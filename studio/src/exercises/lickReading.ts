// Lick Sightreading: one lick played over every chord of a chart.
//
// A one-chord lick (from the lick database, docs/LICKS.md) is read as a shape: each note is a
// slot of its chord (root, 9th, 3rd, 11th, 5th, 13th, 7th) in some octave, plus a chromatic step
// when it lies between two slots. The shape is then written over each chord of the chart: every
// note takes the chord sounding at its start, so when the chords change in the middle of the
// lick, the rest of the lick follows the new chord at once. Chord tones stay chord tones,
// tensions stay tensions and chromatic approaches stay approaches, and the lick moves to the
// octave closest to the note before, so the line stays smooth.

import { barMeters, type Chart } from '../music/chart'
import { parseChord, type Chord } from '../music/chords'
import type { MelodyNote } from '../music/melody'

/**
 * The seven slots of a chord, in semitones above its root: root, 9th, 3rd, 11th, 5th, 13th and
 * 7th, as the chord's scale alters them. Slots 0, 2, 4 and 6 are always the chord tones, so a
 * lick's chord tones land on chord tones. A 6th chord keeps the major 7th in the 7th slot (its 6th
 * is the 13th slot), as in the bebop major scale.
 */
export function chordSlots(chord: Chord): number[] {
  const t = chord.tensions
  switch (chord.quality) {
    case 'maj7': case 'maj6': case 'maj': case 'power': case 'root':
      return [0, 2, 4, t.includes('#11') || t.includes('b5') ? 6 : 5, 7, 9, 11]
    case 'aug':
      return [0, 2, 4, 6, 8, 9, 11]
    case 'min7': case 'min':
      return [0, 2, 3, 5, 7, 9, 10]
    case 'min6': case 'minMaj7':
      return [0, 2, 3, 5, 7, 9, 11]
    case 'half':
      return [0, 1, 3, 5, 6, 8, 10]
    case 'dim7': case 'dim':
      return [0, 2, 3, 5, 6, 8, 9]
    case 'dimMaj7':
      return [0, 2, 3, 5, 6, 8, 11]
    case 'sus7': case 'sus': case 'sus2':
      return [0, 2, 5, 5, 7, 9, 10]
    case 'dom7':
      // Altered: b9, #5 and b13 (the same note); a b9 alone: Phrygian dominant; #11: Lydian dominant
      if (t.includes('alt') || t.includes('#5') || t.includes('#9')) return [0, 1, 4, 6, 8, 8, 10]
      if (t.includes('b9')) return [0, 1, 4, 5, 7, 8, 10]
      if (t.includes('b5')) return [0, 2, 4, 5, 6, 9, 10]
      return [0, 2, 4, t.includes('#11') ? 6 : 5, 7, t.includes('b13') ? 8 : 9, 10]
  }
}

/** A note of a lick, relative to its chord. */
export interface ShapeNote {
  start: number // quarter notes from the start of the lick
  beats: number
  degree: number // slot + 7 x octave, counted from the chord's root nearest middle C
  alter: number // chromatic step from that slot (-1 below it, +1 above it)
}

/** A one-chord lick as a shape that can be written over any chord. */
export interface LickShape {
  title: string
  length: number // in quarter notes: the lick's bars
  notes: ShapeNote[]
}

const BAR = 4

/** The chord of a one-chord lick, or null when the chart has none or more than one. */
export function lickChord(chart: Chart): Chord | null {
  const symbols = new Set(chart.bars.flatMap((bar) => bar.chords.map((c) => c.symbol)).filter((s): s is string => !!s))
  return symbols.size === 1 ? parseChord([...symbols][0]) : null
}

/** Whether a chart is a lick played over one chord, which Lick Sightreading can use. */
export function isOneChordLick(chart: Chart): boolean {
  return chart.lick?.kind === 'lick' && !!chart.melody?.notes.length && lickChord(chart) !== null &&
    chart.bars.every((_, i) => barMeters(chart)[i].beats === BAR)
}

/** The pitch of a pitch class nearest to middle C (F#3 to F4). */
const nearMiddleC = (pc: number) => 60 + ((((pc % 12) + 12 + 6) % 12) - 6)

/** Read a one-chord lick as a shape; null when it is not one. */
export function lickShape(chart: Chart): LickShape | null {
  const chord = lickChord(chart)
  if (!chord || !chart.melody?.notes.length) return null
  const slots = chordSlots(chord)
  const root = nearMiddleC(chord.root)
  const notes = chart.melody.notes.map((note): ShapeNote => {
    const interval = note.pitch - root
    const octave = Math.floor(interval / 12)
    const within = interval - 12 * octave
    // The nearest slot (the octave's root counts as slot 7); on a tie, the slot above:
    // a chromatic note is most often an approach from below
    let best = 0
    for (let slot = 1; slot <= 7; slot++) {
      const value = slot === 7 ? 12 : slots[slot]
      const distance = Math.abs(within - value)
      const bestValue = best === 7 ? 12 : slots[best]
      if (distance < Math.abs(within - bestValue) || (distance === Math.abs(within - bestValue) && value > bestValue)) best = slot
    }
    const value = best === 7 ? 12 : slots[best]
    return { start: note.bar * BAR + note.at, beats: note.beats, degree: octave * 7 + best, alter: within - value }
  })
  return { title: chart.title, length: chart.bars.length * BAR, notes }
}

/** The pitch of a shape note over a chord whose root is written at `root`. */
export function shapePitch(note: ShapeNote, chord: Chord, root: number): number {
  const slots = chordSlots(chord)
  const octave = Math.floor(note.degree / 7)
  return root + 12 * octave + slots[note.degree - 7 * octave] + note.alter
}

/** How the lick is laid over a chart. */
export interface LickLayout {
  rest: boolean // a rest as long as the lick between two licks
}

const LOW = 48 // C3
const HIGH = 88 // E6

/** A chord of the chart, from its start to its end in quarter notes along the written bars. */
interface ChordSpan { start: number; end: number; symbol: string | null; chord: Chord | null }

/** The chords of a chart along its written bars (an empty bar or a chord written again goes on with the chord before). */
function chordSpans(chart: Chart, barStarts: number[], meters: { beats: number }[]): ChordSpan[] {
  const spans: ChordSpan[] = []
  chart.bars.forEach((bar, i) => {
    if (!bar.chords.length) {
      if (spans.length) spans[spans.length - 1].end = barStarts[i] + meters[i].beats
      return
    }
    let at = barStarts[i]
    for (const { symbol, beats } of bar.chords) {
      // A chord written again is no change: its span goes on
      const last = spans[spans.length - 1]
      if (last && last.symbol === symbol && Math.abs(last.end - at) < 1e-6) last.end = at + beats
      else spans.push({ start: at, end: at + beats, symbol, chord: symbol ? parseChord(symbol) : null })
      at += beats
    }
  })
  return spans
}

/**
 * The chart with the lick written over it as its melody: the lick starts on the first full bar
 * and again on the next bar line after it ends (after a rest as long as the lick with
 * `layout.rest`). Each note takes the chord sounding at its start; when the chord changes, the
 * lick is written on the new chord in the octave closest to the note before. Notes over N.C. are
 * left out.
 */
export function withLick(chart: Chart, shape: LickShape, layout: LickLayout): Chart {
  const meters = barMeters(chart)
  const barStarts: number[] = []
  let time = 0
  for (const meter of meters) { barStarts.push(time); time += meter.beats }
  const total = time
  const spans = chordSpans(chart, barStarts, meters)
  const spanAt = (t: number) => spans.find((s) => s.start <= t + 1e-6 && t < s.end - 1e-6)
  const firstBar = Math.max(0, chart.bars.findIndex((bar) => !bar.partial))
  const notes: MelodyNote[] = []
  let start = barStarts[firstBar] ?? 0
  while (start < total - 1e-6) {
    let previous: number | null = null
    let current: ChordSpan | undefined
    let root = 0
    for (const note of shape.notes) {
      const t = start + note.start
      if (t >= total - 1e-6) break
      const span = spanAt(t)
      if (!span?.chord) continue
      if (span !== current) {
        // A new chord: its root in the octave that keeps the line closest to the note before
        current = span
        root = chooseRoot(note, span.chord, previous)
      }
      let pitch = shapePitch(note, span.chord, root)
      while (pitch < LOW) pitch += 12
      while (pitch > HIGH) pitch -= 12
      previous = pitch
      const bar = barStarts.findLastIndex((s) => s <= t + 1e-6)
      notes.push({ bar, at: round(t - barStarts[bar]), beats: round(Math.min(note.beats, total - t)), pitch })
    }
    // The next lick starts on the first bar line after this one (and its rest) ends
    const next = start + shape.length * (layout.rest ? 2 : 1)
    const bar = barStarts.findIndex((s) => s >= next - 1e-6)
    if (bar < 0) break
    start = barStarts[bar]
  }
  const { lick: _lick, ...rest } = chart
  return { ...rest, melody: { notes, source: `Lick: ${shape.title}` } }
}

/** The written pitch of a chord's root for a note: near middle C, or closest in line with the note before. */
function chooseRoot(note: ShapeNote, chord: Chord, previous: number | null): number {
  const home = nearMiddleC(chord.root)
  if (previous === null) return home
  const roots = [home - 12, home, home + 12]
  return roots.reduce((best, root) =>
    (Math.abs(shapePitch(note, chord, root) - previous) < Math.abs(shapePitch(note, chord, best) - previous) ? root : best), home)
}

const round = (value: number) => Math.round(value * 1e6) / 1e6
