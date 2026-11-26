import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { addPracticeResults, addPracticeTime, areaOf, countAnswer, dayKey, flushAnswers, isPracticeLog, loadPracticeLog, type PracticeLog } from '../src/library/practiceLog'
import { accuracy, hardestProgression, lastWeek, minutesByArea, streaks, totalHours, weakestChords } from '../src/library/practiceStats'
import { earnsBurst, judgementOf } from '../src/ui/effects'

const today = new Date(2026, 10, 25, 18)
const back = (days: number) => dayKey(new Date(today.getTime() - days * 86_400_000))
const day = (seconds: number, right = 0, judged = 0) => ({ seconds: { sightreading: seconds }, right: { sightreading: right }, judged: { sightreading: judged } })

// A storage for the log (vitest runs without a browser)
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  Object.assign(globalThis, { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) } })
})
afterEach(() => store.clear())

describe('the practice log', () => {
  test('adds time and answers to today, by area; answers are written at a flush', () => {
    addPracticeTime('ear', 10, today)
    addPracticeTime('ear', 10, today)
    addPracticeResults('sightreading', 3, 4, today)
    const log = loadPracticeLog()
    expect(log[dayKey(today)]).toEqual({ seconds: { ear: 20 }, right: { sightreading: 3 }, judged: { sightreading: 4 } })
    countAnswer('ear', true)
    countAnswer('ear', false)
    expect(loadPracticeLog()[dayKey(new Date())]?.judged.ear ?? 0).toBe(0)
    flushAnswers()
    expect(loadPracticeLog()[dayKey(new Date())].judged.ear).toBe(2)
    expect(isPracticeLog(loadPracticeLog())).toBe(true)
    expect(isPracticeLog({ nope: 1 })).toBe(false)
  })

  test('the area of a screen; menus and lessons count no time', () => {
    expect(areaOf('/sightreading/chords')).toBe('sightreading')
    expect(areaOf('/ear-training/melodic-dictation')).toBe('ear')
    expect(areaOf('/play-along/chords')).toBe('play')
    expect(areaOf('/improvisation/free')).toBe('improvisation')
    expect(areaOf('/sightreading')).toBeNull()
    expect(areaOf('/lessons')).toBeNull()
  })
})

describe('the statistics', () => {
  const log: PracticeLog = { [back(0)]: day(600, 8, 10), [back(1)]: day(120), [back(2)]: day(30), [back(3)]: day(300), [back(9)]: day(600, 1, 4), [back(10)]: day(600), [back(11)]: day(600), [back(12)]: day(600) }

  test('days in a row (a minute or more), and the best run', () => {
    expect(streaks(log, today)).toEqual({ current: 2, best: 4 })
    // Today not practised yet keeps yesterday's run
    const { [back(0)]: _today, ...noToday } = log
    expect(streaks(noToday, today).current).toBe(1)
  })

  test('the week, the areas and the hours', () => {
    const week = lastWeek(log, today)
    expect(week.map((d) => d.minutes)).toEqual([0, 0, 0, 5, 1, 2, 10])
    expect(minutesByArea(log, 30, today).sightreading).toBe(Math.round((600 * 5 + 120 + 30 + 300) / 60))
    expect(totalHours(log)).toBe(1)
  })

  test('the share right this week and the week before', () => {
    expect(accuracy(log, 'sightreading', today)).toBe(0.8)
    expect(accuracy(log, 'sightreading', today, 7)).toBe(0.25)
    expect(accuracy(log, 'ear', today)).toBeNull()
  })

  test('what to work on: chords missed most, the progression heard wrong most', () => {
    expect(weakestChords({ '1:minor': 7, '6:major': 4, '11:other': 2, '3:major': 1 })).toEqual([
      { name: 'D♭ minor', misses: 7 }, { name: 'G♭ major', misses: 4 }, { name: 'B diminished or other', misses: 2 }])
    expect(hardestProgression({
      'progression-06': { asked: 6, correct: 2, confusedWith: { 'progression-02': 3 } },
      'progression-02': { asked: 5, correct: 5, confusedWith: {} },
      'progression-01': { asked: 2, correct: 0, confusedWith: {} },
    })).toEqual({ name: 'ii-bII7-I', share: 1 / 3, takenFor: 'ii-V-I' })
    expect(hardestProgression({})).toBeNull()
  })
})

describe('the effects', () => {
  test('perfect within a share of a beat; a burst for a chorus 90% right of 6 answers or more', () => {
    expect(judgementOf(0.1)).toBe('perfect')
    expect(judgementOf(-0.3)).toBe('good')
    expect(earnsBurst({ right: 9, judged: 10 })).toBe(true)
    expect(earnsBurst({ right: 8, judged: 10 })).toBe(false)
    expect(earnsBurst({ right: 5, judged: 5 })).toBe(false)
  })
})
