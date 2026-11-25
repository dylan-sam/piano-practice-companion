// Scales by name and spelled: the names of the scales the app suggests (by their steps in
// semitones above the root) and their notes written out, for the chord helper and the lessons.

import { chordTones, NOTE_LETTERS, noteName, pitchClassOf, spellOnLetter, spellRoot, type Chord } from './chords'

// Names of the scales, by their steps
const SCALE_NAMES: Record<string, string> = {
  '0,2,4,5,7,9,11': 'major', '0,2,4,6,7,9,11': 'Lydian', '0,2,4,5,7,9,10': 'Mixolydian', '0,2,4,6,7,9,10': 'Lydian dominant',
  '0,1,4,5,7,8,10': 'Mixolydian b9 b13', '0,2,4,5,7,8,10': 'Mixolydian b13', '0,1,3,4,6,8,10': 'altered', '0,2,3,5,7,9,10': 'Dorian',
  '0,2,3,5,7,9,11': 'melodic minor', '0,2,3,5,6,8,10': 'Locrian natural 2', '0,2,3,5,6,8,9,11': 'diminished',
  '0,2,4,6,8,9,11': 'Lydian augmented', '0,2,5,7,9,10': 'Mixolydian (sus)', '0,2,4,5,6,9,10': 'Mixolydian b5',
  '0,2,4,7,9': 'major pentatonic', '0,3,5,7,10': 'minor pentatonic', '0,3,5,6,7,10': 'blues scale',
  '0,2,4,5,7,9,10,11': 'bebop dominant', '0,2,3,5,7,8,10': 'Aeolian (natural minor)', '0,1,3,5,7,8,10': 'Phrygian',
  '0,1,3,5,6,8,10': 'Locrian', '0,2,3,5,7,8,11': 'harmonic minor', '0,1,3,4,6,7,9,10': 'half-whole diminished',
  '0,2,4,6,8,10': 'whole tone',
}

/** The name of a scale from its steps ("scale" when it has none). */
export function scaleName(steps: readonly number[]): string {
  return SCALE_NAMES[[...steps].sort((a, b) => a - b).join(',')] ?? 'scale'
}

/** A note name with typeset flats and sharps. */
export const prettyNote = (name: string) => name.replace(/b/g, '♭').replace(/#/g, '♯')

/** The name of a scale's root in a key, spelled as the chart spells chord roots (F# in G, Bb7 in C). */
export function scaleRootName(rootPc: number, keyPc: number): string {
  return spellRoot(rootPc, keyPc)
}

// Minor-family chords: their 3rd is a minor 3rd (a #9 elsewhere), their b5 a 5th (a #11 elsewhere)
const MINOR_THIRD = new Set(['min', 'min7', 'min6', 'minMaj7', 'half', 'dim', 'dim7', 'dimMaj7'])
const FLAT_FIVE = new Set(['half', 'dim', 'dim7', 'dimMaj7'])

/** How many letters above the root a chord tone is written (3 semitones: Eb, the 3rd of Cm; D#, the #9 of C7). */
function letterSteps(interval: number, chord: Chord): number {
  switch (interval) {
    case 0: return 0
    case 1: case 2: return 1
    case 3: return MINOR_THIRD.has(chord.quality) ? 2 : 1
    case 4: return 2
    case 5: return 3
    case 6: return FLAT_FIVE.has(chord.quality) || chord.tensions.includes('b5') ? 4 : 3
    case 7: return 4
    case 8: return chord.quality === 'aug' || chord.tensions.includes('#5') ? 4 : 5
    case 9: return chord.quality === 'dim7' ? 6 : 5
    default: return 6
  }
}

/** The notes of a chord spelled on their letters from its root (D7 in G: D F# A C; Bb7: Bb D F Ab). */
export function spellChordTones(chord: Chord, keyPc: number): string[] {
  const root = spellRoot(chord.root, keyPc)
  return chordTones(chord).map((interval) =>
    spellOnLetter((chord.root + interval) % 12, NOTE_LETTERS[(NOTE_LETTERS.indexOf(root[0]) + letterSteps(interval % 12, chord)) % 7]))
}

/**
 * The notes of a scale spelled from its root: a seven-note scale takes each letter once (G Ab B C
 * D Eb F, not G G# B...); other scales follow the root's sharps or flats.
 */
export function spellScale(root: string, steps: readonly number[]): string[] {
  const sorted = [...steps].sort((a, b) => a - b)
  const rootPc = pitchClassOf(root)
  if (sorted.length !== 7) return sorted.map((step) => noteName(rootPc + step, root.includes('b')))
  return sorted.map((step, i) => spellOnLetter((rootPc + step) % 12, NOTE_LETTERS[(NOTE_LETTERS.indexOf(root[0]) + i) % 7]))
}

/**
 * A scale in words, with its notes.
 *
 *   (G, Mixolydian b9 b13, in C) -> 'G Mixolydian b9 b13: G A♭ B C D E♭ F'
 */
export function describeScale(chord: { root: number }, steps: readonly number[], keyPc: number): string {
  const root = scaleRootName(chord.root, keyPc)
  return `${prettyNote(root)} ${scaleName(steps)}: ${spellScale(root, steps).map(prettyNote).join(' ')}`
}
