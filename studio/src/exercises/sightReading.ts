import { chordTones, parseChord, type Chord } from '../music/chords'
import type { Chart, ChartBar } from '../music/chart'
import { slotAtBeat, type Slot, type Timeline } from '../engine/timeline'
import { chordSlots } from './lickReading'
import type { Progression } from './nameProgression'
import { romanSymbol } from './nameProgression'
import type { KeyCentre } from '../music/roman'
import { substituteChart, substitutionOrder } from '../music/substitutions'

export type Mistakes = Record<string, number>
// Progressions joined into one infinite chunk (several minutes of music)
export const INFINITE_GROUPS = 128
export type Transition = 'shared chord' | 'new tonic' | 'dominant resolution'

export interface InfiniteStep {
  symbol: string
  written?: string // the progression's chord, when a substitution plays `symbol` instead
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

/**
 * How a chord must be voiced (Chord Sightreading's voicing drills, in the order jazz piano
 * teaching brings them):
 *
 *   any       the chord in any inversion (matchesPlayedChord)              C7: C E G Bb, E Bb C...
 *   shell     root at the bottom, 3rd and 7th (or 6th), nothing else          C7: C E Bb, C Bb E
 *   twoHand   a shell under the 9th and 5th: root lowest, 3rd, 5th, 7th, 9th  C7: C Bb E | D G
 *   rootless  3rd, 7th and 9th (5th or 13th allowed), no root                 C7: E A Bb D, Bb D E A
 *   quartal   three or more notes a perfect 4th apart, all from the chord's scale  Dm7: E A D G
 */
export type Voicing = 'any' | 'shell' | 'twoHand' | 'rootless' | 'quartal'
export const VOICINGS: { id: Voicing; text: string }[] = [
  { id: 'any', text: 'Any voicing' },
  { id: 'shell', text: 'Shells (root, 3rd, 7th)' },
  { id: 'twoHand', text: 'Two hands (shell + 9th and 5th)' },
  { id: 'rootless', text: 'Rootless (3rd, 7th, 9th)' },
  { id: 'quartal', text: 'Quartal (stacked 4ths)' },
]

/** The 9th a chord takes: flat or sharp when written, else natural. */
const ninthOf = (chord: Chord) => (chord.root + (/b9/.test(chord.suffix) ? 1 : /#9/.test(chord.suffix) ? 3 : 2)) % 12

/** Whether held notes voice a chord as a voicing drill asks (see Voicing). */
export function matchesVoicing(notes: ReadonlySet<number>, chord: Chord, voicing: Voicing, scale: readonly number[] = []): boolean {
  if (voicing === 'any') return matchesPlayedChord(notes, chord)
  const sorted = [...notes].sort((a, b) => a - b)
  const played = new Set(sorted.map((note) => note % 12))
  const tones = chordTones(chord)
  const pc = (interval: number | undefined) => (chord.root + (interval ?? 0)) % 12
  const third = pc(tones[1])
  const seventh = pc(tones[3] ?? 9) // a triad is voiced with its 6th
  const fifth = pc(tones[2])
  const only = (...allowed: number[]) => [...played].every((note) => allowed.includes(note))
  const has = (...wanted: number[]) => wanted.every((note) => played.has(note))
  switch (voicing) {
    case 'shell':
      return sorted[0] % 12 === chord.bass && has(chord.bass, third, seventh) && only(chord.bass, third, seventh)
    case 'twoHand':
      return sorted[0] % 12 === chord.bass && has(chord.bass, third, seventh, ninthOf(chord), fifth) &&
        only(chord.bass, third, seventh, ninthOf(chord), fifth)
    case 'rootless':
      return !played.has(chord.root) && has(third, seventh, ninthOf(chord)) &&
        only(third, seventh, ninthOf(chord), fifth, pc(9))
    case 'quartal':
      return sorted.length >= 3 && sorted.every((note, i) => i === 0 || note - sorted[i - 1] === 5) &&
        [...played].every((note) => scale.includes((note - chord.root + 12) % 12))
  }
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

/**
 * Whether the notes played during a chord cover it, in any rhythm: every required pitch class is
 * among them (the bass lowest, for a slash chord). Other notes are left out, so a broken chord, a
 * walking bass or a melody played with it still counts.
 */
export function coversChord(notes: Iterable<number>, chord: Chord): boolean {
  const allowed = allowedPitchClasses(chord)
  const tones = [...notes].filter((note) => allowed.has(note % 12))
  const played = new Set(tones.map((note) => note % 12))
  if ([...requiredPitchClasses(chord)].some((pc) => !played.has(pc))) return false
  return chord.bass === chord.root || Math.min(...tones) % 12 === chord.bass
}

/**
 * What the left hand plays for each chord, the stages of learning a song's left hand:
 *
 *   bass     the chord's bass note (its root, or the bass of a slash chord), any rhythm
 *   chord    the whole chord, any voicing, inversion or rhythm (coversChord)
 *   beats    the whole chord, with a key struck on every beat
 *   pattern  the band piano's rhythm (its attacks), with the chord's bass among the notes
 */
export type LeftHandStage = 'bass' | 'chord' | 'beats' | 'pattern'
export const LEFT_HAND_STAGES: { id: LeftHandStage; text: string }[] = [
  { id: 'bass', text: 'Bass note only' },
  { id: 'chord', text: 'Whole chord, any rhythm' },
  { id: 'beats', text: 'Whole chord on each beat' },
  { id: 'pattern', text: "The piano pattern's rhythm" },
]

/** How a chord judge listens: see ChordJudge. */
export interface ChordJudgeOptions {
  broken?: boolean
  stage?: LeftHandStage // broken judges only; default 'chord'
  onsets?: readonly number[] // 'pattern': the band piano's attack beats, sorted
  window?: number // how far a key may be from a beat or attack, in beats (default 1/4)
  voicing?: Voicing // held judges only: how the chord must be voiced (default any)
}

/**
 * Judge note-on attempts within each chord's beat window and expire misses. A `broken` judge
 * gathers the notes of a chord over its whole time, judged at its stage (LeftHandStage): a stage
 * with a rhythm also wants a key near each of the chord's beats or attacks. Otherwise the chord
 * must be held as a whole voicing (matchesPlayedChord).
 *
 *   beats, C7 over 2 beats at beat 4:  C E Bb at 4.1, Bb at 5.05  -> played
 *                                      C E Bb at 4.1              -> missed (no key on beat 5)
 */
export class ChordJudge {
  private judged = new Set<number>()
  private finalized = 0
  private readonly timeline: Timeline
  private readonly broken: boolean
  private readonly stage: LeftHandStage
  private readonly onsets: readonly number[]
  private readonly window: number
  private readonly voicing: Voicing
  private gathered = new Map<number, Set<number>>() // broken: the notes played so far in each chord
  private presses: number[] = [] // broken: the beats keys were struck at, for the rhythm

  /** Keep the timed chord slots that this judge will assess. */
  constructor(timeline: Timeline, options: ChordJudgeOptions = {}) {
    this.timeline = timeline
    this.broken = !!options.broken
    this.stage = options.stage ?? 'chord'
    this.onsets = options.onsets ?? []
    this.window = options.window ?? 0.25
    this.voicing = options.voicing ?? 'any'
  }

  /** The beats a chord's rhythm wants a key on, at this judge's stage (none without a rhythm). */
  private beatsOf(slot: Slot): number[] {
    const end = slot.start + slot.beats - 0.001
    if (this.stage === 'beats') return Array.from({ length: Math.ceil(slot.beats - 0.001) }, (_, k) => slot.start + k)
    if (this.stage === 'pattern') return this.onsets.filter((beat) => beat >= slot.start - 0.001 && beat < end)
    return []
  }

  /** Whether the notes gathered for a chord and the keys struck make it, at this judge's stage. */
  private made(slot: Slot, notes: Set<number>): boolean {
    const bassOnly = this.stage === 'bass' || this.stage === 'pattern'
    if (bassOnly ? ![...notes].some((note) => note % 12 === slot.chord.bass) : !coversChord(notes, slot.chord)) return false
    return this.beatsOf(slot).every((beat) => this.presses.some((press) => Math.abs(press - beat) <= this.window))
  }

  /** The chord sounding at a beat, if any. */
  chordAt(beat: number): Chord | null {
    const slot = slotAtBeat(this.timeline, beat)
    return slot && slot.chordIndex >= 0 && beat < slot.start + slot.beats ? slot.chord : null
  }

  /** The number of chords to play. */
  get total(): number {
    return this.timeline.slots.filter((slot) => slot.chordIndex >= 0).length
  }

  /** Accept the first complete voicing played within a chord's allowed beats (`pitch`: the key just pressed). */
  accept(beat: number, held: ReadonlySet<number>, pitch?: number): Slot | null {
    // Every key counts for the rhythm, even one struck early for the next chord
    if (this.broken && pitch !== undefined) this.presses.push(beat)
    // A key struck just before a chord (within the window) is played for that chord
    const ahead = this.broken ? slotAtBeat(this.timeline, beat + this.window) : undefined
    const slot = ahead && ahead.start > beat ? ahead : slotAtBeat(this.timeline, beat)
    if (!slot || slot.chordIndex < 0 || beat >= slot.start + slot.beats) return null
    const index = this.timeline.slots.indexOf(slot)
    if (index < this.finalized || this.judged.has(index)) return null
    if (this.broken) {
      const notes = this.gathered.get(index) ?? new Set<number>()
      for (const note of held) notes.add(note)
      if (pitch !== undefined) notes.add(pitch)
      this.gathered.set(index, notes)
      if (!this.made(slot, notes)) return null
    } else if (!matchesVoicing(held, slot.chord, this.voicing, chordSlots(slot.chord))) return null
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
      this.gathered.delete(index)
      this.finalized++
    }
    // Keys long past can no longer be near a beat still to judge
    const done = this.timeline.slots[this.finalized]?.start ?? Infinity
    this.presses = this.presses.filter((press) => press >= done - 1)
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

/**
 * The key of each bar of an infinite line: the key of the progression playing at its downbeat
 * (two chords to a bar), minor when the progression's I is minor.
 */
export function lineKeys(line: InfiniteLine, progressions: readonly Progression[]): KeyCentre[] {
  const byId = new Map(progressions.map((progression) => [progression.id, progression]))
  return line.chart.bars.map((_, bar) => {
    const step = line.steps[bar * 2]
    const progression = step && byId.get(step.progressionId)
    return { tonic: step?.key ?? line.chart.key, minor: !!progression && progressionMode(progression) === 'minor' }
  })
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
  let last = previous ? previous.written ?? previous.symbol : steps.at(-1)!.symbol
  let lastKey = firstKey
  for (let index = 0; index < groups; index++) {
    const next = nextInfiniteSteps(last, eligible, mistakes, focus, random, sevenths)
    steps.push(...next.steps)
    last = steps.at(-1)!.symbol
    lastKey = next.key
  }
  return withSubstitutions(steps, firstKey, lastKey, random)
}

// How often each substitution is used in a line's sheet, and then how often at each place it fits
const LINE_SUBSTITUTION_SHARE = 0.5

/**
 * A line's sheet from its chords, two to a bar, with chord substitutions added at random (not a
 * setting: a part of the line): each substitution of the Substitutions menu is used on about half
 * of the sheets, in a random order, at about one place in two where it fits. Only whole chords
 * are replaced (no ii added, no chord split), so the chords stay two to a bar; the sheet's ends
 * are left as written, as the line goes on to the next sheet. A substituted step keeps its chord
 * in `written` (drawn in blue).
 */
function withSubstitutions(steps: InfiniteStep[], firstKey: number, lastKey: number, random: () => number): InfiniteLine {
  const written = lineChart(steps, firstKey)
  const ids = shuffled(substitutionOrder(undefined), random).filter(() => random() < LINE_SUBSTITUTION_SHARE)
  const chart = substituteChart(written, { ids, when: { kind: 'random' }, seed: Math.floor(random() * 2 ** 31) }, 0, { piece: true })
  const chords = chart.bars.flatMap((bar) => bar.chords)
  if (chords.length !== steps.length) return { chart: written, steps, lastKey }
  return {
    chart,
    steps: steps.map((step, i) => {
      const { symbol, written: was } = chords[i]
      return was && symbol ? { ...step, symbol, written: was } : step
    }),
    lastKey,
  }
}

/** The list in a random order. */
function shuffled<T>(items: T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** A line's chords as a chart, two to a bar. */
function lineChart(steps: InfiniteStep[], key: number): Chart {
  const bars: ChartBar[] = []
  for (let index = 0; index < steps.length; index += 2) {
    const pair = steps.slice(index, index + 2)
    bars.push({
      chords: pair.map((step) => ({ symbol: step.symbol, beats: pair.length === 2 ? 2 : 4 })),
      cells: 4, rowStart: index % 8 === 0 || undefined,
      barline: index + 2 >= steps.length ? 'final' : undefined,
    })
  }
  return { format: 'openstand-chart', version: 1, title: 'Infinite chord progressions', style: 'swing', key, bpm: 100, time: [4, 4], bars }
}
