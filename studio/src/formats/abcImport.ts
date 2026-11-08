// Read tunes in ABC notation (the Nottingham Music Database, folk tune books) into charts with a
// melody. abcjs (MIT, Paul Rosen and Gregory Dyke) parses the ABC text; this module walks the
// parsed tune bar by bar: note lengths (with broken rhythm and tuplets), pitches (key signature,
// accidentals that last for the bar, ties), chord symbols in quotes, repeats, endings, inline
// key, meter and part changes. A P: header that orders the parts (AABA) is written out.

import * as abcjsModule from 'abcjs'
import type { Chart, ChartBar, TimeSignature } from '../music/chart'
import { isChartSymbol, toChartSymbol } from '../music/notation'
import type { MelodyNote } from '../music/melody'
import { leadSheetChart, type LeadSheetMeta, type ReadMeasure } from './leadSheet'

// abcjs is a CommonJS module: its functions are on the default export under Node
const abcjs = ((abcjsModule as unknown as { default?: typeof abcjsModule }).default ?? abcjsModule)

const SCALE = [0, 2, 4, 5, 7, 9, 11]
const LETTER_PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
const ACCIDENTAL: Record<string, number> = { sharp: 1, flat: -1, natural: 0, dblsharp: 2, dblflat: -2 }
/** A chord symbol, or a bass note alone, as read from an ABC chord text. */
type AbcChord = { symbol: string } | { bass: string } | null

/** A note name from an ABC letter and accidental (+ and - are the Nottingham sharp and flat). */
function noteName(letter: string, accidental: string): string {
  const shift = accidental === '+' || accidental === '#' ? '#' : accidental === '-' || accidental === 'b' ? 'b' : ''
  return letter.toUpperCase() + shift
}

/**
 * Read an ABC chord text into a chart symbol. Lower-case letters alone ("e", "f#") are a bass
 * note under the chord already playing; brackets mark an optional chord, which is played.
 * Returns null for a text that is not a chord.
 */
