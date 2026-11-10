// The band of a sightreading screen: its style, pattern, key, tempo, choruses and Practice
// settings, and how a new song sets them.

import { useState } from 'react'
import type { Chart } from '../music/chart'
import { NO_PRACTICE, type PracticeSettings } from '../music/practice'
import { transposeFor, type KeyChoice } from './nameProgression'

/** What the band plays a song with (all but the tempo, which only changes the playback rate). */
export interface BandChoice<P> {
  styleId: string
  patternId: P
  transpose: number
  choruses: number
  practice: PracticeSettings
}

/**
 * The band's settings. `defaultPattern` gives a style's pattern (piano or bass); `bpmRange` bounds
 * the tempo a song brings.
 */
export function useBand<P>(defaultPattern: (styleId: string) => P, bpmRange: [number, number]) {
  const [styleId, setStyleId] = useState('swing')
  const [patternId, setPatternId] = useState<P>(() => defaultPattern('swing'))
  const [keyChoice, setKeyChoice] = useState<KeyChoice>('song')
  const [transpose, setTranspose] = useState(0)
  const [bpm, setBpm] = useState(100)
  const [choruses, setChoruses] = useState(1)
  const [practice, setPractice] = useState<PracticeSettings>(NO_PRACTICE)

  /** Change some of the band's choices; returns them all, for arranging at once. */
  const set = (change: Partial<BandChoice<P>>): BandChoice<P> => {
    const next = { styleId, patternId, transpose, choruses, practice, ...change }
    setStyleId(next.styleId)
    setPatternId(next.patternId)
    setTranspose(next.transpose)
    setChoruses(next.choruses)
    setPractice(next.practice)
    return next
  }

  /** A song goes on the stand: its style (with that style's pattern), its tempo, the chosen key, no Practice. */
  const takeSong = (chart: Chart) => {
    set({ styleId: chart.style, patternId: defaultPattern(chart.style), transpose: transposeFor(keyChoice, chart), practice: NO_PRACTICE })
    setBpm(Math.max(bpmRange[0], Math.min(bpmRange[1], chart.bpm)))
  }

  return {
    styleId, patternId, keyChoice, setKeyChoice, transpose, setTranspose, bpm, setBpm, choruses, setChoruses,
    practice, setPractice, set, takeSong,
  }
}
