// The exercise builder of Exercises Sightreading: an exercise is a few settings (an
// ExerciseSpec), and the chart (chords, melody) is written from them on the spot. Six families:
//
//   arpeggio   a chord's notes one at a time (triads or seventh chords, which notes, the note it
//              starts on, the direction, the rhythm), through keys that move (in fourths...)
//   scale      a chord scale, straight or in a pattern (thirds, 1-2-3-5, groups of four, triads)
//   line       a line through a progression: guide tones, chord tones or the scale in eighth
//              notes, or every 3rd enclosed
//   approach   approach notes and enclosures into each note of a chord
//   interval   an interval moved through the keys
//   rhythm     a rhythm figure on a vamp
//
// Every family can start in any key and repeat in other keys, the key moving by a step chosen.
// A spec is written as text for links and saved presets ("arpeggio;chord=dom7;notes=3-5-7-9"):
// only what differs from the family's defaults. Six example presets ship (EXAMPLES); the
// person's own are saved by exercisePresets.ts.

import type { Chart } from '../../music/chart'
import type { LickInfo } from '../../music/licks'
import { prettyChordText } from '../../music/chordText'
import {
  capital, closestInRange, eighthLine, guideToneLine, NINTH, readChanges, rootPitches, SCALES, SEVENTHS,
  stepOf, tonesOf, TRIADS, nearest, type ChordType,
} from './exerciseMusic'
import { line, makeLickChart, nameInC, parseChords, transposeSymbol, type ChordSpan, type TimedNote } from './lickCharts'

export type Family = 'arpeggio' | 'scale' | 'line' | 'approach' | 'interval' | 'rhythm'
export type Move = 'none' | 'halfUp' | 'halfDown' | 'wholeUp' | 'minorThirdUp' | 'fourthUp' | 'fifthUp' | 'diatonic'
export type Rhythm = 'quarter' | 'eighth' | 'triplet'
export type Direction = 'up' | 'down' | 'updown' | 'alternate'

/** The settings of an exercise (each family reads the ones it needs). */
export interface ExerciseSpec {
  family: Family
  key: number // the first key, a pitch class (0: C)
  move: Move // how the key moves from one time to the next
  keys: number // how many keys (1: one key)
  rhythm: Rhythm // arpeggio, scale, interval
  direction: Direction // arpeggio, scale
  chord: string // arpeggio: a triad or seventh chord (TRIADS, SEVENTHS); approach: maj7, min7 or dom7
  notes: string // arpeggio: which notes (NOTE_SETS)
  start: number // arpeggio: the chord note it starts on (0 the first of `notes`, 1 the next...)
  scale: string // scale: a name of SCALES
  pattern: string // scale: SCALE_PATTERNS
  octaves: number // scale: 1 or 2
  progression: string // line: PROGRESSIONS
  line: string // line: LINES
  approach: string // approach: APPROACHES
  interval: number // interval: half steps
  order: string // interval: ORDERS
  figure: string // rhythm: FIGURES
}

// ---------- The choices of each setting, with their words ----------

export const FAMILIES: Record<Family, string> = {
  arpeggio: 'Arpeggios', scale: 'Scales', line: 'Lines through a progression', approach: 'Approach notes', interval: 'Intervals', rhythm: 'Rhythm',
}

/** Each move: its half steps, and how a title says it. */
export const MOVES: Record<Move, { label: string; step: number; words: string }> = {
  none: { label: 'Stay in the key', step: 0, words: '' },
  fourthUp: { label: 'Up a fourth (the cycle of fourths)', step: 5, words: 'in fourths' },
  fifthUp: { label: 'Up a fifth (down a fourth)', step: 7, words: 'in fifths' },
  halfUp: { label: 'Up a half step', step: 1, words: 'in half steps' },
  halfDown: { label: 'Down a half step', step: 11, words: 'down in half steps' },
  wholeUp: { label: 'Up a whole step', step: 2, words: 'in whole steps' },
  minorThirdUp: { label: 'Up a minor 3rd', step: 3, words: 'in minor 3rds' },
  diatonic: { label: 'Up the scale of the key (diatonic chords)', step: 0, words: '' },
}

export const RHYTHMS: Record<Rhythm, { label: string; length: number; words: string }> = {
  eighth: { label: 'Eighth notes', length: 0.5, words: '' },
  triplet: { label: 'Eighth-note triplets', length: 1 / 3, words: ' in triplets' },
  quarter: { label: 'Quarter notes', length: 1, words: ' in quarter notes' },
}

export const DIRECTIONS: Record<Direction, string> = {
  up: 'Up', down: 'Down', updown: 'Up and down', alternate: 'Up one, down the next',
}

