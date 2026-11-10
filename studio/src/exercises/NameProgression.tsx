import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Player } from '../audio/player'
import { useHeardBeat, usePlayer } from '../audio/usePlayer'
import { useMixer } from '../audio/useMixer'
import { Mixer } from '../ui/Mixer'
import { Popover } from '../ui/Popover'
import { TopbarMenu } from '../ui/TopbarMenu'
import { DisplayOptions } from '../ui/DisplayMenu'
import { useDisplayChanged } from '../ui/display'
import { arrange, BASE_BPM } from '../engine/arrange'
import { defaultPatternForStyle, patternsForStyle, PIANO_PATTERNS } from '../engine/pianoPatterns'
import type { Timeline } from '../engine/timeline'
import { warmUpMidi } from '../engine/warmup'
import { loadJson, saveJson } from '../library/storage'
import { offsetToKey, prettyNoteName } from '../music/chords'
import { getStyle, STYLES } from '../styles'
import type { Chart as ChartData } from '../music/chart'
import { Chart } from '../ui/Chart'
import { Wordmark } from '../ui/AppLink'
import { Transport } from '../ui/Transport'
import {
  accuracy, BANK_URL, CUSTOM_LEVEL, keyReferenceMidi, keyReferences, LEVELS, levelName, levelProgressions, measureAt, MIN_CUSTOM,
  mistakeWeight, mostConfused, nextLevel, playable,
  PASS_MARK, pickQuestion, questionChart, questionId, recordAnswer, ROUND_LENGTH, type KeyReference,
  transposeFor, withProgression, type Asked, type KeyChoice, type QuestionBank, type Results,
} from './nameProgression'
import { NARROW_QUERY } from '../ui/useNarrowScreen'

const STORAGE = 'eartraining:name-progression'
const BPM_RANGE: [number, number] = [40, 240]
const MAX_REPEATS = 4

/** Read a setting or progress value of this exercise from the browser. */
const load = <T,>(name: string, fallback: T, valid: (value: unknown) => boolean): T =>
  loadJson(`${STORAGE}:${name}`, fallback, valid)

/** Keep a setting or progress value of this exercise in the browser. */
const save = (name: string, value: unknown) => saveJson(`${STORAGE}:${name}`, value)

// Validators for values read back from storage, which may be old or edited by hand
/** A level id of the curriculum, or the custom level. */
const isLevel = (v: unknown) => v === CUSTOM_LEVEL || LEVELS.some((level) => level.id === v)
/** A list of progression ids. */
const isIdList = (v: unknown) => Array.isArray(v) && v.every((item) => typeof item === 'string')
/** The song key, a random key, or a tonic pitch class 0-11. */
const isKeyChoice = (v: unknown) => v === 'song' || v === 'random' || (Number.isInteger(v) && (v as number) >= 0 && (v as number) < 12)

/** Whether the screen is phone-sized; phones get a long line on two rows. */
function useNarrow(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(NARROW_QUERY)
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia(NARROW_QUERY).matches,
  )
}

/** A key for display, e.g. "B-flat minor" with a typeset flat; a key without known mode shows only its tonic. */
const keyLabel = (pc: number, minor: boolean | null) =>
  `${prettyNoteName(pc)} ${minor === null ? '(major or minor)' : minor ? 'minor' : 'major'}`

// Button text of each key reference: full when both cadences are offered, short otherwise
const REFERENCE_LABELS: Record<KeyReference, { text: string; short: string }> = {
  tonic: { text: 'Tonic', short: 'Tonic' },
  'major cadence': { text: 'Major cadence (I\u2013IV\u2013V\u2013I)', short: 'Cadence' },
  'minor cadence': { text: 'Minor cadence (i\u2013iv\u2013V\u2013i)', short: 'Cadence' },
}
// Keyboard shortcuts of the offered references, in button order: tonic, cadence, minor cadence
const REFERENCE_KEYS = ['K', 'C', 'M']

type Playing = 'line' | KeyReference | null

interface Arrangement {
  styleId: string
  patternId: string | null
  transpose: number
  repeats: number
}

