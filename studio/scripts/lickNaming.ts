// Grouping and naming the one-chord licks (the ones Lick Sightreading writes over every chord):
// each lick is read as Lick Sightreading reads it, a shape of chord degrees (lickShape: 1 to 7 of
// the chord's scale, plus chromatic notes such as b5 a half step under the 5), so a name holds over
// any chord ("Arpeggio down 1-7-5-3"). The lick is put in the group of the idea it practises
// (arpeggios, scale lines, turns, chromatic approaches, colours, blues) and the licks of a group
// are ordered from easy to hard.

import type { Chart } from '../src/music/chart'
import { lickChord, lickShape, type ShapeNote } from '../src/exercises/lickReading'

/** The groups of one-chord licks, in the order they are listed. */
export const LICK_GROUPS = ['Arpeggios', 'Scale lines', 'Neighbours and turns', 'Approach notes', 'Colours', 'Blues'] as const
export type LickGroup = (typeof LICK_GROUPS)[number]

const ONE_CHORD_CONTEXTS = ['maj7', 'min7', 'dom7', 'altered', 'half', 'dim7']
const CHORD_TONES = [0, 2, 4, 6] // the slots of the root, 3rd, 5th and 7th
const MOST_DEGREES = 7 // a title lists at most this many degrees

/** Whether a lick plays over one chord, and can be written over any chord by Lick Sightreading. */
export function isOneChordContext(context: string): boolean {
  return ONE_CHORD_CONTEXTS.includes(context)
}

/** The slot of a shape note (0 root, 1 2nd/9th, 2 3rd ... 6 7th) in any octave. */
const slotOf = (note: ShapeNote) => ((note.degree % 7) + 7) % 7

/** A shape note as a degree of the chord's scale, with its chromatic step: "1", "3", "b5", "#4". */
export function shapeDegree(note: ShapeNote): string {
  const sign = note.alter < 0 ? 'b'.repeat(-note.alter) : '#'.repeat(note.alter)
  return `${sign}${slotOf(note) + 1}`
}

/** The degrees a lick plays, note by note, as Lick Sightreading reads them ("1 7 5 3"). */
export function lickDegrees(chart: Chart): string[] {
  return lickShape(chart)?.notes.map(shapeDegree) ?? []
}

/** What is measured of a lick to group and name it. */
interface Measure {
  notes: ShapeNote[]
  degrees: string[]
  moves: number[] // the steps between notes in semitones, repeated notes left out
  direction: 'up' | 'down' | 'around' // where most moves go
  turns: number // changes of direction
  approaches: number[] // chromatic notes moving by a half step to a chord tone
  outside: number[] // the other chromatic notes
  blueThird: boolean // a half step under the 3rd, over a major or dominant chord
}

/** Measure a one-chord lick, or null when it is not one. */
function measure(chart: Chart): Measure | null {
  const context = chart.lick?.context ?? ''
  const shape = lickShape(chart)
  const chord = lickChord(chart)
  if (!isOneChordContext(context) || !shape || !chord || shape.notes.length < 2) return null
  const pitches = [...(chart.melody?.notes ?? [])].sort((a, b) => a.bar - b.bar || a.at - b.at).map((n) => n.pitch)
  const notes = [...shape.notes].sort((a, b) => a.start - b.start)
  const moves = pitches.slice(1).map((p, i) => p - pitches[i]).filter((m) => m !== 0)
  const turns = moves.slice(1).filter((m, i) => m > 0 !== moves[i] > 0).length
  // The way most moves go; as many up as down: the way it goes overall, or around a note
  const ups = moves.filter((m) => m > 0).length
  const downs = moves.length - ups
  const rise = pitches[pitches.length - 1] - pitches[0]
  const direction = ups > downs ? 'up' : downs > ups ? 'down' : Math.abs(rise) <= 2 ? 'around' : rise > 0 ? 'up' : 'down'
  const chromatic = notes.map((n, i) => (n.alter ? i : -1)).filter((i) => i >= 0)
  const approaches = chromatic.filter((i) => {
    const next = notes[i + 1]
    return !!next && Math.abs(pitches[i + 1] - pitches[i]) === 1 && next.alter === 0 && CHORD_TONES.includes(slotOf(next))
  })
  return {
    notes, degrees: notes.map(shapeDegree), moves, direction, turns, approaches,
    outside: chromatic.filter((i) => !approaches.includes(i)),
    blueThird: (context === 'maj7' || context === 'dom7') && notes.some((n) => slotOf(n) === 2 && n.alter === -1),
  }
}

/** The group of a one-chord lick, from its notes. */
export function lickGroup(chart: Chart): LickGroup | null {
  const m = measure(chart)
  if (!m) return null
  const steps = m.moves.filter((move) => Math.abs(move) <= 2).length
  const count = Math.max(1, m.moves.length)
  const chordTones = m.notes.filter((n) => !n.alter && CHORD_TONES.includes(slotOf(n))).length / m.notes.length
  if (m.blueThird) return 'Blues'
  if (m.approaches.length) return 'Approach notes'
  if (m.outside.length) return 'Colours'
  if (count - steps >= count * 0.5 && chordTones >= 0.7) return 'Arpeggios'
  if (steps >= count * 0.7 && m.turns <= 1) return 'Scale lines'
  return 'Neighbours and turns'
}

/** A title saying what a lick does over any chord: "Arpeggio down 1-7-5-3". */
export function lickTitle(chart: Chart, group: LickGroup): string {
  const m = measure(chart)
  if (!m) return chart.title
  const line = m.degrees.slice(0, MOST_DEGREES).join('-') + (m.degrees.length > MOST_DEGREES ? '…' : '')
  const way = m.direction === 'around' ? '' : ` ${m.direction}`
  const list = (indices: number[]) => [...new Set(indices.map((i) => m.degrees[i]))].join(' and ')
  switch (group) {
    case 'Arpeggios': return `Arpeggio${way} ${line}`
    case 'Scale lines': return `Scale${way} ${line}`
    case 'Neighbours and turns': return m.direction === 'around' ? `Turn around the ${m.degrees[0]}: ${line}` : `Turns${way} ${line}`
    case 'Approach notes': return `Approach into the ${m.degrees[m.approaches[0] + 1]}: ${line}`
    case 'Colours': return `Line with the ${list(m.outside)}: ${line}`
    case 'Blues': return `Blue third${way} ${line}`
  }
}

/**
 * The one-chord licks by group, each group ordered from easy to hard (level, then the written
 * vocabulary first, then fewer notes; the order given breaks ties). Mined licks are renamed after
 * what they do, their tune going to their composer line; titles stay unique within a group.
 */
export function groupOneChordLicks(charts: Chart[]): { group: LickGroup; charts: Chart[] }[] {
  const named = charts.flatMap((chart, order) => {
    const written = chart.lick?.category && (LICK_GROUPS as readonly string[]).includes(chart.lick.category)
    const group = written ? chart.lick!.category as LickGroup : lickGroup(chart)
    if (!group) return []
    const renamed: Chart = written ? chart : {
      ...chart,
      title: lickTitle(chart, group),
      composer: `${chart.lick?.tune ?? ''}${chart.lick?.bar ? `, bar ${chart.lick.bar}` : ''}`,
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
