// The Pattern Creator's model: a style's grooves laid out on a grid of sixteenth notes,
// so they can be edited cell by cell and turned back into a style.
// Drums: groove A, an optional variation B (the band switches between them) and an optional
// fill for the last bar of the form. Bass and chords: one bar each, with an optional variation B.
// Everything the grid doesn't show (count-in, ending, patterns for shorter chords)
// comes from the style the lab started from.

import type { DrumName } from './drums'
import { getStyle } from './index'
import type { BassNote, BassTone, CompHit, DrumHit, Groove, StyleDefinition } from './types'

export const STEPS_PER_BEAT = 4

export interface DrumCell {
  vel: number
  chance?: number // below 1: the hit plays only sometimes
  dur?: number // ring length in beats, for cymbals
}

// One drum part on the grid: a row of cells per drum
export type DrumLayer = Partial<Record<DrumName, (DrumCell | null)[]>>

export interface LabStyle {
  base: string // id of the style the lab started from
  name: string
  swing: number
  beats: 3 | 4 // beats per bar
  bars: 1 | 2 // length of grooves A and B
  fills: boolean // a crash on the first bar of every chorus
  drums: DrumLayer // groove A
  drumsB?: DrumLayer | null // variation B, same length as A
  fill?: DrumLayer | null // the last bar of the form, one bar long
  bass: { walking: boolean; steps: (BassTone | null)[] } // one bar
  bassB?: (BassTone | null)[] | null // a second bass bar; the band switches between the two
  comp: boolean[] // one bar
  compB?: boolean[] | null // a second comping rhythm
}

// Drum rows offered in the grid, top to bottom
export const DRUM_ROWS: DrumName[] = [
  'crash',
  'ride',
  'rideBell',
  'hhOpen',
  'hhClosed',
  'hhPedal',
  'tomHigh',
  'tomMid',
  'tomLow',
  'snare',
  'sidestick',
  'clap',
  'kick',
  'tambourine',
  'shaker',
  'cabasa',
  'cowbell',
  'claves',
  'congaHigh',
  'congaMute',
  'congaLow',
]

// Bass tones, high to low, as rows of the bass grid
export const BASS_ROWS: BassTone[] = ['8', '7', '6', '5', '3', 'R', '5-', 'app']

const empty = <T>(n: number): (T | null)[] => Array.from({ length: n }, () => null)
// The grid step of a time in beats
const stepOf = (at: number) => Math.round(at * STEPS_PER_BEAT)

// Number of drum steps in a Pattern Creator style
export const drumSteps = (lab: LabStyle) => lab.bars * lab.beats * STEPS_PER_BEAT
// Number of steps in one bar
export const barSteps = (lab: LabStyle) => lab.beats * STEPS_PER_BEAT

// Turn drum hits into a grid layer
function layerFromHits(hits: DrumHit[], steps: number): DrumLayer {
  const layer: DrumLayer = {}
  for (const [at, drum, vel, chance, dur] of hits) {
    const i = stepOf(at)
    if (i < 0 || i >= steps) continue
    const row = (layer[drum] ??= empty<DrumCell>(steps))
    const cell: DrumCell = { vel }
    if (chance !== undefined && chance < 1) cell.chance = chance
    if (dur !== undefined) cell.dur = dur
    row[i] = cell
  }
  return layer
}

// Turn a grid layer into drum hits, up to a step
function hitsFromLayer(layer: DrumLayer, until = Infinity): DrumHit[] {
  const hits: DrumHit[] = []
  for (const drum of DRUM_ROWS) {
    layer[drum]?.forEach((cell, i) => {
      if (!cell || i >= until) return
      const hit: DrumHit = [round(i / STEPS_PER_BEAT), drum, cell.vel]
      if (cell.chance !== undefined || cell.dur !== undefined) hit.push(cell.chance ?? 1)
      if (cell.dur !== undefined) hit.push(cell.dur)
      hits.push(hit)
    })
  }
  return hits
}

