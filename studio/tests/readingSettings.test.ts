import { describe, expect, test } from 'vitest'
import { checkMode, DEFAULT_READING, isReadingSettings } from '../src/exercises/useMelodyJudging'
import { readingHint, readingTally } from '../src/exercises/readingText'
import { EMPTY_SCORE } from '../src/exercises/melodyReading'

describe('reading settings', () => {
  test('checks the melody only by default', () => {
    expect(DEFAULT_READING.check).toBe('melody')
    expect(checkMode({ strictness: 'normal', anyOctave: true })).toBe('melody')
  })

  test('accepts settings saved before the check mode, and refuses an unknown mode', () => {
    expect(isReadingSettings({ strictness: 'normal', anyOctave: true, guide: true })).toBe(true)
    expect(isReadingSettings({ strictness: 'normal', anyOctave: true, check: 'both' })).toBe(true)
    expect(isReadingSettings({ strictness: 'normal', anyOctave: true, check: 'hands' })).toBe(false)
  })
})

describe('reading text', () => {
  const reading = {
    score: { ...EMPTY_SCORE, correct: 3, wrong: 1 }, total: 10, chordScore: { correct: 2, missed: 2 }, chordTotal: 8,
  }

  test('the tally counts what is checked', () => {
    expect(readingTally({ ...reading, checking: 'melody' })).toBe('  3/4 right')
    expect(readingTally({ ...reading, checking: 'chords' })).toBe('  2/4 right')
    expect(readingTally({ ...reading, checking: 'both' })).toBe('  5/8 right')
    expect(readingTally({ ...reading, score: EMPTY_SCORE, checking: 'melody' })).toBe('')
  })

  test('the hint names the hands only when both are checked', () => {
    expect(readingHint('melody', 'the lick')).toContain('Play the lick')
    expect(readingHint('chords', 'the lick')).not.toContain('the lick')
    expect(readingHint('both', 'the melody')).toContain('right hand')
  })
})
