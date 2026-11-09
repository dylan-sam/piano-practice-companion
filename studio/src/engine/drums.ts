import { DRUM_NOTES } from '../styles/drums'
import type { DrumHit, DrumPart, Groove } from '../styles/types'
import { chance, humanize, pick, swingPlacer, toTicks, type NoteEvent } from './events'
import { beatMap } from './meter'
import type { Bar, Click } from './timeline'

export const DRUM_CHANNEL = 9

// Render drum hits from a start beat, swung, keeping those between from and to that pass their probability
function render(hits: DrumHit[], start: number, swing: number, from = 0, to = Infinity): NoteEvent[] {
  const out: NoteEvent[] = []
  const placed = swingPlacer(hits.map(([at]) => at - from), swing)
  for (const [at, drum, vel, p = 1, dur = 0.25] of hits) {
    if (at < from || at >= to || !chance(p)) continue
    out.push(
      humanize(
        {
          tick: toTicks(start + placed(at - from)),
          channel: DRUM_CHANNEL,
          note: DRUM_NOTES[drum],
          velocity: vel,
          duration: toTicks(dur),
        },
        5,
        5,
      ),
    )
  }
  return out
}

// Plays each bar by its position in the form: first bar, middle bars (two-bar grooves), last bar.
// Bars in a compound meter (6/8) play `compound`, the style's 6/8 grooves, with straight eighths.
export function generateDrums(bars: Bar[], part: DrumPart, swing: number, clicks: Click[], compound: DrumPart = part): NoteEvent[] {
  const startsCompound = bars[0]?.compound ?? false
  // The count-in is played on the cross-stick in every style (a closed hi-hat is too quiet to count by)
  const velocity = { bar: 112, beat: 94, sub: 64 }
  const events = render(
    clicks.map(({ at, level }): DrumHit => [at, 'sidestick', velocity[level]]),
    0,
    0.5,
  )
  let groove: Groove | null = null
  let grooveBar = 0
  let wasCompound = startsCompound

  for (const bar of bars) {
    const drums = bar.compound ? compound : part
    const feel = bar.compound ? 0.5 : swing
    if (bar.measure === -1) {
      events.push(...render(drums.ending, bar.start, feel))
      continue
    }
    // A change of meter starts a fresh groove
    if (!!bar.compound !== wasCompound) {
      groove = null
      grooveBar = 0
      wasCompound = !!bar.compound
    }

    let current: Groove
    let barIndex: number
    if (bar.isLast && drums.grooves.last) {
      current = pick(drums.grooves.last)
      barIndex = 0
      grooveBar = 0
    } else if (bar.isFirst && drums.grooves.first) {
      current = pick(drums.grooves.first)
      barIndex = 0
      grooveBar = 0
    } else {
      // A new groove is picked only at the start of a pattern so two-bar figures stay intact
      if (grooveBar === 0 || !groove) groove = pick(drums.grooves.middle)
      current = groove
      barIndex = grooveBar
      grooveBar = (grooveBar + 1) % groove.bars
    }

    // Each groove bar has the groove's own length; a bar of another length rearranges its beats
    // (a 4/4 groove in 3/4 plays beats 1, 2 and 4)
    const unit = current.beats ?? 4
    const from = barIndex * unit
    if (Math.abs(unit - bar.beats) < 1e-9) {
      events.push(...render(current.hits, bar.start, feel, from, from + unit))
    } else if (bar.compound) {
      // 12/8 and 9/8 repeat the 6/8 bar; an opening crash only on the first half, a fill only on the last
      const halves = Math.ceil(bar.beats / unit - 1e-9)
      for (let k = 0; k < halves; k++) {
        const at = k * unit
        const opening = (drums.grooves.first?.includes(current) ?? false) && k > 0
        const beforeFill = (drums.grooves.last?.includes(current) ?? false) && k < halves - 1
        // The other halves of an opening or fill bar play the groove's first bar
        const [hits, start] = opening || beforeFill ? [drums.grooves.middle[0].hits, 0] : [current.hits, from]
        events.push(...render(hits, bar.start + at, feel, start, start + Math.min(unit, bar.beats - at)))
      }
    } else {
      beatMap(unit, bar.beats).forEach((source, beat) => {
        const length = Math.min(1, bar.beats - beat)
        events.push(...render(current.hits, bar.start + beat, feel, from + source, from + source + length))
      })
    }
  }

  return events
}
