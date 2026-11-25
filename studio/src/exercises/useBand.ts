// The band of a sightreading screen: its style, pattern, key, tempo, choruses and Practice
// settings, and how a new song sets them.

import { useState } from 'react'
import type { Chart } from '../music/chart'
import type { SubstitutionId } from '../music/substitutions'
import { NO_PRACTICE, type PracticeSettings } from '../music/practice'
import { STYLES, styleForChart } from '../styles'
import { transposeTo } from '../lessons/lessonLink'
import { transposeFor, type KeyChoice } from './nameProgression'

/** What a lesson step asks of the band for its song (lessonLink.ts): anything left out comes from the song. */
export interface LessonBand<P> {
  style?: string
  pattern?: P
  key?: number // pitch class of the key to play in
  bpm?: number
  subs?: SubstitutionId[] // chord substitutions, played every chorus
}

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

  /**
   * A song goes on the stand: its style (with that style's pattern), its tempo, the chosen key, no
   * Practice; a lesson step can ask for another style, pattern, key or tempo, and substitutions.
   */
  const takeSong = (chart: Chart, lesson: LessonBand<P> = {}) => {
    const style = lesson.style && STYLES.some((item) => item.id === lesson.style) ? lesson.style : styleForChart(chart)
    set({
      styleId: style, patternId: lesson.pattern ?? defaultPattern(style),
      transpose: transposeTo(chart.key, lesson.key) ?? transposeFor(keyChoice, chart),
      practice: lesson.subs?.length ? { ...NO_PRACTICE, subs: { ids: lesson.subs, when: { kind: 'always' }, seed: 1 } } : NO_PRACTICE,
    })
    setBpm(Math.max(bpmRange[0], Math.min(bpmRange[1], lesson.bpm ?? chart.bpm)))
  }

  return {
    styleId, patternId, keyChoice, setKeyChoice, transpose, setTranspose, bpm, setBpm, choruses, setChoruses,
    practice, setPractice, set, takeSong,
  }
}
