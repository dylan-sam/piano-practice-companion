// Free Improvisation: how each note played sits on the chord sounding, after the note
// coloration of Impro-Visor (R. Keller, Harvey Mudd College): chord tones, colour tones, approach
// tones and outside tones. Nothing is right or wrong; the colours show where the notes land.

import { chordTones, type Chord } from '../music/chords'
import { chordSlots } from './lickReading'
import type { KeyCentre } from '../music/roman'

/** Where a note sits on a chord. */
export type ToneColor = 'chord' | 'color' | 'approach' | 'outside'

/** The four kinds of notes, in the order they are shown, with their names and what they are. */
export const TONE_COLORS: { id: ToneColor; label: string; help: string }[] = [
  { id: 'chord', label: 'chord tones', help: 'a note of the chord' },
  { id: 'color', label: 'colour tones', help: "a note of the chord's scale (9th, 13th, #11...) or of the key's major pentatonic, minor pentatonic or blues scale" },
  { id: 'approach', label: 'approach tones', help: 'a half step into the next note, a chord or colour tone' },
  { id: 'outside', label: 'outside', help: 'none of these (a short one turns blue when the next key resolves it a half step away; a long one on a strong beat stays red)' },
]

/** How many notes of each kind were played. */
export type ToneCounts = Record<ToneColor, number>
export const NO_TONES: ToneCounts = { chord: 0, color: 0, approach: 0, outside: 0 }

/**
 * The pitch classes of a chord: its tones (as written, 5th included) and its bass.
 *
 *   C7 -> C E G Bb
 */
export function chordPitchClasses(chord: Chord): Set<number> {
  const pcs = new Set(chordTones(chord).map((interval) => (chord.root + interval) % 12))
  pcs.add(chord.bass)
  return pcs
}

// The full diminished scale: whole step, half step (the lick slots keep seven notes)
const DIMINISHED = [0, 2, 3, 5, 6, 8, 9, 11]
// Scales of the key, whose notes sound well over most chords of a song (from its tonic): a major
// key takes all three (the minor ones for the blues sound), a minor key its minor pentatonic and
// blues scale
export const KEY_SCALES: { name: string; steps: number[]; major: boolean; minor: boolean }[] = [
  { name: 'major pentatonic', steps: [0, 2, 4, 7, 9], major: true, minor: false },
  { name: 'minor pentatonic', steps: [0, 3, 5, 7, 10], major: true, minor: true },
  { name: 'blues scale', steps: [0, 3, 5, 6, 7, 10], major: true, minor: true },
]

/** Whether a pitch class is in one of the scales of a key (KEY_SCALES). */
export function inKeyScales(pc: number, key: KeyCentre): boolean {
  return KEY_SCALES.some((scale) => (key.minor ? scale.minor : scale.major) && scale.steps.includes((pc - key.tonic + 12) % 12))
}

/**
 * The scale of a chord, in semitones above its root: the chord's own scale (chordSlots, the
 * scales of Lick Sightreading), with three corrections from the chord that follows:
 *
 *   a V going to a minor chord (G7 -> Cm)          Mixolydian b9 b13: G Ab B C D Eb F
 *   a V going to a major chord, even a triad (G -> C)   Mixolydian: G A B C D E F
 *   a diminished chord                              the full diminished scale (8 notes)
 *
 * A V is a major triad or a dominant 7th whose root moves up a 4th, with no alteration written
 * (resolvesAsV, shared with the licks of Lick Sightreading).
 */
export function chordScale(chord: Chord, next?: Chord | null): number[] {
  if (chord.quality === 'dim7' || chord.quality === 'dim') return DIMINISHED
  return [...new Set(chordSlots(chord, next))]
}

/** What a note is judged against besides its chord: the chord after it, and the key in force. */
export interface ToneContext { next?: Chord | null; key?: KeyCentre }

/**
 * Where a note sits on a chord, as it is played (an approach is only known from the next note,
 * resolvesApproach):
 *
 *   chord     a chord tone                                       C7: C E G Bb
 *   color     another note of the chord's scale (chordScale), except the 11th over a major 3rd
 *             (it clashes with it), or a note of the key's scales (KEY_SCALES: major pentatonic,
 *             minor pentatonic, blues scale; a minor key leaves out the major pentatonic)
 *                                                                C7 in F: D A, and F Ab Eb...
 *   outside   none of these, for now
 */
export function toneColor(pitch: number, chord: Chord, context: ToneContext = {}): ToneColor {
  const pc = ((pitch % 12) + 12) % 12
  const tones = chordPitchClasses(chord)
  if (tones.has(pc)) return 'chord'
  const interval = (pc - chord.root + 12) % 12
  const avoided = interval === 5 && tones.has((chord.root + 4) % 12)
  if (!avoided && chordScale(chord, context.next).includes(interval)) return 'color'
  if (context.key && inKeyScales(pc, context.key)) return 'color'
  return 'outside'
}

/**
 * Whether an outside note was an approach tone: the next key is a half step away and lands on a
 * chord or colour tone.
 *
 *   C7: F# then G -> F# was an approach      C7: F# then F -> still outside
 */
export function resolvesApproach(pitch: number, next: number, nextColor: ToneColor): boolean {
  return Math.abs(next - pitch) === 1 && (nextColor === 'chord' || nextColor === 'color')
}
