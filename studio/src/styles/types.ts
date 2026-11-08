// The OpenStand style format.
//
// A style is plain data: new styles can be added without touching the engine.
// Positions are in beats (0 = start of the bar or chord). x.5 positions are
// off-beat eighths and are moved to the swing position automatically.

import type { DrumName } from './drums'

export type Position = number

export type StyleFamily = 'jazz' | 'latin' | 'pop' | 'funk' | 'world'

// Degrees used in bass patterns, relative to the chord's bass note
// R: root, 8: root an octave up, 3/5/7: chord tones above, 6: major sixth above,
// 5-: fifth below, app: half-step approach to the next chord's root
export type BassTone = 'R' | '8' | '3' | '5' | '6' | '5-' | '7' | 'app'

export interface BassNote {
  at: Position
  dur: number
  tone: BassTone
  vel?: number
}

// Alternative patterns by chord length in beats; the engine picks one each time.
// Other lengths are made from the longest pattern (see engine/meter.ts); 1.5 is half a 6/8 bar.
export type ByChordLength<T> = Partial<Record<'1' | '1.5' | '2' | '3' | '4', T[]>>

export type BassPart =
  | { mode: 'walking'; program: number; range?: [number, number] }
  | { mode: 'pattern'; program: number; range?: [number, number]; patterns: ByChordLength<BassNote[]> }

// [position, duration] or [position, duration, velocity]
export type CompHit = [at: Position, dur: number, vel?: number]

export interface CompPart {
  program: number
  voicing: 'rootless' | 'close'
  velocity: [min: number, max: number]
  rhythms: ByChordLength<CompHit[]>
  anticipation?: number // probability of hitting the chord an eighth early
  pedal?: boolean // sustain pedal held through each chord (legato piano)
}

// [position, drum, velocity, probability?, duration?]
export type DrumHit = [at: Position, drum: DrumName, vel: number, chance?: number, dur?: number]

export interface Groove {
  bars: 1 | 2
  beats?: number // length of one groove bar in beats (default 4; 3 for a waltz)
  hits: DrumHit[]
}

export interface DrumPart {
  kit: number // GS drum kit program (0 standard, 32 jazz, 40 brush)
  countIn: DrumHit[]
  grooves: {
    middle: Groove[] // middle of the form; two-bar grooves span a pair of bars
    first?: Groove[] // first bar of the form
    last?: Groove[] // last bar of the form (fill)
  }
  ending: DrumHit[]
}

export interface StyleDefinition {
  id: string
  name: string
  family: StyleFamily
  swing: number // position of the off-beat eighth: 0.5 straight, ~0.66 swing
  tempo: { default: number; min: number; max: number }
  bass: BassPart
  comp: CompPart
  drums: DrumPart
}