// Make a Pattern Creator style from a built-in style
export function labFromStyle(style: StyleDefinition): LabStyle {
  const { middle, last } = style.drums.grooves
  const groove = middle[0]
  const beats: 3 | 4 = (groove?.beats ?? 4) === 3 ? 3 : 4
  const bars = groove?.bars ?? 1
  const steps = bars * beats * STEPS_PER_BEAT
  // Whether a groove has the lab's bar count and meter
  const sameShape = (g?: Groove) => !!g && g.bars === bars && (g.beats ?? 4) === beats

  const drums = layerFromHits(groove?.hits ?? [], steps)
  const drumsB = sameShape(middle[1]) ? layerFromHits(middle[1].hits, steps) : null
  const lastBar = last?.[0]
  const fill = lastBar && lastBar.bars === 1 && (lastBar.beats ?? 4) === beats ? layerFromHits(lastBar.hits, beats * STEPS_PER_BEAT) : null

  const one = beats * STEPS_PER_BEAT
  const walking = style.bass.mode === 'walking'
  const patterns = style.bass.mode === 'pattern' ? style.bass.patterns[String(beats) as '3' | '4'] : undefined
  // Turn a bass pattern into a bar of grid steps
  const bassBar = (pattern: BassNote[]) => {
    const steps = empty<BassTone>(one)
    for (const n of pattern) if (stepOf(n.at) >= 0 && stepOf(n.at) < one) steps[stepOf(n.at)] = n.tone
    return steps
  }
  const bassSteps = patterns?.[0] ? bassBar(patterns[0]) : empty<BassTone>(one)
  const bassB = patterns?.[1] ? bassBar(patterns[1]) : null
  if (!patterns?.[0]) {
    // A starting point for a walking-bass style switched to a pattern: root on one, fifth on three
    bassSteps[0] = 'R'
    if (beats === 4) bassSteps[2 * STEPS_PER_BEAT] = '5'
  }

  const rhythms = style.comp.rhythms[String(beats) as '3' | '4']
  // Turn a comp rhythm into a bar of grid steps
  const compBar = (rhythm: CompHit[]) => {
    const on = Array.from({ length: one }, () => false)
    for (const [at] of rhythm) if (stepOf(at) >= 0 && stepOf(at) < one) on[stepOf(at)] = true
    return on
  }
  const comp = compBar(rhythms?.[0] ?? [])
  const compB = rhythms?.[1] ? compBar(rhythms[1]) : null

  return {
    base: style.id,
    name: `My ${style.name}`,
    swing: style.swing,
    beats,
    bars: bars === 2 ? 2 : 1,
    fills: !!style.drums.grooves.first,
    drums,
    drumsB,
    fill,
    bass: { walking, steps: bassSteps },
    bassB,
    comp,
    compB,
  }
}

// Ids are made from the name: "My Bossa" -> "my-bossa"
export function labId(lab: LabStyle): string {
  return (
    lab.name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-') || 'my-style'
  )
}

// Notes last until the next one (a little less, so they don't run together)
function lengths(onsets: number[], end: number, max: number): number[] {
  return onsets.map((step, i) => {
    const next = onsets[i + 1] ?? end
    return Math.min(max, ((next - step) / STEPS_PER_BEAT) * 0.9)
  })
}

// Round to three decimals
const round = (n: number) => Math.round(n * 1000) / 1000

