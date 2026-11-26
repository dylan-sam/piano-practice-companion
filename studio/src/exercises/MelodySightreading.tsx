import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '../audio/player'
import { MELODY_PARTS, useMixer } from '../audio/useMixer'
import { useHeardBeat, usePausedAt, usePlayer } from '../audio/usePlayer'
import { BASE_BPM } from '../engine/arrange'
import { defaultPatternForStyle, patternsForStyle, PIANO_PATTERNS } from '../engine/pianoPatterns'
import { barAtBeat, chorusKeyOffset, type Timeline } from '../engine/timeline'
import { warmUpMidi } from '../engine/warmup'
import { reportError } from '../errorReports'
import { loadBundledLeadSheets } from '../library/bundled'
import { loadTunes } from '../library/db'
import { LEAD_SOURCES } from '../library/importTunes'
import { useStoredSettings } from '../library/useStoredSettings'
import { hasMelody, type Chart as ChartData } from '../music/chart'
import { BPM_RANGE, applyPracticeChange, rampedBpm, type PracticeSettings } from '../music/practice'
import type { Tune } from '../music/songs'
import { getStyle, STYLES } from '../styles'
import { Wordmark } from '../ui/AppLink'
import { DisplayMenu } from '../ui/DisplayMenu'
import { ImportDialog } from '../ui/ImportDialog'
import { Mixer } from '../ui/Mixer'
import { Practice } from '../ui/Practice'
import { Substitutions } from '../ui/Substitutions'
import { useSubstitutedChart } from '../ui/useSubstitutedChart'
import { useChorusEffects } from '../ui/effects'
import { Transport } from '../ui/Transport'
import { useLoopPicking } from '../ui/useLoopPicking'
import { ExerciseStatus, HeldNotes, KeyChoiceControl } from './ExerciseControls'
import { transposeFor, type KeyChoice } from './nameProgression'
import { MidiButton, ReadingPopover, ReadingSheet } from './ReadingControls'
import { readingCount, readingHint, readingTally } from './readingText'
import { useLessonLink } from '../lessons/lessonLink'
import { withFrameOf } from '../lessons/introEndings'
import { useLessonSong } from '../lessons/useLessonSong'
import { useLessonOverride } from '../lessons/useLessonOverride'
import { useLessonGoal } from '../lessons/useLessonGoal'
import { LessonDone } from '../lessons/LessonDone'
import { DEFAULT_READING, isReadingSettings, leftHandStage, useMelodyJudging, type ReadingSettings } from './useMelodyJudging'
import { useSongSource } from './useSongSource'
import { useBand } from './useBand'
import { SongsToggle, SongWorkspace } from './SongWorkspace'
import { arrangeMelody, averageOffsetMs } from './melodyReading'
import { buildExercise, categoryList, EXAMPLES, exerciseCategory, FAMILY_DEFAULTS, readSpec, type ExercisePreset, type ExerciseSpec } from './builder/exerciseBuilder'
import { presetOfTune, presetTune, usePresetTunes, useUserPresets } from './builder/exercisePresets'
import { ExerciseBuilder } from './builder/ExerciseBuilder'

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
    choose: 'Choose an exercise or a lick, or build your own (Build): arpeggios, scales, lines through a progression, approach notes, intervals, rhythm.',
  },
}

const LESSON_EXERCISE = 'lesson-exercise' // the tune id of an exercise a lesson step builds
const DRAFT = 'builder-draft' // the tune id of the exercise being built

/** An exercise built from its settings, as a tune of the list (named after its settings, in its category). */
function exerciseTune(id: string, spec: ExerciseSpec): Tune {
  return { id, source: 'example', playlist: categoryList(exerciseCategory(spec)), addedAt: 0, chart: buildExercise(spec) }
}

/** Whether a tune belongs on a reading screen: a lead sheet (with a melody, not a lick), or an exercise or lick. */
const readable = (kind: ReadingKind) => (tune: Tune) =>
  kind === 'exercises' ? !!tune.chart.lick : hasMelody(tune.chart) && !tune.chart.lick

