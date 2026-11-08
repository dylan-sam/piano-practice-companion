// Chord symbol parser. Supports common jazz chart notation (C-7, F7b9, Bb^7, Eh7, Do7, C7alt, G/B):
// iReal Pro's notation, which the catalog sends as written by chord_notation.py (see docs/CHORD_NOTATION.md).

export type Quality =
  | 'maj'
  | 'maj7'
  | 'maj6'
  | 'dom7'
  | 'sus7'
  | 'min'
  | 'min7'
  | 'min6'
  | 'minMaj7'
  | 'half'
  | 'dim7'
  | 'dimMaj7' // diminished triad with a major seventh (o^7)
  | 'dim' // diminished triad (o)
  | 'aug' // augmented triad (+); C7#5 is a dom7 with a #5 tension
  | 'sus' // sus4 triad (sus)
  | 'sus2' // sus2 triad (sus2, or iReal's 2)
  | 'power' // root and fifth (5)
  | 'root' // the root alone (1)

export interface Chord {
  root: number // pitch class 0-11 (C = 0)
  bass: number // bass note of a slash chord, otherwise the root
  quality: Quality
  tensions: string[] // 'b9', '#9', '#11', 'b13', 'alt', and 'b5', '#5', 'no3', 'no5' ...
  suffix: string // suffix as written (e.g. "-7", "7b9")
}

const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/**
 * Read a note name at the start of a text: C, Eb, F#, and with `accidentals` 2 the Bbb or C## of a
 * classical bass (A#/C##). A root has one accidental at most: in Ab#11 the # belongs to the 11.
 */
function parseNote(s: string, accidentals = 1): { pc: number; len: number } | null {
  const letter = LETTERS[s[0]?.toUpperCase() ?? '']
  if (letter === undefined) return null
  let pc = letter
  let len = 1
  while ((s[len] === 'b' || s[len] === '#') && len <= accidentals) {
    pc += s[len] === 'b' ? -1 : 1
    len += 1
  }
  return { pc: (pc + 24) % 12, len }
}

/** Read the voicing family of a chart suffix: o is a diminished triad, o7 a diminished seventh, + an augmented triad. */
function qualityOf(suffix: string): Quality {
  const s = suffix.replace('ø', 'h').replace('Δ', '^')
  const seventh = /(7|9|11|13)/.test(s)
  if (/^(h|m7b5|-7b5|min7b5)/.test(s)) return 'half'
  if (/^(o7|dim7)/.test(s)) return 'dim7'
  if (/^(o\^|dim\^|omaj|oadd7)/.test(s)) return 'dimMaj7'
  if (/^(o|dim)/.test(s)) return 'dim'
  if (/^(-|m(?!aj)|min)/.test(s)) {
    const rest = s.replace(/^(min|-|m)/, '')
    if (/^(\^|maj|M7)/.test(rest)) return 'minMaj7'
    if (/^6/.test(rest)) return 'min6'
    if (/^(7|9|11|13)/.test(rest)) return 'min7'
    return 'min'
  }
  if (/^(\^|maj|M7)/.test(s)) return 'maj7'
  if (/^(\+|aug)/.test(s)) return seventh ? 'dom7' : 'aug'
  if (/^6/.test(s)) return 'maj6'
  if (/^(7|9|11|13)/.test(s)) return /sus/.test(s) ? 'sus7' : 'dom7'
  if (/^(sus2|2(?!\d))/.test(s)) return 'sus2'
  if (/^sus/.test(s)) return seventh ? 'sus7' : 'sus'
  if (/^5/.test(s)) return 'power'
  if (/^1(?![13])/.test(s)) return 'root'
  if (/^alt/.test(s)) return 'dom7' // a bare alt is an altered dominant (C7alt)
  return 'maj'
}

