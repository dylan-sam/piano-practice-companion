import type { Chart } from './chart'

// A tune can come from ChoCo or from charts stored on this device.
export interface Tune {
  id: string
  chart: Chart
  // bundled: read-only test lead sheets served with a local build (studio/public/leadsheets/)
  source: 'choco' | 'example' | 'import' | 'link' | 'own' | 'bundled'
  playlist?: string
  addedAt: number
}

/** Whether a tune is kept in this browser (and can be saved over, deleted and exported). */
export const isSavedTune = (tune: Tune): boolean =>
  tune.source !== 'choco' && tune.source !== 'example' && tune.source !== 'bundled'

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
