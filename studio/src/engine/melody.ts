// Plays a chart's melody line with the band: each written bar's notes, wherever the timeline plays
// that bar (repeats, loops, choruses), in that chorus's key and with the style's swing. Swing moves
// the "and" of a beat written in eighths; a beat written in sixteenths stays straight, so its four
// sixteenths stay even in every style.
import { barMeters, type Chart } from '../music/chart'
import { notesByBar } from '../music/melody'
import { onSixteenth, place, toTicks, type NoteEvent } from './events'
import { chorusTranspose, type Timeline } from './timeline'

const VELOCITY = 92 // a little under the band's accents, so the melody sings without covering it
const LEGATO = 0.92 // share of its written length a note sounds

/** A written melody note at one point of the timeline (a note in a repeat sounds once per pass). */
export interface MelodyOccurrence {
  measure: number // written bar
  at: number // written start in the bar, in quarter notes
  start: number // in beats from the timeline's start, swung like the band
  end: number
  pitch: number // in the key of its chorus
  chorus: number
}

/**
 * The written beats (counted from the chart's first bar) that stay straight when the style
 * swings: those where a note starts or ends on a sixteenth (a quarter or three quarters of the
 * beat). Moving only the "and" of such a beat would make its sixteenths uneven.
 */
export function straightBeats(chart: Chart): Set<number> {
  const meters = barMeters(chart)
  const starts: number[] = []
  let time = 0
  for (const meter of meters) { starts.push(time); time += meter.beats }
  const straight = new Set<number>()
  for (const note of chart.melody?.notes ?? []) {
    for (const t of [starts[note.bar] + note.at, starts[note.bar] + note.at + note.beats]) {
      if (onSixteenth(t)) straight.add(Math.floor(t + 1e-6))
    }
  }
  return straight
}

/**
 * Every melody note as it sounds along a timeline, in time order. `transpose` and `keyStep` are
 * the ones the timeline was built with, so the melody stays in the band's key, chorus after
 * chorus. The band plays these notes, and the melody sightreader expects them.
 */
export function melodyOccurrences(chart: Chart, timeline: Timeline, swing: number,
  transpose = 0, keyStep = 0): MelodyOccurrence[] {
  if (!chart.melody?.notes.length) return []
  const meters = barMeters(chart)
  const byBar = notesByBar(chart.melody)
  const straight = straightBeats(chart)
  const writtenStarts: number[] = []
  let written = 0
  for (const meter of meters) { writtenStarts.push(written); written += meter.beats }
  const out: MelodyOccurrence[] = []
  for (const bar of timeline.bars) {
    if (bar.measure < 0) continue
    const semitones = chorusTranspose(transpose, keyStep, bar.chorus)
    for (const note of byBar.get(bar.measure) ?? []) {
      if (note.at >= meters[bar.measure].beats) continue
      const pitch = note.pitch + semitones
      if (pitch < 0 || pitch > 127) continue
      // Swung like the band (eighth-note "ands" move later), except in beats written in sixteenths
      const swung = (t: number) => {
        const beat = Math.floor(writtenStarts[bar.measure] + t + 1e-6)
        return straight.has(beat) ? bar.start + t : place(bar.start + t, swing)
      }
      out.push({ measure: bar.measure, at: note.at, chorus: bar.chorus, pitch,
        start: swung(note.at), end: swung(note.at + note.beats) })
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

/** The melody's note events for a timeline (see melodyOccurrences). */
export function melodyEvents(chart: Chart, timeline: Timeline, channel: number, swing: number,
  transpose = 0, keyStep = 0): NoteEvent[] {
  return melodyOccurrences(chart, timeline, swing, transpose, keyStep).map((note) => ({
    tick: toTicks(note.start), channel, note: note.pitch, velocity: VELOCITY,
    duration: Math.max(1, toTicks((note.end - note.start) * LEGATO)),
  }))
}
