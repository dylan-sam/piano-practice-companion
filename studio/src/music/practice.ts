// Practice settings: loop part of a tune, go round the keys, speed up each chorus

import type { Chart } from './chart'

export interface PracticeSettings {
  loop: [number, number] | null // written bar indices
  keyStep: number // semitones per chorus
  ramp: number // bpm added per chorus
}

export const NO_PRACTICE: PracticeSettings = { loop: null, keyStep: 0, ramp: 0 }

export const KEY_STEPS: { step: number; label: string }[] = [
  { step: 0, label: 'Stay in the written key' },
  { step: 5, label: 'Up a fourth each chorus (all 12 keys)' },
  { step: 1, label: 'Up a half step each chorus' },
  { step: 2, label: 'Up a whole step each chorus' },
  { step: 11, label: 'Down a half step each chorus' },
]

// Rehearsal sections as bar ranges: from each mark to the bar before the next one
export function sections(chart: Chart): { name: string; from: number; to: number }[] {
  const starts = chart.bars.flatMap((b, i) => (b.section ? [i] : []))
  return starts.map((from, n) => {
    let to = (starts[n + 1] ?? chart.bars.length) - 1
    while (to > from && chart.bars[to].spacer) to--
    const mark = chart.bars[from].section!
    return { name: mark === 'i' ? 'Intro' : mark === 'v' ? 'Verse' : mark, from, to }
  })
}
