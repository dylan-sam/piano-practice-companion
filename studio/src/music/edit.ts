// Chart edits used by the editor. Every function returns a new chart.

import { beatsPerBar, evenSplit, type Chart, type ChartBar, type TimeSignature } from './chart'

// A new, empty chart
export function emptyChart(): Chart {
  return {
    format: 'openstand-chart',
    version: 1,
    title: 'Untitled',
    style: 'swing',
    key: 0,
    bpm: 120,
    time: [4, 4],
    bars: Array.from({ length: 8 }, (_, i): ChartBar => ({ chords: [], cells: 4, barline: i === 7 ? 'final' : undefined })),
  }
}

// Time signature in force at a bar
export function timeAt(chart: Chart, index: number): TimeSignature {
  let time = chart.time
  for (let i = 0; i <= index && i < chart.bars.length; i++) time = chart.bars[i].time ?? time
  return time
}

// Drops keys set to undefined/false so saved charts stay small
function tidy(bar: ChartBar): ChartBar {
  const out = { ...bar } as Record<string, unknown>
  for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === false || out[k] === '') delete out[k]
  return out as unknown as ChartBar
}

// Change one bar of a chart
export function updateBar(chart: Chart, index: number, patch: Partial<ChartBar>): Chart {
  const bars = chart.bars.map((b, i) => (i === index ? tidy({ ...b, ...patch }) : b))
  return { ...chart, bars }
}

// A new bar after `index`; the closing barline of the tune moves to the new last bar
export function insertBar(chart: Chart, index: number): Chart {
  const bars = chart.bars.slice()
  const at = Math.min(index + 1, bars.length)
  const isLast = at === bars.length
  const bar: ChartBar = { chords: [], cells: bars[index]?.cells ?? 4 }
  if (isLast && bars.length && bars[bars.length - 1].barline === 'final') {
    bars[bars.length - 1] = tidy({ ...bars[bars.length - 1], barline: undefined })
    bar.barline = 'final'
  }
  bars.splice(at, 0, bar)
  return { ...chart, bars }
}

// Remove one bar of a chart, keeping at least one bar and the final barline
export function deleteBar(chart: Chart, index: number): Chart {
  if (chart.bars.length <= 1) return chart
  const removed = chart.bars[index]
  const bars = chart.bars.filter((_, i) => i !== index)
  // Keep the tune's final barline
  if (removed.barline === 'final' && index === chart.bars.length - 1) {
    bars[bars.length - 1] = { ...bars[bars.length - 1], barline: 'final' }
  }
  return { ...chart, bars }
}

// After a meter change, chord lengths are spread over the new bar length
export function setTime(chart: Chart, time: TimeSignature): Chart {
  const beats = beatsPerBar(time)
  const bars = chart.bars.map((bar, i) => {
    if (i > 0 && underTimeChange(chart, i)) return bar
    const total = bar.chords.reduce((a, c) => a + c.beats, 0)
    if (total === beats || bar.chords.length === 0) return bar
    const split = evenSplit(bar.chords.length, time)
    return { ...bar, chords: bar.chords.map((c, j) => ({ ...c, beats: split[j] })) }
  })
  return { ...chart, time, bars }
}

// Whether a bar falls under a later time signature change rather than the chart's own
function underTimeChange(chart: Chart, index: number): boolean {
  for (let i = 1; i <= index; i++) if (chart.bars[i].time) return true
  return false
}
