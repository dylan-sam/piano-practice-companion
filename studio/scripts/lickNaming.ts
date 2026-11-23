// Grouping and naming the one-chord licks (the ones Lick Sightreading writes over every chord):
// each lick is put in the group of the idea it practises (arpeggios, scale lines, turns,
// chromatic approaches, colours, blues), named after what it does ("Dominant arpeggio down, root
// to 3rd") with the chord degrees it plays, and the licks of a group are ordered from easy to hard.

import type { Chart } from '../src/music/chart'
import { parseChord } from '../src/music/chords'

/** The groups of one-chord licks, in the order they are listed. */
export const LICK_GROUPS = ['Arpeggios', 'Scale lines', 'Neighbours and turns', 'Approach notes', 'Colours', 'Blues'] as const
export type LickGroup = (typeof LICK_GROUPS)[number]

// The chord of each one-chord context: its name in a title, its chord tones and its scale (from the root)
const CHORDS: Record<string, { name: string; tones: number[]; scale: number[] }> = {
  maj7: { name: 'Major', tones: [0, 4, 7, 9, 11], scale: [0, 2, 4, 5, 7, 9, 11] },
  min7: { name: 'Minor', tones: [0, 3, 7, 10], scale: [0, 2, 3, 5, 7, 9, 10] },
  dom7: { name: 'Dominant', tones: [0, 4, 7, 10], scale: [0, 2, 4, 5, 7, 9, 10] },
  altered: { name: 'Altered', tones: [0, 4, 10], scale: [0, 1, 3, 4, 6, 8, 10] },
  half: { name: 'Half-diminished', tones: [0, 3, 6, 10], scale: [0, 1, 3, 5, 6, 8, 10] },
  dim7: { name: 'Diminished', tones: [0, 3, 6, 9], scale: [0, 2, 3, 5, 6, 8, 9, 11] },
}

/** Whether a lick plays over one chord (one of the contexts above). */
export function isOneChordContext(context: string): boolean {
  return context in CHORDS
}

/** The name of a pitch class above the chord's root, as a chord degree ("b3", "#11", "13"). */
export function degreeName(interval: number, context: string): string {
  const dominant = context === 'dom7' || context === 'altered'
  const minorish = context === 'min7' || context === 'half' || context === 'dim7'
  switch ((interval + 12) % 12) {
    case 0: return '1'
    case 1: return 'b9'
    case 2: return '9'
    case 3: return minorish ? 'b3' : '#9'
    case 4: return minorish ? 'maj3' : '3'
    case 5: return '4'
    case 6: return minorish ? 'b5' : '#11'
    case 7: return '5'
    case 8: return dominant ? 'b13' : 'b6'
    case 9: return dominant ? '13' : '6'
    case 10: return 'b7'
    default: return dominant || minorish ? 'maj7' : '7'
  }
}

