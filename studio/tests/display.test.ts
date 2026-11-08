import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { parseChord } from '../src/music/chords'
import { keyChange, romanRoot } from '../src/music/roman'
import { ChordSymbol } from '../src/ui/ChordSymbol'
import { chartFromMeasures } from '../src/music/chart'
import { getStyle } from '../src/styles'
import { Chart } from '../src/ui/Chart'
import { DEFAULT_DISPLAY, displayText, setDisplay } from '../src/ui/display'

/** The aria label (plain spelling) of a chord symbol drawn with some notation. */
const label = (symbol: string, keyPc: number, notation: object) => {
  const html = renderToStaticMarkup(createElement(ChordSymbol, { chord: parseChord(symbol)!, keyPc, notation }))
  return /aria-label="([^"]*)"/.exec(html)?.[1]
}

describe('Roman numerals', () => {
  test('roots are degrees of the major scale of the key, accidental first', () => {
    expect(romanRoot(2, 0)).toEqual({ accidental: '', numeral: 'II' })
    expect(romanRoot(1, 0)).toEqual({ accidental: 'b', numeral: 'II' })
    expect(romanRoot(10, 0)).toEqual({ accidental: 'b', numeral: 'VII' })
    expect(romanRoot(6, 7)).toEqual({ accidental: '', numeral: 'VII' }) // F# in G
    expect(romanRoot(8, 5)).toEqual({ accidental: 'b', numeral: 'III' }) // Ab in F (F minor's III)
  })

  test('a chord keeps its quality and its bass as a degree', () => {
    expect(label('D-7', 0, { romanKey: 0 })).toBe('II-7')
    expect(label('Db7', 0, { romanKey: 0 })).toBe('bII7')
    expect(displayText('G7/B', { ...DEFAULT_DISPLAY, roman: true }, 0)).toBe('V7/VII')
  })

  test('catalog key comments give the key in force', () => {
    expect(keyChange('Key: F:major')).toBe(5)
    expect(keyChange('Key: Bb:minor')).toBe(10)
    expect(keyChange('D.C. al Fine')).toBeNull()
  })
})

describe('minor notation', () => {
  test('minor is a dash or m', () => {
    expect(displayText('D-7', { ...DEFAULT_DISPLAY, minor: 'm' }, 0)).toBe('Dm7')
    expect(displayText('Bb-7', DEFAULT_DISPLAY, 0)).toBe('B♭-7')
    const html = renderToStaticMarkup(createElement(ChordSymbol, { chord: parseChord('D-7')!, keyPc: 0, notation: { minor: 'm' } }))
    expect(html).toContain('class="chord-quality">m7<')
  })
})

describe('charts drawn with the display settings', () => {
  const props = (chart: ReturnType<typeof chartFromMeasures>) => ({
    chart, style: getStyle('swing'), transpose: 0, activeMeasure: null, beatInBar: 0, barBeats: 4,
  })

  test('a repeated bar is drawn as % when the repeat sign is on', () => {
    const chart = chartFromMeasures({ title: 'T', style: 'swing', key: 0, bpm: 100 }, [['C'], ['C'], ['D-7', 'G7'], ['D-7', 'G7']])
    setDisplay({ repeatSign: true })
    const html = renderToStaticMarkup(createElement(Chart, props(chart)))
    expect(html.match(/chord-repeat/g)).toHaveLength(2)
    setDisplay({ repeatSign: false })
    expect(renderToStaticMarkup(createElement(Chart, props(chart)))).not.toContain('chord-repeat')
  })

  test('Roman numerals follow a key change written in a bar comment', () => {
    const chart = chartFromMeasures({ title: 'T', style: 'swing', key: 0, bpm: 100 }, [['G7'], ['C7']])
    chart.bars[1].comment = 'Key: F:major'
    setDisplay({ roman: true })
    const html = renderToStaticMarkup(createElement(Chart, props(chart)))
    expect(html).toContain('aria-label="V7"')
    expect(renderToStaticMarkup(createElement(Chart, { ...props(chart), romanNumerals: false }))).toContain('aria-label="G7"')
    setDisplay({ roman: false })
  })

  test('a key change inside a bar applies from its beat', () => {
    const chart = chartFromMeasures({ title: 'T', style: 'swing', key: 0, bpm: 100 }, [['G7', 'C7']])
    chart.bars[0].keys = [{ beats: 2, key: 5, minor: false }] // F major from beat 3
    setDisplay({ roman: true })
    const html = renderToStaticMarkup(createElement(Chart, props(chart)))
    expect(html.match(/aria-label="V7"/g)).toHaveLength(2) // G7 in C, then C7 in F
    setDisplay({ roman: false })
  })
})

describe('sheet auto-scroller setting', () => {
  test('is on by default and listed only where a whole sheet is read', async () => {
    expect(DEFAULT_DISPLAY.autoScroll).toBe(true)
    const { DisplayOptions } = await import('../src/ui/DisplayMenu')
    expect(renderToStaticMarkup(createElement(DisplayOptions, { autoScroll: true }))).toContain('Sheet auto-scroller On')
    expect(renderToStaticMarkup(createElement(DisplayOptions, { roman: false }))).not.toContain('auto-scroller')
  })
})