/** The Name the progression exercise: one question at a time, rounds of ten, levels and results. */
export function NameProgression() {
  const playerRef = useRef<Player | null>(null)
  const timelineRef = useRef<Timeline | null>(null)
  const recent = useRef(new Set<string>())

  const [bank, setBank] = useState<QuestionBank | null>(null)
  const [bankError, setBankError] = useState<string | null>(null)
  const [level, setLevel] = useState(() => load('level', LEVELS[0].id, isLevel))
  const [passed, setPassed] = useState(() => new Set(load<string[]>('passed', [], isIdList)))
  const [custom, setCustom] = useState(() => load<string[]>('custom', [], isIdList))
  const [customDraft, setCustomDraft] = useState<string[] | null>(null) // the custom picker, while open
  const [results, setResults] = useState<Results>(() => load('results', {}, (v) => typeof v === 'object' && v !== null))
  const [focus, setFocus] = useState(() => load('focus', true, (v) => typeof v === 'boolean'))
  const [hideKey, setHideKey] = useState(() => load('hide-key', false, (v) => typeof v === 'boolean'))
  const displayChanged = useDisplayChanged(false) // minor notation or % changed in the Display menu
  const [hideAllChords, setHideAllChords] = useState(() => load('hide-all-chords', false, (v) => typeof v === 'boolean'))
  const [keyChoice, setKeyChoice] = useState<KeyChoice>(() => load('key', 'song', isKeyChoice))
  const [asked, setAsked] = useState<Asked | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [listening, setListening] = useState<string | null>(null) // the progression shown in the gap after answering
  const [round, setRound] = useState({ answered: 0, correct: 0 })

  const [styleId, setStyleId] = useState('swing')
  const [patternId, setPatternId] = useState<string | null>(() => defaultPatternForStyle('swing'))
  const [transpose, setTranspose] = useState(0)
  const [bpm, setBpm] = useState(100)
  const [repeats, setRepeats] = useState(1)
  const [playing, setPlaying] = useState<Playing>(null)
  const [position, setPosition] = useState<ReturnType<typeof measureAt>>(null)
  // The sound bank, set up as in Studio
  const readiness = usePlayer(
    playerRef,
    () => {
      setPlaying(null)
      setPosition(null)
    },
    () => STYLES.map(warmUpMidi),
  )
  const mixer = useMixer(playerRef, readiness)



  const currentLevel = level
  const isCustom = level === CUSTOM_LEVEL
  const options = useMemo(() => (bank ? levelProgressions(bank, level, custom) : []), [bank, level, custom])

  /** Stop whatever is playing and clear the bar highlight. */
  const stop = useCallback(() => {
    playerRef.current?.stop()
    setPlaying(null)
    setPosition(null)
  }, [])

  // Set when a new question is asked: its line plays by itself once drawn and the sounds are ready
  const autoPlay = useRef(false)

  /** Ask a new question of a level; a custom level without enough progressions opens its picker. */
  const nextQuestion = useCallback(
    (forLevel: string, source: QuestionBank | null = bank, customIds: readonly string[] = custom) => {
      if (!source) return
      stop()
      const choices = levelProgressions(source, forLevel, customIds)
      if (choices.length < MIN_CUSTOM) {
        // A custom level with too few progressions: choose them first
        setAsked(null)
        setCustomDraft([...customIds])
        return
      }
      const weight = focus ? (p: { id: string }) => mistakeWeight(results[p.id]) : undefined
      const next = pickQuestion(choices, recent.current, Math.random, weight)
      recent.current.add(questionId(next.progression, next.question))
      autoPlay.current = true // the new line plays as soon as it is drawn
      setAsked(next)
      setAnswer(null)
      setListening(null)
      setTranspose(hideKey ? 0 : transposeFor(keyChoice, next.question))
      const style = getStyle(next.question.style)
      setStyleId(style.id)
      setPatternId(defaultPatternForStyle(style.id))
      setBpm(Math.min(style.tempo.default, 120))
    },
    [bank, stop, focus, results, keyChoice, hideKey, custom],
  )

  useEffect(() => {
    let active = true
    fetch(BANK_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load the questions (${response.status})`)
        return response.json() as Promise<QuestionBank>
      })
      .then((data) => {
        if (!active) return
        setBank(data)
        nextQuestion(load('level', LEVELS[0].id, isLevel), data)
      })
      .catch((err: unknown) => active && setBankError(String(err)))
    return () => {
      active = false
    }
    // nextQuestion is passed the bank, so the request runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const narrow = useNarrow()
  const sevenths = getStyle(styleId).family !== 'pop'
  /** The chart of the question's line, with the song's chords or another choice in the gap. */
  const lineChart = useCallback(
    (inGap: string | null): ChartData | null => {
      if (!asked) return null
      const other = inGap && inGap !== asked.progression.id ? options.find((p) => p.id === inGap) : undefined
      const line = other ? withProgression(asked.question, other, sevenths) : asked.question
      return questionChart(line, styleId, narrow ? 4 : 6)
    },
    [asked, options, sevenths, styleId, narrow],
  )
  const chart = useMemo(() => lineChart(listening), [lineChart, listening])
  const keyPc = asked ? (asked.question.key + transpose + 12) % 12 : 0

  /**
   * Play a line with the band; by default the shown line with the current arrangement. From
   * `fromSeconds` (MIDI time) it goes on where it is.
   */
  const playChart = async (line = chart, opts: Arrangement = { styleId, patternId, transpose, repeats }, fromSeconds = 0) => {
    const player = playerRef.current
    if (!player || !line || readiness.kind !== 'ready') return
    const { midi, timeline } = arrange(line, getStyle(opts.styleId), opts.transpose, opts.repeats, { ending: false }, opts.patternId)
    timelineRef.current = timeline
    await player.play(midi, fromSeconds)
    player.setRate(bpm / BASE_BPM)
    setPlaying('line')
  }

  // A new question plays its line at once, unless the browser still waits for a first tap (Play then starts it)
  useEffect(() => {
    if (!autoPlay.current || !chart || readiness.kind !== 'ready') return
    autoPlay.current = false
    if (playerRef.current?.canPlayWithoutTap) void playChart()
  })

  /** Play the tonic chord or a cadence of the current key. */
  const playReference = async (reference: KeyReference) => {
    const player = playerRef.current
    if (!player || !asked || readiness.kind !== 'ready') return
    timelineRef.current = null
    setPosition(null)
    await player.play(keyReferenceMidi(reference, keyPc, asked.question.minor, BASE_BPM))
    player.setRate(1)
    setPlaying(reference)
  }

  /**
   * Change the band or key. A new style, pattern or number of repeats leaves the line as it is,
   * so a playing line goes on from where it is; a new key starts it again.
   */
  const change = (patch: Partial<Arrangement>) => {
    const next = { styleId, patternId, transpose, repeats, ...patch }
    setStyleId(next.styleId)
    setPatternId(next.patternId)
    setTranspose(next.transpose)
    setRepeats(next.repeats)
    const from = next.transpose === transpose ? playerRef.current?.position ?? 0 : 0
    if (playing === 'line') void playChart(chart, next, from)
    else if (playing) stop()
  }

  /** Apply a key choice (song key, random or fixed) to the current question and remember it. */
  const chooseKey = (choice: KeyChoice) => {
    setKeyChoice(choice)
    save('key', choice)
    if (asked) change({ transpose: transposeFor(choice, asked.question) })
  }

  /** Hide in the song key, restarting only for a key change; reveal it without restarting. */
  const toggleHideKey = () => {
    const next = !hideKey
    setHideKey(next)
    save('hide-key', next)
    if (next) {
      if (asked && transpose !== 0) change({ transpose: 0 })
    } else {
      setKeyChoice('song')
      save('key', 'song')
    }
  }

  /** Toggle blank context chords without changing the chart used for playback. */
  const toggleHideAllChords = () => {
    const next = !hideAllChords
    setHideAllChords(next)
    save('hide-all-chords', next)
  }

  useEffect(() => {
    if (playing === 'line') playerRef.current?.setRate(bpm / BASE_BPM)
  }, [bpm, playing])

  // Follow the audio clock to highlight the current bar
  useHeardBeat(playing === 'line', playerRef, (beat) => {
    const timeline = timelineRef.current
    if (timeline) setPosition(measureAt(timeline, beat))
  })

  const roundOver = answer !== null && round.answered >= ROUND_LENGTH
  const roundPassed = roundOver && round.correct >= PASS_MARK

  /** Answer with a progression, or after answering, hear that progression in the gap. */
  const choose = (id: string) => {
    if (!asked) return
    if (answer) {
      // After answering, each choice plays in the gap so it can be compared with the song
      setListening(id)
      void playChart(lineChart(id))
      return
    }
    const correct = id === asked.progression.id
    setAnswer(id)
    setListening(asked.progression.id)
    const nextResults = recordAnswer(results, asked.progression.id, id)
    setResults(nextResults)
    save('results', nextResults)
    const result = { answered: round.answered + 1, correct: round.correct + (correct ? 1 : 0) }
    setRound(result)
    if (result.answered >= ROUND_LENGTH && result.correct >= PASS_MARK && !isCustom && !passed.has(currentLevel)) {
      const next = new Set(passed).add(currentLevel)
      setPassed(next)
      save('passed', [...next])
    }
  }

  /** Start a new round of ten questions on a level. */
  const startRound = (forLevel: string, customIds: readonly string[] = custom) => {
    setLevel(forLevel)
    save('level', forLevel)
    setCustomDraft(null)
    setRound({ answered: 0, correct: 0 })
    recent.current.clear()
    nextQuestion(forLevel, bank, customIds)
  }

  /** Save the custom selection and start training it. */
  const trainCustom = (ids: string[]) => {
    setCustom(ids)
    save('custom', ids)
    startRound(CUSTOM_LEVEL, ids)
  }

  /** Go to the next question, or to a new round after the last one. */
  const advance = () => {
    if (roundOver) startRound(currentLevel)
    else nextQuestion(currentLevel)
  }

  /** Forget all recorded answers. */
  const resetResults = () => {
    setResults({})
    save('results', {})
  }

  const keysRef = useRef<(e: KeyboardEvent) => void>(() => {})
  /** Keyboard shortcuts: Space plays, K tonic, C cadence, M minor cadence (mode unknown), 1-9 answer or listen, Enter goes on. */
  const onKeys = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName ?? ''
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) || e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === ' ' && tag !== 'BUTTON') {
      e.preventDefault()
      if (playing === 'line') stop()
      else void playChart()
    } else if (asked && REFERENCE_KEYS.includes(e.key.toUpperCase())) {
      const reference = keyReferences(asked.question.minor)[REFERENCE_KEYS.indexOf(e.key.toUpperCase())]
      if (reference) void playReference(reference)
    } else if (/^[1-9]$/.test(e.key)) {
      const option = options[Number(e.key) - 1]
      if (option) choose(option.id)
    } else if (e.key === 'Enter' && answer && tag !== 'BUTTON') {
      advance()
    }
  }
  useEffect(() => {
    keysRef.current = onKeys
  })
  useEffect(() => {
    // Always call the latest handler, registered once
    const onKey = (e: KeyboardEvent) => keysRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const style = getStyle(styleId)
  const mixerProps = mixer(style.comp.program)
  const listenedLabel = options.find((p) => p.id === listening)?.label
  const readout =
    playing && playing !== 'line'
      ? hideKey ? 'Key reference' : `Key of ${keyLabel(keyPc, asked?.question.minor ?? null)}`
      : position
        ? `Bar ${position.measure + 1} of ${chart?.bars.length ?? 0}`
        : playing === 'line'
          ? 'Count-in'
          : `${round.answered}/${ROUND_LENGTH} answered · ${round.correct} correct`

  // The key menu of the transport: the song's key, a random key, or one of the twelve keys
  const keyControl = hideKey ? (
    <div className="control">
      <span className="label">Key</span>
      <span className="exercise-key-hidden">Song key hidden</span>
    </div>
  ) : (
    <label className="control">
      <span className="label">Key</span>
      <select className="select" value={String(keyChoice)}
        onChange={(e) => chooseKey(e.target.value === 'song' || e.target.value === 'random' ? e.target.value : Number(e.target.value))}>
        <option value="song">Song key{asked && keyChoice === 'song' ? ` (${prettyNoteName(asked.question.key)})` : ''}</option>
        <option value="random">Random key{keyChoice === 'random' ? ` (${prettyNoteName(keyPc)})` : ''}</option>
        {Array.from({ length: 12 }, (_, pc) => (
          <option key={pc} value={pc}>
            {prettyNoteName(pc)}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="app exercise">
      <header className="topbar">
        <Wordmark>Name the progression</Wordmark>
        <span className="topbar-spacer" />
        <TopbarMenu active={focus || hideKey || hideAllChords}>
        <button className="topbar-button exercise-focus" aria-pressed={focus}
          aria-label={`Focus on mistakes: ${focus ? 'on' : 'off'}`}
          title={`Ask more often the progressions you get wrong (${focus ? 'on' : 'off'})`}
          onClick={() => { setFocus(!focus); save('focus', !focus) }}>
          Focus on mistakes<strong className="focus-state">{focus ? 'On' : 'Off'}</strong>
        </button>
        <Popover id="exercise-display" className="share exercise-display" label="Display"
          title="Choose which hints appear in the exercise and how chords are drawn" active={hideKey || hideAllChords || displayChanged}>
          {() => (
            <div className="share-panel">
              <button className="share-option" aria-pressed={hideKey} onClick={toggleHideKey}>
                <span className="share-name">Hide the key {hideKey ? 'On' : 'Off'}</span>
                <span className="share-desc">Use the song key without naming it.</span>
              </button>
              <button className="share-option" aria-pressed={hideAllChords} onClick={toggleHideAllChords}>
                <span className="share-name">Hide all chords {hideAllChords ? 'On' : 'Off'}</span>
                <span className="share-desc">Leave chords outside the answer gap blank.</span>
              </button>
              <DisplayOptions roman={false} />
            </div>
          )}
        </Popover>
        </TopbarMenu>
        {bank && (
          <label className="exercise-level">
            <span className="label">Level</span>
            <select className="select" value={currentLevel} onChange={(e) => startRound(e.target.value)}>
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.id} · {levelName(bank, l)}{passed.has(l.id) ? ' ✓' : ''}
                </option>
              ))}
              <option value={CUSTOM_LEVEL}>Custom{custom.length >= MIN_CUSTOM ? ` · ${levelProgressions(bank, CUSTOM_LEVEL, custom).length} progressions` : '…'}</option>
            </select>
          </label>
        )}
        {isCustom && customDraft === null && (
          <button className="topbar-button" onClick={() => setCustomDraft([...custom])}>Choose</button>
        )}
      </header>

      <main className="stage exercise-stage">
        {bankError && <p className="exercise-error">{bankError}</p>}
        {!bank && !bankError && <p className="exercise-loading">Loading questions…</p>}
        {bank && customDraft !== null && (
          <section className="custom-picker" aria-label="Custom level">
            <h2>Custom level</h2>
            <p>Choose the progressions to train (at least {MIN_CUSTOM}).</p>
            <div className="custom-grid">
              {playable(bank).map((p) => {
                const checked = customDraft.includes(p.id)
                return (
                  <label key={p.id} className={`custom-option${checked ? ' custom-option-on' : ''}`}>
                    <input type="checkbox" checked={checked}
                      onChange={() => setCustomDraft(checked ? customDraft.filter((id) => id !== p.id) : [...customDraft, p.id])} />
                    <span className="answer-label">{p.label}</span>
                    <span className="custom-count">{p.unique_song_count} songs</span>
                  </label>
                )
              })}
            </div>
            <div className="feedback-actions">
              {custom.length >= MIN_CUSTOM && asked && (
                <button className="topbar-button" onClick={() => setCustomDraft(null)}>Cancel</button>
              )}
              <button className="feedback-next" disabled={customDraft.length < MIN_CUSTOM} onClick={() => trainCustom(customDraft)}>
                Train {customDraft.length >= MIN_CUSTOM ? `these ${customDraft.length}` : ''}
              </button>
            </div>
          </section>
        )}
        {asked && chart && customDraft === null && (
          <>
            <Chart
              chart={chart}
              style={style}
              transpose={transpose}
              activeMeasure={position?.measure ?? null}
              beatInBar={position?.beatInBar ?? 0}
              barBeats={position?.barBeats ?? 4}
              concealHidden={answer === null}
              romanNumerals={false}
              concealOtherChords={hideAllChords && answer === null}
              header={
                <header className="sheet-head">
                  <span className="sheet-meta">({style.name})</span>
                  <h1 className="sheet-title">
                    {answer ? asked.question.title : 'Which progression fills the gap?'}
                  </h1>
                  <span className="sheet-meta sheet-meta-right">
                    {answer ? asked.question.artist || asked.question.corpus : hideKey ? 'Song key hidden' : `Key of ${keyLabel(keyPc, asked.question.minor)}`}
                  </span>
                </header>
              }
            />

            <section className="answers" aria-label="Answers">
              <div className="answers-head">
                <span className="label">
                  {answer ? `In the gap: ${listenedLabel}${listening === asked.progression.id ? ' (the song)' : ''}` : 'Fill the gap'}
                </span>
                <div className="answers-reference" role="group" aria-label="Hear the key">
                  <span className="label">Hear the key</span>
                  {keyReferences(asked.question.minor).map((reference, i) => {
                    const label = REFERENCE_LABELS[reference]
                    // With one cadence the mode is known, so the short name is enough
                    const text = asked.question.minor === null ? label.text : label.short
                    return (
                      <button key={reference} className="band-toggle" onClick={() => void playReference(reference)}
                        disabled={readiness.kind !== 'ready'} aria-pressed={playing === reference}
                        title={`${label.text} (${REFERENCE_KEYS[i]})`}>
                        {text}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="answer-grid">
                {options.map((option, i) => {
                  const state = !answer ? '' : option.id === asked.progression.id ? ' answer-correct' : option.id === answer ? ' answer-wrong' : ' answer-dim'
                  return (
                    <button key={option.id} className={`answer${state}${answer && listening === option.id ? ' answer-listening' : ''}`}
                      onClick={() => choose(option.id)}
                      title={answer ? 'Hear this progression in the gap' : undefined}>
                      <span className="answer-index">{i + 1}</span>
                      <span className="answer-label">{option.label}</span>
                      {answer && (
                        <svg className="answer-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9l7.5-4.5z" /></svg>
                      )}
                    </button>
                  )
                })}
              </div>

              {answer && (
                <div className={`feedback ${answer === asked.progression.id ? 'feedback-correct' : 'feedback-wrong'}`} role="status">
                  <div>
                    <strong>{answer === asked.progression.id ? 'Correct.' : `It was ${asked.progression.label}.`}</strong>{' '}
                    {asked.question.title}
                    {asked.question.artist && ` · ${asked.question.artist}`} · {asked.question.corpus}
                    <div className="feedback-hint">Tap a progression to hear it in the gap.</div>
                    {roundOver && (
                      <div className="feedback-round">
                        Round finished: {round.correct}/{ROUND_LENGTH} correct.{' '}
                        {isCustom ? '' : roundPassed ? 'Level passed.' : `Get ${PASS_MARK} right to pass the level.`}
                      </div>
                    )}
                  </div>
                  <div className="feedback-actions">
                    {roundPassed && !isCustom && nextLevel(currentLevel) && (
                      <button className="topbar-button" onClick={() => startRound(nextLevel(currentLevel)!.id)}>
                        Level {nextLevel(currentLevel)!.id}
                      </button>
                    )}
                    <button className="feedback-next" onClick={advance} autoFocus>
                      {roundOver ? 'New round' : 'Next'}
                    </button>
                  </div>
                </div>
              )}

              <details className="results">
                <summary>Your results</summary>
                <table>
                  <thead>
                    <tr><th>Progression</th><th>Right</th><th>Often taken for</th></tr>
                  </thead>
                  <tbody>
                    {options.map((option) => {
                      const result = results[option.id]
                      const confused = mostConfused(result)
                      return (
                        <tr key={option.id}>
                          <td>{option.label}</td>
                          <td>{result ? `${result.correct}/${result.asked} · ${Math.round((100 * result.correct) / result.asked)} %` : '—'}</td>
                          <td>{confused ? `${bank?.progressions.find((p) => p.id === confused[0])?.label ?? confused[0]} (${confused[1]}×)` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <p className="results-note">
                  {focus
                    ? 'Focus on mistakes is on: progressions with a low score come up more often.'
                    : 'Every progression of the level is equally likely.'}{' '}
                  Estimated accuracy is used, so a new progression starts at {Math.round(accuracy(undefined) * 100)} %.
                </p>
                <button className="topbar-button" onClick={resetResults}>Reset results</button>
              </details>
            </section>
          </>
        )}
      </main>

      <Transport
        readiness={readiness}
        playing={playing === 'line'}
        onToggle={() => (playing === 'line' ? stop() : void playChart())}
        position={readout}
        styleId={styleId}
        onStyle={(id) => change({ styleId: id, patternId: defaultPatternForStyle(id) })}
        pianoPatternId={patternId}
        pianoPatterns={patternsForStyle(styleId).length ? patternsForStyle(styleId) : PIANO_PATTERNS}
        onPianoPattern={(id) => change({ patternId: id })}
        keyPc={keyPc}
        onKey={(pc) => asked && change({ transpose: offsetToKey(asked.question.key, pc) })}
        keyControl={keyControl}
        bpm={bpm}
        bpmRange={BPM_RANGE}
        onBpm={setBpm}
        choruses={repeats}
        maxChoruses={MAX_REPEATS}
        onChoruses={(n) => change({ repeats: n })}
      >
        <div className="exercise-audio-controls">
          <label className="exercise-master-control">
            <span className="label">Master</span>
            <input type="range" min={0} max={127} value={mixerProps.master}
              aria-label="Master volume"
              onChange={(event) => mixerProps.onMaster(Number(event.target.value))} />
            <output>{mixerProps.master}</output>
          </label>
          <Mixer {...mixerProps} />
        </div>
      </Transport>
    </div>
  )
}
