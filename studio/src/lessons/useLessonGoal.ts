// A screen opened from a lesson step with a target (lessonLink.ts: step, goal, bpm): the step is
// ticked in the Lessons tab once the target is reached, and the screen says so.

import { useEffect, useState } from 'react'
import type { LessonLink } from './lessonLink'
import { markStepDone } from './useLessonProgress'

/** How a screen is doing: right out of judged, whether the whole piece was judged, and the tempo. */
export interface GoalProgress {
  right: number
  judged: number
  complete: boolean // the whole song, exercise or line has been judged
  bpm: number
  offsetMs?: number | null // the average timing of the right notes (early < 0, late > 0), when measured
}

/**
 * Whether some progress reaches a lesson's target: the whole piece judged, at least `goal`
 * percent right, at the lesson's tempo or faster, and on time within `timing` ms on average
 * when the lesson asks for it.
 *
 *   goal 90, bpm 80: 19 right of 20 at 80 BPM, complete -> reached; at 70 BPM -> not yet
 *   ... timing 60: 45 ms late on average -> reached; 80 ms early -> not yet
 */
export function reachesGoal(lesson: Pick<LessonLink, 'goal' | 'bpm' | 'timing'>, progress: GoalProgress): boolean {
  const onTime = !lesson.timing || (progress.offsetMs != null && Math.abs(progress.offsetMs) <= lesson.timing)
  return !!lesson.goal && progress.complete && progress.judged > 0 && onTime &&
    progress.right * 100 >= lesson.goal * progress.judged && progress.bpm >= (lesson.bpm ?? 0)
}

/** Tick the lesson's step once its target is reached; returns whether it has been, for a message. */
export function useLessonGoal(lesson: Omit<LessonLink, 'route'> | null, progress: GoalProgress): boolean {
  const [reached, setReached] = useState(false)
  // Once reached, it stays reached for the visit (a later miss does not untick the step)
  if (!reached && !!lesson?.step && reachesGoal(lesson, progress)) setReached(true)
  useEffect(() => {
    if (reached && lesson?.step) markStepDone(lesson.step)
  }, [reached, lesson])
  return reached
}