/** Which notes of a chord an arpeggio plays: from the chord's tones, and the steps through them. */
export const NOTE_SETS: Record<string, { kind: 'triad' | 'seventh'; tones: (t: number[]) => number[]; degrees: number[]; steps: number[] }> = {
  '1-3-5': { kind: 'triad', tones: (t) => t, degrees: [1, 3, 5], steps: [0, 1, 2] },
  '1-3-5-8': { kind: 'triad', tones: (t) => t, degrees: [1, 3, 5], steps: [0, 1, 2, 3] },
  '1-3-5-7': { kind: 'seventh', tones: (t) => t, degrees: [1, 3, 5, 7], steps: [0, 1, 2, 3] },
  '1-3-5-7-8': { kind: 'seventh', tones: (t) => t, degrees: [1, 3, 5, 7], steps: [0, 1, 2, 3, 4] },
  '1-3-7-8': { kind: 'seventh', tones: (t) => [t[0], t[1], t[3]], degrees: [1, 3, 7], steps: [0, 1, 2, 3] },
  '3-5-7-9': { kind: 'seventh', tones: (t) => [t[1], t[2], t[3], NINTH], degrees: [3, 5, 7, 9], steps: [0, 1, 2, 3] },
  '1-3-5-7-9': { kind: 'seventh', tones: (t) => [...t, NINTH], degrees: [1, 3, 5, 7, 9], steps: [0, 1, 2, 3, 4] },
}

/** The chords an arpeggio can play: triads, then seventh chords. */
export const CHORDS: Record<string, ChordType & { kind: 'triad' | 'seventh' }> = {
  ...Object.fromEntries(Object.entries(TRIADS).map(([id, type]) => [id, { ...type, kind: 'triad' as const }])),
  ...Object.fromEntries(Object.entries(SEVENTHS).map(([id, type]) => [id, { ...type, kind: 'seventh' as const }])),
}

/** Scale patterns: the steps of each group from step i, going up (down mirrors them). */
// A pattern repeats its group from every note of the scale; `hint` shows it in scale degrees.
export const SCALE_PATTERNS: Record<string, { label: string; group: number[]; hint: string }> = {
  straight: { label: 'Straight', group: [0], hint: '1 2 3 4 5...' },
  thirds: { label: 'In thirds', group: [0, 2], hint: '1 3, 2 4, 3 5...' },
  '1-2-3-5': { label: '1-2-3-5', group: [0, 1, 2, 4], hint: '1 2 3 5, 2 3 4 6, 3 4 5 7...' },
  fours: { label: 'Groups of four', group: [0, 1, 2, 3], hint: '1 2 3 4, 2 3 4 5...' },
  triads: { label: 'Triads on every step', group: [0, 2, 4], hint: '1 3 5, 2 4 6, 3 5 7...' },
}

/** A progression's chords in C, and its name. */
export const PROGRESSIONS: Record<string, { name: string; chords: string; level: number }> = {
  'ii-V-I': { name: 'ii-V-I', chords: 'D-7:2 G7:2 C^7:4', level: 1 },
  'minor ii-V-i': { name: 'minor ii-V-i', chords: 'Dh7:2 G7b9:2 C-6:4', level: 1 },
  'ii-V7b9-I': { name: 'ii-V7b9-I', chords: 'D-7:2 G7b9:2 C^7:4', level: 2 },
  'minor ii-V7b9b13-i': { name: 'minor ii-V7b9b13-i', chords: 'Dh7:2 G7b9b13:2 C-6:4', level: 2 },
  'I-vi-ii-V': { name: 'I-vi-ii-V turnaround', chords: 'C^7:2 A-7:2 D-7:2 G7:2 C^7:2 A-7:2 D-7:2 G7:2 C^7:4', level: 1 },
  'I-VI7-ii-V': { name: 'I-VI7-ii-V turnaround', chords: 'C^7:2 A7:2 D-7:2 G7:2 C^7:2 A7:2 D-7:2 G7:2 C^7:4', level: 1 }, // the vi made a dominant
  'iii-VI-ii-V': { name: 'iii-VI-ii-V turnaround', chords: 'E-7:2 A7:2 D-7:2 G7:2 E-7:2 A7:2 D-7:2 G7:2 C^7:4', level: 1 },
  'jazz blues': { name: 'jazz blues', chords: 'C7:4 F7:4 C7:4 G-7:2 C7:2 F7:4 F#o7:4 C7:4 A7:4 D-7:4 G7:4 C7:2 A7:2 D-7:2 G7:2 C7:4', level: 2 },
  'minor blues': { name: 'minor blues', chords: 'C-7:4 F-7:4 C-7:4 C-7:4 F-7:4 F-7:4 C-7:4 C-7:4 Ab7:4 G7b9b13:4 C-7:4 Dh7:2 G7b9b13:2 C-7:4', level: 2 },
  'rhythm changes': { name: 'rhythm changes A section', chords: 'C^7:2 A7:2 D-7:2 G7:2 E-7:2 A7:2 D-7:2 G7:2 C^7:2 C7:2 F^7:2 F#o7:2 C^7/G:2 A7:2 D-7:2 G7:2 C^7:4', level: 2 },
  'add ii': { name: 'V7 with its ii added', chords: 'C^7:4 D-7:2 G7:2 C^7:4 C^7:4', level: 1 },
  secondary: { name: 'I-VI-II-V turnaround with secondary dominants', chords: 'C^7:2 A7:2 D7:2 G7:2 C^7:2 A7:2 D7:2 G7:2 C^7:4', level: 1 },
  tritone: { name: 'ii-bII7-I with the tritone substitution', chords: 'D-7:2 Db7:2 C^7:4', level: 1 },
  'passing dim': { name: 'I-#Io7-ii-V with a passing diminished chord', chords: 'C^7:2 C#o7:2 D-7:2 G7:2 C^7:2 C#o7:2 D-7:2 G7:2 C^7:4', level: 1 },
  'diatonic cycle': { name: 'diatonic cycle (ii-V-I-IV-vii-III-vi)', chords: 'D-7:4 G7:4 C^7:4 F^7:4 Bh7:4 E7b9:4 A-6:8', level: 1 },
  'cycle of dominants': { name: 'cycle of dominants', chords: 'E7:2 A7:2 D7:2 G7:2 C7:2 F7:2 Bb7:2 Eb7:2 Ab7:2 Db7:2 F#7:2 B7:2 E7:4', level: 2 },
  coltrane: { name: 'Coltrane cycle', chords: 'C^7:2 Eb7:2 Ab^7:2 B7:2 E^7:2 G7:2 C^7:4', level: 3 },
}

