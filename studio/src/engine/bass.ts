import { chordTones, type Chord } from '../music/chords'
import type { BassNote, BassPart } from '../styles/types'
import { chance, humanize, place, rand, toTicks, type NoteEvent } from './events'
import { patternFor } from './meter'
import type { Slot } from './timeline'

const CHANNEL = 0
const DEFAULT_RANGE: [number, number] = [28, 55] // E1 - G3

// Register limits and nearest-note helpers
class Register {
  readonly low: number
  readonly high: number
  readonly center: number

  constructor([low, high]: [number, number]) {
    this.low = low
    this.high = high
    this.center = low + (high - low) * 0.45
  }

  // The note of the given pitch class closest to the reference, within the register
  nearest(pc: number, ref: number): number {
    let best = -1
    for (let n = this.low; n <= this.high; n++) {
      if (n % 12 === pc && (best < 0 || Math.abs(n - ref) < Math.abs(best - ref))) best = n
    }
    return best
  }

  // Reference for a chord's first note: near the previous note, pulled slightly toward the center
  anchor(prev: number): number {
    return prev * 0.6 + this.center * 0.4
  }

  contains(n: number): boolean {
    return n >= this.low && n <= this.high
  }
}

// Approach note into the next chord: chromatic, diatonic step, or its fifth
function approachNote(reg: Register, target: number, prev: number, nextFifth: number): number {
  const fromBelow = prev < target
  let note: number
  if (chance(0.55)) note = fromBelow ? target - 1 : target + 1
  else if (chance(0.6)) note = fromBelow ? target - 2 : target + 2
  else note = nextFifth
  if (reg.contains(note) && note !== prev) return note
  const other = fromBelow ? target + 1 : target - 1
  return reg.contains(other) ? other : nextFifth
}

// Inner beats of a chord: chord tones moving toward the target
function passingNote(reg: Register, slot: Slot, prev: number, target: number): number {
  const tones = [...chordTones(slot.chord), 2].map((i) => (slot.chord.root + i) % 12)
  let direction = Math.sign(target - prev) || (chance(0.5) ? 1 : -1)
  if (prev > reg.high - 5) direction = -1
  if (prev < reg.low + 5) direction = 1
  const candidates: number[] = []
  for (let n = reg.low; n <= reg.high; n++) {
    if (n !== prev && tones.includes(n % 12) && Math.abs(n - prev) <= 7) candidates.push(n)
  }
  if (candidates.length === 0) return prev
  const ideal = prev + direction * 3
  candidates.sort((a, b) => Math.abs(a - ideal) + rand(0, 2) - (Math.abs(b - ideal) + rand(0, 2)))
  return candidates[0]
}

// The tune's last note: the chord's root, held
function endingNote(reg: Register, slot: Slot): NoteEvent {
  return {
    tick: toTicks(slot.start),
    channel: CHANNEL,
    note: reg.nearest(slot.chord.root, reg.low + 8),
    velocity: 100,
    duration: toTicks(slot.beats - 0.5),
  }
}

// Rule-based walking bass for swing
function walkingBass(slots: Slot[], reg: Register): NoteEvent[] {
  const events: NoteEvent[] = []
  let prev = reg.nearest(slots[0]?.chord.bass ?? 0, reg.center)

  slots.forEach((slot, i) => {
    const next = slots[i + 1]?.chord ?? slot.chord
    if (slot.measure === -1) {
      events.push(endingNote(reg, slot))
      return
    }

    for (let b = 0; b < slot.beats; b++) {
      let note: number
      if (b === 0) {
        note = reg.nearest(slot.chord.bass, reg.anchor(prev))
      } else {
        const target = reg.nearest(next.bass, reg.anchor(prev))
        if (b === slot.beats - 1) {
          note = approachNote(reg, target, prev, reg.nearest((next.root + 7) % 12, prev))
        } else {
          note = passingNote(reg, slot, prev, target)
        }
      }

      const accent = b === 0 ? 8 : b === 2 ? 3 : 0
      events.push(
        humanize(
          { tick: toTicks(slot.start + b), channel: CHANNEL, note, velocity: 86 + accent, duration: toTicks(0.9) },
          8,
          6,
        ),
      )
      prev = note
    }
  })

  return events
}

// Resolves a pattern degree to a real note, relative to the chord's bass note
function resolveTone(reg: Register, note: BassNote, root: number, chord: Chord, next: Chord): number {
  const fifth = chordTones(chord)[2]
  // Move a note by an octave into the bass register when it falls outside
  const fit = (n: number) => (reg.contains(n) ? n : n + 12 <= reg.high ? n + 12 : n - 12)
  switch (note.tone) {
    case 'R':
      return root
    case '8':
      return root + 12 <= reg.high ? root + 12 : root
    case '3':
      return fit(root + chordTones(chord)[1])
    case '5':
      return fit(root + fifth)
    case '6':
      return fit(root + 9)
    case '5-':
      return fit(root + fifth - 12)
    case '7':
      return fit(root + chordTones(chord)[3])
    case 'app': {
      const target = reg.nearest(next.bass, root)
      return fit(target + (target > root ? -1 : 1))
    }
  }
}

// Bass played from style patterns (bossa, ballad, pop...)
function patternBass(slots: Slot[], reg: Register, patterns: Partial<Record<string, BassNote[][]>>, swing: number) {
  const events: NoteEvent[] = []
  let prev = reg.nearest(slots[0]?.chord.bass ?? 0, reg.center)

  slots.forEach((slot, i) => {
    const next = slots[i + 1]?.chord ?? slot.chord
    if (slot.measure === -1) {
      events.push(endingNote(reg, slot))
      return
    }

    // Without an exact match (e.g. 3 beats in a 4/4 style) the longest pattern is rearranged
    const pattern = patternFor(patterns, slot.beats, !!slot.compound, { at: 0, dur: 0.9, tone: 'R' })
    const root = reg.nearest(slot.chord.bass, reg.anchor(prev))
    const feel = slot.compound ? 0.5 : swing

    for (const note of pattern) {
      const n = resolveTone(reg, note, root, slot.chord, next)
      events.push(
        humanize(
          {
            tick: toTicks(slot.start + place(note.at, feel)),
            channel: CHANNEL,
            note: n,
            velocity: note.vel ?? (note.at === 0 ? 96 : 86),
            duration: toTicks(note.dur),
          },
          6,
          5,
        ),
      )
      prev = n
    }
  })

  return events
}

// Render a bass part over the slots
const play = (slots: Slot[], part: BassPart, swing: number, reg: Register) =>
  part.mode === 'walking' ? walkingBass(slots, reg) : patternBass(slots, reg, part.patterns, swing)

// Chords in a compound meter (6/8) are played from `compound`, the style's 6/8 patterns
export function generateBass(slots: Slot[], part: BassPart, swing: number, compound: BassPart = part): NoteEvent[] {
  const reg = new Register(part.range ?? DEFAULT_RANGE)
  if (!slots.some((s) => s.compound)) return play(slots, part, swing, reg)
  return [
    ...play(slots.filter((s) => !s.compound), part, swing, reg),
    ...play(slots.filter((s) => s.compound), compound, swing, reg),
  ]
}

export const BASS_CHANNEL = CHANNEL