// Make a playable style from a Pattern Creator style
export function styleFromLab(lab: LabStyle): StyleDefinition {
  const base = getStyle(lab.base)
  const one = barSteps(lab)
  const key = String(lab.beats) as '3' | '4'

  const shape = { bars: lab.bars, ...(lab.beats === 3 ? { beats: 3 } : {}) }
  const oneBar = { bars: 1 as const, ...(lab.beats === 3 ? { beats: 3 } : {}) }
  const middle: Groove[] = [{ ...shape, hits: hitsFromLayer(lab.drums) }]
  if (lab.drumsB) middle.push({ ...shape, hits: hitsFromLayer(lab.drumsB) })
  // The top of each chorus: groove A's first bar with a crash on one
  const first: Groove[] | undefined = lab.fills
    ? [
        {
          ...oneBar,
          hits: [...hitsFromLayer(lab.drums, one).filter((h) => h[1] !== 'crash'), [0, 'crash', 100, 1, 2]],
        },
      ]
    : undefined
  const last: Groove[] | undefined = lab.fill ? [{ ...oneBar, hits: hitsFromLayer(lab.fill) }] : undefined

  const bassPattern = (steps: (BassTone | null)[]): BassNote[] => {
    const onsets = steps.flatMap((t, i) => (t ? [i] : []))
    const durs = lengths(onsets, one, 2)
    return onsets.map((i, j) => ({
      at: round(i / STEPS_PER_BEAT),
      dur: round(durs[j]),
      tone: steps[i]!,
    }))
  }
  // Turn comp grid steps into a rhythm
  const compRhythm = (on: boolean[]): CompHit[] => {
    const onsets = on.flatMap((x, i) => (x ? [i] : []))
    const durs = lengths(onsets, one, 2.5)
    return onsets.map((i, j): CompHit => [round(i / STEPS_PER_BEAT), round(durs[j])])
  }
  // Empty bars are left out; the band switches between the ones that remain
  const bassPatterns = [lab.bass.steps, lab.bassB].flatMap((steps) => (steps ? [bassPattern(steps)] : [])).filter((p) => p.length)
  const compRhythms = [lab.comp, lab.compB].flatMap((on) => (on ? [compRhythm(on)] : [])).filter((r) => r.length)

  const bass: StyleDefinition['bass'] =
    lab.bass.walking || bassPatterns.length === 0
      ? { mode: 'walking', program: base.bass.program, range: base.bass.range }
      : {
          mode: 'pattern',
          program: base.bass.program,
          range: base.bass.range,
          patterns: {
            ...(base.bass.mode === 'pattern' ? base.bass.patterns : {}),
            [key]: bassPatterns,
          },
        }

  return {
    ...base,
    id: labId(lab),
    name: lab.name.trim() || 'My style',
    swing: lab.swing,
    bass,
    comp: {
      ...base.comp,
      rhythms: compRhythms.length ? { ...base.comp.rhythms, [key]: compRhythms } : base.comp.rhythms,
    },
    drums: {
      ...base.drums,
      grooves: {
        middle,
        ...(first ? { first } : {}),
        ...(last ? { last } : {}),
      },
    },
  }
}

// Changes the length of grooves A and B, keeping what fits; going to two bars repeats the first
function resize(layer: DrumLayer, steps: number, repeat: boolean): DrumLayer {
  const out: DrumLayer = {}
  for (const [drum, row] of Object.entries(layer) as [DrumName, (DrumCell | null)[]][]) {
    out[drum] = Array.from({ length: steps }, (_, i) => (i < row.length ? row[i] : repeat ? (row[i % row.length] ?? null) : null))
  }
  return out
}

// Change a Pattern Creator style's length, resizing its drum layers
export function setBars(lab: LabStyle, bars: 1 | 2): LabStyle {
  const steps = bars * lab.beats * STEPS_PER_BEAT
  return {
    ...lab,
    bars,
    drums: resize(lab.drums, steps, bars === 2),
    drumsB: lab.drumsB ? resize(lab.drumsB, steps, bars === 2) : lab.drumsB,
  }
}

// A starting point for variation B or the fill: a copy of groove A (its first bar, for the fill)
export const copyLayer = (layer: DrumLayer, steps: number): DrumLayer => resize(layer, steps, true)