/** The lines through a progression. */
export const LINES: Record<string, { label: string; category: string }> = {
  guide3: { label: 'guide tones, one per chord, from the 3rd', category: 'Guide tones' },
  guide7: { label: 'guide tones, one per chord, from the 7th', category: 'Guide tones' },
  guide2: { label: 'guide tones, two per chord', category: 'Guide tones' },
  chordTones: { label: 'chord tones in eighth notes', category: 'Chord-tone and scale lines' },
  chordScales: { label: 'chord scales in eighth notes', category: 'Chord-tone and scale lines' },
  enclose3: { label: 'enclosing every 3rd', category: 'Approach notes and enclosures' },
}

/** The chords approach notes lead into: their tones and scale. */
const APPROACH_CHORDS: Record<string, { symbol: string; tones: number[]; scale: string }> = {
  maj7: { symbol: '^7', tones: [0, 4, 7, 11], scale: 'Ionian (major)' },
  min7: { symbol: '-7', tones: [0, 3, 7, 10], scale: 'Dorian' },
  dom7: { symbol: '7', tones: [0, 4, 7, 10], scale: 'Mixolydian' },
}
export const APPROACH_CHORD_NAMES: Record<string, string> = { maj7: 'Major 7th', min7: 'Minor 7th', dom7: 'Dominant 7th' }

/** The step above a target in a scale (pitches). */
const above = (scale: number[], target: number) => target + Math.min(...scale.map((s) => ((s - target) % 12 + 12) % 12).filter((d) => d > 0))

/** Approach notes and enclosures: the cell before each target, its lengths, and where the first cell starts. */
export const APPROACHES: Record<string, { label: string; cell: (scale: number[], t: number) => number[]; lengths: number[]; offset: number }> = {
  chromaticBelow: { label: 'chromatic approach from below', cell: (_, t) => [t - 1, t], lengths: [0.5, 1.5], offset: 1.5 },
  scaleAbove: { label: 'scale approach from above', cell: (s, t) => [above(s, t), t], lengths: [0.5, 1.5], offset: 1.5 },
  doubleChromatic: { label: 'double chromatic approach from below', cell: (_, t) => [t - 2, t - 1, t], lengths: [0.5, 0.5, 1], offset: 0 },
  enclosureAboveBelow: { label: 'enclosure: scale step above, half step below', cell: (s, t) => [above(s, t), t - 1, t], lengths: [0.5, 0.5, 1], offset: 0 },
  enclosureBelowAbove: { label: 'enclosure: half step below, scale step above', cell: (s, t) => [t - 1, above(s, t), t], lengths: [0.5, 0.5, 1], offset: 0 },
  enclosureChromatic: { label: 'enclosure: half steps above and below', cell: (_, t) => [t + 1, t - 1, t], lengths: [0.5, 0.5, 1], offset: 0 },
}

export const INTERVALS: Record<number, string> = {
  1: 'minor 2nds', 2: 'major 2nds', 3: 'minor 3rds', 4: 'major 3rds', 5: 'perfect 4ths', 6: 'tritones', 7: 'perfect 5ths',
  8: 'minor 6ths', 9: 'major 6ths', 10: 'minor 7ths', 11: 'major 7ths', 12: 'octaves',
}
export const ORDERS: Record<string, string> = { lower: 'lower note first', upper: 'upper note first', alternate: 'up one, down the next' }

