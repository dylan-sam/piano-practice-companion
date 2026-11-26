// The home screen's "Today's lesson" card: the next step of the Lessons tab (the first not done),
// its week and unit, a Start button that opens its page (what to do, why, the theory), and the
// program's progress.

import { lessonStepPath, navigate, ROUTES } from '../router'
import { Icon } from '../ui/Icon'
import { ALL_STEPS, placeOf, PROGRAM } from './program'
import { nextStep, useLessonProgress } from './useLessonProgress'

/** The card; on the Lessons screen itself (`here`), without its way to the Lessons screen. */
export function TodayLesson({ here = false }: { here?: boolean }) {
  const { progress } = useLessonProgress()
  const next = nextStep(ALL_STEPS, progress)
  const done = ALL_STEPS.filter((item) => progress.done.includes(item.id)).length
  const weeks = PROGRAM.flatMap((unit) => unit.weekList)
  const weeksDone = weeks.filter((week) => week.steps.every((item) => progress.done.includes(item.id))).length
  const place = next && placeOf(next)
  const share = done / ALL_STEPS.length

  return (
    <section className="today" aria-label="Today's lesson">
      <div className="today-text">
        <span className="today-kicker">
          {next && place ? `Today's lesson · Week ${place.week} · ${place.unit.number ? `Unit ${place.unit.number}` : place.unit.title}` : 'Lessons'}
        </span>
        <strong className="today-title">{next ? next.title : `All ${weeks.length} weeks done`}</strong>
        <span className="today-progress">
          <span className="today-bar"><i style={{ width: `${share * 100}%` }} /></span>
          {weeksDone} of {weeks.length} weeks · {done} of {ALL_STEPS.length} steps
        </span>
      </div>
      <div className="today-actions">
        {next && <button className="today-start" onClick={() => navigate(lessonStepPath(next.id))}>
          <Icon name="start" /> Start
        </button>}
        {!here && <button className="today-all" onClick={() => navigate(ROUTES.lessons)}>All lessons</button>}
      </div>
    </section>
  )
}
