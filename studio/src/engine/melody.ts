// Plays a chart's melody line with the band: each written bar's notes, wherever the timeline plays
// that bar (repeats, loops, choruses), in that chorus's key and with the style's swing.
import { barMeters, type Chart } from '../music/chart'
import { notesByBar } from '../music/melody'
import { place, toTicks, type NoteEvent } from './events'
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
 * Every melody note as it sounds along a timeline, in time order. `transpose` and `keyStep` are
 * the ones the timeline was built with, so the melody stays in the band's key, chorus after
 * chorus. The band plays these notes, and the melody sightreader expects them.
 */
export function melodyOccurrences(chart: Chart, timeline: Timeline, swing: number,
  transpose = 0, keyStep = 0): MelodyOccurrence[] {
  if (!chart.melody?.notes.length) return []
  const meters = barMeters(chart)
  const byBar = notesByBar(chart.melody)
  const out: MelodyOccurrence[] = []
  for (const bar of timeline.bars) {
    if (bar.measure < 0) continue
    const semitones = chorusTranspose(transpose, keyStep, bar.chorus)
    for (const note of byBar.get(bar.measure) ?? []) {
      if (note.at >= meters[bar.measure].beats) continue
      const pitch = note.pitch + semitones
      if (pitch < 0 || pitch > 127) continue
      // Swung like the band: eighth-note "ands" move later
      out.push({ measure: bar.measure, at: note.at, chorus: bar.chorus, pitch,
        start: place(bar.start + note.at, swing), end: place(bar.start + note.at + note.beats, swing) })
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
