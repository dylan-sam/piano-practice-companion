import { describe, expect, test } from 'vitest'
import { arrange } from '../src/engine/arrange'
import { buildTimeline, chorusTranspose } from '../src/engine/timeline'
import { parseIrealLinks } from '../src/formats/ireal'
import { chartToMusic, irealLink } from '../src/formats/irealWrite'
import { chartFromMeasures, playbackOrder } from '../src/music/chart'
import { deleteBar, emptyChart, insertBar, setTime, updateBar } from '../src/music/edit'
import { barToInput, parseBarInput, toChartSymbol } from '../src/music/notation'
import { chorusesForKeys, NO_PRACTICE, practiceChange, sections } from '../src/music/practice'
import { getStyle } from '../src/styles'

const tune = chartFromMeasures({ title: 'Practice Tune', composer: 'Some Writer', style: 'swing', key: 0, bpm: 132 }, [
  ['D-7'],
  ['G7'],
  ['C^7'],
  [],
  ['E-7', 'A7'],
  ['D-7', 'G7'],
  ['C6'],
  ['C6'],
])

describe('typing chords', () => {
  test('common spellings become chart notation', () => {
    const cases: [string, string][] = [
      ['Dm7', 'D-7'],
      ['Cmaj7', 'C^7'],
      ['CΔ', 'C^7'],
      ['Bø', 'Bh7'],
      ['Bm7b5', 'Bh7'],
      ['F#dim7', 'F#o7'],
      ['Ebm(maj7)', 'Eb-^7'],
      ['G7sus4', 'G7sus'],
      ['C6/9', 'C69'],
      ['Bb7#11', 'Bb7#11'],
      ['a-7/g', 'A-7/G'],
      ['C+', 'C+'],
    ]
    for (const [input, out] of cases) expect(toChartSymbol(input), input).toBe(out)
    expect(toChartSymbol('H7')).toBeNull()
    expect(toChartSymbol('C/X')).toBeNull()
  })

  test('a bar of text becomes chords with lengths', () => {
    expect(parseBarInput('Dm7 G7', [4, 4])).toEqual({
      ok: true,
      chords: [
        { symbol: 'D-7', beats: 2 },
        { symbol: 'G7', beats: 2 },
      ],
    })
    expect(parseBarInput('C:3 G7', [4, 4])).toMatchObject({ ok: true, chords: [{ beats: 3 }, { beats: 1 }] })
    expect(parseBarInput('NC', [4, 4])).toEqual({ ok: true, chords: [{ symbol: null, beats: 4 }] })
    expect(parseBarInput('', [4, 4])).toEqual({ ok: true, chords: [] })
    expect(parseBarInput('C:3 G7:3', [4, 4]).ok).toBe(false)
    expect(parseBarInput('Cx7', [4, 4]).ok).toBe(false)
  })

  test('bars are shown back as typed text', () => {
    expect(barToInput([{ symbol: 'D-7', beats: 2 }, { symbol: 'G7', beats: 2 }], [4, 4])).toBe('D-7 G7')
    expect(barToInput([{ symbol: 'C', beats: 3 }, { symbol: 'G7', beats: 1 }], [4, 4])).toBe('C:3 G7:1')
  })
})

describe('editing a chart', () => {
  test('inserting at the end moves the final barline', () => {
    const c = insertBar(emptyChart(), 7)
    expect(c.bars).toHaveLength(9)
    expect(c.bars[7].barline).toBeUndefined()
    expect(c.bars[8].barline).toBe('final')
    expect(deleteBar(c, 8).bars[7].barline).toBe('final')
  })

  test('unset markings are removed from the bar', () => {
    const c = updateBar(updateBar(emptyChart(), 0, { section: 'A' }), 0, { section: undefined })
    expect('section' in c.bars[0]).toBe(false)
  })

  test('changing the meter respreads chord lengths', () => {
    const c = setTime(tune, [3, 4])
    expect(c.bars[4].chords.map((x) => x.beats)).toEqual([2, 1])
  })
})

