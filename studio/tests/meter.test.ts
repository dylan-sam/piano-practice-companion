import { describe, expect, test } from 'vitest'
import { arrange } from '../src/engine/arrange'
import { generateBass } from '../src/engine/bass'
import { generateComp, pedalChanges } from '../src/engine/comp'
import { generateDrums } from '../src/engine/drums'
import { PPQ, type NoteEvent } from '../src/engine/events'
import { beatMap, remap } from '../src/engine/meter'
import { buildTimeline, type Timeline } from '../src/engine/timeline'
import { chartFromMeasures, evenSplit, isCompound, type TimeSignature } from '../src/music/chart'
import { getStyle, STYLES } from '../src/styles'
import { compoundStyle } from '../src/styles/compound'
import { EXAMPLES } from './fixtures/songs'
import { DRUM_NOTES } from '../src/styles/drums'

const tune = (time: TimeSignature, style = 'straight pop/rock') =>
  chartFromMeasures({ title: 'T', style, key: 0, bpm: 120, time }, [
    ['C^7'],
    ['D-7', 'G7'],
    ['E-7'],
    ['A7'],
    ['D-7'],
    ['G7'],
    ['C^7'],
    ['C^7'],
  ])

// Onsets within each played bar, in beats, before humanizing (rounded to the nearest 16th)
function onsets(events: NoteEvent[], timeline: Timeline, filter: (e: NoteEvent) => boolean = () => true): number[][] {
  return timeline.bars.map((bar) =>
    events
      .filter(filter)
      .map((e) => e.tick / PPQ - bar.start)
      .filter((at) => at > -0.1 && at < bar.beats - 0.1)
      .map((at) => Math.round(at * 4) / 4),
  )
}

