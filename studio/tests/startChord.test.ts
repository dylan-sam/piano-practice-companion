import { describe, expect, test } from 'vitest'
import { buildTimeline, chordsOfBar, chordStartBeat } from '../src/engine/timeline'
import { chartFromMeasures } from '../src/music/chart'

describe('start from a chord', () => {
  const chart = chartFromMeasures({ title: 'T', style: 'swing', key: 0, bpm: 120 }, [['C'], ['Dm7', 'G7'], ['C'], ['C']])

  test('finds the beat of a written chord in the first chorus', () => {
    const timeline = buildTimeline(chart, 0, 3)
    const bar = timeline.bars.find((b) => b.measure === 1)!
    expect(chordStartBeat(timeline, chart, 1, 0)).toBe(bar.start)
    expect(chordStartBeat(timeline, chart, 1, 1)).toBe(bar.start + 2)
    expect(bar.start).toBe(timeline.countIn + 4)
  })

  test('ignores a bar outside the practice loop', () => {
    const timeline = buildTimeline(chart, 0, 1, { loop: [2, 3] })
    expect(chordStartBeat(timeline, chart, 1, 0)).toBeNull()
    expect(chordStartBeat(timeline, chart, 3, 0)).not.toBeNull()
  })
})

describe('the chords of a tapped bar', () => {
  test('a bar with two chords, a bar holding the chord before it, and the chord after each', () => {
    const chart = chartFromMeasures({ title: 'T', style: 'swing', key: 0, bpm: 120 }, [['Dm7', 'G7'], [], ['C^7']])
    const timeline = buildTimeline(chart, 2, 1)
    const two = chordsOfBar(timeline, 0)
    expect(two.map((c) => [c.chord.root, c.chordIndex, c.next?.root])).toEqual([[4, 0, 9], [9, 1, 2]])
    expect(chordsOfBar(timeline, 1).map((c) => c.chord.root)).toEqual([9])
  })
})

describe('a tapped bar inside a repeat', () => {
  test('shows its chords once, from the first pass', () => {
    const chart = chartFromMeasures({ title: 'T', style: 'swing', key: 0, bpm: 120 }, [['C'], ['D7', 'E7'], ['A-']])
    chart.bars[0].repeatStart = true
    chart.bars[1].repeatEnd = true
    const timeline = buildTimeline(chart, 0, 1)
    expect(timeline.bars.filter((b) => b.measure === 1 && b.chorus === 0)).toHaveLength(2)
    expect(chordsOfBar(timeline, 1).map((c) => [c.chord.root, c.chordIndex])).toEqual([[2, 0], [4, 1]])
  })
})
