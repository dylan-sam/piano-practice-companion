import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '../audio/player'
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
import { chorusesForKeys, NO_PRACTICE, practiceChange, type PracticeSettings } from '../music/practice'
import type { Tune } from '../music/songs'
import { getStyle, STYLES } from '../styles'
import { DisplayMenu } from '../ui/DisplayMenu'
import { Wordmark } from '../ui/AppLink'
import { ImportDialog, type ImportResult, type ImportSource } from '../ui/ImportDialog'
import { importTunes, LEAD_SOURCES } from '../library/importTunes'
import { LeadSheet } from '../ui/LeadSheet'
import { Library } from '../ui/Library'
import { Mixer } from '../ui/Mixer'
import { Practice } from '../ui/Practice'
import { Transport } from '../ui/Transport'
import { useBackClose } from '../ui/backButton'
import { useDrawerScreen } from '../ui/useNarrowScreen'
import { transposeFor, type KeyChoice } from './nameProgression'
import { MelodyScoreLine, MidiButton, ReadingPopover } from './ReadingControls'
import { DEFAULT_READING, isReadingSettings, useMelodyJudging, type ReadingSettings } from './useMelodyJudging'

type Mode = 'pick' | 'random'

const SETTINGS_KEY = 'eartraining:melody-reading'

/** What is read on this screen: lead sheets (songs), or the exercises and licks of the lick database. */
export type ReadingKind = 'lead-sheets' | 'exercises'

// The words of each kind
const KINDS: Record<ReadingKind, { title: string; item: string; items: string; empty: string; choose: string }> = {
  'lead-sheets': {
    title: 'Lead Sheet Sightreading', item: 'song', items: 'Songs', empty: 'No lead sheets found.',
    choose: 'Choose a lead sheet: the shipped OpenEWLD and Nottingham songs, or your own imported ones (Import: MuseScore MusicXML files).',
  },
  exercises: {
    title: 'Exercises Sightreading', item: 'exercise', items: 'Exercises', empty: 'No exercises found.',
    choose: 'Choose an exercise: triads, seventh chords, guide tones, scales, approach notes, intervals, rhythm, or a lick.',
  },
}

/** Whether a tune belongs on a reading screen: a lead sheet (with a melody, not a lick), or an exercise or lick. */
const readable = (kind: ReadingKind) => (tune: Tune) =>
  kind === 'exercises' ? !!tune.chart.lick : hasMelody(tune.chart) && !tune.chart.lick
const BPM_RANGE: [number, number] = [40, 300]
const BAND_PARTS: Part[] = ['bass', 'comp', 'drums']
const GUIDE_PARTS: Part[] = ['bass', 'comp', 'melody', 'drums']

/** Locate the written bar currently sounding in the band. */
function playbackPosition(timeline: Timeline, beat: number) {
  const bar = timeline.bars.findLast((item) => item.start <= beat)
  return bar && beat < timeline.totalBeats ? bar : null
}

