// The Lessons tab: a 30-week program for pianists new to jazz (program.ts), unit by unit and week
// by week. Each step says what to do, why, how long and when it is done, and its Start button
// opens the screen that practises it, set up for the step. Progress is kept on this device and
// only suggests the next step: any step can be opened at any time.

import { useState } from 'react'
import { navigate } from '../router'
import { Wordmark } from '../ui/AppLink'
import { lessonUrl } from './lessonLink'
import { ScaleMapCard } from './ScaleMap'
import { scaleMapFor } from './scaleMaps'
import { ALL_STEPS, PROGRAM, type LessonStep, type LessonUnit, type StepKind } from './program'
import { nextStep, useLessonProgress, type LessonProgress } from './useLessonProgress'

// The name of each part of a session, on its steps
const KIND_LABELS: Record<StepKind, string> = {
  hands: 'Hands together', listen: 'Listen', song: 'The song', improvise: 'Improvise', ear: 'Ear', check: 'Self-check',
}

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

/** The unit and week a step is in. */
function placeOf(step: LessonStep): { unit: LessonUnit; week: number } | null {
  for (const unit of PROGRAM) for (const week of unit.weekList) if (week.steps.includes(step)) return { unit, week: week.week }
  return null
}

/** One step: what, why, how long, done when; Start, Mark done, and the boxes of a self-check. */
function StepCard({ item, progress, onDone, onTick, next }: {
  item: LessonStep
  progress: LessonProgress
  onDone: (id: string) => void
  onTick: (id: string, box: number) => void
  next: boolean // the suggested step
}) {
  const done = progress.done.includes(item.id)
  const map = item.link?.song ? scaleMapFor(item.link.song) : undefined
  const ticked = progress.ticked[item.id] ?? []
  return (
    <li className={`lesson-step${done ? ' lesson-step-done' : ''}${next ? ' lesson-step-next' : ''}`} id={item.id}>
      <div className="lesson-step-head">
        <span className={`lesson-kind lesson-kind-${item.kind}`}>{KIND_LABELS[item.kind]}</span>
        <h4>{item.title}</h4>
      </div>
      <p>{item.what}</p>
      <dl className="lesson-meta">
        <div><dt>Why</dt><dd>{item.why}</dd></div>
        <div><dt>How long</dt><dd>{item.minutes[0]} to {item.minutes[1]} minutes</dd></div>
        <div><dt>Done when</dt><dd>{item.done}</dd></div>
      </dl>
      {item.kind === 'improvise' && map && <ScaleMapCard map={map} keyPc={item.link?.key ?? map.tonic} />}
      {item.selfCheck && <ul className="lesson-checks" aria-label="Self-check">
        {item.selfCheck.map((text, box) => (
          <li key={text}>
            <label><input type="checkbox" checked={ticked.includes(box)} onChange={() => onTick(item.id, box)} /> {text}</label>
          </li>
        ))}
      </ul>}
      <div className="lesson-actions">
        {item.link && <button className="button button-primary" onClick={() => navigate(lessonUrl(item.link!))}>Start</button>}
        <button className="chip" aria-pressed={done} onClick={() => onDone(item.id)}>{done ? 'Done' : 'Mark done'}</button>
      </div>
    </li>
  )
}

/** The Lessons screen. */
export function Lessons() {
  const { progress, toggleDone, toggleTick, reset } = useLessonProgress()
  const { view, toggleUnit, showWeek, reveal } = useLessonsView()
  const next = nextStep(ALL_STEPS, progress)
  const doneCount = ALL_STEPS.filter((item) => progress.done.includes(item.id)).length

  /** Open the suggested step's unit and week, and bring the step into view. */
  const showNext = () => {
    const place = next && placeOf(next)
    if (!place || !next) return
    reveal(place.unit.id, place.week)
    window.setTimeout(() => document.getElementById(next.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
  }

  return (
    <div className="app lessons">
      <header className="topbar">
        <Wordmark>Lessons</Wordmark>
        <span className="topbar-spacer" />
      </header>
      <main className="lessons-page">
        <section className="lessons-intro">
          <h1>Jazz piano in 30 weeks</h1>
          <p>
            About 7 months at 20 to 30 minutes a day, 5 days a week, with a MIDI keyboard. Both hands and a little improvising
            from the first week: every song is learnt with a left hand that grows in stages (bass, chords, then the song's
            pattern), and every session ends with a few minutes of improvising. A session has four parts: hands together,
            the song, improvising, and ear training.
          </p>
          <p>
            Nothing is locked: open any step at any time. Each step ends with a concrete target, such as "90% right at
            80 BPM", rather than "until you know it"; take the time you need. Start at a slower BPM during the first days
            of the week if needed and increase the tempo slowly. Come back later to earlier units at faster tempos. Steps
            the app can check are ticked by themselves when you reach their target. Your progress is kept on this device.
          </p>
          <p className="lessons-progress">{doneCount} of {ALL_STEPS.length} steps done.</p>
          {next && <p className="lessons-next">
            Next: <button className="link-button" onClick={showNext}>{next.title}</button>
            {next.link && <button className="button button-primary" onClick={() => navigate(lessonUrl(next.link!))}>Start</button>}
          </p>}
        </section>

        {PROGRAM.map((unit) => {
          const steps = unit.weekList.flatMap((week) => week.steps)
          const unitDone = steps.filter((item) => progress.done.includes(item.id)).length
          const shown = unit.weekList.find((week) => week.week === view.weeks[unit.id]) ?? unit.weekList[0]
          return (
            <details key={unit.id} className="lesson-unit" open={view.open.includes(unit.id)}
              onToggle={(event) => {
                const open = (event.currentTarget as HTMLDetailsElement).open
                if (open !== view.open.includes(unit.id)) toggleUnit(unit.id, open)
              }}>
              <summary>
                <span className="lesson-unit-title">{unit.id === 'review' ? unit.title : `Unit ${unit.id.slice(1)}. ${unit.title}`}</span>
                <span className="lesson-unit-weeks">{unit.weeks} · {unitDone} of {steps.length} done</span>
              </summary>
              <p><strong>Goal:</strong> {unit.goal}</p>
              <p className="sight-hint">Source: {unit.source}</p>
              {unit.weekList.length > 1 && <div className="lesson-week-tabs" role="tablist" aria-label={`Weeks of ${unit.title}`}>
                {unit.weekList.map((week) => {
                  const weekDone = week.steps.every((item) => progress.done.includes(item.id))
                  return (
                    <button key={week.week} role="tab" aria-selected={week === shown} className="chip"
                      id={`tab-week-${week.week}`} aria-controls={`week-${week.week}`} onClick={() => showWeek(unit.id, week.week)}>
                      Week {week.week}{weekDone ? ' \u2713' : ''}
                    </button>
                  )
                })}
              </div>}
              <section className="lesson-week" role="tabpanel" id={`week-${shown.week}`} aria-label={`Week ${shown.week}`}>
                <h3>Week {shown.week}</h3>
                <ol className="lesson-steps">
                  {shown.steps.map((item) => (
                    <StepCard key={item.id} item={item} progress={progress} onDone={toggleDone} onTick={toggleTick}
                      next={item === next} />
                  ))}
                </ol>
              </section>
            </details>
          )
        })}

        <p className="lessons-reset">
          <button className="chip" onClick={() => { if (window.confirm('Forget all lesson progress on this device?')) reset() }}>
            Forget my progress
          </button>
        </p>
      </main>
    </div>
  )
}
