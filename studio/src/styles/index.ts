import type { BassPart, CompHit, DrumHit, StyleDefinition } from './types'
import type { DrumName } from './drums'

// These six presets correspond to the project's existing accompaniment styles.
const hit = (at: number, drum: DrumName, velocity: number): DrumHit => [at, drum, velocity]
const countIn: DrumHit[] = [0, 1, 2, 3].map((at) => hit(at, 'sidestick', 70))

const walking: BassPart = { mode: 'walking', program: 32, range: [28, 55] }
const rootFifth: BassPart = {
  mode: 'pattern', program: 33, range: [28, 52], patterns: {
    '4': [[{ at: 0, dur: 0.9, tone: 'R' }, { at: 1, dur: 0.9, tone: '5' },
      { at: 2, dur: 0.9, tone: 'R' }, { at: 3, dur: 0.9, tone: '5' }]],
    '2': [[{ at: 0, dur: 0.9, tone: 'R' }, { at: 1, dur: 0.9, tone: '5' }]],
    '1': [[{ at: 0, dur: 0.9, tone: 'R' }]],
  },
}
const bossaBass: BassPart = {
  mode: 'pattern', program: 32, range: [28, 52], patterns: {
    '4': [[{ at: 0, dur: 1.4, tone: 'R' }, { at: 1.5, dur: 0.4, tone: '5-' },
      { at: 2, dur: 1.4, tone: '5-' }, { at: 3.5, dur: 0.4, tone: 'R' }]],
    '2': [[{ at: 0, dur: 1.4, tone: 'R' }, { at: 1.5, dur: 0.4, tone: '5-' }]],
    '1': [[{ at: 0, dur: 0.9, tone: 'R' }]],
  },
}
const balladBass: BassPart = {
  mode: 'pattern', program: 32, range: [28, 52], patterns: {
    '4': [[{ at: 0, dur: 2.8, tone: 'R' }, { at: 3, dur: 0.9, tone: '5' }]],
    '2': [[{ at: 0, dur: 1.8, tone: 'R' }]],
    '1': [[{ at: 0, dur: 0.9, tone: 'R' }]],
  },
}

// Build a style definition from its parts
function makeStyle(
  id: string, name: string, family: StyleDefinition['family'], swing: number,
  tempo: number, bass: BassPart, chords: CompHit[][], drums: DrumHit[],
): StyleDefinition {
  // Compose bass, chord and percussion parts into a selectable style.
  return {
    id, name, family, swing, tempo: { default: tempo, min: 40, max: 300 }, bass,
    comp: { program: 0, voicing: 'rootless', velocity: [56, 75], pedal: id === 'ballad',
      rhythms: { '4': chords, '3': chords, '2': [[[0, 0.8]]], '1': [[[0, 0.7]]] } },
    drums: { kit: family === 'jazz' ? 32 : 0, countIn,
      grooves: { middle: [{ bars: 1, hits: drums }] },
      ending: [hit(0, 'kick', 85), hit(0, 'crash', 90)] },
  }
}

export const STYLES: StyleDefinition[] = [
  makeStyle('swing', 'Swing', 'jazz', 0.66, 140, walking,
    [[[0, 1.4], [1.5, 0.5]], [[1.5, 0.5], [3, 0.8]], [[0, 0.7], [2.5, 0.9]]],
    [hit(0, 'kick', 35), hit(0, 'ride', 64), hit(1, 'ride', 70), hit(1.5, 'ride', 50),
      hit(1, 'hhPedal', 65), hit(2, 'kick', 35), hit(2, 'ride', 64),
      hit(3, 'ride', 70), hit(3.5, 'ride', 50), hit(3, 'hhPedal', 65),
      [1.5, 'snare', 45, 0.15]]),
  makeStyle('blues', 'Blues', 'pop', 0.66, 120, rootFifth,
    [[[0, 0.8], [2, 0.8]], [[1, 0.8], [3, 0.8]]],
    [hit(0, 'kick', 68), hit(0, 'hhClosed', 42), hit(1, 'snare', 60),
      hit(1.5, 'hhClosed', 38), hit(2, 'kick', 62), hit(2, 'hhClosed', 41),
      hit(3, 'snare', 64), hit(3.5, 'hhClosed', 38)]),
  makeStyle('bossa-nova', 'Bossa Nova', 'latin', 0.5, 130, bossaBass,
    [[[0, 0.8], [1.5, 0.4], [3, 0.8]], [[0.5, 0.5], [2, 0.8], [3.5, 0.4]]],
    [hit(0, 'kick', 59), hit(0, 'hhClosed', 37), hit(1, 'hhClosed', 30),
      hit(1.5, 'sidestick', 41), hit(2, 'kick', 53), hit(2, 'hhClosed', 38),
      hit(3, 'hhClosed', 30), hit(3.5, 'sidestick', 43)]),
  makeStyle('latin', 'Latin', 'latin', 0.5, 120, bossaBass,
    [[[0, 0.65], [1.5, 0.45], [2.5, 0.45]], [[0.5, 0.5], [2, 0.6], [3.5, 0.4]]],
    [hit(0, 'kick', 60), hit(0, 'hhClosed', 36), hit(1, 'sidestick', 44),
      hit(1.5, 'hhClosed', 34), hit(2, 'kick', 52), hit(2, 'hhClosed', 36),
      hit(2.5, 'sidestick', 42), hit(3, 'hhClosed', 37), hit(3.5, 'sidestick', 45)]),
  makeStyle('straight pop/rock', 'Straight Pop/Rock', 'pop', 0.5, 110, rootFifth,
    [[[0, 0.9], [2, 0.9]], [[0, 0.8], [2.5, 0.8]]],
    [hit(0, 'kick', 84), hit(0, 'hhClosed', 43), hit(0.5, 'hhClosed', 36),
      hit(1, 'snare', 78), hit(1, 'hhClosed', 44), hit(1.5, 'hhClosed', 35),
      hit(2, 'kick', 76), hit(2, 'hhClosed', 44), hit(2.5, 'hhClosed', 35),
      hit(3, 'snare', 81), hit(3, 'hhClosed', 46), hit(3.5, 'hhClosed', 35)]),
  makeStyle('ballad', 'Ballad', 'pop', 0.5, 75, balladBass,
    [[[0, 2.8], [3, 0.9]], [[0, 3.8]]],
    [hit(0, 'kick', 55), hit(0, 'hhClosed', 31), hit(1, 'hhClosed', 27),
      hit(2, 'snare', 48), hit(2, 'hhClosed', 32), hit(3, 'hhClosed', 28)]),
]

// A built-in style by id (swing when unknown)
export function getStyle(id: string): StyleDefinition {
  // Fall back to swing for charts referring to a removed preset.
  return STYLES.find((style) => style.id === id) ?? STYLES[0]
}

export type { StyleDefinition } from './types'