/** Practice reading lead sheet melodies by playing them on a MIDI keyboard with the band. */
export function MelodySightreading({ kind }: { kind: ReadingKind }) {
  const words = KINDS[kind]
  const playerRef = useRef<Player | null>(null)

  const [mode, setMode] = useState<Mode>('pick')
  const [libraryOpen, setLibraryOpen] = useState(true)
  const [tunes, setTunes] = useState<Tune[]>([])
  const [tune, setTune] = useState<Tune | null>(null)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [beat, setBeat] = useState(0)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [settings, setSettingsState] = useState<ReadingSettings>(() => loadJson(SETTINGS_KEY, DEFAULT_READING, isReadingSettings))
  const [styleId, setStyleId] = useState('swing')
  const [patternId, setPatternId] = useState<string | null>(defaultPatternForStyle('swing'))
  const [keyChoice, setKeyChoice] = useState<KeyChoice>('song')
  const [transpose, setTranspose] = useState(0)
  const [bpm, setBpm] = useState(100)
  const [choruses, setChoruses] = useState(1)
  const [practice, setPractice] = useState<PracticeSettings>(NO_PRACTICE)
  const [pickLoop, setPickLoop] = useState<number | 'first' | null>(null)

  // Only lead sheets can be read: the shipped ones and saved charts with a melody
  const leadSheets = useMemo(() => tunes.filter(readable(kind)), [tunes, kind])
  const [importOpen, setImportOpen] = useState(false)
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

  const { keyboard, feedback, score, total, settleThrough, begin, resume, clear } = useMelodyJudging(playerRef)

  /**
   * Arrange the song for the full band (with the melody only as a guide) and start judging; from
   * `fromSeconds` (MIDI time) the band and the judge go on where they are instead of starting over.
   */
  const startPlayback = useCallback(async (
    nextChart: ChartData, nextStyle = styleId, nextPattern = patternId, nextTranspose = transpose,
    nextChoruses = choruses, nextPractice = practice, nextSettings = settings, fromSeconds = 0,
  ) => {
    const player = playerRef.current
    if (!player) return
    try {
      const options = { loop: nextPractice.loop, keyStep: nextPractice.keyStep }
      const style = getStyle(nextStyle)
      const { midi, timeline } = arrange(nextSettings.guide ? nextChart : withoutMelody(nextChart), style,
        nextTranspose, nextChoruses, options, nextPattern)
      const notes = melodyOccurrences(nextChart, timeline, style.swing, nextTranspose, nextPractice.keyStep)
      if (fromSeconds > 0) resume(notes, nextSettings, fromSeconds * BASE_BPM / 60)
      else {
        begin(notes, nextSettings)
        setBeat(0)
      }
      setTimeline(timeline)
      await player.play(midi, fromSeconds)
      player.setRate(liveBpm / BASE_BPM)
      setPlaying(true)
    } catch (cause) {
      setError(String(cause))
      reportError(cause, 'melody sight-reading playback')
    }
  }, [styleId, patternId, transpose, choruses, practice, settings, liveBpm, begin, resume])

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
    // Lead sheets: the shipped ones and the saved tunes; exercises: the lick database
    void Promise.all([kind === 'lead-sheets' ? loadTunes() : Promise.resolve([]), loadBundledLeadSheets({ licks: kind === 'exercises' })])
      .then(([saved, bundled]) => { if (active) setTunes([...saved, ...bundled]) })
      .catch((cause) => { if (active) setError(String(cause)) })
    return () => { active = false }
  }, [kind])

  /** Stop the band; the notes already due are settled. */
  const stop = () => {
    settleThrough((playerRef.current?.heardPosition ?? 0) * BASE_BPM / 60)
    playerRef.current?.stop()
    setPlaying(false)
  }

  /** Open a lead sheet with its tempo and style. */
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

  /** Import lead sheets (saved for every screen, the Lead Sheet Player too) and open the first one. */
  const importFrom = async (source: ImportSource, text: string): Promise<ImportResult> => {
    const { added, result } = await importTunes(source, text)
    const ids = new Set(added.map((item) => item.id))
    setTunes((current) => [...current.filter((item) => !ids.has(item.id)), ...added])
    const first = added.find(readable(kind))
    if (first) openTune(first)
    return result
  }

  /** Open a random lead sheet (or exercise) other than the one on the stand. */
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

  /**
   * Change what the band plays or how notes are judged. What leaves the sheet as it is (style,
   * piano pattern, guide melody, any octave, timing) goes on from where the band is, the notes
   * still to come judged the new way; a change of the sheet (key, choruses, loop) starts again.
   */
  const changeArrangement = (nextStyle: string, nextPattern: string | null, nextTranspose: number,
    nextChoruses = choruses, nextPractice = practice, nextSettings = settings) => {
    setStyleId(nextStyle)
    setPatternId(nextPattern)
    setTranspose(nextTranspose)
    setChoruses(nextChoruses)
    setPractice(nextPractice)
    const player = playerRef.current
    if (!playing || !chart || !player) return
    // The melody swings as the new style does; the guide melody joins or leaves the band
    const soundOnly = nextTranspose === transpose && nextChoruses === choruses && nextPractice === practice
    if (soundOnly) settleThrough(player.heardPosition * BASE_BPM / 60)
    void startPlayback(chart, nextStyle, nextPattern, nextTranspose, nextChoruses, nextPractice, nextSettings, soundOnly ? player.position : 0)
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
    settleThrough(player.heardPosition * BASE_BPM / 60)
    setPractice(next)
    setChoruses(nextChoruses)
    void startPlayback(chart, styleId, patternId, transpose, nextChoruses, next, settings, player.position)
  }

  /** Change a reading setting: a playing song goes on (the sheet stays the same). */
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
        <Wordmark>{words.title}</Wordmark>
        <span className="topbar-spacer" />
        <DisplayMenu autoScroll />
        <MidiButton keyboard={keyboard} />
        {mode === 'pick' && <button className="tunes-toggle" aria-expanded={libraryOpen}
          onClick={() => setLibraryOpen((current) => !current)}>{words.items}</button>}
      </header>

      <div className="sight-mode" role="group" aria-label="Sight-reading mode">
        <button className="chip" aria-pressed={mode === 'pick'} onClick={() => chooseMode('pick')}>Pick {words.item === 'song' ? 'a' : 'an'} {words.item}</button>
        <button className="chip" aria-pressed={mode === 'random'} onClick={() => chooseMode('random')}>Random {words.item}</button>
      </div>

      <div className={mode === 'pick' ? `workspace${libraryOpen ? ' library-open' : ''}` : 'sight-workspace'}>
        {mode === 'pick' && <Library tunes={leadSheets} selectedId={tune?.id ?? ''}
          onSelect={(id) => { const selected = leadSheets.find((item) => item.id === id); if (selected) openTune(selected) }}
          emptyText={words.empty} onImport={kind === 'lead-sheets' ? () => setImportOpen(true) : undefined} />}
        <main className="stage exercise-stage sight-stage" onClick={() => setLibraryOpen(false)}>
          {error && <p className="exercise-error" role="alert">{error}</p>}
          {readiness.kind === 'loading' && <p className="sight-hint">Loading sounds {Math.round(readiness.progress * 100)}%...</p>}
          {readiness.kind === 'error' && <p className="exercise-error" role="alert">{readiness.message}</p>}
          {keyboard.error && <p className="exercise-error" role="alert">{keyboard.error}</p>}
          {!keyboard.supported && <p className="sight-hint">This browser does not expose Web MIDI. A compatible browser or native MIDI input is needed to score notes.</p>}
          {mode === 'random' && <div className="sight-picker">
            <button className="button button-primary" onClick={chooseRandomSong}
              disabled={!leadSheets.length}>Choose random {words.item}</button>
          </div>}
          {tune && <LeadSheet chart={tune.chart} style={style} transpose={shownTranspose}
            activeMeasure={position && position.measure >= 0 ? position.measure : null}
            beatInBar={position ? beat - position.start : 0} barBeats={position?.beats ?? 4}
            range={typeof pickLoop === 'number' ? [pickLoop, pickLoop] : practice.loop}
            onBarClick={pickLoop === null ? undefined : chooseLoopBar} autoScroll={playing}
            noteFeedback={feedback} />}
          {tune && <MelodyScoreLine score={score} total={total} bpm={liveBpm} />}
          {tune && <p className="sight-hint">Play the melody on your keyboard as the band plays. Green: right; orange: wrong note; red: missed.</p>}
          {!tune && mode === 'pick' && <p className="sight-hint">{words.choose}</p>}
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
        <ReadingPopover settings={settings} onChange={changeSettings} />
        <Practice chart={chart} settings={practice}
          onChange={changePractice}
          onPickLoop={() => setPickLoop('first')} />
        <Mixer {...mixer(style.comp.program)} parts={settings.guide ? GUIDE_PARTS : BAND_PARTS} />
      </Transport>}
      {kind === 'lead-sheets' && <ImportDialog open={importOpen} onClose={() => setImportOpen(false)}
        sources={LEAD_SOURCES} onImport={importFrom} />}
    </div>
  )
}
