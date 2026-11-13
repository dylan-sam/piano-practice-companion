// Mining licks from melodies over chords: transcribed solos (Weimar Jazz Database), public domain
// lead sheets (OpenEWLD) and folk tunes (Nottingham Music Database).
//
// 1. Each song is laid on one time line of chords and notes (written bars, no repeats).
// 2. Windows are found where the chords make a known context: ii-V-I, minor ii-V-i, ii-V, V-I,
//    I-vi-ii-V, the I7-IV7 of a blues, or one chord held for a bar.
// 3. The notes of a window become a lick when they start a phrase near the window's start, keep
//    going through it, land on a chord tone of the I in a cadence, and fit the lick grid (no note
//    value shorter than a sixteenth; eighth-note triplets allowed; see onLickGrid).
// 4. Licks are moved to C, scored, cleared of duplicates and capped per tune and per player.
//
// Common patterns: runs of notes that several different players of the Weimar Jazz Database
// play with the same intervals from the same chord degree, after the pattern mining of the Dig
// That Lick project (K. Frieler, F. Hoeger, M. Pfleiderer and S. Dixon, "Two web applications for
// exploring melodic patterns in jazz solos", ISMIR 2018).

import { barMeters, type Chart } from '../src/music/chart'
import { chordTones, parseChord, type Chord } from '../src/music/chords'
import { onLickGrid, type LickInfo } from '../src/music/licks'
import { BAR_BEATS, makeLickChart, toMelodyNotes, transposeSymbol, type ChordSpan, type TimedNote } from './lickCharts'
import { chordScale } from './lickExercises'

/** A song to mine, with what to say about where it comes from. */
export interface MelodySource {
  chart: Chart
  source: string
  license: string
  tune: string
  performer?: string
  folk?: boolean // a major triad a fourth below the tonic is heard as a dominant (folk cadences)
}

interface ChordEvent { start: number; beats: number; symbol: string | null; chord: Chord | null }

/** A song laid on one time line. */
interface Timeline {
  source: MelodySource
  events: ChordEvent[]
  notes: TimedNote[]
  barStarts: number[]
  usable: boolean[] // bars a window may cover: full 4/4 bars
  joins: boolean[] // whether a window may run from bar i into bar i + 1 (no repeat, ending or jump between them)
}

/** Lay a song's written bars, chords and notes on one time line. */
export function timelineOf(source: MelodySource): Timeline {
  const { chart } = source
  const meters = barMeters(chart)
  const barStarts: number[] = []
  let time = 0
  meters.forEach((meter) => { barStarts.push(time); time += meter.beats })
  const events: ChordEvent[] = []
  chart.bars.forEach((bar, i) => {
    if (!bar.chords.length) {
      if (events.length) events[events.length - 1].beats += meters[i].beats
      return
    }
    let at = barStarts[i]
    for (const { symbol, beats } of bar.chords) {
      const last = events[events.length - 1]
      if (last && last.symbol === symbol && Math.abs(last.start + last.beats - at) < 1e-6) last.beats += beats
      else events.push({ start: at, beats, symbol, chord: symbol ? parseChord(symbol) : null })
      at += beats
    }
  })
  const usable = chart.bars.map((bar, i) => meters[i].beats === BAR_BEATS && !bar.partial && meters[i].time[0] === 4 && !bar.spacer)
  const joins = chart.bars.map((bar, i) => {
    const next = chart.bars[i + 1]
    return !!next && !bar.repeatEnd && !bar.directive && !bar.end && !next.repeatStart && !next.ending && !next.segno && !next.coda
  })
  const notes = (chart.melody?.notes ?? []).map((note) => ({ start: barStarts[note.bar] + note.at, beats: note.beats, pitch: note.pitch }))
    .sort((a, b) => a.start - b.start)
  return { source, events, notes, barStarts, usable, joins }
}

type Family = 'maj' | 'min' | 'dom' | 'half' | 'dim' | 'sus' | null

