// Progress through the Lessons tab, kept on this device: the steps marked done and the boxes
// ticked in self-checks. Progress only suggests the next step; nothing is ever locked.

import { useCallback, useState } from 'react'
import { loadJson, saveJson } from '../library/storage'
import { celebrate } from '../ui/effects'
import { ALL_STEPS, placeOf, type LessonStep } from './program'

export interface LessonProgress {
  done: string[] // ids of the steps marked done
  ticked: Record<string, number[]> // a self-check step's ticked boxes, by step id
}

const KEY = 'eartraining:lessons:progress'
const EMPTY: LessonProgress = { done: [], ticked: {} }

/** Whether a stored value is lesson progress. */
export function isLessonProgress(value: unknown): value is LessonProgress {
  const v = value as Partial<LessonProgress> | null
  return !!v && Array.isArray(v.done) && v.done.every((id) => typeof id === 'string') && !!v.ticked &&
    typeof v.ticked === 'object' && Object.values(v.ticked).every((boxes) => Array.isArray(boxes) && boxes.every(Number.isInteger))
}

/** Mark a step done from another screen (its target was reached), keeping the rest of the progress. */
export function markStepDone(id: string): void {
  const progress = loadJson(KEY, EMPTY, isLessonProgress)
  if (!progress.done.includes(id)) saveJson(KEY, { ...progress, done: [...progress.done, id] })
}

/** The first step not done yet, in the program's order (the suggestion), or null when all are done. */
export function nextStep(steps: readonly LessonStep[], progress: LessonProgress): LessonStep | null {
  return steps.find((item) => !progress.done.includes(item.id)) ?? null
}

const LAST_KEY = 'eartraining:lessons:last' // the step whose page was open last, for this visit

/** Note the step whose page is open, so the Lessons tab can show it again (kept for the visit). */
export function rememberStep(id: string): void {
  try { sessionStorage.setItem(LAST_KEY, id) } catch { /* not kept: the Lessons tab opens as it was */ }
}

/** The step whose page was open last, forgotten once read (null when none). */
export function takeRememberedStep(): string | null {
  try {
    const id = sessionStorage.getItem(LAST_KEY)
    sessionStorage.removeItem(LAST_KEY)
    return id
  } catch {
    return null
  }
}

/** Whether marking a step done would finish its unit: not done yet, and every other step of the unit done. */
export function finishesUnit(id: string, progress: LessonProgress): boolean {
  const step = ALL_STEPS.find((item) => item.id === id)
  const unit = step && placeOf(step)?.unit
  return !!unit && !progress.done.includes(id) &&
    unit.weekList.flatMap((week) => week.steps).every((item) => item.id === id || progress.done.includes(item.id))
}

/** The progress kept on this device, with ways to mark a step done and tick a box. */
export function useLessonProgress() {
  const [progress, setProgress] = useState<LessonProgress>(() => loadJson(KEY, EMPTY, isLessonProgress))

  /** Change the progress and keep it. */
  const update = useCallback((change: (current: LessonProgress) => LessonProgress) => {
    setProgress((current) => {
      const next = change(current)
      saveJson(KEY, next)
      return next
    })
  }, [])

  /** Mark a step done, or not done any more. */
  const toggleDone = useCallback((id: string) => update((current) => ({
    ...current, done: current.done.includes(id) ? current.done.filter((item) => item !== id) : [...current.done, id],
  })), [update])

  /** Mark a step done (or not) by hand; finishing a unit's last step earns a burst of colour. */
  const markDone = useCallback((id: string) => {
    if (finishesUnit(id, progress)) celebrate()
    toggleDone(id)
  }, [progress, toggleDone])

  /** Tick or untick a box of a self-check. */
  const toggleTick = useCallback((id: string, box: number) => update((current) => {
    const boxes = current.ticked[id] ?? []
    return { ...current, ticked: { ...current.ticked, [id]: boxes.includes(box) ? boxes.filter((b) => b !== box) : [...boxes, box] } }
  }), [update])

  /** Forget all progress. */
  const reset = useCallback(() => update(() => EMPTY), [update])

  return { progress, toggleDone, markDone, toggleTick, reset }
}
