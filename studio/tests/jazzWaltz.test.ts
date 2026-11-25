import { describe, expect, test } from 'vitest'
import { arrange, CHANNELS } from '../src/engine/arrange'
import { PPQ } from '../src/engine/events'
import { patternsForStyle } from '../src/engine/pianoPatterns'
import { mapStyle } from '../src/formats/ireal'
import { chartFromMeasures, type TimeSignature } from '../src/music/chart'
import { getStyle, styleForChart } from '../src/styles'

const waltz = (time: TimeSignature = [3, 4]) =>
  chartFromMeasures({ title: 'W', style: 'swing', key: 0, bpm: 150, time }, [['C^7'], ['A-7'], ['D-7'], ['G7']])

/** The beats in their bar (0, 1, 2) where a channel starts notes, after the count-in, rounded to an eighth. */
function beatsOf(events: { tick: number; channel: number }[], channel: number, countIn: number): Set<number> {
  return new Set(events.filter((e) => e.channel === channel && e.tick / PPQ >= countIn - 0.3)
    .map((e) => Math.round((((e.tick / PPQ - countIn) % 3) + 3) % 3 * 2) / 2 % 3))
}

describe('Jazz Waltz', () => {
  test('a song in 3/4 starts as a Jazz Waltz, other songs keep their style', () => {
    expect(styleForChart(waltz())).toBe('jazz-waltz')
    expect(styleForChart({ ...waltz(), style: 'ballad' })).toBe('jazz-waltz')
    expect(styleForChart(waltz([4, 4]))).toBe('swing')
    expect(styleForChart(waltz([6, 8]))).toBe('swing')
    expect(mapStyle('Jazz Waltz', [3, 4])).toBe('jazz-waltz')
    expect(mapStyle('Medium Swing', [4, 4])).toBe('swing')
  })

  test('bass on 1, chords on 2 and 3: rootless chords on 2 and 3 over a held root on 1', () => {
    expect(patternsForStyle('jazz-waltz').map((p) => p.id)).toEqual(['jazz_waltz_two_three'])
    const { timeline, tracks } = arrange(waltz(), getStyle('jazz-waltz'), 0, 2, {}, 'jazz_waltz_two_three')
    const events = tracks.flatMap((t) => t.events)
    const body = events.filter((e) => e.tick / PPQ < timeline.bars.at(-1)!.start)
    expect([...beatsOf(body, CHANNELS.comp, timeline.countIn)].sort()).toEqual([1, 2])
    expect([...beatsOf(body, CHANNELS.bass, timeline.countIn)]).toEqual([0])
  })

  test('the chord comping varies Kelly\'s figures, on the beats and the off-beats', () => {
    const { timeline, tracks } = arrange(waltz(), getStyle('jazz-waltz'), 0, 8)
    const comp = beatsOf(tracks.flatMap((t) => t.events), CHANNELS.comp, timeline.countIn)
    expect(comp.size).toBeGreaterThanOrEqual(4)
  })
})
