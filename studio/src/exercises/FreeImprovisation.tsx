// Free Improvisation: the band plays a chord chart (a song, a random song or an endless line of
// progressions) while you improvise on a MIDI keyboard. Each key is written out on the chart as
// you play, coloured by how it sits on the chord (improvisation.ts, toneColors.ts); the page is
// wiped at each new chorus.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '../audio/player'
import { BAND_PARTS, useMixer } from '../audio/useMixer'
import { useMidiKeyboard } from '../audio/useMidiKeyboard'
import { useHeardBeat, usePlayer } from '../audio/usePlayer'
import { BASE_BPM, type Arrangement } from '../engine/arrange'
import { defaultPatternForStyle, patternsForStyle, PIANO_PATTERNS } from '../engine/pianoPatterns'
import { barAtBeat, type Timeline } from '../engine/timeline'
import { warmUpMidi } from '../engine/warmup'
import { reportError } from '../errorReports'
import { loadBundledLeadSheets } from '../library/bundled'
import { loadTunes } from '../library/db'
import { useLessonLink } from '../lessons/lessonLink'
import { useLessonSong } from '../lessons/useLessonSong'
import { CHORD_SOURCES } from '../library/importTunes'
import { hasMelody, type Chart as ChartData } from '../music/chart'
import { NO_PRACTICE } from '../music/practice'
import { getStyle, STYLES } from '../styles'
import { Wordmark } from '../ui/AppLink'
import { DisplayMenu } from '../ui/DisplayMenu'
import { ImportDialog } from '../ui/ImportDialog'
import { LeadSheet } from '../ui/LeadSheet'
import { Mixer } from '../ui/Mixer'
import { Transport } from '../ui/Transport'
import { ExerciseStatus, HeldNotes, KeyChoiceControl, RandomSongPicker } from './ExerciseControls'
import { writeLine, type PlayedKey } from './improvisation'
import { arrangeMelody } from './melodyReading'
import { transposeFor, type KeyChoice } from './nameProgression'
import { MidiButton, ToneColorsLine } from './ReadingControls'
import { infiniteLine, type InfiniteLine } from './sightReading'
import { SongsToggle, SongWorkspace } from './SongWorkspace'
import { TONE_COLORS } from './toneColors'
import { useBand } from './useBand'
import { useEndlessLine } from './useEndlessLine'
import { useProgressionSources, useSongSource, type SourceMode } from './useSongSource'

const BPM_RANGE: [number, number] = [40, 300]
const CHUNK_GROUPS = 12 // progressions in each sheet of an infinite line
const SOURCES: { id: SourceMode; text: string }[] = [
  { id: 'pick', text: 'Pick a song' }, { id: 'random', text: 'Random song' }, { id: 'infinite', text: 'Infinite progressions' },
]
const HINT = 'Improvise over the chords as the band plays: nothing is right or wrong. Each key is written out and coloured ' +
  'by how it sits on the chord: black, a chord tone; green, a colour tone (9th, 13th...); blue, an approach tone (a half ' +
  'step into a chord or colour tone: it turns blue once you resolve it); red, outside. Keys played together write the highest. ' +
  'The page starts again at each chorus.'

/** A chord chart arranged for the band (its melody, if any, is left out), and the infinite line it comes from. */
interface Prepared {
  chart: ChartData
  arrangement: Arrangement
  line?: InfiniteLine
  countIn?: boolean
}

/** Arrange a chord chart for the band alone. */
function prepare(chart: ChartData, styleId: string, patternId: string | null, transpose: number, choruses: number,
  chunk?: { countIn: boolean }): Prepared {
  const { melody: _melody, ...chords } = chart
  return { chart: chords, arrangement: arrangeMelody(chords, styleId, patternId, transpose, choruses, NO_PRACTICE, chunk).arrangement }
}

