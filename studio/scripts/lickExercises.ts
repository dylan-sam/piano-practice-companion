// The vocabulary licks written for this project, for the lick database (lickCatalog.ts). The
// exercises themselves are no longer generated here: the app builds them from settings
// (src/exercises/builder/exerciseBuilder.ts).

import type { Chart } from '../src/music/chart'
import type { LickGroup } from './lickNaming'
import { makeLickChart, parseChords, parseNotes } from '../src/exercises/builder/lickCharts'

const SOURCE = 'Piano Practice Companion'
const LICENSE = 'CC BY 4.0' // the project's data license (data/LICENSE.md)

// Licks written for this project from common jazz devices (arpeggios, digital patterns, enclosures,
// bebop scales, the blues scale). "The Lick" is a traditional figure shared by countless players.
// One-chord licks name their group (see lickNaming.ts); the others are listed as vocabulary over progressions
export const VOCABULARY: { title: string; chords: string; notes: string; context: string; tags: string[]; source?: string; group?: LickGroup }[] = [
  { title: 'The Lick', chords: 'C-7:4', notes: 'C4:8 D4:8 Eb4:8 F4:8 D4:4 Bb3:8 C4:8', context: 'min7', tags: ['traditional'], source: 'Traditional', group: 'Scale lines' },
  { title: 'The Lick over ii-V-I', chords: 'D-7:4 G7b9:4 C^7:4', notes: 'D4:8 E4:8 F4:8 G4:8 E4:4 C4:8 D4:8 B3:8 D4:8 F4:8 A4:8 Ab4:8 F4:8 D4:8 B3:8 C4:2', context: 'ii-V-I', tags: ['traditional', 'arpeggio'], source: 'Traditional' },
  { title: '3-to-9 arpeggios', chords: 'D-7:4 G7alt:4 C^7:4', notes: 'F4:8 A4:8 C5:8 E5:8 D5:8 C5:8 A4:8 F4:8 B3:8 D4:8 F4:8 Ab4:8 G4:8 F4:8 Eb4:8 D4:8 E4:2', context: 'ii-V-I', tags: ['arpeggio', 'upper structure'] },
  { title: '1-2-3-5 cells', chords: 'D-7:4 G7:4 C^7:4', notes: 'D4:8 E4:8 F4:8 A4:8 C5:8 B4:8 A4:8 F4:8 G4:8 A4:8 B4:8 D5:8 F5:8 E5:8 D5:8 B4:8 C5:2', context: 'ii-V-I', tags: ['digital pattern'] },
  { title: 'Scale down, b9 arpeggio up', chords: 'D-7:4 G7b9:4 C^7:4', notes: 'C5:8 B4:8 A4:8 G4:8 F4:8 E4:8 D4:8 C4:8 B3:8 D4:8 F4:8 A4:8 Ab4:8 F4:8 D4:8 B3:8 C4:2', context: 'ii-V-I', tags: ['scale', 'arpeggio'] },
  { title: 'Enclosure into the 3rd', chords: 'D-7:4 G7:4 C^7:4', notes: 'A4:8 G4:8 F4:8 E4:8 D4:8 F4:8 C4:8 A#3:8 B3:4 D4:8 F4:8 A4:8 G4:8 F4:8 D4:8 E4:2', context: 'ii-V-I', tags: ['enclosure'] },
  { title: 'Triplet arpeggios', chords: 'D-7:2 G7:2 C^7:4', notes: 'D4:8t F4:8t A4:8t C5:8t A4:8t F4:8t B3:8t D4:8t F4:8t A4:8t G4:8t F4:8t E4:2', context: 'ii-V-I', tags: ['arpeggio', 'triplets'] },
  { title: 'Minor ii-V-i, b9 arpeggio', chords: 'Dh7:4 G7b9:4 C-6:4', notes: 'D4:8 F4:8 Ab4:8 C5:8 Bb4:8 Ab4:8 F4:8 D4:8 B3:8 D4:8 F4:8 Ab4:8 G4:8 Eb4:8 D4:8 B3:8 C4:2', context: 'ii-V-i', tags: ['arpeggio'] },
  { title: 'Minor ii-V-i in one bar', chords: 'Dh7:2 G7b9:2 C-6:4', notes: 'F4:8 Ab4:8 C5:8 Eb5:8 D5:8 B4:8 Ab4:8 F4:8 Eb4:2', context: 'ii-V-i', tags: ['arpeggio'] },
  { title: 'Diminished arpeggio from the b9', chords: 'G7b9:4 C^7:4', notes: 'Ab4:8 B4:8 D5:8 F5:8 Ab5:8 G5:8 F5:8 D5:8 E5:2', context: 'V-I', tags: ['arpeggio', 'diminished'] },
  { title: 'Altered scale down', chords: 'G7alt:4 C^7:4', notes: 'F5:8 Eb5:8 Db5:8 B4:8 Bb4:8 Ab4:8 G4:8 F4:8 E4:2', context: 'V-I', tags: ['altered scale'] },
  { title: 'Harmonic minor resolution', chords: 'G7b9:4 C-6:4', notes: 'D5:8 B4:8 Ab4:8 F4:8 D4:8 F4:8 B3:8 G3:8 C4:2', context: 'V-i', tags: ['arpeggio', 'harmonic minor'] },
  { title: 'Blue third', chords: 'C7:8', notes: 'Eb4:8 E4:8 G4:8 A4:8 Bb4:8 A4:8 G4:8 E4:8 C4:2', context: 'dom7', tags: ['blues'], group: 'Blues' },
  { title: 'Blues scale riff', chords: 'C7:4', notes: 'C5:8 Bb4:8 G4:8 F#4:8 F4:8 Eb4:8 C4:4', context: 'dom7', tags: ['blues', 'blues scale'], group: 'Blues' },
  { title: 'Arpeggios in triplets', chords: 'C7:4', notes: 'C4:8t E4:8t G4:8t Bb4:8t G4:8t E4:8t D4:8t F4:8t A4:8t C5:4', context: 'dom7', tags: ['arpeggio', 'triplets'], group: 'Arpeggios' },
  { title: 'Bebop scale down from the 7th', chords: 'C7:8', notes: 'Bb4:8 A4:8 G4:8 F4:8 E4:8 D4:8 C4:8 B3:8 Bb3:8 D4:8 F4:8 A4:8 G4:2', context: 'dom7', tags: ['bebop scale'], group: 'Scale lines' },
  { title: 'Arpeggio 3-5-7-9-11, up and back', chords: 'C^7#11:8', notes: 'E4:8 G4:8 B4:8 D5:8 F#5:8 E5:8 D5:8 B4:8 C5:2', context: 'maj7', tags: ['arpeggio', 'upper structure'], group: 'Arpeggios' },
  { title: 'Arpeggio 1-3-5-7-9 from the 7 below', chords: 'C^7:8', notes: 'B3:8 C4:8 E4:8 G4:8 B4:8 D5:8 C5:8 A4:8 G4:2', context: 'maj7', tags: ['arpeggio'], group: 'Arpeggios' },
  { title: '1-2-3-5 climb', chords: 'C-7:8', notes: 'C4:8 D4:8 Eb4:8 G4:8 F4:8 G4:8 A4:8 C5:8 Bb4:2', context: 'min7', tags: ['digital pattern'], group: 'Scale lines' },
  { title: 'Arpeggio 3-5-7-9, scale down to the root', chords: 'C-7:8', notes: 'Eb4:8t G4:8t Bb4:8t D5:4 C5:8 Bb4:8 G4:8 F4:8 Eb4:8 D4:8 C4:2', context: 'min7', tags: ['arpeggio', 'triplets'], group: 'Arpeggios' },
  { title: 'Arpeggio 5-7-1-3, scale down to the root', chords: 'C-7:8', notes: 'G4:8 Bb4:8 C5:8 Eb5:8 D5:8 C5:8 Bb4:8 G4:8 F4:4 Eb4:4 C4:2', context: 'min7', tags: ['pentatonic'], group: 'Arpeggios' },
  { title: 'Arpeggio 1-3-5-7, scale down to the 9', chords: 'Ch7:4', notes: 'C4:8 Eb4:8 Gb4:8 Bb4:8 Ab4:8 Gb4:8 Eb4:8 D4:8', context: 'half', tags: ['arpeggio'], group: 'Arpeggios' },
  { title: 'Scale up the octave, with a leading tone', chords: 'Co7:8', notes: 'C4:8 D4:8 Eb4:8 F4:8 Gb4:8 Ab4:8 A4:8 B4:8 C5:2', context: 'dim7', tags: ['diminished scale'], group: 'Scale lines' },
  { title: 'Turnaround arpeggios', chords: 'C^7:2 A7:2 D-7:2 G7:2 C^7:4', notes: 'E4:8 G4:8 B4:8 A4:8 C#5:8 A4:8 E4:8 G4:8 F4:8 A4:8 C5:8 E5:8 D5:8 B4:8 G4:8 F4:8 E4:2', context: 'I-vi-ii-V', tags: ['arpeggio'] },
]

/** The vocabulary licks as charts. */
function vocabularyLicks(): Chart[] {
  return VOCABULARY.map((lick) => makeLickChart({
    title: lick.title, chords: parseChords(lick.chords), notes: parseNotes(lick.notes),
    info: { kind: 'lick', category: lick.group ?? 'Vocabulary', context: lick.context, source: lick.source ?? SOURCE, license: LICENSE,
      tags: lick.tags, level: /8t/.test(lick.notes) ? 2 : 1 },
  }))
}

/** Every generated playlist of the lick database: the vocabulary licks. */
export function generatedPlaylists(): { name: string; charts: Chart[] }[] {
  return [{ name: 'Licks: vocabulary', charts: vocabularyLicks() }]
}
