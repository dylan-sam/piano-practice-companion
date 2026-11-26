// The exercise builder: titles, specs as text, and every combination of settings written as a
// chart that keeps to the lick grid and the range.
import { describe, expect, it } from 'vitest'
import { isChart } from '../src/music/chart'
import { onLickGrid } from '../src/music/licks'
import {
  APPROACHES, buildExercise, CHORDS, DIRECTIONS, EXAMPLES, exerciseCategory, exerciseTitle, FAMILY_DEFAULTS, FIGURES, fit, INTERVALS,
  LINES, MOVES, NOTE_SETS, ORDERS, PROGRESSIONS, readSpec, RHYTHMS, SCALE_PATTERNS, specText, type ExerciseSpec,
} from '../src/exercises/builder/exerciseBuilder'
import { SCALES } from '../src/exercises/builder/exerciseMusic'

const spec = (text: string) => readSpec(text)!

/** Whether a chart can be read and played: valid, on the grid, in range, inside its bars. */
function playable(spec: ExerciseSpec): string | null {
  const chart = buildExercise(spec)
  const notes = chart.melody?.notes ?? []
  if (!isChart(chart)) return 'not a chart'
  if (!notes.length) return 'no notes'
  if (!onLickGrid(notes)) return 'off the grid'
  if (notes.some((n) => n.pitch < 36 || n.pitch > 96)) return 'out of range'
  if (notes.some((n) => n.bar * 4 + n.at + n.beats > chart.bars.length * 4 + 1e-6)) return 'past the last bar'
  return null
}

