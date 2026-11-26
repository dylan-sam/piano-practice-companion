// The line a screen shows when it reaches the target of the lesson step it was opened from.

import { backRoute, currentPath, navigate } from '../router'

/** "Lesson step done", with the way back to the step's page. */
export function LessonDone() {
  return (
    <p className="sight-hint lesson-reached" role="status">
      Target reached: the lesson step is ticked.{' '}
      <button className="chip" onClick={() => navigate(backRoute(currentPath(), window.location.search))}>Back to the lesson</button>
    </p>
  )
}