describe('meters', () => {
  test('6/8, 9/8 and 12/8 are compound; 3/4 and 3/8 are not', () => {
    expect(
      [
        [6, 8],
        [9, 8],
        [12, 8],
      ].map((t) => isCompound(t as TimeSignature)),
    ).toEqual([true, true, true])
    expect(
      [
        [3, 4],
        [3, 8],
        [4, 4],
        [6, 4],
      ].map((t) => isCompound(t as TimeSignature)),
    ).toEqual([false, false, false, false])
  })

  test('two chords share a 3/4 bar 2+1 and a 6/8 bar a pulse each', () => {
    expect(evenSplit(2, [3, 4])).toEqual([2, 1])
    expect(evenSplit(2, [6, 8])).toEqual([1.5, 1.5])
    expect(evenSplit(2, [12, 8])).toEqual([3, 3])
  })

  test('a 4/4 pattern in 3/4 plays beats 1, 2 and 4', () => {
    expect(beatMap(4, 3)).toEqual([0, 1, 3])
    expect(beatMap(4, 4)).toEqual([0, 1, 2, 3])
    const rock = [0, 1, 2, 3].map((at) => ({ at, dur: 0.5, drum: at % 2 ? 'snare' : 'kick' }))
    expect(remap(rock, 4, 3).map((n) => `${n.at}${n.drum}`)).toEqual(['0kick', '1snare', '2snare'])
  })

  test('a rock beat in 3/4 is boom-chick-chick, every bar', () => {
    const chart = tune([3, 4])
    const timeline = buildTimeline(chart, 0, 1)
    const style = getStyle('straight pop/rock')
    const drums = generateDrums(timeline.bars, style.drums, style.swing, timeline.clicks)
    const snare = onsets(drums, timeline, (e) => e.note === DRUM_NOTES.snare)
    const kick = onsets(drums, timeline, (e) => e.note === DRUM_NOTES.kick)
    for (const [i, bar] of timeline.bars.entries()) {
      if (bar.measure <= 0 || bar.isLast) continue
      expect(kick[i], `bar ${i}`).toContain(0)
      expect(
        snare[i].filter((at) => Number.isInteger(at)),
        `bar ${i}`,
      ).toEqual(expect.arrayContaining([1, 2]))
      expect(Math.max(...kick[i], ...snare[i])).toBeLessThan(3)
    }
  })

  test('every style plays more than one comp hit in some 3/4 bars', () => {
    const chart = tune([3, 4])
    for (const style of STYLES) {
      const timeline = buildTimeline(chart, 0, 4)
      const comp = generateComp(timeline.slots, style.comp, style.swing, timeline.countIn)
      const perBar = onsets(comp, timeline).map((bar) => new Set(bar).size)
      expect(Math.max(...perBar), style.id).toBeGreaterThan(1)
    }
  })

  test('the count-in follows the meter', () => {
    // > starts a bar, + a beat or pulse, plain is an eighth in between
    const counts = (time: TimeSignature) => {
      const { clicks, countIn } = buildTimeline(tune(time), 0, 1)
      const mark = { bar: '>', beat: '+', sub: '' }
      return `${countIn}: ${clicks.map((c) => `${mark[c.level]}${c.count}@${c.at}`).join(' ')}`
    }
    expect(counts([4, 4])).toBe('8: >1@0 +2@2 >1@4 +2@5 +3@6 +4@7')
    expect(counts([3, 4])).toBe('6: >1@0 >1@3 +2@4 +3@5')
    expect(counts([2, 4])).toBe('4: >1@0 +2@1 >1@2 +2@3')
    expect(counts([6, 8])).toBe('6: >1@0 +2@1.5 >1@3 2@3.5 3@4 +4@4.5 5@5 6@5.5')
    expect(counts([12, 8])).toBe('6: >1@0 1@0.5 1@1 +2@1.5 2@2 2@2.5 +3@3 3@3.5 3@4 +4@4.5 4@5 4@5.5')
    expect(counts([5, 4])).toBe('5: >1@0 2@1 3@2 +4@3 5@4')
  })

  test('6/8 counts in on its pulses, then its eighths, and the bars are 6/8 bars', () => {
    const timeline = buildTimeline(tune([6, 8]), 0, 1)
    expect(timeline.bars.every((b) => b.compound && b.beats === 3)).toBe(true)
    const style = compoundStyle(getStyle('swing'))
    const drums = generateDrums(timeline.bars, style.drums, style.swing, timeline.clicks)
    const countIn = drums.filter((e) => e.tick < 6 * PPQ - 20).map((e) => Math.round((e.tick / PPQ) * 4) / 4)
    expect(countIn).toEqual([0, 1.5, 3, 3.5, 4, 4.5, 5, 5.5])
    expect(drums.filter((e) => e.tick < 6 * PPQ - 20).every((e) => e.note === DRUM_NOTES.sidestick)).toBe(true)
  })

  test('in 6/8 every style plays straight eighths, with the bass on the pulses', () => {
    const chart = tune([6, 8])
    for (const base of STYLES) {
      const { midi, timeline } = arrange(chart, base, 0, 2)
      expect(midi.length, base.id).toBeGreaterThan(200)
      const style = compoundStyle(base)
      const parts = [
        generateDrums(timeline.bars, base.drums, base.swing, timeline.clicks, style.drums),
        generateComp(timeline.slots, base.comp, base.swing, timeline.countIn, style.comp),
        generateBass(timeline.slots, base.bass, base.swing, style.bass),
      ]
      for (const part of parts) {
        // Nothing lands on a swung eighth: every onset is within humanizing range of the eighth grid
        for (const e of part) {
          const eighths = e.tick / (PPQ / 2)
          expect(Math.abs(eighths - Math.round(eighths)), `${base.id} at ${e.tick / PPQ}`).toBeLessThan(0.05)
        }
      }
      const bass = onsets(parts[2], timeline)
      for (const bar of bass) if (bar.length) expect(Math.abs(bar[0]), base.id).toBe(0)
    }
  })

  test('a 6/8 tune with two chords in a bar changes chord on the second pulse', () => {
    const timeline = buildTimeline(tune([6, 8]), 0, 1)
    const bar = timeline.slots.filter((s) => s.measure === 1)
    expect(bar.map((s) => s.beats)).toEqual([1.5, 1.5])
    const style = compoundStyle(getStyle('straight pop/rock'))
    const bass = generateBass(bar, style.bass, 0.5)
    const starts = bass.map((e) => Math.round((e.tick / PPQ - bar[0].start) * 4) / 4)
    expect(starts).toContain(0)
    expect(starts).toContain(1.5)
  })

  test('the ending lasts a bar of the tune’s meter', () => {
    for (const [time, beats] of [
      [[3, 4], 3],
      [[4, 4], 4],
      [[6, 8], 3],
      [[2, 4], 4],
    ] as [TimeSignature, number][]) {
      const timeline = buildTimeline(tune(time), 0, 1)
      expect(timeline.bars.at(-1)?.beats, time.join('/')).toBe(beats)
    }
  })

  test('5/4 and 12/8 arrange with every style', () => {
    for (const style of STYLES) {
      for (const time of [
        [5, 4],
        [12, 8],
        [6, 4],
      ] as TimeSignature[]) {
        expect(arrange(tune(time), style, 0, 1).midi.length, `${style.id} ${time.join('/')}`).toBeGreaterThan(200)
      }
    }
  })
})

