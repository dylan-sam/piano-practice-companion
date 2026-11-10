import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Player } from '../audio/player'
import { useMidiKeyboard } from '../audio/useMidiKeyboard'
import { useMixer } from '../audio/useMixer'
import { useHeardBeat, usePlayer } from '../audio/usePlayer'
import { arrange, BASE_BPM } from '../engine/arrange'
import { defaultPatternForStyle, patternsForStyle, PIANO_PATTERNS } from '../engine/pianoPatterns'
import type { Timeline } from '../engine/timeline'
import { warmUpMidi } from '../engine/warmup'
import { loadBundledLeadSheets } from '../library/bundled'
import { loadTunes } from '../library/db'
import { loadJson, saveJson } from '../library/storage'
import { melodyClef, type NoteWriting, type Spelled } from '../music/abc'
import type { Chart as ChartData } from '../music/chart'
import { prettyNoteName } from '../music/chords'
import { moveBySteps, nearestLetter, signatureKey, spelledName, spelledPitch } from '../music/staff'
import type { Tune } from '../music/songs'
import { getStyle, STYLES } from '../styles'
import { Wordmark } from '../ui/AppLink'
import { DisplayOptions } from '../ui/DisplayMenu'
import { LeadSheet } from '../ui/LeadSheet'
import { Mixer } from '../ui/Mixer'
import { Popover } from '../ui/Popover'
import { Transport } from '../ui/Transport'
import {
  answerChart, fromSource, GUESS_CHOICES, judge, melodyAloneMidi, pickExcerpt, spellingOf, transposeGuesses,
  type Alterations, type DictationSource, type Excerpt, type Guess, type Guesses, type NoteResult,
} from './melodicDictation'
import { keyReferenceMidi, keyReferences, measureAt, transposeFor, type KeyChoice, type KeyReference } from './nameProgression'
import { MidiButton } from './ReadingControls'

const SETTINGS_KEY = 'eartraining:melodic-dictation'
const BPM_RANGE: [number, number] = [40, 240]
const MAX_REPEATS = 4
const START_BPM = 100 // excerpts start at most this fast
const NOTE_SOUND_MS = 450 // how long a placed note sounds
const SHEET_ZOOM = 1.6 // excerpts are short: the staff is drawn larger, to place notes precisely

/** The settings of the exercise, kept in the browser. */
interface DictationSettings {
  guesses: Guesses // how many notes to write
  source: DictationSource
  chords: boolean // chord symbols written over the staff
  band: boolean // the band plays along (else the melody alone, after a count-in)
  alterations: Alterations // with or without notes outside the key signature
  sound: boolean // a note sounds as it is placed (off: hearing it would give the answer away)
}
const DEFAULT_SETTINGS: DictationSettings = { guesses: 3, source: 'both', chords: false, band: true, alterations: 'any', sound: false }

/** Whether stored settings are usable (they may be old or edited by hand). */
function isSettings(value: unknown): value is DictationSettings {
  const v = value as Partial<DictationSettings> | null
  return !!v && GUESS_CHOICES.includes(v.guesses as Guesses) && ['both', 'songs', 'licks'].includes(v.source as string) &&
    typeof v.chords === 'boolean' && typeof v.band === 'boolean' && typeof v.sound === 'boolean' &&
    ['any', 'none', 'with'].includes(v.alterations as string)
}

// The words of each source in the settings
const SOURCE_NAMES: Record<DictationSource, string> = { both: 'Songs and licks', songs: 'Songs', licks: 'Licks' }
const ALTERATION_NAMES: Record<Alterations, string> = { any: 'With or without alterations', none: 'No alterations', with: 'With alterations' }
// Button text and keyboard shortcut of each key reference
const REFERENCE_LABELS: Record<KeyReference, string> = { tonic: 'Tonic', 'major cadence': 'Cadence', 'minor cadence': 'Cadence' }
const REFERENCE_KEYS = ['T', 'Y']
// Classes of the hidden notes on the sheet
const RESULT_CLASS: Record<NoteResult, string> = { correct: 'lead-note-correct', wrong: 'lead-note-wrong', missing: 'lead-note-missed' }

type Playing = 'excerpt' | 'mine' | KeyReference | null

