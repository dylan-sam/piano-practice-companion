import { describe, expect, test } from 'vitest'
import bundled from '../public/leadsheets/catalog.json'
import { chartFromMeasures, type Chart } from '../src/music/chart'
import { chartProgressions, chordSignature, hasProgressions, patternFromLabel, type ProgressionPattern } from '../src/library/progressionMatch'

const LABELS: [string, string][] = [
  ['progression-02', 'ii – V – I'], ['progression-01', 'I – IV – V'], ['progression-06', 'ii – ♭II7 – I'],
  ['progression-20', 'iv – V – i'], ['progression-15', 'I – V – IV – IV – I – V – I – V'], ['progression-05', 'vi – ii – V – I'],
]
const patterns = LABELS.map(([id, label]) => patternFromLabel(id, label)!) as ProgressionPattern[]
const song = (measures: string[][], key = 0) => chartFromMeasures({ title: 'T', style: 'swing', key, bpm: 120 }, measures)

describe('progressions read from their labels', () => {
  test('case is the family, 7 a dominant, ♭ a flat degree', () => {
    expect(patternFromLabel('p', 'ii – ♭II7 – I')?.chords).toEqual([
      { degree: 'II', family: 'min', dominant: false }, { degree: 'bII', family: 'maj', dominant: true }, { degree: 'I', family: 'maj', dominant: false },
    ])
    expect(patternFromLabel('p', 'not a progression')).toBeNull()
  })
})

describe('chords read in a key', () => {
  test('degree and family; altered 5ths and sus chords match nothing', () => {
    expect(chordSignature('G7', 0)).toEqual({ degree: 'V', family: 'maj', dominant: true })
    expect(chordSignature('D-7', 0)).toEqual({ degree: 'II', family: 'min', dominant: false })
    expect(chordSignature('Db7', 0)).toEqual({ degree: 'bII', family: 'maj', dominant: true })
    expect(chordSignature('Bh7', 0)).toBeNull()
    expect(chordSignature('G7sus', 0)).toBeNull()
    expect(chordSignature(null, 0)).toBeNull()
  })
})

describe('progressions found in a chart', () => {
  test('ii-V-I in the key, repeated chords counted once', () => {
    expect([...chartProgressions(song([['D-7'], ['D-7'], ['G7'], ['C^7']]), patterns)]).toEqual(['progression-02'])
  })

  test('in another key, and with a tritone substitute wanting its 7th', () => {
    expect(chartProgressions(song([['G-7', 'C7'], ['F^7']], 5), patterns).has('progression-02')).toBe(true)
    expect(chartProgressions(song([['D-7', 'Db7'], ['C']]), patterns).has('progression-06')).toBe(true)
    expect(chartProgressions(song([['D-7', 'Db'], ['C']]), patterns).has('progression-06')).toBe(false)
  })

  test('a chord that matches nothing breaks the progression', () => {
    expect(chartProgressions(song([['D-7'], ['Bh7'], ['G7'], ['C']]), patterns).has('progression-02')).toBe(false)
  })

  test('a repeated pattern chord wants as many chords in a row', () => {
    const blues = song([['C'], ['G'], ['F'], ['F'], ['C'], ['G'], ['C'], ['G']])
    expect(chartProgressions(blues, patterns).has('progression-15')).toBe(true)
    expect(chartProgressions(song([['C'], ['G'], ['F'], ['C'], ['G'], ['C'], ['G']]), patterns).has('progression-15')).toBe(false)
  })

  test('the shipped lead sheets hold progressions (Honeysuckle Rose: ii-V-I)', () => {
    const tune = bundled.playlists[0].charts.find((chart) => chart.title === 'Honeysuckle Rose') as unknown as Chart
    expect(chartProgressions(tune, patterns).has('progression-02')).toBe(true)
  })
})

describe('the filter', () => {
  test('any of the chosen progressions, or all of them', () => {
    const found = new Set(['progression-02'])
    expect(hasProgressions(found, [], false)).toBe(true)
    expect(hasProgressions(found, ['progression-02', 'progression-01'], false)).toBe(true)
    expect(hasProgressions(found, ['progression-02', 'progression-01'], true)).toBe(false)
  })
})
