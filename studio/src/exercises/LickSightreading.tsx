import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '../audio/player'
import { useMixer } from '../audio/useMixer'
import { useHeardBeat, usePlayer } from '../audio/usePlayer'
import { arrange, BASE_BPM, type Arrangement, type Part } from '../engine/arrange'
import { melodyOccurrences, type MelodyOccurrence } from '../engine/melody'
import { defaultPatternForStyle, patternsForStyle, PIANO_PATTERNS } from '../engine/pianoPatterns'
import { chorusTranspose, type Timeline } from '../engine/timeline'
import { warmUpMidi } from '../engine/warmup'
import { reportError } from '../errorReports'
import { loadBundledLeadSheets } from '../library/bundled'
import { listProgressions, randomSong } from '../library/catalog'
import { fetchChocoTune } from '../library/choco'
import { loadTunes } from '../library/db'
import type { CatalogProgression } from '../library/scoreSearch'
import { loadJson, saveJson } from '../library/storage'
import { prettyNoteName, spellRoot } from '../music/chords'
import { hasMelody, withoutMelody, type Chart as ChartData } from '../music/chart'
import { chorusesForKeys, NO_PRACTICE, practiceChange, type PracticeSettings } from '../music/practice'
import type { Tune } from '../music/songs'
import { getStyle, STYLES } from '../styles'
import { DisplayMenu } from '../ui/DisplayMenu'
import { Wordmark } from '../ui/AppLink'
import { ImportDialog, type ImportResult, type ImportSource } from '../ui/ImportDialog'
import { CHORD_SOURCES, importTunes } from '../library/importTunes'
import { LeadSheet } from '../ui/LeadSheet'
import { Library } from '../ui/Library'
import { Mixer } from '../ui/Mixer'
import { Practice } from '../ui/Practice'
import { Transport } from '../ui/Transport'
import { useBackClose } from '../ui/backButton'
import { useDrawerScreen } from '../ui/useNarrowScreen'
import { isOneChordLick, lickChord, lickShape, withLick, type LickShape } from './lickReading'
import { BANK_URL, transposeFor, type KeyChoice, type QuestionBank } from './nameProgression'
import { infiniteLine, type InfiniteLine } from './sightReading'
import { MelodyScoreLine, MidiButton, ReadingPopover } from './ReadingControls'
import { DEFAULT_READING, isReadingSettings, useMelodyJudging, type ReadingSettings } from './useMelodyJudging'

type Mode = 'pick' | 'random' | 'infinite'

// The settings of this screen, kept on this device: how notes are judged, the lick and its layout
interface LickSettings extends ReadingSettings {
  lickId: string
  rest: boolean // a rest as long as the lick between two licks
}
const SETTINGS_KEY = 'eartraining:lick-reading'
const DEFAULT_SETTINGS: LickSettings = { ...DEFAULT_READING, lickId: '', rest: false }
const BPM_RANGE: [number, number] = [40, 300]
const BAND_PARTS: Part[] = ['bass', 'comp', 'drums']
const GUIDE_PARTS: Part[] = ['bass', 'comp', 'melody', 'drums']
// An infinite chunk: progressions joined from the catalog, short enough to draw on the staff
const CHUNK_GROUPS = 12
const CHUNK_LEAD_IN = 1 // bars of rest at the top of each sheet of an infinite line, while the band plays
// The next chunk starts this much MIDI time before the current one ends (as in Chord Sightreading)
const SWITCH_LEAD_SECONDS = 0.06

/** A lick playlist's name, short enough for the menu: "Licks from standards: V-I" is "Standards: V-I". */
const shortGroup = (name: string) =>
  name.replace(/^Licks: /, '').replace(/^Licks from standards: /, 'Standards: ').replace(/^Licks from folk tunes: /, 'Folk: ')

/** Whether stored settings are usable. */
function isSettings(value: unknown): value is LickSettings {
  const v = value as Partial<LickSettings> | null
  return isReadingSettings(value) && typeof v?.lickId === 'string' && typeof v?.rest === 'boolean'
}

