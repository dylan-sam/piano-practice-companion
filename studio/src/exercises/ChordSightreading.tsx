import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Player } from '../audio/player'
import { useMidiKeyboard } from '../audio/useMidiKeyboard'
import { useMixer } from '../audio/useMixer'
import { useHeardBeat, usePausedAt, usePlayer } from '../audio/usePlayer'
import { arrange, BASE_BPM, type Arrangement } from '../engine/arrange'
import { BASS_PATTERNS, defaultBassPatternForStyle, type BassPatternId } from '../engine/bassPatterns'
import { barAtBeat, slotAtBeat, chorusKeyOffset, type Slot, type Timeline } from '../engine/timeline'
import { warmUpMidi } from '../engine/warmup'
import { reportError } from '../errorReports'
import { loadTunes } from '../library/db'
import { loadBundledLeadSheets } from '../library/bundled'
import { CHORD_SOURCES } from '../library/importTunes'
import { loadJson, saveJson } from '../library/storage'
import type { Chart as ChartData } from '../music/chart'
import { BPM_RANGE, applyPracticeChange, NO_PRACTICE, practiceOptions, rampedBpm, type PracticeSettings } from '../music/practice'
import { getStyle, STYLES } from '../styles'
import { Wordmark } from '../ui/AppLink'
import { Chart } from '../ui/Chart'
import { DisplayMenu } from '../ui/DisplayMenu'
import { displayText, useDisplay } from '../ui/display'
import { ImportDialog } from '../ui/ImportDialog'
import { Mixer } from '../ui/Mixer'
import { Practice } from '../ui/Practice'
import { Substitutions } from '../ui/Substitutions'
import { useSubstitutedChart } from '../ui/useSubstitutedChart'
import { Transport } from '../ui/Transport'
import { useLoopPicking } from '../ui/useLoopPicking'
import { ExerciseStatus, HeldNotes, KeyChoiceControl, RandomSongPicker } from './ExerciseControls'
import { transposeFor, type KeyChoice } from './nameProgression'
import { MidiButton } from './ReadingControls'
import { useLessonLink } from '../lessons/lessonLink'
import { useLessonGoal } from '../lessons/useLessonGoal'
import { LessonDone } from '../lessons/LessonDone'
import { ChordJudge, INFINITE_GROUPS, infiniteLine, isMistakes, mistakeKey, VOICINGS, type InfiniteLine, type Mistakes, type Voicing } from './sightReading'
import { useEndlessLine } from './useEndlessLine'
import { useProgressionSources, useSongSource, type SourceMode } from './useSongSource'
import { useBand } from './useBand'
import { SongsToggle, SongWorkspace } from './SongWorkspace'
import { judged, judgementOf, useChorusEffects } from '../ui/effects'

type Feedback = Record<string, 'correct' | 'missed'>

const MISTAKES_KEY = 'eartraining:sightreading:mistakes'
const SEVENTHS_KEY = 'eartraining:sightreading:sevenths' // percent of 7th-chord versions
const VOICING_KEY = 'eartraining:sightreading:voicing' // how chords must be voiced (voicing drills)
const INFINITE_GOAL_CHORDS = 16 // a line reaches a lesson's target after this many chords judged
const MIDI_PARTS = ['bass', 'drums'] as const
// The three sources of chords
const SOURCES: { id: SourceMode; text: string }[] = [
  { id: 'pick', text: 'Pick a song' }, { id: 'random', text: 'Random song' }, { id: 'infinite', text: 'Infinite progressions' },
]

/** One infinite chunk, already generated and arranged before it is needed. */
interface PreparedChunk {
  line: InfiniteLine
  arrangement: Arrangement
  styleId: string
  patternId: BassPatternId
}

/** Arrange a chart for bass and drums only, keeping its full chord timeline. */
function arrangeForReading(chart: ChartData, styleId: string, patternId: BassPatternId, transpose: number,
  choruses: number, practice: PracticeSettings, countIn: boolean): Arrangement {
  return arrange(chart, getStyle(styleId), transpose, choruses,
    { ...practiceOptions(practice), ending: false, countIn },
    null, { comp: false, bassPatternId: patternId })
}

