import type { Chart } from './chart'

// A tune can come from ChoCo or from charts stored on this device.
export interface Tune {
  id: string
  chart: Chart
  source: 'choco' | 'example' | 'import' | 'link' | 'own'
  playlist?: string
  addedAt: number
}

export const STARTER: Tune = {
  id: 'starter',
  source: 'example',
  addedAt: 0,
  chart: {
    format: 'openstand-chart', version: 1,
    title: 'Choose a ChoCo score or create a chart',
    style: 'swing', key: 0, bpm: 120, time: [4, 4],
    bars: [{ chords: [{ symbol: null, beats: 4 }], cells: 4, barline: 'final' }],
  },
}