/** A degree in words, for a title: "root", "3rd", "b7", "#11", "major 7th". */
function degreeWord(degree: string): string {
  if (degree === '1') return 'root'
  if (degree.startsWith('maj')) return `major ${degreeWord(degree.slice(3))}`
  const n = degree.replace(/^[b#]+/, '')
  const suffix = n === '1' ? 'st' : n === '2' ? 'nd' : n === '3' ? 'rd' : 'th'
  return degree === n ? `${n}${suffix}` : degree
}

/** What is measured of a lick to group and name it. */
interface Shape {
  context: string
  intervals: number[] // pitch classes above the root, note by note
  moves: number[] // the steps between notes, repeated notes left out
  direction: 'up' | 'down' | 'around' // where most moves go
  turns: number // changes of direction
  same: boolean // it ends on the note it starts on
}

/** The shape of a one-chord lick, or null when it is not one. */
function shapeOf(chart: Chart): Shape | null {
  const context = chart.lick?.context ?? ''
  const symbol = chart.bars.flatMap((bar) => bar.chords).find((c) => c.symbol)?.symbol
  const chord = symbol ? parseChord(symbol) : null
  const notes = [...(chart.melody?.notes ?? [])].sort((a, b) => a.bar - b.bar || a.at - b.at)
  if (!isOneChordContext(context) || !chord || notes.length < 2) return null
  const pitches = notes.map((n) => n.pitch)
  const moves = pitches.slice(1).map((p, i) => p - pitches[i]).filter((m) => m !== 0)
  const turns = moves.slice(1).filter((m, i) => m > 0 !== moves[i] > 0).length
  // The way most moves go; as many up as down: the way it goes overall, or around a note
  const rise = pitches[pitches.length - 1] - pitches[0]
  const ups = moves.filter((m) => m > 0).length
  const downs = moves.length - ups
  const direction = ups > downs ? 'up' : downs > ups ? 'down' : Math.abs(rise) <= 2 ? 'around' : rise > 0 ? 'up' : 'down'
  return { context, intervals: pitches.map((p) => (p - chord.root + 120) % 12), moves, direction, turns, same: rise === 0 }
}

/** The chord degrees a lick plays, note by note ("3 9 1 b7"). */
export function lickDegrees(chart: Chart): string[] {
  const shape = shapeOf(chart)
  return shape ? shape.intervals.map((i) => degreeName(i, shape.context)) : []
}

/** Notes outside the chord's scale, and those of them that move by a half step to a chord tone. */
function outsideNotes(shape: Shape): { outside: number[]; approaches: number[] } {
  const { tones, scale } = CHORDS[shape.context]
  const outside = shape.intervals.map((iv, i) => (scale.includes(iv) ? -1 : i)).filter((i) => i >= 0)
  const approaches = outside.filter((i) => {
    const next = shape.intervals[i + 1]
    return next !== undefined && tones.includes(next) && [1, 11].includes((next - shape.intervals[i] + 12) % 12)
  })
  return { outside, approaches }
}

/** The group of a one-chord lick, from its notes. */
export function lickGroup(chart: Chart): LickGroup | null {
  const shape = shapeOf(chart)
  if (!shape) return null
  const { context, intervals, moves, turns } = shape
  const { outside, approaches } = outsideNotes(shape)
  const steps = moves.filter((m) => Math.abs(m) <= 2).length
  const leaps = moves.length - steps
  const chordTones = intervals.filter((iv) => CHORDS[context].tones.includes(iv)).length / intervals.length
  const count = Math.max(1, moves.length)
  if ((context === 'dom7' || context === 'maj7') && intervals.includes(3)) return 'Blues' // the blue third
  if (approaches.length) return 'Approach notes'
  if (outside.length) return 'Colours'
  if (leaps >= count * 0.5 && chordTones >= 0.7) return 'Arpeggios'
  if (steps >= count * 0.7 && turns <= 1) return 'Scale lines'
  return 'Neighbours and turns'
}

/** A title saying what a lick does: "Dominant arpeggio down, root to 3rd". */
export function lickTitle(chart: Chart, group: LickGroup): string {
  const shape = shapeOf(chart)
  if (!shape) return chart.title
  const chord = CHORDS[shape.context].name
  const degrees = lickDegrees(chart)
  const from = degreeWord(degrees[0])
  const to = degreeWord(degrees[degrees.length - 1])
  const span = shape.same ? `on the ${from}` : `${from} to ${to}`
  const way = shape.direction === 'around' ? '' : ` ${shape.direction}`
  const { outside, approaches } = outsideNotes(shape)
  const list = (indices: number[]) => [...new Set(indices.map((i) => degreeWord(degrees[i])))].join(' and ')
  switch (group) {
    case 'Arpeggios': return `${chord} arpeggio${way}, ${span}`
    case 'Scale lines': return `${chord} scale line${way}, ${span}`
    case 'Neighbours and turns': return shape.direction === 'around' ? `${chord} turn around the ${from}` : `${chord} turns${way}, ${span}`
    case 'Approach notes': return `${chord} line, ${list(approaches)} approaching the ${degreeWord(degrees[approaches[0] + 1])}`
    case 'Colours': return `${chord} line with the ${list(outside)}, ${span}`
    case 'Blues': return `${chord} blues line${way}, ${span}`
  }
}

/**
 * The one-chord licks by group, each group ordered from easy to hard (level, then the written
 * vocabulary first, then fewer notes; the order given breaks ties). Mined licks are renamed after
 * what they do, the degrees they play and their tune going to their composer line; titles stay
 * unique within a group.
 */
export function groupOneChordLicks(charts: Chart[]): { group: LickGroup; charts: Chart[] }[] {
  const named = charts.flatMap((chart, order) => {
    const written = chart.lick?.category && (LICK_GROUPS as readonly string[]).includes(chart.lick.category)
    const group = written ? chart.lick!.category as LickGroup : lickGroup(chart)
    if (!group) return []
    const degrees = lickDegrees(chart).join(' ')
    const renamed: Chart = written ? chart : {
      ...chart,
      title: lickTitle(chart, group),
      composer: `${degrees} · ${chart.lick?.tune ?? ''}${chart.lick?.bar ? `, bar ${chart.lick.bar}` : ''}`,
      lick: { ...chart.lick!, category: group },
    }
    return [{ group, chart: renamed, order, written: !!written }]
  })
  return LICK_GROUPS.map((group) => {
    const list = named.filter((n) => n.group === group).sort((a, b) =>
      (a.chart.lick?.level ?? 1) - (b.chart.lick?.level ?? 1) || Number(b.written) - Number(a.written) ||
      (a.chart.melody?.notes.length ?? 0) - (b.chart.melody?.notes.length ?? 0) || a.order - b.order)
    // Titles unique within the group: "(2)", "(3)" after a repeated one
    const seen = new Map<string, number>()
    const charts = list.map(({ chart }) => {
      const n = (seen.get(chart.title) ?? 0) + 1
      seen.set(chart.title, n)
      return n === 1 ? chart : { ...chart, title: `${chart.title} (${n})` }
    })
    return { group, charts }
  }).filter((g) => g.charts.length)
}
