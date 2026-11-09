import { describe, expect, test } from 'vitest'
import type { MelodyOccurrence } from '../src/engine/melody'
import { accuracy, averageOffsetMs, MelodyJudge, noteKey } from '../src/exercises/melodyReading'

/** A melody note starting at a beat. */
const note = (start: number, pitch: number, measure = 0): MelodyOccurrence =>
  ({ measure, at: start % 4, start, end: start + 1, pitch, chorus: 0 })

describe('melody judge', () => {
  test('a right key near the note is correct, with its timing', () => {
    const judge = new MelodyJudge([note(4, 60), note(5, 62)], 0.25, false)
    expect(judge.press(4.1, 60)).toMatchObject({ result: 'correct', offset: expect.closeTo(0.1) })
    expect(judge.press(4.9, 62).result).toBe('correct')
    expect(judge.score).toMatchObject({ correct: 2, wrong: 0, missed: 0 })
  })

  test('a wrong pitch marks the note, which can still be put right in its window', () => {
    const judge = new MelodyJudge([note(4, 60)], 0.25, false)
    expect(judge.press(3.9, 61)).toMatchObject({ result: 'wrong' })
    expect(judge.press(4.05, 60).result).toBe('correct')
    expect(judge.expire(10)).toEqual([])
    expect(judge.score.correct).toBe(1)
  })

  test('a note never played right is wrong or missed once its window ends', () => {
    const judge = new MelodyJudge([note(4, 60), note(6, 64)], 0.25, false)
    judge.press(4, 61)
    expect(judge.expire(4.2)).toEqual([]) // its window is still open
    expect(judge.expire(4.3).map((s) => s.result)).toEqual(['wrong'])
    expect(judge.expire(7).map((s) => s.result)).toEqual(['missed'])
    expect(judge.score).toMatchObject({ wrong: 1, missed: 1 })
  })

  test('keys far from any note are extra', () => {
    const judge = new MelodyJudge([note(4, 60)], 0.25, false)
    expect(judge.press(5, 60).result).toBe('extra')
    expect(judge.score.extra).toBe(1)
  })

  test('windows stop halfway to the next note, so fast notes are told apart', () => {
    const judge = new MelodyJudge([note(4, 60), note(4.25, 60)], 0.4, false)
    expect(judge.press(4.2, 60).note?.start).toBe(4.25)
    expect(judge.press(4.05, 60).note?.start).toBe(4)
  })

  test('any octave, when allowed', () => {
    expect(new MelodyJudge([note(4, 60)], 0.25, true).press(4, 72).result).toBe('correct')
    expect(new MelodyJudge([note(4, 60)], 0.25, false).press(4, 72).result).toBe('wrong')
  })

  test('score summary', () => {
    const score = { correct: 3, wrong: 1, missed: 0, extra: 2, offset: 0.3 }
    expect(accuracy(score)).toBe(75)
    expect(averageOffsetMs(score, 120)).toBe(50) // 0.1 beat at 120 bpm
    expect(noteKey(3, 1.3333333)).toBe('3:1.333')
  })
})
