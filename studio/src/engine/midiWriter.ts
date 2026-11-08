import { PPQ, type NoteEvent } from './events'

// Standard MIDI File (format 1) writer

export interface TrackSpec {
  name: string
  channel: number
  program: number
  pan?: number
  reverb?: number
  events: NoteEvent[]
  pedal?: { tick: number; value: number }[] // sustain pedal (CC 64)
}

interface RawEvent {
  tick: number
  order: number // at the same tick: note-offs first, then everything else
  bytes: number[]
}

// Encode a number as a MIDI variable-length quantity
function varLen(value: number): number[] {
  const bytes = [value & 0x7f]
  let v = value >> 7
  while (v > 0) {
    bytes.unshift((v & 0x7f) | 0x80)
    v >>= 7
  }
  return bytes
}

// Encode a string as UTF-8 bytes
function text(s: string): number[] {
  return Array.from(new TextEncoder().encode(s))
}

// Build a MIDI chunk: its type, its length, then its data
function chunk(type: string, data: number[]): number[] {
  const len = data.length
  return [...text(type), (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff, ...data]
}

// Encode a track's events as delta-timed MIDI bytes, ending with end-of-track
function encodeTrack(events: RawEvent[]): number[] {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order)
  const data: number[] = []
  let last = 0
  for (const e of events) {
    data.push(...varLen(e.tick - last), ...e.bytes)
    last = e.tick
  }
  data.push(0, 0xff, 0x2f, 0) // end of track
  return chunk('MTrk', data)
}

// Truncates overlapping notes of the same pitch: a new hit ends the previous one
function noteEvents(spec: TrackSpec): RawEvent[] {
  const ch = spec.channel
  const sorted = [...spec.events].sort((a, b) => a.tick - b.tick)
  const lastOff = new Map<number, RawEvent>()
  const out: RawEvent[] = []
  for (const e of sorted) {
    const prev = lastOff.get(e.note)
    if (prev && prev.tick > e.tick) prev.tick = e.tick
    const off: RawEvent = { tick: e.tick + Math.max(1, e.duration), order: 0, bytes: [0x80 | ch, e.note, 0] }
    out.push({ tick: e.tick, order: 1, bytes: [0x90 | ch, e.note, e.velocity] })
    out.push(off)
    lastOff.set(e.note, off)
  }
  return out
}

// Write a standard MIDI file (format 1) with a tempo and the tracks
export function writeMidi(bpm: number, tracks: TrackSpec[]): Uint8Array {
  const mpqn = Math.round(60_000_000 / bpm)
  const tempoTrack = encodeTrack([
    { tick: 0, order: 0, bytes: [0xff, 0x51, 3, (mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff] },
    { tick: 0, order: 0, bytes: [0xff, 0x58, 4, 4, 2, 24, 8] }, // 4/4
  ])

  const noteTracks = tracks.map((t) => {
    const name = text(t.name)
    const setup: RawEvent[] = [
      { tick: 0, order: 0, bytes: [0xff, 0x03, name.length, ...name] },
      { tick: 0, order: 0, bytes: [0xc0 | t.channel, t.program] },
      { tick: 0, order: 0, bytes: [0xb0 | t.channel, 10, t.pan ?? 64] },
      { tick: 0, order: 0, bytes: [0xb0 | t.channel, 91, t.reverb ?? 30] },
      // Pedal up, in case a previous song stopped with it down
      { tick: 0, order: 0, bytes: [0xb0 | t.channel, 64, 0] },
    ]
    // A pedal change at the same tick as a note-on comes first, so the new note isn't caught by the old pedal
    const pedal = (t.pedal ?? []).map((p): RawEvent => ({ tick: p.tick, order: 0, bytes: [0xb0 | t.channel, 64, p.value] }))
    return encodeTrack([...setup, ...pedal, ...noteEvents(t)])
  })

  const header = chunk('MThd', [0, 1, 0, tracks.length + 1, (PPQ >> 8) & 0xff, PPQ & 0xff])
  return new Uint8Array([...header, ...tempoTrack, ...noteTracks.flat()])
}
