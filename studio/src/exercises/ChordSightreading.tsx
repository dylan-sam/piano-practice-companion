import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Player } from '../audio/player'
import { useMidiKeyboard } from '../audio/useMidiKeyboard'
import { useMixer } from '../audio/useMixer'
import { useHeardBeat, usePlayer } from '../audio/usePlayer'
import { arrange, BASE_BPM, type Arrangement } from '../engine/arrange'
import { BASS_PATTERNS, defaultBassPatternForStyle, type BassPatternId } from '../engine/bassPatterns'
import { slotAtBeat, chorusTranspose, type Slot, type Timeline } from '../engine/timeline'
import { warmUpMidi } from '../engine/warmup'
import { reportError } from '../errorReports'
import { listProgressions, randomSong } from '../library/catalog'
import { fetchChocoTune } from '../library/choco'
import { loadTunes } from '../library/db'
import { loadJson, saveJson } from '../library/storage'
import { prettyNoteName, spellRoot } from '../music/chords'
import type { Chart as ChartData } from '../music/chart'
import { chorusesForKeys, NO_PRACTICE, practiceChange, type PracticeSettings } from '../music/practice'
import type { Tune } from '../music/songs'
import { getStyle, STYLES } from '../styles'
import { Chart } from '../ui/Chart'
import { DisplayMenu } from '../ui/DisplayMenu'
import { displayText, useDisplay } from '../ui/display'
import { Wordmark } from '../ui/AppLink'
import { Library } from '../ui/Library'
import { Mixer } from '../ui/Mixer'
import { Practice } from '../ui/Practice'
import { Transport } from '../ui/Transport'
import { BANK_URL, transposeFor, type KeyChoice, type QuestionBank } from './nameProgression'
import { ChordJudge, INFINITE_GROUPS, infiniteLine, isMistakes, mistakeKey, type InfiniteLine, type Mistakes } from './sightReading'
import type { CatalogProgression } from '../library/scoreSearch'
import { useBackClose } from '../ui/backButton'
import { useDrawerScreen } from '../ui/useNarrowScreen'

type Mode = 'pick' | 'random' | 'infinite'
type Feedback = Record<string, 'correct' | 'missed'>

const MISTAKES_KEY = 'eartraining:sightreading:mistakes'
const SEVENTHS_KEY = 'eartraining:sightreading:sevenths' // percent of 7th-chord versions
const MIDI_PARTS = ['bass', 'drums'] as const
const BPM_RANGE: [number, number] = [40, 300]
// The next infinite chunk starts this much MIDI time before the current one ends, covering
// the sequencer's load of the prepared file so the band does not stop between chunks
const SWITCH_LEAD_SECONDS = 0.06

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
    { loop: practice.loop, keyStep: practice.keyStep, ending: false, countIn },
    null, { comp: false, bassPatternId: patternId })
}

/** Locate the written bar and chorus currently sounding in the band. */
function playbackPosition(timeline: Timeline, beat: number) {
  const bar = timeline.bars.findLast((item) => item.start <= beat)
  return bar && beat < timeline.totalBeats ? bar : null
}

/** Name a visible chord target without exposing the chart's internal slot index. */
function feedbackKey(slot: Slot): string {
  return `${slot.measure}:${slot.chordIndex}`
}

