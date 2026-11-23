// The catalog's progressions (ii-V-I, I-IV-V...) found in any chart of the app: the shipped lead
// sheets, imported playlists, saved songs. The rules are those of find_progressions.py, which
// finds them in the ChoCo catalog: each chord is read as a degree of the key (measured on the
// tonic's major scale, as roman.ts) and a major or minor family; repeated chords count once; a
// chord with an altered 5th, a sus chord or N.C. breaks a progression; a 7 in the pattern
// (bII7) wants a dominant 7th.

import { chordTones, parseChord } from '../music/chords'
import type { Chart } from '../music/chart'
import { keyChange, romanRoot } from '../music/roman'

/** A chord as progressions see it: its degree in the key, major or minor, and whether it is a dominant 7th. */
export interface Signature { degree: string; family: 'maj' | 'min'; dominant: boolean }

/** A progression: its id (as in the catalog) and its chords. */
export interface ProgressionPattern { id: string; chords: Signature[] }

const NUMERAL = /^([♭b#]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(7?)$/

/**
 * A progression's chords read from its label: upper case is major, lower case minor, a 7 a
 * dominant 7th, ♭ a flat degree.
 *
 *   'ii – ♭II7 – I' -> ii (minor), bII (dominant 7th), I (major)
 */
export function patternFromLabel(id: string, label: string): ProgressionPattern | null {
  const chords: Signature[] = []
  for (const token of label.split(/\s*[–-]\s*/)) {
    const match = NUMERAL.exec(token.trim())
    if (!match) return null
    const [, accidental, numeral, seven] = match
    chords.push({
      degree: `${accidental ? (accidental === '#' ? '#' : 'b') : ''}${numeral.toUpperCase()}`,
      family: numeral === numeral.toUpperCase() ? 'maj' : 'min',
      dominant: !!seven,
    })
  }
  return chords.length ? { id, chords } : null
}

/**
 * A chord symbol as progressions see it in a key, or null when it matches no progression chord
 * (no single 3rd, an altered 5th, N.C.).
 *
 *   ('G7', C) -> V, major, dominant      ('Dm7', C) -> II, minor      ('Bø7', C) -> null
 */
export function chordSignature(symbol: string | null, keyPc: number): Signature | null {
  const chord = symbol ? parseChord(symbol) : null
  if (!chord) return null
  const tones = new Set(chordTones(chord))
  const major = tones.has(4)
  if (major === tones.has(3) || tones.has(6) || tones.has(8)) return null
  const { accidental, numeral } = romanRoot(chord.root, keyPc)
  return { degree: `${accidental}${numeral}`, family: major ? 'maj' : 'min', dominant: major && tones.has(10) }
}

/**
 * Adjacent chords of the same degree and family, as one run with how many chords it holds (null:
 * a chord that breaks progressions).
 */
interface Run { signature: Signature | null; dominant: boolean; count: number }

/** The runs of some chords in one key. */
function runsOf(signatures: (Signature | null)[]): Run[] {
  const runs: Run[] = []
  for (const signature of signatures) {
    const last = runs.at(-1)
    if (signature && last?.signature && last.signature.degree === signature.degree && last.signature.family === signature.family) {
      last.dominant ||= signature.dominant
      last.count++
    } else runs.push({ signature, dominant: !!signature?.dominant, count: 1 })
  }
  return runs
}

/**
 * Whether a pattern runs through some runs: each run of the pattern one run of the song, with at
 * least as many chords (I-V-IV-IV wants IV twice in a row); a 7 wants a dominant 7th.
 */
function containsPattern(runs: Run[], pattern: ProgressionPattern): boolean {
  const wanted = runsOf(pattern.chords)
  for (let start = 0; start + wanted.length <= runs.length; start++) {
    if (wanted.every((want, i) => {
      const run = runs[start + i]
      const chord = want.signature!
      return run.signature && run.signature.degree === chord.degree && run.signature.family === chord.family &&
        run.count >= want.count && (!chord.dominant || run.dominant)
    })) return true
  }
  return false
}

/**
 * The ids of the progressions a chart contains, its chords read in its key (and in the keys its
 * bars change to; a progression never runs across a change of key).
 */
export function chartProgressions(chart: Chart, patterns: readonly ProgressionPattern[]): Set<string> {
  const parts: (Signature | null)[][] = [[]]
  let key = chart.key
  for (const bar of chart.bars) {
    const changes = bar.keys ?? (keyChange(bar.comment) !== null ? [{ beats: 0, key: keyChange(bar.comment)! }] : [])
    let at = 0
    for (const { symbol, beats } of bar.chords) {
      for (const change of changes) {
        if (change.beats <= at + 1e-6 && change.key !== key) {
          key = change.key
          parts.push([])
        }
      }
      parts[parts.length - 1].push(chordSignature(symbol, key))
      at += beats
    }
  }
  const runs = parts.map(runsOf)
  return new Set(patterns.filter((pattern) => runs.some((part) => containsPattern(part, pattern))).map((pattern) => pattern.id))
}

/** Whether a song's progressions hold the chosen ones: all of them, or any of them. */
export function hasProgressions(found: ReadonlySet<string>, chosen: readonly string[], matchAll: boolean): boolean {
  return !chosen.length || (matchAll ? chosen.every((id) => found.has(id)) : chosen.some((id) => found.has(id)))
}
