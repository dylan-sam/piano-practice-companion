import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { Chart } from '../src/ui/Chart'
import { chartFromMeasures } from '../src/music/chart'
import { getStyle } from '../src/styles'

test('blank context chords keep the answer gap distinct and leave playback chords intact', () => {
  const chart = chartFromMeasures(
    { title: 'Exercise', style: 'swing', key: 0, bpm: 100 },
    [['C', 'E-7'], ['D-7', 'G7'], ['F^7']],
  )
  chart.bars[1].chords.forEach((chord) => { chord.hidden = true })
  const props = {
    chart, style: getStyle('swing'), transpose: 0,
    activeMeasure: null, beatInBar: 0, barBeats: 4,
  }
  const concealed = renderToStaticMarkup(createElement(Chart, {
    ...props, concealHidden: true, concealOtherChords: true,
  }))
  expect(concealed.match(/class="chord chord-empty"/g)).toHaveLength(2)
  expect(concealed.match(/class="chord chord-hidden"/g)).toHaveLength(1)
  expect(concealed).not.toContain('aria-label="C"')
  expect(concealed).not.toContain('aria-label="F^7"')
  expect(chart.bars[0].chords[0].symbol).toBe('C')
  const revealed = renderToStaticMarkup(createElement(Chart, props))
  expect(revealed).not.toContain('chord-empty')
  expect(revealed).toContain('aria-label="C"')
})
