// Plays a chart's melody line with the band: each written bar's notes, wherever the timeline plays
// that bar (repeats, loops, choruses), in that chorus's key and with the style's swing.
import { barMeters, type Chart } from '../music/chart'
import { notesByBar } from '../music/melody'
import { place, toTicks, type NoteEvent } from './events'
import { chorusTranspose, type Timeline } from './timeline'

const VELOCITY = 92 // a little under the band's accents, so the melody sings without covering it
const LEGATO = 0.92 // share of its written length a note sounds

/**
 * The melody's note events for a timeline. `transpose` and `keyStep` are the ones the timeline
 * was built with, so the melody stays in the band's key, chorus after chorus.
 */
export function melodyEvents(chart: Chart, timeline: Timeline, channel: number, swing: number,
  transpose = 0, keyStep = 0): NoteEvent[] {
  if (!chart.melody?.notes.length) return []
  const meters = barMeters(chart)
  const byBar = notesByBar(chart.melody)
  const events: NoteEvent[] = []
  for (const bar of timeline.bars) {
    if (bar.measure < 0) continue
    const semitones = chorusTranspose(transpose, keyStep, bar.chorus)
    for (const note of byBar.get(bar.measure) ?? []) {
      if (note.at >= meters[bar.measure].beats) continue
      // Swung like the band: eighth-note "ands" move later
      const start = place(bar.start + note.at, swing)
      const end = place(bar.start + note.at + note.beats, swing)
      const pitch = note.pitch + semitones
      if (pitch < 0 || pitch > 127) continue
      events.push({ tick: toTicks(start), channel, note: pitch, velocity: VELOCITY,
        duration: Math.max(1, toTicks((end - start) * LEGATO)) })
    }
  }
  return events
}
