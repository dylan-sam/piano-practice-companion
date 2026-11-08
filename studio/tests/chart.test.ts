import { describe, expect, test } from 'vitest'
import { chartFromMeasures, playbackOrder, tuplets, type Chart, type ChartBar } from '../src/music/chart'
import { decodeChart, encodeChart } from '../src/formats/share'

function chart(bars: Partial<ChartBar>[]): Chart {
  return {
    format: 'openstand-chart',
    version: 1,
    title: 'T',
    style: 'swing',
    key: 0,
    bpm: 120,
    time: [4, 4],
    bars: bars.map((b) => ({ chords: [{ symbol: 'C', beats: 4 }], cells: 4, ...b })),
  }
}

describe('playback order', () => {
  test('plain form', () => {
    expect(playbackOrder(chart([{}, {}, {}]))).toEqual([0, 1, 2])
  })

  test('repeat with first and second endings', () => {
    const c = chart([{ repeatStart: true }, {}, { ending: 1, repeatEnd: true }, { ending: 2 }, {}])
    expect(playbackOrder(c)).toEqual([0, 1, 2, 0, 1, 3, 4])
  })

  test('repeat played three times', () => {
    const c = chart([{ repeatStart: true }, { repeatEnd: true, repeatTimes: 3 }, {}])
    expect(playbackOrder(c)).toEqual([0, 1, 0, 1, 0, 1, 2])
  })

  test('D.C. al Fine', () => {
    const c = chart([{}, { directive: 'Fine' }, {}, { directive: 'D.C. al Fine' }])
    expect(playbackOrder(c)).toEqual([0, 1, 2, 3, 0, 1])
  })

  test('D.S. al Coda skips repeats and jumps at the coda sign', () => {
    const c = chart([
      {},
      { segno: true, repeatStart: true },
      { coda: true, repeatEnd: true },
      { directive: 'D.S. al Coda' },
      { coda: true },
      {},
    ])
    expect(playbackOrder(c)).toEqual([0, 1, 2, 1, 2, 3, 1, 2, 4, 5])
  })
})

test('share links round-trip a chart', async () => {
  const c = chartFromMeasures({ title: 'Blues', style: 'swing', key: 5, bpm: 140 }, [['F7'], ['Bb7', 'B°7']])
  const encoded = await encodeChart(c)
  expect(encoded).toMatch(/^[\w-]+$/)
  expect(await decodeChart(encoded)).toEqual(c)
})

describe('tuplets of a bar', () => {
  test('even shares that plain notes cannot write are marked with their count', () => {
    expect(tuplets([4 / 3, 4 / 3, 4 / 3])).toEqual([{ first: 0, last: 2, count: 3 }])
    expect(tuplets([0.8, 0.8, 0.8, 0.8, 0.8])).toEqual([{ first: 0, last: 4, count: 5 }])
    expect(tuplets([2, 2 / 3, 2 / 3, 2 / 3])).toEqual([{ first: 1, last: 3, count: 3 }])
    expect(tuplets([4 / 3, 8 / 3])).toEqual([{ first: 0, last: 1, count: 3 }])
  })

  test('plain lengths, dotted ones included, are not tuplets', () => {
    expect(tuplets([2, 1, 1])).toEqual([])
    expect(tuplets([1.5, 1.5])).toEqual([])
    expect(tuplets(Array(12).fill(1 / 3))).toEqual([]) // a crowded bar is an even share, not a tuplet
    expect(tuplets([1.333333, 1.333333, 1.333334])).toEqual([{ first: 0, last: 2, count: 3 }])
  })
})
