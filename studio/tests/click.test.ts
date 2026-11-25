import { describe, expect, test } from 'vitest'
import { CLICK_CHANNEL, clickBeats, generateClicks } from '../src/engine/click'
import { PPQ } from '../src/engine/events'
import { gsRhythmPart } from '../src/engine/midiWriter'
import { buildTimeline } from '../src/engine/timeline'
import { chartFromMeasures, type TimeSignature } from '../src/music/chart'

// A four-bar chart in the given meter
function chartIn(time: TimeSignature) {
  return chartFromMeasures({ title: 'T', style: 'swing', key: 0, bpm: 120, time }, [['C'], ['F'], ['G'], ['C']])
}

describe('metronome click', () => {
  test('clicks every beat, or every dotted quarter in compound meters', () => {
    expect(clickBeats({ beats: 4 })).toEqual([0, 1, 2, 3])
    expect(clickBeats({ beats: 3 })).toEqual([0, 1, 2])
    expect(clickBeats({ beats: 3, compound: true })).toEqual([0, 1.5])
  })

  test('accents each downbeat of the song, on its own channel', () => {
    const timeline = buildTimeline(chartIn([3, 4]), 0, 1)
    const clicks = generateClicks(timeline)
    expect(clicks).toHaveLength(12)
    expect(clicks.every((click) => click.channel === CLICK_CHANNEL)).toBe(true)
    const accents = clicks.filter((click) => click.note === 34).map((click) => click.tick)
    const firstBar = timeline.bars.find((bar) => bar.measure === 0)!
    expect(accents[0]).toBe(Math.round(firstBar.start * PPQ))
    expect(accents[1] - accents[0]).toBe(3 * PPQ)
  })

  test('the GS rhythm-part message is well formed', () => {
    // Channel 5 (index 4) is GS part 5: F0 len 41 10 42 12 40 15 15 01 checksum F7
    const bytes = gsRhythmPart(4)
    expect(bytes.slice(0, 2)).toEqual([0xf0, 10])
    expect(bytes.slice(2, 10)).toEqual([0x41, 0x10, 0x42, 0x12, 0x40, 0x15, 0x15, 0x01])
    const sum = bytes.slice(6, 11).reduce((total, byte) => total + byte, 0)
    expect(sum & 0x7f).toBe(0)
    expect(bytes.at(-1)).toBe(0xf7)
  })
})
