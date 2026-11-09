// Judging a melody played on a MIDI keyboard, shared by Melody Sightreading and Lick
// Sightreading: the judge and its feedback on the sheet, and the reading settings. Their controls
// and the score line are in ReadingControls.tsx.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { Player } from '../audio/player'
import { useMidiKeyboard } from '../audio/useMidiKeyboard'
import { BASE_BPM } from '../engine/arrange'
import type { MelodyOccurrence } from '../engine/melody'
import {
  EMPTY_SCORE, MelodyJudge, noteKey, TIMING_WINDOWS, type MelodyScore, type NoteResult, type Strictness,
} from './melodyReading'

/** How notes are judged, kept on this device. */
export interface ReadingSettings {
  strictness: Strictness
  anyOctave: boolean // a note counts in any octave (small keyboards, melodies written high or low)
  guide: boolean // the band also plays the melody
}
export const DEFAULT_READING: ReadingSettings = { strictness: 'normal', anyOctave: true, guide: false }

/** Whether stored reading settings are usable. */
export function isReadingSettings(value: unknown): value is ReadingSettings {
  const v = value as Partial<ReadingSettings> | null
  return !!v && typeof v === 'object' && !!v.strictness && v.strictness in TIMING_WINDOWS &&
    typeof v.anyOctave === 'boolean' && typeof v.guide === 'boolean'
}

/**
 * The judge of a melody played on the MIDI keyboard: keys are judged against the notes due, the
 * notes whose time has passed are settled, and every key sounds on the live piano.
 */
export function useMelodyJudging(playerRef: RefObject<Player | null>) {
  const judgeRef = useRef<MelodyJudge | null>(null)
  const scoringRef = useRef(false)
  const [feedback, setFeedback] = useState<Record<string, NoteResult>>({})
  const [score, setScore] = useState<MelodyScore>(EMPTY_SCORE)
  const [total, setTotal] = useState(0)

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
  }, [playerRef])
  /** Release the live piano note when a key lifts. */
  const onNoteOff = useCallback((note: number) => { playerRef.current?.liveNoteOff(note) }, [playerRef])
  const keyboard = useMidiKeyboard(onNoteOn, onNoteOff)
  useEffect(() => { scoringRef.current = keyboard.devices.length > 0 }, [keyboard.devices.length])

  /**
   * Judge a new play-through of these notes. With `keepScore` the score goes on (an endless
   * exercise moving to its next chunk); the total then counts the notes of every chunk.
   */
  const begin = useCallback((notes: MelodyOccurrence[], settings: ReadingSettings, keepScore = false) => {
    const previous = judgeRef.current
    const judge = new MelodyJudge(notes, TIMING_WINDOWS[settings.strictness], settings.anyOctave)
    if (keepScore && previous) Object.assign(judge.score, previous.score)
    judgeRef.current = judge
    setFeedback({})
    setScore({ ...judge.score })
    setTotal((current) => (keepScore ? current : 0) + notes.length)
  }, [])

  /**
   * Go on judging from a beat with the notes of a new arrangement of the same song (new keys):
   * the notes already judged keep their score and colours, the notes still to come are judged
   * as the new arrangement plays them.
   */
  const resume = useCallback((notes: MelodyOccurrence[], settings: ReadingSettings, fromBeat: number) => {
    const previous = judgeRef.current
    const judge = new MelodyJudge(notes.filter((note) => note.start > fromBeat), TIMING_WINDOWS[settings.strictness], settings.anyOctave)
    if (previous) Object.assign(judge.score, previous.score)
    judgeRef.current = judge
    setScore({ ...judge.score })
    setTotal((previous?.judged ?? 0) + judge.total)
  }, [])

  /** Forget the judge and the score (another song is on the stand). */
  const clear = useCallback(() => {
    judgeRef.current = null
    setFeedback({})
    setScore(EMPTY_SCORE)
    setTotal(0)
  }, [])

  return { keyboard, feedback, score, total, settleThrough, begin, resume, clear }
}
