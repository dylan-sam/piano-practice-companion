import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '../audio/player'
import { MELODY_PARTS, useMixer } from '../audio/useMixer'
import { useHeardBeat, usePausedAt, usePlayer } from '../audio/usePlayer'
import { BASE_BPM, type Arrangement } from '../engine/arrange'
import type { MelodyOccurrence } from '../engine/melody'
import { defaultPatternForStyle, patternsForStyle, PIANO_PATTERNS } from '../engine/pianoPatterns'
import { barAtBeat, chorusKeyOffset, type Timeline } from '../engine/timeline'
import { warmUpMidi } from '../engine/warmup'
import { reportError } from '../errorReports'
import { loadBundledLeadSheets } from '../library/bundled'
import { loadTunes } from '../library/db'
import { CHORD_SOURCES } from '../library/importTunes'
import { useStoredSettings } from '../library/useStoredSettings'
import { hasMelody, type Chart as ChartData } from '../music/chart'
import { BPM_RANGE, applyPracticeChange, NO_PRACTICE, rampedBpm, type PracticeSettings } from '../music/practice'
import type { Tune } from '../music/songs'
import { getStyle, STYLES } from '../styles'
import { Wordmark } from '../ui/AppLink'
import { DisplayMenu } from '../ui/DisplayMenu'
import { ImportDialog } from '../ui/ImportDialog'
import { Mixer } from '../ui/Mixer'
import { Practice } from '../ui/Practice'
import { Substitutions } from '../ui/Substitutions'
import { useSubstitutedChart } from '../ui/useSubstitutedChart'
import { Transport } from '../ui/Transport'
import { CheckFilter } from '../ui/CheckFilter'
import { useLoopPicking } from '../ui/useLoopPicking'
import { ExerciseStatus, HeldNotes, KeyChoiceControl, RandomSongPicker } from './ExerciseControls'
import { isOneChordLick, lickChord, lickShape, withLick, type LickShape } from './lickReading'
import { transposeFor, type KeyChoice } from './nameProgression'
import { MidiButton, ReadingPopover, ReadingSheet } from './ReadingControls'
import { readingCount, readingHint, readingTally } from './readingText'
import { useLessonLink } from '../lessons/lessonLink'
import { useLessonOverride } from '../lessons/useLessonOverride'
import { useLessonGoal } from '../lessons/useLessonGoal'
import { LessonDone } from '../lessons/LessonDone'
import { infiniteLine, type InfiniteLine } from './sightReading'
import { useEndlessLine } from './useEndlessLine'
import { DEFAULT_READING, isReadingSettings, leftHandStage, useMelodyJudging, type ReadingSettings } from './useMelodyJudging'
import { useProgressionSources, useSongSource, type SourceMode } from './useSongSource'
import { useBand } from './useBand'
import { SongsToggle, SongWorkspace } from './SongWorkspace'
import { arrangeMelody } from './melodyReading'

// The settings of this screen, kept on this device: how notes are judged, the lick and its layout
interface LickSettings extends ReadingSettings {
  lickId: string
  rest: boolean // a rest as long as the lick between two licks
  lickGroups?: string[] // the lick playlists offered (none: all of them)
}
const SETTINGS_KEY = 'eartraining:lick-reading'
const DEFAULT_SETTINGS: LickSettings = { ...DEFAULT_READING, lickId: '', rest: false }
// An infinite chunk: progressions joined from the catalog, short enough to draw on the staff
const CHUNK_GROUPS = 12
const CHUNK_LEAD_IN = 1 // bars of rest at the top of each sheet of an infinite line, while the band plays
const INFINITE_GOAL_NOTES = 32 // an infinite line reaches a lesson's target after this many notes judged
// The three sources of chords
const SOURCES: { id: SourceMode; text: string }[] = [
  { id: 'pick', text: 'Pick a song' }, { id: 'random', text: 'Random song' }, { id: 'infinite', text: 'Infinite progressions' },
]

/** A lick playlist's name, short enough for the menu: "Licks: Arpeggios" is "Arpeggios". */
const shortGroup = (name: string) =>
  name.replace(/^Licks: /, '').replace(/^Licks from standards: /, 'Standards: ').replace(/^Licks from folk tunes: /, 'Folk: ')