/** Rhythm figures on a vamp, walking the Mixolydian scale: where each note starts in 16 beats, and how long it lasts. */
export const FIGURES: Record<string, { label: string; notes: () => [start: number, beats: number][]; level: number }> = {
  offbeat: { label: 'eighth notes on every off-beat', notes: () => Array.from({ length: 16 }, (_, i) => [i + 0.5, 0.5]), level: 1 },
  anticipations: { label: 'anticipations: the off-beats before 1 and 3', notes: () => Array.from({ length: 8 }, (_, i) => [i * 2 + 1.5, 1]), level: 1 },
  onOff: { label: 'on the beat, then off the beat', notes: () => Array.from({ length: 16 }, (_, i) => [i + (Math.floor(i / 4) % 2 ? 0.5 : 0), 0.5]), level: 1 },
  charleston: { label: 'Charleston rhythm', notes: () => Array.from({ length: 8 }, (_, i) => [Math.floor(i / 2) * 4 + (i % 2 ? 1.5 : 0), i % 2 ? 0.5 : 1.5]), level: 1 },
  groups3: { label: 'groups of 3 eighth notes and an eighth rest', notes: () => groups(3), level: 2 },
  groups4: { label: 'groups of 4 eighth notes and an eighth rest', notes: () => groups(4), level: 2 },
  groups5: { label: 'groups of 5 eighth notes and an eighth rest', notes: () => groups(5), level: 2 },
  quarterTriplets: { label: 'quarter-note triplets', notes: () => Array.from({ length: 12 }, (_, i) => [(i * 2) / 3, 2 / 3]), level: 2 },
}

/** Groups of `size` eighth notes and an eighth rest over 16 beats: the groups shift across the beat. */
function groups(size: number): [number, number][] {
  return Array.from({ length: 32 }, (_, slot) => slot).filter((slot) => slot % (size + 1) !== size).map((slot) => [slot * 0.5, 0.5])
}

// ---------- Defaults, and the spec as text ----------

const BASE: ExerciseSpec = {
  family: 'arpeggio', key: 0, move: 'none', keys: 1, rhythm: 'eighth', direction: 'up', chord: 'major', notes: '1-3-5-8', start: 0,
  scale: 'Mixolydian', pattern: 'straight', octaves: 1, progression: 'ii-V-I', line: 'guide3', approach: 'chromaticBelow',
  interval: 4, order: 'lower', figure: 'offbeat',
}

/** Each family's starting settings. */
export const FAMILY_DEFAULTS: Record<Family, ExerciseSpec> = {
  arpeggio: { ...BASE, family: 'arpeggio', move: 'fourthUp', keys: 12 },
  scale: { ...BASE, family: 'scale', direction: 'updown' },
  line: { ...BASE, family: 'line' },
  approach: { ...BASE, family: 'approach', chord: 'maj7' },
  interval: { ...BASE, family: 'interval', move: 'halfUp', keys: 12 },
  rhythm: { ...BASE, family: 'rhythm' },
}

const FIELDS = Object.keys(BASE).filter((field) => field !== 'family') as (keyof Omit<ExerciseSpec, 'family'>)[]
const NUMERIC = new Set<string>(['key', 'keys', 'start', 'octaves', 'interval'])

/** A spec as text: its family, then the settings that differ from the family's defaults ("arpeggio;chord=dom7"). */
export function specText(spec: ExerciseSpec): string {
  const defaults = FAMILY_DEFAULTS[spec.family]
  return [spec.family, ...FIELDS.filter((field) => spec[field] !== defaults[field]).map((field) => `${field}=${spec[field]}`)].join(';')
}

/** Whether a setting's value is one the builder knows. */
function known(field: string, value: string | number): boolean {
  switch (field) {
    case 'key': return Number.isInteger(value) && Number(value) >= 0 && Number(value) < 12
    case 'keys': return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 12
    case 'start': return Number.isInteger(value) && Number(value) >= 0 && Number(value) < 5
    case 'octaves': return value === 1 || value === 2
    case 'interval': return String(value) in INTERVALS
    case 'move': return String(value) in MOVES
    case 'rhythm': return String(value) in RHYTHMS
    case 'direction': return String(value) in DIRECTIONS
    case 'chord': return String(value) in CHORDS || String(value) in APPROACH_CHORDS
    case 'notes': return String(value) in NOTE_SETS
    case 'scale': return SCALES.some((scale) => scale.name === value)
    case 'pattern': return String(value) in SCALE_PATTERNS
    case 'progression': return String(value) in PROGRESSIONS
    case 'line': return String(value) in LINES
    case 'approach': return String(value) in APPROACHES
    case 'order': return String(value) in ORDERS
    case 'figure': return String(value) in FIGURES
    default: return false
  }
}

/** A spec read from text; null when it cannot be read (an unknown family or setting). */
export function readSpec(text: string): ExerciseSpec | null {
  const [family, ...pairs] = text.split(';')
  if (!(family in FAMILY_DEFAULTS)) return null
  const spec: ExerciseSpec = { ...FAMILY_DEFAULTS[family as Family] }
  for (const pair of pairs) {
    const at = pair.indexOf('=')
    const field = pair.slice(0, at)
    const raw = pair.slice(at + 1)
    const value = NUMERIC.has(field) ? Number(raw) : raw
    if (at < 1 || !known(field, value)) return null
    ;(spec as unknown as Record<string, string | number>)[field] = value
  }
  return fit(spec)
}