/** Locate the written bar currently sounding in the band. */
function playbackPosition(timeline: Timeline, beat: number) {
  const bar = timeline.bars.findLast((item) => item.start <= beat)
  return bar && beat < timeline.totalBeats ? bar : null
}

/** A chart arranged for the band, with the lick's notes as the judge expects them. */
interface Prepared {
  chart: ChartData
  arrangement: Arrangement
  notes: MelodyOccurrence[]
  line?: InfiniteLine
  countIn?: boolean // an infinite chunk: whether it begins with a count-in
}

/**
 * Arrange a chart with its lick: the band plays the chords (and the lick when it guides). A chunk
 * of an infinite line (`chunk`) never ends like a song, since the next one follows at the top; only
 * the first chunk has a count-in.
 */
function prepare(chart: ChartData, styleId: string, patternId: string | null, transpose: number, choruses: number,
  practice: PracticeSettings, settings: LickSettings, chunk?: { countIn: boolean }): Prepared {
  const style = getStyle(styleId)
  const options = { loop: practice.loop, keyStep: practice.keyStep, ...(chunk ? { ending: false, countIn: chunk.countIn } : {}) }
  const arrangement = arrange(settings.guide ? chart : withoutMelody(chart), style, transpose, choruses, options, patternId)
  const notes = melodyOccurrences(chart, arrangement.timeline, style.swing, transpose, practice.keyStep)
  return { chart, arrangement, notes }
}

