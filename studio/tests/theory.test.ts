import { parseChord } from '../src/music/chords'
import { describe, expect, it } from 'vitest'
import { ALL_STEPS } from '../src/lessons/program'
import { MAX_CARDS, referencesOf, summaryOf, THEORY, theoryFor } from '../src/lessons/theory'

describe('lesson theory', () => {
  it('gives every step at least one card, at most MAX_CARDS, and a one-sentence summary', () => {
    for (const step of ALL_STEPS) {
      const cards = theoryFor(step)
      expect(cards.length, step.title).toBeGreaterThan(0)
      expect(cards.length).toBeLessThanOrEqual(MAX_CARDS)
      expect(summaryOf(step).length, step.title).toBeGreaterThan(0)
      expect(summaryOf(step)).not.toContain('\n')
    }
  })
  it('matches the cards of a scale, a substitution and a way of working', () => {
    const byTitle = (start: string) => ALL_STEPS.find((step) => step.title.startsWith(start))!
    expect(theoryFor(byTitle('Dorian scale')).map((card) => card.id)).toEqual(['dorian'])
    expect(theoryFor(byTitle('ii-♭II7-I')).map((card) => card.id)).toEqual(['tritone', 'shells', 'guideTones'])
    expect(theoryFor(byTitle('Intro and ending')).map((card) => card.id)).toEqual(['intro-avalon', 'ending-avalon', 'introEnding'])
  })
  it('has unique ids, a picture or a text on every card, and lists each reference once', () => {
    expect(new Set(THEORY.map((card) => card.id)).size).toBe(THEORY.length)
    for (const card of THEORY) expect(card.text.length).toBeGreaterThan(0)
    for (const step of ALL_STEPS) expect(new Set(referencesOf(step)).size).toBe(referencesOf(step).length)
  })
  it('gives each progression a numeral per chord', () => {
    for (const card of THEORY) if (card.progression) expect(card.progression.numerals.length, card.id).toBe(card.progression.chords.length)
  })
  it('writes each intro and ending in C, its example over the same chords', () => {
    expect(THEORY.find((card) => card.id === 'intro-tinRoof')!.progression!.chords).toEqual(['C A7', 'D-7 G7', 'C A7', 'D-7 G7'])
    for (const card of THEORY.filter((item) => /^(intro|ending)-/.test(item.id))) {
      const boxes = card.progression!.chords.flatMap((box) => box.split(' ')).map((text) => parseChord(text)!.root)
      const written = [...card.abc!.matchAll(/"([^"]+)"/g)].map((match) => parseChord(match[1])!.root)
      // The example follows the bars (a vamp's example may cover only its first bars)
      expect(boxes.slice(0, written.length), card.id).toEqual(written)
    }
  })
  it('takes the first sentence as the summary', () => {
    const step = { ...ALL_STEPS[0], what: 'Play it slowly. Then faster.' }
    expect(summaryOf(step)).toBe('Play it slowly.')
  })
})