// Read a chord symbol, or null when it is not one
export function parseChord(symbol: string): Chord | null {
  const [main, slash] = symbol.trim().split('/')
  const root = parseNote(main)
  if (!root) return null
  const suffix = main.slice(root.len)
  const tensions: string[] = suffix.match(/[b#](5|9|11|13)|alt|no[35]/g) ?? []
  // An augmented chord with a seventh (+7) is voiced as a dominant with a raised fifth
  if (/^(\+|aug)/.test(suffix) && /(7|9|11|13)/.test(suffix) && !tensions.includes('#5')) tensions.push('#5')
  const bass = slash ? parseNote(slash, 2)?.pc ?? root.pc : root.pc
  return { root: root.pc, bass, quality: qualityOf(suffix), tensions, suffix }
}

// Whether to spell with flats or sharps depends on the target key
const FLAT_KEYS = new Set([5, 10, 3, 8, 1, 6]) // F Bb Eb Ab Db Gb

// Name of a pitch class, with flats or sharps
export function noteName(pc: number, preferFlats: boolean): string {
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12]
}

// Whether a key is written with flats
export function keyPrefersFlats(keyPc: number): boolean {
  return FLAT_KEYS.has(((keyPc % 12) + 12) % 12)
}

/** Name a key or note as its key prefers, with typeset flat and sharp signs (B-flat, F-sharp). */
export function prettyNoteName(pc: number): string {
  return noteName(pc, keyPrefersFlats(pc)).replace('b', '\u266d').replace('#', '\u266f')
}

/** Semitones from one key to another, kept within -5..+6 so the band's register doesn't drift. */
export function offsetToKey(from: number, to: number): number {
  return ((to - from + 17) % 12) - 5
}

// Transpose a chord by semitones
export function transposeChord(chord: Chord, semitones: number): Chord {
  return {
    ...chord,
    root: (chord.root + semitones + 120) % 12,
    bass: (chord.bass + semitones + 120) % 12,
  }
}

// The chord's symbol, with flats or sharps
export function chordLabel(chord: Chord, preferFlats: boolean): string {
  const base = noteName(chord.root, preferFlats) + chord.suffix
  return chord.bass === chord.root ? base : `${base}/${noteName(chord.bass, preferFlats)}`
}

// Chord tones for the bass (semitones above the root): root, third, fifth, seventh. A written
// altered or missing fifth or third (C-#5, F^7b5, C5b5, C7no5, C7no3) replaces the family's;
// a missing tone becomes the root, so the tones keep their places (third second, fifth third).
export function chordTones(chord: Chord): number[] {
  const t = chord.tensions
  const alteredFifth = chord.quality !== 'dom7' && chord.quality !== 'aug' && (t.includes('#5') || t.includes('b5'))
  // A seventh written on a chord family without one (C5b7, Csusadd7) takes the free last place
  const added = /add7|maj7|\^7/.test(chord.suffix) ? 11 : /b7/.test(chord.suffix) ? 10 : null
  const free = ['sus', 'power'].includes(chord.quality) && added !== null
  return familyTones(chord).map((interval, index) => {
    if (free && index === 3) return added
    if (interval === 5 && chord.quality === 'sus7' && /sus2/.test(chord.suffix)) return 2 // C7sus2
    if (interval === 10 && chord.quality === 'sus7' && /add7/.test(chord.suffix)) return 11 // Csusadd7: natural seventh
    if (interval === 7 && alteredFifth) return t.includes('#5') ? 8 : 6
    if (interval === 7 && index > 0 && t.includes('no5')) return 0
    if ((interval === 3 || interval === 4) && index === 1 && t.includes('no3')) return 0
    return interval
  })
}

// The tones of a chord family, before the written alterations (chordTones)
function familyTones(chord: Chord): number[] {
  switch (chord.quality) {
    case 'maj7':
      return [0, 4, 7, 11]
    case 'maj':
    case 'maj6':
      return [0, 4, 7, 9]
    case 'dom7':
      if (chord.tensions.includes('alt') || chord.tensions.includes('#5')) return [0, 4, 8, 10]
      if (chord.tensions.includes('b5')) return [0, 4, 6, 10]
      return [0, 4, 7, 10]
    case 'sus7':
      return [0, 5, 7, 10]
    case 'min':
    case 'min7':
      return [0, 3, 7, 10]
    case 'min6':
      return [0, 3, 7, 9]
    case 'minMaj7':
      return [0, 3, 7, 11]
    case 'half':
      return [0, 3, 6, 10]
    case 'dim7':
      return [0, 3, 6, 9]
    case 'dimMaj7':
      return [0, 3, 6, 11]
    case 'dim':
      return [0, 3, 6, 12]
    case 'aug':
      return [0, 4, 8, 12]
    case 'sus':
      return [0, 5, 7, 12]
    case 'sus2':
      return [0, 2, 7, 12]
    case 'power':
    case 'root':
      return [0, 7, 12, 7]
  }
}

// Rootless A/B voicings for piano, as intervals above the root; an altered fifth written on a
// chord that is not a dominant (C-#5, F^7b5) replaces the voicing's fifth, as in chordTones
export function rootlessVoicings(chord: Chord): [number[], number[]] {
  const t = chord.tensions
  const alteredFifth = chord.quality !== 'dom7' && chord.quality !== 'aug' && (t.includes('#5') || t.includes('b5'))
  const [a, b] = familyVoicings(chord)
  if (!alteredFifth) return [a, b]
  // Raise or lower the fifth when the symbol alters it
  const fifth = (interval: number) => (interval % 12 === 7 ? interval + (t.includes('#5') ? 1 : -1) : interval)
  return [a.map(fifth), b.map(fifth)]
}

// The rootless voicings of a chord family (rootlessVoicings)
function familyVoicings(chord: Chord): [number[], number[]] {
  const t = chord.tensions
  switch (chord.quality) {
    case 'maj7':
      return [
        [4, 7, 11, 14],
        [11, 14, 16, 19],
      ]
    case 'maj':
    case 'maj6':
      return [
        [4, 7, 9, 14],
        [9, 14, 16, 19],
      ]
    case 'dom7': {
      if (t.includes('alt'))
        return [
          [4, 8, 10, 15],
          [10, 13, 16, 20],
        ]
      const ninth = t.includes('b9') ? 13 : t.includes('#9') ? 15 : 14
      const top = t.includes('b13') || t.includes('#5') ? 8 : t.includes('#11') ? 6 : 9
      return [
        [4, top, 10, ninth],
        [10, ninth, 16, top + 12],
      ]
    }
    case 'sus7':
      return [
        [5, 7, 10, 14],
        [10, 14, 17, 19],
      ]
    case 'min':
    case 'min7':
      return [
        [3, 7, 10, 14],
        [10, 14, 15, 19],
      ]
    case 'min6':
      return [
        [3, 7, 9, 14],
        [9, 14, 15, 19],
      ]
    case 'minMaj7':
      return [
        [3, 7, 11, 14],
        [11, 14, 15, 19],
      ]
    case 'half':
      return [
        [3, 6, 10, 12],
        [10, 12, 15, 18],
      ]
    case 'dim7':
      return [
        [3, 6, 9, 12],
        [9, 12, 15, 18],
      ]
    case 'dimMaj7':
      return [
        [3, 6, 11, 12],
        [11, 12, 15, 18],
      ]
    case 'dim':
      return [
        [3, 6, 12, 15],
        [6, 12, 15, 18],
      ]
    case 'aug':
      return [
        [4, 8, 12, 16],
        [8, 12, 16, 20],
      ]
    case 'sus':
      return [
        [5, 7, 12, 17],
        [7, 12, 17, 19],
      ]
    case 'sus2':
      return [
        [2, 7, 12, 14],
        [7, 12, 14, 19],
      ]
    case 'power':
      return [
        [7, 12, 19],
        [12, 19, 24],
      ]
    case 'root':
      return [[12, 24], [24]]
  }
}

// Close-position chord tones including the root, for pop/rock (triads or sevenths)
export function closeVoicingTones(chord: Chord): number[] {
  if (chord.quality === 'root') return [0]
  const tones = chordTones(chord)
  if (chord.quality === 'power') return tones[3] === 10 || tones[3] === 11 ? [tones[0], tones[1], tones[3]] : [tones[0], tones[1]]
  if (chord.quality === 'sus' && (tones[3] === 10 || tones[3] === 11)) return tones
  // Triads keep their three tones, with the written alterations (C-#5 is C Eb G#)
  if (['maj', 'min', 'dim', 'aug', 'sus', 'sus2'].includes(chord.quality)) return tones.slice(0, 3)
  return tones
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]

// Spells a chord root in the context of a key: notes of the key's major scale follow the
// key signature, chromatic notes default to flats (Bb7 in C, not A#7)
export function spellRoot(pc: number, keyPc: number): string {
  if (keyPrefersFlats(keyPc)) return noteName(pc, true)
  const inScale = MAJOR_SCALE.some((step) => (keyPc + step) % 12 === ((pc % 12) + 12) % 12)
  return noteName(pc, !inScale)
}
