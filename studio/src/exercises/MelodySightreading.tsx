import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '../audio/player'
import { useMidiKeyboard } from '../audio/useMidiKeyboard'
import { useMixer } from '../audio/useMixer'
import { useHeardBeat, usePlayer } from '../audio/usePlayer'
import { arrange, BASE_BPM, type Part } from '../engine/arrange'
import { melodyOccurrences } from '../engine/melody'
import { defaultPatternForStyle, patternsForStyle, PIANO_PATTERNS } from '../engine/pianoPatterns'
import { chorusTranspose, type Timeline } from '../engine/timeline'
import { warmUpMidi } from '../engine/warmup'
import { reportError } from '../errorReports'
import { loadBundledLeadSheets } from '../library/bundled'
import { loadTunes } from '../library/db'
import { loadJson, saveJson } from '../library/storage'
import { prettyNoteName, spellRoot } from '../music/chords'
import { hasMelody, withoutMelody, type Chart as ChartData } from '../music/chart'
import { NO_PRACTICE, type PracticeSettings } from '../music/practice'
import type { Tune } from '../music/songs'
import { getStyle, STYLES } from '../styles'
import { DisplayMenu } from '../ui/DisplayMenu'
import { Wordmark } from '../ui/AppLink'
import { LeadSheet } from '../ui/LeadSheet'
import { Library } from '../ui/Library'
import { Mixer } from '../ui/Mixer'
import { Practice } from '../ui/Practice'
import { Transport } from '../ui/Transport'
import { useBackClose } from '../ui/backButton'
import { useDrawerScreen } from '../ui/useNarrowScreen'
import { transposeFor, type KeyChoice } from './nameProgression'
import {
  accuracy, averageOffsetMs, EMPTY_SCORE, MelodyJudge, noteKey, TIMING_WINDOWS,
  type MelodyScore, type NoteResult, type Strictness,
} from './melodyReading'

type Mode = 'pick' | 'random'

// The reading settings, kept on this device
interface ReadingSettings {
  strictness: Strictness
  anyOctave: boolean // a note counts in any octave (small keyboards, melodies written high or low)
  guide: boolean // the band also plays the melody
}
const SETTINGS_KEY = 'eartraining:melody-reading'
const DEFAULT_SETTINGS: ReadingSettings = { strictness: 'normal', anyOctave: true, guide: false }
const BPM_RANGE: [number, number] = [40, 300]
const BAND_PARTS: Part[] = ['bass', 'comp', 'drums']
const GUIDE_PARTS: Part[] = ['bass', 'comp', 'melody', 'drums']

/** Whether stored reading settings are usable. */
function isSettings(value: unknown): value is ReadingSettings {
  const v = value as Partial<ReadingSettings> | null
  return !!v && typeof v === 'object' && !!v.strictness && v.strictness in TIMING_WINDOWS &&
    typeof v.anyOctave === 'boolean' && typeof v.guide === 'boolean'
}

/** Locate the written bar currently sounding in the band. */
function playbackPosition(timeline: Timeline, beat: number) {
  const bar = timeline.bars.findLast((item) => item.start <= beat)
  return bar && beat < timeline.totalBeats ? bar : null
}

