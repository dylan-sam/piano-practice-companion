import { describe, expect, test } from 'vitest'
import { arrange } from '../src/engine/arrange'
import { generateDrums } from '../src/engine/drums'
import { toTicks } from '../src/engine/events'
import { DRUM_NOTES } from '../src/styles/drums'
import { buildTimeline } from '../src/engine/timeline'
import { mapStyle } from '../src/formats/ireal'
import { chartFromMeasures } from '../src/music/chart'
import { getStyle, STYLES } from '../src/styles'

const waltz = chartFromMeasures({ title: 'W', style: 'swing', key: 0, bpm: 150, time: [3, 4] }, [
  ['D-7'],
  ['G7'],
  ['C^7'],
  ['A7', 'Ab7'],
])

describe('styles', () => {
  test('every style has a unique id and a 4/4 or 3/4 pattern set', () => {
    expect(new Set(STYLES.map((s) => s.id)).size).toBe(STYLES.length)
    for (const style of STYLES) {
      const comp = style.comp.rhythms
      expect(comp['4'] ?? comp['3'], style.id).toBeDefined()
    }
  })

  test('iReal Pro style names map to the closest style', () => {
    expect(mapStyle('Waltz', [3, 4])).toBe('swing')
    expect(mapStyle('Medium Swing', [3, 4])).toBe('swing')
    expect(mapStyle('Medium Swing')).toBe('swing')
    expect(mapStyle('Samba')).toBe('latin')
    expect(mapStyle('Bossa Nova')).toBe('bossa-nova')
    expect(mapStyle('Funk')).toBe('straight pop/rock')
    expect(mapStyle('Soul')).toBe('straight pop/rock')
    expect(mapStyle('Soul Ballad')).toBe('straight pop/rock')
    expect(mapStyle('Medium Shuffle')).toBe('blues')
    expect(mapStyle('Slow Blues')).toBe('blues')
    expect(mapStyle('Rock Pop')).toBe('straight pop/rock')
    expect(mapStyle('Ballad')).toBe('ballad')
  })

  test('a waltz counts in "1 . . | 1 2 3" and keeps its bars three beats long', () => {
    const timeline = buildTimeline(waltz, 0, 1)
    expect(timeline.countIn).toBe(6)
    expect(timeline.clicks.map((c) => c.count)).toEqual([1, 1, 2, 3])
    expect(timeline.bars.slice(0, 4).map((b) => b.start)).toEqual([6, 9, 12, 15])
    expect(timeline.slots.filter((s) => s.measure === 3).map((s) => s.beats)).toEqual([2, 1])
  })

  test('every style arranges a waltz and a 4/4 tune', () => {
    const fourFour = chartFromMeasures({ title: 'F', style: 'straight pop/rock', key: 7, bpm: 100 }, [['G7'], ['C7', 'C#o7'], ['G7/D'], ['D7']])
    for (const style of STYLES) {
      for (const chart of [waltz, fourFour]) {
        expect(arrange(chart, style, 0, 2).midi.length, style.id).toBeGreaterThan(200)
      }
    }
  })

  test('waltz drums play one groove bar per three-beat bar', () => {
    const timeline = buildTimeline(waltz, 0, 2)
    const style = getStyle('swing')
    const events = generateDrums(timeline.bars, style.drums, style.swing, timeline.clicks)
    const ride = events.filter((e) => e.note === DRUM_NOTES.ride).map((e) => e.tick / toTicks(1))
    // The swing ride is remapped into each three-beat bar.
    for (const bar of timeline.bars.filter((b) => b.measure > 0 && !b.isLast)) {
      const inBar = ride.filter((beat) => beat >= bar.start - 0.1 && beat < bar.start + bar.beats - 0.1)
      expect(inBar, `bar at ${bar.start}`).toHaveLength(5)
    }
  })
})

describe('warm-up', () => {
  test('every style has a warm-up file that selects its instruments', async () => {
    const { warmUpMidi } = await import('../src/engine/warmup')
    for (const style of STYLES) {
      const midi = warmUpMidi(style)
      const hasProgram = (channel: number, program: number) =>
        midi.some((b, i) => b === (0xc0 | channel) && midi[i + 1] === program)
      expect(hasProgram(0, style.bass.program), style.id).toBe(true)
      expect(hasProgram(1, style.comp.program), style.id).toBe(true)
      expect(hasProgram(9, style.drums.kit), style.id).toBe(true)
    }
  })
})
