// Free Improvisation: the keys played over the band, written out as a line on the chart and
// coloured by how each note sits on its chord (toneColors.ts). Everything here is worked out
// again from the keys at each change, so a note can still turn into an approach tone when the
// next key resolves it.

import { barAtBeat, slotAtBeat, type Bar, type Timeline } from '../engine/timeline'
import type { MelodyNote } from '../music/melody'
import { NO_TONES, resolvesApproach, toneColor, type ToneColor, type ToneCounts } from './toneColors'

/** A key played over the band: its sounding pitch, and when it went down and up (beats of the timeline). */
export interface PlayedKey {
  pitch: number
  start: number
  end: number | null // still held
}

/** The keys of a chorus written out: the notes (written key, time order), their colours and how many of each. */
export interface WrittenLine {
  notes: MelodyNote[]
  colors: ToneColor[]
  counts: ToneCounts
}

const SWUNG = 0.55 // a style whose off-beat eighth is later than this is written in swung eighths

/**
 * A time within a bar moved onto the written grid: sixteenths in a straight style; in a swung
 * style, the beat or its swung "and", written as an eighth.
 *
 *   straight: 1.3 -> 1.25        swing 0.66: 1.6 -> 1.5, 1.9 -> 2
 */
export function writtenPosition(at: number, swing: number): number {
  const beat = Math.floor(at + 1e-6)
  const offset = at - beat
  if (swing <= SWUNG) return beat + Math.round(offset * 4) / 4
  const [, written] = [[0, 0], [swing, 0.5], [1, 1]].reduce((best, option) =>
    (Math.abs(option[0] - offset) < Math.abs(best[0] - offset) ? option : best))
  return beat + written
}

/** The shortest note written: a sixteenth, or an eighth when swung. */
const shortest = (swing: number) => (swing <= SWUNG ? 0.25 : 0.5)

/** A beat of the timeline moved onto the written grid of its bar, with that bar (none outside the chart's bars). */
function placed(timeline: Timeline, beat: number, swing: number): { beat: number; bar: Bar } | null {
  const bar = barAtBeat(timeline, beat)
  if (!bar || bar.measure < 0) return null
  const at = bar.start + writtenPosition(beat - bar.start, swing)
  const moved = barAtBeat(timeline, at)
  return moved && moved.measure >= 0 ? { beat: at, bar: moved } : null
}

/**
 * The keys played in one chorus, written out as a line in the written key (`transpose`: the
 * sounding key's distance from it). Keys struck together keep only the highest (the line
 * on top); each note lasts until its key goes up (`now` for a key still held) or the next note
 * starts, and at least a sixteenth (an eighth when swung). A bar played twice in the chorus
 * (repeats) shows its last pass. Each note is coloured on the chord sounding where it starts;
 * an outside note followed by a half step onto a chord or colour tone is an approach tone.
 */
export function writeLine(keys: readonly PlayedKey[], timeline: Timeline, chorus: number, transpose: number, swing: number,
  now: number): WrittenLine {
  // The keys of this chorus on the grid, the highest of keys struck together
  const starts = new Map<number, { key: PlayedKey; bar: Bar; barIndex: number }>()
  for (const key of keys) {
    if (key.start < timeline.countIn) continue
    const at = placed(timeline, key.start, swing)
    if (!at || at.bar.chorus !== chorus) continue
    const known = starts.get(at.beat)
    if (!known || key.pitch > known.key.pitch) starts.set(at.beat, { key, bar: at.bar, barIndex: timeline.bars.indexOf(at.bar) })
  }
  // A written bar shows the last pass through it
  const lastPass = new Map<number, number>()
  for (const { bar, barIndex } of starts.values()) lastPass.set(bar.measure, Math.max(lastPass.get(bar.measure) ?? -1, barIndex))
  const line = [...starts].filter(([, { bar, barIndex }]) => lastPass.get(bar.measure) === barIndex).sort((a, b) => a[0] - b[0])

  const chorusEnd = Math.max(...timeline.bars.filter((bar) => bar.chorus === chorus && bar.measure >= 0).map((bar) => bar.start + bar.beats))
  const notes: MelodyNote[] = []
  const colors: ToneColor[] = []
  line.forEach(([start, { key, bar }], index) => {
    const up = key.end ?? now
    const end = Math.min(placed(timeline, up, swing)?.beat ?? up, line[index + 1]?.[0] ?? chorusEnd, chorusEnd)
    const beats = Math.max(Math.min(shortest(swing), chorusEnd - start), end - start)
    notes.push({ bar: bar.measure, at: start - bar.start, beats, pitch: key.pitch - transpose })
    const slot = slotAtBeat(timeline, start)
    colors.push(slot && slot.chordIndex >= 0 ? toneColor(key.pitch, slot.chord) : 'outside')
  })
  // An outside note resolved a half step onto a chord or colour tone was an approach
  for (let i = 0; i + 1 < colors.length; i++) {
    if (colors[i] === 'outside' && resolvesApproach(notes[i].pitch, notes[i + 1].pitch, colors[i + 1])) colors[i] = 'approach'
  }
  const counts = { ...NO_TONES }
  for (const color of colors) counts[color]++
  return { notes, colors, counts }
}