/** A lick's level as dots, for the Lick menu: level 2 is "●●". */
const levelDots = (level = 1) => '\u25cf'.repeat(level)

/** Whether stored settings are usable. */
function isSettings(value: unknown): value is LickSettings {
  const v = value as Partial<LickSettings> | null
  return isReadingSettings(value) && typeof v?.lickId === 'string' && typeof v?.rest === 'boolean' &&
    (v.lickGroups === undefined || (Array.isArray(v.lickGroups) && v.lickGroups.every((g) => typeof g === 'string')))
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
 * Arrange a chart with its lick: the band plays the chords and the lick (at the Mixer's Melody volume). A chunk
 * of an infinite line (`chunk`) never ends like a song, since the next one follows at the top; only
 * the first chunk has a count-in.
 */
function prepare(chart: ChartData, styleId: string, patternId: string | null, transpose: number, choruses: number,
  practice: PracticeSettings, chunk?: { countIn: boolean }): Prepared {
  return { chart, ...arrangeMelody(chart, styleId, patternId, transpose, choruses, practice, chunk) }
}

/** Play one lick over every chord of a song or of an endless line of progressions, on a MIDI keyboard. */
export function LickSightreading() {
  const playerRef = useRef<Player | null>(null)
  // Where the band was paused: Play goes on from there, the notes before it judged already
  const { pausedAt, hold: holdPause, forget: forgetPause } = usePausedAt(playerRef)
  const lineRef = useRef<InfiniteLine | null>(null)
  const endless = useEndlessLine<Prepared>(playerRef)

  const [licks, setLicks] = useState<Tune[]>([])
  const [line, setLine] = useState<InfiniteLine | null>(null)
  const [error, setError] = useState('')
  const { catalog, bank } = useProgressionSources(setError)
  const [playing, setPlaying] = useState(false)
  const [beat, setBeat] = useState(0)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [stored, store] = useStoredSettings<LickSettings>(SETTINGS_KEY, DEFAULT_SETTINGS, isSettings)
  // Opened from a lesson step: its lick playlist (for this visit), an infinite line, its tempo and muted parts
  const lesson = useLessonLink()
  const [settings, setSettings] = useLessonOverride(stored, store, lesson && { lickGroups: lesson.playlist ? [lesson.playlist] : undefined })
  const band = useBand<string | null>(defaultPatternForStyle, BPM_RANGE)
  const { styleId, patternId, keyChoice, setKeyChoice, transpose, setTranspose, bpm, setBpm, choruses, setChoruses, practice, setPractice } = band

  const { keyboard, feedback, chordFeedback, settleThrough, begin, resume, clear, ...reading } = useMelodyJudging(playerRef)
  const source = useSongSource({
    playing, onError: setError, onLeave: clearStand,
    // A song comes with its style, tempo and key
    onOpen: (next) => {
      clearStand()
      band.takeSong(next.chart)
    },
  })
  const { mode, tune } = source
  useEffect(() => {
    if (lesson?.bpm) setBpm(lesson.bpm)
    if (lesson?.infinite) source.chooseMode('infinite')
    // Once, when the screen opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // A Practice loop picked on the sheet: tap its first bar, then its last
  const loopPicking = useLoopPicking((loop) => changeArrangement(styleId, patternId, transpose, choruses, { ...practice, loop }))

  // The licks of the checked lick playlists (all of them when none is checked)
  const licksIn = useCallback((groups: string[] = []) =>
    groups.length ? licks.filter((item) => groups.includes(item.playlist ?? '')) : licks, [licks])
  // The lick of some settings: the one chosen, else the first one offered
  const lickFor = useCallback((chosen: LickSettings) =>
    licks.find((item) => item.id === chosen.lickId) ?? licksIn(chosen.lickGroups)[0] ?? licks[0] ?? null, [licks, licksIn])
  const lick = lickFor(settings)
  const chords = mode === 'infinite' ? line?.chart ?? null : tune?.chart ?? null // the chart the lick goes over
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
  const chart = useMemo(() => (chords ? withShape(chords, settings, leadIn) : null), [chords, withShape, settings, leadIn])

  const style = getStyle(styleId)
  const position = timeline ? barAtBeat(timeline, beat) : null
  const currentChorus = position?.chorus ?? 0
  const shownTranspose = playing ? chorusKeyOffset(practice, currentChorus, transpose) : transpose
  const liveBpm = rampedBpm(bpm, practice, Math.min(currentChorus, choruses - 1), BPM_RANGE)
  const shownChart = useSubstitutedChart(chart, practice.subs, playing, currentChorus)
  const liveBpmRef = useRef(liveBpm)
  useEffect(() => { liveBpmRef.current = liveBpm }, [liveBpm])

  /**
   * Start a prepared chart: the judge, the sheet and the band move to it together. From
   * `fromSeconds` (MIDI time) the band and the judge go on where they are (new keys).
   */
  const startPrepared = useCallback(async (prepared: Prepared, keepScore: boolean, layout = settings, fromSeconds = 0) => {
    const player = playerRef.current
    if (!player) return
    forgetPause()
    if (fromSeconds > 0) resume(prepared.notes, prepared.arrangement, layout, fromSeconds * BASE_BPM / 60)
    else {
      begin(prepared.notes, prepared.arrangement, layout, keepScore)
      setBeat(0)
    }
    endless.started(prepared.arrangement.timeline.totalBeats, prepared.countIn ?? true)
    setTimeline(prepared.arrangement.timeline)
    // The next chunk of an infinite line waits on the second synthesizer (no gap at the hand-over)
    if (fromSeconds > 0) await player.play(prepared.arrangement.midi, fromSeconds)
    else await endless.play(prepared)
    player.setRate(liveBpmRef.current / BASE_BPM)
    setPlaying(true)
  }, [begin, resume, settings, endless, forgetPause])

  /** Arrange and play a song with the lick over it. */
  const startPlayback = useCallback(async (nextChart: ChartData, nextStyle = styleId, nextPattern = patternId,
    nextTranspose = transpose, nextChoruses = choruses, nextPractice = practice, nextSettings = settings, fromSeconds = 0) => {
    try {
      await startPrepared(prepare(nextChart, nextStyle, nextPattern, nextTranspose, nextChoruses, nextPractice), false,
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
    const prepared = prepare(withShape(next.chart, layout, CHUNK_LEAD_IN), nextStyle, nextPattern, 0, 1, NO_PRACTICE, { countIn })
    return { ...prepared, line: next, countIn }
  }, [bank, styleId, patternId, withShape])

  /** Hand over to the next chunk of the infinite line (prepared while the band plays, when it could be). */
  const switchToNext = useCallback(async () => {
    if (!endless.goesOn.current) return
    settleThrough(Infinity)
    const prepared = endless.take() ?? nextChunk(lineRef.current, settings, false)
    if (!prepared?.line) return
    lineRef.current = prepared.line
    setLine(prepared.line)
    try {
      await startPrepared(prepared, true)
      prepareAfter(prepared.line, settings)
    } catch (cause) {
      setError(String(cause))
      endless.stop()
    }
    // prepareAfter only reads refs and the latest nextChunk
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextChunk, settings, settleThrough, startPrepared, endless])

  /** Prepare the chunk after a line's last one, once the playing chunk has started. */
  function prepareAfter(after: InfiniteLine, layout: LickSettings, nextStyle = styleId, nextPattern = patternId) {
    window.setTimeout(() => {
      if (endless.goesOn.current) endless.prepare(nextChunk(after, layout, false, nextStyle, nextPattern))
    }, 0)
  }

  const readiness = usePlayer(playerRef, () => {
    settleThrough(Infinity)
    setPlaying(false)
    forgetPause()
    if (endless.missed()) void switchToNext()
  }, () => STYLES.map(warmUpMidi))
  const mixer = useMixer(playerRef, readiness, lesson?.mute)
  // The lesson's target: a whole song judged, or enough of an infinite line, right enough and fast enough
  const count = readingCount(reading)
  const complete = mode === 'infinite' ? count.judged >= INFINITE_GOAL_NOTES : count.total > 0 && count.judged >= count.total
  const reachedGoal = useLessonGoal(lesson, { right: count.right, judged: count.judged, complete, bpm: liveBpm })

  useEffect(() => { playerRef.current?.setRate(liveBpm / BASE_BPM) }, [liveBpm])

  useHeardBeat(playing, playerRef, (currentBeat) => {
    setBeat(currentBeat)
    settleThrough(currentBeat)
    if (mode === 'infinite' && endless.due()) void switchToNext()
  })

  useEffect(() => {
    // Saved chord charts and the licks, once per visit (the catalog is searched in the song list)
    let active = true
    void Promise.all([loadTunes(), loadBundledLeadSheets({ licks: true })])
      .then(([saved, bundled]) => {
        if (!active) return
        // Chord charts only: lead sheets are left out
        source.setTunes(saved.filter((t) => !hasMelody(t.chart)))
        setLicks(bundled.filter((t) => isOneChordLick(t.chart)))
      })
      .catch((cause) => { if (active) setError(String(cause)) })
    return () => { active = false }
    // Loaded once; setTunes is a state setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Stop the band (an infinite line stops going on); the notes already due are settled, and the next Play starts over. */
  function stop() {
    pauseBand()
    forgetPause()
  }

  /** Pause the band where it is (an infinite line waits): the notes already due are settled, and Play goes on from there. */
  function pauseBand() {
    holdPause()
    endless.stop()
    settleThrough((playerRef.current?.heardPosition ?? 0) * BASE_BPM / 60)
    playerRef.current?.stop()
    setPlaying(false)
  }

  /**
   * Arrange the band again and go on from `from` (MIDI time): the song, or the infinite line's
   * chunk on the stand, after which the line goes on (a new style while playing, or Play after a pause).
   */
  function goOnFrom(from: number, nextStyle = styleId, nextPattern = patternId, nextSettings = settings, nextChoruses = choruses) {
    if (!chords) return
    if (mode !== 'infinite') {
      void startPlayback(withShape(chords, nextSettings), nextStyle, nextPattern, transpose, nextChoruses, practice, nextSettings, from)
      return
    }
    // The chunk on the stand is arranged again; the next one is prepared again
    endless.prepare(null)
    endless.goesOn.current = true
    const countIn = endless.countIn.current
    const current = prepare(withShape(chords, settings, CHUNK_LEAD_IN), nextStyle, nextPattern, 0, 1, NO_PRACTICE, { countIn })
    void startPrepared({ ...current, line: lineRef.current ?? undefined, countIn }, true, nextSettings, from).then(() => {
      if (lineRef.current) prepareAfter(lineRef.current, nextSettings, nextStyle, nextPattern)
    })
  }

  /** Stop and forget the score and the timeline (another song or line goes on the stand). */
  function clearStand() {
    stop()
    clear()
    setTimeline(null)
    setBeat(0)
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
      endless.goesOn.current = true
      await startPrepared(prepared, false, layout)
      prepareAfter(prepared.line, layout)
    } catch (cause) {
      setError(String(cause))
    }
  }

  /**
   * Change what the band plays, how notes are judged or the lick. What leaves the sheet as it is
   * (style, piano pattern, what is checked, any octave, timing) and a new number of choruses go on
   * from where the band is (the lick's eighths swing as the new style does); a change of the sheet
   * (lick, rest, key, loop) starts the song again.
   */
  function changeArrangement(nextStyle: string, nextPattern: string | null, nextTranspose: number,
    nextChoruses = choruses, nextPractice = practice, nextSettings = settings) {
    band.set({ styleId: nextStyle, patternId: nextPattern, transpose: nextTranspose, choruses: nextChoruses, practice: nextPractice })
    const player = playerRef.current
    const sameSheet = nextSettings.lickId === settings.lickId && nextSettings.rest === settings.rest
    // A new number of choruses goes on too, as a new style does
    const soundOnly = sameSheet && nextTranspose === transpose && nextPractice === practice
    if (!soundOnly && !playing) forgetPause() // a paused band starts a changed sheet from its beginning
    if (!playing || !chords || !player) return
    if (soundOnly) {
      settleThrough(player.heardPosition * BASE_BPM / 60)
      goOnFrom(player.position, nextStyle, nextPattern, nextSettings, nextChoruses)
      return
    }
    if (mode === 'infinite') void startInfinite(nextSettings)
    else void startPlayback(withShape(chords, nextSettings), nextStyle, nextPattern, nextTranspose, nextChoruses, nextPractice, nextSettings)
  }

  /**
   * Change the practice settings: a new loop starts over, new keys go on from where the band is
   * (with the choruses they need), a tempo ramp only changes the tempo.
   */
  const changePractice = (next: PracticeSettings) => {
    const player = playerRef.current
    applyPracticeChange(practice, next, choruses, playing && !!chords && !!player, {
      restart: (changed, count) => changeArrangement(styleId, patternId, transpose, count, changed),
      goOn: (changed, count) => {
        settleThrough(player!.heardPosition * BASE_BPM / 60)
        setPractice(changed)
        setChoruses(count)
        void startPlayback(withShape(chords!), styleId, patternId, transpose, count, changed, settings, player!.position)
      },
      keep: (changed, count) => { setPractice(changed); setChoruses(count) },
    })
  }

  /** Change a setting: a new lick or rest starts the song again, the reading settings let it go on. */
  const changeSettings = (change: Partial<LickSettings>) => {
    changeArrangement(styleId, patternId, transpose, choruses, practice, setSettings(change))
  }

  /** Choose another lick at random, from the licks offered. */
  const randomLick = () => {
    const others = offered.filter((item) => item.id !== lick?.id)
    if (others.length) changeSettings({ lickId: others[Math.floor(Math.random() * others.length)].id })
  }

  /** Choose the key for this song and the next ones. */
  const chooseKey = (choice: KeyChoice) => {
    setKeyChoice(choice)
    if (tune) changeArrangement(styleId, patternId, transposeFor(choice, tune.chart))
  }

  // The Licks filter: the lick playlists, with how many licks each has
  const groups = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of licks) counts.set(item.playlist ?? '', (counts.get(item.playlist ?? '') ?? 0) + 1)
    return [...counts].map(([id, count]) => ({ id, label: shortGroup(id), count }))
  }, [licks])
  const checkedGroups = (settings.lickGroups ?? []).filter((g) => groups.some((o) => o.id === g))
  const offered = licksIn(checkedGroups)
  /**
   * Offer the licks of other playlists: the lick stays when it is still offered (the band goes
   * on), else the first lick offered takes its place.
   */
  const chooseGroups = (next: string[]) => {
    const still = licksIn(next)
    if (!lick || still.some((item) => item.id === lick.id) || !still.length) setSettings({ lickGroups: next })
    else changeSettings({ lickGroups: next, lickId: still[0].id })
  }
  const lickInfo = lick?.chart.lick
  const lickSymbol = lick ? lick.chart.bars.flatMap((bar) => bar.chords).find((c) => c.symbol)?.symbol : null

  const keyPc = chart ? (chart.key + transpose + 12) % 12 : 0
  const heldKey = chart ? (chart.key + shownTranspose + 12) % 12 : 0
  const positionLabel = !chart ? 'Choose a song or start an infinite line' :
    playing && timeline && beat < timeline.countIn ? 'Count-in' :
      position ? `Bar\u00a0${position.measure + 1}\u00a0of\u00a0${chart.bars.length}${readingTally(reading)}` : chart.title
  const patterns = patternsForStyle(styleId).length ? patternsForStyle(styleId) : PIANO_PATTERNS

  return (
    <div className="app sightreading">
      <header className="topbar">
        <Wordmark>Lick Sightreading</Wordmark>
        <span className="topbar-spacer" />
        <DisplayMenu autoScroll />
        <MidiButton keyboard={keyboard} />
        <SongsToggle source={source} />
      </header>

      <SongWorkspace source={source} modes={SOURCES} label="Where the chords come from" tunes={source.tunes} catalog>
          <ExerciseStatus error={error} readiness={readiness} keyboard={keyboard} />
          {source.shown === 'random' && <RandomSongPicker catalog={catalog} onChoose={(id) => void source.openRandomSong(id)} />}
          {source.shown === 'infinite' && <div className="sight-picker">
            <button className="button button-primary" onClick={() => void startInfinite()}
              disabled={!bank || !lick || readiness.kind !== 'ready'}>New infinite line</button>
          </div>}
          <div className="sight-picker lick-picker">
            <CheckFilter name="Licks" options={groups} chosen={checkedGroups} onChange={chooseGroups} />
            <label className="control"><span className="label">Lick</span>
              <select className="select" value={lick?.id ?? ''} aria-label="Lick" onChange={(event) => changeSettings({ lickId: event.target.value })}>
                {groups.filter((g) => !checkedGroups.length || checkedGroups.includes(g.id)).map((g) => (
                  <optgroup key={g.id} label={g.label}>
                    {offered.filter((item) => (item.playlist ?? '') === g.id).map((item) =>
                      <option key={item.id} value={item.id} title={item.chart.composer}>{levelDots(item.chart.lick?.level)} {item.chart.title}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <button className="chip" onClick={randomLick} disabled={offered.length < 2}>Random lick</button>
            <button className="chip" aria-pressed={settings.rest} onClick={() => changeSettings({ rest: !settings.rest })}
              title="Leave a rest as long as the lick after each lick">
              Rest between licks: {settings.rest ? 'On' : 'Off'}
            </button>
            {lick && <p className="sight-hint lick-source">
              {lick.chart.title}{lick.chart.composer ? ` (${lick.chart.composer})` : ''}, level {lickInfo?.level ?? 1}
              {lickSymbol ? `, over ${lickSymbol.replace(/\^/g, '\u0394').replace(/h7/, '\u00f87')}` : ''}
              {lickChord(lick.chart) ? '. It is written again over every chord: chord tones stay chord tones, and the numbers in its name are degrees of the chord it is played over (b: a half step under, #: a half step over).' : ''}
            </p>}
          </div>
          {reachedGoal && <LessonDone />}
          {shownChart && <ReadingSheet chart={shownChart} style={style} transpose={shownTranspose} position={position} beat={beat}
            playing={playing} loopPicking={loopPicking} loop={practice.loop} feedback={feedback} chordFeedback={chordFeedback} reading={reading}
            bpm={liveBpm} hint={readingHint(reading.checking, 'the lick over each chord', leftHandStage(settings))} />}
          {!chart && mode === 'pick' && <p className="sight-hint">Choose a chord chart (search the ChoCo catalog, or your own imported iReal Pro charts) and a lick: the lick is written over every chord of the chart.</p>}
          {!licks.length && <p className="sight-hint">Loading the licks...</p>}
          <HeldNotes held={keyboard.held} keyPc={heldKey} />
      </SongWorkspace>

      {chart && <Transport readiness={readiness} playing={playing}
        onToggle={() => playing ? pauseBand() : pausedAt !== null ? goOnFrom(pausedAt)
          : mode === 'infinite' ? void startInfinite() : void startPlayback(chart)}
        paused={pausedAt !== null} onRestart={() => mode === 'infinite' ? void startInfinite() : void startPlayback(chart)}
        position={positionLabel} styleId={styleId}
        onStyle={(id) => changeArrangement(id, defaultPatternForStyle(id), transpose)}
        pianoPatternId={patternId} pianoPatterns={patterns}
        onPianoPattern={(id) => changeArrangement(styleId, id, transpose)}
        keyPc={keyPc} onKey={(pc) => chooseKey(pc)}
        keyControl={<KeyChoiceControl choice={keyChoice} onChoose={chooseKey} sourceKey={tune?.chart.key ?? null}
          currentKey={keyPc} fixed={mode === 'infinite' ? 'Changes with the progression' : undefined} />}
        bpm={bpm} bpmRange={BPM_RANGE} onBpm={setBpm}
        choruses={mode === 'infinite' ? 1 : choruses} maxChoruses={mode === 'infinite' ? 1 : 24}
        onChoruses={(count) => changeArrangement(styleId, patternId, transpose, count)}>
        <ReadingPopover settings={settings} onChange={changeSettings} />
        {mode !== 'infinite' && <Practice chart={chart} settings={practice}
          onChange={changePractice}
          onPickLoop={loopPicking.start} />}
        {mode !== 'infinite' && <Substitutions practice={practice} onChange={changePractice} />}
        <Mixer {...mixer(style.comp.program)} parts={MELODY_PARTS} />
      </Transport>}
      <ImportDialog open={source.importOpen} onClose={() => source.setImportOpen(false)} sources={CHORD_SOURCES}
        onImport={(from, text) => source.importFrom(from, text)} />
    </div>
  )
}