/**
 * A spec whose settings fit together: an arpeggio's notes fit its chord (a triad cannot play its
 * 7th), its start note is one of its notes, an approach chord is one approach notes lead into.
 */
export function fit(spec: ExerciseSpec): ExerciseSpec {
  const next = { ...spec }
  if (next.family === 'arpeggio') {
    if (!(next.chord in CHORDS)) next.chord = 'major'
    const kind = CHORDS[next.chord].kind
    if (NOTE_SETS[next.notes].kind !== kind) next.notes = kind === 'triad' ? '1-3-5-8' : '1-3-5-7'
    next.start = Math.min(next.start, NOTE_SETS[next.notes].steps.length - 1)
  }
  if (next.family === 'approach' && !(next.chord in APPROACH_CHORDS)) next.chord = 'maj7'
  if (next.move !== 'none' && next.keys < 2 && next.move !== 'diatonic') next.keys = 2
  if (next.move === 'none' && next.keys > 1) next.keys = 1
  return next
}

// ---------- Titles and categories ----------

/** A key's name as a chart writes it in C (flats, except F#). */
const keyName = (pc: number) => prettyChordText(nameInC(pc))

/** The keys the exercise goes through, said for a title (" in all keys", " in F and C", ", 4 keys up a fourth"). */
function keysWords(spec: ExerciseSpec, all: string): string {
  const move = MOVES[spec.move]
  if (spec.move === 'none' || spec.move === 'diatonic' || spec.keys < 2) return ''
  if (spec.keys === 12) return all
  if (spec.keys === 2) return ` in ${keyName(spec.key)} and ${keyName(spec.key + move.step)}`
  return ` in ${spec.keys} keys ${move.words}`
}

/** The order of an arpeggio's notes, said for a title ("1-3-5-8 up", "8-5-3-1 down", "1-3-5-8-5-3"). */
function arpeggioWords(spec: ExerciseSpec): string {
  const set = NOTE_SETS[spec.notes]
  // Each step's degree: the set's degrees, an octave (7 degrees) higher each time round
  const degree = (step: number) => set.degrees[step % set.degrees.length] + 7 * Math.floor(step / set.degrees.length)
  const shown = set.steps.map((step) => degree(step + spec.start)).join('-')
  switch (spec.direction) {
    case 'up': return `${shown} up`
    case 'down': return `${shown.split('-').reverse().join('-')} down`
    case 'updown': {
      const list = shown.split('-')
      return [...list, ...list.slice(1, -1).reverse()].join('-')
    }
    case 'alternate': return spec.notes === '1-3-5-8' && !spec.start ? 'up one, down the next' : `${shown}, up one, down the next`
  }
}

/** The order of a scale's notes, said for a title ("up and down", "in thirds, up"). */
function scaleWords(spec: ExerciseSpec): string {
  const direction = { up: 'up', down: 'down', updown: 'up and down', alternate: 'up and down' }[spec.direction]
  const pattern = spec.pattern === 'straight' ? direction : `${SCALE_PATTERNS[spec.pattern].label.toLowerCase()}${spec.direction === 'up' ? '' : `, ${direction}`}`
  return pattern + (spec.octaves === 2 ? ', two octaves' : '')
}

/** The name of an exercise, from its settings, with its chord symbols written for reading. */
export function exerciseTitle(spec: ExerciseSpec): string {
  const rhythm = RHYTHMS[spec.rhythm].words
  const inKey = spec.key ? ` from ${keyName(spec.key)}` : ''
  const title = (() => {
    switch (spec.family) {
      case 'arpeggio': {
        const chord = CHORDS[spec.chord]
        const plural = chord.kind === 'triad' ? 'triads' : 'chords'
        if (spec.move === 'diatonic') return `Diatonic ${chord.kind === 'triad' ? 'triads' : 'seventh chords'} in ${keyName(spec.key)}: ${arpeggioWords(spec)}${rhythm}`
        const moving = spec.move === 'none' ? '' : ` ${MOVES[spec.move].words}${spec.keys === 12 ? '' : ` (${spec.keys} keys)`}`
        return `${capital(chord.label)} ${plural}${moving}${inKey}: ${arpeggioWords(spec)}${rhythm}`
      }
      case 'scale': {
        const scale = SCALES.find((item) => item.name === spec.scale)!
        const moving = spec.move === 'none' ? '' : ` ${MOVES[spec.move].words}${spec.keys === 12 ? '' : ` (${spec.keys} keys)`}`
        const over = transposeSymbol(scale.chord, spec.key)
        return `${scale.name}${spec.pattern === 'straight' ? ' scale' : ''}${moving} over ${over}: ${scaleWords(spec)}${rhythm}`
      }
      case 'line': {
        const progression = PROGRESSIONS[spec.progression]
        const start = spec.key && spec.keys < 2 ? ` in ${keyName(spec.key)}` : ''
        return `${capital(progression.name)}${keysWords(spec, ' in all keys')}${start}: ${LINES[spec.line].label}`
      }
      case 'approach': {
        const moving = keysWords(spec, ` ${MOVES[spec.move].words}`)
        return `${nameInC(spec.key)}${APPROACH_CHORDS[spec.chord].symbol}${moving}: ${APPROACHES[spec.approach].label}`
      }
      case 'interval': {
        const moving = spec.move === 'none' ? '' : ` ${MOVES[spec.move].words}`
        return `${capital(INTERVALS[spec.interval])}${moving}${spec.keys !== 12 && spec.move !== 'none' ? ` (${spec.keys} pairs)` : ''}${inKey}: ${ORDERS[spec.order]}${rhythm}`
      }
      case 'rhythm':
        return `Rhythm on ${nameInC(spec.key)}7${keysWords(spec, ` ${MOVES[spec.move].words}`)}: ${FIGURES[spec.figure].label}`
    }
  })()
  return prettyChordText(title)
}

