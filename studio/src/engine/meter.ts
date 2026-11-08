import { pick } from './events'

export { isCompound } from '../music/chart'

// Fitting a style to the meter of each bar.
//
// Styles are written for 4/4 (the jazz waltz for 3/4). In another simple meter the beats of a
// style's bar are rearranged so the accents stay where they belong: a 3/4 bar plays beats 1, 2
// and 4 of a 4/4 bar, so a rock beat becomes boom-chick-chick and a swing ride keeps its hi-hat
// on the weak beats. Compound meters (6/8, 9/8, 12/8) move in dotted quarters with straight
// eighths, so they get their own patterns (see styles/compound.ts) instead.

// A compound meter's pulse: a dotted quarter, in quarter-note beats
export const PULSE = 1.5

// For each beat of the target bar, the beat of the source bar it plays
export function beatMap(source: number, target: number): number[] {
  const n = Math.ceil(target - 1e-9)
  if (n === source) return Array.from({ length: n }, (_, i) => i)
  const known: Record<number, Record<number, number[]>> = {
    4: { 1: [0], 2: [0, 1], 3: [0, 1, 3], 5: [0, 1, 3, 2, 3], 6: [0, 1, 3, 2, 1, 3] },
    3: { 1: [0], 2: [0, 1], 4: [0, 1, 2, 1], 6: [0, 1, 2, 0, 1, 2] },
  }
  return known[source]?.[n] ?? Array.from({ length: n }, (_, i) => i % source)
}

export interface Timed {
  at: number
  dur: number
}

// A pattern written for `source` beats, played over `target` beats
export function remap<T extends Timed>(pattern: T[], source: number, target: number): T[] {
  if (Math.abs(source - target) < 1e-9) return pattern
  const out: T[] = []
  beatMap(source, target).forEach((from, beat) => {
    for (const item of pattern) {
      if (item.at < from || item.at >= from + 1) continue
      const at = beat + (item.at - from)
      if (at < target - 1e-9) out.push({ ...item, at, dur: Math.min(item.dur, target - at) })
    }
  })
  return out
}

// The pattern for a chord lasting `length` beats, from patterns listed by chord length
export function patternFor<T extends Timed>(patterns: Partial<Record<string, T[][]>>, length: number, compound: boolean, fallback: T): T[] {
  const exact = patterns[String(length)]
  if (exact?.length) return pick(exact)

  if (compound) {
    // Whole 6/8 bars, then single pulses
    const out: T[] = []
    for (let offset = 0; offset < length - 1e-9;) {
      const room = length - offset
      const unit = room >= 2 * PULSE - 1e-9 && patterns['3']?.length ? 2 * PULSE : PULSE
      const pattern = patterns[String(unit)]?.length ? pick(patterns[String(unit)]!) : [fallback]
      for (const item of pattern) {
        if (item.at < Math.min(unit, room) - 1e-9) out.push({ ...item, at: offset + item.at, dur: Math.min(item.dur, room - item.at) })
      }
      offset += unit
    }
    return out
  }

  // The longest pattern available, rearranged to the chord's length
  const source = [4, 3, 2, 1].find((l) => patterns[String(l)]?.length)
  if (!source) return [{ ...fallback, dur: Math.min(fallback.dur, length) }]
  return remap(pick(patterns[String(source)]!), source, length)
}
