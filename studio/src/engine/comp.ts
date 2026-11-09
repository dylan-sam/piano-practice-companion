import { closeVoicingTones, rootlessVoicings, type Chord } from '../music/chords'
import type { CompHit, CompPart } from '../styles/types'
import { chance, humanize, rand, swingPlacer, toTicks, type NoteEvent } from './events'
import { patternFor } from './meter'
import type { Slot } from './timeline'

const CHANNEL = 1
const LOWEST = 48 // lowest allowed bottom note of a voicing
const HIGHEST_BOTTOM = 62 // highest allowed bottom note of a voicing

// Voicing candidates as intervals above the root (A/B forms or inversions)
function voicingForms(chord: Chord, kind: CompPart['voicing']): number[][] {
  if (kind === 'rootless') return rootlessVoicings(chord)
  const tones = closeVoicingTones(chord)
  return tones.map((_, r) => [...tones.slice(r), ...tones.slice(0, r).map((t) => t + 12)])
}

const HOME = 62 // the middle of the comping range
// Average pitch of a voicing
const average = (notes: number[]) => notes.reduce((a, b) => a + b, 0) / notes.length

// How far the notes of one voicing are from the nearest notes of another, on average
const leap = (from: number[], to: number[]) => from.reduce((sum, p) => sum + Math.min(...to.map((q) => Math.abs(p - q))), 0) / from.length

// Voice leading: each note moves as little as possible from the previous voicing, so common
// tones stay where they are and the top voice moves by step (the measure Impro-Visor and MMA
// use). A gentle pull keeps the voicings from drifting out of the middle of the keyboard.
function chooseVoicing(chord: Chord, kind: CompPart['voicing'], prev: number[]): number[] {
  let best: number[] = []
  let bestScore = Infinity
  for (const form of voicingForms(chord, kind)) {
    for (let octave = 2; octave <= 6; octave++) {
      const notes = form.map((i) => chord.root + i + octave * 12)
      if (notes[0] < LOWEST || notes[0] > HIGHEST_BOTTOM) continue
      const drift = Math.abs(average(notes) - HOME)
      const score = prev.length
        ? leap(prev, notes) +
          leap(notes, prev) +
          0.5 * Math.abs(notes[notes.length - 1] - prev[prev.length - 1]) +
          0.1 * drift +
          rand(0, 0.6)
        : drift + rand(0, 1.5)
      if (score < bestScore) {
        bestScore = score
        best = notes
      }
    }
  }
  return best
}

// Chords lasting 3 beats in a style written for 4 play beats 1, 2 and 4 of a 4-beat rhythm;
// chords in a compound meter (6/8) play `compound`, the style's 6/8 rhythms, with straight eighths.
export function generateComp(slots: Slot[], part: CompPart, swing: number, countIn: number, compound: CompPart = part): NoteEvent[] {
  const events: NoteEvent[] = []
  let prev: number[] = []

  slots.forEach((slot) => {
    const { rhythms, anticipation = 0 } = slot.compound ? compound : part
    const feel = slot.compound ? 0.5 : swing
    const voicing = chooseVoicing(slot.chord, part.voicing, prev)
    prev = voicing

    if (slot.measure === -1) {
      // Final chord: one long hit with the root in the left hand
      const notes = [slot.chord.root + 36, ...voicing]
      for (const note of notes) {
        events.push({ tick: toTicks(slot.start), channel: CHANNEL, note, velocity: part.velocity[1], duration: toTicks(slot.beats - 0.5) })
      }
      return
    }

    // Turn [at, duration, velocity] comp hits into objects
    const timed = (rhythm: CompHit[][] | undefined) => rhythm?.map((hits) => hits.map(([at, dur, vel]) => ({ at, dur, vel })))
    const byLength = Object.fromEntries(Object.entries(rhythms).map(([length, options]) => [length, timed(options)]))
    const hits: CompHit[] = patternFor(byLength, slot.beats, !!slot.compound, { at: 0, dur: 0.6, vel: undefined }).map(
      ({ at, dur, vel }): CompHit => [at, dur, vel],
    )
    if (!hits.length) return

    // Sometimes anticipate the chord by an eighth
    if (hits[0][0] === 0 && slot.start > countIn && chance(anticipation)) {
      hits[0] = [-0.5, hits[0][1] + (1 - feel), hits[0][2]]
    }

    const placed = swingPlacer(hits.map(([at]) => at), feel)
    for (const [at, duration, vel] of hits) {
      const velocity = vel ?? rand(part.velocity[0], part.velocity[1])
      for (const note of voicing) {
        events.push(
          humanize(
            {
              tick: toTicks(slot.start + placed(at)),
              channel: CHANNEL,
              note,
              velocity,
              duration: toTicks(duration),
            },
            6,
            4,
          ),
        )
      }
    }
  })

  return events
}

// Piano pedal for legato styles: lifted as each new chord sounds and pressed again just after,
// so every chord rings into the next instead of stopping short (syncopated pedalling)
export function pedalChanges(events: NoteEvent[], slots: Slot[]): { tick: number; value: number }[] {
  const onsets = events.map((e) => e.tick).sort((a, b) => a - b)
  const out: { tick: number; value: number }[] = []
  for (const slot of slots) {
    // The chord's first sound, which may be an anticipation an eighth early
    const from = toTicks(slot.start - 0.6)
    const first = onsets.find((t) => t >= from && t < toTicks(slot.start + slot.beats))
    if (first === undefined) continue
    out.push({ tick: Math.max(0, first - 1), value: 0 }, { tick: first + toTicks(0.12), value: 127 })
  }
  // Let go at the very end
  const last = Math.max(0, ...events.map((e) => e.tick + e.duration))
  out.push({ tick: last, value: 0 })
  return out
}
