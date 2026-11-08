import { describe, expect, test } from 'vitest'
import { abcChord, parseAbcBook } from '../src/formats/abcImport'
import { barMeters, type Chart } from '../src/music/chart'
import { melodyToAbc } from '../src/music/abc'
import { DEFAULT_DISPLAY } from '../src/ui/display'

/** Read one ABC tune into a chart. */
function tune(body: string, header = 'M:6/8\nL:1/8\nK:G'): Chart {
  const [result] = parseAbcBook(`X:1\nT:Test\n${header}\n${body}\n`, { style: 'straight pop/rock', source: 'test' })
  if (!result.chart) throw new Error(result.error)
  return result.chart
}
const notes = (c: Chart) => c.melody!.notes.map((n) => [n.bar, n.at, n.beats, n.pitch])

describe('ABC chords', () => {
  test('qualities, slash basses in ABC style, optional and placed chords', () => {
    expect(abcChord('Em')).toEqual({ symbol: 'E-' })
    expect(abcChord('D/f+')).toEqual({ symbol: 'D/F#' })
    expect(abcChord('Gm/b-')).toEqual({ symbol: 'G-/Bb' })
    expect(abcChord('(A7)')).toEqual({ symbol: 'A7' })
    expect(abcChord('/@<.5D7')).toEqual({ symbol: 'D7' })
    expect(abcChord('G/dim')).toEqual({ symbol: 'Go' })
    expect(abcChord('E7/b9')).toEqual({ symbol: 'E7b9' })
    expect(abcChord('f#')).toEqual({ bass: 'F#' })
  })

  test('words and part orders are not chords', () => {
    expect(abcChord('AAAABB')).toBeNull()
    expect(abcChord('C  drone')).toBeNull()
    expect(abcChord('From A.Train')).toBeNull()
  })
})

describe('ABC tunes', () => {
  test('a pickup and the bar completing it keep their lengths; the meter goes on', () => {
    const c = tune('d|"G"g2g B2B|"D"A3 A2:|')
    expect(c.bars.map((b) => [b.partial ?? false, b.time ?? null])).toEqual([[true, [1, 8]], [false, null], [true, [5, 8]]])
    expect(barMeters(c).map((m) => m.beats)).toEqual([0.5, 3, 2.5])
    expect(c.bars[2].repeatEnd).toBe(true)
  })

  test('pitches follow the key signature, bar accidentals and ties over the bar line', () => {
    // In G, f is F#; =f is F natural for the rest of the bar; a tied note keeps its pitch
    const c = tune('"G"f=fF f3-|"D"f6|')
    expect(notes(c)).toEqual([[0, 0, 0.5, 78], [0, 0.5, 0.5, 77], [0, 1, 0.5, 66], [0, 1.5, 4.5, 77]])
  })

  test('triplets and broken rhythm', () => {
    const c = tune('"C"(3cde c>d c2|', 'M:2/4\nL:1/8\nK:C')
    expect(notes(c).map((n) => [n[1], n[2]])).toEqual([[0, 1 / 3], [1 / 3, 1 / 3], [2 / 3, 1 / 3], [1, 0.75], [1.75, 0.25], [2, 1]].map(([a, b]) => [Math.round(a * 960) / 960, Math.round(b * 960) / 960]))
  })

  test('a bass note alone completes the chord at the same note, or changes the bass later', () => {
    const c = tune('"D""a"d2d "e"d2d|', 'M:6/8\nL:1/8\nK:D')
    expect(c.bars[0].chords).toEqual([{ symbol: 'D/A', beats: 1.5 }, { symbol: 'D/E', beats: 1.5 }])
  })

  test('a part order is written out; key changes change the key signature', () => {
    const c = tune('P:A\n"G"G6|G6|\nP:B\nK:D\n"D"F6|F6|', 'M:6/8\nL:1/8\nP:AAB\nK:G')
    expect(c.bars.map((b) => [b.section ?? '', !!b.repeatStart, !!b.repeatEnd])).toEqual(
      [['A', true, false], ['', false, true], ['B', false, false], ['', false, false]])
    expect(c.bars[2].keys).toEqual([{ beats: 0, key: 2, minor: false }])
    expect(melodyToAbc(c, 0, DEFAULT_DISPLAY).abc).toContain('[K:D]')
  })

  test('two chords over one note share it', () => {
    const c = tune('"C""G7"c8|', 'M:4/4\nL:1/8\nK:C')
    expect(c.bars[0].chords).toEqual([{ symbol: 'C', beats: 2 }, { symbol: 'G7', beats: 2 }])
  })
})

describe('part orders', () => {
  test('letters, repeated groups, remarks and codes', async () => {
    const { partPlan } = await import('../src/formats/abcImport')
    expect(partPlan('AABA')).toBe('AABA')
    expect(partPlan('A(AB)4')).toBe('AABABABAB')
    expect(partPlan('A(ABB) times 4')).toBe('AABBABBABBABB')
    expect(partPlan('AABA last time only')).toBe('AABA')
    expect(partPlan('/f2AABA last time through/fP')).toBe('AABA')
    expect(partPlan('Play AABA last time')).toBe('AABA')
    expect(partPlan('A(acc) A(unacc)')).toBe('AA')
  })
})
