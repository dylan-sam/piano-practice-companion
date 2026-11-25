import { PPQ, type NoteEvent } from './events'

// Standard MIDI File (format 1) writer

export interface TrackSpec {
  name: string
  channel: number
  program: number
  pan?: number
  reverb?: number
  drums?: boolean // a percussion part on a channel other than 10 (the metronome)
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

/**
 * The Roland GS message that makes a channel other than 10 a percussion part ("use for rhythm
 * part", drum map 1). GS numbers its parts from channel 10: channel 10 is part 0, channels 1 to 9
 * are parts 1 to 9, channels 11 to 16 keep their number.
 */
export function gsRhythmPart(channel: number): number[] {
  const part = channel === 9 ? 0 : channel < 9 ? channel + 1 : channel
  const body = [0x40, 0x10 + part, 0x15, 0x01]
  const checksum = (128 - (body.reduce((sum, byte) => sum + byte, 0) & 0x7f)) & 0x7f
  const data = [0x41, 0x10, 0x42, 0x12, ...body, checksum, 0xf7]
  return [0xf0, ...varLen(data.length), ...data]
}

/**
 * The tempo and meter changes of a MIDI file (its first track). The app plays its files at one
 * tempo and sets the speed itself; a downloaded file carries the real tempo, its speed-ups and
 * its time signatures, for other programs.
 */
export interface Conductor {
  tempos: { tick: number; bpm: number }[]
  meters: { tick: number; numerator: number; denominator: 4 | 8 }[]
}

/** The tempo meta event (microseconds per quarter note). */
function tempoEvent(tick: number, bpm: number): RawEvent {
  const mpqn = Math.round(60_000_000 / bpm)
  return { tick, order: 0, bytes: [0xff, 0x51, 3, (mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff] }
}

/** The time signature meta event (24 MIDI clocks a click, 8 thirty-seconds a quarter). */
function meterEvent(tick: number, numerator: number, denominator: 4 | 8): RawEvent {
  return { tick, order: 0, bytes: [0xff, 0x58, 4, numerator, denominator === 8 ? 3 : 2, 24, 8] }
}

// Write a standard MIDI file (format 1) with a tempo (or a conductor's tempo and meter changes) and the tracks
export function writeMidi(bpm: number, tracks: TrackSpec[], conductor?: Conductor): Uint8Array {
  const tempoTrack = encodeTrack(conductor
    ? [...conductor.tempos.map((t) => tempoEvent(t.tick, t.bpm)), ...conductor.meters.map((m) => meterEvent(m.tick, m.numerator, m.denominator))]
    : [tempoEvent(0, bpm), meterEvent(0, 4, 4)])

  const noteTracks = tracks.map((t) => {
    const name = text(t.name)
    const setup: RawEvent[] = [
      { tick: 0, order: 0, bytes: [0xff, 0x03, name.length, ...name] },
      ...(t.drums && t.channel !== 9 ? [{ tick: 0, order: 0, bytes: gsRhythmPart(t.channel) }] : []),
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