/** The family of a chord, as the contexts read it. */
function family(chord: Chord | null): Family {
  if (!chord) return null
  switch (chord.quality) {
    case 'maj7': case 'maj6': case 'maj': return 'maj'
    case 'min7': case 'min6': case 'min': case 'minMaj7': return 'min'
    case 'dom7': return 'dom'
    case 'half': return 'half'
    case 'dim7': case 'dim': return 'dim'
    case 'sus7': case 'sus': return 'sus'
    default: return null
  }
}

const altered = (chord: Chord) => ['alt', 'b9', '#9', 'b13', '#5'].some((t) => chord.tensions.includes(t))

/** A stretch of a song where the chords make a known context. */
export interface Window {
  start: number
  beats: number
  category: string
  context: string
  tonic: number // pitch class moved to C
  arrival?: number // cadences: when the I arrives
}

// Single-chord categories, by family
const ONE_CHORD: Record<string, [string, string]> = {
  maj: ['Major chord', 'maj7'], min: ['Minor chord', 'min7'], dom: ['Dominant chord', 'dom7'],
  half: ['Half-diminished chord', 'half'], dim: ['Diminished chord', 'dim7'],
}

/** The windows of a time line, each a known chord context starting on a bar line. */
export function findWindows(line: Timeline): Window[] {
  const { events } = line
  const out: Window[] = []
  const up4 = (a: Chord, b: Chord) => (b.root - a.root + 12) % 12 === 5
  const next = (i: number) => {
    const e = events[i + 1]
    return e && e.chord && Math.abs(events[i].start + events[i].beats - e.start) < 1e-6 ? e : null
  }
  const asDominant = (e: ChordEvent, tonic: ChordEvent | null) => family(e.chord) === 'dom' ||
    (!!line.source.folk && family(e.chord) === 'maj' && !!tonic?.chord && tonic.chord.root === line.source.chart.key)
  events.forEach((e0, i) => {
    if (!e0.chord) return
    const e1 = next(i)
    const e2 = e1 ? next(i + 1) : null
    const f0 = family(e0.chord)
    // Cadences and progressions
    if (e1 && (f0 === 'min' || f0 === 'half') && family(e1.chord) === 'dom' && up4(e0.chord, e1.chord!) &&
      e0.beats === e1.beats && (e0.beats === 2 || e0.beats === 4)) {
      const resolved = e2 && up4(e1.chord!, e2.chord!) && ['maj', 'min'].includes(family(e2.chord) ?? '') && e2.beats >= 2
      const tonic = (e1.chord!.root + 5) % 12
      if (resolved && family(e2!.chord) === 'maj' && f0 === 'min') {
        out.push({ start: e0.start, beats: e0.beats * 2 + Math.min(e2!.beats, 4), category: 'ii-V-I major', context: 'ii-V-I', tonic, arrival: e2!.start })
      } else if (resolved && family(e2!.chord) === 'min') {
        out.push({ start: e0.start, beats: e0.beats * 2 + Math.min(e2!.beats, 4), category: 'minor ii-V-i', context: 'ii-V-i', tonic, arrival: e2!.start })
      } else if (!resolved) {
        out.push({ start: e0.start, beats: e0.beats * 2, category: 'ii-V', context: 'ii-V', tonic })
      }
    }
    const before = events[i - 1]
    const isTwo = before?.chord && ['min', 'half'].includes(family(before.chord) ?? '') && up4(before.chord, e0.chord)
    if (e1 && asDominant(e0, e1) && up4(e0.chord, e1.chord!) && ['maj', 'min'].includes(family(e1.chord) ?? '') &&
      (e0.beats === 2 || e0.beats === 4) && e1.beats >= 2 && !isTwo) {
      out.push({ start: e0.start, beats: e0.beats + Math.min(e1.beats, 4), category: 'V-I', context: family(e1.chord) === 'min' ? 'V-i' : 'V-I', tonic: e1.chord!.root, arrival: e1.start })
    }
    const e3 = e2 ? next(i + 2) : null
    if (e1 && e2 && e3 && f0 === 'maj' && [e0, e1, e2, e3].every((e) => e.beats === 2) &&
      (e1.chord!.root - e0.chord.root + 12) % 12 === 9 && ['min', 'dom'].includes(family(e1.chord) ?? '') &&
      (e2.chord!.root - e0.chord.root + 12) % 12 === 2 && family(e2.chord) === 'min' &&
      (e3.chord!.root - e0.chord.root + 12) % 12 === 7 && family(e3.chord) === 'dom') {
      out.push({ start: e0.start, beats: 8, category: 'I-vi-ii-V turnaround', context: 'I-vi-ii-V', tonic: e0.chord.root })
    }
    if (e1 && f0 === 'dom' && family(e1.chord) === 'dom' && up4(e0.chord, e1.chord!) && e0.beats === 4 && e1.beats >= 4 && !line.source.folk) {
      out.push({ start: e0.start, beats: 8, category: 'Blues I7-IV7', context: 'I7-IV7', tonic: e0.chord.root })
    }
    // One chord held for a bar or more
    if (e0.beats >= 4 && f0 && ONE_CHORD[f0] && !line.source.folk) {
      const [category, context] = f0 === 'dom' && altered(e0.chord) ? ['Altered dominant', 'altered'] : ONE_CHORD[f0]
      out.push({ start: e0.start, beats: 4, category, context, tonic: e0.chord.root })
    }
  })
  return out.filter((w) => windowFits(line, w.start, w.beats))
}

