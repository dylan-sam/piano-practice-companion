import catalog from '../../../data/left_hand_patterns.json'
import { chordTones, rootlessVoicings, type Chord } from '../music/chords'
import { swingPlacer, toTicks, type NoteEvent } from './events'
import { remap, remapToPulses, type Timed } from './meter'
import type { Timeline, Slot } from './timeline'

// Every pattern's bar is written in 4/4 (stepsInBar fits it to other meters)
const SOURCE_BEATS = 4

interface PatternStep {
  position: number
  duration: number | null
  role: string
  grace: boolean
  initial_only: boolean
}

interface ShellHit {
  position_quarters: number
  from_bar_end: boolean
  duration_quarters: number
}

export interface PianoPattern {
  id: string
  name: string
  styles: string[]
  default_for: string[]
  cycle_bars: number
  transcribed?: boolean
  fidelity: string
  beat_interval_quarters: number | null
  steps: PatternStep[]
  shell_variations: { name: string; hits: ShellHit[] }[]
}

export const PIANO_PATTERNS = catalog as PianoPattern[]
const SHELL_PATTERNS = new Set(['boogie_walking_shells'])
const WALKING = new Set(['walking_bass', 'boogie_walking', 'boogie_walking_shells'])

/** Identify patterns whose low notes replace the style's bassline. */
export function usesWalkingBass(pattern: PianoPattern): boolean {
  return WALKING.has(pattern.id)
}

/** Return the curated piano choices in the project's source order. */
// A style's name in the pattern catalog (left_hand_patterns.py) where it differs from its id
const CATALOG_STYLE: Record<string, string> = { 'bossa-nova': 'bossa nova', 'jazz-waltz': 'jazz waltz' }

export function patternsForStyle(styleId: string): PianoPattern[] {
  const key = CATALOG_STYLE[styleId] ?? styleId
  return PIANO_PATTERNS.filter((pattern) => pattern.styles.includes(key))
}

/** Find the catalog's default piano pattern for one style. */
export function catalogPatternForStyle(styleId: string): string | null {
  const key = CATALOG_STYLE[styleId] ?? styleId
  return PIANO_PATTERNS.find((pattern) => pattern.default_for.includes(key))?.id ?? null
}

/** The piano pattern a style starts with in every screen: its chord comping for Swing, Jazz Waltz and Bossa, else the catalog's default. */
export function defaultPatternForStyle(styleId: string): string | null {
  return styleId === 'swing' || styleId === 'jazz-waltz' || styleId === 'bossa-nova'
    ? null : catalogPatternForStyle(styleId)
}

/** Place a pitch class at or above a register floor. */
function midiNote(pc: number, low = 36): number {
  return low + ((pc - low + 120) % 12)
}

/** Rotate chord tones above the actual slash bass. */
function voicingTones(chord: Chord, low = 36, includeSeventh = false): number[] {
  const bass = midiNote(chord.bass, low)
  const intervals = chordTones(chord).slice(0, includeSeventh ? 4 : 3)
  const pcs = new Set(intervals.map((degree) => (chord.root + degree) % 12))
  if (pcs.size < 2) pcs.add((chord.root + 7) % 12)
  return [bass, ...Array.from({ length: 12 }, (_, index) => bass + index + 1)
    .filter((pitch) => pcs.has(pitch % 12))]
}

/** Build a compact voicing with the slash bass and upper chord colors. */
function blockVoicing(chord: Chord, low: number): number[] {
  const bass = midiNote(chord.bass, low)
  const tones = chordTones(chord)
  const priority = [tones[1], tones[3], ...tones.slice(4), tones[2], tones[0]]
  const chosen = [bass]
  for (const interval of priority) {
    if (interval === undefined) continue
    const pitch = midiNote((chord.root + interval) % 12, bass + (interval >= 14 ? 12 : 1))
    if (!chosen.some((item) => item % 12 === pitch % 12)) chosen.push(pitch)
    if (chosen.length === 4) break
  }
  if (chosen.length < 4 && chosen.length > 1) chosen.push(bass + 12)
  return chosen.sort((a, b) => a - b)
}

