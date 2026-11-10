import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '../audio/player'
import { useMixer } from '../audio/useMixer'
import { useHeardBeat, usePlayer } from '../audio/usePlayer'
import { BASE_BPM } from '../engine/arrange'
import { defaultPatternForStyle, patternsForStyle, PIANO_PATTERNS } from '../engine/pianoPatterns'
import { barAtBeat, chorusTranspose, type Timeline } from '../engine/timeline'
import { warmUpMidi } from '../engine/warmup'
import { reportError } from '../errorReports'
import { loadBundledLeadSheets } from '../library/bundled'
import { loadTunes } from '../library/db'
import { LEAD_SOURCES } from '../library/importTunes'
import { useStoredSettings } from '../library/useStoredSettings'
import { hasMelody, type Chart as ChartData } from '../music/chart'
import { applyPracticeChange, rampedBpm, type PracticeSettings } from '../music/practice'
import type { Tune } from '../music/songs'
import { getStyle, STYLES } from '../styles'
import { Wordmark } from '../ui/AppLink'
import { DisplayMenu } from '../ui/DisplayMenu'
import { ImportDialog } from '../ui/ImportDialog'
import { Mixer } from '../ui/Mixer'
import { Practice } from '../ui/Practice'
import { Transport } from '../ui/Transport'
import { useLoopPicking } from '../ui/useLoopPicking'
import { ExerciseStatus, HeldNotes, KeyChoiceControl } from './ExerciseControls'
import { transposeFor, type KeyChoice } from './nameProgression'
import { MidiButton, ReadingPopover, ReadingSheet } from './ReadingControls'
import { DEFAULT_READING, isReadingSettings, readingParts, useMelodyJudging, type ReadingSettings } from './useMelodyJudging'
import { useSongSource } from './useSongSource'
import { useBand } from './useBand'
import { SongsToggle, SongWorkspace } from './SongWorkspace'
import { arrangeMelody } from './melodyReading'

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

/** Practice reading lead sheet melodies by playing them on a MIDI keyboard with the band. */
export function MelodySightreading({ kind }: { kind: ReadingKind }) {
  const words = KINDS[kind]
  const playerRef = useRef<Player | null>(null)

  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const [beat, setBeat] = useState(0)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [settings, setSettings] = useStoredSettings<ReadingSettings>(SETTINGS_KEY, DEFAULT_READING, isReadingSettings)
  const band = useBand<string | null>(defaultPatternForStyle, BPM_RANGE)
  const { styleId, patternId, keyChoice, setKeyChoice, transpose, bpm, setBpm, choruses, setChoruses, practice, setPractice } = band

  const { keyboard, feedback, score, total, settleThrough, begin, resume, clear } = useMelodyJudging(playerRef)
  const source = useSongSource({
    playing, onError: setError, onLeave: stop,
    // A lead sheet comes with its style, tempo and key
    onOpen: (next) => {
      stop()
      clear()
      setTimeline(null)
      setBeat(0)
      band.takeSong(next.chart)
    },
  })
  const { mode, tune } = source
  // A Practice loop picked on the sheet: tap its first bar, then its last
  const loopPicking = useLoopPicking((loop) => changeArrangement(styleId, patternId, transpose, choruses, { ...practice, loop }))

  // Only what this screen reads: lead sheets (shipped and saved), or the exercises and licks
  const leadSheets = useMemo(() => source.tunes.filter(readable(kind)), [source.tunes, kind])
  const chart = tune?.chart ?? null
  const style = getStyle(styleId)
  const position = timeline ? barAtBeat(timeline, beat) : null
  const currentChorus = position?.chorus ?? 0
  const shownTranspose = playing ? chorusTranspose(transpose, practice.keyStep, currentChorus) : transpose
  const liveBpm = rampedBpm(bpm, practice, Math.min(currentChorus, choruses - 1), BPM_RANGE)

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
      const { arrangement: { midi, timeline }, notes } = arrangeMelody(nextChart, nextStyle, nextPattern, nextTranspose,
        nextChoruses, nextPractice, nextSettings.guide)
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
      .then(([saved, bundled]) => { if (active) source.setTunes([...saved, ...bundled]) })
      .catch((cause) => { if (active) setError(String(cause)) })
    return () => { active = false }
    // setTunes is a state setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  /** Stop the band; the notes already due are settled. */
  function stop() {
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
   * piano pattern, guide melody, any octave, timing) goes on from where the band is, the notes
   * still to come judged the new way; a change of the sheet (key, choruses, loop) starts again.
   */
  function changeArrangement(nextStyle: string, nextPattern: string | null, nextTranspose: number,
    nextChoruses = choruses, nextPractice = practice, nextSettings = settings) {
    band.set({ styleId: nextStyle, patternId: nextPattern, transpose: nextTranspose, choruses: nextChoruses, practice: nextPractice })
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
  const judged = score.correct + score.wrong + score.missed
  const positionLabel = !chart ? 'Choose a lead sheet' :
    playing && timeline && beat < timeline.countIn ? 'Count-in' :
      position ? `Bar\u00a0${position.measure + 1}\u00a0of\u00a0${chart.bars.length}${judged ? `  ${score.correct}/${judged}\u00a0right` : ''}` : chart.title
  const patterns = patternsForStyle(styleId).length ? patternsForStyle(styleId) : PIANO_PATTERNS

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
        canImport={kind === 'lead-sheets'} modes={[{ id: 'pick', text: `Pick ${words.item === 'song' ? 'a' : 'an'} ${words.item}` },
          { id: 'random', text: `Random ${words.item}` }]}>
          <ExerciseStatus error={error} readiness={readiness} keyboard={keyboard} />
          {mode === 'random' && <div className="sight-picker">
            <button className="button button-primary" onClick={chooseRandomSong}
              disabled={!leadSheets.length}>Choose random {words.item}</button>
          </div>}
          {tune && <ReadingSheet chart={tune.chart} style={style} transpose={shownTranspose} position={position} beat={beat}
            playing={playing} loopPicking={loopPicking} loop={practice.loop} feedback={feedback} score={score} total={total}
            bpm={liveBpm} hint="Play the melody on your keyboard as the band plays. Green: right; orange: wrong note; red: missed." />}
          {!tune && mode === 'pick' && <p className="sight-hint">{words.choose}</p>}
          <HeldNotes held={keyboard.held} keyPc={heldKey} />
      </SongWorkspace>

      {chart && <Transport readiness={readiness} playing={playing}
        onToggle={() => playing ? stop() : void startPlayback(chart)}
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
        <Mixer {...mixer(style.comp.program)} parts={readingParts(settings.guide)} />
      </Transport>}
      {kind === 'lead-sheets' && <ImportDialog open={source.importOpen} onClose={() => source.setImportOpen(false)}
        sources={LEAD_SOURCES} onImport={(from, text) => source.importFrom(from, text, readable(kind))} />}
    </div>
  )
}