export function abcChord(text: string): AbcChord {
  // An optional chord in brackets, and a placement code (@<.5: half a beat earlier) are dropped
  const name = text.trim().replace(/^\/?@[<>]?[\d.,]*/, '').replace(/^\((.*)\)$/, '$1')
  const bass = /^([a-g])([#b+-]?)$/.exec(name)
  if (bass) return { bass: noteName(bass[1], bass[2]) }
  // G/dim is a diminished G; a bass in ABC style (D/f+) is written as a note name (D/F#)
  const typed = name.replace(/\/dim$/, 'dim').replace(/\/([b#]\d+)$/, '$1').replace(/\/([a-gA-G])([+=-]?)$/, (_, letter: string, accidental: string) => `/${noteName(letter, accidental)}`)
  if (!/^[A-G]/.test(typed)) return null
  const symbol = toChartSymbol(typed)
  return symbol ? { symbol } : null
}

/** The chord without its bass note (G7/B is G7). */
const withoutBass = (symbol: string) => symbol.replace(/\/[A-G][#b]?$/, '')

/** Whether a text in quotes looks like a chord that could not be read (rather than a remark). */
const looksLikeChord = (text: string) => /^\(?[A-Ga-g][#b+-]?[^\s]{0,6}\)?$/.test(text.trim())

/** The tonic and mode of an abcjs key. */
function keyOf(key: { root?: string; acc?: string; mode?: string } | undefined): { key: number; minor: boolean } {
  const root = key?.root && key.root !== 'none' ? key.root : 'C'
  const pc = (LETTER_PC[root.toLowerCase()] ?? 0) + (key?.acc === '#' ? 1 : key?.acc === 'b' ? -1 : 0)
  const mode = (key?.mode ?? '').toLowerCase()
  return { key: (pc + 12) % 12, minor: mode === 'm' || mode.startsWith('min') || mode.startsWith('aeo') || mode.startsWith('dor') || mode.startsWith('phr') }
}

/** The accidentals of a key signature, by letter. */
function keyAccidentals(key: { accidentals?: { acc: string; note: string }[] } | undefined): Map<string, number> {
  return new Map((key?.accidentals ?? []).map((a) => [a.note.toLowerCase(), ACCIDENTAL[a.acc] ?? 0]))
}

/** A tune read from an ABC book, or why it could not be read. */
export interface AbcResult {
  title: string
  chart?: Chart
  error?: string
  warnings: string[]
}

type AbcElement = Record<string, unknown> & { el_type: string }

/** Read one parsed abcjs tune into bars. */
function readTune(tune: abcjsModule.TuneObject, warnings: string[]): { measures: ReadMeasure[]; meta: { key: number; minor: boolean } } {
  const lines = (tune.lines as unknown as { staff?: { key?: unknown; meter?: unknown; voices: AbcElement[][] }[] }[])
    .filter((line) => line.staff?.length)
  const firstStaff = lines[0]?.staff?.[0]
  if (!firstStaff) throw new Error('No music in this tune')
  if (firstStaff.voices.length > 1 || lines.some((l) => (l.staff?.length ?? 0) > 1)) warnings.push('Only the first voice is read')
  const meterFraction = tune.getMeterFraction()
  let meter: TimeSignature = meterFraction?.num ? [meterFraction.num, meterFraction.den ?? 4] : [4, 4]
  const startKey = firstStaff.key as Parameters<typeof keyOf>[0] & Parameters<typeof keyAccidentals>[0]
  let keySig = keyAccidentals(startKey)
  let keyNow = keyOf(startKey) // the key in force, to mark changes of key on the chart
  /** Follow a K: change: its accidentals from now on, and a key change mark on its bar. */
  const changeKey = (key: Parameters<typeof keyOf>[0] & Parameters<typeof keyAccidentals>[0]) => {
    keySig = keyAccidentals(key)
    const next = keyOf(key)
    if (next.key === keyNow.key && next.minor === keyNow.minor) return
    keyNow = next
    const mark = { keys: [{ beats: 0, key: next.key, minor: next.minor }] }
    if (position < 1e-6) Object.assign(current.marks, mark)
    else Object.assign(pending, mark)
  }
  const measures: ReadMeasure[] = []
  let current: ReadMeasure = { meter, content: 0, notes: [], chords: [], marks: {} }
  let pending: Partial<ChartBar> = {} // marks for the next bar (a repeat start, an ending)
  let position = 0
  let barAccidentals = new Map<number, number>()
  let triplet = 1
  let tie: MelodyNote | null = null // a note whose tie goes on into the next one
  let tieStaffPitch = 0
  let playing: string | null = null

  /**
   * Close the bar being read. A bar line with nothing before it (|: at the start of a line) adds
   * its closing marks to the bar before and passes the marks gathered so far on to the next bar.
   */
  const closeBar = (marks: Partial<ChartBar>, next: Partial<ChartBar>) => {
    let carried: Partial<ChartBar> = {}
    if (position > 1e-6 || current.notes.length) {
      current.content = position
      Object.assign(current.marks, marks)
      measures.push(current)
    } else {
      if (measures.length) Object.assign(measures[measures.length - 1].marks, marks)
      carried = current.marks
    }
    current = { meter, content: 0, notes: [], chords: [...(position > 1e-6 ? [] : current.chords)], marks: { ...carried, ...pending, ...next } }
    pending = {}
    position = 0
    barAccidentals = new Map()
  }

  for (const line of lines) {
    const staff = line.staff![0]
    // A meter or key changed on its own line (M:6/8 between parts) is given with the staff line
    const lineMeter = (staff.meter as { value?: { num: string; den: string }[] } | undefined)?.value?.[0]
    if (lineMeter && Number(lineMeter.num) && Number(lineMeter.den)) {
      meter = [Number(lineMeter.num), Number(lineMeter.den)]
      if (position < 1e-6) current.meter = meter
    }
    if (staff.key && line !== lines[0]) changeKey(staff.key as Parameters<typeof changeKey>[0])
    for (const element of staff.voices[0] ?? []) {
      switch (element.el_type) {
        case 'note': {
          const duration = Number(element.duration ?? 0) * 4
          if (element.startTriplet) triplet = Number(element.tripletMultiplier ?? 1)
          const length = duration * triplet
          if (element.endTriplet) triplet = 1
          // abcjs joins the chord texts written on one note with a line break ("D""a" is "D\na")
          const texts = ((element.chord as { name: string; position?: string }[] | undefined) ?? [])
            .filter((chord) => !chord.position || chord.position === 'default') // not an annotation (^text)
            .flatMap((chord) => chord.name.split('\n'))
            // Several chords or a remark in one text ("G (A7)", "C  drone"): each chord is read, words are skipped
            .flatMap((name) => (/\s/.test(name.trim()) ? name.trim().split(/\s+/).filter((word) => abcChord(word)) : [name]))
            .map((name) => ({ name }))
          for (const chord of texts) {
            const read = abcChord(chord.name)
            if (!read) {
              if (looksLikeChord(chord.name)) warnings.push(`Unreadable chord ${JSON.stringify(chord.name)} in bar ${measures.length + 1}`)
              continue
            }
            const symbol: string | null = 'symbol' in read ? read.symbol : playing ? `${withoutBass(playing)}/${read.bass}` : null
            if (symbol === null || !isChartSymbol(symbol)) {
              warnings.push(`Bass note ${JSON.stringify(chord.name)} without a chord in bar ${measures.length + 1}`)
              continue
            }
            // A bass note written next to its chord ("D""a") completes that chord
            const last = current.chords[current.chords.length - 1]
            if ('bass' in read && last && Math.abs(last.at - position) < 1e-6) last.symbol = symbol
            else current.chords.push({ at: position, symbol })
            playing = symbol
          }
          const rest = element.rest as { type: string } | undefined
          const pitches = element.pitches as { pitch: number; accidental?: string; startTie?: unknown; endTie?: boolean }[] | undefined
          if (rest || !pitches?.length) {
            if (rest?.type !== 'spacer') position += length
            tie = null
            break
          }
          // The melody is the top note of a chord
          const top = pitches.reduce((a, b) => (b.pitch > a.pitch ? b : a))
          const letter = 'cdefgab'[((top.pitch % 7) + 7) % 7]
          if (top.accidental !== undefined) barAccidentals.set(top.pitch, ACCIDENTAL[top.accidental] ?? 0)
          const shift = barAccidentals.get(top.pitch) ?? keySig.get(letter) ?? 0
          let midi = 60 + 12 * Math.floor(top.pitch / 7) + SCALE[((top.pitch % 7) + 7) % 7] + shift
          if (top.endTie && tie && tieStaffPitch === top.pitch) {
            // A tied note keeps its pitch over the bar line, whatever the new bar's accidentals
            midi = tie.pitch
            tie.beats += length
          } else {
            const note: MelodyNote = { bar: measures.length, at: position, beats: length, pitch: midi }
            current.notes.push(note)
            tie = note
          }
          if (top.startTie) tieStaffPitch = top.pitch
          else tie = null
          position += length
          break
        }
        case 'bar': {
          const type = String(element.type)
          const ending = element.startEnding ? Number(String(element.startEnding).split(/[,-]/)[0]) || 1 : undefined
          if (type === 'bar_invisible' && position < 1e-6) {
            if (ending) current.marks.ending = ending
            break
          }
          const marks: Partial<ChartBar> = {}
          const next: Partial<ChartBar> = ending ? { ending } : {}
          if (type === 'bar_right_repeat' || type === 'bar_dbl_repeat') marks.repeatEnd = true
          if (type === 'bar_left_repeat' || type === 'bar_dbl_repeat') next.repeatStart = true
          if (type === 'bar_thin_thick') marks.barline = 'final'
          if (type === 'bar_thin_thin') marks.barline = 'double'
          closeBar(marks, next)
          break
        }
        case 'key':
          changeKey(element as Parameters<typeof changeKey>[0])
          break
        case 'meter': {
          const value = (element.value as { num: string; den: string }[] | undefined)?.[0]
          if (value && Number(value.num) && Number(value.den)) {
            meter = [Number(value.num), Number(value.den)]
            if (position < 1e-6) current.meter = meter
          }
          break
        }
        case 'part':
          if (position < 1e-6) current.marks.section = String(element.title ?? '').slice(0, 6)
          else pending.section = String(element.title ?? '').slice(0, 6)
          break
        default:
          break
      }
    }
  }
  closeBar({}, {})
  if (!measures.length) throw new Error('No bars in this tune')
  return { measures, meta: keyOf(startKey) }
}

/**
 * The parts to play from a P: header: letters, and groups repeated a number of times, A(AB)4 is
 * A then AB four times; remarks after the order (AABA last time only) and formatting codes are
 * left out. Null when no order can be read.
 */
export function partPlan(order: string): string | null {
  const text = order.replace(/\/f[0-9A-Z]?/g, '').replace(/"/g, '').replace(/\([a-z][^)]*\)/g, '').replace(/\s+(times|x)\s*/gi, '')
  const lead = /^\s*([A-Z()\d\s]+?)(?=\s+[a-z]|$)/.exec(text.replace(/^\s*play\s+/i, ''))?.[1]?.replace(/\s+/g, '')
  if (!lead || /[a-z]/.test(lead)) return null
  /** Expand one level of a plan: letters, and (group)count. */
  const expand = (plan: string): string | null => {
    let out = ''
    for (let i = 0; i < plan.length;) {
      if (/[A-Z]/.test(plan[i])) {
        out += plan[i++]
      } else if (plan[i] === '(') {
        let depth = 1
        let j = i + 1
        while (j < plan.length && depth) depth += plan[j] === '(' ? 1 : plan[j] === ')' ? -1 : 0, j++
        if (depth) return null
        const inner = expand(plan.slice(i + 1, j - 1))
        const count = /^\d+/.exec(plan.slice(j))?.[0] ?? '1'
        if (inner === null) return null
        out += inner.repeat(Number(count))
        i = j + (count === '1' && !/^1/.test(plan.slice(j)) ? 0 : count.length)
      } else {
        return null
      }
    }
    return out
  }
  return expand(lead)
}

/**
 * Write out the parts in the order a P: header gives (AABA): a part played twice in a row is
 * repeated, other orders copy the part's bars. Orders with brackets or words are left as written.
 */
function orderParts(measures: ReadMeasure[], order: string, warnings: string[]): ReadMeasure[] {
  const plan = partPlan(order)
  if (!plan || plan.length < 2) {
    if (!/^[A-Z]?$/.test(order.trim())) warnings.push(`Part order "${order}" is not followed: the parts are played as written`)
    return measures
  }
  const parts = new Map<string, ReadMeasure[]>()
  let name = ''
  for (const m of measures) {
    if (m.marks.section) name = m.marks.section
    if (!parts.has(name)) parts.set(name, [])
    parts.get(name)!.push(m)
  }
  if ([...parts.keys()].every((p) => !p)) {
    // The tune names no parts: the header is a remark for the players
    warnings.push(`Part order "${order}" is not followed: the tune names no parts`)
    return measures
  }
  if (![...plan].every((p) => parts.has(p)) || [...parts.keys()].some((p) => p && !plan.includes(p))) {
    throw new Error(`the part order "${order}" does not match the parts written`)
  }
  const out: ReadMeasure[] = []
  for (let i = 0; i < plan.length;) {
    let times = 1
    while (plan[i + times] === plan[i]) times++
    const bars = parts.get(plan[i])!
    const hasRepeats = bars.some((m) => m.marks.repeatStart || m.marks.repeatEnd || m.marks.ending)
    const copies = times > 1 && hasRepeats ? times : 1
    for (let c = 0; c < copies; c++) {
      bars.forEach((m, j) => {
        const marks = { ...m.marks }
        if (c > 0 || out.some((o) => o.marks.section === plan[i] && j === 0)) delete marks.section
        if (times > 1 && !hasRepeats) {
          if (j === 0) marks.repeatStart = true
          if (j === bars.length - 1) {
            marks.repeatEnd = true
            if (times > 2) marks.repeatTimes = times
          }
        }
        if (j === 0 && c === 0) marks.section = plan[i]
        const index = out.length
        out.push({ ...m, marks, notes: m.notes.map((n) => ({ ...n, bar: index })) })
      })
    }
    i += times
  }
  return out
}

/** Read every tune of an ABC book (X: fields start the tunes). */
export function parseAbcBook(text: string, meta: Pick<LeadSheetMeta, 'style' | 'source'> & { bpm?: number }): AbcResult[] {
  const tunes = abcjs.parseOnly(text) as abcjsModule.TuneObject[]
  return tunes.map((tune) => {
    const info = tune.metaText as Record<string, string | undefined>
    const title = (info.title ?? 'Untitled').split('\n')[0].trim()
    const warnings: string[] = []
    try {
      const read = readTune(tune, warnings)
      const measures = info.partOrder ? orderParts(read.measures, info.partOrder, warnings) : read.measures
      const tempo = (info.tempo as unknown as { bpm?: number } | undefined)?.bpm
      const chart = leadSheetChart({
        title, composer: info.composer, ...read.meta, bpm: tempo ?? meta.bpm ?? 120,
        style: meta.style, source: meta.source,
      }, measures)
      return { title, chart, warnings }
    } catch (error) {
      return { title, error: error instanceof Error ? error.message : String(error), warnings }
    }
  })
}
