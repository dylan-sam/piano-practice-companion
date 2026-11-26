// What a step of the Lessons tab opens: a screen of the app, set up for the step (song, key,
// tempo, band, what is checked, muted parts...). The settings ride in the address's query
// string, so a step can also be bookmarked; each screen reads them once when it opens and
// applies those it knows (useLessonLink), for this visit only: the screen's own settings are
// left as they were. A step with a target is ticked when the screen reaches it (useLessonGoal).

import { useMemo } from 'react'
import { FROM_LESSONS } from '../router'
import type { Part } from '../engine/arrange'
import { CHECK_MODES, type CheckMode } from '../exercises/melodyReading'
import { LEFT_HAND_STAGES, VOICINGS, type LeftHandStage, type Voicing } from '../exercises/sightReading'
import { SUBSTITUTIONS, type SubstitutionId } from '../music/substitutions'
import { FRAMES } from './introEndings'

export interface LessonLink {
  route: string // the screen (ROUTES)
  song?: string // a song, exercise or lick to open, by title (exact, else the first that starts with it, case ignored); in Lick Sightreading, the lick played
  key?: number // the key to play it in, as a pitch class (0 = C)
  bpm?: number
  style?: string // band style id
  pattern?: string // piano pattern id
  check?: CheckMode // Lead Sheet and Exercises Sightreading: what is checked
  leftHand?: LeftHandStage // ... and what the left hand plays
  mute?: Part[] // band parts muted in the Mixer
  playlist?: string // Lick Sightreading: the lick playlist offered
  infinite?: boolean // start on an endless line of progressions
  voicing?: Voicing // Chord Sightreading: how chords must be voiced
  step?: string // the lesson step it was opened from: back leads to its page, and it is ticked when its target is reached
  goal?: number // the target: this percent right, at `bpm` or faster
  timing?: number // ... and notes on time within this many milliseconds on average
  subs?: SubstitutionId[] // chord substitutions the band plays (and the sheet shows), every chorus
  frame?: string // Lead Sheet Sightreading: bars added for an intro and an ending (introEndings.ts FRAMES), this visit only
  exercise?: string // Exercises Sightreading: the settings of the exercise built for the step (exerciseBuilder.ts specText), locked
  choruses?: number // Lead Sheet and Exercises Sightreading: how many times through (a short exercise played several times)
  keyStep?: number // ... and the key moving by this many semitones each time (Practice > Keys; 5: up a fourth)
  guesses?: number // Melodic Dictation: how many notes to write in each melody
  alterations?: 'none' | 'with' | 'any' // ... and whether its melodies have notes outside the key signature
}

const PARTS: Part[] = ['bass', 'comp', 'melody', 'drums']

/**
 * The address of a lesson step's screen with its settings, marked as opened from the Lessons tab.
 *
 *   { route: '/sightreading/lead-sheets', song: 'Avalon', bpm: 70, leftHand: 'bass' }
 *     -> '/sightreading/lead-sheets?song=Avalon&bpm=70&leftHand=bass&from=lessons'
 */
export function lessonUrl(link: LessonLink): string {
  const { route, mute, infinite, subs, ...rest } = link
  const query = new URLSearchParams()
  for (const [name, value] of Object.entries(rest)) if (value !== undefined) query.set(name, String(value))
  if (mute?.length) query.set('mute', mute.join(','))
  if (infinite) query.set('infinite', '1')
  if (subs?.length) query.set('subs', subs.join(','))
  query.set('from', FROM_LESSONS) // the back button leads to the step's page (or the Lessons tab)
  return `${route}?${query.toString()}`
}

/** A whole number from a query value within bounds, else undefined. */
function numberIn(value: string | null, low: number, high: number): number | undefined {
  const number = value === null ? NaN : Number(value)
  return Number.isInteger(number) && number >= low && number <= high ? number : undefined
}

/** A value of the query that is one of some ids, else undefined. */
function oneOf<T extends string>(value: string | null, options: { id: T }[]): T | undefined {
  return options.find((option) => option.id === value)?.id
}

/** The lesson settings of an address's query string (none: an ordinary visit); unknown values are left out. */
export function readLessonLink(search: string): Omit<LessonLink, 'route'> | null {
  const query = new URLSearchParams(search)
  if (![...query.keys()].length) return null
  return {
    song: query.get('song') ?? undefined,
    key: numberIn(query.get('key'), 0, 11),
    bpm: numberIn(query.get('bpm'), 20, 400),
    style: query.get('style') ?? undefined,
    pattern: query.get('pattern') ?? undefined,
    check: oneOf(query.get('check'), CHECK_MODES),
    leftHand: oneOf(query.get('leftHand'), LEFT_HAND_STAGES),
    mute: query.get('mute')?.split(',').filter((part): part is Part => PARTS.includes(part as Part)),
    playlist: query.get('playlist') ?? undefined,
    infinite: query.get('infinite') === '1' || undefined,
    voicing: oneOf(query.get('voicing'), VOICINGS),
    step: query.get('step') ?? undefined,
    goal: numberIn(query.get('goal'), 1, 100),
    timing: numberIn(query.get('timing'), 1, 1000),
    subs: query.get('subs')?.split(',').filter((id): id is SubstitutionId => SUBSTITUTIONS.some((s) => s.id === id)),
    frame: oneOf(query.get('frame'), Object.keys(FRAMES).map((id) => ({ id }))),
    exercise: query.get('exercise') ?? undefined,
    choruses: numberIn(query.get('choruses'), 1, 24),
    keyStep: numberIn(query.get('keyStep'), 1, 11),
    guesses: numberIn(query.get('guesses'), 1, 16),
    alterations: oneOf(query.get('alterations'), [{ id: 'none' as const }, { id: 'with' as const }, { id: 'any' as const }]),
  }
}

/** The lesson settings the page was opened with, read once. */
export function useLessonLink(): Omit<LessonLink, 'route'> | null {
  return useMemo(() => (typeof window === 'undefined' ? null : readLessonLink(window.location.search)), [])
}

/** The first of some items whose title starts with a lesson's song title (case ignored). */
export function findByTitle<T extends { chart: { title: string } }>(items: readonly T[], title: string): T | undefined {
  const wanted = title.toLowerCase()
  return items.find((item) => item.chart.title.toLowerCase() === wanted) ??
    items.find((item) => item.chart.title.toLowerCase().startsWith(wanted))
}

/** The transposition that puts a chart in a lesson's key (the nearest way, -5 to +6), or none. */
export function transposeTo(chartKey: number, key: number | undefined): number | undefined {
  if (key === undefined) return undefined
  const up = (key - chartKey + 12) % 12
  return up > 6 ? up - 12 : up
}