describe('exercise builder', () => {
  it('names exercises as the old lists did', () => {
    expect(exerciseTitle(spec('arpeggio'))).toBe('Major triads in fourths: 1-3-5-8 up')
    expect(exerciseTitle(spec('arpeggio;direction=alternate'))).toBe('Major triads in fourths: up one, down the next')
    expect(exerciseTitle(spec('arpeggio;chord=dom7;notes=3-5-7-9'))).toBe('Dominant 7th chords in fourths: 3-5-7-9 up')
    expect(exerciseTitle(spec('arpeggio;chord=half;notes=1-3-5-7'))).toBe('Half-diminished chords in fourths: 1-3-5-7 up')
    expect(exerciseTitle(spec('arpeggio;move=halfUp'))).toBe('Major triads in half steps: 1-3-5-8 up')
    expect(exerciseTitle(spec('scale;scale=Ionian (major)'))).toBe('Ionian (major) scale over Cmaj7: up and down')
    expect(exerciseTitle(spec('scale;scale=Dorian;pattern=thirds;direction=up'))).toBe('Dorian over C−7: in thirds')
    expect(exerciseTitle(spec('line;move=fourthUp;keys=12'))).toBe('ii-V-I in all keys: guide tones, one per chord, from the 3rd')
    expect(exerciseTitle(spec('line;progression=jazz blues;line=chordScales'))).toBe('Jazz blues: chord scales in eighth notes')
    expect(exerciseTitle(spec('line;progression=add ii;key=5;move=fifthUp;keys=2'))).toBe('V7 with its ii added in F and C: guide tones, one per chord, from the 3rd')
    expect(exerciseTitle(spec('interval;interval=9'))).toBe('Major 6ths in half steps: lower note first')
    expect(exerciseTitle(spec('rhythm;figure=groups3'))).toBe('Rhythm on C7: groups of 3 eighth notes and an eighth rest')
    expect(exerciseTitle(spec('approach'))).toBe('Cmaj7: chromatic approach from below')
    expect(exerciseTitle(spec('arpeggio;notes=1-3-5-8;start=1;direction=updown;rhythm=triplet;move=none;keys=1'))).toBe('Major triads: 3-5-8-10-8-5 in triplets')
  })

  it('writes a spec as text and reads it back, only what differs from the defaults', () => {
    expect(specText(FAMILY_DEFAULTS.arpeggio)).toBe('arpeggio')
    const custom = fit({ ...FAMILY_DEFAULTS.scale, scale: 'Dorian', pattern: '1-2-3-5', octaves: 2, key: 3, move: 'wholeUp', keys: 4 })
    expect(readSpec(specText(custom))).toEqual(custom)
    expect(readSpec('nonsense')).toBeNull()
    expect(readSpec('arpeggio;chord=nothing')).toBeNull()
    expect(readSpec('arpeggio;keys=99')).toBeNull()
  })

  it('makes settings fit: a triad plays no 7th, a start note is one of the notes', () => {
    expect(fit({ ...FAMILY_DEFAULTS.arpeggio, chord: 'major', notes: '3-5-7-9' }).notes).toBe('1-3-5-8')
    expect(fit({ ...FAMILY_DEFAULTS.arpeggio, chord: 'dom7', notes: '1-3-5' }).notes).toBe('1-3-5-7')
    expect(fit({ ...FAMILY_DEFAULTS.arpeggio, notes: '1-3-5', start: 4 }).start).toBe(2)
  })

  it('lists exercises under the old categories', () => {
    expect(EXAMPLES.map((example) => exerciseCategory(spec(example.spec)))).toEqual([
      'Triads', 'Seventh chords', 'Guide tones', 'Scales and scale patterns', 'Approach notes and enclosures', 'Intervals'])
  })

  it('writes every example, and each family through its settings, as a playable chart', () => {
    for (const example of EXAMPLES) expect(playable(spec(example.spec)), example.name).toBeNull()
    const moves = Object.keys(MOVES) as ExerciseSpec['move'][]
    const rhythms = Object.keys(RHYTHMS) as ExerciseSpec['rhythm'][]
    const directions = Object.keys(DIRECTIONS) as ExerciseSpec['direction'][]
    const checked: ExerciseSpec[] = []
    for (const chord of Object.keys(CHORDS)) for (const notes of Object.keys(NOTE_SETS)) for (const direction of directions) {
      for (const rhythm of rhythms) for (const start of [0, 1, 2]) checked.push(fit({ ...FAMILY_DEFAULTS.arpeggio, chord, notes, direction, rhythm, start }))
    }
    for (const move of moves) for (const key of [0, 7, 11]) checked.push(fit({ ...FAMILY_DEFAULTS.arpeggio, move, key, keys: move === 'none' ? 1 : 4 }))
    for (const scale of SCALES) for (const pattern of Object.keys(SCALE_PATTERNS)) for (const direction of directions) {
      for (const octaves of [1, 2]) checked.push(fit({ ...FAMILY_DEFAULTS.scale, scale: scale.name, pattern, direction, octaves }))
    }
    checked.push(fit({ ...FAMILY_DEFAULTS.scale, rhythm: 'triplet', move: 'fourthUp', keys: 12, key: 6 }))
    for (const progression of Object.keys(PROGRESSIONS)) for (const line of Object.keys(LINES)) {
      checked.push(fit({ ...FAMILY_DEFAULTS.line, progression, line }))
      checked.push(fit({ ...FAMILY_DEFAULTS.line, progression, line, move: 'fourthUp', keys: 4 }))
    }
    for (const chord of ['maj7', 'min7', 'dom7']) for (const approach of Object.keys(APPROACHES)) checked.push(fit({ ...FAMILY_DEFAULTS.approach, chord, approach, move: 'halfUp', keys: 3 }))
    for (const interval of Object.keys(INTERVALS).map(Number)) for (const order of Object.keys(ORDERS)) for (const move of moves) {
      checked.push(fit({ ...FAMILY_DEFAULTS.interval, interval, order, move, keys: move === 'none' ? 1 : 12 }))
    }
    for (const figure of Object.keys(FIGURES)) checked.push(fit({ ...FAMILY_DEFAULTS.rhythm, figure, move: 'fifthUp', keys: 2 }))
    for (const item of checked) expect(playable(item), specText(item)).toBeNull()
  })
})