/**
 * Levine's left-hand rootless voicing of a chord (The Jazz Piano Book, ch. 7 and 8), the same as
 * the band's comping (rootlessVoicings: its alterations written, b9, #9, b13...), in position A
 * (from the 3rd) or B (from the 7th): the one whose notes move least from the last voicing played
 * (`last`), its lowest note between C3 and Bb3, so ii-V-I alternates A, B, A.
 *
 *   D-7: F A C E (3 5 7 9)     G7: B E F A (3 13 7 9)     G7b9b13: B Eb F Ab (3 b13 7 b9)
 */
function rootlessVoicing(chord: Chord, last: number[] | null): number[] {
  const [a, b] = rootlessVoicings(chord)
  // Stack the notes upwards from the first, which is placed from C3
  const stack = (order: number[]) => order.slice(1).reduce((notes, step) =>
    [...notes, midiNote((chord.root + step) % 12, notes[notes.length - 1] + 1)], [midiNote((chord.root + order[0]) % 12, 48)])
  const positions = [stack(a), stack(b)].filter((notes) => notes[0] <= 58)
  // How far the hand moves from the last voicing (the first one sits nearest E3)
  const moved = (notes: number[]) => last ? notes.reduce((sum, note, i) => sum + Math.abs(note - (last[i] ?? note)), 0)
    : Math.abs(notes[0] - 52)
  return positions.sort((x, y) => moved(x) - moved(y))[0] ?? stack(a)
}

/** What a pattern remembers from one chord to the next: the last rootless voicing, for the voice leading. */
interface PatternMemory { rootless: number[] | null }

/** Resolve one scored piano role against the chord sounding at its attack. */
function rolePitches(chord: Chord, role: string, nextChord?: Chord, memory: PatternMemory = { rootless: null }): number[] {
  if (role.endsWith('_up')) return rolePitches(chord, role.slice(0, -3), nextChord, memory).map((pitch) => pitch + 12)
  const bass = midiNote(chord.bass)
  const root = midiNote(chord.root)
  const tones = voicingTones(chord)
  const third = tones[1] ?? bass + 4
  const fifth = tones[2] ?? third
  // A chord tone by index, or a fallback when the chord has fewer tones
  const degree = (index: number, fallback: number) => chordTones(chord)[index] ?? fallback
  // The note an interval above the chord's root, just above the bass
  const aboveBass = (interval: number, low = bass) => midiNote((chord.root + interval) % 12, low)
  switch (role) {
    case 'root': case 'root_low': return [bass]
    case 'fifth': return [fifth]
    case 'fifth_low': return [fifth - 12]
    case 'octave': return [bass + 12]
    case 'octaves': return [bass, bass + 12]
    case 'third': return [third]
    case 'tenth': return [third + 12]
    case 'second': return [root + 2]
    case 'fourth': return [root + 5]
    case 'sixth': return [root + 9]
    case 'flat_seventh': return [root + 10]
    case 'major_seventh': return [root + 11]
    case 'sharp_fourth': return [root + 6]
    case 'flat_third': return [root + 3]
    case 'power': return [bass, fifth]
    case 'fifth_octaves': return [fifth, fifth + 12]
    case 'third_octaves': { const note = aboveBass(degree(1, 4)); return [note, note + 12] }
    case 'stride_chord': return [fifth + 12, aboveBass(degree(3, 10), 55), bass + 24].sort((a, b) => a - b)
    case 'third_pair': return [bass, third]
    case 'upper_pair': return [third + 12, fifth + 12]
    case 'sixth_power': return [bass, aboveBass(9)]
    // Shells: the 3rd and 7th over the root (upper_: without it), an octave above the bass, or
    // Siskind's Type A (_a: the 3rd from C3, the 7th just above it)
    case 'shell': case 'upper_shell': case 'shell_a': case 'upper_shell_a': {
      const typeA = role.endsWith('_a')
      const guide = aboveBass(degree(1, 4), typeA ? 48 : bass + 12)
      const upper = aboveBass(degree(3, degree(2, 7)), typeA ? guide + 1 : bass + 12)
      return [...new Set(role.startsWith('upper') ? [guide, upper] : [bass, guide, upper])].sort((a, b) => a - b)
    }
    // Levine's rootless left-hand voicings, led from the last one
    case 'rootless': return (memory.rootless = rootlessVoicing(chord, memory.rootless))
    // Stacked 4ths: from the 3rd over a major 3rd (3rd, 13th, 9th: C -> E A D), else from the
    // root (root, 11th, 7th: Dm7 -> D G C)
    // Three 4ths from the 9th (Levine's fourth chords: D-7 -> E A D)
    case 'quartal_ninth': { const low = aboveBass(2, 50); return [low, low + 5, low + 10] }
    case 'quartal': {
      const low = chord.quality === 'maj' || chord.quality === 'maj7' || chord.quality === 'maj6' || chord.quality === 'dom7'
        ? aboveBass(degree(1, 4), 48) : aboveBass(0, 48)
      return [low, low + 5, low + 10]
    }
    case 'chord': case 'rolled': return blockVoicing(chord, 48)
    case 'chord_high': return blockVoicing(chord, 55)
    case 'triad': return voicingTones(chord, 48).slice(0, 3)
    case 'approach': case 'chromatic': return [midiNote(((nextChord?.bass ?? chord.bass) + 11) % 12)]
    default:
      if (role.startsWith('walk')) return [voicingTones(chord, 36, true)[Number(role.at(-1))] ?? bass]
      throw new Error(`Unknown piano pattern role: ${role}`)
  }
}

