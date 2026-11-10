// The staff: where a written note sits on it, and the note at a place on it. Positions count
// lines and spaces down from the top line of the staff (0 the top line, 8 the bottom line).

import { signature, type Clef, type Spelled } from './abc'

const LETTERS = 'CDEFGAB'
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11]

// The top line of each clef as a diatonic step (octave * 7 + letter): F5 in the treble clef, A3 in the bass clef
const TOP_LINE: Record<Clef, number> = { treble: 5 * 7 + 3, bass: 3 * 7 + 5 }

/** The diatonic step of a written note: octave * 7 + letter (C0 = 0, middle C = 28). */
export const diatonicStep = (note: Spelled): number => note.octave * 7 + LETTERS.indexOf(note.letter)

/** The sounding pitch (MIDI) of a written note. */
export const spelledPitch = (note: Spelled): number =>
  (note.octave + 1) * 12 + LETTER_PC[LETTERS.indexOf(note.letter)] + note.accidental

/** The major key whose signature a key uses (the relative major of a minor key). */
export const signatureKey = (keyPc: number, minor: boolean): number => (minor ? keyPc + 3 : keyPc) % 12

/**
 * The note at a place on the staff: `position` counts lines and spaces down from the top line
 * (0 the top line, 1 the space under it, 8 the bottom line, negative above the staff). It takes
 * the key signature's sharp or flat.
 */
export function noteAtPosition(position: number, clef: Clef, majorPc: number): Spelled {
  const step = TOP_LINE[clef] - position
  const letter = LETTERS[((step % 7) + 7) % 7]
  return { letter, accidental: signature(majorPc)[letter], octave: Math.floor(step / 7) }
}

/** Where a written note sits on the staff: lines and spaces down from the top line. */
export const positionOf = (note: Spelled, clef: Clef): number => TOP_LINE[clef] - diatonicStep(note)

/** Move a written note by staff steps (up > 0), taking the key signature's accidental on the new letter. */
export function moveBySteps(note: Spelled, steps: number, majorPc: number): Spelled {
  const step = diatonicStep(note) + steps
  const letter = LETTERS[((step % 7) + 7) % 7]
  return { letter, accidental: signature(majorPc)[letter], octave: Math.floor(step / 7) }
}

/** The note of a letter nearest to a pitch (for typed letters), with the key signature's accidental. */
export function nearestLetter(letter: string, near: number, majorPc: number): Spelled {
  const accidental = signature(majorPc)[letter]
  const options = [-1, 0, 1].map((shift) => {
    const octave = Math.floor((near - 12) / 12) + shift
    return { letter, accidental, octave }
  })
  return options.sort((a, b) => Math.abs(spelledPitch(a) - near) - Math.abs(spelledPitch(b) - near))[0]
}

/** A note's name for display, e.g. "E♭4". */
export const spelledName = (note: Spelled): string =>
  `${note.letter}${note.accidental > 0 ? '♯'.repeat(note.accidental) : '♭'.repeat(-note.accidental)}${note.octave}`
