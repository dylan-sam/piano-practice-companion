import { describe, expect, test } from 'vitest'
import { parseChord } from '../src/music/chords'
import { resolvesApproach, toneColor } from '../src/exercises/toneColors'

/** The colour of each key over a chord. */
const colors = (symbol: string, pitches: number[]) => pitches.map((pitch) => toneColor(pitch, parseChord(symbol)!))

describe('note colours while improvising', () => {
  test('over C7: chord tones, colour tones, and the rest outside for now', () => {
    // C Db D Eb E F F# G Ab A Bb B
    expect(colors('C7', [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71])).toEqual([
      'chord', 'outside', 'color', 'outside', 'chord', 'outside', 'outside', 'chord', 'outside', 'color', 'chord', 'outside',
    ])
  })

  test('the 11th is a colour tone over a minor chord, and #11 over a Lydian chord', () => {
    expect(colors('Dm7', [67])).toEqual(['color']) // G over Dm7
    expect(colors('Cmaj7#11', [66])).toEqual(['color']) // F# over Cmaj7#11
  })

  test('any octave, and the bass of a slash chord counts as a chord tone', () => {
    expect(colors('C7', [40, 88])).toEqual(['chord', 'chord'])
    expect(colors('C/D', [62])).toEqual(['chord'])
  })

  test('an outside note is an approach when the next key resolves it a half step away', () => {
    expect(resolvesApproach(66, 67, 'chord')).toBe(true) // F# to G over C7
    expect(resolvesApproach(63, 62, 'color')).toBe(true) // Eb to D, the 9th
    expect(resolvesApproach(66, 65, 'outside')).toBe(false) // F# to F: still outside
    expect(resolvesApproach(66, 64, 'chord')).toBe(false) // a whole step
  })
})

describe('the Free Improvisation score line', () => {
  test('shows the count and share of each colour', async () => {
    const { createElement } = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { ToneColorsLine } = await import('../src/exercises/ReadingControls')
    const html = renderToStaticMarkup(createElement(ToneColorsLine, { tones: { chord: 2, color: 1, approach: 1, outside: 0 } }))
    expect(html).toContain('<strong class="tone-chord">2</strong> chord tones 50 %')
    expect(html).toContain('<strong class="tone-outside">0</strong> outside 0 %')
  })
})

describe('chord scales in context', () => {
  const chord = (symbol: string) => parseChord(symbol)!
  test('a V going to a minor chord takes the b9 and b13, to a major chord Mixolydian, even as a triad', async () => {
    const { chordScale } = await import('../src/exercises/toneColors')
    expect(chordScale(chord('G7'), chord('C-7'))).toEqual([0, 1, 4, 5, 7, 8, 10])
    expect(chordScale(chord('G'), chord('C'))).toEqual([0, 2, 4, 5, 7, 9, 10])
    expect(chordScale(chord('G'), chord('D'))).toEqual([0, 2, 4, 5, 7, 9, 11]) // not a V: G major
    expect(chordScale(chord('G7b9'), chord('C'))).toEqual([0, 1, 4, 5, 7, 8, 10]) // as written
    expect(chordScale(chord('Bo7'), chord('C'))).toEqual([0, 2, 3, 5, 6, 8, 9, 11])
  })

  test("the key's pentatonics and blues scale are colour tones too", () => {
    expect(toneColor(63, chord('C7'))).toBe('outside') // Eb over C7, no key
    expect(toneColor(63, chord('C7'), { keyPc: 0 })).toBe('color') // in C minor pentatonic and C blues
    expect(toneColor(68, chord('C7'), { keyPc: 0 })).toBe('outside') // Ab: in none of them
    expect(toneColor(68, chord('G7'), { next: chord('C-'), keyPc: 0 })).toBe('color') // Ab: the b9 of G7 going to Cm
  })
})
