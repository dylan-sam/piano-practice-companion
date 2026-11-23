/**
 * Plain helpers for the sightreading exercises' reading text: what the score line shows, the
 * top bar's tally and the hint under the sheet (kept out of ReadingControls.tsx so that file only
 * exports components).
 */
import { checksChords, checksMelody, type CheckMode, type MelodyScore } from './melodyReading'
import type { LeftHandStage } from './sightReading'
import type { ChordScore } from './useMelodyJudging'

/** What the score line shows: the melody's score, the chords' score, or both. */
export interface ReadingScore {
  checking: CheckMode
  score: MelodyScore
  total: number
  chordScore: ChordScore
  chordTotal: number
}

/**
 * What was played right out of what was judged, and how much there is to judge in the
 * play-through, counting melody notes, chords, or both as checked.
 */
export function readingCount(reading: ReadingScore): { right: number; judged: number; total: number } {
  const { checking, score, chordScore } = reading
  const melody = checksMelody(checking)
  const chords = checksChords(checking)
  return {
    right: (melody ? score.correct : 0) + (chords ? chordScore.correct : 0),
    judged: (melody ? score.correct + score.wrong + score.missed : 0) + (chords ? chordScore.correct + chordScore.missed : 0),
    total: (melody ? reading.total : 0) + (chords ? reading.chordTotal : 0),
  }
}

/**
 * The short tally for the top bar's position label: what was played right out of what was judged.
 * '' before anything is judged.
 */
export function readingTally(reading: ReadingScore): string {
  const { right, judged } = readingCount(reading)
  return judged ? `  ${right}/${judged}\u00a0right` : ''
}

// What the left hand plays at each stage, for the hint
const LEFT_HAND: Record<LeftHandStage, string> = {
  bass: "each chord's bass note (its root, or the note after the slash)",
  chord: 'the chords in any voicing, inversion or rhythm (the 5th may be left out)',
  beats: 'the chords on every beat, in any voicing or inversion (the 5th may be left out)',
  pattern: "the band piano's rhythm, with each chord's bass among your notes",
}

/**
 * How to play, under the sheet, for what is checked: `melody` says what the melody is (the
 * melody, the lick...), `stage` what the left hand plays.
 */
export function readingHint(checking: CheckMode, melody: string, stage: LeftHandStage = 'chord'): string {
  const chords = LEFT_HAND[stage]
  switch (checking) {
    case 'melody': return `Play ${melody} on your keyboard as the band plays. Green: right; orange: wrong note; red: missed.`
    case 'chords': return `Play ${chords} as the band plays. A chord turns green once its notes are played, red when it is missed.`
    case 'together': return `Play ${melody} with both hands, an octave apart (or any two octaves with Any octave). Each note counts once per hand. Green: right; orange: wrong note; red: missed.`
    case 'both': return `Play ${melody} with your right hand and ${chords} with your left. Notes and chords turn green when played, red when missed (orange: a wrong melody note).`
  }
}