/** Play one lick over every chord of a song or of an endless line of progressions, on a MIDI keyboard. */
export function LickSightreading() {
  const playerRef = useRef<Player | null>(null)
  const continueRef = useRef(false) // an infinite line goes on with its next chunk
  const lineRef = useRef<InfiniteLine | null>(null)
  const pendingRef = useRef<Prepared | null>(null)
  const chunkEndRef = useRef(Infinity)
  const chunkCountInRef = useRef(true) // whether the playing infinite chunk began with a count-in
  const switchedRef = useRef(false)

  const [mode, setMode] = useState<Mode>('pick')
  const [libraryOpen, setLibraryOpen] = useState(true)
  const [tunes, setTunes] = useState<Tune[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [licks, setLicks] = useState<Tune[]>([])
  const [tune, setTune] = useState<Tune | null>(null)
  const [line, setLine] = useState<InfiniteLine | null>(null)
  const [bank, setBank] = useState<QuestionBank | null>(null)
  const [catalog, setCatalog] = useState<CatalogProgression[]>([])
  const [progressionId, setProgressionId] = useState('')
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [beat, setBeat] = useState(0)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [settings, setSettingsState] = useState<LickSettings>(() => loadJson(SETTINGS_KEY, DEFAULT_SETTINGS, isSettings))
  const [styleId, setStyleId] = useState('swing')
  const [patternId, setPatternId] = useState<string | null>(defaultPatternForStyle('swing'))
  const [keyChoice, setKeyChoice] = useState<KeyChoice>('song')
  const [transpose, setTranspose] = useState(0)
  const [bpm, setBpm] = useState(100)
  const [choruses, setChoruses] = useState(1)
  const [practice, setPractice] = useState<PracticeSettings>(NO_PRACTICE)
  const [pickLoop, setPickLoop] = useState<number | 'first' | null>(null)

  const { keyboard, feedback, score, total, settleThrough, begin, resume, clear } = useMelodyJudging(playerRef)

  // The lick of some settings: the one chosen, else the first one-chord lick
  const lickFor = useCallback((chosen: LickSettings) => licks.find((item) => item.id === chosen.lickId) ?? licks[0] ?? null, [licks])
  const lick = lickFor(settings)
  const source = mode === 'infinite' ? line?.chart ?? null : tune?.chart ?? null
  /**
   * A song or a chunk with the lick of `layout` written over it. The lick is read from the
   * settings passed in, so a new lick chosen while the band plays is the one heard at once.
   */
  const withShape = useCallback((chart: ChartData, layout: LickSettings = settings, leadIn = 0) => {
    const chosen = lickFor(layout)
    const shape: LickShape | null = chosen ? lickShape(chosen.chart) : null
    return shape ? withLick(chart, shape, { ...layout, leadIn }) : chart
  }, [lickFor, settings])
  // Each sheet of an infinite line starts with a bar of rest: time to look back at the top
  const leadIn = mode === 'infinite' ? CHUNK_LEAD_IN : 0
  const chart = useMemo(() => (source ? withShape(source, settings, leadIn) : null), [source, withShape, settings, leadIn])

  const style = getStyle(styleId)
  const position = timeline ? playbackPosition(timeline, beat) : null
  const currentChorus = position?.chorus ?? 0
  const shownTranspose = playing ? chorusTranspose(transpose, practice.keyStep, currentChorus) : transpose
  const liveBpm = Math.min(BPM_RANGE[1], bpm + practice.ramp * Math.min(currentChorus, choruses - 1))
  const liveBpmRef = useRef(liveBpm)
  useEffect(() => { liveBpmRef.current = liveBpm }, [liveBpm])

  /** Keep the settings, on this device too. */
  const setSettings = (change: Partial<LickSettings>) => {
    const next = { ...settings, ...change }
    setSettingsState(next)
    saveJson(SETTINGS_KEY, next)
    return next
  }

  /**
   * Start a prepared chart: the judge, the sheet and the band move to it together. From
   * `fromSeconds` (MIDI time) the band and the judge go on where they are (new keys).
   */
  const startPrepared = useCallback(async (prepared: Prepared, keepScore: boolean, layout = settings, fromSeconds = 0) => {
    const player = playerRef.current
    if (!player) return
    if (fromSeconds > 0) resume(prepared.notes, layout, fromSeconds * BASE_BPM / 60)
    else {
      begin(prepared.notes, layout, keepScore)
      setBeat(0)
    }
    chunkEndRef.current = prepared.arrangement.timeline.totalBeats
    chunkCountInRef.current = prepared.countIn ?? true
    switchedRef.current = false
    setTimeline(prepared.arrangement.timeline)
    await player.play(prepared.arrangement.midi, fromSeconds)
    player.setRate(liveBpmRef.current / BASE_BPM)
    setPlaying(true)
  }, [begin, resume, settings])

  /** Arrange and play a song with the lick over it. */
  const startPlayback = useCallback(async (nextChart: ChartData, nextStyle = styleId, nextPattern = patternId,
    nextTranspose = transpose, nextChoruses = choruses, nextPractice = practice, nextSettings = settings, fromSeconds = 0) => {
    try {
      await startPrepared(prepare(nextChart, nextStyle, nextPattern, nextTranspose, nextChoruses, nextPractice, nextSettings), false,
        nextSettings, fromSeconds)
    } catch (cause) {
      setError(String(cause))
      reportError(cause, 'lick sight-reading playback')
    }
  }, [styleId, patternId, transpose, choruses, practice, settings, startPrepared])

  /** The next chunk of an infinite line, with the lick written over it. */
  const nextChunk = useCallback((after: InfiniteLine | null, layout: LickSettings, countIn: boolean,
    nextStyle = styleId, nextPattern = patternId): Prepared | null => {
    if (!bank) return null
    const next = infiniteLine(bank.progressions, {}, false, Math.random, after?.steps.at(-1), CHUNK_GROUPS, 1)
    const prepared = prepare(withShape(next.chart, layout, CHUNK_LEAD_IN), nextStyle, nextPattern, 0, 1, NO_PRACTICE, layout, { countIn })
    return { ...prepared, line: next, countIn }
  }, [bank, styleId, patternId, withShape])

  /** Hand over to the next chunk of the infinite line (prepared while the band plays, when it could be). */
  const switchToNext = useCallback(async () => {
    if (!continueRef.current) return
    switchedRef.current = true
    settleThrough(Infinity)
    const prepared = pendingRef.current ?? nextChunk(lineRef.current, settings, false)
    pendingRef.current = null
    if (!prepared?.line) return
    lineRef.current = prepared.line
    setLine(prepared.line)
    try {
      await startPrepared(prepared, true)
      window.setTimeout(() => { if (continueRef.current) pendingRef.current = nextChunk(prepared.line!, settings, false) }, 0)
    } catch (cause) {
      setError(String(cause))
      continueRef.current = false
    }
  }, [nextChunk, settings, settleThrough, startPrepared])

  const readiness = usePlayer(playerRef, () => {
    settleThrough(Infinity)
    setPlaying(false)
    if (continueRef.current && !switchedRef.current) void switchToNext()
  }, () => STYLES.map(warmUpMidi))
  const mixer = useMixer(playerRef, readiness)

  useEffect(() => { playerRef.current?.setRate(liveBpm / BASE_BPM) }, [liveBpm])

  useHeardBeat(playing, playerRef, (currentBeat) => {
    setBeat(currentBeat)
    settleThrough(currentBeat)
    // The switch follows the synthesizer's clock, which runs ahead of what is heard
    const player = playerRef.current
    if (mode === 'infinite' && continueRef.current && !switchedRef.current && player &&
        (player.position + SWITCH_LEAD_SECONDS) * BASE_BPM / 60 >= chunkEndRef.current) void switchToNext()
  })

  useEffect(() => {
    // Saved chord charts, the licks, the catalog's progressions and the progression bank
    let active = true
    const controller = new AbortController()
    void Promise.all([loadTunes(), loadBundledLeadSheets({ licks: true })])
      .then(([saved, bundled]) => {
        if (!active) return
        // Chord charts only: the saved ones (lead sheets are left out) and the catalog, searched in the list
        setTunes(saved.filter((t) => !hasMelody(t.chart)))
        setLicks(bundled.filter((t) => isOneChordLick(t.chart)))
      })
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

  /** Stop the band (an infinite line stops going on); the notes already due are settled. */
  const stop = () => {
    continueRef.current = false
    pendingRef.current = null
    settleThrough((playerRef.current?.heardPosition ?? 0) * BASE_BPM / 60)
    playerRef.current?.stop()
    setPlaying(false)
  }

  /** Open a song with its tempo and style. */
  const openTune = (next: Tune) => {
    stop()
    clear()
    setTimeline(null)
    setBeat(0)
    setTune(next)
    setLibraryOpen(false)
    setStyleId(next.chart.style)
    setPatternId(defaultPatternForStyle(next.chart.style))
    setBpm(Math.max(BPM_RANGE[0], Math.min(BPM_RANGE[1], next.chart.bpm)))
    setTranspose(transposeFor(keyChoice, next.chart))
    setPractice(NO_PRACTICE)
    setError('')
  }

  /** Fetch a song of the catalog, as the players do. */
  const loadChoco = async (id: string) => {
    const loaded = await fetchChocoTune(id)
    setTunes((current) => [...current.filter((item) => item.id !== loaded.id), loaded])
    openTune(loaded)
  }

  /** Import chord charts (saved for every screen, the Chord Player too) and open the first one. */
  const importFrom = async (source: ImportSource, text: string): Promise<ImportResult> => {
    const { added, result } = await importTunes(source, text)
    const ids = new Set(added.map((item) => item.id))
    setTunes((current) => [...current.filter((item) => !ids.has(item.id)), ...added])
    if (added[0]) openTune(added[0])
    return result
  }

  /** Open a random song of the catalog, containing a chosen progression if one is chosen. */
  const chooseRandomSong = async () => {
    try {
      const group = await randomSong(progressionId)
      await loadChoco(group.id)
    } catch (cause) {
      setError(String(cause))
    }
  }

  /** Start a new infinite line of progressions with the lick over it. */
  const startInfinite = async (layout = settings) => {
    stop()
    clear()
    try {
      const prepared = nextChunk(null, layout, true)
      if (!prepared?.line) return
      lineRef.current = prepared.line
      setLine(prepared.line)
      setTranspose(0)
      setPractice(NO_PRACTICE)
      continueRef.current = true
      await startPrepared(prepared, false, layout)
      window.setTimeout(() => { if (continueRef.current) pendingRef.current = nextChunk(prepared.line!, layout, false) }, 0)
    } catch (cause) {
      setError(String(cause))
    }
  }

  /** Switch between the three sources of chords; a picked or random song stays when moving between those two. */
  const chooseMode = (next: Mode) => {
    if (next === 'pick' && mode === 'pick') {
      setLibraryOpen((current) => !current)
      return
    }
    if (next !== 'infinite' && mode !== 'infinite') {
      setMode(next)
      setLibraryOpen(next === 'pick')
      return
    }
    stop()
    clear()
    setTimeline(null)
    setBeat(0)
    setMode(next)
    setLibraryOpen(next === 'pick')
    setError('')
    if (next !== 'infinite') setTune(null)
  }

  /**
   * Change what the band plays, how notes are judged or the lick. A new style or piano pattern
   * goes on from where the band is (the lick's eighths swing as the new style does); any other
   * change starts the song again, so the score stays fair.
   */
  const changeArrangement = (nextStyle: string, nextPattern: string | null, nextTranspose: number,
    nextChoruses = choruses, nextPractice = practice, nextSettings = settings) => {
    setStyleId(nextStyle)
    setPatternId(nextPattern)
    setTranspose(nextTranspose)
    setChoruses(nextChoruses)
    setPractice(nextPractice)
    const player = playerRef.current
    if (!playing || !source || !player) return
    const soundOnly = nextTranspose === transpose && nextChoruses === choruses && nextPractice === practice && nextSettings === settings
    if (soundOnly) {
      settleThrough(player.heardPosition * BASE_BPM / 60)
      const from = player.position
      if (mode === 'infinite') {
        // The chunk on the stand is arranged again in the new style; the next one is prepared again
        pendingRef.current = null
        const current = prepare(withShape(source, settings, CHUNK_LEAD_IN), nextStyle, nextPattern, 0, 1, NO_PRACTICE, settings, { countIn: chunkCountInRef.current })
        void startPrepared({ ...current, line: lineRef.current ?? undefined, countIn: chunkCountInRef.current }, true, settings, from).then(() => {
          const playingLine = lineRef.current
          if (continueRef.current && playingLine) pendingRef.current = nextChunk(playingLine, settings, false, nextStyle, nextPattern)
        })
      } else void startPlayback(withShape(source), nextStyle, nextPattern, transpose, choruses, practice, settings, from)
      return
    }
    if (mode === 'infinite') void startInfinite(nextSettings)
    else void startPlayback(withShape(source, nextSettings), nextStyle, nextPattern, nextTranspose, nextChoruses, nextPractice, nextSettings)
  }

  /**
   * Change the practice settings: a new loop starts over, new keys go on from where the band is
   * (with the choruses they need), a tempo ramp only changes the tempo.
   */
  const changePractice = (next: PracticeSettings) => {
    const change = practiceChange(practice, next)
    const nextChoruses = chorusesForKeys(practice, next, choruses)
    const player = playerRef.current
    if (change !== 'keys' || !playing || !source || !player) {
      if (change === 'loop') changeArrangement(styleId, patternId, transpose, nextChoruses, next)
      else { setPractice(next); setChoruses(nextChoruses) }
      return
    }
    settleThrough(player.heardPosition * BASE_BPM / 60)
    setPractice(next)
    setChoruses(nextChoruses)
    void startPlayback(withShape(source), styleId, patternId, transpose, nextChoruses, next, settings, player.position)
  }

  /** Change a setting (it restarts a playing song, so the score stays fair). */
  const changeSettings = (change: Partial<LickSettings>) => {
    changeArrangement(styleId, patternId, transpose, choruses, practice, setSettings(change))
  }

  /** Choose another lick at random, from all the one-chord licks. */
  const randomLick = () => {
    const others = licks.filter((item) => item.id !== lick?.id)
    if (others.length) changeSettings({ lickId: others[Math.floor(Math.random() * others.length)].id })
  }

  /** Choose the key for this song and the next ones. */
  const chooseKey = (choice: KeyChoice) => {
    setKeyChoice(choice)
    if (tune) changeArrangement(styleId, patternId, transposeFor(choice, tune.chart))
  }

  /** Set a practice loop from two clicks on the sheet. */
  const chooseLoopBar = (index: number) => {
    if (pickLoop === 'first') setPickLoop(index)
    else if (typeof pickLoop === 'number') {
      changeArrangement(styleId, patternId, transpose, choruses,
        { ...practice, loop: [Math.min(pickLoop, index), Math.max(pickLoop, index)] })
      setPickLoop(null)
    }
  }

  // Licks grouped by playlist, for the two lick menus
  const groups = useMemo(() => [...new Set(licks.map((item) => item.playlist ?? ''))], [licks])
  const group = lick?.playlist ?? groups[0] ?? ''
  const inGroup = licks.filter((item) => (item.playlist ?? '') === group)
  const lickInfo = lick?.chart.lick
  const lickSymbol = lick ? lick.chart.bars.flatMap((bar) => bar.chords).find((c) => c.symbol)?.symbol : null

  const keyPc = chart ? (chart.key + transpose + 12) % 12 : 0
  const heldKey = chart ? (chart.key + shownTranspose + 12) % 12 : 0
  const noteNames = [...keyboard.held].sort((a, b) => a - b).map((note) =>
    `${spellRoot(note % 12, heldKey).replace('b', '\u266d').replace('#', '\u266f')}${Math.floor(note / 12) - 1}`)
  const judged = score.correct + score.wrong + score.missed
  const positionLabel = !chart ? 'Choose a song or start an infinite line' :
    playing && timeline && beat < timeline.countIn ? 'Count-in' :
      position ? `Bar\u00a0${position.measure + 1}\u00a0of\u00a0${chart.bars.length}${judged ? `  ${score.correct}/${judged}\u00a0right` : ''}` : chart.title
  const patterns = patternsForStyle(styleId).length ? patternsForStyle(styleId) : PIANO_PATTERNS

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

  // The Android back button closes the song drawer and stops loop picking
  const drawer = useDrawerScreen()
  useBackClose(drawer && mode === 'pick' && libraryOpen, () => setLibraryOpen(false))
  useBackClose(pickLoop !== null, () => setPickLoop(null))

  return (
    <div className="app sightreading">
      <header className="topbar">
        <Wordmark>Lick Sightreading</Wordmark>
        <span className="topbar-spacer" />
        <DisplayMenu autoScroll />
        <MidiButton keyboard={keyboard} />
        {mode === 'pick' && <button className="tunes-toggle" aria-expanded={libraryOpen}
          onClick={() => setLibraryOpen((current) => !current)}>Songs</button>}
      </header>

      <div className="sight-mode" role="group" aria-label="Where the chords come from">
        <button className="chip" aria-pressed={mode === 'pick'} onClick={() => chooseMode('pick')}>Pick a song</button>
        <button className="chip" aria-pressed={mode === 'random'} onClick={() => chooseMode('random')}>Random song</button>
        <button className="chip" aria-pressed={mode === 'infinite'} onClick={() => chooseMode('infinite')}>Infinite progressions</button>
      </div>

      <div className={mode === 'pick' ? `workspace${libraryOpen ? ' library-open' : ''}` : 'sight-workspace'}>
        {mode === 'pick' && <Library tunes={tunes} selectedId={tune?.id ?? ''}
          onSelect={(id) => { const selected = tunes.find((item) => item.id === id); if (selected) openTune(selected) }}
          onLoadChoco={loadChoco} onImport={() => setImportOpen(true)} />}
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
              disabled={!bank || !lick || readiness.kind !== 'ready'}>New infinite line</button>
          </div>}
          <div className="sight-picker lick-picker">
            <label className="control"><span className="label">Licks</span>
              <select className="select" value={group} aria-label="Lick group" onChange={(event) => {
                const first = licks.find((item) => (item.playlist ?? '') === event.target.value)
                if (first) changeSettings({ lickId: first.id })
              }}>
                {groups.map((name) => <option key={name} value={name}>{shortGroup(name)}</option>)}
              </select>
            </label>
            <label className="control"><span className="label">Lick</span>
              <select className="select" value={lick?.id ?? ''} aria-label="Lick" onChange={(event) => changeSettings({ lickId: event.target.value })}>
                {inGroup.map((item) => <option key={item.id} value={item.id} title={item.chart.composer}>{item.chart.title}</option>)}
              </select>
            </label>
            <button className="chip" onClick={randomLick} disabled={licks.length < 2}>Random lick</button>
            <button className="chip" aria-pressed={settings.rest} onClick={() => changeSettings({ rest: !settings.rest })}
              title="Leave a rest as long as the lick after each lick">
              Rest between licks: {settings.rest ? 'On' : 'Off'}
            </button>
            {lick && <p className="sight-hint lick-source">
              {lick.chart.title}{lickInfo?.tune ? ` (${lickInfo.performer ? `${lickInfo.performer}, ` : ''}${lickInfo.tune}, bar ${lickInfo.bar})` : ''}
              {lickSymbol ? `, over ${lickSymbol.replace(/\^/g, '\u0394').replace(/h7/, '\u00f87')}` : ''}
              {lickChord(lick.chart) ? '. It is written again over every chord: chord tones stay chord tones.' : ''}
            </p>}
          </div>
          {chart && <LeadSheet chart={chart} style={style} transpose={shownTranspose}
            activeMeasure={position && position.measure >= 0 ? position.measure : null}
            beatInBar={position ? beat - position.start : 0} barBeats={position?.beats ?? 4}
            range={typeof pickLoop === 'number' ? [pickLoop, pickLoop] : practice.loop}
            onBarClick={pickLoop === null ? undefined : chooseLoopBar} autoScroll={playing}
            noteFeedback={feedback} />}
          {chart && <MelodyScoreLine score={score} total={total} bpm={liveBpm} />}
          {chart && <p className="sight-hint">Play the lick on your keyboard over each chord as the band plays. Green: right; orange: wrong note; red: missed.</p>}
          {!chart && mode === 'pick' && <p className="sight-hint">Choose a chord chart (search the ChoCo catalog, or your own imported iReal Pro charts) and a lick: the lick is written over every chord of the chart.</p>}
          {!licks.length && <p className="sight-hint">Loading the licks...</p>}
          <p className="sight-midi-status" role="status">MIDI notes held: {noteNames.length ? noteNames.join(' \u00b7 ') : 'none'}</p>
        </main>
      </div>

      {chart && <Transport readiness={readiness} playing={playing}
        onToggle={() => playing ? stop() : mode === 'infinite' ? void startInfinite() : void startPlayback(chart)}
        position={positionLabel} styleId={styleId}
        onStyle={(id) => changeArrangement(id, defaultPatternForStyle(id), transpose)}
        pianoPatternId={patternId} pianoPatterns={patterns}
        onPianoPattern={(id) => changeArrangement(styleId, id, transpose)}
        keyPc={keyPc} onKey={(pc) => chooseKey(pc)} keyControl={keyControl}
        bpm={bpm} bpmRange={BPM_RANGE} onBpm={setBpm}
        choruses={mode === 'infinite' ? 1 : choruses} maxChoruses={mode === 'infinite' ? 1 : 24}
        onChoruses={(count) => changeArrangement(styleId, patternId, transpose, count)}>
        <ReadingPopover settings={settings} onChange={changeSettings} />
        {mode !== 'infinite' && <Practice chart={chart} settings={practice}
          onChange={changePractice}
          onPickLoop={() => setPickLoop('first')} />}
        <Mixer {...mixer(style.comp.program)} parts={settings.guide ? GUIDE_PARTS : BAND_PARTS} />
      </Transport>}
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} sources={CHORD_SOURCES} onImport={importFrom} />
    </div>
  )
}
