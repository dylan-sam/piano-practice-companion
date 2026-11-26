// The music of a lesson page's theory pictures (theory.ts) away from the screen: chord symbols
// read from the cards' text, a key chosen on the page (the pictures are written in C), the
// chord names of a staff turned into Roman numerals, and the ABC a progression is heard from.

import { closeVoicingTones, parseChord, transposeChord, type Chord } from '../music/chords'
import { romanRoot } from '../music/roman'

/** A chord as the cards write it (D−7, B♭7, Dø7, C♯°7) in the app's notation (D-7, Bb7, Dh7, C#o7). */
export const toSymbol = (text: string): string =>
  text.replace(/−/g, '-').replace(/♭/g, 'b').replace(/♯/g, '#').replace(/ø/g, 'h').replace(/°/g, 'o')

/** The chord of a card's chord text in the key chosen (written in C, moved by `transpose`), or null for a label ("→"). */
export function cardChord(text: string, transpose: number): Chord | null {
  const chord = parseChord(toSymbol(text))
  return chord ? transposeChord(chord, transpose) : null
}

/** The shift from C to a key, between a fourth down and a tritone up, so pictures stay near the staff. */
export const transposeFor = (keyPc: number): number => (((keyPc % 12) + 12 + 5) % 12) - 5

/** A chord symbol (in C) written as a Roman numeral of C, as the charts show them: D-7 is II-7, Db7 is bII7. */
export function romanText(symbol: string): string {
  const chord = parseChord(symbol)
  if (!chord) return symbol
  const { accidental, numeral } = romanRoot(chord.root, 0)
  return `${accidental}${numeral}${chord.suffix}`
}

/** A staff's ABC with its chord names (in quotes) written as Roman numerals of C. */
export const romanAbc = (abc: string): string => abc.replace(/"([^"]+)"/g, (_, symbol: string) => `"${romanText(symbol)}"`)

/** A MIDI note written in ABC (60, middle C, is C; 72 is c; 48 is C,), with sharps. */
export function abcNote(midi: number): string {
  const names = ['C', '^C', 'D', '^D', 'E', 'F', '^F', 'G', '^G', 'A', '^A', 'B']
  const name = names[midi % 12]
  const octave = Math.floor(midi / 12) - 5 // 0: the octave of middle C
  const letter = octave >= 1 ? name.toLowerCase() : name
  return letter + (octave > 1 ? "'".repeat(octave - 1) : octave < 0 ? ','.repeat(-octave) : '')
}

/** The notes of a chord heard: its root low, its close voicing above middle C. */
export function chordNotes(chord: Chord): number[] {
  const bass = 36 + ((chord.bass ?? chord.root) % 12)
  const low = 55 // the voicing starts at G below middle C or above
  const root = low + ((chord.root - low % 12 + 12) % 12)
  return [bass, ...closeVoicingTones(chord).map((tone) => root + tone)]
}

/**
 * The ABC of a progression to hear, in the key chosen: each box a bar of 4 beats, a box of two
 * chords ("F7 D7") two beats each; labels ("→") are skipped.
 */
export function progressionAbc(boxes: readonly string[], transpose: number): string {
  const bars = boxes.flatMap((box) => {
    const chords = box.split(/\s+/).map((text) => cardChord(text, transpose)).filter((chord): chord is Chord => chord !== null)
    if (!chords.length) return []
    const beats = 4 / chords.length
    return [chords.map((chord) => `[${chordNotes(chord).map(abcNote).join('')}]${beats}`).join(' ')]
  })
  return `X:1\nL:1/4\nM:4/4\nK:C\n${bars.join(' | ')} |]`
}
