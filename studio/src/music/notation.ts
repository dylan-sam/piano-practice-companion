// Typing chords: what a player types ("Dm7 G7", "Cmaj7", "Bo-slash", "F#dim7") becomes the
// chart's own notation (D-7 G7, C^7, Bh7, F#o7), which is also iReal Pro's notation.

import { beatsPerBar, evenSplit, type BarChord, type TimeSignature } from './chart'
import { parseChord } from './chords'

const ROOT_RE = /^([A-Ga-g])([b#♭♯]?)(.*)$/

// Quality spellings, tried in order at the start of the suffix
const QUALITY: [RegExp, string][] = [
  [/^(ø7?|m7b5|-7b5|min7b5|mi7b5)/, 'h7'],
  [/^(mmaj|m\(maj\)|-maj|-Δ|minmaj|-\^)/i, '-^'],
  [/^(maj|Maj|MA|M(?=7|9|13|$)|Δ|\^)/, '^'],
  [/^(min|mi|m|-)/, '-'],
  [/^(dim|°|o)/, 'o'],
  [/^(aug|\+)/, '+'],
]

// One chord in chart notation, or null if it can't be read
export function toChartSymbol(input: string): string | null {
  const [main, bassRaw, extra] = input.trim().replace('6/9', '69').split('/')
  if (extra !== undefined) return null
  const m = ROOT_RE.exec(main)
  if (!m) return null
  const root = m[1].toUpperCase() + m[2].replace('♭', 'b').replace('♯', '#')
  let rest = m[3].replace(/♭/g, 'b').replace(/♯/g, '#').replace(/[()]/g, '')
  let quality = ''
  for (const [re, out] of QUALITY) {
    const q = re.exec(rest)
    if (q) {
      quality = out
      rest = rest.slice(q[0].length)
      break
    }
  }
  // h7 already carries its seventh; a bare triangle means major seventh
  if (quality === 'h7') rest = rest.replace(/^7/, '')
  if ((quality === '^' || quality === '-^') && rest === '') rest = '7'
  rest = rest.replace(/sus4/g, 'sus').replace(/^7sus$/, '7sus')
  if (!/^(\d|b|#|sus|add|alt)*$/.test(rest)) return null

  let bass = ''
  if (bassRaw !== undefined) {
    const b = /^([A-Ga-g])([b#♭♯]?)$/.exec(bassRaw.trim())
    if (!b) return null
    bass = '/' + b[1].toUpperCase() + b[2].replace('♭', 'b').replace('♯', '#')
  }
  const symbol = root + quality + rest + bass
  return parseChord(symbol) ? symbol : null
}

export type BarInput = { ok: true; chords: BarChord[] } | { ok: false; error: string }

// A bar typed as text: "D-7 G7", "C^7", "NC", "Eb:3 D7:1" (beats after a colon), "" (hold the chord)
export function parseBarInput(text: string, time: TimeSignature): BarInput {
  const tokens = text.trim().split(/[\s,|]+/).filter(Boolean)
  if (tokens.length === 0) return { ok: true, chords: [] }
  const barBeats = beatsPerBar(time)
  const symbols: (string | null)[] = []
  const given: (number | null)[] = []
  for (const token of tokens) {
    const [name, beatsRaw] = token.split(':')
    let symbol: string | null
    if (/^(n\.?c\.?|nc)$/i.test(name)) symbol = null
    else {
      const parsed = toChartSymbol(name)
      if (!parsed) return { ok: false, error: `Can't read "${name}"` }
      symbol = parsed
    }
    const beats = beatsRaw === undefined ? null : Number(beatsRaw)
    if (beats !== null && !(beats > 0)) return { ok: false, error: `"${token}": beats must be a number` }
    symbols.push(symbol)
    given.push(beats)
  }
  if (symbols.length > barBeats * 2) return { ok: false, error: `Too many chords for one bar` }

  let beats: number[]
  if (given.every((b) => b === null)) beats = evenSplit(symbols.length, time)
  else {
    // Chords without a length share what is left of the bar
    const fixed = given.reduce<number>((sum, b) => sum + (b ?? 0), 0)
    const open = given.filter((b) => b === null).length
    const share = open ? (barBeats - fixed) / open : 0
    beats = given.map((b) => b ?? share)
    const total = beats.reduce((a, b) => a + b, 0)
    if (beats.some((b) => b <= 0) || Math.abs(total - barBeats) > 1e-6)
      return { ok: false, error: `Beats add up to ${total}, the bar has ${barBeats}` }
  }
  return { ok: true, chords: symbols.map((symbol, i) => ({ symbol, beats: beats[i] })) }
}

// The text shown for a bar; lengths are written only when they differ from an even split
export function barToInput(chords: BarChord[], time: TimeSignature): string {
  const even = evenSplit(chords.length, time)
  const uneven = chords.some((c, i) => Math.abs(c.beats - even[i]) > 1e-6)
  return chords.map((c) => (c.symbol ?? 'NC') + (uneven ? `:${c.beats}` : '')).join(' ')
}
