import { useEffect, useRef, useState } from 'react'
import { type Chart, type ChartBar, type TimeSignature } from '../music/chart'
import { keyPrefersFlats, noteName } from '../music/chords'
import { deleteBar, insertBar, setTime, timeAt, updateBar } from '../music/edit'
import { barToInput, parseBarInput } from '../music/notation'
import { STYLES } from '../styles'

const TIMES: TimeSignature[] = [
  [4, 4],
  [3, 4],
  [2, 4],
  [5, 4],
  [6, 4],
  [6, 8],
  [12, 8],
]

const SECTIONS = ['A', 'B', 'C', 'D', 'i', 'v']
const DIRECTIVES = ['Fine', 'D.C. al Fine', 'D.C. al Coda', 'D.S. al Fine', 'D.S. al Coda']

// Whether two time signatures are the same
const sameTime = (a: TimeSignature, b: TimeSignature) => a[0] === b[0] && a[1] === b[1]

// Title and composer, written on the sheet itself
export function EditorHeader({ chart, onChange }: { chart: Chart; onChange: (c: Chart) => void }) {
  return (
    <header className="sheet-head sheet-head-edit">
      <span className="sheet-meta">({STYLES.find((s) => s.id === chart.style)?.name})</span>
      <input
        className="sheet-title sheet-input"
        aria-label="Title"
        placeholder="Title"
        value={chart.title}
        onChange={(e) => onChange({ ...chart, title: e.target.value })}
      />
      <input
        className="sheet-meta sheet-meta-right sheet-input"
        aria-label="Composer"
        placeholder="Composer"
        value={chart.composer ?? ''}
        onChange={(e) => onChange({ ...chart, composer: e.target.value || undefined })}
      />
    </header>
  )
}

interface EditorProps {
  chart: Chart
  onChange: (chart: Chart) => void
  selected: number
  onSelect: (index: number) => void
  saveLabel: string
  canDelete: boolean
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
}