/** Whether a stretch starts on a bar line and covers only full 4/4 bars that follow one another. */
function windowFits(line: Timeline, start: number, beats: number): boolean {
  const first = line.barStarts.findIndex((t) => Math.abs(t - start) < 1e-6)
  if (first < 0) return false
  const count = Math.ceil(beats / BAR_BEATS - 1e-9)
  for (let i = first; i < first + count; i++) {
    if (!line.usable[i]) return false
    if (i > first && !line.joins[i - 1]) return false
  }
  return true
}

const TWELFTHS_SIXTEENTH = new Set([3, 6, 9])
const TWELFTHS_TRIPLET = new Set([4, 8])

/**
 * Put notes (timed from the start of a window `length` beats long) on the lick grid, or null when
 * they do not fit: every note must start on a sixteenth or an eighth-note triplet, without mixing
 * the two in one beat. Played lengths are rounded to the grid, at least a sixteenth (a triplet
 * eighth in a triplet beat), and never past the next note or the end of the window.
 */
export function snapToGrid(notes: TimedNote[], length: number): TimedNote[] | null {
  const kinds = new Map<number, 's' | 't'>()
  const starts: number[] = []
  for (const note of notes) {
    const twelfths = note.start * 12
    if (Math.abs(twelfths - Math.round(twelfths)) > 0.02) return null
    const t = Math.round(twelfths)
    const beat = Math.floor(t / 12)
    const kind = TWELFTHS_SIXTEENTH.has(t % 12) ? 's' : TWELFTHS_TRIPLET.has(t % 12) ? 't' : t % 12 === 0 ? null : 'x'
    if (kind === 'x') return null
    if (kind) {
      if (kinds.get(beat) && kinds.get(beat) !== kind) return null
      kinds.set(beat, kind)
    }
    starts.push(t / 12)
  }
  const out: TimedNote[] = []
  for (let i = 0; i < notes.length; i++) {
    const start = starts[i]
    const limit = Math.min(i + 1 < notes.length ? starts[i + 1] : length, length)
    if (limit - start < 0.25 - 1e-6) return null
    const rawEnd = Math.min(start + notes[i].beats, limit)
    const beat = Math.floor(rawEnd + 1e-9)
    const grid = kinds.get(beat) === 't' ? [0, 1 / 3, 2 / 3, 1] : kinds.get(beat) === 's' ? [0, 0.25, 0.5, 0.75, 1]
      : [0, 0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1]
    let end = beat + grid.reduce((best, point) => (Math.abs(beat + point - rawEnd) < Math.abs(beat + best - rawEnd) ? point : best), 0)
    const shortest = kinds.get(Math.floor(start + 1e-9)) === 't' ? 1 / 3 : 0.25
    if (end - start < shortest - 1e-6) end = start + shortest
    end = Math.min(end, limit)
    out.push({ start, beats: Math.round((end - start) * 1e6) / 1e6, pitch: notes[i].pitch })
  }
  // An end rounded into a beat of the other grid is cut back to the next note or the beat
  return onLickGrid(toMelodyNotes(out)) ? out : null
}