/** The category an exercise is listed under in Exercises Sightreading. */
export function exerciseCategory(spec: ExerciseSpec): string {
  switch (spec.family) {
    case 'arpeggio': return CHORDS[spec.chord].kind === 'triad' ? 'Triads' : 'Seventh chords'
    case 'scale': return 'Scales and scale patterns'
    case 'line': return LINES[spec.line].category
    case 'approach': return 'Approach notes and enclosures'
    case 'interval': return 'Intervals'
    case 'rhythm': return 'Rhythm'
  }
}

/** The playlist name a category is listed under (the licks' lists are "Licks: ..."). */
export const categoryList = (category: string) => `Exercises: ${category.toLowerCase()}`

// ---------- Writing the chart ----------

/** What one key of an exercise is made of: its chords, its notes, and its length in beats. */
interface Unit { chords: ChordSpan[]; notes: TimedNote[]; beats: number }

/** The roots an exercise goes through: from its key, moving as asked (the diatonic move: C D E F G A B). */
export function rootsOf(spec: ExerciseSpec): number[] {
  if (spec.move === 'diatonic') return [0, 2, 4, 5, 7, 9, 11].map((step) => (spec.key + step) % 12)
  const keys = spec.move === 'none' ? 1 : spec.keys
  return Array.from({ length: keys }, (_, k) => (spec.key + k * MOVES[spec.move].step) % 12)
}

/** The steps of a pattern through a set of notes, in the direction asked (`odd`: the second, fourth... time). */
function directed(steps: number[], direction: Direction, odd: boolean): number[] {
  switch (direction) {
    case 'up': return steps
    case 'down': return [...steps].reverse()
    case 'updown': return [...steps, ...steps.slice(1, -1).reverse()]
    case 'alternate': return odd ? [...steps].reverse() : steps
  }
}

/** Beats rounded up to the next whole beat (a unit of triplets ends on a beat). */
const wholeBeats = (beats: number) => Math.ceil(beats - 1e-9)
/** Beats rounded up to the end of the bar. */
const toBar = (beats: number) => Math.ceil(beats / 4 - 1e-9) * 4

/** The quality of each diatonic chord of a major key, as triads and as seventh chords. */
const DIATONIC_TRIADS = ['major', 'minor', 'minor', 'major', 'major', 'minor', 'diminished']
const DIATONIC_SEVENTHS = ['maj7', 'min7', 'min7', 'maj7', 'dom7', 'min7', 'half']

/** An arpeggio through the roots, each chord its notes in the direction and rhythm asked, closing on the next root. */
function arpeggio(spec: ExerciseSpec): { chords: ChordSpan[]; notes: TimedNote[] } {
  const set = NOTE_SETS[spec.notes]
  const length = RHYTHMS[spec.rhythm].length
  const roots = rootsOf(spec)
  // Diatonic chords climb the scale from the key's root; other roots stay near middle C
  const base = 60 + (spec.key > 6 ? spec.key - 12 : spec.key)
  const pitches = spec.move === 'diatonic' ? [0, 2, 4, 5, 7, 9, 11].map((step) => base + step) : rootPitches(roots)
  const chords: ChordSpan[] = []
  const notes: TimedNote[] = []
  let time = 0
  roots.forEach((pc, i) => {
    const typeId = spec.move === 'diatonic' ? (set.kind === 'triad' ? DIATONIC_TRIADS : DIATONIC_SEVENTHS)[i] : spec.chord
    const type = CHORDS[typeId]
    const tones = set.tones(type.tones)
    const steps = directed(set.steps.map((step) => step + spec.start), spec.direction, i % 2 === 1)
    const beats = wholeBeats(steps.length * length)
    notes.push(...line(time, steps.map((step) => pitches[i] + stepOf(tones, step)), length))
    chords.push([nameInC(pc) + type.suffix, beats])
    time += beats
  })
  // Close on the next root (the first again after twelve keys, the octave after the diatonic chords)
  const nextPc = spec.move === 'diatonic' ? spec.key : (spec.key + roots.length * MOVES[spec.move].step) % 12
  const close = nearest(nextPc, notes[notes.length - 1].pitch)
  const end = toBar(time + 2)
  notes.push({ start: time, beats: end - time, pitch: close })
  const firstType = spec.move === 'diatonic' ? (set.kind === 'triad' ? '' : '^7') : CHORDS[spec.chord].suffix
  chords.push([nameInC(nextPc) + firstType, end - time])
  return { chords, notes }
}