describe('iReal Pro export', () => {
  test('a chart comes back the same from an irealb link', () => {
    const marked = updateBar(updateBar(updateBar(tune, 0, { section: 'A', repeatStart: true }), 5, { repeatEnd: true }), 6, {
      comment: 'Solos',
    })
    const [list] = parseIrealLinks(irealLink([marked]))
    const back = list.charts[0]
    expect(back).toMatchObject({ title: 'Practice Tune', composer: 'Some Writer', key: 0, bpm: 132, style: 'swing' })
    expect(playbackOrder(back)).toEqual(playbackOrder(marked))
    expect(back.bars.map((b) => b.chords)).toEqual(
      marked.bars.map((b, i) => (b.chords.length || i !== 3 ? b.chords : marked.bars[2].chords)),
    )
    expect(back.bars[6].comment).toBe('Solos')
  })

  test('a blank bar after a one-chord bar is written as a repeat sign', () => {
    expect(chartToMusic(tune)).toContain('|x   |')
  })

  test('several charts make a playlist', () => {
    const [list] = parseIrealLinks(irealLink([tune, { ...tune, title: 'Second' }], 'Set list'))
    expect(list.name).toBe('Set list')
    expect(list.charts.map((c) => c.title)).toEqual(['Practice Tune', 'Second'])
  })
})

describe('practice', () => {
  test('a loop plays only the chosen bars, every chorus', () => {
    const t = buildTimeline(tune, 0, 3, { loop: [4, 5] })
    const measures = t.bars.filter((b) => b.measure >= 0).map((b) => b.measure)
    expect(measures).toEqual([4, 5, 4, 5, 4, 5])
  })

  test('a loop starting on a blank bar plays the chord written before it', () => {
    const t = buildTimeline(tune, 0, 1, { loop: [3, 4] })
    expect(t.slots[0]).toMatchObject({ measure: 3, beats: 4 })
    expect(t.slots[0].chord.quality).toBe('maj7')
  })

  test('cycling keys moves every chorus up a fourth and comes home after 12', () => {
    expect(Array.from({ length: 13 }, (_, c) => (chorusTranspose(0, 5, c) + 12) % 12)).toEqual([
      0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7, 0,
    ])
    const t = buildTimeline(tune, 0, 2, { keyStep: 5 })
    const roots = t.slots.filter((s) => s.measure === 0).map((s) => s.chord.root)
    expect(roots).toEqual([2, 7]) // D-7, then G-7
  })

  test('every style arranges a looped, key-cycling chart', () => {
    for (const id of ['swing', 'swing', 'latin', 'straight pop/rock']) {
      const { midi } = arrange(tune, getStyle(id), 0, 4, { loop: [0, 3], keyStep: 1 })
      expect(midi.length).toBeGreaterThan(100)
    }
  })
})

describe('sections', () => {
  test('each rehearsal mark runs to the bar before the next', () => {
    let c = updateBar(tune, 0, { section: 'A' })
    c = updateBar(c, 4, { section: 'B' })
    expect(sections(c)).toEqual([
      { name: 'A', from: 0, to: 3 },
      { name: 'B', from: 4, to: 7 },
    ])
  })
})

describe('practice changes while the band plays', () => {
  test('a new loop starts over, new keys go on, a tempo ramp only changes the tempo', () => {
    expect(practiceChange(NO_PRACTICE, { ...NO_PRACTICE, loop: [0, 3] })).toBe('loop')
    expect(practiceChange(NO_PRACTICE, { ...NO_PRACTICE, keyStep: 5 })).toBe('keys')
    expect(practiceChange(NO_PRACTICE, { ...NO_PRACTICE, ramp: 4 })).toBe('tempo')
    expect(practiceChange(NO_PRACTICE, { ...NO_PRACTICE })).toBe('none')
  })
  test('going round the keys adds the choruses needed to get back home', () => {
    expect(chorusesForKeys(NO_PRACTICE, { ...NO_PRACTICE, keyStep: 5 }, 1)).toBe(12)
    expect(chorusesForKeys(NO_PRACTICE, { ...NO_PRACTICE, keyStep: 2 }, 1)).toBe(6)
    expect(chorusesForKeys(NO_PRACTICE, { ...NO_PRACTICE, keyStep: 2 }, 8)).toBe(8)
    expect(chorusesForKeys({ ...NO_PRACTICE, keyStep: 5 }, { ...NO_PRACTICE, keyStep: 5, ramp: 2 }, 3)).toBe(3)
  })
})
