// Readable drum names used in style files, mapped to General MIDI notes
export const DRUM_NOTES = {
  kick: 36,
  sidestick: 37,
  snare: 38,
  clap: 39,
  snare2: 40,
  tomLow: 45,
  hhClosed: 42,
  hhPedal: 44,
  hhOpen: 46,
  tomMid: 47,
  tomHigh: 50,
  crash: 49,
  ride: 51,
  rideBell: 53,
  tambourine: 54,
  cowbell: 56,
  congaMute: 62,
  congaHigh: 63,
  congaLow: 64,
  cabasa: 69,
  shaker: 70,
  claves: 75,
} as const

export type DrumName = keyof typeof DRUM_NOTES