/** Practice reading song chords or an endless stream using a MIDI keyboard. */
export function ChordSightreading() {
  const playerRef = useRef<Player | null>(null)
  const judgeRef = useRef<ChordJudge | null>(null)
  const scoringRef = useRef(false)
  const infiniteRef = useRef<InfiniteLine | null>(null)
  const continueRef = useRef(false)
  const pendingRef = useRef<PreparedChunk | null>(null)
  const chunkEndRef = useRef(Infinity) // beat at which the playing infinite chunk ends
  const switchedRef = useRef(false) // the current chunk already handed over to the next one
  const chunkCountInRef = useRef(true) // whether the chart or chunk on the stand began with a count-in
  const [mistakes, setMistakes] = useState<Mistakes>(() => loadJson(MISTAKES_KEY, {}, isMistakes))
  const mistakesRef = useRef(mistakes)

  const [mode, setMode] = useState<Mode>('pick')
  const [libraryOpen, setLibraryOpen] = useState(true)
  const [tunes, setTunes] = useState<Tune[]>([])
  const [tune, setTune] = useState<Tune | null>(null)
  const [line, setLine] = useState<InfiniteLine | null>(null)
  const [bank, setBank] = useState<QuestionBank | null>(null)
  const [catalog, setCatalog] = useState<CatalogProgression[]>([])
  const [progressionId, setProgressionId] = useState('')
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [beat, setBeat] = useState(0)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [feedback, setFeedback] = useState<Feedback>({})
  const [focus, setFocus] = useState(false)
  const [sevenths, setSevenths] = useState(() => loadJson(SEVENTHS_KEY, 50, (v) => typeof v === 'number' && v >= 0 && v <= 100))
  const seventhsRef = useRef(sevenths) // read when a chunk is prepared, so a new value applies at once
  const [styleId, setStyleId] = useState('swing')
  const [patternId, setPatternId] = useState<BassPatternId>(defaultBassPatternForStyle('swing'))
  const [keyChoice, setKeyChoice] = useState<KeyChoice>('song')
  const [transpose, setTranspose] = useState(0)
  const [bpm, setBpm] = useState(100)
  const [choruses, setChoruses] = useState(1)
  const [practice, setPractice] = useState<PracticeSettings>(NO_PRACTICE)
  const [pickLoop, setPickLoop] = useState<number | 'first' | null>(null)

  const chart = mode === 'infinite' ? line?.chart ?? null : tune?.chart ?? null
  const display = useDisplay() // chord notation chosen in the Display menu, also for the scrolling cards
  const style = getStyle(styleId)
  const position = timeline ? playbackPosition(timeline, beat) : null
  const currentChorus = playing && timeline ? slotAtBeat(timeline, beat)?.chorus ?? 0 : 0
  const shownTranspose = playing ? chorusTranspose(transpose, practice.keyStep, currentChorus) : transpose
  const liveBpm = Math.min(BPM_RANGE[1], bpm + practice.ramp * Math.min(currentChorus, choruses - 1))
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
      const judge = new ChordJudge(arrangement.timeline)
      if (fromSeconds > 0) judge.expire(fromSeconds * BASE_BPM / 60) // already judged by the arrangement before
      else {
        setFeedback({})
        setBeat(0)
      }
      judgeRef.current = judge
      chunkCountInRef.current = countIn
      chunkEndRef.current = arrangement.timeline.totalBeats
      switchedRef.current = false
      setTimeline(arrangement.timeline)
      await player.play(arrangement.midi, fromSeconds)
      player.setRate(bpm / BASE_BPM)
      setPlaying(true)
    } catch (cause) {
      setError(String(cause))
      reportError(cause, 'sight-reading playback')
    }
  }, [styleId, patternId, transpose, choruses, practice, bpm])

  /** Generate and arrange the chunk after the playing one, while the band plays. */
  const prepareNext = useCallback((after: InfiniteLine, nextStyle: string, nextPattern: BassPatternId) => {
    pendingRef.current = null
    window.setTimeout(() => {
      if (!bank || !continueRef.current || infiniteRef.current !== after) return
      try {
        const line = infiniteLine(bank.progressions, mistakesRef.current, focus, Math.random, after.steps.at(-1),
          INFINITE_GROUPS, seventhsRef.current / 100)
        const arrangement = arrangeForReading(line.chart, nextStyle, nextPattern, 0, 1, NO_PRACTICE, false)
        pendingRef.current = { line, arrangement, styleId: nextStyle, patternId: nextPattern }
      } catch (cause) {
        setError(String(cause))
      }
    }, 0)
  }, [bank, focus])

  /** Hand over to the prepared chunk: the judge, chart and audio all move to it at once. */
  const switchToNext = useCallback(async () => {
    const player = playerRef.current
    if (!player || !bank || !continueRef.current) return
    switchedRef.current = true
    finalizeThrough(Infinity)
    let pending = pendingRef.current
    if (!pending || pending.styleId !== styleId || pending.patternId !== patternId) {
      // Not ready (or settings changed since): build it now, at the cost of a short gap
      const line = infiniteLine(bank.progressions, mistakesRef.current, focus, Math.random, infiniteRef.current?.steps.at(-1),
        INFINITE_GROUPS, sevenths / 100)
      pending = { line, arrangement: arrangeForReading(line.chart, styleId, patternId, 0, 1, NO_PRACTICE, false), styleId, patternId }
    }
    pendingRef.current = null
    infiniteRef.current = pending.line
    judgeRef.current = new ChordJudge(pending.arrangement.timeline)
    chunkCountInRef.current = false
    chunkEndRef.current = pending.arrangement.timeline.totalBeats
    setLine(pending.line)
    setTimeline(pending.arrangement.timeline)
    setFeedback({})
    setBeat(0)
    try {
      await player.play(pending.arrangement.midi)
      player.setRate(liveBpmRef.current / BASE_BPM)
      switchedRef.current = false
      setPlaying(true)
      prepareNext(pending.line, pending.styleId, pending.patternId)
    } catch (cause) {
      setError(String(cause))
      continueRef.current = false
    }
  }, [bank, focus, sevenths, styleId, patternId, finalizeThrough, prepareNext])

  const readiness = usePlayer(playerRef, () => {
    finalizeThrough(Infinity)
    setPlaying(false)
    // Normally the next chunk starts just before this one ends; this covers a missed switch
    if (continueRef.current && !switchedRef.current) void switchToNext()
  }, () => STYLES.map(warmUpMidi))
  const mixer = useMixer(playerRef, readiness)
  const mixerProps = mixer(style.comp.program)

  useEffect(() => {
    playerRef.current?.setRate(liveBpm / BASE_BPM)
  }, [liveBpm])

  useHeardBeat(playing, playerRef, (currentBeat) => {
    setBeat(currentBeat)
    finalizeThrough(currentBeat)
    // The switch follows the synthesizer's clock, which runs ahead of what is heard
    const player = playerRef.current
    if (mode === 'infinite' && continueRef.current && !switchedRef.current && player &&
        (player.position + SWITCH_LEAD_SECONDS) * BASE_BPM / 60 >= chunkEndRef.current) void switchToNext()
  })

  useEffect(() => {
    // Load personal charts and the two generated ChoCo indexes once per visit.
    let active = true
    const controller = new AbortController()
    void loadTunes().then((loaded) => { if (active) setTunes(loaded) })
      .catch((cause) => { if (active) setError(String(cause)) })
    void listProgressions(controller.signal)
      .then((loaded) => { if (active) setCatalog(loaded) })
      .catch((cause) => { if (active && !controller.signal.aborted) setError(String(cause)) })
    void fetch(BANK_URL, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error('Progression bank unavailable'); return response.json() as Promise<QuestionBank> })
      .then((loaded) => { if (active) setBank(loaded) })
      .catch((cause) => { if (active && !controller.signal.aborted) setError(String(cause)) })
    return () => { active = false; controller.abort() }
  }, [])

  /** Stop the band and cancel automatic continuation of infinite practice. */
  const stop = () => {
    continueRef.current = false
    finalizeThrough((playerRef.current?.heardPosition ?? 0) * BASE_BPM / 60)
    playerRef.current?.stop()
    setPlaying(false)
  }

  /** Open a song from saved tunes or ChoCo and use its tempo and style. */
  const openTune = (next: Tune) => {
    stop()
    judgeRef.current = null
    setTimeline(null)
    setBeat(0)
    setTune(next)
    setLibraryOpen(false)
    setStyleId(next.chart.style)
    setPatternId(defaultBassPatternForStyle(next.chart.style))
    setBpm(Math.max(BPM_RANGE[0], Math.min(BPM_RANGE[1], next.chart.bpm)))
    setTranspose(transposeFor(keyChoice, next.chart))
    setPractice(NO_PRACTICE)
    setFeedback({})
    setError('')
  }

  /** Fetch a searched ChoCo score using the same loader as Studio. */
  const loadChoco = async (id: string) => {
    const loaded = await fetchChocoTune(id)
    setTunes((current) => [...current.filter((item) => item.id !== loaded.id), loaded])
    openTune(loaded)
  }

  /** Ask the server for one random distinct song containing an optional progression. */
  const chooseRandomSong = async () => {
    try {
      const group = await randomSong(progressionId)
      await loadChoco(group.id)
    } catch (cause) {
      setError(String(cause))
    }
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
      continueRef.current = true
      await startPlayback(next.chart, styleId, patternId, 0, 1, NO_PRACTICE)
      prepareNext(next, styleId, patternId)
    } catch (cause) {
      setError(String(cause))
    }
  }

  /** Change the screen mode without leaving the previous band playing; picking and random songs keep the current song. */
  const chooseMode = (next: Mode) => {
    // Pick a song again only opens or closes the song list, as the Tunes button of the Accompaniment Player
    if (next === 'pick' && mode === 'pick') {
      setLibraryOpen((current) => !current)
      return
    }
    // A picked or random song stays selected, and playing, when moving between these two modes
    if (next !== 'infinite' && mode !== 'infinite') {
      setMode(next)
      setLibraryOpen(next === 'pick')
      setError('')
      return
    }
    stop()
    judgeRef.current = null
    setTimeline(null)
    setBeat(0)
    setMode(next)
    if (next === 'pick') setLibraryOpen(true)
    setError('')
    setFeedback({})
    if (next !== 'infinite') setTune(null)
  }

  /**
   * Arrange again when a sound-affecting control changes: a new style or bass pattern goes on from
   * where the band is, other changes start the chart again.
   */
  const changeArrangement = (nextStyle: string, nextPattern: BassPatternId, nextTranspose: number,
    nextChoruses = choruses, nextPractice = practice) => {
    setStyleId(nextStyle)
    setPatternId(nextPattern)
    setTranspose(nextTranspose)
    setChoruses(nextChoruses)
    setPractice(nextPractice)
    const player = playerRef.current
    if (playing && chart && player) {
      // A new style or bass pattern goes on from where the band is, with the chunk's own count-in
      const soundOnly = nextTranspose === transpose && nextChoruses === choruses && nextPractice === practice
      if (soundOnly) finalizeThrough(player.heardPosition * BASE_BPM / 60)
      void startPlayback(chart, nextStyle, nextPattern, nextTranspose, nextChoruses, nextPractice,
        soundOnly ? chunkCountInRef.current : true, soundOnly ? player.position : 0)
    }
    if (mode === 'infinite' && line) prepareNext(line, nextStyle, nextPattern)
  }

  /**
   * Change the practice settings: a new loop starts over, new keys go on from where the band is
   * (with the choruses they need), a tempo ramp only changes the tempo.
   */
  const changePractice = (next: PracticeSettings) => {
    const change = practiceChange(practice, next)
    const nextChoruses = chorusesForKeys(practice, next, choruses)
    const player = playerRef.current
    if (change !== 'keys' || !playing || !chart || !player) {
      if (change === 'loop') changeArrangement(styleId, patternId, transpose, nextChoruses, next)
      else { setPractice(next); setChoruses(nextChoruses) }
      return
    }
    finalizeThrough(player.heardPosition * BASE_BPM / 60)
    setPractice(next)
    setChoruses(nextChoruses)
    void startPlayback(chart, styleId, patternId, transpose, nextChoruses, next, true, player.position)
  }

  /** Set how often 7th-chord versions are played; the next chunk is prepared again with it. */
  const changeSevenths = (value: number) => {
    setSevenths(value)
    seventhsRef.current = value
    saveJson(SEVENTHS_KEY, value)
    if (mode === 'infinite' && continueRef.current && infiniteRef.current) prepareNext(infiniteRef.current, styleId, patternId)
  }

  /** Choose a key for the current song or future song picks. */
  const chooseKey = (choice: KeyChoice) => {
    setKeyChoice(choice)
    if (!tune) return
    const nextTranspose = transposeFor(choice, tune.chart)
    changeArrangement(styleId, patternId, nextTranspose)
  }

  /** Set the start and end of a practice loop from two clicks on the chart. */
  const chooseLoopBar = (index: number) => {
    if (pickLoop === 'first') setPickLoop(index)
    else if (typeof pickLoop === 'number') {
      changeArrangement(styleId, patternId, transpose, choruses,
        { ...practice, loop: [Math.min(pickLoop, index), Math.max(pickLoop, index)] })
      setPickLoop(null)
    }
  }

  const keyPc = chart ? (chart.key + transpose + 12) % 12 : 0
  const activeSlot = timeline ? slotAtBeat(timeline, beat) : undefined
  const activeIndex = activeSlot && timeline ? timeline.slots.indexOf(activeSlot) : 0
  const fraction = activeSlot ? Math.max(0, Math.min(1, (beat - activeSlot.start) / activeSlot.beats)) : 0
  const visibleStart = Math.max(0, activeIndex - 1)
  const laneStyle = { '--scroll-steps': activeIndex + fraction - visibleStart } as CSSProperties
  // Held notes are spelled in the key on screen (F# rather than Gb in E), as the chords are
  const heldKey = chart ? (chart.key + shownTranspose + 12) % 12 : 0
  const noteNames = [...keyboard.held].sort((a, b) => a - b).map((note) =>
    `${spellRoot(note % 12, heldKey).replace('b', '\u266d').replace('#', '\u266f')}${Math.floor(note / 12) - 1}`)
  const mistakeCount = Object.values(mistakes).reduce((sum, count) => sum + count, 0)
  const positionLabel = !chart ? 'Choose a song or start an infinite line' :
    beat < (timeline?.countIn ?? 0) && playing ? 'Count-in' :
      mode === 'infinite' ? `Chord ${activeIndex + 1} of this line` :
        position ? `Bar ${position.measure + 1} of ${chart.bars.length}` : chart.title

  const keyControl = mode === 'infinite' ? (
    <div className="control"><span className="label">Key</span><span className="sight-key">Changes with the progression</span></div>
  ) : (
    <label className="control"><span className="label">Key</span>
      <select className="select" value={String(keyChoice)} onChange={(event) => {
        const value = event.target.value
        chooseKey(value === 'song' || value === 'random' ? value : Number(value))
      }}>
        <option value="song">Song key{tune && keyChoice === 'song' ? ` (${prettyNoteName(tune.chart.key)})` : ''}</option>
        <option value="random">Random key{tune && keyChoice === 'random' ? ` (${prettyNoteName(keyPc)})` : ''}</option>
        {Array.from({ length: 12 }, (_, pc) => <option key={pc} value={pc}>{prettyNoteName(pc)}</option>)}
      </select>
    </label>
  )

  // The Android back button closes the song drawer and stops loop picking (menus register themselves)
  const drawer = useDrawerScreen()
  useBackClose(drawer && mode === 'pick' && libraryOpen, () => setLibraryOpen(false))
  useBackClose(pickLoop !== null, () => setPickLoop(null))

  return (
    <div className="app sightreading">
      <header className="topbar">
        <Wordmark>Chord Sightreading</Wordmark>
        <span className="topbar-spacer" />
        {/* The infinite line scrolls on its own, so the sheet auto-scroller is not offered there */}
        <DisplayMenu autoScroll={mode !== 'infinite'} />
        <button className="topbar-button" onClick={() => void keyboard.connect()} disabled={keyboard.connected}
          aria-label={keyboard.connected ? undefined : 'Connect MIDI keyboard'}>
          {keyboard.connected ? keyboard.devices.length ? keyboard.devices.join(', ')
            : <>Waiting for<span className="topbar-long"> MIDI</span> keyboard</>
            : <>Connect<span className="topbar-long"> MIDI keyboard</span><span className="topbar-short"> MIDI</span></>}
        </button>
        {mode === 'pick' && <button className="tunes-toggle" aria-expanded={libraryOpen}
          onClick={() => setLibraryOpen((current) => !current)}>Songs</button>}
      </header>

      <div className="sight-mode" role="group" aria-label="Sight-reading mode">
        <button className="chip" aria-pressed={mode === 'pick'} onClick={() => chooseMode('pick')}>Pick a song</button>
        <button className="chip" aria-pressed={mode === 'random'} onClick={() => chooseMode('random')}>Random song</button>
        <button className="chip" aria-pressed={mode === 'infinite'} onClick={() => chooseMode('infinite')}>Infinite progressions</button>
      </div>

      <div className={mode === 'pick' ? `workspace${libraryOpen ? ' library-open' : ''}` : 'sight-workspace'}>
        {mode === 'pick' && <Library tunes={tunes} selectedId={tune?.id ?? ''}
          onSelect={(id) => { const selected = tunes.find((item) => item.id === id); if (selected) openTune(selected) }}
          onLoadChoco={loadChoco} />}
        <main className="stage exercise-stage sight-stage" onClick={() => setLibraryOpen(false)}>
          {error && <p className="exercise-error" role="alert">{error}</p>}
          {readiness.kind === 'loading' && <p className="sight-hint">Loading sounds {Math.round(readiness.progress * 100)}%...</p>}
          {readiness.kind === 'error' && <p className="exercise-error" role="alert">{readiness.message}</p>}
          {keyboard.error && <p className="exercise-error" role="alert">{keyboard.error}</p>}
          {!keyboard.supported && <p className="sight-hint">This browser does not expose Web MIDI. A compatible browser or native MIDI input is needed to score notes.</p>}
          {mode === 'random' && <div className="sight-picker">
            <label className="control"><span className="label">Train a progression (optional)</span>
              <select className="select" value={progressionId} onChange={(event) => setProgressionId(event.target.value)}>
                <option value="">Any progression</option>
                {catalog.map((item) => <option key={item.id} value={item.id}>{item.label} ({item.unique_song_count} songs)</option>)}
              </select>
            </label>
            <button className="button button-primary" onClick={() => void chooseRandomSong()}>Choose random song</button>
          </div>}
          {mode === 'infinite' && <div className="sight-picker">
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
                  <div key={index} className={`sight-card${index === activeIndex && playing ? ' sight-card-active' : ''}${
                    result === 'correct' ? ' sight-card-correct' : result === 'missed' ? ' sight-card-missed' : ''}`}>
                    <strong>{displayText(step.symbol, display, line.chart.key)}</strong>
                  </div>
                )
              })}
            </div>
          </section>}
          {mode !== 'infinite' && tune && <Chart chart={tune.chart} style={style}
            transpose={shownTranspose} activeMeasure={position?.measure ?? null}
            beatInBar={position ? beat - position.start : 0} barBeats={position?.beats ?? 4}
            chordFeedback={feedback} selectedBar={typeof pickLoop === 'number' ? pickLoop : null}
            onBarClick={pickLoop === null ? undefined : chooseLoopBar} autoScroll={playing} />}
          {chart && <p className="sight-hint">Play each chord on your keyboard before the next chord begins. Green means correct; red means its time expired.</p>}
          {!chart && mode === 'pick' && <p className="sight-hint">Search ChoCo or a saved playlist, then select a song.</p>}
          <p className="sight-midi-status" role="status">MIDI notes held: {noteNames.length ? noteNames.join(' · ') : 'none'}</p>
        </main>
      </div>

      {chart && <Transport readiness={readiness} playing={playing}
        onToggle={() => playing ? stop() : mode === 'infinite' ? void startInfinite() : void startPlayback(chart)}
        position={positionLabel} styleId={styleId}
        onStyle={(id) => changeArrangement(id, defaultBassPatternForStyle(id), transpose)}
        pianoPatternId={patternId} pianoPatterns={BASS_PATTERNS}
        onPianoPattern={(id) => changeArrangement(styleId,
          BASS_PATTERNS.find((pattern) => pattern.id === id)?.id ?? defaultBassPatternForStyle(styleId), transpose)}
        patternLabel="Bass pattern" showDefaultPattern={false}
        keyPc={keyPc} onKey={(pc) => chooseKey(pc)} keyControl={keyControl}
        bpm={bpm} bpmRange={BPM_RANGE} onBpm={setBpm}
        choruses={mode === 'infinite' ? 1 : choruses} maxChoruses={mode === 'infinite' ? 1 : 24}
        onChoruses={(count) => changeArrangement(styleId, patternId, transpose, count)}>
        {mode !== 'infinite' && <Practice chart={chart} settings={practice}
          onChange={changePractice}
          onPickLoop={() => setPickLoop('first')} />}
        <Mixer {...mixerProps} parts={[...MIDI_PARTS]} />
      </Transport>}
    </div>
  )
}