/** A mined lick before it becomes a chart. */
export interface Candidate {
  window: Window
  line: Timeline
  notes: TimedNote[] // timed from the window's start, in C
  chords: ChordSpan[] // in C
  shift: number
  score: number
  level: number
  tags: string[]
}

/** The chord sounding at a time. */
function eventAt(line: Timeline, time: number): ChordEvent | undefined {
  return line.events.find((e) => e.start <= time + 1e-6 && time < e.start + e.beats - 1e-6)
}

/** The shift that moves a pitch class to C, kept within a tritone so the register barely moves. */
const shiftToC = (pc: number) => ((((-pc % 12) + 12 + 5) % 12) - 5)

/** Options for mining one collection. */
export interface MiningOptions {
  minNotesPerBeat: number // fewer notes than this (per beat of the window) is not a lick
}

/** The candidate lick of a window, or the reason it is not one. */
export function lickOf(line: Timeline, window: Window, options: MiningOptions): Candidate | string {
  const { start, beats } = window
  const end = start + beats
  if (line.notes.some((n) => n.start < start - 1e-6 && n.start + n.beats > start + 0.25)) return 'a note is held over the start'
  const inside = line.notes.filter((n) => n.start >= start - 1e-6 && n.start < end - 1e-6)
  if (inside.length < Math.max(4, Math.ceil(beats * options.minNotesPerBeat))) return 'too few notes'
  if (inside[0].start - start >= 1 - 1e-6) return 'starts late'
  const pitches = inside.map((n) => n.pitch)
  if (Math.max(...pitches) - Math.min(...pitches) > 19) return 'range wider than a 12th'
  if (new Set(pitches).size < 4) return 'fewer than 4 different notes'
  if (inside.filter((n, i) => i > 0 && n.pitch === inside[i - 1].pitch).length > (inside.length - 1) / 4) return 'too many repeated notes'
  if (inside.some((n, i) => i > 0 && Math.abs(n.pitch - inside[i - 1].pitch) > 12)) return 'leap wider than an octave'
  if (inside.some((n, i) => i > 0 && n.start - (inside[i - 1].start + inside[i - 1].beats) > 1.5)) return 'long rest inside'
  const lastEnd = Math.max(...inside.map((n) => n.start + n.beats))
  if (end - lastEnd > 2 && inside[inside.length - 1].start < end - 2) return 'stops early'
  if (window.arrival !== undefined) {
    const tonic = eventAt(line, window.arrival)?.chord
    const landing = inside.find((n) => n.start >= window.arrival! - 1e-6 && n.start < window.arrival! + 1 - 1e-6) ??
      line.notes.find((n) => n.start < window.arrival! - 1e-6 && n.start + n.beats > window.arrival! + 0.25)
    if (!tonic || !landing) return 'no note on the I'
    if (!tonesOf(tonic).includes(landing.pitch % 12) && !chordScale(tonic).slice(1, 2).includes(landing.pitch % 12)) return 'does not land on a chord tone of the I'
  }
  const snapped = snapToGrid(inside.map((n) => ({ ...n, start: n.start - start })), beats)
  if (!snapped) return 'off the sixteenth and triplet grid'
  const shift = shiftToC(window.tonic)
  const mean = pitches.reduce((sum, p) => sum + p, 0) / pitches.length + shift
  const octave = 12 * Math.round((67 - mean) / 12)
  const notes = snapped.map((n) => ({ ...n, pitch: n.pitch + shift + octave }))
  const chords: ChordSpan[] = line.events
    .filter((e) => e.start < end - 1e-6 && e.start + e.beats > start + 1e-6)
    .map((e): ChordSpan => [e.symbol ? transposeSymbol(e.symbol, shift) : null, Math.min(e.start + e.beats, end) - Math.max(e.start, start)])
  return { window, line, notes, chords, shift, ...rate(line, window, inside, snapped) }
}

