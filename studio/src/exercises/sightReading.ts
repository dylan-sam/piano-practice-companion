import { chordTones, parseChord, type Chord } from '../music/chords'
import type { Chart, ChartBar } from '../music/chart'
import { slotAtBeat, type Slot, type Timeline } from '../engine/timeline'
import type { Progression } from './nameProgression'
import { romanSymbol } from './nameProgression'

export type Mistakes = Record<string, number>
// Progressions joined into one infinite chunk (several minutes of music)
export const INFINITE_GROUPS = 128
export type Transition = 'shared chord' | 'new tonic' | 'dominant resolution'

export interface InfiniteStep {
  symbol: string
  key: number
  progressionId: string
  transition: Transition
}

export interface InfiniteLine {
  chart: Chart
  steps: InfiniteStep[]
  lastKey: number
}

/**
 * Seventh-chord versions of catalog progressions, chord for chord. In the infinite line a
 * progression listed here is played in its seventh version with the probability set by the
 * 7th chords slider, and as written otherwise.
 */
export const SEVENTH_VARIANTS: [string[], string[]][] = [
  [['II:min', 'V:maj', 'I:maj'], ['II:min7', 'V:7', 'I:maj7']],
  [['VI:min', 'II:min', 'V:maj', 'I:maj'], ['VI:min7', 'II:min7', 'V:7', 'I:maj7']],
  [['II:maj', 'V:maj', 'I:maj'], ['II:7', 'V:7', 'I:maj']],
  [['I:maj', 'VI:min', 'IV:maj', 'V:maj'], ['I:maj7', 'VI:min7', 'IV:maj7', 'V:7']],
  [['I:maj', 'IV:maj', 'V:maj'], ['I:maj', 'IV:maj', 'V:7']],
  [['IV:maj', 'V:maj', 'I:maj'], ['IV:maj', 'V:7', 'I:maj']],
  [['I:maj', 'V:maj', 'VI:min', 'IV:maj'], ['I:maj', 'V:7', 'VI:min', 'IV:maj']],
  [['VI:min', 'IV:maj', 'I:maj', 'V:maj'], ['VI:min', 'IV:maj', 'I:maj', 'V:7']],
  [['IV:maj', 'V:maj', 'I:maj', 'VI:min'], ['IV:maj', 'V:7', 'I:maj', 'VI:min']],
  [['I:min', 'VIIb:maj', 'VIb:maj', 'V:maj'], ['I:min7', 'VIIb:maj', 'VIb:maj7', 'V:7']],
  [['IV:min', 'V:maj', 'I:min'], ['IV:min7', 'V:7', 'I:min7']],
  [['I:maj', 'III:maj', 'IV:maj', 'IV:min'], ['I:maj', 'III:7', 'IV:maj', 'IV:min6']],
  [['VIb:maj', 'VIIb:maj', 'I:maj'], ['VIb:maj7', 'VIIb:7', 'I:maj']],
]

/** The chords to play for one occurrence of a progression: its seventh version with probability `sevenths`. */
export function progressionChords(progression: Progression, sevenths: number, random: () => number): string[] {
  const variant = SEVENTH_VARIANTS.find(([plain]) => plain.join(' ') === progression.chords.join(' '))
  return variant && sevenths > 0 && random() < sevenths ? variant[1] : progression.chords
}

/** Validate persisted mistake counts before they affect progression weights. */
export function isMistakes(value: unknown): value is Mistakes {
  return !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.values(value).every((count) => Number.isInteger(count) && count >= 0)
}

/** Group mistakes by sounding root and chord family so colored song chords aid triad practice. */
export function mistakeKey(chord: Chord): string {
  return `${chord.root}:${chordFamily(chord)}`
}

/**
 * Return the pitch classes required for a complete chord, including its seventh when written.
 * In a four-note chord the perfect fifth may be left out (an altered fifth may not).
 */
export function requiredPitchClasses(chord: Chord): Set<number> {
  const tones = chordTones(chord)
  const intervals = ['maj', 'min', 'dim', 'aug', 'sus', 'sus2'].includes(chord.quality)
    ? tones.slice(0, 3)
    : chord.quality === 'power' ? [0, 7] : chord.quality === 'root' ? [0]
      : tones.filter((interval, index) => !(index === 2 && interval === 7))
  const required = new Set(intervals.map((interval) => (chord.root + interval) % 12))
  required.add(chord.bass)
  return required
}