/** Practice reading lead sheet melodies by playing them on a MIDI keyboard with the band. */
export function MelodySightreading({ kind }: { kind: ReadingKind }) {
  const words = KINDS[kind]
  const playerRef = useRef<Player | null>(null)
  // Where the band was paused: Play goes on from there, the notes before it judged already
  const { pausedAt, hold: holdPause, forget: forgetPause } = usePausedAt(playerRef)

  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [beat, setBeat] = useState(0)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [stored, store] = useStoredSettings<ReadingSettings>(SETTINGS_KEY, DEFAULT_READING, isReadingSettings)
  // Opened from a lesson step: its song, band, checking (for this visit) and muted parts
  const lesson = useLessonLink()
  const [settings, setSettings] = useLessonOverride(stored, store, lesson && { check: lesson.check, leftHand: lesson.leftHand })
  const band = useBand<string | null>(defaultPatternForStyle, BPM_RANGE)
  const { styleId, patternId, keyChoice, setKeyChoice, transpose, bpm, setBpm, choruses, setChoruses, practice, setPractice } = band

  const { keyboard, feedback, chordFeedback, settleThrough, begin, resume, clear, ...reading } = useMelodyJudging(playerRef)
  const source = useSongSource({
    playing, onError: setError, onLeave: stop,
    // A lead sheet comes with its style, tempo and key
    onOpen: (next) => {
      stop()
      clear()
      setTimeline(null)
      setBeat(0)
      band.takeSong(next.chart, lessonSong.bandFor(next.id))
    },
  })
  const { mode, tune } = source
  const [building, setBuilding] = useState(false) // the exercise builder is open
  const [editedPreset, setEditedPreset] = useState<string | null>(null) // the preset the builder's draft comes from
  // A Practice loop picked on the sheet: tap its first bar, then its last
  const loopPicking = useLoopPicking((loop) => changeArrangement(styleId, patternId, transpose, choruses, { ...practice, loop }))

  // Exercises: the examples and one's own presets, and the exercise a lesson step builds (locked)
  const presets = usePresetTunes()
  const ownPresets = useUserPresets()
  const lessonSpec = kind === 'exercises' && lesson?.exercise ? readSpec(lesson.exercise) : null
  const lessonTune = useMemo(() => (lessonSpec ? { ...exerciseTune(LESSON_EXERCISE, lessonSpec), chart: { ...buildExercise(lessonSpec), title: lesson?.song ?? '' } } : null),
    // the lesson's settings are read once per visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lesson?.exercise])
  // Only what this screen reads: lead sheets (shipped and saved), or the exercises and licks
  const leadSheets = useMemo(() => [...(lessonTune ? [lessonTune] : []), ...(kind === 'exercises' ? presets : []), ...source.tunes.filter(readable(kind))],
    [source.tunes, kind, presets, lessonTune])
  const lessonSong = useLessonSong(lesson, leadSheets, source.open)
  // A lesson's intro and ending: bars added before and after the head, for this visit only
  const chart = useMemo(() => tune ? withFrameOf(tune.chart, lesson?.frame) : null, [tune, lesson])
  const style = getStyle(styleId)
  const position = timeline ? barAtBeat(timeline, beat) : null
  const currentChorus = position?.chorus ?? 0
  const shownTranspose = playing ? chorusKeyOffset(practice, currentChorus, transpose) : transpose
  const liveBpm = rampedBpm(bpm, practice, Math.min(currentChorus, choruses - 1), BPM_RANGE)
  // The sheet of the chorus playing, its substitutions in a colour (a lesson step can ask for some)
  const shownChart = useSubstitutedChart(chart, practice.subs, playing, currentChorus)
  useChorusEffects(currentChorus, playing)

  /**
   * Arrange the song for the full band (the melody too, at the Mixer's Melody volume) and start judging; from
   * `fromSeconds` (MIDI time) the band and the judge go on where they are instead of starting over.
   */
  const startPlayback = useCallback(async (
    nextChart: ChartData, nextStyle = styleId, nextPattern = patternId, nextTranspose = transpose,
    nextChoruses = choruses, nextPractice = practice, nextSettings = settings, fromSeconds = 0,
  ) => {
    const player = playerRef.current
    if (!player) return
    try {
      const { arrangement, notes } = arrangeMelody(nextChart, nextStyle, nextPattern, nextTranspose,
        nextChoruses, nextPractice)
      const { midi, timeline } = arrangement
      if (fromSeconds > 0) resume(notes, arrangement, nextSettings, fromSeconds * BASE_BPM / 60)
      else {
        begin(notes, arrangement, nextSettings)
        setBeat(0)
      }
      setTimeline(timeline)
      forgetPause()
      await player.play(midi, fromSeconds)
      player.setRate(liveBpm / BASE_BPM)
      setPlaying(true)
    } catch (cause) {
      setError(String(cause))
      reportError(cause, 'melody sight-reading playback')
    }
  }, [styleId, patternId, transpose, choruses, practice, settings, liveBpm, begin, resume, forgetPause])

  const readiness = usePlayer(playerRef, () => {
    settleThrough(Infinity)
    setPlaying(false)
    forgetPause()
  }, () => STYLES.map(warmUpMidi))
  const mixer = useMixer(playerRef, readiness, lesson?.mute)
  // The lesson's target: the whole piece judged, right enough, fast enough
  const count = readingCount(reading)
  const reachedGoal = useLessonGoal(lesson, {
    right: count.right, judged: count.judged, complete: count.total > 0 && count.judged >= count.total, bpm: liveBpm,
    offsetMs: averageOffsetMs(reading.score, liveBpm),
  })

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
      .then(([saved, bundled]) => { if (active) source.setTunes([...saved, ...bundled]) })
      .catch((cause) => { if (active) setError(String(cause)) })
    return () => { active = false }
    // setTunes is a state setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  /** Stop the band; the notes already due are settled, and the next Play starts from the beginning. */
  function stop() {
    pauseBand()
    forgetPause()
  }

  /** Pause the band where it is: the notes already due are settled, and Play goes on from there. */
  function pauseBand() {
    holdPause()
    settleThrough((playerRef.current?.heardPosition ?? 0) * BASE_BPM / 60)
    playerRef.current?.stop()
    setPlaying(false)
  }

  /** Open a random lead sheet (or exercise) other than the one on the stand. */
  const chooseRandomSong = () => {
    const others = leadSheets.filter((t) => t.id !== tune?.id)
    if (others.length) source.open(others[Math.floor(Math.random() * others.length)])
  }

  /**
   * Change what the band plays or how notes are judged. What leaves the sheet as it is (style,
   * piano pattern, what is checked, any octave, timing) and a new number of choruses go on from
   * where the band is, the notes still to come judged the new way; a new key or loop starts again.
   */
  function changeArrangement(nextStyle: string, nextPattern: string | null, nextTranspose: number,
    nextChoruses = choruses, nextPractice = practice, nextSettings = settings) {
    band.set({ styleId: nextStyle, patternId: nextPattern, transpose: nextTranspose, choruses: nextChoruses, practice: nextPractice })
    const player = playerRef.current
    // The melody swings as the new style does
    // A new number of choruses goes on too, as a new style does
    const soundOnly = nextTranspose === transpose && nextPractice === practice
    if (!soundOnly && !playing) forgetPause() // a paused band starts a changed sheet from its beginning
    if (!playing || !chart || !player) return
    if (soundOnly) settleThrough(player.heardPosition * BASE_BPM / 60)
    void startPlayback(chart, nextStyle, nextPattern, nextTranspose, nextChoruses, nextPractice, nextSettings, soundOnly ? player.position : 0)
  }

  /**
   * Change the practice settings: a new loop starts over, new keys go on from where the band is
   * (with the choruses they need), a tempo ramp only changes the tempo.
   */
  const changePractice = (next: PracticeSettings) => {
    const player = playerRef.current
    applyPracticeChange(practice, next, choruses, playing && !!chart && !!player, {
      restart: (changed, count) => changeArrangement(styleId, patternId, transpose, count, changed),
      goOn: (changed, count) => {
        settleThrough(player!.heardPosition * BASE_BPM / 60)
        setPractice(changed)
        setChoruses(count)
        void startPlayback(chart!, styleId, patternId, transpose, count, changed, settings, player!.position)
      },
      keep: (changed, count) => { setPractice(changed); setChoruses(count) },
    })
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

  const keyPc = chart ? (chart.key + transpose + 12) % 12 : 0
  const heldKey = chart ? (chart.key + shownTranspose + 12) % 12 : 0
  const positionLabel = !chart ? 'Choose a lead sheet' :
    playing && timeline && beat < timeline.countIn ? 'Count-in' :
      position ? `Bar\u00a0${position.measure + 1}\u00a0of\u00a0${chart.bars.length}${readingTally(reading)}` : chart.title
  const patterns = patternsForStyle(styleId).length ? patternsForStyle(styleId) : PIANO_PATTERNS

  // The builder edits the exercise on the stand (its settings), and the preset it comes from: kept
  // while the settings change (the stand then shows the builder's draft)
  const presetId = tune && tune.id !== DRAFT ? presetOfTune(tune.id) : editedPreset
  const openPreset: ExercisePreset | null = presetId ? [...EXAMPLES, ...ownPresets].find((item) => item.id === presetId) ?? null : null
  if (tune && tune.id !== DRAFT && presetId !== editedPreset) setEditedPreset(presetId)
  const standSpec = (tune?.chart.lick?.spec && readSpec(tune.chart.lick.spec)) || FAMILY_DEFAULTS.arpeggio
  const builder = kind === 'exercises' && building && <ExerciseBuilder key={openPreset?.id ?? tune?.id ?? 'new'}
    spec={standSpec} preset={openPreset} locked={tune?.id === LESSON_EXERCISE}
    onChange={(next) => source.open(exerciseTune(DRAFT, next))}
    onSaved={(saved) => { const shown = presetTune(saved); if (shown) source.open(shown) }}
    onDeleted={() => setBuilding(false)} onClose={() => setBuilding(false)} />

  /** Open or close the builder; opened on an empty stand, it writes its first exercise there. */
  function toggleBuilder() {
    if (!building && !tune) source.open(exerciseTune(DRAFT, standSpec))
    setBuilding(!building)
  }

  return (
    <div className="app sightreading">
      <header className="topbar">
        <Wordmark>{words.title}</Wordmark>
        <span className="topbar-spacer" />
        <DisplayMenu autoScroll />
        <MidiButton keyboard={keyboard} />
        <SongsToggle source={source} text={words.items} />
      </header>

      <SongWorkspace source={source} label="Sight-reading mode" tunes={leadSheets} emptyText={words.empty}
        canImport={kind === 'lead-sheets'} categories={kind === 'exercises'}
        onNew={kind === 'exercises' ? toggleBuilder : undefined} newLabel="Build exercise" panel={builder || undefined} modes={[{ id: 'pick', text: `Pick ${words.item === 'song' ? 'a' : 'an'} ${words.item}` },
          { id: 'random', text: `Random ${words.item}` }]}>
          <ExerciseStatus error={error} readiness={readiness} keyboard={keyboard} />
          {mode === 'random' && <div className="sight-picker">
            <button className="button button-primary" onClick={chooseRandomSong}
              disabled={!leadSheets.length}>Choose random {words.item}</button>
          </div>}
          {tune && <ReadingSheet chart={shownChart!} style={style} transpose={shownTranspose} position={position} beat={beat}
            playing={playing} loopPicking={loopPicking} loop={practice.loop} feedback={feedback} chordFeedback={chordFeedback} reading={reading}
            bpm={liveBpm} hint={readingHint(reading.checking, 'the melody', leftHandStage(settings))} />}
          {reachedGoal && <LessonDone />}
          {lessonSong.missing && <p className="sight-hint">The lesson's {words.item}, {lessonSong.missing}, is not in the app yet: choose another one, or import it.</p>}
          {!tune && mode === 'pick' && <p className="sight-hint">{words.choose}</p>}
          <HeldNotes held={keyboard.held} keyPc={heldKey} />
      </SongWorkspace>

      {chart && <Transport readiness={readiness} playing={playing}
        onToggle={() => playing ? pauseBand() : void startPlayback(chart, styleId, patternId, transpose, choruses, practice, settings, pausedAt ?? 0)}
        paused={pausedAt !== null} onRestart={() => void startPlayback(chart)}
        position={positionLabel} styleId={styleId}
        onStyle={(id) => changeArrangement(id, defaultPatternForStyle(id), transpose)}
        pianoPatternId={patternId} pianoPatterns={patterns}
        onPianoPattern={(id) => changeArrangement(styleId, id, transpose)}
        keyPc={keyPc} onKey={(pc) => chooseKey(pc)}
        keyControl={<KeyChoiceControl choice={keyChoice} onChoose={chooseKey} sourceKey={tune?.chart.key ?? null} currentKey={keyPc} />}
        bpm={bpm} bpmRange={BPM_RANGE} onBpm={setBpm}
        choruses={choruses} maxChoruses={24}
        onChoruses={(count) => changeArrangement(styleId, patternId, transpose, count)}>
        <ReadingPopover settings={settings} onChange={changeSettings} />
        <Practice chart={chart} settings={practice}
          onChange={changePractice}
          onPickLoop={loopPicking.start} />
        <Substitutions practice={practice} onChange={changePractice} />
        <Mixer {...mixer(style.comp.program)} parts={MELODY_PARTS} />
      </Transport>}
      {kind === 'lead-sheets' && <ImportDialog open={source.importOpen} onClose={() => source.setImportOpen(false)}
        sources={LEAD_SOURCES} onImported={(added) => source.imported(added, readable(kind))} />}
    </div>
  )
}
