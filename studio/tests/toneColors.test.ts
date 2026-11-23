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

describe('the improvise score line', () => {
  test('shows the count and share of each colour, then the last keys in their colours', async () => {
    const { createElement } = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { MelodyScoreLine } = await import('../src/exercises/ReadingControls')
    const { EMPTY_SCORE } = await import('../src/exercises/melodyReading')
    const html = renderToStaticMarkup(createElement(MelodyScoreLine, {
      bpm: 120,
      reading: {
        checking: 'improvise', score: EMPTY_SCORE, total: 0, chordScore: { correct: 0, missed: 0 }, chordTotal: 0,
        tones: { chord: 2, color: 1, approach: 1, outside: 0 },
        recent: [{ id: 1, pitch: 66, color: 'approach' }, { id: 2, pitch: 67, color: 'chord' }],
      },
    }))
    expect(html).toContain('<strong class="tone-chord">2</strong> chord tones 50 %')
    expect(html).toContain('<strong class="tone-outside">0</strong> outside 0 %')
    expect(html).toMatch(/tone-approach">G♭<\/strong><strong class="tone-chord">G</)
    expect(html).not.toContain('wrong note')
  })
})
