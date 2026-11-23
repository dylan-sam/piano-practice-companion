// The line a screen shows when it reaches the target of the lesson step it was opened from.

import { navigate, ROUTES } from '../router'

/** "Lesson step done", with the way back to the Lessons tab. */
export function LessonDone() {
  return (
    <p className="sight-hint lesson-reached" role="status">
      Target reached: the lesson step is ticked.{' '}
      <button className="chip" onClick={() => navigate(ROUTES.lessons)}>Back to Lessons</button>
    </p>
  )
}
