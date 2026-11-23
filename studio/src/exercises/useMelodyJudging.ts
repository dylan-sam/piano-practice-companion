// Judging what is played on a MIDI keyboard while reading, shared by Lead Sheet, Exercises and
// Lick Sightreading: the melody note by note, the chords in any voicing and rhythm (ChordJudge,
// broken), or both at once; their feedback on the sheet, and the reading settings. Their controls
// and the score line are in ReadingControls.tsx.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { Player } from '../audio/player'
import { useMidiKeyboard } from '../audio/useMidiKeyboard'
import { BASE_BPM } from '../engine/arrange'
import type { MelodyOccurrence } from '../engine/melody'
import type { Slot, Timeline } from '../engine/timeline'
import { allowedPitchClasses, ChordJudge } from './sightReading'
import {
  CHECK_MODES, EMPTY_SCORE, MelodyJudge, noteKey, TIMING_WINDOWS, type CheckMode, type MelodyScore, type NoteResult, type Strictness,
} from './melodyReading'

/** How notes are judged, kept on this device. */
export interface ReadingSettings {
  strictness: Strictness
  anyOctave: boolean // a note counts in any octave (small keyboards, melodies written high or low)
  check?: CheckMode // what is checked (settings kept before it existed: the melody)
}
export const DEFAULT_READING: ReadingSettings = { strictness: 'normal', anyOctave: true, check: 'melody' }

/** What some reading settings check. */
export const checkMode = (settings: ReadingSettings): CheckMode => settings.check ?? 'melody'

/** Whether stored reading settings are usable. */
export function isReadingSettings(value: unknown): value is ReadingSettings {
  const v = value as Partial<ReadingSettings> | null
  return !!v && typeof v === 'object' && !!v.strictness && v.strictness in TIMING_WINDOWS &&
    typeof v.anyOctave === 'boolean' && (v.check === undefined || CHECK_MODES.some((mode) => mode.id === v.check))
}

/** The chords played right and missed. */
export interface ChordScore { correct: number; missed: number }
const NO_CHORDS: ChordScore = { correct: 0, missed: 0 }

/** The judges of what some settings check, for these notes and chords. */
function makeJudges(notes: MelodyOccurrence[], timeline: Timeline, settings: ReadingSettings) {
  const mode = checkMode(settings)
  return {
    mode,
    melody: mode === 'chords' ? null : new MelodyJudge(notes, TIMING_WINDOWS[settings.strictness], settings.anyOctave),
    chords: mode === 'melody' ? null : new ChordJudge(timeline, { broken: true }),
  }
}

/** The key of a chord on the sheet: its written bar and its place in the bar (as Chart.tsx keys them). */
const chordKey = (slot: Slot) => `${slot.measure}:${slot.chordIndex}`

/**
 * The judge of what is played on the MIDI keyboard: keys are judged against the melody notes and
 * the chords due, what has passed is settled, and every key sounds on the live piano. Checking
 * both, a key that is not the melody note due but belongs to the chord goes to the chords only.
 */
