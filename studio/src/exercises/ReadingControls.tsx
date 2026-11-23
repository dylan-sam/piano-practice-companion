// The controls shared by the melody reading screens: how notes are judged (in the Scoring button
// of the bottom bar), the sheet with its score line, and the MIDI keyboard button.

import type { useMidiKeyboard } from '../audio/useMidiKeyboard'
import type { Bar } from '../engine/timeline'
import type { Chart } from '../music/chart'
import { prettyNoteName } from '../music/chords'
import type { StyleDefinition } from '../styles/types'
import { LeadSheet } from '../ui/LeadSheet'
import { Popover } from '../ui/Popover'
import type { useLoopPicking } from '../ui/useLoopPicking'
import { accuracy, averageOffsetMs, CHECK_MODES, checksChords, checksMelody, type CheckMode, type NoteResult, type Strictness } from './melodyReading'
import { checkMode, type ReadingSettings } from './useMelodyJudging'
import type { ReadingScore } from './readingText'
import { TONE_COLORS } from './toneColors'

/** The controls of how notes are judged: what is checked, timing window, any octave. */
export function ReadingControls({ settings, onChange }: {
  settings: ReadingSettings
  onChange: (change: Partial<ReadingSettings>) => void
}) {
  return (
    <>
      <label className="control"><span className="label">Check</span>
        <select className="select" value={checkMode(settings)}
          onChange={(event) => onChange({ check: event.target.value as CheckMode })}>
          {CHECK_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.text}</option>)}
        </select>
      </label>
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
    </>
  )
}

/**
 * The Scoring button of the bottom bar, next to Practice and Mixer: what is checked (melody,
 * chords or both) and how (timing window, any octave). It keeps the page for the sheet, which
 * matters most on phones held sideways.
 */
export function ReadingPopover({ settings, onChange }: {
  settings: ReadingSettings
  onChange: (change: Partial<ReadingSettings>) => void
}) {
  // A dot on the button when a setting differs from the usual one
  const active = settings.strictness !== 'normal' || !settings.anyOctave || checkMode(settings) !== 'melody'
  return (
    <Popover id="reading" className="reading" active={active} title="What is scored (melody, chords or both) and how: timing window, any octave" label={
      <>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 12.5V3l7-1.5V11" />
          <circle cx="4.5" cy="12.5" r="1.8" />
          <circle cx="11.5" cy="11" r="1.8" />
        </svg>
        Scoring
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

/**
 * The running score: for the melody, right, wrong and missed notes, extra keys, the percentage
 * and the average timing; for the chords, those played and missed; improvising, how many keys
 * of each colour and the last keys played, coloured.
 */
export function MelodyScoreLine({ reading, bpm }: { reading: ReadingScore; bpm: number }) {
  const { checking, score, total, chordScore, chordTotal } = reading
  const percent = accuracy(score)
  const offset = averageOffsetMs(score, bpm)
  const judged = score.correct + score.wrong + score.missed
  const chordsJudged = chordScore.correct + chordScore.missed
  return (
    <p className="melody-score" role="status" aria-label="Score">
      {checksMelody(checking) && <>
        <span><strong className="score-correct">{score.correct}</strong> right</span>
        <span><strong className="score-wrong">{score.wrong}</strong> wrong note</span>
        <span><strong className="score-missed">{score.missed}</strong> missed</span>
        <span><strong>{score.extra}</strong> extra keys</span>
        {percent !== null && <span><strong>{percent} %</strong> of {judged}{total ? ` / ${total}` : ''} notes</span>}
        {offset !== null && <span>timing <strong>{offset > 0 ? `${offset} ms late` : offset < 0 ? `${-offset} ms early` : 'on time'}</strong> on average</span>}
      </>}
      {checksChords(checking) && <>
        <span><strong className="score-correct">{chordScore.correct}</strong> chords played</span>
        <span><strong className="score-missed">{chordScore.missed}</strong> chords missed</span>
        {chordsJudged > 0 && <span><strong>{Math.round((chordScore.correct / chordsJudged) * 100)} %</strong> of {chordsJudged}{chordTotal ? ` / ${chordTotal}` : ''} chords</span>}
      </>}
      {checking === 'improvise' && <ToneColorsLine tones={reading.tones} recent={reading.recent} />}
    </p>
  )
}

/**
 * Improvising: how many keys landed on each kind of note (with their share), then the last keys
 * played, each in its colour.
 *
 *   12 chord tones 50 %  6 colour tones 25 %  5 approach tones 21 %  1 outside 4 %   E G Bb A ...
 */
function ToneColorsLine({ tones, recent }: Pick<ReadingScore, 'tones' | 'recent'>) {
  const played = TONE_COLORS.reduce((sum, kind) => sum + tones[kind.id], 0)
  return (
    <>
      {TONE_COLORS.map((kind) => (
        <span key={kind.id} title={kind.help}>
          <strong className={`tone-${kind.id}`}>{tones[kind.id]}</strong> {kind.label}
          {played > 0 && <> {Math.round((tones[kind.id] / played) * 100)} %</>}
        </span>
      ))}
      {recent.length > 0 && (
        <span className="tone-recent" aria-label="Last keys played">
          {recent.map((tone) => <strong key={tone.id} className={`tone-${tone.color}`}>{prettyNoteName(tone.pitch % 12)}</strong>)}
        </span>
      )}
    </>
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

/**
 * The sheet being read: the lead sheet with the bar being played and the judged notes and chords, a loop
 * being picked on it, then the score line and how to play (`hint`).
 */
export function ReadingSheet({ chart, style, transpose, position, beat, playing, loopPicking, loop, feedback, chordFeedback, reading, bpm, hint }: {
  chart: Chart
  style: StyleDefinition
  transpose: number
  position: Bar | null // the bar sounding now
  beat: number
  playing: boolean
  loopPicking: ReturnType<typeof useLoopPicking>
  loop: [number, number] | null // the Practice loop
  feedback: Record<string, NoteResult>
  chordFeedback: Record<string, 'correct' | 'missed'>
  reading: ReadingScore
  bpm: number
  hint: string
}) {
  const first = loopPicking.firstBar
  return (
    <>
      <LeadSheet chart={chart} style={style} transpose={transpose}
        activeMeasure={position && position.measure >= 0 ? position.measure : null}
        beatInBar={position ? beat - position.start : 0} barBeats={position?.beats ?? 4}
        range={first !== null ? [first, first] : loop}
        onBarClick={loopPicking.picking ? loopPicking.chooseBar : undefined} autoScroll={playing}
        noteFeedback={feedback} chordFeedback={chordFeedback} />
      <MelodyScoreLine reading={reading} bpm={bpm} />
      <p className="sight-hint">{hint}</p>
    </>
  )
}
