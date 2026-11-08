import { getStyle } from '../styles'
import type { StyleDefinition } from '../styles/types'
import { BASS_CHANNEL, generateBass } from './bass'
import type { NoteEvent } from './events'
import { generatePianoPattern, PIANO_PATTERNS } from './pianoPatterns'
import type { Timeline } from './timeline'

export const BASS_PATTERNS = [
  { id: 'walking_bass', name: 'Walking Bass' },
  { id: 'boogie_walking', name: 'Boogie Walking Bass' },
  { id: 'latin_bassline', name: 'Latin Bassline' },
  { id: 'ballad_bassline', name: 'Ballad Bassline' },
  { id: 'root_fifth_bassline', name: 'Root-Fifth Bassline' },
] as const

export type BassPatternId = (typeof BASS_PATTERNS)[number]['id']

/** Choose the named bass pattern that belongs to each accompaniment style. */
export function defaultBassPatternForStyle(styleId: string): BassPatternId {
  switch (styleId) {
    case 'blues': return 'boogie_walking'
    case 'bossa-nova':
    case 'latin': return 'latin_bassline'
    case 'ballad': return 'ballad_bassline'
    case 'straight pop/rock': return 'root_fifth_bassline'
    default: return 'walking_bass'
  }
}

/** Render a selected bassline with the timing feel of the current style. */
export function generateBassPattern(
  timeline: Timeline, style: StyleDefinition, patternId: BassPatternId,
): { events: NoteEvent[]; program: number } {
  if (patternId === 'walking_bass' || patternId === 'boogie_walking') {
    const pattern = PIANO_PATTERNS.find((candidate) => candidate.id === patternId)
    if (!pattern) throw new Error(`Bass pattern ${patternId} is missing`)
    return {
      events: generatePianoPattern(timeline, pattern, style.swing)
        .filter((event) => event.channel === BASS_CHANNEL),
      program: getStyle(patternId === 'walking_bass' ? 'swing' : 'blues').bass.program,
    }
  }

  const sourceStyle = patternId === 'latin_bassline' ? 'bossa-nova'
    : patternId === 'ballad_bassline' ? 'ballad' : 'straight pop/rock'
  const part = getStyle(sourceStyle).bass
  return { events: generateBass(timeline.slots, part, style.swing), program: part.program }
}
