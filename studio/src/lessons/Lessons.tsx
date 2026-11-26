// The Lessons tab: a 46-week program for pianists new to jazz (program.ts), drawn as a path: each
// unit a row of week circles (done, the current one, started, to come), a week opened showing its
// steps as cards. Each step card has a title and one sentence; its Start button opens the step's
// page (LessonStepPage.tsx: what to do, why, the theory), whose "Understood, start" opens the
// exercise. Progress is kept on this device and only suggests the next step: any step can be
// opened at any time.

import { useEffect, useState } from 'react'
import { lessonStepPath, navigate } from '../router'
import { Wordmark } from '../ui/AppLink'
import { Icon } from '../ui/Icon'
import { TodayLesson } from './TodayLesson'
import { ALL_STEPS, placeOf, PROGRAM, type LessonStep, type LessonUnit, type LessonWeek } from './program'
import { KIND_ICONS, KIND_LABELS } from './stepKinds'
import { summaryOf } from './theory'
import { nextStep, takeRememberedStep, useLessonProgress, type LessonProgress } from './useLessonProgress'

/** What is open on the page: the units opened and the week shown in each, kept for this visit (back from a step). */
interface LessonsView { open: string[]; weeks: Record<string, number> }
const VIEW_KEY = 'eartraining:lessons:view'
const isView = (value: unknown): value is LessonsView => {
  const v = value as Partial<LessonsView> | null
  return !!v && Array.isArray(v.open) && !!v.weeks && typeof v.weeks === 'object'
}

/** The units opened and the week shown in each, kept in the session (so a step's screen comes back to them). */
function useLessonsView() {
  const [view, setView] = useState<LessonsView>(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(VIEW_KEY) ?? 'null')
      return isView(saved) ? saved : { open: [], weeks: {} }
    } catch {
      return { open: [], weeks: {} }
    }
  })
  /** Change the view and keep it for the session. */
  const update = (next: LessonsView) => {
    setView(next)
    try { sessionStorage.setItem(VIEW_KEY, JSON.stringify(next)) } catch { /* kept for this page only */ }
  }
  /** Open or close a unit. */
  const toggleUnit = (id: string, open: boolean) =>
    update({ ...view, open: open ? [...new Set([...view.open, id])] : view.open.filter((unit) => unit !== id) })
  /** Show a week of a unit. */
  const showWeek = (unit: string, week: number) => update({ ...view, weeks: { ...view.weeks, [unit]: week } })
  /** Open a unit at a week (the suggested step). */
  const reveal = (unit: string, week: number) =>
    update({ open: [...new Set([...view.open, unit])], weeks: { ...view.weeks, [unit]: week } })
  return { view, toggleUnit, showWeek, reveal }
}

/** A week's place on the path: all its steps done, the next step in it, some done, or none yet. */
function weekState(week: LessonWeek, progress: LessonProgress, next: LessonStep | null): 'done' | 'current' | 'started' | 'todo' {
  const done = week.steps.filter((item) => progress.done.includes(item.id)).length
  if (done === week.steps.length) return 'done'
  if (next && week.steps.includes(next)) return 'current'
  return done ? 'started' : 'todo'
}

/** One step: its title and one sentence, Start (its page) and Mark done. */
function StepCard({ item, progress, onDone, next }: {
  item: LessonStep
  progress: LessonProgress
  onDone: (id: string) => void
  next: boolean // the suggested step
}) {
  const done = progress.done.includes(item.id)
  return (
    <li className={`lesson-step lesson-step-${item.kind}${done ? ' lesson-step-done' : ''}${next ? ' lesson-step-next' : ''}`} id={item.id}>
      <div className="lesson-step-head">
        <span className="lesson-step-icon" aria-hidden="true"><Icon name={done ? 'check' : KIND_ICONS[item.kind]} /></span>
        <div>
          <span className={`lesson-kind lesson-kind-${item.kind}`}>{KIND_LABELS[item.kind]} · {item.minutes[0]} to {item.minutes[1]} min</span>
          <h4>{item.title}</h4>
        </div>
      </div>
      <p className="lesson-summary">{summaryOf(item)}</p>
      <div className="lesson-actions">
        <button className="button button-primary" onClick={() => navigate(lessonStepPath(item.id))}>Start</button>
        <button className="chip" aria-pressed={done} onClick={() => onDone(item.id)}>{done ? 'Done' : 'Mark done'}</button>
      </div>
    </li>
  )
}