// Edit a chart's bars: chords, time signature, sections, repeats and endings
export function Editor({ chart, onChange, selected, onSelect, saveLabel, canDelete, onSave, onCancel, onDelete }: EditorProps) {
  const index = Math.min(selected, chart.bars.length - 1)
  const bar = chart.bars[index]
  const time = timeAt(chart, index)
  const [text, setText] = useState(() => barToInput(bar.chords, time))
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // A newly selected bar shows its chords and takes the keyboard
  const shownBar = useRef(-1)
  useEffect(() => {
    if (shownBar.current === index) return
    shownBar.current = index
    setText(barToInput(chart.bars[index].chords, timeAt(chart, index)))
    setError('')
    inputRef.current?.focus({ preventScroll: true })
    document.querySelector('.bar-selected')?.scrollIntoView({ block: 'nearest' })
  }, [index, chart])

  // Change the selected bar
  const patch = (p: Partial<ChartBar>) => onChange(updateBar(chart, index, p))

  // Set the selected bar's chords from typed text
  const typeChords = (value: string) => {
    setText(value)
    const result = parseBarInput(value, time)
    if (result.ok) {
      setError('')
      onChange(updateBar(chart, index, { chords: result.chords }))
    } else setError(result.error)
  }

  // Select another bar
  const go = (to: number) => {
    if (to >= chart.bars.length) {
      onChange(insertBar(chart, chart.bars.length - 1))
      onSelect(chart.bars.length)
    } else onSelect(Math.max(0, to))
  }

  const sign = bar.segno ? 'segno' : bar.coda ? 'coda' : ''
  const barline = bar.repeatEnd ? 'repeat' : (bar.barline ?? '')

  return (
    <section className="editor" aria-label="Chart editor">
      <div className="editor-row">
        <div className="editor-nav">
          <button className="icon-button" aria-label="Previous bar" disabled={index === 0} onClick={() => go(index - 1)}>
            ‹
          </button>
          <span className="editor-barno">
            Bar {index + 1}
            <span className="editor-of">/{chart.bars.length}</span>
          </span>
          <button className="icon-button" aria-label="Next bar" onClick={() => go(index + 1)}>
            ›
          </button>
        </div>
        <div className="editor-chords">
          <input
            ref={inputRef}
            className={error ? 'editor-input editor-input-error' : 'editor-input'}
            aria-label={`Chords in bar ${index + 1}`}
            aria-invalid={!!error}
            aria-describedby="editor-hint"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="Dm7 G7"
            value={text}
            onChange={(e) => typeChords(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              go(e.shiftKey ? index - 1 : index + 1)
            }}
          />
          <span id="editor-hint" className={error ? 'editor-hint editor-hint-error' : 'editor-hint'}>
            {error || 'Enter: next bar · empty: hold the chord · NC: no chord · C:3 G7:1 sets beats'}
          </span>
        </div>
        <div className="editor-buttons">
          <button
            className="chip"
            onClick={() => {
              onChange(insertBar(chart, index))
              onSelect(index + 1)
            }}
          >
            Insert bar
          </button>
          <button
            className="chip"
            disabled={chart.bars.length <= 1}
            onClick={() => {
              onChange(deleteBar(chart, index))
              onSelect(Math.max(0, Math.min(index, chart.bars.length - 2)))
              shownBar.current = -1
            }}
          >
            Delete bar
          </button>
        </div>
      </div>

      <div className="editor-row editor-marks">
        <label className="field">
          <span className="label">Section</span>
          <select className="select" value={bar.section ?? ''} onChange={(e) => patch({ section: e.target.value || undefined })}>
            <option value="">–</option>
            {SECTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'i' ? 'Intro' : s === 'v' ? 'Verse' : s}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Start</span>
          <select
            className="select"
            value={bar.repeatStart ? 'repeat' : ''}
            onChange={(e) => patch({ repeatStart: e.target.value === 'repeat' || undefined })}
          >
            <option value="">Barline</option>
            <option value="repeat">Repeat from here</option>
          </select>
        </label>
        <label className="field">
          <span className="label">End</span>
          <select
            className="select"
            value={barline}
            onChange={(e) => {
              const v = e.target.value
              patch({
                repeatEnd: v === 'repeat' || undefined,
                barline: v === 'double' || v === 'final' ? v : undefined,
                repeatTimes: v === 'repeat' ? bar.repeatTimes : undefined,
              })
            }}
          >
            <option value="">Barline</option>
            <option value="double">Double barline</option>
            <option value="final">Final barline</option>
            <option value="repeat">Repeat back</option>
          </select>
        </label>
        {bar.repeatEnd && (
          <label className="field">
            <span className="label">Times</span>
            <select
              className="select"
              value={bar.repeatTimes ?? 2}
              onChange={(e) => patch({ repeatTimes: Number(e.target.value) === 2 ? undefined : Number(e.target.value) })}
            >
              {[2, 3, 4, 5, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {n}×
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span className="label">Ending</span>
          <select className="select" value={bar.ending ?? ''} onChange={(e) => patch({ ending: Number(e.target.value) || undefined })}>
            <option value="">–</option>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}.
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Sign</span>
          <select
            className="select"
            value={sign}
            onChange={(e) => patch({ segno: e.target.value === 'segno' || undefined, coda: e.target.value === 'coda' || undefined })}
          >
            <option value="">–</option>
            <option value="segno">Segno</option>
            <option value="coda">Coda</option>
          </select>
        </label>
        <label className="field">
          <span className="label">Jump</span>
          <select className="select" value={bar.directive ?? ''} onChange={(e) => patch({ directive: e.target.value || undefined })}>
            <option value="">–</option>
            {DIRECTIVES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            {bar.directive && !DIRECTIVES.includes(bar.directive) && <option value={bar.directive}>{bar.directive}</option>}
          </select>
        </label>
        <label className="field field-text">
          <span className="label">Text</span>
          <input className="text-input" value={bar.comment ?? ''} onChange={(e) => patch({ comment: e.target.value || undefined })} />
        </label>
        <label className="check">
          <input type="checkbox" checked={!!bar.fermata} onChange={(e) => patch({ fermata: e.target.checked || undefined })} />
          Fermata
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={index === 0 || !!bar.rowStart}
            disabled={index === 0}
            onChange={(e) => patch({ rowStart: e.target.checked || undefined })}
          />
          New line
        </label>
      </div>

      <div className="editor-row editor-tune">
        <label className="field">
          <span className="label">Key</span>
          <span className="field-pair">
            <select className="select" value={chart.key} onChange={(e) => onChange({ ...chart, key: Number(e.target.value) })}>
              {Array.from({ length: 12 }, (_, pc) => (
                <option key={pc} value={pc}>
                  {noteName(pc, keyPrefersFlats(pc))}
                </option>
              ))}
            </select>
            <select
              className="select"
              aria-label="Mode"
              value={chart.minor ? 'minor' : 'major'}
              onChange={(e) => onChange({ ...chart, minor: e.target.value === 'minor' || undefined })}
            >
              <option value="major">major</option>
              <option value="minor">minor</option>
            </select>
          </span>
        </label>
        <label className="field">
          <span className="label">Time</span>
          <select
            className="select"
            value={chart.time.join('/')}
            onChange={(e) => {
              const t = TIMES.find((x) => x.join('/') === e.target.value)
              if (t && !sameTime(t, chart.time)) onChange(setTime(chart, t))
            }}
          >
            {TIMES.map((t) => (
              <option key={t.join('/')} value={t.join('/')}>
                {t.join('/')}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Style</span>
          <select
            className="select"
            value={chart.style}
            onChange={(e) => onChange({ ...chart, style: e.target.value, sourceStyle: undefined })}
          >
            {STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="label">Tempo</span>
          <input
            className="text-input text-input-number"
            type="number"
            min={40}
            max={300}
            value={chart.bpm}
            onChange={(e) => onChange({ ...chart, bpm: Math.max(40, Math.min(300, Number(e.target.value) || 120)) })}
          />
        </label>

        <span className="editor-spacer" />
        {canDelete && (
          <button
            className={confirmDelete ? 'chip chip-danger' : 'chip'}
            onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
            onBlur={() => setConfirmDelete(false)}
          >
            {confirmDelete ? 'Delete tune?' : 'Delete tune'}
          </button>
        )}
        <button className="chip" onClick={onCancel}>
          Cancel
        </button>
        <button className="chip chip-primary" onClick={onSave}>
          {saveLabel}
        </button>
      </div>
    </section>
  )
}
