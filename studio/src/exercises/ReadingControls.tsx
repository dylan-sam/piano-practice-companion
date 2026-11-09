// The controls shared by the melody reading screens: how notes are judged (in the Reading button
// of the bottom bar), the score line and the MIDI keyboard button.

import type { useMidiKeyboard } from '../audio/useMidiKeyboard'
import { Popover } from '../ui/Popover'
import { accuracy, averageOffsetMs, type MelodyScore, type Strictness } from './melodyReading'
import type { ReadingSettings } from './useMelodyJudging'

/** The controls of how notes are judged: timing window, any octave, guide melody. */
export function ReadingControls({ settings, onChange }: {
  settings: ReadingSettings
  onChange: (change: Partial<ReadingSettings>) => void
}) {
  return (
    <>
      <label className="control"><span className="label">Timing</span>
        <select className="select" value={settings.strictness}
          onChange={(event) => onChange({ strictness: event.target.value as Strictness })}>
          <option value="easy">Easy (within 0.4 beat)</option>
          <option value="normal">Normal (within 1/4 beat)</option>
          <option value="strict">Strict (within 1/8 beat)</option>
        </select>
      </label>
      <button className="chip" aria-pressed={settings.anyOctave} onClick={() => onChange({ anyOctave: !settings.anyOctave })}
        title="Count a note played in another octave than written">
        Any octave: {settings.anyOctave ? 'On' : 'Off'}
      </button>
      <button className="chip" aria-pressed={settings.guide} onClick={() => onChange({ guide: !settings.guide })}
        title="The band also plays the melody, to follow along">
        Guide melody: {settings.guide ? 'On' : 'Off'}
      </button>
    </>
  )
}

/**
 * The Reading button of the bottom bar, next to Practice and Mixer: how notes are judged. It keeps
 * the page for the sheet, which matters most on phones held sideways.
 */
export function ReadingPopover({ settings, onChange }: {
  settings: ReadingSettings
  onChange: (change: Partial<ReadingSettings>) => void
}) {
  // A dot on the button when a setting differs from the usual one
  const active = settings.strictness !== 'normal' || !settings.anyOctave || settings.guide
  return (
    <Popover id="reading" className="reading" active={active} title="How notes are judged" label={
      <>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 12.5V3l7-1.5V11" />
          <circle cx="4.5" cy="12.5" r="1.8" />
          <circle cx="11.5" cy="11" r="1.8" />
        </svg>
        Reading
      </>
    }>
      {() => (
        <div className="practice-panel reading-panel">
          <ReadingControls settings={settings} onChange={onChange} />
        </div>
      )}
    </Popover>
  )
}

/** The running score: right, wrong and missed notes, extra keys, the percentage and the average timing. */
export function MelodyScoreLine({ score, total, bpm }: { score: MelodyScore; total: number; bpm: number }) {
  const percent = accuracy(score)
  const offset = averageOffsetMs(score, bpm)
  const judged = score.correct + score.wrong + score.missed
  return (
    <p className="melody-score" role="status" aria-label="Score">
      <span><strong className="score-correct">{score.correct}</strong> right</span>
      <span><strong className="score-wrong">{score.wrong}</strong> wrong note</span>
      <span><strong className="score-missed">{score.missed}</strong> missed</span>
      <span><strong>{score.extra}</strong> extra keys</span>
      {percent !== null && <span><strong>{percent} %</strong> of {judged}{total ? ` / ${total}` : ''} notes</span>}
      {offset !== null && <span>timing <strong>{offset > 0 ? `${offset} ms late` : offset < 0 ? `${-offset} ms early` : 'on time'}</strong> on average</span>}
    </p>
  )
}

/** The MIDI keyboard button of the top bar: connect, waiting, or the connected devices. */
export function MidiButton({ keyboard }: { keyboard: ReturnType<typeof useMidiKeyboard> }) {
  return (
    <button className="topbar-button" onClick={() => void keyboard.connect()} disabled={keyboard.connected}
      aria-label={keyboard.connected ? undefined : 'Connect MIDI keyboard'}>
      {keyboard.connected ? keyboard.devices.length ? keyboard.devices.join(', ')
        : <>Waiting for<span className="topbar-long"> MIDI</span> keyboard</>
        : <>Connect<span className="topbar-long"> MIDI keyboard</span><span className="topbar-short"> MIDI</span></>}
    </button>
  )
}
