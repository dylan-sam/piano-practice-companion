// Roman numerals for chart display: a chord root written as a degree of the key, measured on the
// tonic's major scale whatever the mode, as the catalog's chord_notation.roman_chord does
// (G in F minor is II, Gb is bII). The degree follows the root's letter as the chart spells it.

import { accidentals, keyPrefersFlats, MAJOR_SCALE, NOTE_LETTERS, noteName, pitchClassOf, semitonesFrom, spellRoot } from './chords'

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

export interface RomanRoot {
  accidental: '' | 'b' | '#' | 'bb' | '##' // written before the numeral (bII, #IV)
  numeral: string
}

/** Write a root pitch class as a degree of a key: Db in C is bII, F# in G is VII. */
export function romanRoot(pc: number, keyPc: number): RomanRoot {
  const name = spellRoot(pc, keyPc)
  const tonic = noteName(keyPc, keyPrefersFlats(keyPc))
  const degree = (NOTE_LETTERS.indexOf(name[0]) - NOTE_LETTERS.indexOf(tonic[0]) + 7) % 7
  const expected = (keyPc + MAJOR_SCALE[degree]) % 12
  const accidental = accidentals(semitonesFrom(pc, expected)) as RomanRoot['accidental']
  return { accidental, numeral: NUMERALS[degree] }
}

/** The key in force from a bar comment written by the catalog ("Key: F:minor"), as a pitch class. */
export function keyChange(comment: string | undefined): number | null {
  const match = /^Key: ([A-G])([b#]?)/.exec(comment ?? '')
  if (!match) return null
  return pitchClassOf(match[1] + match[2])
}

/** A key in force: its tonic (a pitch class) and whether it is minor. */
export interface KeyCentre { tonic: number; minor: boolean }

/**
 * The key of each written bar of a chart: the chart's key, changed by a bar's key changes
 * (catalog charts: `keys`, or an older "Key: F:minor" comment) from where they happen. A bar
 * takes the key in force at its downbeat; an unknown mode counts as major.
 */
export function barKeyCentres(chart: {
  key: number; minor?: boolean
  bars: { keys?: { beats: number; key: number; minor?: boolean | null }[]; comment?: string }[]
}): KeyCentre[] {
  let centre: KeyCentre = { tonic: chart.key, minor: !!chart.minor }
  return chart.bars.map((bar) => {
    const fromComment = keyChange(bar.comment)
    const changes = bar.keys ?? (fromComment !== null ? [{ beats: 0, key: fromComment, minor: /:minor/i.test(bar.comment ?? '') }] : [])
    const atDownbeat = centre
    for (const change of changes) centre = { tonic: change.key, minor: !!change.minor }
    const onDownbeat = changes.filter((change) => change.beats < 1e-6).at(-1)
    return onDownbeat ? { tonic: onDownbeat.key, minor: !!onDownbeat.minor } : atDownbeat
  })
}

/** The key whose sharps or flats spell the notes of a key centre (a minor key: its relative major). */
export const spellingKey = (centre: KeyCentre): number => (centre.tonic + (centre.minor ? 3 : 0)) % 12

