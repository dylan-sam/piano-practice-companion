import { describe, expect, test } from 'vitest'
import { scaleSuggestions } from '../src/exercises/scaleSuggestions'
import { spellChordTones } from '../src/music/scales'
import { parseChord } from '../src/music/chords'

const chord = (symbol: string) => parseChord(symbol)!
const C_MAJOR = { tonic: 0, minor: false }
/** The suggestions as "root name" (kind), in order. */
const names = (symbol: string, next: string | null, key = C_MAJOR) =>
  scaleSuggestions(chord(symbol), next ? chord(next) : null, key).map((s) => `${s.root} ${s.name} (${s.kind})`)

describe('the chord helper\'s scales', () => {
  test('the chord\'s scale where it is comes first: a V to minor, a V to major, a ii', () => {
    expect(names('G7', 'C-')[0]).toBe('7 Mixolydian b9 b13 (chord)')
    expect(names('G7', 'C^7')[0]).toBe('7 Mixolydian (chord)')
    expect(names('D-7', 'G7')[0]).toBe('2 Dorian (chord)')
  })

  test('then the chord\'s pentatonic and the key\'s scales, then the other good choices', () => {
    expect(names('D-7', 'G7')).toEqual([
      '2 Dorian (chord)', '2 minor pentatonic (chord)',
      '0 major pentatonic (key)', '0 minor pentatonic (key)', '0 blues scale (key)',
      '2 Aeolian (natural minor) (more)',
    ])
    const v = names('G7', 'C^7')
    expect(v.slice(0, 2)).toEqual(['7 Mixolydian (chord)', '7 major pentatonic (chord)'])
    expect(v).toContain('7 bebop dominant (more)')
    expect(v).toContain('7 altered (more)')
  })

  test('OpenStand\'s Phrygian only over the iii, Lydian dominant only over a dominant that does not resolve', () => {
    expect(names('D-7', 'G7').some((n) => n.includes('Phrygian'))).toBe(false)
    expect(names('E-7', 'A7').some((n) => n.includes('Phrygian'))).toBe(true)
    expect(names('F7', 'C^7')).toContain('5 Lydian dominant (more)')
    // The substitutes: a tritone substitution and a backdoor dominant take it first
    expect(names('Db7', 'C^7')[0]).toBe('1 Lydian dominant (chord)')
    expect(names('Bb7', 'C^7')[0]).toBe('10 Lydian dominant (chord)')
    expect(names('Bb7', 'C^7')).toContain('10 Mixolydian (more)')
    expect(names('D7', 'C#-7')[0]).toBe('2 Lydian dominant (chord)')
    expect(names('G7', 'C^7').some((n) => n.includes('Lydian dominant'))).toBe(false)
  })

  test('a scale already suggested is not suggested again under another name', () => {
    const cMajor = names('C^7', null)
    expect(cMajor.filter((n) => n.includes('major pentatonic'))).toEqual(['0 major pentatonic (chord)'])
  })

  test('no key: only the chord\'s scales', () => {
    expect(scaleSuggestions(chord('C7alt'), null, null).every((s) => s.kind !== 'key')).toBe(true)
  })
})

describe('chord tones spelled on their letters', () => {
  test('D7 in G, Bb7 in F, Cm7, F#m7b5 and Bo7', () => {
    expect(spellChordTones(chord('D7'), 7)).toEqual(['D', 'F#', 'A', 'C'])
    expect(spellChordTones(chord('Bb7'), 5)).toEqual(['Bb', 'D', 'F', 'Ab'])
    expect(spellChordTones(chord('C-7'), 0)).toEqual(['C', 'Eb', 'G', 'Bb'])
    expect(spellChordTones(chord('F#h7'), 7)).toEqual(['F#', 'A', 'C', 'E'])
    expect(spellChordTones(chord('Bo7'), 0)).toEqual(['B', 'D', 'F', 'Ab'])
  })
})
