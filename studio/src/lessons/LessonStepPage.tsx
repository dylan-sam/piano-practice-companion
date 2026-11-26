// A lesson step's page, opened by its Start button (Lessons tab, Today's lesson): what to do and
// when it is done, why, the music theory behind it with staves and progressions (theory.ts), the
// song's scale ideas for an improvising step, the self-check, and the books it comes from. Its
// "Understood, start" button opens the exercise, set up for the step; the exercise's back button
// and top-bar title come back here (router.ts backRoute).

import { useEffect, useState } from 'react'
import { navigate, ROUTES } from '../router'
import { Wordmark } from '../ui/AppLink'
import { Icon } from '../ui/Icon'
import { noteName, prettyNoteName } from '../music/chords'
import { lessonUrl } from './lessonLink'
import { ALL_STEPS, placeOf, type LessonStep } from './program'
import { ScaleMapCard } from './ScaleMap'
import { scaleMapFor } from './scaleMaps'
import { KIND_ICONS, KIND_LABELS } from './stepKinds'
import { referencesOf, theoryFor } from './theory'
import { TheoryCardView } from './TheoryPictures'
import { stopListening } from './listen'
import { transposeFor } from './theoryMusic'
import { rememberStep, useLessonProgress } from './useLessonProgress'

/** The step named by the page's address (?id=), or undefined. */
function stepOfUrl(): LessonStep | undefined {
  const id = new URLSearchParams(window.location.search).get('id')
  return ALL_STEPS.find((item) => item.id === id)
}

/** The page. */
export function LessonStepPage() {
  const step = stepOfUrl()
  const { progress, markDone, toggleTick } = useLessonProgress()
  // The key the theory's pictures are drawn in (the step's key first), with chord names or Roman numerals
  const [keyPc, setKeyPc] = useState<number | null>(null)
  const [roman, setRoman] = useState(false)
  // The Lessons tab shows this step again when it is opened next
  useEffect(() => {
    if (step) rememberStep(step.id)
  }, [step])
  // Leaving the page stops an example playing
  useEffect(() => stopListening, [])

  if (!step) {
    return (
      <div className="app lessons">
        <header className="topbar"><Wordmark>Lessons</Wordmark><span className="topbar-spacer" /></header>
        <main className="lessons-page lesson-page">
          <h1>This step is not in the lessons</h1>
          <p><button className="button button-primary" onClick={() => navigate(ROUTES.lessons)}>Back to the lessons</button></p>
        </main>
      </div>
    )
  }

  const place = placeOf(step)
  const done = progress.done.includes(step.id)
  const ticked = progress.ticked[step.id] ?? []
  const cards = theoryFor(step)
  const map = step.kind === 'improvise' && step.link?.song ? scaleMapFor(step.link.song) : undefined
  const references = referencesOf(step)
  const pictureKey = keyPc ?? step.link?.key ?? 0
  const view = { keyPc: pictureKey, transpose: transposeFor(pictureKey), roman }
  const where = place ? `${place.unit.number ? `Unit ${place.unit.number}` : place.unit.title} · Week ${place.week}` : ''

  return (
    <div className="app lessons">
      <header className="topbar">
        <Wordmark>Lessons</Wordmark>
        <span className="topbar-spacer" />
      </header>
      <main className={`lessons-page lesson-page lesson-step-${step.kind}`}>
        <header className="lesson-page-head">
          <span className="lesson-step-icon" aria-hidden="true"><Icon name={done ? 'check' : KIND_ICONS[step.kind]} /></span>
          <div>
            <span className="lesson-kind">{where} · {KIND_LABELS[step.kind]}</span>
            <h1>{step.title}</h1>
          </div>
        </header>

        <section className="lesson-panel" aria-labelledby="lesson-todo">
          <h2 id="lesson-todo">What to do</h2>
          <p className="lesson-what">{step.what}</p>
          <dl className="lesson-meta">
            <div><dt>Done when</dt><dd>{step.done}</dd></div>
            <div><dt>How long</dt><dd>{step.minutes[0]} to {step.minutes[1]} minutes</dd></div>
            {step.link?.bpm && <div><dt>Tempo</dt><dd>{step.link.bpm} BPM (start slower if you need to)</dd></div>}
            {step.link?.key !== undefined && <div><dt>Key</dt><dd>{noteName(step.link.key, true)}</dd></div>}
          </dl>
        </section>

        <section className="lesson-panel" aria-labelledby="lesson-why">
          <h2 id="lesson-why">Why</h2>
          <p>{step.why}</p>
        </section>

        {cards.length > 0 && <section className="lesson-theory" aria-labelledby="lesson-theory">
          <div className="lesson-theory-head">
            <h2 id="lesson-theory">The theory</h2>
            <label className="lesson-theory-key">
              Key
              <select className="select" value={pictureKey} onChange={(e) => setKeyPc(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, pc) => <option key={pc} value={pc}>{prettyNoteName(pc)}</option>)}
              </select>
            </label>
            <div className="lesson-theory-names" role="group" aria-label="Chords written as">
              <button className="chip" aria-pressed={!roman} onClick={() => setRoman(false)}>Chord names</button>
              <button className="chip" aria-pressed={roman} onClick={() => setRoman(true)}>Roman numerals</button>
            </div>
          </div>
          {pictureKey !== 0 && <p className="sight-hint">The text names the notes in C; the pictures are in {prettyNoteName(pictureKey)}.</p>}
          {cards.map((card) => <TheoryCardView key={card.id} card={card} view={view} />)}
        </section>}

        {map && <ScaleMapCard map={map} keyPc={step.link?.key ?? map.tonic} />}

        {step.selfCheck && <section className="lesson-panel" aria-labelledby="lesson-check">
          <h2 id="lesson-check">Check yourself</h2>
          <ul className="lesson-checks" aria-label="Self-check">
            {step.selfCheck.map((text, box) => (
              <li key={text}>
                <label><input type="checkbox" checked={ticked.includes(box)} onChange={() => toggleTick(step.id, box)} /> {text}</label>
              </li>
            ))}
          </ul>
        </section>}

        <div className="lesson-page-actions">
          {step.link && <button className="button button-primary" onClick={() => navigate(lessonUrl(step.link!))}>
            <Icon name="start" /> Understood, start
          </button>}
          <button className="chip" aria-pressed={done} onClick={() => markDone(step.id)}>{done ? 'Done' : 'Mark done'}</button>
          <button className="chip" onClick={() => navigate(ROUTES.lessons)}>Back to the lessons</button>
        </div>

        {references.length > 0 && <section className="lesson-refs" aria-labelledby="lesson-refs">
          <h2 id="lesson-refs">References</h2>
          <ul>{references.map((source) => <li key={source}>{source}</li>)}</ul>
        </section>}
      </main>
    </div>
  )
}