/** A chord's tones as pitch classes. */
function tonesOf(chord: Chord): number[] {
  return chordTones(chord).map((interval) => (chord.root + interval) % 12)
}

/** Score a lick (higher is clearer to learn from) and find its level and devices. */
function rate(line: Timeline, window: Window, inside: TimedNote[], snapped: TimedNote[]): { score: number; level: number; tags: string[] } {
  const onBeat = inside.filter((n) => Math.abs(n.start - Math.round(n.start)) < 0.02)
  const fits = (n: TimedNote, rule: (c: Chord) => number[]) => {
    const chord = eventAt(line, n.start)?.chord
    return !!chord && (rule(chord).includes(n.pitch % 12) || (family(chord) === 'dom' && (n.pitch - chord.root + 12) % 12 === 3))
  }
  const strong = onBeat.length ? onBeat.filter((n) => fits(n, tonesOf)).length / onBeat.length : 0
  const inScale = onBeat.length ? onBeat.filter((n) => fits(n, chordScale)).length / onBeat.length : 0
  const moves = inside.slice(1).map((n, i) => n.pitch - inside[i].pitch)
  const steps = moves.length ? moves.filter((m) => Math.abs(m) <= 2).length / moves.length : 0
  const before = line.notes.filter((n) => n.start < inside[0].start - 1e-6).at(-1)
  const phraseStart = !before || inside[0].start - (before.start + before.beats) >= 0.5
  const density = inside.length / window.beats
  const lengths = new Set(snapped.map((n) => Math.round(n.beats * 12)))
  const score = 2 * strong + inScale + 0.5 * steps + (phraseStart ? 0.75 : 0) + (density >= 1.5 && density <= 3.5 ? 0.5 : 0) +
    (lengths.size >= 2 ? 0.25 : 0)
  const triplets = snapped.some((n) => [4, 8].includes(Math.round(n.start * 12) % 12))
  const sixteenths = snapped.some((n) => [3, 9].includes(Math.round(n.start * 12) % 12))
  const level = Math.min(3, (density < 1.25 ? 1 : density < 2.25 ? 2 : 3) + (triplets || sixteenths ? 1 : 0))
  const tags = [
    ...(triplets ? ['triplets'] : []),
    ...(sixteenths ? ['sixteenths'] : []),
    ...(moves.some((m, i) => Math.abs(m) === 1 && Math.abs(moves[i + 1] ?? 0) === 1 && Math.sign(m) === Math.sign(moves[i + 1])) ? ['chromatic'] : []),
    ...(moves.some((m, i) => [3, 4].includes(Math.abs(m)) && [3, 4].includes(Math.abs(moves[i + 1] ?? 0)) && Math.sign(m) === Math.sign(moves[i + 1])) ? ['arpeggio'] : []),
    ...(phraseStart ? ['phrase start'] : []),
  ]
  return { score, level, tags }
}

/** How many licks of each category to keep, at most per tune and per player. */
export interface Selection { perCategory: number; perTune: number; perPlayer: number }