/** Whether a stored value is a voicing drill. */
const isVoicing = (value: unknown): value is Voicing => VOICINGS.some((option) => option.id === value)

/** Name a visible chord target without exposing the chart's internal slot index. */
function feedbackKey(slot: Slot): string {
  return `${slot.measure}:${slot.chordIndex}`
}

/** Practice reading song chords or an endless stream using a MIDI keyboard. */
export function ChordSightreading() {
  const playerRef = useRef<Player | null>(null)
  // Where the band was paused: Play goes on from there, the chords before it judged already
  const { pausedAt, hold: holdPause, forget: forgetPause } = usePausedAt(playerRef)
  const judgeRef = useRef<ChordJudge | null>(null)
  const scoringRef = useRef(false)
  const infiniteRef = useRef<InfiniteLine | null>(null)
  const endless = useEndlessLine<PreparedChunk>(playerRef)
  const [mistakes, setMistakes] = useState<Mistakes>(() => loadJson(MISTAKES_KEY, {}, isMistakes))
  const mistakesRef = useRef(mistakes)

  const [line, setLine] = useState<InfiniteLine | null>(null)
  const [error, setError] = useState('')
  const { catalog, bank } = useProgressionSources(setError)
  const [playing, setPlaying] = useState(false)
  const [beat, setBeat] = useState(0)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [feedback, setFeedback] = useState<Feedback>({})
  const [focus, setFocus] = useState(false)
  const [sevenths, setSevenths] = useState(() => loadJson(SEVENTHS_KEY, 50, (v) => typeof v === 'number' && v >= 0 && v <= 100))
  const seventhsRef = useRef(sevenths) // read when a chunk is prepared, so a new value applies at once
  const [voicing, setVoicing] = useState<Voicing>(() => loadJson(VOICING_KEY, 'any', isVoicing))
  const voicingRef = useRef(voicing) // read by every new judge, so a new voicing applies to the next chords
  const band = useBand<BassPatternId>(defaultBassPatternForStyle, BPM_RANGE)
  const { styleId, patternId, keyChoice, setKeyChoice, transpose, setTranspose, bpm, setBpm, choruses, setChoruses, practice, setPractice } = band

  const source = useSongSource({
    playing, onError: setError, onLeave: clearStand,
    // A song comes with its style, tempo and key
    onOpen: (next) => {
      clearStand()
      band.takeSong(next.chart)
    },
  })
  const { mode, tune } = source
  // Opened from a lesson step: a voicing drill, an infinite line, its tempo and style
  const lesson = useLessonLink()
  useEffect(() => {
    if (lesson?.voicing) changeVoicing(lesson.voicing, false)
    if (lesson?.bpm) setBpm(lesson.bpm)
    if (lesson?.style && STYLES.some((item) => item.id === lesson.style)) band.set({ styleId: lesson.style, patternId: defaultBassPatternForStyle(lesson.style) })
    if (lesson?.infinite) source.chooseMode('infinite')
    // Once, when the screen opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // A Practice loop picked on the chart: tap its first bar, then its last
  const loopPicking = useLoopPicking((loop) => changeArrangement(styleId, patternId, transpose, choruses, { ...practice, loop }))

  const chart = mode === 'infinite' ? line?.chart ?? null : tune?.chart ?? null
  const display = useDisplay() // chord notation chosen in the Display menu, also for the scrolling cards
  const style = getStyle(styleId)
  const position = timeline ? barAtBeat(timeline, beat) : null
  const currentChorus = playing && timeline ? slotAtBeat(timeline, beat)?.chorus ?? 0 : 0
  const shownTranspose = playing ? chorusKeyOffset(practice, currentChorus, transpose) : transpose
  const liveBpm = rampedBpm(bpm, practice, Math.min(currentChorus, choruses - 1), BPM_RANGE)
  const shownChart = useSubstitutedChart(tune?.chart, practice.subs, playing, currentChorus)
  useChorusEffects(currentChorus, playing)
  const liveBpmRef = useRef(liveBpm)
  useEffect(() => { liveBpmRef.current = liveBpm }, [liveBpm])

  /** Remember a missed chord for later focus-weighted infinite lines. */
  const recordMiss = useCallback((slot: Slot) => {
    const key = mistakeKey(slot.chord)
    setMistakes((current) => {
      const next = { ...current, [key]: (current[key] ?? 0) + 1 }
      mistakesRef.current = next
      saveJson(MISTAKES_KEY, next)
      return next
    })
  }, [])

  /** Mark every expired slot, so a miss turns red only after its allowed beats. */
  const finalizeThrough = useCallback((targetBeat: number) => {
    for (const slot of judgeRef.current?.expire(targetBeat) ?? []) {
      if (!scoringRef.current) continue
      setFeedback((current) => ({ ...current, [feedbackKey(slot)]: 'missed' }))
      recordMiss(slot)
      judged('sightreading', 'miss')
    }
  }, [recordMiss])

  /** Accept a complete MIDI voicing during the slot in which it is played. */
  const onNoteOn = useCallback((note: number, held: Set<number>, velocity: number) => {
    const player = playerRef.current
    player?.liveNoteOn(note, velocity)
    if (!player?.isPlaying) return
    const currentBeat = player.heardPosition * BASE_BPM / 60
    const slot = judgeRef.current?.accept(currentBeat, held)
    if (!slot) return
    setFeedback((current) => ({ ...current, [feedbackKey(slot)]: 'correct' }))
    if (scoringRef.current) judged('sightreading', judgementOf(currentBeat - slot.start))
  }, [])
  /** Release the local piano voice when a physical key lifts. */
  const onNoteOff = useCallback((note: number) => { playerRef.current?.liveNoteOff(note) }, [])
  const keyboard = useMidiKeyboard(onNoteOn, onNoteOff)

  useEffect(() => { scoringRef.current = keyboard.devices.length > 0 }, [keyboard.devices.length])

  /**
   * Start a chart with only bass and drums while keeping its full chord timeline. From
   * `fromSeconds` (MIDI time) the band goes on where it is (new keys): the chords already past
   * keep their colours and are not judged again.
   */
  const startPlayback = useCallback(async (
    nextChart: ChartData, nextStyle = styleId, nextPattern = patternId, nextTranspose = transpose,
    nextChoruses = choruses, nextPractice = practice, countIn = true, fromSeconds = 0,
  ) => {
    const player = playerRef.current
    if (!player) return
    try {
      const arrangement = arrangeForReading(nextChart, nextStyle, nextPattern, nextTranspose, nextChoruses,
        nextPractice, countIn)
      const judge = new ChordJudge(arrangement.timeline, { voicing: voicingRef.current })
      if (fromSeconds > 0) judge.expire(fromSeconds * BASE_BPM / 60) // already judged by the arrangement before
      else {
        setFeedback({})
        setBeat(0)
      }
      judgeRef.current = judge
      endless.started(arrangement.timeline.totalBeats, countIn)
      setTimeline(arrangement.timeline)
      forgetPause()
      await player.play(arrangement.midi, fromSeconds)
      player.setRate(bpm / BASE_BPM)
      setPlaying(true)
    } catch (cause) {
      setError(String(cause))
      reportError(cause, 'sight-reading playback')
    }
  }, [styleId, patternId, transpose, choruses, practice, bpm, endless, forgetPause])

  /** Generate and arrange the chunk after the playing one, while the band plays. */
  const prepareNext = useCallback((after: InfiniteLine, nextStyle: string, nextPattern: BassPatternId) => {
    endless.prepare(null)
    window.setTimeout(() => {
      if (!bank || !endless.goesOn.current || infiniteRef.current !== after) return
      try {
        const line = infiniteLine(bank.progressions, mistakesRef.current, focus, Math.random, after.steps.at(-1),
          INFINITE_GROUPS, seventhsRef.current / 100)
        const arrangement = arrangeForReading(line.chart, nextStyle, nextPattern, 0, 1, NO_PRACTICE, false)
        endless.prepare({ line, arrangement, styleId: nextStyle, patternId: nextPattern })
      } catch (cause) {
        setError(String(cause))
      }
    }, 0)
  }, [bank, focus, endless])

  /** Hand over to the prepared chunk: the judge, chart and audio all move to it at once. */
  const switchToNext = useCallback(async () => {
    const player = playerRef.current
    if (!player || !bank || !endless.goesOn.current) return
    let pending = endless.take()
    finalizeThrough(Infinity)
    if (!pending || pending.styleId !== styleId || pending.patternId !== patternId) {
      // Not ready (or settings changed since): build it now, at the cost of a short gap
      const line = infiniteLine(bank.progressions, mistakesRef.current, focus, Math.random, infiniteRef.current?.steps.at(-1),
        INFINITE_GROUPS, sevenths / 100)
      pending = { line, arrangement: arrangeForReading(line.chart, styleId, patternId, 0, 1, NO_PRACTICE, false), styleId, patternId }
    }
    infiniteRef.current = pending.line
    judgeRef.current = new ChordJudge(pending.arrangement.timeline, { voicing: voicingRef.current })
    setLine(pending.line)
    setTimeline(pending.arrangement.timeline)
    setFeedback({})
    setBeat(0)
    try {
      await endless.play(pending)
      player.setRate(liveBpmRef.current / BASE_BPM)
      endless.started(pending.arrangement.timeline.totalBeats, false)
      setPlaying(true)
      prepareNext(pending.line, pending.styleId, pending.patternId)
    } catch (cause) {
      setError(String(cause))
      endless.stop()
    }
  }, [bank, focus, sevenths, styleId, patternId, finalizeThrough, prepareNext, endless])

  const readiness = usePlayer(playerRef, () => {
    finalizeThrough(Infinity)
    setPlaying(false)
    forgetPause()
    // Normally the next chunk starts just before this one ends; this covers a missed switch
    if (endless.missed()) void switchToNext()
  }, () => STYLES.map(warmUpMidi))
  const mixer = useMixer(playerRef, readiness, lesson?.mute)
  const mixerProps = mixer(style.comp.program)

  useEffect(() => {
    playerRef.current?.setRate(liveBpm / BASE_BPM)
  }, [liveBpm])

  useHeardBeat(playing, playerRef, (currentBeat) => {
    setBeat(currentBeat)
    finalizeThrough(currentBeat)
    if (mode === 'infinite' && endless.due()) void switchToNext()
  })

  useEffect(() => {
    // The saved charts, once per visit (the catalog is searched in the song list)
    let active = true
    // The saved songs and the shipped lead sheets (their chords); the catalog is searched
    void Promise.all([loadTunes(), loadBundledLeadSheets()]).then(([saved, bundled]) => { if (active) source.setTunes([...saved, ...bundled]) })
      .catch((cause) => { if (active) setError(String(cause)) })
    return () => { active = false }
    // Loaded once; setTunes is a state setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Stop the band and cancel automatic continuation of infinite practice; the next Play starts over. */
  function stop() {
    pauseBand()
    forgetPause()
  }

  /** Pause the band where it is (an infinite line waits): the chords already due are judged, and Play goes on from there. */
  function pauseBand() {
    holdPause()
    endless.stop()
    finalizeThrough((playerRef.current?.heardPosition ?? 0) * BASE_BPM / 60)
    playerRef.current?.stop()
    setPlaying(false)
  }

  /** Go on from where the band was paused: the song, or the infinite line's chunk on the stand, after which the line goes on. */
  function goOnFrom(from: number) {
    if (!chart) return
    if (mode === 'infinite') endless.goesOn.current = true
    const endlessChunk = mode === 'infinite' // arranged as it was made
    void startPlayback(chart, styleId, patternId, endlessChunk ? 0 : transpose, endlessChunk ? 1 : choruses,
      endlessChunk ? NO_PRACTICE : practice, endless.countIn.current, from).then(() => {
      if (mode === 'infinite' && line) prepareNext(line, styleId, patternId)
    })
  }

  /** Stop and forget the judged chords and the timeline (another song or line goes on the stand). */
  function clearStand() {
    stop()
    judgeRef.current = null
    setTimeline(null)
    setBeat(0)
    setFeedback({})
  }

  /** Start a new endless chunk, optionally weighting past mistakes. */
  const startInfinite = async () => {
    if (!bank) return
    stop()
    try {
      const next = infiniteLine(bank.progressions, mistakesRef.current, focus, Math.random, undefined,
        INFINITE_GROUPS, sevenths / 100)
      infiniteRef.current = next
      setLine(next)
      setTranspose(0)
      setPractice(NO_PRACTICE)
      endless.goesOn.current = true
      await startPlayback(next.chart, styleId, patternId, 0, 1, NO_PRACTICE)
      prepareNext(next, styleId, patternId)
    } catch (cause) {
      setError(String(cause))
    }
  }

  /**
   * Arrange again when a sound-affecting control changes: a new style, bass pattern or number of
   * choruses goes on from where the band is, other changes start the chart again.
   */
  function changeArrangement(nextStyle: string, nextPattern: BassPatternId, nextTranspose: number,
    nextChoruses = choruses, nextPractice = practice) {
    band.set({ styleId: nextStyle, patternId: nextPattern, transpose: nextTranspose, choruses: nextChoruses, practice: nextPractice })
    const player = playerRef.current
    // A new number of choruses goes on too, as a new style does
    const soundOnly = nextTranspose === transpose && nextPractice === practice
    if (!soundOnly && !playing) forgetPause() // a paused band starts a changed sheet from its beginning
    if (playing && chart && player) {
      // A new style or bass pattern goes on from where the band is, with the chunk's own count-in;
      // an infinite line's chunk is always arranged as it was made (one chorus, no keys or loop)
      if (soundOnly) finalizeThrough(player.heardPosition * BASE_BPM / 60)
      const endlessChunk = mode === 'infinite'
      // The next chunk is prepared again only once this one plays: preparing it while this one
      // loads would load both on the same synthesizer, and the band would stop
      if (endlessChunk) endless.prepare(null)
      void startPlayback(chart, nextStyle, nextPattern, endlessChunk ? 0 : nextTranspose, endlessChunk ? 1 : nextChoruses,
        endlessChunk ? NO_PRACTICE : nextPractice, soundOnly ? endless.countIn.current : true, soundOnly ? player.position : 0)
        .then(() => { if (endlessChunk && line) prepareNext(line, nextStyle, nextPattern) })
      return
    }
    if (mode === 'infinite' && line) prepareNext(line, nextStyle, nextPattern)
  }

  /**
   * Change the practice settings: a new loop starts over, new keys go on from where the band is
   * (with the choruses they need, the chords already played keep their colours), a tempo ramp only
   * changes the tempo.
   */
  const changePractice = (next: PracticeSettings) => {
    const player = playerRef.current
    applyPracticeChange(practice, next, choruses, playing && !!chart && !!player, {
      restart: (settings, count) => changeArrangement(styleId, patternId, transpose, count, settings),
      goOn: (settings, count) => {
        finalizeThrough(player!.heardPosition * BASE_BPM / 60)
        setPractice(settings)
        setChoruses(count)
        void startPlayback(chart!, styleId, patternId, transpose, count, settings, true, player!.position)
      },
      keep: (settings, count) => { setPractice(settings); setChoruses(count) },
    })
  }

  /**
   * Ask for another voicing: the judge playing now is made again, the chords already judged stay.
   * A lesson's voicing is for this visit only (`keep` false).
   */
  const changeVoicing = (next: Voicing, keep = true) => {
    setVoicing(next)
    voicingRef.current = next
    if (keep) saveJson(VOICING_KEY, next)
    const current = judgeRef.current
    if (current && timeline) {
      const judge = new ChordJudge(timeline, { voicing: next })
      judge.expire((playerRef.current?.heardPosition ?? 0) * BASE_BPM / 60)
      judgeRef.current = judge
    }
  }

  /** Set how often 7th-chord versions are played; the next chunk is prepared again with it. */
  const changeSevenths = (value: number) => {
    setSevenths(value)
    seventhsRef.current = value
    saveJson(SEVENTHS_KEY, value)
    if (mode === 'infinite' && endless.goesOn.current && infiniteRef.current) prepareNext(infiniteRef.current, styleId, patternId)
  }

  /** Choose a key for the current song or future song picks. */
  const chooseKey = (choice: KeyChoice) => {
    setKeyChoice(choice)
    if (!tune) return
    const nextTranspose = transposeFor(choice, tune.chart)
    changeArrangement(styleId, patternId, nextTranspose)
  }

  const keyPc = chart ? (chart.key + transpose + 12) % 12 : 0
  const activeSlot = timeline ? slotAtBeat(timeline, beat) : undefined
  const activeIndex = activeSlot && timeline ? timeline.slots.indexOf(activeSlot) : 0
  const fraction = activeSlot ? Math.max(0, Math.min(1, (beat - activeSlot.start) / activeSlot.beats)) : 0
  const visibleStart = Math.max(0, activeIndex - 1)
  const laneStyle = { '--scroll-steps': activeIndex + fraction - visibleStart } as CSSProperties
  // Held notes are spelled in the key on screen (F# rather than Gb in E), as the chords are
  const heldKey = chart ? (chart.key + shownTranspose + 12) % 12 : 0
  const mistakeCount = Object.values(mistakes).reduce((sum, count) => sum + count, 0)
  // The lesson's target: every chord of a song judged, or enough of an infinite line
  const results = Object.values(feedback)
  const right = results.filter((result) => result === 'correct').length
  const chordCount = timeline ? timeline.slots.filter((slot) => slot.chordIndex >= 0).length : 0
  const reachedGoal = useLessonGoal(lesson, {
    right, judged: results.length, bpm: liveBpm,
    complete: mode === 'infinite' ? results.length >= INFINITE_GOAL_CHORDS : chordCount > 0 && results.length >= chordCount,
  })
  const positionLabel = !chart ? 'Choose a song or start an infinite line' :
    beat < (timeline?.countIn ?? 0) && playing ? 'Count-in' :
      mode === 'infinite' ? `Chord ${activeIndex + 1} of this line` :
        position ? `Bar ${position.measure + 1} of ${chart.bars.length}` : chart.title

  return (
    <div className="app sightreading">
      <header className="topbar">
        <Wordmark>Chord Sightreading</Wordmark>
        <span className="topbar-spacer" />
        {/* The infinite line scrolls on its own, so the sheet auto-scroller is not offered there */}
        <DisplayMenu autoScroll={mode !== 'infinite'} />
        <MidiButton keyboard={keyboard} />
        <SongsToggle source={source} />
      </header>

      <SongWorkspace source={source} modes={SOURCES} label="Sight-reading mode" tunes={source.tunes} catalog>
          <ExerciseStatus error={error} readiness={readiness} keyboard={keyboard} />
          <div className="sight-picker">
            <label className="control" title="How each chord must be voiced: the voicing drills of jazz piano, from shells to rootless and quartal voicings">
              <span className="label">Voicing</span>
              <select className="select" value={voicing} aria-label="Voicing" onChange={(event) => changeVoicing(event.target.value as Voicing)}>
                {VOICINGS.map((option) => <option key={option.id} value={option.id}>{option.text}</option>)}
              </select>
            </label>
          </div>
          {source.shown === 'random' && <RandomSongPicker catalog={catalog} onChoose={(id) => void source.openRandomSong(id)} />}
          {source.shown === 'infinite' && <div className="sight-picker">
            <button className="button button-primary" onClick={() => void startInfinite()}
              disabled={!bank || readiness.kind !== 'ready'}>New infinite line</button>
            <button className="chip" aria-pressed={focus} onClick={() => setFocus((current) => !current)}>
              Focus on mistakes: {focus ? 'On' : 'Off'}
            </button>
            <label className="control sight-sevenths">
              <span className="label">7th chords</span>
              <input type="range" min={0} max={100} step={10} value={sevenths} aria-label="Share of 7th-chord versions"
                title="How often a progression with a 7th-chord version (ii-7 V7 I^7, V7 ...) is played in that version"
                onChange={(event) => changeSevenths(Number(event.target.value))} />
              <output>{sevenths} %</output>
            </label>
            <span className="sight-hint">{mistakeCount} missed chords remembered on this device</span>
          </div>}
          {mode === 'infinite' && line && <section className="sight-scroll" aria-label="Scrolling chord progression">
            <div className="sight-lane" style={laneStyle}>
              {line.steps.slice(visibleStart, activeIndex + 10).map((step, offset) => {
                const index = visibleStart + offset
                const result = feedback[`${Math.floor(index / 2)}:${index % 2}`]
                return (
                  <div key={index} className={`sight-card${step.written ? ' sight-card-sub' : ''}${index === activeIndex && playing ? ' sight-card-active' : ''}${
                    result === 'correct' ? ' sight-card-correct' : result === 'missed' ? ' sight-card-missed' : ''}`}>
                    <strong>{displayText(step.symbol, display, line.chart.key)}</strong>
                  </div>
                )
              })}
            </div>
          </section>}
          {mode !== 'infinite' && shownChart && <Chart chart={shownChart} style={style}
            transpose={shownTranspose} activeMeasure={position?.measure ?? null}
            beatInBar={position ? beat - position.start : 0} barBeats={position?.beats ?? 4}
            chordFeedback={feedback} selectedBar={loopPicking.firstBar}
            onBarClick={loopPicking.picking ? loopPicking.chooseBar : undefined} autoScroll={playing} />}
          {reachedGoal && <LessonDone />}
          {chart && <p className="sight-hint">Play each chord on your keyboard before the next chord begins{voicing === 'any' ? '' : `, voiced as asked: ${VOICINGS.find((option) => option.id === voicing)?.text}`}. Green means correct; red means its time expired.</p>}
          {!chart && mode === 'pick' && <p className="sight-hint">Search ChoCo or a saved playlist, then select a song.</p>}
          <HeldNotes held={keyboard.held} keyPc={heldKey} />
      </SongWorkspace>

      {chart && <Transport readiness={readiness} playing={playing}
        onToggle={() => playing ? pauseBand() : pausedAt !== null ? goOnFrom(pausedAt)
          : mode === 'infinite' ? void startInfinite() : void startPlayback(chart)}
        paused={pausedAt !== null} onRestart={() => mode === 'infinite' ? void startInfinite() : void startPlayback(chart)}
        position={positionLabel} styleId={styleId}
        onStyle={(id) => changeArrangement(id, defaultBassPatternForStyle(id), transpose)}
        pianoPatternId={patternId} pianoPatterns={BASS_PATTERNS}
        onPianoPattern={(id) => changeArrangement(styleId,
          BASS_PATTERNS.find((pattern) => pattern.id === id)?.id ?? defaultBassPatternForStyle(styleId), transpose)}
        patternLabel="Bass pattern" showDefaultPattern={false}
        keyPc={keyPc} onKey={(pc) => chooseKey(pc)}
        keyControl={<KeyChoiceControl choice={keyChoice} onChoose={chooseKey} sourceKey={tune?.chart.key ?? null}
          currentKey={keyPc} fixed={mode === 'infinite' ? 'Changes with the progression' : undefined} />}
        bpm={bpm} bpmRange={BPM_RANGE} onBpm={setBpm}
        choruses={mode === 'infinite' ? 1 : choruses} maxChoruses={mode === 'infinite' ? 1 : 24}
        onChoruses={(count) => changeArrangement(styleId, patternId, transpose, count)}>
        {mode !== 'infinite' && <Practice chart={chart} settings={practice}
          onChange={changePractice}
          onPickLoop={loopPicking.start} />}
        {mode !== 'infinite' && <Substitutions practice={practice} onChange={changePractice} />}
        <Mixer {...mixerProps} parts={[...MIDI_PARTS]} />
      </Transport>}
      <ImportDialog open={source.importOpen} onClose={() => source.setImportOpen(false)} sources={CHORD_SOURCES}
        onImported={(added) => source.imported(added)} />
    </div>
  )
}
