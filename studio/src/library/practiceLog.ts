// The practice log, kept on this device for the home screen's statistics: for each day, the
// minutes practised in each area of the app and the answers judged right or wrong there.
//
// Time counts while a practice screen is open and in use (the page in view, and the band playing
// or a key, a click or a MIDI note in the last minute), in steps of PRACTICE_TICK seconds.
// Answers are counted by the screens that judge them (chords and notes of the sightreading
// screens, progressions named and notes dictated in ear training) and written every
// PRACTICE_TICK seconds. The log keeps a year.

import { useEffect } from 'react'
import { loadJson, saveJson } from './storage'
import { FROM_LESSONS, ROUTES } from '../router'

// The screens opened from a lesson step count apart, in 'lessons'
export type PracticeArea = 'play' | 'sightreading' | 'ear' | 'improvisation' | 'lessons'
export const PRACTICE_AREAS: PracticeArea[] = ['play', 'sightreading', 'ear', 'improvisation', 'lessons']

/** One day: seconds practised and answers judged, by area. */
export interface PracticeDay {
  seconds: Partial<Record<PracticeArea, number>>
  right: Partial<Record<PracticeArea, number>>
  judged: Partial<Record<PracticeArea, number>>
}
export type PracticeLog = Record<string, PracticeDay> // by date, 'YYYY-MM-DD' (local time)

const KEY = 'eartraining:practice-log'
const KEEP_DAYS = 400
export const PRACTICE_TICK = 10 // seconds between two counts of the time
const IDLE_AFTER = 60_000 // ms without activity before the time stops counting

/** Whether a stored value is a practice log. */
export function isPracticeLog(value: unknown): value is PracticeLog {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const counts = (v: unknown) => !!v && typeof v === 'object' && Object.values(v).every((n) => typeof n === 'number' && n >= 0)
  return Object.entries(value).every(([date, day]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !!day &&
    counts((day as PracticeDay).seconds) && counts((day as PracticeDay).right) && counts((day as PracticeDay).judged))
}

/** A date as the log's key, in local time. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The log kept on this device. */
export const loadPracticeLog = (): PracticeLog => loadJson(KEY, {}, isPracticeLog)

/** Change today's entry and keep the log (the oldest days beyond a year dropped). */
function updateToday(change: (day: PracticeDay) => PracticeDay, now = new Date()): void {
  const log = loadPracticeLog()
  const today = dayKey(now)
  log[today] = change(log[today] ?? { seconds: {}, right: {}, judged: {} })
  const dates = Object.keys(log).sort()
  for (const old of dates.slice(0, Math.max(0, dates.length - KEEP_DAYS))) delete log[old]
  saveJson(KEY, log)
}

/** Add practice time to today, in an area. */
export function addPracticeTime(area: PracticeArea, seconds: number, now = new Date()): void {
  updateToday((day) => ({ ...day, seconds: { ...day.seconds, [area]: (day.seconds[area] ?? 0) + seconds } }), now)
}

/** Add judged answers to today, in an area: how many were right of how many. */
export function addPracticeResults(area: PracticeArea, right: number, judged: number, now = new Date()): void {
  if (judged <= 0) return
  updateToday((day) => ({
    ...day,
    right: { ...day.right, [area]: (day.right[area] ?? 0) + right },
    judged: { ...day.judged, [area]: (day.judged[area] ?? 0) + judged },
  }), now)
}

// Answers judged while playing, kept here and written to the log a few at a time (not at every note)
const pending = new Map<PracticeArea, { right: number; judged: number }>()

/** Whether the page was opened from a lesson step (its time and answers count for the lessons). */
const fromLessons = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('from') === FROM_LESSONS

/** Answers judged, counted for the next flush (in 'lessons' when the page is a lesson step's). */
function count(area: PracticeArea, right: number, judged: number): void {
  const where = fromLessons() ? 'lessons' : area
  const counts = pending.get(where) ?? { right: 0, judged: 0 }
  pending.set(where, { right: counts.right + right, judged: counts.judged + judged })
}

/** Count one judged answer (a chord, a note, a progression named), written with the next flush. */
export function countAnswer(area: PracticeArea, right: boolean): void {
  count(area, right ? 1 : 0, 1)
}

/**
 * Count the notes of a Free Improvisation chorus: those inside the harmony (chord, colour and
 * approach tones) are "right", the outside ones not.
 */
export function countTones(tones: { chord: number; color: number; approach: number; outside: number }): void {
  const inside = tones.chord + tones.color + tones.approach
  count('improvisation', inside, inside + tones.outside)
}

/** Write the answers counted since the last flush to the log. */
export function flushAnswers(): void {
  for (const [area, counts] of pending) addPracticeResults(area, counts.right, counts.judged)
  pending.clear()
}

/** The area of a screen's path (none for the menus and the Lessons tab, which count no time). */
export function areaOf(path: string): PracticeArea | null {
  if (path.startsWith(ROUTES.playAlong + '/')) return 'play'
  if (path.startsWith(ROUTES.sightreading + '/')) return 'sightreading'
  if (path.startsWith(ROUTES.earTraining + '/')) return 'ear'
  if (path.startsWith(ROUTES.improvisation + '/')) return 'improvisation'
  return null
}

let lastActivity = 0

/** Note that the person is practising: a key, a click, a MIDI note, the band playing. */
export function markActivity(now = Date.now()): void {
  lastActivity = now
}

/**
 * Count practice time while a practice screen (`path`) is open, in view and in use. Clicks and
 * keys are noticed here; MIDI notes and the band playing call markActivity themselves.
 */
export function usePracticeClock(path: string): void {
  useEffect(() => {
    const screen = areaOf(path)
    if (!screen) return
    const area = fromLessons() ? 'lessons' : screen
    const active = () => markActivity()
    window.addEventListener('pointerdown', active)
    window.addEventListener('keydown', active)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - lastActivity < IDLE_AFTER) addPracticeTime(area, PRACTICE_TICK)
      flushAnswers()
    }, PRACTICE_TICK * 1000)
    const hidden = () => { if (document.visibilityState === 'hidden') flushAnswers() }
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.clearInterval(timer)
      flushAnswers()
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pointerdown', active)
      window.removeEventListener('keydown', active)
    }
  }, [path])
}