/** The excerpt as shown while writing: the placed notes at their pitch (the others keep theirs, drawn as slashes). */
function shownChart(excerpt: Excerpt, guesses: Record<number, Guess>, transpose: number): ChartData {
  const melody = excerpt.chart.melody!
  return {
    ...excerpt.chart,
    melody: { ...melody, notes: melody.notes.map((note, index) => guesses[index] ? { ...note, pitch: guesses[index].pitch - transpose } : note) },
  }
}

/** Melodic Dictation: hear an excerpt of a song or a lick, write its hidden notes on the staff, then check them. */
export function MelodicDictation() {
  const playerRef = useRef<Player | null>(null)
  const timelineRef = useRef<Timeline | null>(null)

  const [tunes, setTunes] = useState<Tune[] | null>(null)
  const [error, setError] = useState('')
  const [settings, setSettingsState] = useState<DictationSettings>(() => loadJson(SETTINGS_KEY, DEFAULT_SETTINGS, isSettings))
  const [excerpt, setExcerpt] = useState<Excerpt | null>(null)
  const [guesses, setGuesses] = useState<Record<number, Guess>>({})
  const [selected, setSelected] = useState<number | null>(null)
  const [results, setResults] = useState<Record<number, NoteResult> | null>(null)
  const [showMine, setShowMine] = useState(false) // after checking: the placed notes instead of the right ones
  const [tally, setTally] = useState({ notes: 0, correct: 0 }) // this visit's checked notes

  const [styleId, setStyleId] = useState('swing')
  const [patternId, setPatternId] = useState<string | null>(() => defaultPatternForStyle('swing'))
  const [keyChoice, setKeyChoice] = useState<KeyChoice>('song')
  const [transpose, setTranspose] = useState(0)
  const [bpm, setBpm] = useState(START_BPM)
  const [repeats, setRepeats] = useState(1)
  const [playing, setPlaying] = useState<Playing>(null)
  const [position, setPosition] = useState<ReturnType<typeof measureAt>>(null)

  const readiness = usePlayer(playerRef, () => {
    setPlaying(null)
    setPosition(null)
  }, () => STYLES.map(warmUpMidi))
  const mixer = useMixer(playerRef, readiness)

  /** Change some settings and keep them. */
  const setSettings = (change: Partial<DictationSettings>) => {
    const next = { ...settings, ...change }
    setSettingsState(next)
    saveJson(SETTINGS_KEY, next)
    return next
  }

  /** Stop whatever is playing. */
  const stop = useCallback(() => {
    playerRef.current?.stop()
    setPlaying(null)
    setPosition(null)
  }, [])

  // Set when a new excerpt is asked: it plays by itself once drawn and the sounds are ready
  const autoPlay = useRef(false)

  /** Ask a new excerpt from the chosen source, with the chosen number of notes to write. */
  const nextExcerpt = useCallback((from: Tune[] | null = tunes, choice: DictationSettings = settings, key: KeyChoice = keyChoice) => {
    if (!from) return
    stop()
    const pool = from.filter(fromSource(choice.source))
    const next = pickExcerpt(pool, choice.guesses, Math.random, excerpt?.id, choice.alterations)
    setExcerpt(next)
    setGuesses({})
    setResults(null)
    setShowMine(false)
    setSelected(next?.hidden[0] ?? null)
    if (!next) {
      setError(pool.length ? 'No excerpt fits these options. Choose fewer notes to guess, or other alterations.' : 'No songs or licks found.')
      return
    }
    setError('')
    setTranspose(transposeFor(key, next.chart))
    const style = getStyle(next.chart.style)
    setStyleId(style.id)
    setPatternId(defaultPatternForStyle(style.id))
    setBpm(Math.max(BPM_RANGE[0], Math.min(START_BPM, next.chart.bpm)))
    autoPlay.current = true
  }, [tunes, settings, keyChoice, excerpt, stop])

  // The songs and licks excerpts are cut from: the shipped lead sheets, the lick database and
  // saved lead sheets; the first excerpt is asked as soon as they are loaded
  useEffect(() => {
    let active = true
    void Promise.all([loadTunes(), loadBundledLeadSheets({ licks: true })])
      .then(([saved, bundled]) => {
        if (!active) return
        const all = [...saved, ...bundled]
        setTunes(all)
        nextExcerpt(all)
      })
      .catch((cause) => { if (active) setError(String(cause)) })
    return () => { active = false }
    // nextExcerpt is passed the tunes, so they are loaded once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const minor = !!excerpt?.chart.minor
  const keyPc = excerpt ? (excerpt.chart.key + transpose + 120) % 12 : 0
  const majorPc = signatureKey(keyPc, minor)
  const notes = useMemo(() => excerpt?.chart.melody?.notes ?? [], [excerpt])
  const hidden = useMemo(() => new Set(excerpt?.hidden ?? []), [excerpt])
  // The clef follows the excerpt's real range, so placing notes does not change it
  const clef = useMemo(() => melodyClef(notes.map((n) => n.pitch + transpose)), [notes, transpose])
  const style = getStyle(styleId)

  /**
   * Play the excerpt (or the placed notes) alone after a count-in, or with the band. From
   * `fromSeconds` (MIDI time) it goes on where it is: a new band setting does not start it again.
   */
  const playLine = async (which: 'excerpt' | 'mine' = 'excerpt', band = settings.band, opts = { styleId, patternId, repeats },
    fromSeconds = 0) => {
    const player = playerRef.current
    if (!player || !excerpt || readiness.kind !== 'ready') return
    const line = which === 'excerpt' ? excerpt.chart : answerChart(excerpt, guesses, transpose)
    const lineStyle = getStyle(opts.styleId)
    const { midi, timeline } = band
      ? arrange(line, lineStyle, transpose, opts.repeats, { ending: false }, opts.patternId)
      : melodyAloneMidi(line, lineStyle, transpose, opts.repeats)
    timelineRef.current = timeline
    await player.play(midi, fromSeconds)
    player.setRate(bpm / BASE_BPM)
    setPlaying(which)
  }

  // A new excerpt plays at once, unless the browser still waits for a first tap (Play then starts it)
  useEffect(() => {
    if (!autoPlay.current || !excerpt || readiness.kind !== 'ready') return
    autoPlay.current = false
    if (playerRef.current?.canPlayWithoutTap) void playLine()
  })

  /** Play the tonic chord or the cadence of the key. */
  const playReference = async (reference: KeyReference) => {
    const player = playerRef.current
    if (!player || !excerpt || readiness.kind !== 'ready') return
    timelineRef.current = null
    setPosition(null)
    await player.play(keyReferenceMidi(reference, keyPc, minor, BASE_BPM))
    player.setRate(1)
    setPlaying(reference)
  }

  /**
   * Change the band (style, pattern, repeats, band on or off): the sheet stays the same, so a
   * playing line goes on from where it is with the new band (no new count-in).
   */
  const change = (patch: { styleId?: string; patternId?: string | null; repeats?: number }, band = settings.band) => {
    const next = { styleId, patternId, repeats, ...patch }
    setStyleId(next.styleId)
    setPatternId(next.patternId)
    setRepeats(next.repeats)
    if (playing === 'excerpt' || playing === 'mine') void playLine(playing, band, next, playerRef.current?.position ?? 0)
  }

  /** Move the excerpt (and the notes placed so far) to another key. */
  const changeKey = (nextTranspose: number) => {
    if (playing) stop()
    setGuesses((current) => transposeGuesses(current, nextTranspose - transpose))
    setTranspose(nextTranspose)
  }

  /** Choose the key for this excerpt and the next ones. */
  const chooseKey = (choice: KeyChoice) => {
    setKeyChoice(choice)
    if (excerpt) changeKey(transposeFor(choice, excerpt.chart))
  }


  // Follow the audio clock to highlight the bar and the note being played (only while a line plays:
  // the clock may tick once more after the end)
  const linePlaying = playing === 'excerpt' || playing === 'mine'
  useHeardBeat(linePlaying, playerRef, (beat) => {
    const timeline = timelineRef.current
    if (timeline) setPosition(measureAt(timeline, beat))
  })
  const at = linePlaying ? position : null
  useEffect(() => {
    if (linePlaying) playerRef.current?.setRate(bpm / BASE_BPM)
  }, [bpm, linePlaying])

  // ---- Writing the notes ----

  /** Sound a note on the piano as it is placed, when that option is on. */
  const sound = (pitch: number) => {
    const player = playerRef.current
    if (!settings.sound || !player || readiness.kind !== 'ready') return
    player.liveNoteOn(pitch, 90)
    window.setTimeout(() => player.liveNoteOff(pitch), NOTE_SOUND_MS)
  }

  /** The hidden note after (or before) one, in time order. */
  const neighbour = (index: number | null, step: 1 | -1): number | null => {
    if (!excerpt?.hidden.length) return null
    if (index === null) return excerpt.hidden[0]
    const at = excerpt.hidden.indexOf(index)
    return excerpt.hidden[Math.max(0, Math.min(excerpt.hidden.length - 1, at + step))]
  }

  /** The pitch heard just before a note: the shown or placed note before it (a starting point for typed letters). */
  const pitchBefore = (index: number): number => {
    for (let i = index - 1; i >= 0; i--) {
      if (!hidden.has(i)) return notes[i].pitch + transpose
      if (guesses[i]) return guesses[i].pitch
    }
    return (notes[0]?.pitch ?? 60) + transpose
  }

  /** Write a note (as placed, or spelled by the key), sound it, and go on to the next hidden note if asked. */
  const write = (index: number, guess: Guess, advance = false) => {
    if (results) return
    setGuesses((current) => ({ ...current, [index]: guess }))
    sound(guess.pitch)
    setSelected(advance ? neighbour(index, 1) : index)
  }

  /** Move the selected note by staff steps; an empty one starts from the note before it. */
  const moveSelected = (steps: number) => {
    if (selected === null) return
    const guess = guesses[selected]
    const from = guess ? spellingOf(guess, majorPc) : spellingOf({ pitch: pitchBefore(selected) }, majorPc)
    const spelled = moveBySteps(from, guess ? steps : 0, majorPc)
    write(selected, { pitch: spelledPitch(spelled), spelled })
  }

  /** Give the selected note a sharp, a flat or a natural (keeping its letter). */
  const setAccidental = (accidental: number) => {
    if (selected === null || !guesses[selected]) return
    const spelled = { ...spellingOf(guesses[selected], majorPc), accidental }
    write(selected, { pitch: spelledPitch(spelled), spelled })
  }

  /** Clear the selected note. */
  const clearSelected = () => {
    if (selected === null || results) return
    setGuesses((current) => {
      const next = { ...current }
      delete next[selected]
      return next
    })
  }

  /** Check the placed notes and count them. */
  const check = () => {
    if (!excerpt || results) return
    const judged = judge(excerpt, guesses, transpose)
    setResults(judged)
    setShowMine(false)
    setSelected(null)
    const right = Object.values(judged).filter((r) => r === 'correct').length
    setTally((t) => ({ notes: t.notes + excerpt.hidden.length, correct: t.correct + right }))
  }

  // A MIDI keyboard writes the selected note (spelled by the key) and goes on to the next one
  const keyboard = useMidiKeyboard((note, _held, velocity) => {
    playerRef.current?.liveNoteOn(note, velocity)
    if (selected !== null && !results) write(selected, { pitch: note }, true)
  }, (note) => playerRef.current?.liveNoteOff(note))

  const keysRef = useRef<(e: KeyboardEvent) => void>(() => {})
  /**
   * Keyboard shortcuts: Space plays, T tonic, Y cadence, letters A-G write a note near the one
   * before, up/down move it (Ctrl: an octave), + - = sharp, flat, natural, left/right choose the
   * note, Delete clears it, Enter checks (then asks the next excerpt).
   */
  const onKeys = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName ?? ''
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) || e.metaKey || e.altKey) return
    const key = e.key
    const upper = key.toUpperCase()
    if (key === ' ' && tag !== 'BUTTON') {
      e.preventDefault()
      if (playing) stop()
      else void playLine()
    } else if (key === 'Enter' && tag !== 'BUTTON') {
      if (results) nextExcerpt()
      else check()
    } else if (e.ctrlKey) {
      if (key === 'ArrowUp' || key === 'ArrowDown') {
        e.preventDefault()
        moveSelected(key === 'ArrowUp' ? 7 : -7)
      }
    } else if (REFERENCE_KEYS.includes(upper) && excerpt) {
      const reference = keyReferences(minor)[REFERENCE_KEYS.indexOf(upper)]
      if (reference) void playReference(reference)
    } else if (/^[A-Ga-g]$/.test(key) && selected !== null) {
      const spelled = nearestLetter(upper, pitchBefore(selected), majorPc)
      write(selected, { pitch: spelledPitch(spelled), spelled }, true)
    } else if (key === 'ArrowUp' || key === 'ArrowDown') {
      e.preventDefault()
      moveSelected(key === 'ArrowUp' ? 1 : -1)
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      e.preventDefault()
      setSelected(neighbour(selected, key === 'ArrowRight' ? 1 : -1))
    } else if (key === '+' || key === '#') setAccidental(1)
    else if (key === '-') setAccidental(-1)
    else if (key === '=') setAccidental(0)
    else if (key === 'Delete' || key === 'Backspace') clearSelected()
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

  // ---- The sheet ----

  const checked = results !== null
  // While writing (or looking at one's answer): placed notes as placed, the others as slashes
  const writingView = !checked || showMine
  const sheetChart = useMemo((): ChartData | null => {
    if (!excerpt) return null
    const chart = writingView ? shownChart(excerpt, guesses, transpose) : excerpt.chart
    // The title and source stay hidden until the answer is checked
    return checked
      ? { ...chart, title: excerpt.title, composer: excerpt.detail }
      : { ...chart, title: 'Write the hidden notes', composer: undefined }
  }, [excerpt, guesses, transpose, writingView, checked])
  const writing = useMemo((): NoteWriting => ({
    clef,
    chords: checked || settings.chords,
    rhythmOnly: (index) => writingView && hidden.has(index) && !guesses[index],
    spelling: (index) => (writingView ? guesses[index]?.spelled : undefined),
  }), [clef, checked, settings.chords, writingView, hidden, guesses])
  const noteClasses = useMemo(() => Object.fromEntries([...hidden].map((index) => {
    if (results) return [index, RESULT_CLASS[results[index]]]
    const state = guesses[index] ? 'dict-placed' : 'dict-hidden'
    return [index, index === selected ? `${state} dict-selected` : state]
  })), [hidden, results, guesses, selected])
  // Notes placed on the staff: tapped or dragged there (LeadSheet's staff input)
  const staffInput = checked || !excerpt ? null : {
    notes: excerpt.hidden, clef, majorPc,
    onSelect: setSelected,
    onPlace: (index: number, spelled: Spelled) => write(index, { pitch: spelledPitch(spelled), spelled }),
  }

  const placed = excerpt ? excerpt.hidden.filter((index) => guesses[index]).length : 0
  const right = results ? Object.values(results).filter((r) => r === 'correct').length : 0
  const wrongNotes = results && excerpt ? excerpt.hidden.filter((index) => results[index] !== 'correct') : []
  const selectedGuess = selected !== null ? guesses[selected] : undefined

  const readout = playing && playing !== 'excerpt' && playing !== 'mine'
    ? `Key of ${prettyNoteName(keyPc)} ${minor ? 'minor' : 'major'}`
    : at ? `Bar ${at.measure + 1} of ${excerpt?.chart.bars.length ?? 0}`
      : playing ? 'Count-in'
        : tally.notes ? `${tally.correct}/${tally.notes} notes right` : 'Melodic Dictation'

  const keyControl = (
    <label className="control"><span className="label">Key</span>
      <select className="select" value={String(keyChoice)} onChange={(event) => {
        const value = event.target.value
        chooseKey(value === 'song' || value === 'random' ? value : Number(value))
      }}>
        <option value="song">Source key{excerpt && keyChoice === 'song' ? ` (${prettyNoteName(excerpt.chart.key)})` : ''}</option>
        <option value="random">Random key{excerpt && keyChoice === 'random' ? ` (${prettyNoteName(keyPc)})` : ''}</option>
        {Array.from({ length: 12 }, (_, pc) => <option key={pc} value={pc}>{prettyNoteName(pc)}</option>)}
      </select>
    </label>
  )

  return (
    <div className="app exercise dictation">
      <header className="topbar">
        <Wordmark>Melodic Dictation</Wordmark>
        <span className="topbar-spacer" />
        <MidiButton keyboard={keyboard} />
        <Popover id="dictation-options" className="share exercise-display" label="Options"
          title="Choose how many notes to guess, where excerpts come from and what is shown"
          active={settings.chords || !settings.band || settings.sound || settings.source !== 'both' || settings.alterations !== 'any'}>
          {() => (
            <div className="share-panel">
              <label className="control">
                <span className="label">Nb of notes to guess</span>
                <select className="select" value={String(settings.guesses)} onChange={(e) => {
                  const value = e.target.value === 'all' ? 'all' : Number(e.target.value)
                  nextExcerpt(tunes, setSettings({ guesses: value }))
                }}>
                  {GUESS_CHOICES.map((choice) => (
                    <option key={choice} value={String(choice)}>
                      {choice === 'all' ? 'All but the first and last' : `${choice} note${choice === 1 ? '' : 's'}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="control">
                <span className="label">Excerpts from</span>
                <select className="select" value={settings.source} onChange={(e) =>
                  nextExcerpt(tunes, setSettings({ source: e.target.value as DictationSource }))}>
                  {(Object.keys(SOURCE_NAMES) as DictationSource[]).map((source) => (
                    <option key={source} value={source}>{SOURCE_NAMES[source]}</option>
                  ))}
                </select>
              </label>
              <label className="control">
                <span className="label">Alterations</span>
                <select className="select" value={settings.alterations} onChange={(e) =>
                  nextExcerpt(tunes, setSettings({ alterations: e.target.value as Alterations }))}>
                  {(Object.keys(ALTERATION_NAMES) as Alterations[]).map((choice) => (
                    <option key={choice} value={choice}>{ALTERATION_NAMES[choice]}</option>
                  ))}
                </select>
              </label>
              <button className="share-option" aria-pressed={settings.chords} onClick={() => setSettings({ chords: !settings.chords })}>
                <span className="share-name">Show the chords {settings.chords ? 'On' : 'Off'}</span>
                <span className="share-desc">Write the chord symbols over the staff while you write the notes.</span>
              </button>
              <button className="share-option" aria-pressed={settings.band} onClick={() => {
                const next = setSettings({ band: !settings.band })
                change({}, next.band)
              }}>
                <span className="share-name">Play with the band {settings.band ? 'On' : 'Off'}</span>
                <span className="share-desc">Bass, piano and drums play the chords under the melody.</span>
              </button>
              <button className="share-option" aria-pressed={settings.sound} onClick={() => setSettings({ sound: !settings.sound })}>
                <span className="share-name">Sound of placed notes {settings.sound ? 'On' : 'Off'}</span>
                <span className="share-desc">Play each note as you place it on the staff (it makes finding the notes easier).</span>
              </button>
              <DisplayOptions roman={false} />
            </div>
          )}
        </Popover>
      </header>

      <main className="stage exercise-stage dictation-stage">
        {error && <p className="exercise-error" role="alert">{error}</p>}
        {!tunes && !error && <p className="exercise-loading">Loading songs and licks…</p>}
        {readiness.kind === 'error' && <p className="exercise-error" role="alert">{readiness.message}</p>}
        {keyboard.error && <p className="exercise-error" role="alert">{keyboard.error}</p>}
        {excerpt && sheetChart && (
          <>
            <LeadSheet chart={sheetChart} style={style} transpose={transpose}
              activeMeasure={at?.measure ?? null} beatInBar={at?.beatInBar ?? 0} barBeats={at?.barBeats ?? 4}
              writing={writing} noteClasses={noteClasses} staffInput={staffInput} zoom={SHEET_ZOOM} />

            <section className="dictation-pad" aria-label="Write the notes">
              <div className="answers-reference" role="group" aria-label="Hear the key">
                <span className="label">Hear the key</span>
                {keyReferences(minor).map((reference, i) => (
                  <button key={reference} className="band-toggle" onClick={() => void playReference(reference)}
                    disabled={readiness.kind !== 'ready'} aria-pressed={playing === reference}
                    title={`${reference === 'tonic' ? 'Tonic' : minor ? 'Minor cadence (i–iv–V–i)' : 'Major cadence (I–IV–V–I)'} (${REFERENCE_KEYS[i]})`}>
                    {REFERENCE_LABELS[reference]}
                  </button>
                ))}
              </div>

              {!checked && (
                <div className="dictation-tools" role="group" aria-label="The selected note">
                  <button className="band-toggle" onClick={() => setSelected(neighbour(selected, -1))} aria-label="Previous note" title="Previous note (left arrow)">{'←'}</button>
                  <span className="dictation-selected" aria-live="polite">
                    {selected === null ? 'No note' : `Note ${excerpt.hidden.indexOf(selected) + 1} of ${excerpt.hidden.length}`}
                    {selectedGuess && <strong> {spelledName(spellingOf(selectedGuess, majorPc))}</strong>}
                  </span>
                  <button className="band-toggle" onClick={() => setSelected(neighbour(selected, 1))} aria-label="Next note" title="Next note (right arrow)">{'→'}</button>
                  <span className="dictation-divider" />
                  <button className="band-toggle" onClick={() => moveSelected(1)} aria-label="Up a step" title="Up a step (up arrow)">{'↑'}</button>
                  <button className="band-toggle" onClick={() => moveSelected(-1)} aria-label="Down a step" title="Down a step (down arrow)">{'↓'}</button>
                  <button className="band-toggle" onClick={() => setAccidental(-1)} disabled={!selectedGuess} aria-label="Flat" title="Flat (-)">{'♭'}</button>
                  <button className="band-toggle" onClick={() => setAccidental(0)} disabled={!selectedGuess} aria-label="Natural" title="Natural (=)">{'♮'}</button>
                  <button className="band-toggle" onClick={() => setAccidental(1)} disabled={!selectedGuess} aria-label="Sharp" title="Sharp (+)">{'♯'}</button>
                  <button className="band-toggle" onClick={clearSelected} disabled={!selectedGuess} title="Clear the note (Delete)">Clear</button>
                </div>
              )}

              {!checked ? (
                <div className="dictation-actions">
                  <span className="dictation-count">{placed}/{excerpt.hidden.length} placed</span>
                  <button className="band-toggle" onClick={() => playing === 'mine' ? stop() : void playLine('mine')}
                    disabled={readiness.kind !== 'ready' || !placed} aria-pressed={playing === 'mine'}>Play my notes</button>
                  <button className="feedback-next" onClick={check}>Check</button>
                </div>
              ) : (
                <div className={`feedback ${right === excerpt.hidden.length ? 'feedback-correct' : 'feedback-wrong'}`} role="status">
                  <div>
                    <strong>{right === excerpt.hidden.length ? 'All right.' : `${right} of ${excerpt.hidden.length} right.`}</strong>{' '}
                    {excerpt.title} · {excerpt.detail}
                    {wrongNotes.length > 0 && (
                      <div className="feedback-hint">
                        {wrongNotes.map((index) => {
                          const guess = guesses[index]
                          const truth = spellingOf({ pitch: notes[index].pitch + transpose }, majorPc)
                          return `Note ${excerpt.hidden.indexOf(index) + 1}: ${guess ? `${spelledName(spellingOf(guess, majorPc))}, it was ` : 'it was '}${spelledName(truth)}`
                        }).join(' · ')}
                      </div>
                    )}
                    <div className="feedback-round">This session: {tally.correct}/{tally.notes} notes right.</div>
                  </div>
                  <div className="feedback-actions">
                    <button className="topbar-button" aria-pressed={showMine} onClick={() => setShowMine(!showMine)}>
                      {showMine ? 'Show the answer' : 'Show mine'}
                    </button>
                    <button className="topbar-button" onClick={() => playing === 'mine' ? stop() : void playLine('mine')}
                      disabled={readiness.kind !== 'ready' || !placed}>Play mine</button>
                    <button className="feedback-next" onClick={() => nextExcerpt()} autoFocus>Next</button>
                  </div>
                </div>
              )}
              {!checked && (
                <p className="sight-hint dictation-hint">
                  Tap the staff above or below a slash to put its note there; tap again or drag to move it.{' '}
                  {/* Computer keys only where there is a keyboard (not on phones and tablets) */}
                  <span className="keyboard-only">
                    Keys: letters A–G, ↑ ↓ to move, + − = for sharp, flat and natural, ← → to change note, Enter to check.{' '}
                  </span>
                  A MIDI keyboard writes the notes too.
                </p>
              )}
            </section>
          </>
        )}
      </main>

      <Transport
        readiness={readiness}
        playing={playing === 'excerpt'}
        onToggle={() => (playing === 'excerpt' ? stop() : void playLine())}
        position={readout}
        styleId={styleId}
        onStyle={(id) => change({ styleId: id, patternId: defaultPatternForStyle(id) })}
        pianoPatternId={patternId}
        pianoPatterns={patternsForStyle(styleId).length ? patternsForStyle(styleId) : PIANO_PATTERNS}
        onPianoPattern={(id) => change({ patternId: id })}
        keyPc={keyPc}
        onKey={(pc) => chooseKey(pc)}
        keyControl={keyControl}
        bpm={bpm}
        bpmRange={BPM_RANGE}
        onBpm={setBpm}
        choruses={repeats}
        maxChoruses={MAX_REPEATS}
        onChoruses={(n) => change({ repeats: n })}
      >
        <Mixer {...mixer(style.comp.program)} />
      </Transport>
    </div>
  )
}
