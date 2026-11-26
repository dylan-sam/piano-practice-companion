// Life while playing: each chord or note judged shows a short "Perfect", "Good" or "Missed" (with
// the run of right answers), and a chorus played well ends in a burst of colour. The screens that judge call `judged`; the overlay (Effects.tsx) draws what it is told.
// Every answer judged is also counted for the home screen's statistics (practiceLog). The effects
// can be turned off (home screen > Appearance), and the burst never shows with reduced motion.

import { useEffect, useRef } from 'react'
import { countAnswer, type PracticeArea } from '../library/practiceLog'
import { loadJson, saveJson } from '../library/storage'

export type Judgement = 'perfect' | 'good' | 'miss'
export interface JudgedEvent { judgement: Judgement; run: number } // run: right answers in a row
export const JUDGED_EVENT = 'practice:judged'
export const BURST_EVENT = 'practice:burst'

// A right answer within this share of a beat of its time is "Perfect"
export const PERFECT_WITHIN = 0.15
// A chorus ends in a burst with at least this share right, out of at least BURST_MIN answers
export const BURST_SHARE = 0.9
export const BURST_MIN = 6

const KEY = 'eartraining:effects'

/** Whether the effects are on (they are unless turned off). */
export const effectsOn = (): boolean => loadJson(KEY, true, (v) => typeof v === 'boolean')

/** Mark the page with the effects setting (`data-effects`, for styles that follow it). */
export function markEffects(on = effectsOn()): void {
  document.documentElement.dataset.effects = on ? 'on' : 'off'
}

/** Turn the effects on or off, and keep it. */
export function setEffectsOn(on: boolean): void {
  saveJson(KEY, on)
  markEffects(on)
}

// The answers of the chorus playing, and the run of right answers
let chorus = { right: 0, judged: 0 }
let run = 0

/** A right answer's judgement from how far it was from its time, in beats. */
export const judgementOf = (offsetBeats: number): Judgement => (Math.abs(offsetBeats) <= PERFECT_WITHIN ? 'perfect' : 'good')

/** A chord or note judged: counted for the statistics and the chorus, and shown. */
export function judged(area: PracticeArea, judgement: Judgement): void {
  const right = judgement !== 'miss'
  countAnswer(area, right)
  chorus = { right: chorus.right + (right ? 1 : 0), judged: chorus.judged + 1 }
  run = right ? run + 1 : 0
  if (effectsOn()) window.dispatchEvent(new CustomEvent<JudgedEvent>(JUDGED_EVENT, { detail: { judgement, run } }))
}

/** Whether a chorus's answers earn a burst. */
export const earnsBurst = (counts: { right: number; judged: number }) =>
  counts.judged >= BURST_MIN && counts.right / counts.judged >= BURST_SHARE

/** A chorus has ended: a burst if it went well; the next chorus counts from zero. */
export function chorusEnded(): void {
  if (earnsBurst(chorus)) celebrate()
  chorus = { right: 0, judged: 0 }
}

/** A burst of colour for something done (a lesson unit finished), when the effects are on. */
export function celebrate(): void {
  if (effectsOn()) window.dispatchEvent(new CustomEvent(BURST_EVENT))
}

/** Start counting afresh (a new song, the band started again). */
export function resetChorus(): void {
  chorus = { right: 0, judged: 0 }
  run = 0
}

/**
 * For a screen that judges: end a chorus when the band moves to the next one or stops, and start
 * afresh when it starts playing.
 */
export function useChorusEffects(chorusPlaying: number, playing: boolean): void {
  const last = useRef({ chorus: chorusPlaying, playing })
  useEffect(() => {
    const before = last.current
    if (playing && !before.playing) resetChorus()
    else if ((before.playing && !playing) || (playing && chorusPlaying !== before.chorus)) chorusEnded()
    last.current = { chorus: chorusPlaying, playing }
  }, [chorusPlaying, playing])
}
