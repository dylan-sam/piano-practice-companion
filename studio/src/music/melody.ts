// A melody line over a chart's chords, as on a lead sheet. Notes are placed by written bar, in
// quarter notes from the start of the bar, so they follow the chart through repeats, loops and
// choruses. Pitches are MIDI note numbers in the written key; transposition happens on playback.

export interface MelodyNote {
  bar: number // written bar index in the chart
  at: number // start, in quarter notes from the start of the bar
  beats: number // length in quarter notes (may run into the next bars: the note is then tied)
  pitch: number // MIDI note number (60 = middle C)
}

export interface Melody {
  notes: MelodyNote[] // in time order
  program?: number // General MIDI instrument of the melody (default: alto sax)
  source?: string // where the melody comes from, e.g. a transcription
}

// The instrument a melody is played with when its chart does not choose one
export const DEFAULT_MELODY_PROGRAM = 65 // alto sax

/** Whether a value is a valid melody (used when charts are imported or shared). */
export function isMelody(value: unknown): value is Melody {
  if (!value || typeof value !== 'object') return false
  const melody = value as Record<string, unknown>
  return Array.isArray(melody.notes) && melody.notes.every((item: unknown) => {
    if (!item || typeof item !== 'object') return false
    const note = item as Record<string, unknown>
    return Number.isInteger(note.bar) && Number(note.bar) >= 0 &&
      typeof note.at === 'number' && Number.isFinite(note.at) && note.at >= 0 &&
      typeof note.beats === 'number' && Number.isFinite(note.beats) && note.beats > 0 &&
      Number.isInteger(note.pitch) && Number(note.pitch) >= 0 && Number(note.pitch) <= 127
  }) && (melody.program === undefined || (Number.isInteger(melody.program) && Number(melody.program) >= 0 && Number(melody.program) <= 127)) &&
    (melody.source === undefined || typeof melody.source === 'string')
}

/** The program a melody plays with: its own, else the default. */
export const melodyProgram = (melody: Melody): number => melody.program ?? DEFAULT_MELODY_PROGRAM

/** A melody's notes grouped by written bar, in time order. */
export function notesByBar(melody: Melody | undefined): Map<number, MelodyNote[]> {
  const out = new Map<number, MelodyNote[]>()
  for (const note of melody?.notes ?? []) {
    const list = out.get(note.bar) ?? []
    list.push(note)
    out.set(note.bar, list)
  }
  return out
}