/** Find the chord active at a pattern attack, including mid-bar changes. */
function activeSlot(slots: Slot[], beat: number): { slot: Slot; next?: Slot } | null {
  const index = slots.findLastIndex((slot) => slot.start <= beat + 1e-8)
  if (index < 0) return null
  const slot = slots[index]
  if (beat >= Math.min(slot.start + slot.beats, slots[index + 1]?.start ?? Infinity) - 1e-8) return null
  return { slot, next: slots[index + 1] }
}

/** Fit fixed quarter-note chord pulses into the current bar. */
function stepsForBar(pattern: PianoPattern, barBeats: number): PatternStep[] {
  const interval = pattern.beat_interval_quarters
  if (!interval) return pattern.steps
  return Array.from({ length: Math.ceil((barBeats - 1e-8) / interval) }, (_, index) => ({
    position: index * interval / barBeats, duration: Math.min(interval, barBeats - index * interval) / barBeats,
    role: pattern.steps[0].role, grace: false, initial_only: false,
  }))
}

/** A step placed in a bar: its time and length in the bar's beats. */
interface PlacedStep extends Timed { step: PatternStep }

/**
 * The steps of a pattern's cycle bar placed in a bar of the song, in that bar's beats. Patterns
 * are written in 4/4: a bar of another simple meter plays the beats meter.ts gives (3/4: beats 1,
 * 2 and 4, so a stride stays oom-pah-pah on the beat), a compound bar (6/8) puts each half of the
 * 4/4 bar on one dotted-quarter pulse. Steps already measured in the bar (repeated chord pulses,
 * varied shells) keep their place.
 */
function stepsInBar(pattern: PianoPattern, bar: { beats: number; compound?: boolean }, cycleIndex: number,
  barIndex: number): PlacedStep[] {
  const fitted = !!pattern.beat_interval_quarters
  const own = stepsForBar(pattern, bar.beats).filter((step) => Math.floor(step.position) === cycleIndex
    && (!SHELL_PATTERNS.has(pattern.id) || step.role !== 'upper_shell'))
  const lengthOf = (step: PatternStep, index: number) => step.duration
    ?? Math.max(0.08, ((own[index + 1]?.position ?? cycleIndex + 1) - step.position) * 0.82)
  let placed: PlacedStep[]
  if (fitted) placed = own.map((step, index) => ({ at: (step.position - cycleIndex) * bar.beats, dur: lengthOf(step, index) * bar.beats, step }))
  else {
    const written = own.map((step, index) => ({ at: (step.position - cycleIndex) * SOURCE_BEATS, dur: lengthOf(step, index) * SOURCE_BEATS, step }))
    placed = bar.compound ? remapToPulses(written, bar.beats) : remap(written, SOURCE_BEATS, bar.beats)
  }
  if (SHELL_PATTERNS.has(pattern.id)) {
    placed.push(...shellSteps(pattern, bar.beats, cycleIndex, barIndex)
      .map((step) => ({ at: (step.position - cycleIndex) * bar.beats, dur: step.duration! * bar.beats, step })))
  }
  return placed.sort((a, b) => a.at - b.at)
}

