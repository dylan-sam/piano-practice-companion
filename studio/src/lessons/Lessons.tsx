// The Lessons tab: a 30-week program for pianists new to jazz (program.ts), unit by unit and week
// by week. Each step says what to do, why, how long and when it is done, and its Start button
// opens the screen that practises it, set up for the step. Progress is kept on this device and
// only suggests the next step: any step can be opened at any time.

import { navigate } from '../router'
import { Wordmark } from '../ui/AppLink'
import { lessonUrl } from './lessonLink'
import { ALL_STEPS, PROGRAM, type LessonStep, type StepKind } from './program'
import { nextStep, useLessonProgress, type LessonProgress } from './useLessonProgress'

// The name of each part of a session, on its steps
const KIND_LABELS: Record<StepKind, string> = {
  hands: 'Hands together', listen: 'Listen', song: 'The song', improvise: 'Improvise', ear: 'Ear', check: 'Self-check',
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
  const next = nextStep(ALL_STEPS, progress)
  const doneCount = ALL_STEPS.filter((item) => progress.done.includes(item.id)).length

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
            Nothing is locked: open any step at any time. Targets are a tempo and a key, never "mastered"; take the time you
            need, and go back to earlier units at faster tempos. Your progress is kept on this device.
          </p>
          <p className="lessons-progress">{doneCount} of {ALL_STEPS.length} steps done.</p>
          {next && <p className="lessons-next">
            Next: <a href={`#${next.id}`}>{next.title}</a>
            {next.link && <> <button className="button button-primary" onClick={() => navigate(lessonUrl(next.link!))}>Start</button></>}
          </p>}
        </section>

        {PROGRAM.map((unit) => {
          const steps = unit.weekList.flatMap((week) => week.steps)
          const unitDone = steps.filter((item) => progress.done.includes(item.id)).length
          const holdsNext = !!next && steps.includes(next)
          return (
            <details key={unit.id} className="lesson-unit" open={holdsNext}>
              <summary>
                <span className="lesson-unit-title">{unit.id === 'review' ? unit.title : `Unit ${unit.id.slice(1)}. ${unit.title}`}</span>
                <span className="lesson-unit-weeks">{unit.weeks} · {unitDone} of {steps.length} done</span>
              </summary>
              <p><strong>Goal:</strong> {unit.goal}</p>
              <p className="sight-hint">Source: {unit.source}</p>
              {unit.weekList.map((week) => (
                <section key={week.week} className="lesson-week" aria-label={`Week ${week.week}`}>
                  <h3>Week {week.week}</h3>
                  <ol className="lesson-steps">
                    {week.steps.map((item) => (
                      <StepCard key={item.id} item={item} progress={progress} onDone={toggleDone} onTick={toggleTick}
                        next={item === next} />
                    ))}
                  </ol>
                </section>
              ))}
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
