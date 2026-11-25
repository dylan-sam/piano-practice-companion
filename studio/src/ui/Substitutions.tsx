// The Substitutions menu of every screen with a band (beside Practice): which chord substitutions
// the band plays (music/substitutions.ts), in which order (dragged by their handles), and when.
// The substitutes show on the sheet in a colour.

import { newRandomKeySeed } from '../engine/keyOrder'
import { NO_SUBSTITUTIONS, SUBSTITUTIONS, substitutes, substitutionOrder, withOrder, withTicked, type SubstitutionSettings, type SubstitutionWhen } from '../music/substitutions'
import type { PracticeSettings } from '../music/practice'
import { Popover } from './Popover'
import { useDragReorder } from './useDragReorder'

// The When menu: its choices, the chorus to start from kept apart
const WHEN_KINDS: { kind: SubstitutionWhen['kind']; label: string }[] = [
  { kind: 'always', label: 'Every chorus' },
  { kind: 'from', label: 'From a chorus on' },
  { kind: 'alternate', label: 'Every other chorus (2nd, 4th...)' },
  { kind: 'random', label: 'Here and there, at random' },
]
const MAX_FROM = 12

/** The When choice as a setting. */
function whenOf(kind: SubstitutionWhen['kind'], from: number): SubstitutionWhen {
  return kind === 'from' ? { kind, chorus: from } : { kind } as Exclude<SubstitutionWhen, { kind: 'from' }>
}

/** The Substitutions button and its panel: the substitutions of a screen's practice settings. */
export function Substitutions({ practice, onChange: onPractice }: {
  practice: PracticeSettings
  onChange: (next: PracticeSettings) => void
}) {
  const settings = practice.subs
  const current = settings ?? NO_SUBSTITUTIONS
  /** The practice settings with new substitutions. */
  const onChange = (subs: SubstitutionSettings) => onPractice({ ...practice, subs })
  const from = current.when.kind === 'from' ? current.when.chorus : 2
  const reorder = useDragReorder(substitutionOrder(current), (order) => onChange(withOrder(current, order)))

  return (
    <Popover
      id="substitutions"
      className="practice substitutions"
      active={substitutes(settings)}
      label={
        <>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M2 5h9M8 2l3 3-3 3M14 11H5M8 8l-3 3 3 3" />
          </svg>
          Substitutions
        </>
      }
    >
      {() => (
        <div className="practice-panel substitutions-panel">
          <div className="practice-row">
            <span className="label" id="subs-list-label">Play instead of the written chords, top first</span>
            <ol className="substitutions-list" ref={reorder.listRef} aria-labelledby="subs-list-label">
              {reorder.order.map((id, i) => {
                const s = SUBSTITUTIONS.find((sub) => sub.id === id)!
                return (
                  <li key={id} data-reorder-row className={`substitution${reorder.dragging === i ? ' dragging' : ''}`}>
                    <button type="button" className="reorder-handle" aria-label={`Move ${s.name} (drag, or the arrow keys)`}
                      title="Drag to change the order" {...reorder.handle(i)}>
                      <svg viewBox="0 0 10 16" aria-hidden="true">
                        <circle cx="3" cy="3" r="1.3" /><circle cx="7" cy="3" r="1.3" /><circle cx="3" cy="8" r="1.3" />
                        <circle cx="7" cy="8" r="1.3" /><circle cx="3" cy="13" r="1.3" /><circle cx="7" cy="13" r="1.3" />
                      </svg>
                    </button>
                    <label className="check">
                      <input type="checkbox" checked={current.ids.includes(id)} onChange={(e) => onChange(withTicked(current, id, e.target.checked))} />
                      <span>
                        <span className="substitution-name">{i + 1}. {s.name}</span>
                        <span className="substitution-roman">{s.roman}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ol>
          </div>
          <label className="practice-row">
            <span className="label">When</span>
            <select className="select" value={current.when.kind}
              onChange={(e) => onChange({ ...current, when: whenOf(e.target.value as SubstitutionWhen['kind'], from),
                ...(e.target.value === 'random' ? { seed: newRandomKeySeed() } : {}) })}>
              {WHEN_KINDS.map((w) => <option key={w.kind} value={w.kind}>{w.label}</option>)}
            </select>
          </label>
          {current.when.kind === 'from' && (
            <div className="practice-row">
              <span className="label" id="subs-from-label">From chorus</span>
              <div className="stepper" role="group" aria-labelledby="subs-from-label">
                <button aria-label="Earlier chorus" disabled={from <= 2} onClick={() => onChange({ ...current, when: whenOf('from', from - 1) })}>−</button>
                <output className="stepper-value">{from}</output>
                <button aria-label="Later chorus" disabled={from >= MAX_FROM} onClick={() => onChange({ ...current, when: whenOf('from', from + 1) })}>+</button>
              </div>
            </div>
          )}
          <p className="practice-unit">
            The ticked substitutions are applied from the top down, meaning for example that the 2nd chosen
            substitution will apply to the chord chart created by the first substitution. Drag to reorder. On a lead
            sheet, a substitution under a long melody note is not performed if the new chord clashes with the note.
            The substitutes show in blue on the sheet.
          </p>
        </div>
      )}
    </Popover>
  )
}
