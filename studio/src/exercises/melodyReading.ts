// Judging a melody played on a MIDI keyboard against a lead sheet, note by note.
//
// Every melody note as the band plays it (engine/melody.ts) gets a window around its start: a
// key pressed in that window with the right pitch makes it correct, a wrong pitch marks it wrong
// (it can still be put right inside the window), and a note still unplayed when its window ends
// is missed. Windows never reach past half the gap to the next note, so fast runs stay fair.

import type { MelodyOccurrence } from '../engine/melody'

export type NoteResult = 'correct' | 'wrong' | 'missed'

/** How strict the timing is: the most a note may be early or late, in beats. */
export const TIMING_WINDOWS = { easy: 0.4, normal: 0.25, strict: 0.12 } as const
export type Strictness = keyof typeof TIMING_WINDOWS

/** The key of a written note on the sheet: its bar and its start there. */
export const noteKey = (measure: number, at: number) => `${measure}:${Math.round(at * 1000) / 1000}`

/** The running score of one play-through. */
export interface MelodyScore {
  correct: number
  wrong: number // notes played with a wrong pitch and never put right
  missed: number // notes not played at all
  extra: number // keys pressed where no note was due
  offset: number // sum of the correct notes' timing errors, in beats (early < 0 < late)
}

export const EMPTY_SCORE: MelodyScore = { correct: 0, wrong: 0, missed: 0, extra: 0, offset: 0 }

/** A note being judged: its window and what has been played in it so far. */
interface Target extends MelodyOccurrence {
  from: number
  to: number
  result?: NoteResult
  done: boolean
}

/** The outcome of one key press. */
export interface Press {
  note?: MelodyOccurrence // the written note the press was taken for, if any
  result: 'correct' | 'wrong' | 'extra'
  offset?: number // beats early (< 0) or late (> 0), for a correct note
}

/** Judge key presses against a melody's notes in time order. */
export class MelodyJudge {
  private readonly targets: Target[]
  private finalized = 0 // notes before this index have been settled
  private readonly anyOctave: boolean
  readonly score: MelodyScore = { ...EMPTY_SCORE }

  /** Give every note its window: `window` beats each side, at most half the gap to its neighbours. */
  constructor(notes: MelodyOccurrence[], window: number, anyOctave: boolean) {
    this.anyOctave = anyOctave
    this.targets = notes.map((note, i) => {
      const before = i > 0 ? (note.start - notes[i - 1].start) / 2 : window
      const after = i < notes.length - 1 ? (notes[i + 1].start - note.start) / 2 : window
      return { ...note, from: note.start - Math.min(window, before), to: note.start + Math.min(window, after), done: false }
    })
  }

  /** Whether a played key is the note's pitch (in any octave, when allowed). */
  private matches(target: Target, pitch: number): boolean {
    return this.anyOctave ? (target.pitch - pitch) % 12 === 0 : target.pitch === pitch
  }

  /** Judge a key pressed at a beat. */
  press(beat: number, pitch: number): Press {
    const open: Target[] = []
    for (let i = this.finalized; i < this.targets.length; i++) {
      const target = this.targets[i]
      if (target.from > beat) break
      if (!target.done && beat <= target.to) open.push(target)
    }
    const byDistance = (a: Target, b: Target) => Math.abs(a.start - beat) - Math.abs(b.start - beat)
    const hit = open.filter((t) => this.matches(t, pitch)).sort(byDistance)[0]
    if (hit) {
      hit.result = 'correct'
      hit.done = true
      this.score.correct++
      this.score.offset += beat - hit.start
      return { note: hit, result: 'correct', offset: beat - hit.start }
    }
    const nearest = open.sort(byDistance)[0]
    if (!nearest) {
      this.score.extra++
      return { result: 'extra' }
    }
    nearest.result = 'wrong'
    return { note: nearest, result: 'wrong' }
  }

  /** Settle every note whose window has ended by `beat`: those not played right are wrong or missed. */
  expire(beat: number): { note: MelodyOccurrence; result: NoteResult }[] {
    const settled: { note: MelodyOccurrence; result: NoteResult }[] = []
    while (this.finalized < this.targets.length && this.targets[this.finalized].to < beat) {
      const target = this.targets[this.finalized++]
      if (target.done) continue
      target.done = true
      const result = target.result ?? 'missed'
      target.result = result
      this.score[result === 'wrong' ? 'wrong' : 'missed']++
      settled.push({ note: target, result })
    }
    return settled
  }

  /** The number of notes judged so far. */
  get judged(): number {
    return this.score.correct + this.score.wrong + this.score.missed
  }

  /** The number of notes in the melody. */
  get total(): number {
    return this.targets.length
  }
}

/** The share of judged notes played right, in percent (null before any note). */
export function accuracy(score: MelodyScore): number | null {
  const judged = score.correct + score.wrong + score.missed
  return judged ? Math.round((score.correct / judged) * 100) : null
}

/** The average timing of the correct notes in milliseconds at a tempo (early < 0 < late). */
export function averageOffsetMs(score: MelodyScore, bpm: number): number | null {
  return score.correct ? Math.round((score.offset / score.correct) * (60000 / bpm)) : null
}
