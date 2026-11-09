// Licks and improvisation exercises: short melodies over one chord or a progression. They are kept
// as charts (a melody over chords), so the Lead Sheet Player and the sightreaders show, play
// and judge them like any lead sheet. A chart that is a lick or an exercise carries a `lick`
// record saying what it is and where it comes from. The database is built by
// scripts/lickCatalog.ts (pnpm run licks); docs/LICKS.md describes it.

import type { MelodyNote } from './melody'

/** What a lick chart is: a phrase taken from music, a pattern many players share, or a drill. */
export type LickKind = 'lick' | 'pattern' | 'exercise'

/** What a lick or exercise is, and where it comes from. */
export interface LickInfo {
  kind: LickKind
  category: string // the group it is listed in, e.g. "ii-V-I major"
  context: string // the harmony it is played over, e.g. "ii-V-I", "dom7", "cycle of fourths"
  source: string // the collection it comes from, e.g. "Weimar Jazz Database"
  license: string // the license of that source, e.g. "ODbL 1.0"
  performer?: string // who played it (transcribed solos)
  tune?: string // the tune it was played on
  bar?: number // its first bar in that tune or solo (1 = first written bar)
  count?: number // patterns: how many different players play it
  credit?: string // who to credit for the exercise or the idea behind it
  tags?: string[] // devices it uses: arpeggio, enclosure, chromatic, triplets...
  level?: number // 1 (first steps), 2, 3 (busiest rhythms)
}

const KINDS: LickKind[] = ['lick', 'pattern', 'exercise']
const TEXT_FIELDS = ['category', 'context', 'source', 'license'] as const
const OPTIONAL_TEXT = ['performer', 'tune', 'credit'] as const

/** Whether a value is a valid lick record (charts are checked when they are imported). */
export function isLickInfo(value: unknown): value is LickInfo {
  if (!value || typeof value !== 'object') return false
  const info = value as Record<string, unknown>
  const positive = (field: string) => info[field] === undefined || (Number.isInteger(info[field]) && Number(info[field]) > 0)
  return KINDS.includes(info.kind as LickKind) &&
    TEXT_FIELDS.every((field) => typeof info[field] === 'string') &&
    OPTIONAL_TEXT.every((field) => info[field] === undefined || typeof info[field] === 'string') &&
    positive('bar') && positive('count') && positive('level') &&
    (info.tags === undefined || (Array.isArray(info.tags) && info.tags.every((tag) => typeof tag === 'string')))
}

// The rhythmic grid of the database: no note value shorter than a sixteenth, and eighth-note
// triplets. Each beat is written either in sixteenths or in triplets, never both.
const EPSILON = 1e-6
export const SHORTEST_NOTE = 0.25 // a sixteenth, in quarter notes
export const SIXTEENTH_GRID = [0, 0.25, 0.5, 0.75]
export const TRIPLET_GRID = [0, 1 / 3, 2 / 3]

/** Whether a position inside a beat (0 <= fraction < 1) lies on a grid. */
export function onGrid(fraction: number, grid: number[]): boolean {
  return grid.some((point) => Math.abs(fraction - point) < EPSILON) || Math.abs(fraction - 1) < EPSILON
}

/**
 * Whether a melody keeps to the lick grid: every note starts and ends on a sixteenth or on an
 * eighth-note triplet, a beat never mixes the two, and no note is shorter than a sixteenth.
 * Bars are `barBeats` quarter notes long.
 */
export function onLickGrid(notes: MelodyNote[], barBeats = 4): boolean {
  const byBeat = new Map<number, number[]>()
  for (const note of notes) {
    if (note.beats < SHORTEST_NOTE - EPSILON) return false
    const start = note.bar * barBeats + note.at
    for (const time of [start, start + note.beats]) {
      const beat = Math.floor(time + EPSILON)
      const fraction = time - beat
      if (fraction > EPSILON) byBeat.set(beat, [...(byBeat.get(beat) ?? []), fraction])
    }
  }
  return [...byBeat.values()].every((fractions) =>
    fractions.every((f) => onGrid(f, SIXTEENTH_GRID)) || fractions.every((f) => onGrid(f, TRIPLET_GRID)))
}
