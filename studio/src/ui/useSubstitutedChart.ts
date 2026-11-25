// The sheet as the band plays it: the chart of the chorus playing (the first one when stopped),
// with the Substitutions menu's chords in place of the written ones (drawn in a colour).

import { useMemo } from 'react'
import type { Chart } from '../music/chart'
import { substituteChart, type SubstitutionSettings } from '../music/substitutions'

/** The chart to draw: substituted for `chorus` while playing, for the first chorus otherwise. */
export function useSubstitutedChart<C extends Chart | null | undefined>(chart: C, subs: SubstitutionSettings | undefined,
  playing: boolean, chorus: number): C {
  return useMemo(() => (chart ? substituteChart(chart, subs, playing ? chorus : 0) : chart) as C, [chart, subs, playing, chorus])
}
