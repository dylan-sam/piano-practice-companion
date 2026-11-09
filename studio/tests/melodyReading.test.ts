import { describe, expect, test } from 'vitest'
import { melodyOccurrences, type MelodyOccurrence } from '../src/engine/melody'
import { buildTimeline } from '../src/engine/timeline'
import { swingPlacer } from '../src/engine/events'
import { chartFromMeasures } from '../src/music/chart'
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

describe('swung melody', () => {
  test('swings the "and" of beats in eighths and keeps beats in sixteenths straight', () => {
    const chart = {
      ...chartFromMeasures({ title: 'Swing test', style: 'swing', key: 0, bpm: 120 }, [['C7']]),
      // Beat 1: four sixteenths; beat 2: two eighths; beat 3: an eighth ending on a sixteenth's place
      melody: { notes: [0, 0.25, 0.5, 0.75].map((at) => ({ bar: 0, at, beats: 0.25, pitch: 60 }))
        .concat([1, 1.5].map((at) => ({ bar: 0, at, beats: 0.5, pitch: 62 })))
        .concat([{ bar: 0, at: 2.5, beats: 0.25, pitch: 64 }]) },
    }
    const timeline = buildTimeline(chart, 0, 1, {})
    const notes = melodyOccurrences(chart, timeline, 0.66)
    const offset = notes[0].start
    expect(notes.map((n) => Math.round((n.start - offset) * 100) / 100)).toEqual([0, 0.25, 0.5, 0.75, 1, 1.66, 2.5])
  })
})

describe('swung band grooves', () => {
  test('a groove keeps its beats with sixteenths straight and swings the others', () => {
    const placed = swingPlacer([0, 0.5, 1, 1.25, 1.5, 1.75], 0.66)
    expect([0, 0.5, 1, 1.25, 1.5, 1.75].map(placed)).toEqual([0, 0.66, 1, 1.25, 1.5, 1.75])
  })
})
