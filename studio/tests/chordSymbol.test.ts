import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { parseChord } from '../src/music/chords'
import { ChordSymbol } from '../src/ui/ChordSymbol'

// The SMuFL glyphs ChordSymbol draws for the minor and major-seventh markers
const MINOR = ''
const TRIANGLE = ''

/** The quality text a chord symbol is drawn with. */
const quality = (symbol: string) => {
  const html = renderToStaticMarkup(createElement(ChordSymbol, { chord: parseChord(symbol)!, keyPc: 0 }))
  return /class="chord-quality">([^<]*)</.exec(html)?.[1] ?? ''
}

describe('chord symbol markers', () => {
  it('draws minor with a major seventh as minor sign, triangle and 7', () => {
    expect(quality('F-^7')).toBe(MINOR + TRIANGLE + '7')
    expect(quality('F-^9')).toBe(MINOR + TRIANGLE + '9')
  })

  it('keeps the other markers', () => {
    expect(quality('C^7')).toBe(TRIANGLE)
    expect(quality('D-7')).toBe(MINOR + '7')
  })
})
