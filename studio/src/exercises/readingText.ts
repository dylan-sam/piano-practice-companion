/**
 * Plain helpers for the sightreading exercises' reading text: what the score line shows, the
 * top bar's tally and the hint under the sheet (kept out of ReadingControls.tsx so that file only
 * exports components).
 */
import type { CheckMode, MelodyScore } from './melodyReading'
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
 * The short tally for the top bar's position label: what was played right out of what was judged,
 * counting melody notes, chords, or both as checked. '' before anything is judged.
 */
export function readingTally(reading: ReadingScore): string {
  const { checking, score, chordScore } = reading
  const melody = checking !== 'chords'
  const chords = checking !== 'melody'
  const right = (melody ? score.correct : 0) + (chords ? chordScore.correct : 0)
  const judged = (melody ? score.correct + score.wrong + score.missed : 0) + (chords ? chordScore.correct + chordScore.missed : 0)
  return judged ? `  ${right}/${judged}\u00a0right` : ''
}

/**
 * How to play, under the sheet, for what is checked: `melody` says what the melody is (the
 * melody, the lick...).
 */
export function readingHint(checking: CheckMode, melody: string): string {
  const chords = 'the chords in any voicing, inversion or rhythm (the 5th may be left out)'
  switch (checking) {
    case 'melody': return `Play ${melody} on your keyboard as the band plays. Green: right; orange: wrong note; red: missed.`
    case 'chords': return `Play ${chords} as the band plays. A chord turns green once its notes are played, red when it is missed.`
    case 'both': return `Play ${melody} with your right hand and ${chords} with your left. Notes and chords turn green when played, red when missed (orange: a wrong melody note).`
  }
}