/** The steps of a scale exercise, from step 0, in its pattern and direction, over one or two octaves. */
function scaleSteps(size: number, spec: ExerciseSpec): number[] {
  const top = size * spec.octaves
  const group = SCALE_PATTERNS[spec.pattern].group
  const up = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
  const reach = Math.max(...group)
  const upGroups = (last: number) => up(0, last).flatMap((i) => group.map((g) => i + g))
  const downGroups = (first: number) => up(reach, first).reverse().flatMap((i) => group.map((g) => i - g))
  if (spec.pattern === 'straight') {
    if (spec.direction === 'up') return up(0, top)
    if (spec.direction === 'down') return up(0, top).reverse()
    return [...up(0, top), ...up(1, top - 1).reverse()]
  }
  const last = top - reach
  if (spec.direction === 'up') return upGroups(last)
  if (spec.direction === 'down') return downGroups(top)
  return [...upGroups(last), ...downGroups(top)]
}

/** A scale over its chord in one key, closing on the root, to the end of its bar. */
function scaleUnit(spec: ExerciseSpec, root: number, rootPitch: number): Unit {
  const scale = SCALES.find((item) => item.name === spec.scale)!
  const length = RHYTHMS[spec.rhythm].length
  const steps = scaleSteps(scale.steps.length, spec)
  const notes = line(0, steps.map((step) => rootPitch + stepOf(scale.steps, step)), length)
  const end = Math.round(steps.length * length * 1e6) / 1e6
  const close = toBar(end + 1)
  notes.push({ start: end, beats: close - end, pitch: nearest(root, notes[notes.length - 1].pitch) })
  return { chords: [[transposeSymbol(scale.chord, root), close]], notes, beats: close }
}

/** Approach notes or enclosures into each note of a chord (and its octave), in one key. */
function approachUnit(spec: ExerciseSpec, root: number, rootPitch: number): Unit {
  const chord = APPROACH_CHORDS[spec.chord]
  const scale = SCALES.find((item) => item.name === chord.scale)!.steps.map((s) => rootPitch + s)
  const kind = APPROACHES[spec.approach]
  const pitches = [...chord.tones, 12].map((t) => rootPitch + t).flatMap((t) => kind.cell(scale, t))
  const notes = line(kind.offset, pitches, kind.lengths)
  const end = toBar(Math.max(...notes.map((n) => n.start + n.beats)))
  return { chords: [[nameInC(root) + chord.symbol, end]], notes, beats: end }
}

/** A rhythm figure on the root's dominant 7th vamp, walking its Mixolydian scale, in one key. */
function rhythmUnit(spec: ExerciseSpec, root: number, rootPitch: number): Unit {
  const scale = SCALES.find((item) => item.name === 'Mixolydian')!.steps
  const figure = FIGURES[spec.figure].notes()
  const notes = figure.map(([start, beats], i) => {
    const cycle = i % 14
    return { start, beats, pitch: rootPitch + stepOf(scale, cycle < 8 ? cycle : 14 - cycle) }
  })
  const end = toBar(Math.max(...notes.map((n) => n.start + n.beats)))
  return { chords: [[`${nameInC(root)}7`, end]], notes, beats: end }
}

/** One key of a family that repeats a unit in each key. */
type UnitMaker = (spec: ExerciseSpec, root: number, rootPitch: number) => Unit

/** Units in each key of the exercise, one after the other. */
function chain(spec: ExerciseSpec, make: UnitMaker): { chords: ChordSpan[]; notes: TimedNote[] } {
  const roots = rootsOf(spec)
  const pitches = rootPitches(roots)
  const chords: ChordSpan[] = []
  const notes: TimedNote[] = []
  let time = 0
  roots.forEach((root, i) => {
    const unit = make(spec, root, pitches[i])
    chords.push(...unit.chords)
    notes.push(...unit.notes.map((note) => ({ ...note, start: note.start + time })))
    time += unit.beats
  })
  return { chords, notes }
}

/** An interval moved through the keys (no chords), closing on the next root. */
function intervals(spec: ExerciseSpec): { chords: ChordSpan[]; notes: TimedNote[] } {
  const roots = rootsOf(spec)
  const pitches = spec.move === 'halfUp' || spec.move === 'halfDown' ? roots.map((_, i) => 60 + spec.key + (spec.move === 'halfUp' ? i : -i)) : rootPitches(roots)
  const length = RHYTHMS[spec.rhythm].length
  const pairs = pitches.flatMap((low, i) => {
    const upperFirst = spec.order === 'upper' || (spec.order === 'alternate' && i % 2 === 1)
    return upperFirst ? [low + spec.interval, low] : [low, low + spec.interval]
  })
  const notes = line(0, pairs, length)
  const time = wholeBeats(pairs.length * length)
  const next = nearest((spec.key + roots.length * MOVES[spec.move].step) % 12, pitches[pitches.length - 1] + (spec.move === 'halfUp' ? 1 : 0))
  const end = toBar(time + 2)
  notes.push({ start: time, beats: end - time, pitch: next })
  return { chords: [[null, end]], notes }
}

