import type { CSSProperties } from 'react'
import { spellRoot, type Chord } from '../music/chords'
import { romanRoot } from '../music/roman'

// SMuFL chord-symbol glyphs (rendered with Petaluma Text), so symbols look hand-copied
const GLYPH = {
  minor: '',
  major7: '',
  halfDiminished: '',
  diminished: '',
  augmented: '',
  flat: '',
  sharp: '',
}

// The glyph of an accidental
const accidental = (a: string) => (a === 'b' ? GLYPH.flat : GLYPH.sharp)

// Typeset quality markers the way they appear on hand-written charts; minor as a dash or as m
function typeset(suffix: string, minor: '-' | 'm' = '-'): { quality: string; extensions: string } {
  const s = suffix
    .replace(/^(min|mi|m)(?!aj)/, '-')
    .replace(/^maj7?/, '^7')
    .replace(/^dim/, 'o')
    .replace(/^aug/, '+')
  // -^ (minor with a major seventh, F-^7) carries two markers: minor and the major-seventh triangle
  const match = /^(-\^|[-^ho+])?(\d+)?(.*)$/.exec(s) ?? ['', '', '', s]
  const markers: Record<string, string> = {
    '-': GLYPH.minor,
    '^': GLYPH.major7,
    h: GLYPH.halfDiminished,
    o: GLYPH.diminished,
    '+': GLYPH.augmented,
    '-^': GLYPH.minor + GLYPH.major7,
  }
  if (minor === 'm') {
    markers['-'] = 'm'
    markers['-^'] = 'm' + GLYPH.major7
  }
  const marker = markers[match[1] ?? ''] ?? ''
  // A bare triangle already means major seventh (Ctriangle); minor with a major seventh keeps its 7 (F-triangle7), as charts write it
  const number = match[1] === '^' && match[2] === '7' ? '' : (match[2] ?? '')
  const extensions = (match[3] ?? '').replace(/[b#]/g, accidental)
  return { quality: marker + number, extensions }
}

export interface ChordNotation {
  minor?: '-' | 'm' // how minor is written (C- or Cm)
  romanKey?: number | null // pitch class of the key in force: write the root as a Roman numeral of it
}

/** Write a root (or bass) as the chart shows it: a note name, or a Roman numeral of the key in force. */
function rootText(pc: number, keyPc: number, romanKey: number | null | undefined): { letter: string; accidental: string } {
  if (romanKey === null || romanKey === undefined) {
    const name = spellRoot(pc, keyPc)
    return { letter: name[0], accidental: name.slice(1) }
  }
  const { numeral, accidental } = romanRoot(pc, romanKey)
  return { letter: numeral, accidental }
}

/** Draw one chord symbol with chart glyphs, as a note name or a Roman numeral (accidental first: bII). */
export function ChordSymbol({ chord, keyPc, className, style, notation }:
  { chord: Chord; keyPc: number; className?: string; style?: CSSProperties; notation?: ChordNotation }) {
  const roman = notation?.romanKey
  const root = rootText(chord.root, keyPc, roman)
  const bass = rootText(chord.bass, keyPc, roman)
  const { quality, extensions } = typeset(chord.suffix, notation?.minor)
  const isRoman = roman !== null && roman !== undefined
  const label = isRoman ? `${root.accidental}${root.letter}${chord.suffix}` : `${root.letter}${root.accidental}${chord.suffix}`
  return (
    <span className={[className ? `chord ${className}` : 'chord', isRoman && 'chord-roman'].filter(Boolean).join(' ')}
      style={style} aria-label={label}>
      {isRoman && root.accidental && <span className="chord-accidental chord-accidental-before">{[...root.accidental].map(accidental).join('')}</span>}
      <span>{root.letter}</span>
      {!isRoman && root.accidental && <span className="chord-accidental">{accidental(root.accidental)}</span>}
      {quality && <span className="chord-quality">{quality}</span>}
      {extensions && <span className="chord-ext">{extensions}</span>}
      {chord.bass !== chord.root && (
        <span className="chord-bass">/{isRoman ? [...bass.accidental].map(accidental).join('') + bass.letter : bass.letter + bass.accidental.replace(/[b#]/g, accidental)}</span>
      )}
    </span>
  )
}
