export interface MidiNoteChange {
  note: number
  pressed: boolean
  velocity: number
}

/** Decode MIDI note messages, including note-on with zero velocity as note-off. */
export function midiNoteChange(data: Uint8Array | readonly number[]): MidiNoteChange | null {
  const [status = 0, note = 0, velocity = 0] = data
  const type = status & 0xf0
  if ((type !== 0x90 && type !== 0x80) || note < 0 || note > 127) return null
  return { note, pressed: type === 0x90 && velocity > 0, velocity }
}
