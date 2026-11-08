import type { Chart } from '../music/chart'
import { KEY_STEPS, sections, type PracticeSettings } from '../music/practice'
import { Popover } from './Popover'

// Label of a loop's bar range
const barRange = ([a, b]: [number, number]) => (a === b ? `Bar ${a + 1}` : `Bars ${a + 1}–${b + 1}`)

interface PracticeProps {
  chart: Chart
  settings: PracticeSettings
  onChange: (next: PracticeSettings) => void
  onPickLoop: () => void
}

// The Practice panel: loop, going round the keys and tempo ramp
export function Practice({ chart, settings, onChange, onPickLoop }: PracticeProps) {
  const active = settings.loop !== null || settings.keyStep !== 0 || settings.ramp !== 0
  const marks = sections(chart)

  return (
    <Popover
      id="practice"
      className="practice"
      active={active}
      label={
        <>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 6a5 5 0 0 1 9-2M13 10a5 5 0 0 1-9 2" />
            <path d="M12.5 1.5v3h-3M3.5 14.5v-3h3" />
          </svg>
          Practice
        </>
      }
    >
      {(close) => (
        <div className="practice-panel">
          <div className="practice-row">
            <span className="label">Loop</span>
            <div className="practice-loop">
              {settings.loop ? (
                <>
                  <span className="practice-value">{barRange(settings.loop)}</span>
                  <button className="chip" onClick={() => onChange({ ...settings, loop: null })}>
                    Clear
                  </button>
                </>
              ) : (
                <span className="practice-value practice-off">Whole tune</span>
              )}
              <button
                className="chip"
                onClick={() => {
                  close()
                  onPickLoop()
                }}
              >
                Choose bars
              </button>
            </div>
            {marks.length > 1 && (
              <div className="practice-sections">
                {marks.map((s) => {
                  const on = settings.loop?.[0] === s.from && settings.loop?.[1] === s.to
                  return (
                    <button
                      key={s.from}
                      className="chip"
                      aria-pressed={on}
                      title={barRange([s.from, s.to])}
                      onClick={() => onChange({ ...settings, loop: on ? null : [s.from, s.to] })}
                    >
                      {s.name}
                      <span className="chip-meta">{s.from + 1}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <label className="practice-row">
            <span className="label">Keys</span>
            <select
              className="select"
              value={settings.keyStep}
              onChange={(e) => onChange({ ...settings, keyStep: Number(e.target.value) })}
            >
              {KEY_STEPS.map((k) => (
                <option key={k.step} value={k.step}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>

          <div className="practice-row">
            <span className="label" id="ramp-label">
              Speed up
            </span>
            <div className="stepper" role="group" aria-labelledby="ramp-label">
              <button aria-label="Less" disabled={settings.ramp <= 0} onClick={() => onChange({ ...settings, ramp: settings.ramp - 2 })}>
                −
              </button>
              <output className="stepper-value">+{settings.ramp}</output>
              <button aria-label="More" disabled={settings.ramp >= 20} onClick={() => onChange({ ...settings, ramp: settings.ramp + 2 })}>
                +
              </button>
              <span className="practice-unit">bpm each chorus</span>
            </div>
          </div>
        </div>
      )}
    </Popover>
  )
}