/** A progression's chords in each key of the exercise, one after the other. */
function progressionChords(spec: ExerciseSpec): ChordSpan[] {
  const unit = parseChords(PROGRESSIONS[spec.progression].chords)
  return rootsOf(spec).flatMap((root) => unit.map(([symbol, beats]): ChordSpan => [symbol ? transposeSymbol(symbol, root) : null, beats]))
}

/** Every 3rd of a progression enclosed: the note above, the note below, then the 3rd of the next chord. */
function enclosedThirds(spans: ChordSpan[]): TimedNote[] {
  const changes = readChanges(spans)
  const notes: TimedNote[] = []
  let time = 0
  let last = 64
  changes.forEach(({ beats, chord }, i) => {
    const third = closestInRange([tonesOf(chord)[1]], last, 57, 77)
    notes.push({ start: time, beats: i === changes.length - 1 ? beats : beats - 1, pitch: third })
    const next = changes[i + 1]
    if (next) {
      const target = closestInRange([tonesOf(next.chord)[1]], third, 57, 77)
      notes.push({ start: time + beats - 1, beats: 0.5, pitch: target + 1 }, { start: time + beats - 0.5, beats: 0.5, pitch: target - 1 })
    }
    last = third
    time += beats
  })
  return notes
}

/** A line through the progression, in each key asked. */
function progressionLine(spec: ExerciseSpec): { chords: ChordSpan[]; notes: TimedNote[] } {
  const chords = progressionChords(spec)
  const notes = (() => {
    switch (spec.line) {
      case 'guide7': return guideToneLine(chords, 1, 'seventh')
      case 'guide2': return guideToneLine(chords, 2, 'third')
      case 'chordTones': return eighthLine(chords, false)
      case 'chordScales': return eighthLine(chords, true)
      case 'enclose3': return enclosedThirds(chords)
      default: return guideToneLine(chords, 1, 'third')
    }
  })()
  return { chords, notes }
}

/** How hard an exercise is: 1 (first steps) to 3 (busiest). */
function levelOf(spec: ExerciseSpec): number {
  const triplets = spec.rhythm === 'triplet' && ['arpeggio', 'scale', 'interval'].includes(spec.family)
  switch (spec.family) {
    case 'line': return Math.max(PROGRESSIONS[spec.progression].level, spec.line === 'chordTones' || spec.line === 'chordScales' || spec.line === 'enclose3' ? 2 : 1)
    case 'approach': return 2
    case 'rhythm': return FIGURES[spec.figure].level
    case 'scale': return spec.pattern === 'straight' && !triplets ? 1 : 2
    case 'interval': return spec.interval > 7 || triplets ? 2 : 1
    default: return triplets || spec.notes.length > 8 ? 2 : 1
  }
}

/** The exercise's chart, written from its settings (in the key asked; the players can move it on). */
export function buildExercise(spec: ExerciseSpec): Chart {
  const fitted = fit(spec)
  const { chords, notes } = (() => {
    switch (fitted.family) {
      case 'arpeggio': return arpeggio(fitted)
      case 'scale': return chain(fitted, scaleUnit)
      case 'approach': return chain(fitted, approachUnit)
      case 'rhythm': return chain(fitted, rhythmUnit)
      case 'interval': return intervals(fitted)
      case 'line': return progressionLine(fitted)
    }
  })()
  const category = exerciseCategory(fitted)
  const info: LickInfo = {
    kind: 'exercise', category, context: FAMILIES[fitted.family], source: 'Piano Practice Companion', license: 'CC BY 4.0',
    tags: [fitted.family], level: levelOf(fitted), spec: specText(fitted),
  }
  return makeLickChart({ title: exerciseTitle(fitted), chords, notes, info })
}

// ---------- The example presets ----------

/** A saved exercise: a name and its settings. */
export interface ExercisePreset { id: string; name: string; spec: string }

/** One example per category, shipped with the app (deleted, they are only hidden: Restore all default songs). */
export const EXAMPLES: ExercisePreset[] = [
  { id: 'example-triads', name: 'Major triads in fourths: up one, down the next', spec: 'arpeggio;direction=alternate' },
  { id: 'example-sevenths', name: 'Dominant 7th chords in fourths: 3-5-7-9 up', spec: 'arpeggio;chord=dom7;notes=3-5-7-9' },
  { id: 'example-guide-tones', name: 'ii-V-I in all keys: guide tones, two per chord', spec: 'line;move=fourthUp;keys=12;line=guide2' },
  { id: 'example-scale', name: 'Mixolydian scale over C7: up and down', spec: 'scale' },
  { id: 'example-enclosures', name: 'ii-V-I in all keys: enclosing every 3rd', spec: 'line;move=fourthUp;keys=12;line=enclose3' },
  { id: 'example-intervals', name: 'Major 6ths in half steps: lower note first', spec: 'interval;interval=9' },
]
