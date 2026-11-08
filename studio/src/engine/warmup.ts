// A silent "song" that touches every sound a style can play.
// Loading it makes the synthesizer decode those samples in advance, so pressing play
// doesn't wait for decoding (slow on phones, where it can take a second or more).

import type { StyleDefinition } from '../styles/types'
import { DRUM_NOTES } from '../styles/drums'
import { CHANNELS } from './arrange'
import type { NoteEvent } from './events'
import { writeMidi } from './midiWriter'

// Bass and comp notes stay within these; samples are chosen by key and velocity
const BASS_NOTES: [number, number] = [26, 60]
const COMP_NOTES: [number, number] = [36, 96]
const VELOCITIES = [40, 80, 120]

// Play each note at each velocity on a channel, so the sampler loads those sounds
function sweep(channel: number, notes: number[]): NoteEvent[] {
  const events: NoteEvent[] = []
  let tick = 0
  for (const velocity of VELOCITIES) {
    for (const note of notes) events.push({ tick: (tick += 10), channel, note, velocity, duration: 5 })
  }
  return events
}

// All MIDI notes between two notes
const span = ([lo, hi]: [number, number]) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)

// A short MIDI file playing every sample the style uses, so they load before playback
export function warmUpMidi(style: StyleDefinition): Uint8Array {
  return writeMidi(120, [
    { name: 'Bass', channel: CHANNELS.bass, program: style.bass.program, events: sweep(CHANNELS.bass, span(BASS_NOTES)) },
    { name: 'Comp', channel: CHANNELS.comp, program: style.comp.program, events: sweep(CHANNELS.comp, span(COMP_NOTES)) },
    {
      name: 'Drums',
      channel: CHANNELS.drums,
      program: style.drums.kit,
      events: sweep(CHANNELS.drums, [...new Set(Object.values(DRUM_NOTES))]),
    },
  ])
}