/** Add one varied shell rhythm without restarting the bass figure. */
function shellSteps(pattern: PianoPattern, barBeats: number, cycleIndex: number, barIndex: number): PatternStep[] {
  const choices = pattern.shell_variations.filter((variation) => variation.hits.every((hit) => {
    const at = hit.from_bar_end ? barBeats - hit.position_quarters : hit.position_quarters
    return at >= 0 && at < barBeats - 1e-8
  }))
  if (!choices.length) return []
  const selected = choices[barIndex % choices.length]
  return selected.hits.map((hit) => {
    const at = hit.from_bar_end ? barBeats - hit.position_quarters : hit.position_quarters
    return { position: cycleIndex + at / barBeats, duration: Math.min(hit.duration_quarters, barBeats - at) / barBeats,
      role: 'upper_shell', grace: false, initial_only: false }
  })
}

interface WalkState { pitch: number | null; chord: Chord | null; index: number | null; adapted: boolean }

/** Keep the walking bass near its previous pitch while following source contour. */
function walkingPitch(chord: Chord, patternId: string, stepIndex: number, state: WalkState): [number, boolean] {
  const source = patternId.startsWith('walking_bass') ? [0, 2, 4, 5, 6, 5, 4, 2] : [0, 4, 7, 9, 10, 9, 7, 4]
  const roots = Array.from({ length: 21 }, (_, index) => index + 35).filter((pitch) => pitch % 12 === chord.bass)
  // The chord root nearest the previous note
  const root = (previous: number | null) => roots
    .slice().sort((a, b) => Math.abs(a - (previous ?? 35)) - Math.abs(b - (previous ?? 35)) || a - b)[0]
  const changed = state.chord !== null && state.chord !== chord
  if (changed || state.pitch === null) return [root(state.pitch), changed || chord.bass !== chord.root]
  if (stepIndex === state.index) return [state.pitch, state.adapted]
  if (stepIndex === 0 && chord.bass === chord.root) return [root(state.pitch), false]
  if (!state.adapted) {
    const tones = chordTones(chord)
    const offsets = patternId.startsWith('walking_bass')
      ? [0, 2, tones[1], 5, 6, 5, tones[1], 2]
      : [0, tones[1], tones[2], 9, tones[3] ?? 10, 9, tones[2], tones[1]]
    return [root(null) + offsets[stepIndex], false]
  }
  const delta = source[stepIndex] - source[stepIndex - 1 < 0 ? source.length - 1 : stepIndex - 1]
  const direction = Math.sign(delta)
  const tones = chordTones(chord)
  const scale = new Set([0, 2, tones[1], 5, tones[2], chord.quality.startsWith('min') ? 8 : 9,
    chord.quality.startsWith('min') ? 10 : 11].map((interval) => (chord.root + interval) % 12))
  const candidates = Array.from({ length: 23 }, (_, index) => index + 33)
    .filter((pitch) => scale.has(pitch % 12) && (pitch - state.pitch!) * direction > 0)
  candidates.sort((a, b) => Math.abs(a - (state.pitch! + delta)) - Math.abs(b - (state.pitch! + delta)) ||
    Math.abs(a - state.pitch!) - Math.abs(b - state.pitch!))
  return [candidates[0] ?? root(state.pitch), true]
}

