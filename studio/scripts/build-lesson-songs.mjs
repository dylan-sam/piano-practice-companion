// The tunes of the Lessons tab that are not in the shipped lead sheets (docs/LESSONS.md): two
// study tunes written for it and What Is This Thing Called Love?, as a bundled lead sheet file:
// public/leadsheets/lessons.json. Run with `pnpm run lesson-songs` after changing a tune here.
//
// Each bar is written as its chords (sharing the bar evenly; "NC" for no chord) and its melody, a
// list of "pitch:length" (length in quarter notes, or a fraction for triplets; "r" is a rest; a
// note ending in "~" is tied to the same pitch starting the next bar):
//
//   ['F7', 'A4:1 C5:1 Eb5:1.5 D5:.5']   ->  F7 for 4 beats; A, C, Eb (dotted), D
//   ['F7', 'C5:1 Eb5:1 Eb5:2/3 F5:2/3 Eb5:2/3']  ->  a half-note triplet at the end

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/**
 * The MIDI number of a note name with its octave.
 *
 *   'C4' -> 60, 'Eb5' -> 75, 'F#4' -> 66
 */
export function midi(name) {
  const match = /^([A-G])(b|#)?(\d)$/.exec(name)
  if (!match) throw new Error(`Bad note: ${name}`)
  const [, step, alter, octave] = match
  return 12 * (Number(octave) + 1) + STEPS[step] + (alter === 'b' ? -1 : alter === '#' ? 1 : 0)
}

/** A length in quarter notes: a number or a fraction ('2/3'). */
const length = (text) => {
  const [top, bottom = '1'] = text.split('/')
  return Number(top) / Number(bottom)
}

/** A chart in the app's format from its bars (see above); every bar is 4/4. */
export function chart({ title, composer, style, key, bpm, bars, source }) {
  const notes = []
  let tied = null // a note tied over the bar line, waiting for its continuation
  const written = bars.map(([chords, melody], index) => {
    const symbols = chords.split(' ')
    let at = 0
    for (const item of melody.split(' ').filter(Boolean)) {
      const [name, size] = item.replace(/~$/, '').split(':')
      const beats = length(size)
      if (tied && at === 0 && name !== 'r' && midi(name) === tied.pitch) tied.beats += beats
      else if (name !== 'r') notes.push({ bar: index, at, beats, pitch: midi(name) })
      tied = item.endsWith('~') ? notes.at(-1) : null
      at += beats
    }
    if (Math.abs(at - 4) > 1e-6) throw new Error(`${title}, bar ${index + 1}: ${at} beats`)
    return {
      chords: symbols.map((symbol) => ({ symbol: symbol === 'NC' ? null : symbol, beats: 4 / symbols.length })),
      cells: 4,
      ...(index % 4 === 0 ? { rowStart: true } : {}),
    }
  })
  return { format: 'openstand-chart', version: 1, title, composer, style, key, bpm, time: [4, 4], bars: written, melody: { notes, source } }
}

const SOURCE = 'Written for the Lessons tab (CC BY 4.0)'

// Unit 2: a riff on chord tones over a 12-bar blues in F, for the Charleston left hand
const STUDY_BLUES = chart({
  title: 'Study Blues', composer: 'Lessons tab', style: 'swing', key: 5, bpm: 90, source: SOURCE,
  bars: [
    ['F7', 'A4:1 C5:1 Eb5:1.5 D5:.5'], ['Bb7', 'D5:2 r:2'],
    ['F7', 'A4:1 C5:1 F5:1 Eb5:1'], ['F7', 'C5:2 r:2'],
    ['Bb7', 'D5:1 F5:1 Ab5:1.5 G5:.5'], ['Bb7', 'F5:2 r:2'],
    ['F7', 'A4:1 C5:1 Eb5:1 C5:1'], ['D7', 'C5:1 A4:1 F#4:2'],
    ['G-7', 'G4:1 Bb4:1 D5:1 F5:1'], ['C7', 'E5:2 Bb4:2'],
    ['F7 D7', 'A4:2 F#4:2'], ['G-7 C7', 'G4:2 E4:2'],
  ],
})

// Unit 6: AABA, 8 bars of D minor (Dorian), the bridge a half step up; phrases of 2 bars, then rest
const A_SECTION = [
  ['D-7', 'D5:1 F5:1 A5:2'], ['D-7', 'G5:3 E5:1'], ['D-7', 'D5:4'], ['D-7', 'r:4'],
  ['D-7', 'C5:1 D5:1 F5:2'], ['D-7', 'E5:2 C5:2'], ['D-7', 'D5:4'], ['D-7', 'r:4'],
]
const B_SECTION = [
  ['Eb-7', 'Eb5:1 Gb5:1 Bb5:2'], ['Eb-7', 'Ab5:3 F5:1'], ['Eb-7', 'Eb5:4'], ['Eb-7', 'r:4'],
  ['Eb-7', 'Db5:1 Eb5:1 Gb5:2'], ['Eb-7', 'F5:2 Db5:2'], ['Eb-7', 'Eb5:4'], ['Eb-7', 'r:4'],
]
const MODAL_STUDY = chart({
  title: 'Modal Study (D Dorian)', composer: 'Lessons tab', style: 'swing', key: 0, bpm: 120, source: SOURCE,
  bars: [...A_SECTION, ...A_SECTION, ...B_SECTION, ...A_SECTION],
})

// Unit 4: the refrain of Cole Porter's song (Harms, 1929; public domain in the US). The melody is
// from the first edition's score; the chords are the jazz changes most charts give (the
// minor ii-V-i of every A section resolving to major, as Hot House uses them), which fit the
// first edition's piano part
const A_START = [['Gh7', 'Bb4:1 G4:1 G4:2~'], ['C7b9', 'G4:2 Bb4:2'], ['F-6', 'Ab4:4'], ['F-6', 'r:3 Ab4:1']]
const THIS_THING = chart({
  title: 'What Is This Thing Called Love?', composer: 'Cole Porter', style: 'swing', key: 0, bpm: 120,
  source: 'Cole Porter, refrain: melody from the first edition (Harms, New York, 1929; IMSLP), common jazz changes',
  bars: [
    ['NC', 'r:3 Bb4:1'],
    ...A_START, ['Dh7', 'Ab4:.5 G4:1 G4:2.5~'], ['G7#5', 'G4:2 Eb4:2'], ['C^7', 'E4:4'], ['C^7', 'r:3 Bb4:1'],
    ['Gh7', 'Bb4:1 G4:1 G4:2~'], ['C7b9', 'G4:1 Bb4:1 Bb4:1.5 A4:.5'], ['F-6', 'Ab4:4'], ['F-6', 'r:3 Ab4:1'],
    ['Dh7', 'Ab4:.5 G4:1 G4:2.5~'], ['G7#5', 'G4:1 Eb4:1 Eb4:.5 Eb4:1.5'], ['C^7', 'C4:4'], ['C^7', 'r:3 Eb5:1'],
    ['C-7', 'Eb5:1 C5:1 C5:2~'], ['F7', 'C5:1 Eb5:1 Eb5:2/3 F5:2/3 Eb5:2/3'], ['Bb^7', 'D5:4'], ['Bb^7', 'r:3 D5:1'],
    ['Ab7', 'C5:1 Ab4:1 Ab4:2~'], ['Ab7', 'Ab4:1 C5:1 C5:2/3 Bb4:2/3 Ab4:2/3'], ['Dh7', 'G4:4'], ['G7', 'r:1 Bb4:1 Bb4:1 Bb4:1'],
    ['Gh7', 'Bb4:1 G4:1 G4:2~'], ['C7b9', 'G4:1 Bb4:1 Bb4:.5 C5:1 Bb4:.5'], ['F-6', 'Ab4:4'], ['F-6', 'r:3 Ab4:1'],
    ['Dh7', 'Ab4:1 G4:1 G4:2~'], ['G7#5', 'G4:2 Eb5:2'], ['C^7', 'C5:4~'], ['C^7', 'C5:1 r:3'],
  ],
})

const FILE = {
  format: 'ear-training-studio-playlists', version: 1,
  playlists: [{ name: 'Lessons study tunes', charts: [STUDY_BLUES, MODAL_STUDY, THIS_THING] }],
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(new URL('../public/leadsheets/lessons.json', import.meta.url), `${JSON.stringify(FILE)}\n`)
  console.log('public/leadsheets/lessons.json: 3 tunes')
}