/** One unit: its head (open or close), its path of weeks, and the week shown when open. */
function UnitCard({ unit, progress, next, open, shownWeek, onToggle, onWeek, onDone }: {
  unit: LessonUnit
  progress: LessonProgress
  next: LessonStep | null
  open: boolean
  shownWeek: number | undefined
  onToggle: (open: boolean) => void
  onWeek: (week: number) => void
  onDone: (id: string) => void
}) {
  const steps = unit.weekList.flatMap((week) => week.steps)
  const unitDone = steps.filter((item) => progress.done.includes(item.id)).length
  const complete = unitDone === steps.length
  const shown = unit.weekList.find((week) => week.week === shownWeek) ?? unit.weekList.find((week) => next && week.steps.includes(next)) ?? unit.weekList[0]
  const title = unit.number ? `Unit ${unit.number}. ${unit.title}` : unit.title
  return (
    <section className={`unit-card${open ? ' unit-open' : ''}${complete ? ' unit-complete' : ''}`} aria-label={title}>
      <button className="unit-head" aria-expanded={open} onClick={() => onToggle(!open)}>
        <span className="unit-badge" aria-hidden="true">{complete ? <Icon name="trophy" /> : unit.number || <Icon name="trophy" />}</span>
        <span className="unit-text">
          <span className="lesson-unit-title">{title}</span>
          <span className="lesson-unit-weeks">{unit.weeks} · {complete ? 'unit complete' : `${unitDone} of ${steps.length} steps done`}</span>
        </span>
        <span className="unit-meter" aria-hidden="true"><i style={{ width: `${(unitDone / steps.length) * 100}%` }} /></span>
      </button>
      <ol className="week-path" role={open ? 'tablist' : undefined} aria-label={`Weeks of ${unit.title}`}>
        {unit.weekList.map((week, i) => {
          const state = weekState(week, progress, next)
          return (
            <li key={week.week} className={`week-stop week-${state}`}>
              {i > 0 && <span className="week-line" aria-hidden="true" />}
              <button role={open ? 'tab' : undefined} aria-selected={open ? week === shown : undefined} className="week-node"
                aria-label={`Week ${week.week}`} title={`Week ${week.week}${state === 'done' ? ', done' : state === 'current' ? ', the next step is here' : ''}`}
                onClick={() => onWeek(week.week)}>
                {state === 'done' ? <Icon name="check" /> : state === 'current' ? <Icon name="start" /> : week.week}
              </button>
              {(state === 'done' || state === 'current') && <small aria-hidden="true">{week.week}</small>}
            </li>
          )
        })}
      </ol>
      {open && <div className="unit-body">
        <p><strong>Goal:</strong> {unit.goal}</p>
        <p className="sight-hint">Source: {unit.source}</p>
        <section className="lesson-week" role="tabpanel" aria-label={`Week ${shown.week}`}>
          <h3>Week {shown.week}</h3>
          <ol className="lesson-steps">
            {shown.steps.map((item) => (
              <StepCard key={item.id} item={item} progress={progress} onDone={onDone} next={item === next} />
            ))}
          </ol>
        </section>
      </div>}
    </section>
  )
}

/** The Lessons screen. */
export function Lessons() {
  const { progress, markDone, reset } = useLessonProgress()
  const { view, toggleUnit, showWeek, reveal } = useLessonsView()
  const next = nextStep(ALL_STEPS, progress)

  /** Open a step's unit and week, and bring the step into view. */
  const show = (step: LessonStep) => {
    const place = placeOf(step)
    if (!place) return
    reveal(place.unit.id, place.week)
    window.setTimeout(() => document.getElementById(step.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  // Back from a step's page: show that step again (once, on opening)
  useEffect(() => {
    const id = takeRememberedStep()
    const step = id && ALL_STEPS.find((item) => item.id === id)
    if (step) show(step)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the tab opens
  }, [])

  return (
    <div className="app lessons">
      <header className="topbar">
        <Wordmark>Lessons</Wordmark>
        <span className="topbar-spacer" />
      </header>
      <main className="lessons-page">
        <section className="lessons-intro">
          <h1>Jazz piano in 46 weeks</h1>
          <p>
            About 11 months at 20 to 30 minutes a day, 5 days a week, with a MIDI keyboard. Every session has four parts:
            hands together, the song, improvising and ear training. Every song is learnt with a left hand that grows in
            stages (bass, chords, then the song's pattern).
          </p>
          <details className="lessons-how">
            <summary>How the lessons work</summary>
            <p>
              Nothing is locked: open any week at any time. Each step ends with a concrete target, such as "90% right at
              80 BPM", rather than "until you know it"; take the time you need. Start at a slower BPM during the first days
              of the week if needed and increase the tempo slowly. Come back later to earlier units at faster tempos. Steps
              the app can check are ticked by themselves when you reach their target. Your progress is kept on this device.
            </p>
          </details>
        </section>
        <TodayLesson here />
        {next && <p className="lessons-next"><button className="link-button" onClick={() => show(next)}>Show the next step in its week</button></p>}

        <div className="lesson-path">
          {PROGRAM.map((unit) => (
            <UnitCard key={unit.id} unit={unit} progress={progress} next={next} open={view.open.includes(unit.id)}
              shownWeek={view.weeks[unit.id]} onToggle={(open) => toggleUnit(unit.id, open)}
              onWeek={(week) => (view.open.includes(unit.id) ? showWeek(unit.id, week) : reveal(unit.id, week))}
              onDone={markDone} />
          ))}
        </div>

        <p className="lessons-reset">
          <button className="chip" onClick={() => { if (window.confirm('Forget all lesson progress on this device?')) reset() }}>
            Forget my progress
          </button>
        </p>
      </main>
    </div>
  )
}