/** The best licks of each category, without duplicates, spread over tunes and players. */
export function selectLicks(candidates: Candidate[], selection: Selection): Candidate[] {
  const byCategory = new Map<string, Candidate[]>()
  for (const c of candidates) byCategory.set(c.window.category, [...(byCategory.get(c.window.category) ?? []), c])
  const out: Candidate[] = []
  for (const list of byCategory.values()) {
    const seen = new Set<string>()
    const tunes = new Map<string, number>()
    const players = new Map<string, number>()
    let kept = 0
    for (const c of [...list].sort((a, b) => b.score - a.score || a.line.source.tune.localeCompare(b.line.source.tune) || a.window.start - b.window.start)) {
      if (kept >= selection.perCategory) break
      const signature = c.notes.map((n) => `${n.pitch % 12}@${Math.round(n.start * 12)}`).join(' ')
      const tune = `${c.line.source.tune}|${c.line.source.performer ?? ''}`
      const player = c.line.source.performer ?? c.line.source.tune
      if (seen.has(signature) || (tunes.get(tune) ?? 0) >= selection.perTune || (players.get(player) ?? 0) >= selection.perPlayer) continue
      seen.add(signature)
      tunes.set(tune, (tunes.get(tune) ?? 0) + 1)
      players.set(player, (players.get(player) ?? 0) + 1)
      out.push(c)
      kept++
    }
  }
  return out
}

/** The bar number (1 = first written bar) of a time on a song's time line. */
function barNumber(line: Timeline, time: number): number {
  let bar = 0
  while (bar + 1 < line.barStarts.length && line.barStarts[bar + 1] <= time + 1e-6) bar++
  return bar + 1
}

/** A mined lick as a chart. */
export function candidateChart(c: Candidate, index: number, prefix: string): Chart {
  const { source } = c.line
  const bar = barNumber(c.line, c.window.start)
  const info: LickInfo = {
    kind: 'lick', category: c.window.category, context: c.window.context, source: source.source, license: source.license,
    performer: source.performer, tune: source.tune, bar, tags: c.tags, level: c.level,
  }
  const who = source.performer ? `${source.performer}, ${source.tune}` : source.tune
  return makeLickChart({
    title: `${prefix}${c.window.category} ${index}`,
    composer: `${who} (bar ${bar})`,
    chords: c.chords, notes: c.notes, info,
    bpm: Math.min(160, Math.max(60, Math.round(source.chart.bpm))),
    style: source.chart.style,
    minor: c.window.context.endsWith('-i') || c.window.context === 'V-i' || undefined,
  })
}

/** Mine every window of every song; returns the candidates and how many windows were turned down, by reason. */
export function mineLicks(sources: MelodySource[], options: MiningOptions): { candidates: Candidate[]; rejected: Map<string, number> } {
  const candidates: Candidate[] = []
  const rejected = new Map<string, number>()
  for (const source of sources) {
    const line = timelineOf(source)
    for (const window of findWindows(line)) {
      const result = lickOf(line, window, options)
      if (typeof result === 'string') rejected.set(result, (rejected.get(result) ?? 0) + 1)
      else candidates.push(result)
    }
  }
  return { candidates, rejected }
}

// Names of the chord degrees a pattern starts on
const DEGREES = ['root', 'b9', '9th', 'minor 3rd', 'major 3rd', '11th', '#11', '5th', 'b13', '13th', 'minor 7th', 'major 7th']
const FAMILY_NAMES: Record<string, string> = { maj: 'major chord', min: 'minor chord', dom: 'dominant chord', half: 'half-diminished chord', dim: 'diminished chord', sus: 'sus chord' }

/** A pattern many players share, with one place it is played. */
export interface Pattern {
  key: string
  players: Set<string>
  instances: { line: Timeline; first: number }[]
}

/**
 * Runs of `length` notes, played without a break, that start on the same degree of the same
 * chord family and move by the same intervals; kept when at least `minPlayers` players play them
 * and they are more than a plain scale run.
 */
