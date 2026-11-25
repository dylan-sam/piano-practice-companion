// Practice settings: loop part of a tune, go round the keys, speed up each chorus

import type { PracticeOptions } from '../engine/timeline'
import { substitutes, type SubstitutionSettings } from './substitutions'
import type { Chart } from './chart'

export interface PracticeSettings {
  loop: [number, number] | null // written bar indices
  keyStep: number // semitones per chorus
  randomKeys?: { seed: number } // instead of the step: the twelve keys in a random order
  subs?: SubstitutionSettings // chord substitutions (the Substitutions menu)
  ramp: number // bpm added per chorus
}

export const NO_PRACTICE: PracticeSettings = { loop: null, keyStep: 0, ramp: 0 }

// The tempo range of the players and the sightreaders (the speed-up stops at its top)
export const BPM_RANGE: [number, number] = [40, 300]

// The Keys menu: a step in semitones each chorus, or random keys (from OpenStand #124). The number
// of keys a step goes round: 12 for a half step, a fourth or a fifth, 6 for a whole step, 4 for a
// minor third, 3 for a major third
export const RANDOM_KEYS = 'random'
export const KEY_STEPS: { step: number | typeof RANDOM_KEYS; label: string }[] = [
  { step: 0, label: 'Stay in the written key' },
  { step: 5, label: 'Up a fourth each chorus (all 12 keys)' },
  { step: 7, label: 'Up a fifth each chorus (all 12 keys)' },
  { step: 1, label: 'Up a half step each chorus' },
  { step: 11, label: 'Down a half step each chorus' },
  { step: 2, label: 'Up a whole step each chorus' },
  { step: 3, label: 'Up a minor third each chorus' },
  { step: 4, label: 'Up a major third each chorus' },
  { step: RANDOM_KEYS, label: 'Random key each chorus (all 12 keys)' },
]

/** The practice settings the band is arranged with: the loop and the key of each chorus. */
export function practiceOptions(settings: PracticeSettings): PracticeOptions {
  return { loop: settings.loop, keyStep: settings.keyStep, ...(settings.randomKeys ? { randomKeys: settings.randomKeys } : {}),
    ...(substitutes(settings.subs) ? { subs: settings.subs } : {}) }
}

/** Whether the key changes from chorus to chorus (a step or random keys). */
export function changesKeys(settings: PracticeSettings): boolean {
  return settings.keyStep !== 0 || !!settings.randomKeys
}

// Rehearsal sections as bar ranges: from each mark to the bar before the next one
export function sections(chart: Chart): { name: string; from: number; to: number }[] {
  const starts = chart.bars.flatMap((b, i) => (b.section ? [i] : []))
  return starts.map((from, n) => {
    let to = (starts[n + 1] ?? chart.bars.length) - 1
    while (to > from && chart.bars[to].spacer) to--
    const mark = chart.bars[from].section!
    return { name: mark === 'i' ? 'Intro' : mark === 'v' ? 'Verse' : mark, from, to }
  })
}

/** Whether the keys of the choruses differ: another step, random keys turned on or off, or a new random order. */
function keysChanged(from: PracticeSettings, to: PracticeSettings): boolean {
  return from.keyStep !== to.keyStep || from.randomKeys?.seed !== to.randomKeys?.seed
}

/** Whether the chord substitutions differ (other ones, or when they play). */
function subsChanged(from: PracticeSettings, to: PracticeSettings): boolean {
  return JSON.stringify(substitutes(from.subs) ? from.subs : null) !== JSON.stringify(substitutes(to.subs) ? to.subs : null)
}

/**
 * How a change of practice settings reaches a playing band: a new loop changes the music and
 * starts over, new keys or substitutions are arranged again and go on from where the band is, a
 * new tempo ramp only changes the tempo.
 */
export function practiceChange(from: PracticeSettings, to: PracticeSettings): 'loop' | 'keys' | 'tempo' | 'none' {
  if (String(from.loop) !== String(to.loop)) return 'loop'
  if (keysChanged(from, to) || subsChanged(from, to)) return 'keys'
  return from.ramp !== to.ramp ? 'tempo' : 'none'
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

/** The choruses to play when going round the keys starts: enough to get back to the written key. */
export function chorusesForKeys(from: PracticeSettings, to: PracticeSettings, choruses: number): number {
  const needed = to.randomKeys ? 12 : to.keyStep ? 12 / gcd(to.keyStep, 12) : 0
  return keysChanged(from, to) && choruses < needed ? needed : choruses
}

/** The tempo of a chorus with Practice's speed-up: `ramp` more per chorus, kept within the range. */
export function rampedBpm(bpm: number, practice: PracticeSettings, chorus: number, range: [number, number]): number {
  return Math.max(range[0], Math.min(range[1], bpm + practice.ramp * chorus))
}

/** What to do with a playing song when the practice settings change (see `applyPracticeChange`). */
export interface PracticeActions {
  restart: (next: PracticeSettings, choruses: number) => void // a new loop: start the song again
  goOn: (next: PracticeSettings, choruses: number) => void // new keys while the band plays: go on from where it is
  keep: (next: PracticeSettings, choruses: number) => void // only remember them (a tempo ramp, or nothing playing)
}

/**
 * Apply new practice settings: a new loop starts the song again, new keys go on from where the
 * band is (with the choruses needed to go round them), anything else is only kept.
 */
export function applyPracticeChange(from: PracticeSettings, to: PracticeSettings, choruses: number, playing: boolean,
  actions: PracticeActions): void {
  const change = practiceChange(from, to)
  const nextChoruses = chorusesForKeys(from, to, choruses)
  if (change === 'loop') actions.restart(to, nextChoruses)
  else if (change === 'keys' && playing) actions.goOn(to, nextChoruses)
  else actions.keep(to, nextChoruses)
}