describe('example tunes', () => {
  test('come in several meters and each plays with its own style', () => {
    const meters = new Set(EXAMPLES.map((t) => t.chart.time.join('/')))
    for (const m of ['4/4', '3/4', '6/8', '12/8', '5/4']) expect(meters, m).toContain(m)
    for (const { id, chart } of EXAMPLES) {
      const { timeline } = arrange(chart, getStyle(chart.style), 0, 1)
      const written = chart.bars.map((b) => b.chords.reduce((a, c) => a + c.beats, 0))
      expect(new Set(written).size, id).toBe(1)
      expect(timeline.bars.length, id).toBe(chart.bars.length + 1)
    }
  })
})

describe('the first and last bars', () => {
  test('in 6/8 and 12/8 the opening bar keeps the full hi-hat, with the crash on the downbeat only', () => {
    for (const id of ['ballad-68-c', 'slow-blues-128-g']) {
      const chart = EXAMPLES.find((t) => t.id === id)!.chart
      const base = getStyle(chart.style)
      const timeline = buildTimeline(chart, 0, 1)
      const drums = generateDrums(timeline.bars, base.drums, base.swing, timeline.clicks, compoundStyle(base).drums)
      const [first] = onsets(drums, timeline, (e) => e.note === DRUM_NOTES.hhClosed || e.note === DRUM_NOTES.crash)
      const eighths = Array.from({ length: timeline.bars[0].beats * 2 }, (_, i) => i / 2)
      expect(new Set(first.map((at) => Math.round(at * 2) / 2)), id).toEqual(new Set(eighths))
      const crashes = onsets(drums, timeline, (e) => e.note === DRUM_NOTES.crash)[0]
      expect(
        crashes.map((at) => Math.abs(Math.round(at))),
        id,
      ).toEqual([0])
    }
  })
})

describe('smooth chord changes', () => {
  test('the piano pedal is lifted as each chord sounds and pressed just after', () => {
    const chart = EXAMPLES.find((t) => t.id === 'ballad-eb')!.chart
    const style = getStyle('ballad')
    const timeline = buildTimeline(chart, 0, 1)
    const comp = generateComp(timeline.slots, style.comp, style.swing, timeline.countIn)
    const pedal = pedalChanges(comp, timeline.slots)
    const ups = pedal.filter((p) => p.value === 0)
    const downs = pedal.filter((p) => p.value === 127)
    expect(downs.length).toBeGreaterThan(timeline.slots.length - 3)
    // Every press comes shortly after a lift
    for (const down of downs) expect(ups.some((up) => up.tick < down.tick && down.tick - up.tick < PPQ / 4)).toBe(true)
    expect(pedal.at(-1)?.value).toBe(0)
    expect(style.comp.pedal).toBe(true)
    expect(getStyle('swing').comp.pedal).toBeFalsy()
  })

  test('the top voice of the comp moves by small steps', () => {
    const chart = EXAMPLES.find((t) => t.id === 'ii-v-i-c')!.chart
    const style = getStyle('swing')
    let total = 0
    let changes = 0
    for (let run = 0; run < 10; run++) {
      const timeline = buildTimeline(chart, 0, 1)
      const comp = generateComp(timeline.slots, style.comp, style.swing, timeline.countIn)
      const tops = timeline.slots
        .filter((s) => s.measure >= 0)
        .map((s) =>
          Math.max(...comp.filter((e) => e.tick >= (s.start - 0.6) * PPQ && e.tick < (s.start + s.beats - 0.6) * PPQ).map((e) => e.note)),
        )
        .filter(Number.isFinite)
      for (let i = 1; i < tops.length; i++) {
        total += Math.abs(tops[i] - tops[i - 1])
        changes++
      }
    }
    expect(total / changes).toBeLessThan(3)
  })
})
