import { barMeters, beatsPerBar, isCompound, playbackOrder, type Chart } from '../music/chart'
import { parseChord, transposeChord, type Chord } from '../music/chords'
import { PULSE } from './meter'

// One click of the count-in: where it falls, the number shown, and how strong it is
// (the start of a bar, a beat or pulse, or an eighth in between)
export interface Click {
  at: number
  count: number
  level: 'bar' | 'beat' | 'sub'
}

// The count-in follows the tune's meter, the way a band leader counts off:
// 4/4 "1 . 2 . | 1 2 3 4", 3/4 "1 . . | 1 2 3", 2/4 "1 2 | 1 2",
// 6/8 "1 . 2 . | 1 2 3 4 5 6" (eighths, stronger on the pulses), 12/8 and 9/8 one bar of
// eighths counted on the pulses ("1 & a 2 & a 3 & a 4 & a"), 5/4 (3+2) and 6/4 (3+3) one bar.
export function countInClicks(chart: Chart): Click[] {
  const beats = beatsPerBar(chart.time)
  // A metronome click
  const click = (at: number, count: number, level: Click['level']): Click => ({ at, count, level })
  if (isCompound(chart.time)) {
    // Count-in clicks on every eighth note from a start (compound meter)
    const eighths = (start: number, counted: (i: number) => number) =>
      Array.from({ length: Math.round(beats * 2) }, (_, i) =>
        click(start + i / 2, counted(i), i === 0 ? 'bar' : i % 3 === 0 ? 'beat' : 'sub'),
      )
    if (beats === 2 * PULSE) return [click(0, 1, 'bar'), click(PULSE, 2, 'beat'), ...eighths(beats, (i) => i + 1)]
    return eighths(0, (i) => Math.floor(i / 3) + 1)
  }
  // Count-in clicks of bars given as lists of beat offsets
  const bars = (list: number[][]) =>
    list.flatMap((counts, b) => counts.map((at, i) => click(b * beats + at, i + 1, at === 0 ? 'bar' : 'beat')))
  if (beats === 4)
    return bars([
      [0, 2],
      [0, 1, 2, 3],
    ])
  if (beats === 3) return bars([[0], [0, 1, 2]])
  if (beats === 2)
    return bars([
      [0, 1],
      [0, 1],
    ])
  if (Number.isInteger(beats) && beats > 4) {
    // Stronger where the bar divides: 5/4 as 3+2, 6/4 as 3+3
    return Array.from({ length: beats }, (_, i) => click(i, i + 1, i === 0 ? 'bar' : i === 3 ? 'beat' : 'sub'))
  }
  return [0, 1, 2, 3].map((at) => click(at, at + 1, at === 0 ? 'bar' : 'beat'))
}

// Count-in length in beats: two bars of short meters, one bar of long ones
export function countInBeats(chart: Chart): number {
  const beats = beatsPerBar(chart.time)
  if (isCompound(chart.time)) return beats === 2 * PULSE ? 2 * beats : beats
  if (!Number.isInteger(beats)) return 4
  return beats <= 4 ? 2 * beats : beats
}

// One chord span on the timeline, in beats
export interface Slot {
  chord: Chord
  start: number
  beats: number
  measure: number // bar index in the chart; -1 for the final chord
  chordIndex: number // position in the written bar; -1 for a carried or ending chord
  chorus: number
  compound?: boolean // in 6/8, 9/8 or 12/8
}

// One bar as played; drum grooves are chosen per bar
export interface Bar {
  start: number
  beats: number
  measure: number // -1 for the ending bar
  chorus: number // the pass through the chart this bar belongs to (its key with Practice > Keys)
  isFirst: boolean
  isLast: boolean
  compound?: boolean // in 6/8, 9/8 or 12/8
}

export interface Timeline {
  slots: Slot[]
  bars: Bar[]
  totalBeats: number
  countIn: number // beats before the first bar
  clicks: Click[] // the count-in
}

// Practice options: loop a range of written bars, change key every chorus
export interface PracticeOptions {
  loop?: [from: number, to: number] | null // written bar indices, inclusive
  keyStep?: number // semitones added to the key on each chorus (5 = round the cycle of fourths)
  ending?: boolean // false: stop after the last bar instead of resolving to the first chord
  countIn?: boolean // false: continue an endless exercise without another count-in
}

