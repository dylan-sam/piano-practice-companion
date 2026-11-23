// Improvise check mode: how each note played sits on the chord sounding, after the note
// coloration of Impro-Visor (R. Keller, Harvey Mudd College): chord tones, colour tones, approach
// tones and outside tones. Nothing is right or wrong; the colours show where the notes land.

import { chordTones, type Chord } from '../music/chords'
import { chordSlots } from './lickReading'

/** Where a note sits on a chord. */
export type ToneColor = 'chord' | 'color' | 'approach' | 'outside'

/** The four kinds of notes, in the order they are shown, with their names and what they are. */
export const TONE_COLORS: { id: ToneColor; label: string; help: string }[] = [
  { id: 'chord', label: 'chord tones', help: 'a note of the chord' },
  { id: 'color', label: 'colour tones', help: "a note of the chord's scale that sounds well over it: 9th, 13th, #11..." },
  { id: 'approach', label: 'approach tones', help: 'a half step into the next note, a chord or colour tone' },
  { id: 'outside', label: 'outside', help: 'none of these (it turns blue when the next key resolves it a half step away)' },
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

/**
 * Where a note sits on a chord, as it is played (an approach is only known from the next note,
 * resolvesApproach):
 *
 *   chord     a chord tone                                  C7: C E G Bb
 *   color     another note of the chord's scale (chordSlots,  C7: D A (F is left out:
 *             the scales Lick Sightreading uses), except the      the 11th clashes with
 *             11th over a major 3rd, which clashes with it        the 3rd E)
 *   outside   none of these, for now                        C7: Db Eb F Gb Ab B
 */
export function toneColor(pitch: number, chord: Chord): ToneColor {
  const pc = ((pitch % 12) + 12) % 12
  const tones = chordPitchClasses(chord)
  if (tones.has(pc)) return 'chord'
  const interval = (pc - chord.root + 12) % 12
  const avoided = interval === 5 && tones.has((chord.root + 4) % 12)
  return !avoided && chordSlots(chord).includes(interval) ? 'color' : 'outside'
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
