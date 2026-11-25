// The chord helper's state, shared by the screens with a sheet (players, Free Improvisation): open
// or closed (a tap on a chord, or the Chords button), the chord shown, Follow the chord playing,
// Show more scales, and the bar's chords and key as the band plays them.

import { useCallback, useMemo, useState } from 'react'
import { chorusKeyOffset } from '../engine/keyOrder'
import { buildTimeline, chordsOfBar, type PracticeOptions } from '../engine/timeline'
import { substituteChart } from '../music/substitutions'
import { loadJson, saveJson } from '../library/storage'
import type { Chart } from '../music/chart'
import { barKeyCentres, type KeyCentre } from '../music/roman'

/** A chord of the sheet: a written bar and the chord in it (0 for a bar of a lead sheet). */
export interface HelperPlace { measure: number; chordIndex: number }

// Follow the chord playing: on by default, kept between visits
const FOLLOW_KEY = 'eartraining:chord-helper-follow'
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

/** The written chord of a bar sounding at a beat of the bar (the last chord started by then). */
function chordIndexAt(chart: Chart, measure: number, beatInBar: number): number {
  let at = 0
  let index = 0
  for (const [i, chord] of (chart.bars[measure]?.chords ?? []).entries()) {
    if (at > beatInBar + 1e-6) break
    index = i
    at += chord.beats
  }
  return index
}

// No key changes or substitutions (one object, so the helper's chords are not worked out again each draw)
const SAME_KEYS = {}

/** The first bar of a chart that has a chord written. */
const firstChordBar = (chart: Chart) => Math.max(0, chart.bars.findIndex((bar) => bar.chords.length > 0))

/**
 * The helper of a sheet. `sounding` is where the band is (playing or paused), for Follow the
 * chord playing; `chorus` the chorus playing (its key with Practice > Keys, its substitutions); `keys` the written key
 * of each bar when the screen knows better than the chart (a lesson map's key passages).
 */
export function useChordHelper({ chart, transpose, choruses = 1, keyPlan = SAME_KEYS, chorus = 0, keys, sounding = null }: {
  chart: Chart | null
  transpose: number
  choruses?: number
  keyPlan?: Pick<PracticeOptions, 'keyStep' | 'randomKeys' | 'subs'> // the keys and substitutions of the choruses
  chorus?: number
  keys?: KeyCentre[]
  sounding?: { measure: number; beatInBar: number } | null
}) {
  const [visible, setVisible] = useState(false)
  const [tapped, setTapped] = useState<HelperPlace | null>(null)
  const [follow, setFollowState] = useState(() => loadJson(FOLLOW_KEY, true, isBoolean))
  const [more, setMore] = useState(false) // Show more scales

  // The chord sounding, counted in the chart of the chorus playing (a substitution can split a chord)
  const soundingPlace = chart && sounding && sounding.measure >= 0 && sounding.measure < chart.bars.length
    ? { measure: sounding.measure, chordIndex: chordIndexAt(substituteChart(chart, keyPlan.subs, chorus), sounding.measure, sounding.beatInBar) } : null

  const onAChord = !!soundingPlace
  /** Show a chord (a tap on the sheet or a tab); a tap while the band is on a chord stops following it. */
  const open = useCallback((measure: number, chordIndex = 0) => {
    setTapped({ measure, chordIndex })
    setVisible(true)
    if (onAChord) {
      setFollowState(false)
      saveJson(FOLLOW_KEY, false)
    }
  }, [onAChord])
  const close = useCallback(() => setVisible(false), [])
  /** The Chords button: open on the chord playing (or the one last shown), or close. */
  const toggle = useCallback(() => setVisible((shown) => !shown), [])
  const setFollow = useCallback((on: boolean) => {
    setFollowState(on)
    saveJson(FOLLOW_KEY, on)
  }, [])

  const place = !chart ? null
    : follow && soundingPlace ? soundingPlace
      : tapped && tapped.measure < chart.bars.length ? tapped
        : soundingPlace ?? { measure: firstChordBar(chart), chordIndex: 0 }
  // The place by value: a new object each draw is the same place
  const measure = place?.measure ?? -1
  const chordIndex = place?.chordIndex ?? 0
  const shown = useMemo(() => {
    if (!visible || !chart || measure < 0) return null
    // The whole song, loop or not: the chords of any bar can be looked at
    const timeline = buildTimeline(chart, transpose, Math.max(choruses, chorus + 1), { ...keyPlan, countIn: false, ending: false })
    const written = (keys ?? barKeyCentres(chart))[measure] ?? { tonic: chart.key, minor: !!chart.minor }
    const keyCentre: KeyCentre = { tonic: (written.tonic + chorusKeyOffset(keyPlan, chorus, transpose) + 12) % 12, minor: written.minor }
    return { place: { measure, chordIndex }, chords: chordsOfBar(timeline, measure, chorus), keyCentre }
  }, [visible, measure, chordIndex, chart, transpose, choruses, keyPlan, chorus, keys])
  return { shown, visible, open, close, toggle, follow, setFollow, more, setMore }
}