// Transposition for each chorus, kept within -5..+6 so the band's register doesn't drift
export function chorusTranspose(transpose: number, keyStep: number, chorus: number): number {
  return ((((transpose + keyStep * chorus + 5) % 12) + 12) % 12) - 5
}

// Bars in the order they are played, or the looped range in written order
export function practiceOrder(chart: Chart, loop: PracticeOptions['loop']): number[] {
  if (!loop) return playbackOrder(chart)
  const [from, to] = loop[0] <= loop[1] ? loop : [loop[1], loop[0]]
  const order: number[] = []
  for (let i = Math.max(0, from); i <= Math.min(to, chart.bars.length - 1); i++) {
    if (!chart.bars[i].spacer) order.push(i)
  }
  return order.length ? order : playbackOrder(chart)
}

/** Expand the written chart into timed chord slots and bars for playback. */
export function buildTimeline(chart: Chart, transpose: number, choruses: number, practice: PracticeOptions = {}): Timeline {
  const keyStep = practice.keyStep ?? 0
  const chords = new Map<string, Chord>()
  // The chord of a symbol in a chorus's key (parsed once, then cached)
  const toChord = (symbol: string, chorus: number): Chord => {
    const semitones = chorusTranspose(transpose, keyStep, chorus)
    const id = `${semitones} ${symbol}`
    let chord = chords.get(id)
    if (!chord) {
      const parsed = parseChord(symbol)
      if (!parsed) throw new Error(`Could not parse chord: ${symbol}`)
      chord = transposeChord(parsed, semitones)
      chords.set(id, chord)
    }
    return chord
  }

  // Time signature in force at each written bar
  const meters = barMeters(chart)

  const order = practiceOrder(chart, practice.loop)
  const slots: Slot[] = []
  const bars: Bar[] = []
  const countIn = practice.countIn === false ? 0 : countInBeats(chart)
  let beat = countIn

  const carried = practice.loop
    ? (chart.bars
        .slice(0, order[0])
        .flatMap((b) => b.chords)
        .at(-1)?.symbol ?? null)
    : null

  for (let chorus = 0; chorus < choruses; chorus++) {
    // A blank bar keeps the chord that was sounding at the end of the previous one;
    // a loop starting on a blank bar picks up the chord written before it
    let held: Chord | null = carried ? toChord(carried, chorus) : null
    order.forEach((measure, n) => {
      const bar = chart.bars[measure]
      const { beats, compound } = meters[measure]
      bars.push({ start: beat, beats, measure, chorus, isFirst: n === 0, isLast: n === order.length - 1, compound })

      if (bar.chords.length === 0) {
        if (held) slots.push({ chord: held, start: beat, beats, measure, chordIndex: -1, chorus, compound })
      } else {
        let at = beat
        for (const [chordIndex, c] of bar.chords.entries()) {
          held = c.symbol ? toChord(c.symbol, chorus) : null // N.C. leaves a gap
          if (held) slots.push({ chord: held, start: at, beats: c.beats, measure, chordIndex, chorus, compound })
          at += c.beats
        }
      }
      beat += beats
    })
  }

  // Ending: resolve to the first chord played (usually the tonic) and hold for a bar of the
  // last meter (two bars of a short one), in the last chorus's key
  const first = order.flatMap((m) => chart.bars[m].chords).find((c) => c.symbol)?.symbol
  if (first && choruses > 0 && practice.ending !== false) {
    const last = meters[order[order.length - 1]] ?? { beats: 4 }
    const beats = last.beats >= 3 ? last.beats : last.beats * 2
    bars.push({ start: beat, beats, measure: -1, chorus: choruses - 1, isFirst: false, isLast: false, compound: last.compound })
    slots.push({ chord: toChord(first, choruses - 1), start: beat, beats, measure: -1, chordIndex: -1, chorus: choruses, compound: last.compound })
    beat += beats
  }

  return { slots, bars, totalBeats: beat, countIn,
    clicks: practice.countIn === false ? [] : countInClicks(chart) }
}

// The slot sounding at a beat of the timeline
export function slotAtBeat(timeline: Timeline, beat: number): Slot | undefined {
  const { slots } = timeline
  let lo = 0
  let hi = slots.length - 1
  if (hi < 0 || beat < slots[0].start) return undefined
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (slots[mid].start <= beat) lo = mid
    else hi = mid - 1
  }
  return slots[lo]
}