export function useMelodyJudging(playerRef: RefObject<Player | null>) {
  const judgeRef = useRef<MelodyJudge | null>(null)
  const chordJudgeRef = useRef<ChordJudge | null>(null)
  const chordScoreRef = useRef<ChordScore>(NO_CHORDS)
  const scoringRef = useRef(false)
  const [feedback, setFeedback] = useState<Record<string, NoteResult>>({})
  const [chordFeedback, setChordFeedback] = useState<Record<string, 'correct' | 'missed'>>({})
  const [score, setScore] = useState<MelodyScore>(EMPTY_SCORE)
  const [chordScore, setChordScore] = useState<ChordScore>(NO_CHORDS)
  const [total, setTotal] = useState(0)
  const [chordTotal, setChordTotal] = useState(0)
  const [checking, setChecking] = useState<CheckMode>('melody')

  /** Add chords to the chord score, and show them on the sheet. */
  const markChords = useCallback((slots: Slot[], result: 'correct' | 'missed') => {
    if (!slots.length) return
    chordScoreRef.current = { ...chordScoreRef.current, [result]: chordScoreRef.current[result] + slots.length }
    setChordScore(chordScoreRef.current)
    setChordFeedback((current) => {
      const next = { ...current }
      for (const slot of slots) next[chordKey(slot)] = result
      return next
    })
  }, [])

  /** Show the notes and chords whose time has ended as wrong or missed. */
  const settleThrough = useCallback((targetBeat: number) => {
    const missedChords = chordJudgeRef.current?.expire(targetBeat) ?? []
    if (scoringRef.current) markChords(missedChords, 'missed')
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
  }, [markChords])

  /** Judge a key against the melody note and the chord due now, and sound it on the live piano. */
  const onNoteOn = useCallback((note: number, held: Set<number>, velocity: number) => {
    const player = playerRef.current
    player?.liveNoteOn(note, velocity)
    if (!player?.isPlaying || !scoringRef.current) return
    const beat = player.heardPosition * BASE_BPM / 60
    const chords = chordJudgeRef.current
    if (chords) {
      const slot = chords.accept(beat, held, note)
      if (slot) markChords([slot], 'correct')
    }
    const judge = judgeRef.current
    if (!judge) return
    // Checking both: a chord note that is not the melody note due is not a wrong melody note
    const chord = chords?.chordAt(beat)
    if (chord && !judge.isDue(beat, note) && allowedPitchClasses(chord).has(note % 12)) return
    const press = judge.press(beat, note)
    if (press.note && press.result !== 'extra') {
      const key = noteKey(press.note.measure, press.note.at)
      setFeedback((current) => ({ ...current, [key]: press.result as NoteResult }))
    }
    setScore({ ...judge.score })
  }, [playerRef, markChords])
  /** Release the live piano note when a key lifts. */
  const onNoteOff = useCallback((note: number) => { playerRef.current?.liveNoteOff(note) }, [playerRef])
  const keyboard = useMidiKeyboard(onNoteOn, onNoteOff)
  useEffect(() => { scoringRef.current = keyboard.devices.length > 0 }, [keyboard.devices.length])

  /**
   * Judge a new play-through of these notes and chords. With `keepScore` the score goes on (an
   * endless exercise moving to its next chunk); the totals then count every chunk.
   */
  const begin = useCallback((notes: MelodyOccurrence[], timeline: Timeline, settings: ReadingSettings, keepScore = false) => {
    const previous = judgeRef.current
    const { mode, melody, chords } = makeJudges(notes, timeline, settings)
    setChecking(mode)
    if (keepScore && previous && melody) Object.assign(melody.score, previous.score)
    if (!keepScore) chordScoreRef.current = NO_CHORDS
    judgeRef.current = melody
    chordJudgeRef.current = chords
    setFeedback({})
    setChordFeedback({})
    setScore(melody ? { ...melody.score } : EMPTY_SCORE)
    setChordScore(chordScoreRef.current)
    setTotal((current) => (keepScore ? current : 0) + (melody ? notes.length : 0))
    setChordTotal((current) => (keepScore ? current : 0) + (chords?.total ?? 0))
  }, [])

  /**
   * Go on judging from a beat with the notes of a new arrangement of the same song (new keys, or
   * other settings): what is already judged keeps its score and colours, what is still to come is
   * judged as the new arrangement plays it.
   */
  const resume = useCallback((notes: MelodyOccurrence[], timeline: Timeline, settings: ReadingSettings, fromBeat: number) => {
    const previous = judgeRef.current
    const { mode, melody, chords } = makeJudges(notes.filter((note) => note.start > fromBeat), timeline, settings)
    setChecking(mode)
    if (previous && melody) Object.assign(melody.score, previous.score)
    chords?.expire(fromBeat) // the chords before are judged already
    judgeRef.current = melody
    chordJudgeRef.current = chords
    setScore(melody ? { ...melody.score } : EMPTY_SCORE)
    setTotal(melody ? (previous?.judged ?? 0) + melody.total : 0)
    const doneChords = chordScoreRef.current.correct + chordScoreRef.current.missed
    setChordTotal(chords ? doneChords + chords.total - timeline.slots.filter((s) => s.chordIndex >= 0 && s.start + s.beats <= fromBeat).length : 0)
  }, [])

  /** Forget the judges and the scores (another song is on the stand). */
  const clear = useCallback(() => {
    judgeRef.current = null
    chordJudgeRef.current = null
    chordScoreRef.current = NO_CHORDS
    setFeedback({})
    setChordFeedback({})
    setScore(EMPTY_SCORE)
    setChordScore(NO_CHORDS)
    setTotal(0)
    setChordTotal(0)
  }, [])

  return { keyboard, feedback, chordFeedback, score, chordScore, total, chordTotal, checking, settleThrough, begin, resume, clear }
}
