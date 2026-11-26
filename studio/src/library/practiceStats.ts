// The home screen's statistics, worked out from what the app keeps on this device: the practice
// log (time and answers by day and area), the chords missed in Chord Sightreading, the answers of
// Name the progression and the lessons' progress.

import { dayKey, PRACTICE_AREAS, type PracticeArea, type PracticeLog } from './practiceLog'
import { noteName } from '../music/chords'
import { progressionName } from '../exercises/progressionNames'

const DAY_MS = 86_400_000
export const PRACTISED_SECONDS = 60 // a day counts in the streak with this much practice

/** Seconds practised on a day, all areas together. */
export const daySeconds = (log: PracticeLog, key: string): number =>
  Object.values(log[key]?.seconds ?? {}).reduce((sum, n) => sum + (n ?? 0), 0)

/** The day `back` days before `today` (local dates). */
const dayBefore = (today: Date, back: number) => dayKey(new Date(today.getTime() - back * DAY_MS))

/**
 * Days in a row with practice, up to today (today not practised yet keeps yesterday's run), and
 * the longest run in the log.
 */
export function streaks(log: PracticeLog, today = new Date()): { current: number; best: number } {
  const practised = (key: string) => daySeconds(log, key) >= PRACTISED_SECONDS
  let current = 0
  for (let back = practised(dayKey(today)) ? 0 : 1; practised(dayBefore(today, back)); back++) current++
  let best = 0
  let run = 0
  let previous: number | null = null
  for (const key of Object.keys(log).filter(practised).sort()) {
    const time = new Date(`${key}T12:00:00`).getTime()
    run = previous !== null && Math.round((time - previous) / DAY_MS) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = time
  }
  return { current, best: Math.max(best, current) }
}

/** The last 7 days, oldest first: their short weekday name and minutes practised. */
export function lastWeek(log: PracticeLog, today = new Date()): { day: string; minutes: number }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today.getTime() - (6 - i) * DAY_MS)
    return { day: date.toLocaleDateString(undefined, { weekday: 'narrow' }), minutes: Math.round(daySeconds(log, dayKey(date)) / 60) }
  })
}

/** Minutes practised in each area over the last `days` days. */
export function minutesByArea(log: PracticeLog, days: number, today = new Date()): Record<PracticeArea, number> {
  const out = Object.fromEntries(PRACTICE_AREAS.map((area) => [area, 0])) as Record<PracticeArea, number>
  for (let back = 0; back < days; back++) {
    for (const area of PRACTICE_AREAS) out[area] += log[dayBefore(today, back)]?.seconds[area] ?? 0
  }
  for (const area of PRACTICE_AREAS) out[area] = Math.round(out[area] / 60)
  return out
}

/** Total hours practised in the log. */
export const totalHours = (log: PracticeLog): number =>
  Math.round(Object.keys(log).reduce((sum, key) => sum + daySeconds(log, key), 0) / 360) / 10

/**
 * The share right in an area over 7 days ending `endBack` days ago (0: this week, 7: the week
 * before), or null with nothing judged.
 */
export function accuracy(log: PracticeLog, area: PracticeArea, today = new Date(), endBack = 0): number | null {
  let right = 0
  let judged = 0
  for (let back = endBack; back < endBack + 7; back++) {
    const day = log[dayBefore(today, back)]
    right += day?.right[area] ?? 0
    judged += day?.judged[area] ?? 0
  }
  return judged ? right / judged : null
}

// Chord Sightreading keeps its missed chords by root and family ("1:minor": C# or Db, minor)
const FAMILY_NAMES: Record<string, string> = { major: 'major', minor: 'minor', other: 'diminished or other' }

/** The chords missed most often in Chord Sightreading, as names ("D♭ minor"), most missed first. */
export function weakestChords(mistakes: Record<string, number>, count = 3): { name: string; misses: number }[] {
  return Object.entries(mistakes)
    .filter(([key, misses]) => /^\d+:\w+$/.test(key) && misses > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([key, misses]) => {
      const [root, family] = key.split(':')
      return { name: `${noteName(Number(root), true).replace('b', '♭')} ${FAMILY_NAMES[family] ?? family}`, misses }
    })
}

interface ProgressionResult { asked: number; correct: number; confusedWith: Record<string, number> }

/**
 * The progression of Name the progression heard right least often (asked 3 times or more), and
 * the one most often chosen in its place.
 */
export function hardestProgression(results: Record<string, ProgressionResult>): { name: string; share: number; takenFor: string | null } | null {
  const asked = Object.entries(results).filter(([, r]) => r && r.asked >= 3)
  if (!asked.length) return null
  const [id, result] = asked.sort((a, b) => a[1].correct / a[1].asked - b[1].correct / b[1].asked)[0]
  const share = result.correct / result.asked
  if (share >= 1) return null
  const confused = Object.entries(result.confusedWith ?? {}).sort((a, b) => b[1] - a[1])[0]
  return { name: progressionName(id), share, takenFor: confused ? progressionName(confused[0]) : null }
}