/** Practice reading lead sheet melodies by playing them on a MIDI keyboard with the band. */
export function MelodySightreading() {
  const playerRef = useRef<Player | null>(null)
  const judgeRef = useRef<MelodyJudge | null>(null)
  const scoringRef = useRef(false)

  const [mode, setMode] = useState<Mode>('pick')
  const [libraryOpen, setLibraryOpen] = useState(true)
  const [tunes, setTunes] = useState<Tune[]>([])
  const [tune, setTune] = useState<Tune | null>(null)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [beat, setBeat] = useState(0)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [feedback, setFeedback] = useState<Record<string, NoteResult>>({})
  const [score, setScore] = useState<MelodyScore>(EMPTY_SCORE)
  const [total, setTotal] = useState(0)
  const [settings, setSettingsState] = useState<ReadingSettings>(() => loadJson(SETTINGS_KEY, DEFAULT_SETTINGS, isSettings))
  const [styleId, setStyleId] = useState('swing')
  const [patternId, setPatternId] = useState<string | null>(defaultPatternForStyle('swing'))
  const [keyChoice, setKeyChoice] = useState<KeyChoice>('song')
  const [transpose, setTranspose] = useState(0)
  const [bpm, setBpm] = useState(100)
  const [choruses, setChoruses] = useState(1)
  const [practice, setPractice] = useState<PracticeSettings>(NO_PRACTICE)
  const [pickLoop, setPickLoop] = useState<number | 'first' | null>(null)

  // Only lead sheets can be read: the shipped ones and saved charts with a melody
  const leadSheets = useMemo(() => tunes.filter((t) => hasMelody(t.chart)), [tunes])
  const chart = tune?.chart ?? null
  const style = getStyle(styleId)
  const position = timeline ? playbackPosition(timeline, beat) : null
  const currentChorus = position?.chorus ?? 0
  const shownTranspose = playing ? chorusTranspose(transpose, practice.keyStep, currentChorus) : transpose
  const liveBpm = Math.min(BPM_RANGE[1], bpm + practice.ramp * Math.min(currentChorus, choruses - 1))

  /** Keep the reading settings, on this device too. */
  const setSettings = (change: Partial<ReadingSettings>) => {
    const next = { ...settings, ...change }
    setSettingsState(next)
    saveJson(SETTINGS_KEY, next)
    return next
  }

  /** Show the notes whose time has ended as wrong or missed. */
  const settleThrough = useCallback((targetBeat: number) => {
    const judge = judgeRef.current
    if (!judge) return
    const settled = judge.expire(targetBeat)
    if (!settled.length || !scoringRef.current) return
    setFeedback((current) => {
      const next = { ...current }
      for (const { note, result } of settled) next[noteKey(note.measure, note.at)] = result
      return next
    })
    setScore({ ...judge.score })
  }, [])

  /** Judge a key against the melody note due now, and sound it on the live piano. */
  const onNoteOn = useCallback((note: number, _held: Set<number>, velocity: number) => {
    const player = playerRef.current
    player?.liveNoteOn(note, velocity)
    const judge = judgeRef.current
    if (!player?.isPlaying || !judge || !scoringRef.current) return
    const press = judge.press(player.heardPosition * BASE_BPM / 60, note)
    if (press.note && press.result !== 'extra') {
      const key = noteKey(press.note.measure, press.note.at)
      setFeedback((current) => ({ ...current, [key]: press.result as NoteResult }))
    }
    setScore({ ...judge.score })
  }, [])
  /** Release the live piano note when a key lifts. */
  const onNoteOff = useCallback((note: number) => { playerRef.current?.liveNoteOff(note) }, [])
  const keyboard = useMidiKeyboard(onNoteOn, onNoteOff)
  useEffect(() => { scoringRef.current = keyboard.devices.length > 0 }, [keyboard.devices.length])

  /** Arrange the song for the full band (with the melody only as a guide) and start judging. */
  const startPlayback = useCallback(async (
    nextChart: ChartData, nextStyle = styleId, nextPattern = patternId, nextTranspose = transpose,
    nextChoruses = choruses, nextPractice = practice, nextSettings = settings,
  ) => {
    const player = playerRef.current
    if (!player) return
    try {
      const options = { loop: nextPractice.loop, keyStep: nextPractice.keyStep }
      const style = getStyle(nextStyle)
      const { midi, timeline } = arrange(nextSettings.guide ? nextChart : withoutMelody(nextChart), style,
        nextTranspose, nextChoruses, options, nextPattern)
      const notes = melodyOccurrences(nextChart, timeline, style.swing, nextTranspose, nextPractice.keyStep)
      judgeRef.current = new MelodyJudge(notes, TIMING_WINDOWS[nextSettings.strictness], nextSettings.anyOctave)
      setTimeline(timeline)
      setFeedback({})
      setScore(EMPTY_SCORE)
      setTotal(notes.length)
      setBeat(0)
      await player.play(midi)
      player.setRate(liveBpm / BASE_BPM)
      setPlaying(true)
    } catch (cause) {
      setError(String(cause))
      reportError(cause, 'melody sight-reading playback')
    }
  }, [styleId, patternId, transpose, choruses, practice, settings, liveBpm])

  const readiness = usePlayer(playerRef, () => {
    settleThrough(Infinity)
    setPlaying(false)
  }, () => STYLES.map(warmUpMidi))
  const mixer = useMixer(playerRef, readiness)

  useEffect(() => { playerRef.current?.setRate(liveBpm / BASE_BPM) }, [liveBpm])

  useHeardBeat(playing, playerRef, (currentBeat) => {
    setBeat(currentBeat)
    settleThrough(currentBeat)
  })

  useEffect(() => {
    // The shipped lead sheets and the saved tunes, once per visit
    let active = true
    void Promise.all([loadTunes(), loadBundledLeadSheets()])
      .then(([saved, bundled]) => { if (active) setTunes([...saved, ...bundled]) })
      .catch((cause) => { if (active) setError(String(cause)) })
    return () => { active = false }
  }, [])

  /** Stop the band; the notes already due are settled. */
  const stop = () => {
    settleThrough((playerRef.current?.heardPosition ?? 0) * BASE_BPM / 60)
    playerRef.current?.stop()
    setPlaying(false)
  }

  /** Open a lead sheet with its tempo and style. */
  const openTune = (next: Tune) => {
    stop()
    judgeRef.current = null
    setTimeline(null)
    setBeat(0)
    setTune(next)
    setLibraryOpen(false)
    setStyleId(next.chart.style)
    setPatternId(defaultPatternForStyle(next.chart.style))
    setBpm(Math.max(BPM_RANGE[0], Math.min(BPM_RANGE[1], next.chart.bpm)))
    setTranspose(transposeFor(keyChoice, next.chart))
    setPractice(NO_PRACTICE)
    setFeedback({})
    setScore(EMPTY_SCORE)
    setTotal(0)
    setError('')
  }

  /** Open a random lead sheet other than the one on the stand. */
  const chooseRandomSong = () => {
    const others = leadSheets.filter((t) => t.id !== tune?.id)
    if (others.length) openTune(others[Math.floor(Math.random() * others.length)])
  }

  /** Switch between picking a song and random songs; the song on the stand stays. */
  const chooseMode = (next: Mode) => {
    if (next === 'pick' && mode === 'pick') {
      setLibraryOpen((current) => !current)
      return
    }
    setMode(next)
    setLibraryOpen(next === 'pick')
  }

  /** Change what the band plays or how notes are judged; a playing song starts again with it. */
  const changeArrangement = (nextStyle: string, nextPattern: string | null, nextTranspose: number,
    nextChoruses = choruses, nextPractice = practice, nextSettings = settings) => {
    setStyleId(nextStyle)
    setPatternId(nextPattern)
    setTranspose(nextTranspose)
    setChoruses(nextChoruses)
    setPractice(nextPractice)
    if (playing && chart) void startPlayback(chart, nextStyle, nextPattern, nextTranspose, nextChoruses, nextPractice, nextSettings)
  }

  /** Change a reading setting (it restarts a playing song, so the score stays fair). */
  const changeSettings = (change: Partial<ReadingSettings>) => {
    const next = setSettings(change)
    changeArrangement(styleId, patternId, transpose, choruses, practice, next)
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

  const keyPc = chart ? (chart.key + transpose + 12) % 12 : 0
  const heldKey = chart ? (chart.key + shownTranspose + 12) % 12 : 0
  const noteNames = [...keyboard.held].sort((a, b) => a - b).map((note) =>
    `${spellRoot(note % 12, heldKey).replace('b', '\u266d').replace('#', '\u266f')}${Math.floor(note / 12) - 1}`)
  const percent = accuracy(score)
  const offset = averageOffsetMs(score, liveBpm)
  const judged = score.correct + score.wrong + score.missed
  const positionLabel = !chart ? 'Choose a lead sheet' :
    playing && timeline && beat < timeline.countIn ? 'Count-in' :
      position ? `Bar\u00a0${position.measure + 1}\u00a0of\u00a0${chart.bars.length}${judged ? `  ${score.correct}/${judged}\u00a0right` : ''}` : chart.title
  const patterns = patternsForStyle(styleId).length ? patternsForStyle(styleId) : PIANO_PATTERNS

  const keyControl = (
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
        <Wordmark>Melody Sightreading</Wordmark>
        <span className="topbar-spacer" />
        <DisplayMenu autoScroll />
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
      </div>

      <div className={mode === 'pick' ? `workspace${libraryOpen ? ' library-open' : ''}` : 'sight-workspace'}>
        {mode === 'pick' && <Library tunes={leadSheets} selectedId={tune?.id ?? ''}
          onSelect={(id) => { const selected = leadSheets.find((item) => item.id === id); if (selected) openTune(selected) }}
          emptyText="No lead sheets found." />}
        <main className="stage exercise-stage sight-stage" onClick={() => setLibraryOpen(false)}>
          {error && <p className="exercise-error" role="alert">{error}</p>}
          {readiness.kind === 'loading' && <p className="sight-hint">Loading sounds {Math.round(readiness.progress * 100)}%...</p>}
          {readiness.kind === 'error' && <p className="exercise-error" role="alert">{readiness.message}</p>}
          {keyboard.error && <p className="exercise-error" role="alert">{keyboard.error}</p>}
          {!keyboard.supported && <p className="sight-hint">This browser does not expose Web MIDI. A compatible browser or native MIDI input is needed to score notes.</p>}
          <div className="sight-picker">
            {mode === 'random' && <button className="button button-primary" onClick={chooseRandomSong}
              disabled={!leadSheets.length}>Choose random song</button>}
            <label className="control"><span className="label">Timing</span>
              <select className="select" value={settings.strictness}
                onChange={(event) => changeSettings({ strictness: event.target.value as Strictness })}>
                <option value="easy">Easy (within 0.4 beat)</option>
                <option value="normal">Normal (within 1/4 beat)</option>
                <option value="strict">Strict (within 1/8 beat)</option>
              </select>
            </label>
            <button className="chip" aria-pressed={settings.anyOctave} onClick={() => changeSettings({ anyOctave: !settings.anyOctave })}
              title="Count a note played in another octave than written">
              Any octave: {settings.anyOctave ? 'On' : 'Off'}
            </button>
            <button className="chip" aria-pressed={settings.guide} onClick={() => changeSettings({ guide: !settings.guide })}
              title="The band also plays the melody, to follow along">
              Guide melody: {settings.guide ? 'On' : 'Off'}
            </button>
          </div>
          {tune && <LeadSheet chart={tune.chart} style={style} transpose={shownTranspose}
            activeMeasure={position && position.measure >= 0 ? position.measure : null}
            beatInBar={position ? beat - position.start : 0} barBeats={position?.beats ?? 4}
            range={typeof pickLoop === 'number' ? [pickLoop, pickLoop] : practice.loop}
            onBarClick={pickLoop === null ? undefined : chooseLoopBar} autoScroll={playing}
            noteFeedback={feedback} />}
          {tune && <p className="melody-score" role="status" aria-label="Score">
            <span><strong className="score-correct">{score.correct}</strong> right</span>
            <span><strong className="score-wrong">{score.wrong}</strong> wrong note</span>
            <span><strong className="score-missed">{score.missed}</strong> missed</span>
            <span><strong>{score.extra}</strong> extra keys</span>
            {percent !== null && <span><strong>{percent} %</strong> of {judged}{total ? ` / ${total}` : ''} notes</span>}
            {offset !== null && <span>timing <strong>{offset > 0 ? `${offset} ms late` : offset < 0 ? `${-offset} ms early` : 'on time'}</strong> on average</span>}
          </p>}
          {tune && <p className="sight-hint">Play the melody on your keyboard as the band plays. Green: right; orange: wrong note; red: missed.</p>}
          {!tune && mode === 'pick' && <p className="sight-hint">Choose a lead sheet: the shipped OpenEWLD and Nottingham songs, or your own imported ones.</p>}
          <p className="sight-midi-status" role="status">MIDI notes held: {noteNames.length ? noteNames.join(' \u00b7 ') : 'none'}</p>
        </main>
      </div>

      {chart && <Transport readiness={readiness} playing={playing}
        onToggle={() => playing ? stop() : void startPlayback(chart)}
        position={positionLabel} styleId={styleId}
        onStyle={(id) => changeArrangement(id, defaultPatternForStyle(id), transpose)}
        pianoPatternId={patternId} pianoPatterns={patterns}
        onPianoPattern={(id) => changeArrangement(styleId, id, transpose)}
        keyPc={keyPc} onKey={(pc) => chooseKey(pc)} keyControl={keyControl}
        bpm={bpm} bpmRange={BPM_RANGE} onBpm={setBpm}
        choruses={choruses} maxChoruses={24}
        onChoruses={(count) => changeArrangement(styleId, patternId, transpose, count)}>
        <Practice chart={chart} settings={practice}
          onChange={(next) => changeArrangement(styleId, patternId, transpose, choruses, next)}
          onPickLoop={() => setPickLoop('first')} />
        <Mixer {...mixer(style.comp.program)} parts={settings.guide ? GUIDE_PARTS : BAND_PARTS} />
      </Transport>}
    </div>
  )
}