/** Permit written color tones without demanding extra fingers beyond the core chord. */
export function allowedPitchClasses(chord: Chord): Set<number> {
  const allowed = requiredPitchClasses(chord)
  // An optional fifth may still be played
  for (const interval of chordTones(chord).slice(0, 3)) allowed.add((chord.root + interval) % 12)
  const intervals: Record<string, number> = { '9': 2, '11': 5, '13': 9 }
  for (const [, alteration, degree] of chord.suffix.matchAll(/([b#]?)(9|11|13)/g)) {
    const offset = alteration === 'b' ? -1 : alteration === '#' ? 1 : 0
    allowed.add((chord.root + intervals[degree] + offset + 12) % 12)
  }
  if (chord.tensions.includes('alt')) {
    for (const interval of [1, 3, 6, 8]) allowed.add((chord.root + interval) % 12)
  }
  return allowed
}

/** Accept octave doublings and inversions, but reject missing or foreign notes. */
export function matchesPlayedChord(notes: ReadonlySet<number>, chord: Chord): boolean {
  const required = requiredPitchClasses(chord)
  if (notes.size < Math.min(3, required.size)) return false
  const allowed = allowedPitchClasses(chord)
  const played = new Set([...notes].map((note) => note % 12))
  if ([...required].some((pc) => !played.has(pc)) || [...played].some((pc) => !allowed.has(pc))) return false
  return chord.bass === chord.root || Math.min(...notes) % 12 === chord.bass
}

/** Judge note-on attempts within each chord's beat window and expire misses. */
export class ChordJudge {
  private judged = new Set<number>()
  private finalized = 0
  private readonly timeline: Timeline

  /** Keep the timed chord slots that this judge will assess. */
  constructor(timeline: Timeline) { this.timeline = timeline }

  /** Accept the first complete voicing played within a chord's allowed beats. */
  accept(beat: number, held: ReadonlySet<number>): Slot | null {
    const slot = slotAtBeat(this.timeline, beat)
    if (!slot || slot.chordIndex < 0 || beat >= slot.start + slot.beats) return null
    const index = this.timeline.slots.indexOf(slot)
    if (index < this.finalized || this.judged.has(index) || !matchesPlayedChord(held, slot.chord)) return null
    this.judged.add(index)
    return slot
  }

  /** Return each unplayed chord whose time window has ended. */
  expire(beat: number): Slot[] {
    const missed: Slot[] = []
    while (this.finalized < this.timeline.slots.length) {
      const index = this.finalized
      const slot = this.timeline.slots[index]
      if (slot.start + slot.beats > beat + 0.001) break
      if (slot.chordIndex >= 0 && !this.judged.has(index)) missed.push(slot)
      this.finalized++
    }
    return missed
  }
}

/** Pick an item with a positive weight while allowing deterministic test randomness. */
function weightedPick<T>(items: T[], weight: (item: T) => number, random: () => number): T {
  const weighted = items.map((item) => ({ item, value: weight(item) }))
  const total = weighted.reduce((sum, entry) => sum + entry.value, 0)
  let threshold = random() * total
  for (const entry of weighted) {
    threshold -= entry.value
    if (threshold < 0) return entry.item
  }
  return items[items.length - 1]
}

/** Group major seventh and dominant chords with major triads for transitions. */
function chordFamily(chord: Chord): 'major' | 'minor' | 'other' {
  if (['maj', 'maj6', 'maj7', 'dom7'].includes(chord.quality)) return 'major'
  if (['min', 'min6', 'min7', 'minMaj7'].includes(chord.quality)) return 'minor'
  return 'other'
}

/** Infer the tonic mode declared by a Roman-numeral progression. */
function progressionMode(progression: Progression): 'major' | 'minor' | 'unknown' {
  if (progression.chords.some((chord) => chord.startsWith('I:min'))) return 'minor'
  if (progression.chords.some((chord) => chord.startsWith('I:maj'))) return 'major'
  return 'unknown'
}

/** Build one transposed pattern as playable chart symbols, from its written or seventh chords. */
function symbolsFor(progression: Progression, key: number, chords = progression.chords): string[] {
  return chords.map((chord) => romanSymbol(chord, key, false))
}

/** Prefer patterns containing chords previously missed in their actual sounding key. */
function patternWeight(symbols: string[], mistakes: Mistakes, focus: boolean): number {
  if (!focus) return 1
  return 1 + symbols.reduce((sum, symbol) => {
    const chord = parseChord(symbol)
    return sum + (chord ? mistakes[mistakeKey(chord)] ?? 0 : 0)
  }, 0)
}

/** Choose a route from the last chord into another short catalog progression. */
export function nextInfiniteSteps(
  last: string, patterns: Progression[], mistakes: Mistakes, focus: boolean, random: () => number = Math.random,
  sevenths = 0,
): { steps: InfiniteStep[]; key: number; transition: Transition } {
  const previous = parseChord(last)
  if (!previous) throw new Error(`Cannot connect the chord ${last}`)
  const eligible = patterns.filter((pattern) => pattern.chords.length >= 2 && pattern.chords.length <= 4)
  if (!eligible.length) throw new Error('No short progressions are available')
  const shared = eligible.flatMap((progression) => Array.from({ length: 12 }, (_, key) => {
    const symbols = symbolsFor(progression, key)
    const first = parseChord(symbols[0])!
    return first.root === previous.root && chordFamily(first) === chordFamily(previous)
      ? [{ progression, key, symbols }] : []
  }).flat())
  const tonicKey = previous.root
  const newTonic = chordFamily(previous) === 'other' ? [] : eligible.filter((progression) =>
    (progressionMode(progression) === chordFamily(previous) || progressionMode(progression) === 'unknown') &&
    parseChord(symbolsFor(progression, tonicKey)[0])?.root !== tonicKey)
  const dominantKey = (previous.root + 5) % 12
  const afterDominant = eligible.filter((progression) =>
    progressionMode(progression) !== 'minor' &&
    parseChord(symbolsFor(progression, dominantKey)[0])?.root !== dominantKey)
  const routes: Transition[] = [
    ...(shared.length ? ['shared chord' as const] : []),
    ...(newTonic.length ? ['new tonic' as const] : []),
    ...(chordFamily(previous) === 'major' && afterDominant.length ? ['dominant resolution' as const] : []),
  ]
  if (!routes.length) throw new Error(`No progression can follow ${last}`)
  const transition = routes[Math.floor(random() * routes.length)]
  if (transition === 'shared chord') {
    const picked = weightedPick(shared, (candidate) => patternWeight(candidate.symbols.slice(1), mistakes, focus), random)
    const played = symbolsFor(picked.progression, picked.key, progressionChords(picked.progression, sevenths, random))
    return { key: picked.key, transition, steps: played.slice(1).map((symbol) => ({
      symbol, key: picked.key, progressionId: picked.progression.id, transition,
    })) }
  }
  const key = transition === 'new tonic' ? tonicKey : dominantKey
  const candidates = transition === 'new tonic' ? newTonic : afterDominant
  const picked = weightedPick(candidates, (candidate) => patternWeight(symbolsFor(candidate, key), mistakes, focus), random)
  const prefix = transition === 'dominant resolution' ? [romanSymbol('I:maj', key, false)] : []
  const played = symbolsFor(picked, key, progressionChords(picked, sevenths, random))
  return { key, transition, steps: [...prefix, ...played].map((symbol) => ({
    symbol, key, progressionId: picked.id, transition,
  })) }
}

/** Build a long, repeatable listening chunk from short ChoCo catalog patterns. */
export function infiniteLine(
  patterns: Progression[], mistakes: Mistakes, focus: boolean, random: () => number = Math.random,
  previous?: InfiniteStep, groups = INFINITE_GROUPS, sevenths = 0,
): InfiniteLine {
  const eligible = patterns.filter((pattern) => pattern.chords.length >= 2 && pattern.chords.length <= 4)
  if (!eligible.length) throw new Error('No short progressions are available')
  const firstKey = previous?.key ?? Math.floor(random() * 12)
  const firstPattern = weightedPick(eligible, (pattern) => patternWeight(symbolsFor(pattern, firstKey), mistakes, focus), random)
  const firstChords = progressionChords(firstPattern, sevenths, random)
  const steps: InfiniteStep[] = previous ? [] : symbolsFor(firstPattern, firstKey, firstChords).map((symbol) => ({
    symbol, key: firstKey, progressionId: firstPattern.id, transition: 'new tonic',
  }))
  let last = previous?.symbol ?? steps.at(-1)!.symbol
  let lastKey = firstKey
  for (let index = 0; index < groups; index++) {
    const next = nextInfiniteSteps(last, eligible, mistakes, focus, random, sevenths)
    steps.push(...next.steps)
    last = steps.at(-1)!.symbol
    lastKey = next.key
  }
  const bars: ChartBar[] = []
  for (let index = 0; index < steps.length; index += 2) {
    const pair = steps.slice(index, index + 2)
    bars.push({
      chords: pair.map((step) => ({ symbol: step.symbol, beats: pair.length === 2 ? 2 : 4 })),
      cells: 4, rowStart: index % 8 === 0 || undefined,
      barline: index + 2 >= steps.length ? 'final' : undefined,
    })
  }
  return {
    chart: { format: 'openstand-chart', version: 1, title: 'Infinite chord progressions',
      style: 'swing', key: firstKey, bpm: 100, time: [4, 4], bars },
    steps, lastKey,
  }
}
