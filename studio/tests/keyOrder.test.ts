import { describe, expect, test } from 'vitest'
import { chorusKeyOffset } from '../src/engine/keyOrder'
import { buildTimeline } from '../src/engine/timeline'
import { chartFromMeasures } from '../src/music/chart'
import { chorusesForKeys, NO_PRACTICE, practiceChange } from '../src/music/practice'

// The key of each chorus (0..11 above the written key)
const keys = (plan: Parameters<typeof chorusKeyOffset>[0], count: number) =>
  Array.from({ length: count }, (_, chorus) => (chorusKeyOffset(plan, chorus) + 12) % 12)

describe('keys of the choruses', () => {
  test('steps go round their keys', () => {
    expect(keys({ keyStep: 7 }, 12)).toEqual([0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5])
    expect(keys({ keyStep: 3 }, 5)).toEqual([0, 3, 6, 9, 0])
    expect(keys({ keyStep: 4 }, 4)).toEqual([0, 4, 8, 0])
  })

  test('random keys: the written key first, then each key once per twelve choruses', () => {
    for (const seed of [1, 42, 123456789]) {
      const order = keys({ randomKeys: { seed } }, 36)
      expect(order[0]).toBe(0)
      for (let block = 0; block < 3; block++) expect(new Set(order.slice(block * 12, block * 12 + 12)).size).toBe(12)
      // No key twice in a row across the blocks
      expect(order[12]).not.toBe(order[11])
      expect(order[24]).not.toBe(order[23])
      // The same seed gives the same keys (the band and the stand agree)
      expect(keys({ randomKeys: { seed } }, 36)).toEqual(order)
    }
    expect(keys({ randomKeys: { seed: 1 } }, 12)).not.toEqual(keys({ randomKeys: { seed: 2 } }, 12))
  })

  test('the timeline plays the chords in the random keys', () => {
    const chart = chartFromMeasures({ title: 'T', style: 'swing', key: 0, bpm: 120 }, [['C']])
    const plan = { randomKeys: { seed: 7 } }
    const timeline = buildTimeline(chart, 0, 12, plan)
    const roots = timeline.slots.filter((s) => s.measure === 0).map((s) => s.chord.root)
    expect(roots.map((root, chorus) => (root - chorusKeyOffset(plan, chorus) + 12) % 12)).toEqual(Array(12).fill(0))
  })

  test('random keys need twelve choruses, and a new order is a change of keys', () => {
    const random = { ...NO_PRACTICE, randomKeys: { seed: 3 } }
    expect(chorusesForKeys(NO_PRACTICE, random, 2)).toBe(12)
    expect(practiceChange(random, { ...random, randomKeys: { seed: 4 } })).toBe('keys')
    expect(practiceChange(random, { ...random })).toBe('none')
  })
})
