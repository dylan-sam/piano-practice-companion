export const PPQ = 480

export interface NoteEvent {
  tick: number
  channel: number
  note: number
  velocity: number
  duration: number // tick
}

// Convert beats to MIDI ticks
export const toTicks = (beats: number) => Math.round(beats * PPQ)

// Random number between min and max
export const rand = (min: number, max: number) => min + Math.random() * (max - min)
// True with probability p
export const chance = (p: number) => Math.random() < p
export const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)]

// Keep a velocity inside the MIDI range 1 to 127
export const clampVelocity = (v: number) => Math.max(1, Math.min(127, Math.round(v)))

// Moves x.5 positions (the eighth-note "and") to the style's swing position
export function place(at: number, swing: number): number {
  const beat = Math.floor(at)
  return Math.abs(at - beat - 0.5) < 1e-6 ? beat + swing : at
}

/** Whether a position lies on the second or fourth sixteenth of its beat. */
export const onSixteenth = (at: number): boolean => {
  const fraction = at - Math.floor(at + 1e-6)
  return Math.abs(fraction - 0.25) < 1e-6 || Math.abs(fraction - 0.75) < 1e-6
}

/**
 * place() for a group of positions played together (a groove, a bar of a pattern): a beat where
 * one of them falls on a sixteenth stays straight, so its sixteenths stay even in every style;
 * the "and" of the other beats swings.
 */
export function swingPlacer(positions: number[], swing: number): (at: number) => number {
  const straight = new Set(positions.filter(onSixteenth).map((at) => Math.floor(at + 1e-6)))
  return (at) => (straight.has(Math.floor(at + 1e-6)) ? at : place(at, swing))
}

// Small timing and velocity deviations make the band sound less mechanical
export function humanize(e: NoteEvent, timing: number, velocity: number): NoteEvent {
  return {
    ...e,
    tick: Math.max(0, e.tick + Math.round(rand(-timing, timing))),
    velocity: clampVelocity(e.velocity + rand(-velocity, velocity)),
  }
}