export function findPatterns(sources: MelodySource[], length: number, minPlayers: number): Pattern[] {
  const patterns = new Map<string, Pattern>()
  for (const source of sources) {
    const line = timelineOf(source)
    const { notes } = line
    for (let i = 0; i + length <= notes.length; i++) {
      const run = notes.slice(i, i + length)
      if (run.some((n, k) => k > 0 && (n.start - run[k - 1].start > 1 + 1e-6 || n.start - run[k - 1].start < 0.25 - 1e-6))) continue
      const chord = eventAt(line, run[0].start)?.chord
      const fam = family(chord ?? null)
      if (!chord || !fam) continue
      const intervals = run.slice(1).map((n, k) => n.pitch - run[k].pitch)
      const key = `${fam}|${(run[0].pitch - chord.root + 120) % 12}|${intervals.join(',')}`
      const pattern = patterns.get(key) ?? { key, players: new Set<string>(), instances: [] }
      pattern.players.add(source.performer ?? source.tune)
      pattern.instances.push({ line, first: i })
      patterns.set(key, pattern)
    }
  }
  return [...patterns.values()].filter((p) => {
    if (p.players.size < minPlayers) return false
    const intervals = p.key.split('|')[2].split(',').map(Number)
    const turns = intervals.slice(1).filter((m, k) => Math.sign(m) !== Math.sign(intervals[k]) && m !== 0).length
    const leaps = intervals.filter((m) => Math.abs(m) >= 3).length
    return turns >= 2 || leaps >= 2
  }).sort((a, b) => b.players.size - a.players.size || b.instances.length - a.instances.length || a.key.localeCompare(b.key))
}

/** Keep patterns that are not the same run shifted by a note or two from one kept before. */
export function distinctPatterns(patterns: Pattern[], max: number): Pattern[] {
  const kept: Pattern[] = []
  const taken = new Set<string>()
  for (const p of patterns) {
    if (kept.length >= max) break
    const intervals = p.key.split('|')[2].split(',')
    const pieces = [intervals.slice(1).join(','), intervals.slice(0, -1).join(',')]
    if (pieces.some((piece) => taken.has(piece))) continue
    kept.push(p)
    taken.add(pieces[0])
    taken.add(pieces[1])
  }
  return kept
}

/** A pattern as a chart: its first instance that fits the lick grid, moved to C, in the bars it was played in. */
export function patternChart(p: Pattern, index: number): Chart | null {
  const [fam, degree] = p.key.split('|')
  for (const { line, first } of p.instances) {
    const length = p.key.split('|')[2].split(',').length + 1
    const run = line.notes.slice(first, first + length)
    const bar = barNumber(line, run[0].start) - 1
    const start = line.barStarts[bar]
    const lastBar = barNumber(line, run[run.length - 1].start) - 1
    const end = (line.barStarts[lastBar + 1] ?? line.barStarts[lastBar] + BAR_BEATS)
    if (!windowFits(line, start, end - start)) continue
    const snapped = snapToGrid(run.map((n) => ({ ...n, start: n.start - start })), end - start)
    const chord = eventAt(line, run[0].start)?.chord
    if (!snapped || !chord) continue
    const shift = shiftToC(chord.root)
    const mean = run.reduce((sum, n) => sum + n.pitch, 0) / run.length + shift
    const octave = 12 * Math.round((67 - mean) / 12)
    const chords: ChordSpan[] = line.events
      .filter((e) => e.start < end - 1e-6 && e.start + e.beats > start + 1e-6)
      .map((e): ChordSpan => [e.symbol ? transposeSymbol(e.symbol, shift) : null, Math.min(e.start + e.beats, end) - Math.max(e.start, start)])
    const { source } = line
    const info: LickInfo = {
      kind: 'pattern', category: 'Common patterns', context: fam, source: source.source, license: source.license,
      performer: source.performer, tune: source.tune, bar: bar + 1, count: p.players.size,
      tags: snapped.some((n) => [4, 8].includes(Math.round(n.start * 12) % 12)) ? ['triplets'] : [],
      level: snapped.length / ((end - start) || 1) > 2 ? 3 : 2,
    }
    return makeLickChart({
      title: `Pattern ${index}: from the ${DEGREES[Number(degree)]} of a ${FAMILY_NAMES[fam]}`,
      composer: `${p.players.size} players, e.g. ${source.performer}, ${source.tune} (bar ${bar + 1})`,
      chords, notes: snapped.map((n) => ({ ...n, pitch: n.pitch + shift + octave })), info,
      bpm: Math.min(160, Math.max(60, Math.round(source.chart.bpm))), style: source.chart.style,
    })
  }
  return null
}