/** Improvise freely over a chord chart with the band; every key is written out and coloured. */
export function FreeImprovisation() {
  const playerRef = useRef<Player | null>(null)
  const lineRef = useRef<InfiniteLine | null>(null)
  const endless = useEndlessLine<Prepared>(playerRef)
  const [line, setLine] = useState<InfiniteLine | null>(null)
  const [error, setError] = useState('')
  const { catalog, bank } = useProgressionSources(setError)
  const [playing, setPlaying] = useState(false)
  const [beat, setBeat] = useState(0)
  const [timeline, setTimeline] = useState<Timeline | null>(null)
  const [keys, setKeys] = useState<PlayedKey[]>([])
  const band = useBand<string | null>(defaultPatternForStyle, BPM_RANGE)
  const { styleId, patternId, keyChoice, setKeyChoice, transpose, setTranspose, bpm, setBpm, choruses } = band
  const source = useSongSource({
    playing, onError: setError, onLeave: clearStand,
    onOpen: (next) => {
      clearStand()
      band.takeSong(next.chart, lessonSong.bandFor(next.id))
    },
  })
  const { mode, tune } = source
  // Opened from a lesson step: its song (with its band), an infinite line, muted parts
  const lesson = useLessonLink()
  const lessonSong = useLessonSong(lesson, source.tunes, source.open)
  useEffect(() => {
    if (lesson?.infinite) source.chooseMode('infinite')
    // Once, when the screen opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const chords = mode === 'infinite' ? line?.chart ?? null : tune?.chart ?? null
  const style = getStyle(styleId)
  const position = timeline ? barAtBeat(timeline, beat) : null
  const chorus = position?.chorus ?? 0

  /** The beat the band is heard at, for a key going down or up now (null when the band is not playing). */
  const heardBeat = () => {
    const player = playerRef.current
    return player?.isPlaying ? player.heardPosition * BASE_BPM / 60 : null
  }
  // Each key down starts a note; its key up ends it
  const keyboard = useMidiKeyboard((note, _held, velocity) => {
    playerRef.current?.liveNoteOn(note, velocity)
    const at = heardBeat()
    if (at !== null) setKeys((current) => [...current, { pitch: note, start: at, end: null }])
  }, (note) => {
    playerRef.current?.liveNoteOff(note)
    const at = heardBeat() ?? Infinity
    setKeys((current) => current.map((key) => (key.pitch === note && key.end === null ? { ...key, end: at } : key)))
  })

  /** Start a prepared chart: the band, the sheet and a clean page. From `fromSeconds` the band goes on where it is. */
  const startPrepared = useCallback(async (prepared: Prepared, fromSeconds = 0) => {
    const player = playerRef.current
    if (!player) return
    if (fromSeconds === 0) {
      setKeys([])
      setBeat(0)
    }
    endless.started(prepared.arrangement.timeline.totalBeats, prepared.countIn ?? true)
    setTimeline(prepared.arrangement.timeline)
    if (fromSeconds > 0) await player.play(prepared.arrangement.midi, fromSeconds)
    else await endless.play(prepared)
    player.setRate(bpm / BASE_BPM)
    setPlaying(true)
  }, [endless, bpm])

  /** Arrange and play a song. */
  const startPlayback = useCallback(async (chart: ChartData, nextStyle = styleId, nextPattern = patternId,
    nextTranspose = transpose, nextChoruses = choruses, fromSeconds = 0) => {
    try {
      await startPrepared(prepare(chart, nextStyle, nextPattern, nextTranspose, nextChoruses), fromSeconds)
    } catch (cause) {
      setError(String(cause))
      reportError(cause, 'free improvisation playback')
    }
  }, [styleId, patternId, transpose, choruses, startPrepared])

  /** The next sheet of an infinite line. */
  const nextChunk = useCallback((after: InfiniteLine | null, countIn: boolean, nextStyle = styleId, nextPattern = patternId): Prepared | null => {
    if (!bank) return null
    const next = infiniteLine(bank.progressions, {}, false, Math.random, after?.steps.at(-1), CHUNK_GROUPS, 1)
    return { ...prepare(next.chart, nextStyle, nextPattern, 0, 1, { countIn }), line: next, countIn }
  }, [bank, styleId, patternId])

  /** Prepare the sheet after a line's last one, once the playing sheet has started. */
  const prepareAfter = useCallback((after: InfiniteLine, nextStyle = styleId, nextPattern = patternId) => {
    window.setTimeout(() => {
      if (endless.goesOn.current) endless.prepare(nextChunk(after, false, nextStyle, nextPattern))
    }, 0)
  }, [endless, nextChunk, styleId, patternId])

  /** Hand over to the next sheet of the infinite line (a clean page). */
  const switchToNext = useCallback(async () => {
    if (!endless.goesOn.current) return
    const prepared = endless.take() ?? nextChunk(lineRef.current, false)
    if (!prepared?.line) return
    lineRef.current = prepared.line
    setLine(prepared.line)
    try {
      await startPrepared(prepared)
      prepareAfter(prepared.line)
    } catch (cause) {
      setError(String(cause))
      endless.stop()
    }
  }, [endless, nextChunk, startPrepared, prepareAfter])

  const readiness = usePlayer(playerRef, () => {
    setPlaying(false)
    if (endless.missed()) void switchToNext()
  }, () => STYLES.map(warmUpMidi))
  const mixer = useMixer(playerRef, readiness, lesson?.mute)
  useEffect(() => { playerRef.current?.setRate(bpm / BASE_BPM) }, [bpm])

  useHeardBeat(playing, playerRef, (current) => {
    setBeat(current)
    if (mode === 'infinite' && endless.due()) void switchToNext()
  })
  // A new chorus: a clean page (the keys of the choruses before are forgotten)
  useEffect(() => {
    if (!timeline) return
    setKeys((current) => current.filter((key) => (barAtBeat(timeline, key.start)?.chorus ?? chorus) >= chorus))
  }, [chorus, timeline])

  useEffect(() => {
    // Saved chord charts and the shipped lead sheets (their chords), once per visit (the catalog
    // is searched in the song list)
    let active = true
    void Promise.all([loadTunes(), loadBundledLeadSheets()])
      .then(([saved, bundled]) => { if (active) source.setTunes([...saved.filter((t) => !hasMelody(t.chart)), ...bundled]) })
      .catch((cause) => { if (active) setError(String(cause)) })
    return () => { active = false }
    // Loaded once; setTunes is a state setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Stop the band (an infinite line stops going on). */
  function stop() {
    endless.stop()
    playerRef.current?.stop()
    setPlaying(false)
  }

  /** Stop and wipe the page (another song or line goes on the stand). */
  function clearStand() {
    stop()
    setKeys([])
    setTimeline(null)
    setBeat(0)
  }

  /** Start a new infinite line of progressions. */
  const startInfinite = async () => {
    stop()
    try {
      const prepared = nextChunk(null, true)
      if (!prepared?.line) return
      lineRef.current = prepared.line
      setLine(prepared.line)
      setTranspose(0)
      endless.goesOn.current = true
      await startPrepared(prepared)
      prepareAfter(prepared.line)
    } catch (cause) {
      setError(String(cause))
    }
  }

  /**
   * Change what the band plays: a new style or piano pattern goes on from where the band is (the
   * page stays); a new key or number of choruses starts the song again.
   */
  function changeArrangement(nextStyle: string, nextPattern: string | null, nextTranspose: number, nextChoruses = choruses) {
    band.set({ styleId: nextStyle, patternId: nextPattern, transpose: nextTranspose, choruses: nextChoruses })
    const player = playerRef.current
    if (!playing || !chords || !player) return
    const soundOnly = nextTranspose === transpose && nextChoruses === choruses
    if (mode === 'infinite') {
      if (!soundOnly) return void startInfinite()
      endless.prepare(null)
      const countIn = endless.countIn.current
      void startPrepared({ ...prepare(chords, nextStyle, nextPattern, 0, 1, { countIn }), line: lineRef.current ?? undefined, countIn },
        player.position).then(() => { if (lineRef.current) prepareAfter(lineRef.current, nextStyle, nextPattern) })
    } else void startPlayback(chords, nextStyle, nextPattern, nextTranspose, nextChoruses, soundOnly ? player.position : 0)
  }

  /** Choose the key for this song and the next ones. */
  const chooseKey = (choice: KeyChoice) => {
    setKeyChoice(choice)
    if (tune) changeArrangement(styleId, patternId, transposeFor(choice, tune.chart))
  }

  // The keys of this chorus written out, and the chart with them as its melody. A held key grows
  // with the band, a sixteenth at a time (the sheet is drawn again only when it changes)
  const held = keys.some((key) => key.end === null)
  const now = held ? Math.floor(beat * 4) / 4 : 0
  const written = useMemo(() => (timeline ? writeLine(keys, timeline, chorus, transpose, style.swing, now) : null),
    [keys, timeline, chorus, transpose, style.swing, now])
  const sheet = useMemo(() => (chords ? { ...chords, melody: { notes: written?.notes ?? [] } } : null), [chords, written])
  const noteClasses = useMemo(() => Object.fromEntries((written?.colors ?? []).map((color, index) => [index, `tone-note-${color}`])),
    [written])

  const keyPc = chords ? (chords.key + transpose + 12) % 12 : 0
  const positionLabel = !chords ? 'Choose a song or start an infinite line' :
    playing && timeline && beat < timeline.countIn ? 'Count-in' :
      position ? `Bar ${position.measure + 1} of ${chords.bars.length}` : chords.title
  const patterns = patternsForStyle(styleId).length ? patternsForStyle(styleId) : PIANO_PATTERNS

  return (
    <div className="app sightreading">
      <header className="topbar">
        <Wordmark>Free Improvisation</Wordmark>
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
            disabled={!bank || readiness.kind !== 'ready'}>New infinite line</button>
        </div>}
        {sheet && <>
          <LeadSheet chart={sheet} style={style} transpose={transpose}
            activeMeasure={position && position.measure >= 0 ? position.measure : null}
            beatInBar={position ? beat - position.start : 0} barBeats={position?.beats ?? 4} autoScroll={playing}
            noteClasses={noteClasses} />
          <ToneColorsLine tones={written?.counts ?? { chord: 0, color: 0, approach: 0, outside: 0 }} />
          <p className="sight-hint">{HINT}</p>
          <p className="sight-hint tone-legend">
            {TONE_COLORS.map((kind) => <span key={kind.id}><strong className={`tone-${kind.id}`}>{kind.label}</strong>: {kind.help}</span>)}
          </p>
        </>}
        {lessonSong.missing && <p className="sight-hint">The lesson's song, {lessonSong.missing}, is not in the app yet: choose another one, or import it.</p>}
        {!chords && mode === 'pick' && <p className="sight-hint">Choose a song (the shipped lead sheets, the ChoCo catalog, or your own imported charts), press play and improvise: every key you play is written out over the chords.</p>}
        <HeldNotes held={keyboard.held} keyPc={keyPc} />
      </SongWorkspace>

      {chords && <Transport readiness={readiness} playing={playing}
        onToggle={() => playing ? stop() : mode === 'infinite' ? void startInfinite() : void startPlayback(chords)}
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
        <Mixer {...mixer(style.comp.program)} parts={BAND_PARTS} />
      </Transport>}
      <ImportDialog open={source.importOpen} onClose={() => source.setImportOpen(false)} sources={CHORD_SOURCES}
        onImport={(from, text) => source.importFrom(from, text)} />
    </div>
  )
}
