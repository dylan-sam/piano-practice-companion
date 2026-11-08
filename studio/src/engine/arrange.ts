import type { Chart } from '../music/chart'
import { compoundStyle } from '../styles/compound'
import type { StyleDefinition } from '../styles/types'
import { generateBass } from './bass'
import { generateBassPattern, type BassPatternId } from './bassPatterns'
import { generateComp, pedalChanges } from './comp'
import { generatePianoPattern, PIANO_PATTERNS, usesWalkingBass } from './pianoPatterns'
import type { PianoPattern } from './pianoPatterns'
import type { NoteEvent } from './events'
import { DRUM_CHANNEL, generateDrums } from './drums'
import { writeMidi } from './midiWriter'
import { buildTimeline, type PracticeOptions, type Timeline } from './timeline'
import { melodyEvents } from './melody'
import { melodyProgram } from '../music/melody'

// Channel layout, shared with the mixer (channel 2 is the live MIDI keyboard's piano, player.ts)
export const CHANNELS = { bass: 0, comp: 1, melody: 3, drums: DRUM_CHANNEL } as const
export type Part = keyof typeof CHANNELS

// Playback rate is set relative to this tempo, so tempo changes don't regenerate the MIDI
export const BASE_BPM = 120

export interface Arrangement {
  midi: Uint8Array
  timeline: Timeline
}

/** Use the chosen pattern as bass where appropriate and avoid doubling low figures. */
export function bassEventsForStyle(
  timeline: Timeline, style: StyleDefinition, compound: StyleDefinition,
  pattern: PianoPattern | undefined, patternEvents: NoteEvent[] | null,
): NoteEvent[] {
  if (pattern && usesWalkingBass(pattern)) {
    return patternEvents!.filter((event) => event.channel === CHANNELS.bass)
  }
  if (!pattern && style.id === 'swing') {
    // Swing chord comping walks with the scored walking bass figure.
    const walking = PIANO_PATTERNS.find((candidate) => candidate.id === 'walking_bass')
    if (!walking) throw new Error('Swing walking bass pattern is missing')
    return generatePianoPattern(timeline, walking, style.swing)
      .filter((event) => event.channel === CHANNELS.bass)
  }
  if (pattern && (style.id === 'blues' || style.id === 'straight pop/rock')) return []
  return generateBass(timeline.slots, style.bass, style.swing, compound.bass)
}

/** Render a chart into separate bass, comp and drum MIDI tracks, plus its melody when it has one. */
export function arrange(
  chart: Chart,
  style: StyleDefinition,
  transpose: number,
  choruses: number,
  practice: PracticeOptions = {},
  patternId: string | null = null,
  parts: { comp?: boolean; bassPatternId?: BassPatternId } = {},
): Arrangement {
  const timeline = buildTimeline(chart, transpose, choruses, practice)
  const { swing } = style
  // The same band in 6/8, for bars in a compound meter
  const compound = timeline.bars.some((b) => b.compound) ? compoundStyle(style) : style
  const selectedPattern = PIANO_PATTERNS.find((pattern) => pattern.id === patternId)
  const patternEvents = selectedPattern ? generatePianoPattern(timeline, selectedPattern, swing) : null
  const comp = parts.comp === false ? [] : selectedPattern
    ? patternEvents!.filter((event) => event.channel === CHANNELS.comp)
    : generateComp(timeline.slots, style.comp, swing, timeline.countIn, compound.comp)
  const selectedBass = parts.bassPatternId
    ? generateBassPattern(timeline, style, parts.bassPatternId) : null
  const bass = selectedBass?.events ?? bassEventsForStyle(timeline, style, compound, selectedPattern, patternEvents)
  const midi = writeMidi(BASE_BPM, [
    {
      name: 'Bass',
      channel: CHANNELS.bass,
      program: selectedBass?.program ?? style.bass.program,
      pan: 60,
      reverb: 20,
      events: bass,
    },
    {
      name: 'Comp',
      channel: CHANNELS.comp,
      program: style.comp.program,
      pan: 74,
      reverb: 40,
      events: comp,
      pedal: style.comp.pedal ? pedalChanges(comp, timeline.slots) : undefined,
    },
    {
      name: 'Drums',
      channel: CHANNELS.drums,
      program: style.drums.kit,
      pan: 64,
      reverb: 35,
      events: generateDrums(timeline.bars, style.drums, swing, timeline.clicks, compound.drums),
    },
    ...(chart.melody?.notes.length ? [{
      name: 'Melody',
      channel: CHANNELS.melody,
      program: melodyProgram(chart.melody),
      pan: 54,
      reverb: 45,
      events: melodyEvents(chart, timeline, CHANNELS.melody, swing, transpose, practice.keyStep ?? 0),
    }] : []),
  ])
  return { midi, timeline }
}