// The style as a TypeScript file for src/styles/library/
export function styleSource(style: StyleDefinition, baseName: string): string {
  const name = style.id.replace(/-(\w)/g, (_, c: string) => c.toUpperCase()).replace(/^\d/, '_$&')
  const body = JSON.stringify(style, null, 2)
    .replace(/"([A-Za-z_]\w*)":/g, '$1:')
    .replace(/"((?:[^"\\]|\\.)*)"/g, (_, s: string) => `'${s.replace(/\\"/g, '"').replace(/'/g, "\\'")}'`)
    // Short arrays of numbers and names fit on one line: [0, 'kick', 90]
    .replace(/\[\s+([^[\]{}]*?)\s+\]/g, (_, inner: string) => `[${inner.split(/,\s+/).join(', ')}]`)
  return `import type { StyleDefinition } from '../types'

// Made in the OpenStand Pattern Creator, starting from ${baseName}

export const ${name}: StyleDefinition = ${body}
`
}

// Whether a value is a bass grid row
const isTone = (t: unknown): t is BassTone => typeof t === 'string' && (BASS_ROWS as string[]).includes(t)
// Whether a name is a drum grid row
const isDrum = (d: string): d is DrumName => (DRUM_ROWS as string[]).includes(d)
// A number inside a range, or a fallback when it is not one
const clampNum = (v: unknown, lo: number, hi: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback

// Checks a lab style that came from outside (a link, storage) and repairs what it can.
// Anything unknown is dropped, so a broken or hostile link can't break the app.
export function normalizeLab(value: unknown): LabStyle | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const base = typeof v.base === 'string' && getStyle(v.base).id === v.base ? v.base : null
  if (!base) return null
  const beats: 3 | 4 = v.beats === 3 ? 3 : 4
  const bars: 1 | 2 = v.bars === 2 ? 2 : 1
  const steps = bars * beats * STEPS_PER_BEAT
  const one = beats * STEPS_PER_BEAT

  // Read a drum layer from stored data, or null when invalid
  const layer = (value: unknown, length: number): DrumLayer | null => {
    if (!value || typeof value !== 'object') return null
    const out: DrumLayer = {}
    for (const [drum, row] of Object.entries(value as Record<string, unknown>)) {
      if (!isDrum(drum) || !Array.isArray(row)) continue
      out[drum] = Array.from({ length }, (_, i) => {
        const c = row[i] as Record<string, unknown> | null | undefined
        if (!c || typeof c !== 'object') return null
        const cell: DrumCell = { vel: Math.round(clampNum(c.vel, 1, 127, 90)) }
        if (c.chance !== undefined) cell.chance = clampNum(c.chance, 0, 1, 1)
        if (c.dur !== undefined) cell.dur = clampNum(c.dur, 0.05, 8, 0.25)
        return cell
      })
    }
    return out
  }

  const bass = (v.bass ?? {}) as Record<string, unknown>
  const bassSteps = Array.isArray(bass.steps) ? bass.steps : []
  const comp = Array.isArray(v.comp) ? v.comp : []

  return {
    base,
    name: typeof v.name === 'string' ? v.name.slice(0, 60) : 'My style',
    swing: clampNum(v.swing, 0.5, 0.75, 0.5),
    beats,
    bars,
    fills: v.fills !== false,
    drums: layer(v.drums, steps) ?? {},
    drumsB: layer(v.drumsB, steps),
    fill: layer(v.fill, one),
    bass: {
      walking: bass.walking === true,
      steps: Array.from({ length: one }, (_, i) => (isTone(bassSteps[i]) ? bassSteps[i] : null)),
    },
    bassB: Array.isArray(v.bassB)
      ? Array.from({ length: one }, (_, i) => {
          const t: unknown = (v.bassB as unknown[])[i]
          return isTone(t) ? t : null
        })
      : null,
    comp: Array.from({ length: one }, (_, i) => comp[i] === true),
    compB: Array.isArray(v.compB) ? Array.from({ length: one }, (_, i) => (v.compB as unknown[])[i] === true) : null,
  }
}
