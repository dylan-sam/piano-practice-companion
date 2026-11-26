// The licks the app ships: a curated choice of what the miner and the vocabulary make
// (lickMining.ts, lickExercises.ts), so that a list can be worked through rather than scrolled. Each
// list keeps at most LICKS_PER_LIST, taken evenly from each level (easy, intermediate, harder) in the
// list's own order. Everything left out stays in the miner; the log (data/licks.log) says how many
// were kept. (The exercises are built in the app from settings: src/exercises/builder/.)

import type { Chart } from '../src/music/chart'

export const LICKS_PER_LIST = 15

/**
 * At most `max` licks of a list, taken in turn from each level (1, 2, 3...) so that easy,
 * intermediate and harder licks are all there, and kept in the list's own order.
 */
export function curateLicks(charts: readonly Chart[], max = LICKS_PER_LIST): Chart[] {
  if (charts.length <= max) return [...charts]
  const levels = [...new Set(charts.map((chart) => chart.lick?.level ?? 1))].sort((a, b) => a - b)
  const queues = levels.map((level) => charts.filter((chart) => (chart.lick?.level ?? 1) === level))
  const kept = new Set<Chart>()
  for (let i = 0; kept.size < max; i++) {
    const queue = queues[i % queues.length]
    const next = queue.shift()
    if (next) kept.add(next)
    if (queues.every((q) => !q.length)) break
  }
  return charts.filter((chart) => kept.has(chart))
}