/** Schedule a catalog pattern over the full Studio timeline. */
export function generatePianoPattern(timeline: Timeline, pattern: PianoPattern, swing: number): NoteEvent[] {
  const events: NoteEvent[] = []
  const end = timeline.totalBeats
  const walk: WalkState = { pitch: null, chord: null, index: null, adapted: false }
  const memory: PatternMemory = { rootless: null }
  const walkingByBar = new Map<number, number[]>()
  timeline.bars.forEach((bar, barIndex) => {
    if (bar.measure === -1) {
      const active = activeSlot(timeline.slots, bar.start)
      if (active) {
        const chord = active.slot.chord
        if (usesWalkingBass(pattern)) {
          events.push({ tick: toTicks(bar.start), channel: 0, note: midiNote(chord.bass, 35),
            velocity: 86, duration: toTicks(Math.max(0.5, bar.beats - 0.5)) })
        }
        for (const note of [midiNote(chord.bass), ...blockVoicing(chord, 48)]) {
          events.push({ tick: toTicks(bar.start), channel: 1, note, velocity: 72,
            duration: toTicks(Math.max(0.5, bar.beats - 0.5)) })
        }
      }
      return
    }
    const cycleIndex = barIndex % pattern.cycle_bars
    const placedSteps = stepsInBar(pattern, bar, cycleIndex, barIndex)
    // Beats of this bar where the pattern plays sixteenths stay straight in a swung style; a
    // compound bar (6/8) plays straight eighths
    const placed = swingPlacer(placedSteps.map((item) => item.at), swing)
    placedSteps.forEach(({ at, dur, step }) => {
      if (step.role === 'rest') return
      if (step.initial_only && barIndex >= pattern.cycle_bars) return
      const nominal = bar.start + at
      const attack = bar.start + (pattern.fidelity === 'scored example' || bar.compound ? at : placed(at))
      const active = activeSlot(timeline.slots, step.grace ? nominal : attack)
      if (!active) { walk.pitch = null; walk.chord = null; walk.index = null; return }
      const duration = Math.min(dur, end - attack)
      if (duration <= 0) return
      const start = step.grace ? Math.max(0, nominal - duration) : attack
      const walking = usesWalkingBass(pattern) && step.role !== 'upper_shell'
      let pitches: number[]
      if (walking) {
        const stepIndex = Math.floor(step.position * 4 + 1e-8) % 8
        const [pitch, adapted] = walkingPitch(active.slot.chord, pattern.id, stepIndex, walk)
        pitches = [pitch]
        Object.assign(walk, { pitch, chord: active.slot.chord, index: stepIndex, adapted })
      } else pitches = rolePitches(active.slot.chord, step.role, active.next?.chord, memory)
      if (walking && step.role.endsWith('_up')) pitches = pitches.map((pitch) => pitch + 12)
      pitches.forEach((note, noteIndex) => {
        const noteStart = start + (step.role === 'rolled' ? 0.025 * noteIndex : 0)
        if (noteStart < end) {
          if (walking) {
            walkingByBar.set(barIndex, [...(walkingByBar.get(barIndex) ?? []), events.length])
          }
          events.push({ tick: toTicks(noteStart), channel: walking ? 0 : 1, note,
            velocity: 69, duration: toTicks(Math.min(duration, end - noteStart)) })
        }
      })
    })
  })
  for (let barIndex = 0; barIndex < timeline.bars.length - 1; barIndex++) {
    const before = walkingByBar.get(barIndex)
    const after = walkingByBar.get(barIndex + 1)
    if (!before?.length || !after?.length) continue
    const last = events[before.at(-1)!]
    const first = events[after[0]]
    const distance = first.note - last.note
    const gap = first.tick - last.tick
    if (first.tick !== toTicks(timeline.bars[barIndex + 1].start) || Math.abs(distance) !== 2 ||
      gap <= 0 || gap > toTicks(1)) continue
    const passing = last.tick + Math.round(gap * (swing > 0.5 ? 2 / 3 : 0.5))
    last.duration = Math.min(last.duration, passing - last.tick)
    events.push({ tick: passing, channel: 0, note: last.note + Math.sign(distance),
      velocity: Math.max(1, last.velocity - 8), duration: first.tick - passing })
  }
  return events
}
