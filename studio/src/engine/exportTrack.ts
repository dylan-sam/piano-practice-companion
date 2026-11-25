// The band's track as a file to download (Chord Player and Lead Sheet Player > Export): the song
// as it is played now, with its style, piano pattern, choruses, practice loop, keys and speed-up,
// and the mixer's parts (a muted part is left out). Ideas from OpenStand (#1, #70, #122, #126).

import type { Chart } from '../music/chart'
import { keyPrefersFlats, noteName } from '../music/chords'
import { BPM_RANGE, practiceOptions, rampedBpm, type PracticeSettings } from '../music/practice'
import type { StyleDefinition } from '../styles/types'
import { arrange, CHANNELS, type Part } from './arrange'
import { toTicks } from './events'
import { writeMidi, type Conductor } from './midiWriter'
import type { Timeline } from './timeline'

/** What the band plays: the same choices as the player's Play button, and the mixer's mutes. */
export interface TrackRequest {
  chart: Chart
  style: StyleDefinition
  patternId: string | null
  transpose: number
  choruses: number
  practice: PracticeSettings
  bpm: number
  muted: Record<Part, boolean>
}

/** The time signature of a bar played in `beats` quarter notes: 3/4, or 6/8 and 7/8 in eighths. */
function meterOf(bar: { beats: number; compound?: boolean }): { numerator: number; denominator: 4 | 8 } {
  return bar.compound || !Number.isInteger(bar.beats)
    ? { numerator: Math.round(bar.beats * 2), denominator: 8 }
    : { numerator: bar.beats, denominator: 4 }
}

/**
 * The tempo and meter changes of a played song: its tempo, faster each chorus with Practice's
 * speed-up (as the player plays it), and a time signature wherever the meter changes.
 */
export function conductorFor(timeline: Timeline, bpm: number, practice: PracticeSettings): Conductor {
  const tempos: Conductor['tempos'] = [{ tick: 0, bpm: rampedBpm(bpm, practice, 0, BPM_RANGE) }]
  const meters: Conductor['meters'] = []
  for (const bar of timeline.bars) {
    const tick = toTicks(bar.start)
    const tempo = rampedBpm(bpm, practice, bar.chorus, BPM_RANGE)
    if (tempo !== tempos.at(-1)!.bpm) tempos.push({ tick, bpm: tempo })
    const meter = meterOf(bar)
    const last = meters.at(-1)
    if (!last || last.numerator !== meter.numerator || last.denominator !== meter.denominator) {
      meters.push({ tick: meters.length ? tick : 0, ...meter }) // the first meter also covers the count-in
    }
  }
  return { tempos, meters: meters.length ? meters : [{ tick: 0, numerator: 4, denominator: 4 }] }
}

/** The mixer part a MIDI channel belongs to. */
function partOf(channel: number): Part | undefined {
  return (Object.keys(CHANNELS) as Part[]).find((part) => CHANNELS[part] === channel)
}

/** The band's track as a standard MIDI file at its real tempo, without the muted parts. */
export function exportMidi(request: TrackRequest): Uint8Array {
  const { chart, style, patternId, transpose, choruses, practice, bpm, muted } = request
  const { timeline, tracks } = arrange(chart, style, transpose, choruses, practiceOptions(practice), patternId)
  const heard = tracks.filter((track) => {
    const part = partOf(track.channel)
    return !part || !muted[part]
  })
  return writeMidi(bpm, heard, conductorFor(timeline, bpm, practice))
}

/** A file name for the track: the title, the key it starts in and the tempo ("Autumn Leaves - Gm - 140 bpm.mid"). */
export function trackFilename(chart: Chart, transpose: number, bpm: number, extension: string): string {
  // No control characters, nor the characters file systems refuse
  const title = Array.from(chart.title, (c) => (c < ' ' ? ' ' : c)).join('').replace(/[<>:"/\\|?*]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Song'
  const keyPc = (((chart.key + transpose) % 12) + 12) % 12
  const key = noteName(keyPc, keyPrefersFlats(keyPc)) + (chart.minor ? 'm' : '')
  return `${title} - ${key} - ${bpm} bpm.${extension}`
}
