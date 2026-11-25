// Chord substitutions (the players' Substitutions menu): the chart a chorus is played from, with
// some chords replaced by the standard jazz reharmonisations, so the band, the sheet (in a colour),
// the chord helper and the downloads all play the same chords. Roman numerals count from the
// chord a chord leads to (any key area, not only the song's key); the examples are in C.
//
//   Add the ii before a long V7    V7 (a bar or more) -> ii-7 V7       G7 -> D-7 G7 (half each)
//   Passing diminished chord       I ii-7 -> I #Io7 ii-7               C D-7 -> C C#o7 D-7
//                                  ii-7 iii-7 -> ii-7 #iio7 iii-7      D-7 E-7 -> D-7 D#o7 E-7
//                                  I vi-7 ii-7 -> I #Io7 ii-7          C A-7 D-7 -> C C#o7 D-7
//   Backdoor ii-V                  ii-7 V7 I -> iv-7 bVII7 I           D-7 G7 C -> F-7 Bb7 C
//   Turnaround with dominants      vi-7 ii-7 -> VI7 ii-7               A-7 D-7 -> A7 D-7
//   Secondary dominant on the ii   ii-7 V7 I -> II7 V7 I               D-7 G7 C -> D7 G7 C
//   Tritone substitution           V7 I -> bII7 I                      G7 C -> Db7 C
//   Altered dominant               V7 I -> V7b9 I, V7 i-7 -> V7b9b13   G7 C -> G7b9 C, G7 C-7 -> G7b9b13 C-7
//
// The passing diminished chord leads up by half steps to any minor chord a whole step above a chord
// (I to ii, ii to iii, V to vi...): on the chord's last beats, or in place of a short chord between
// the two (the vi or VI7 of I vi ii V, a repeated I; not a major chord). The tritone substitution replaces any dominant 7th going down a 5th, whatever chord it goes to:
// a V7, a secondary dominant (VI7 to ii), I7 to IV7 in a blues. It leaves alone a dominant that
// goes elsewhere (a blues IV7 back to I7, a backdoor bVII7) and the other chords.
//
// The ticked substitutions are applied one after another, in the order the person sets (the
// menu's list, top first): each one works on the chart the ones before it made, so the order
// matters. Turnaround, then secondary dominant, then tritone substitution: C A-7 D-7 G7 -> C A7 D-7 G7
// -> C A7 D7 G7 -> C Eb7 Ab7 Db7 (Lady Bird); with the secondary dominant first, the turnaround finds
// D7 after A-7, no longer a minor chord, and leaves it. Sources: Levine, The Jazz Piano Book
// (1989, the tritone substitution) and The Jazz Theory Book (1995, reharmonisation); Open Music
// Theory, "Substitutions" and the chapters on applied chords and embellishing diminished chords.
//
// A lead sheet keeps its melody: a substitution under a melody note of a beat or more that is not
// a note of the new chord's scale is left out (the clash rule).

import { barMeters, type BarChord, type Chart } from './chart'
import { isAlteredChord, noteName, parseChord, spellRoot, type Chord } from './chords'

export type SubstitutionId = 'addII' | 'secondary' | 'turnaround' | 'backdoor' | 'passingDim' | 'tritone' | 'altered'

/** When the substitutions are played: every chorus, from a chorus on, every other chorus, or here and there at random. */
export type SubstitutionWhen =
  | { kind: 'always' }
  | { kind: 'from'; chorus: number } // counted from 1: 2 = from the second chorus
  | { kind: 'alternate' } // the 2nd, 4th, 6th... chorus
  | { kind: 'random' } // each place, each chorus, one time in two (seeded)

export interface SubstitutionSettings {
  ids: SubstitutionId[] // the ticked ones, in the order they are applied
  order?: SubstitutionId[] // the menu's order, all of them (the ticked ones keep it); the default when left out
  when: SubstitutionWhen
  seed: number // the random choices, the same for the band, the sheet and the downloads
}

/** A substitution of the menu: its name and its Roman numerals (examples in C in the header above). */
export interface Substitution { id: SubstitutionId; name: string; roman: string }

/** The substitutions offered, in the menu's default order (an order that lets them build on each other). */
export const SUBSTITUTIONS: Substitution[] = [
  { id: 'addII', name: 'Add the ii before a long V7', roman: 'V7 (a bar or more) → ii−7 V7' },
  { id: 'passingDim', name: 'Passing diminished chord', roman: 'I ii−7 → I ♯I°7 ii−7, ii−7 iii−7 → ii−7 ♯ii°7 iii−7' },
  { id: 'backdoor', name: 'Backdoor ii-V', roman: 'ii−7 V7 I → iv−7 ♭VII7 I' },
  { id: 'turnaround', name: 'Turnaround with dominants', roman: 'vi−7 ii−7 → VI7 ii−7' },
  { id: 'secondary', name: 'Secondary dominant on the ii', roman: 'ii−7 V7 I → II7 V7 I' },
  { id: 'tritone', name: 'Tritone substitution', roman: 'V7 I → ♭II7 I' },
  { id: 'altered', name: 'Altered dominant', roman: 'V7 I → V7♭9 I, V7 i−7 → V7♭9♭13 i−7' },
]

/** The menu's order of a setting: all the substitutions, the person's order first. */
export function substitutionOrder(settings: SubstitutionSettings | undefined): SubstitutionId[] {
  const order = (settings?.order ?? []).filter((id, i, all) => SUBSTITUTIONS.some((s) => s.id === id) && all.indexOf(id) === i)
  return [...order, ...SUBSTITUTIONS.map((s) => s.id).filter((id) => !order.includes(id))]
}

/** A setting with the menu in a new order: the ticked ones are applied in it. */
export function withOrder(settings: SubstitutionSettings, order: SubstitutionId[]): SubstitutionSettings {
  return { ...settings, order, ids: order.filter((id) => settings.ids.includes(id)) }
}

/** A setting with one substitution ticked or not, in the menu's order. */
export function withTicked(settings: SubstitutionSettings, id: SubstitutionId, on: boolean): SubstitutionSettings {
  const order = substitutionOrder(settings)
  return { ...settings, order, ids: order.filter((s) => (s === id ? on : settings.ids.includes(s))) }
}

export const NO_SUBSTITUTIONS: SubstitutionSettings = { ids: [], when: { kind: 'always' }, seed: 1 }

/** Whether any substitution is chosen. */
export const substitutes = (settings: SubstitutionSettings | undefined): settings is SubstitutionSettings => !!settings?.ids.length

/** Whether the substitutions play in a chorus (counted from 0); random choices are made place by place. */
function playsInChorus(when: SubstitutionWhen, chorus: number): boolean {
  if (when.kind === 'from') return chorus + 1 >= when.chorus
  if (when.kind === 'alternate') return chorus % 2 === 1
  return true
}

/** A seeded coin for one place, one rule, one chorus (random mode). */
function coin(seed: number, ...parts: number[]): boolean {
  let h = seed | 0
  for (const part of parts) h = Math.imul(h ^ (part + 0x9e3779b9), 0x85ebca6b) ^ (h >>> 13)
  h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35)
  return ((h ^ (h >>> 15)) >>> 0) % 2 === 0
}

/** A chord of the chart in written order, with where it is and how long it lasts with the blank bars after it. */
interface Spot { bar: number; index: number; chord: Chord; beats: number; length: number; blanks: { bar: number; beats: number }[] }

const isDominant = (c: Chord) => c.quality === 'dom7'
const isMinor = (c: Chord) => c.quality === 'min7' || c.quality === 'min'
const isMajor = (c: Chord) => c.quality === 'maj' || c.quality === 'maj7' || c.quality === 'maj6'
const downFifth = (a: Chord, b: Chord) => (b.root - a.root + 12) % 12 === 5

// The notes a substitute's melody may hold (semitones above its root): its chord tones and the
// tensions of its usual scale. A long melody note outside them clashes
const ALLOWED: Record<string, number[]> = {
  dom: [0, 2, 4, 7, 9, 10], // Mixolydian without the 4th
  tritone: [0, 2, 4, 6, 7, 9, 10], // Lydian dominant: the substitute's #11 is the old root
  min7: [0, 2, 3, 5, 7, 9, 10], // Dorian
  half: [0, 2, 3, 5, 6, 8, 10],
  dim: [0, 2, 3, 5, 6, 8, 9, 11], // the diminished scale
  b9: [0, 1, 3, 4, 6, 7, 9, 10], // half-whole: the b9 with the natural 13
  b9b13: [0, 1, 3, 4, 5, 7, 8, 10], // Mixolydian b9 b13, and the #9
}

/** A chart's chords in written order (spacers and N.C. left out), each with its length over blank bars. */
function spotsOf(chart: Chart): Spot[] {
  const meters = barMeters(chart)
  const spots: Spot[] = []
  chart.bars.forEach((bar, barIndex) => {
    if (bar.spacer) return
    if (!bar.chords.length) {
      const last = spots.at(-1)
      if (last) {
        last.length += meters[barIndex].beats
        last.blanks.push({ bar: barIndex, beats: meters[barIndex].beats })
      }
      return
    }
    bar.chords.forEach((c, index) => {
      const chord = c.symbol ? parseChord(c.symbol) : null
      if (chord) spots.push({ bar: barIndex, index, chord, beats: c.beats, length: c.beats, blanks: [] })
    })
  })
  return spots
}

/** A part of a planned change: a new chord (or the chord there kept, shorter) and its beats. */
interface Part { symbol: string; beats: number; allowed: number[]; root: number; kept?: boolean; sounds?: number /* beats heard, over blank bars */ }
/**
 * A planned change: replace one chord by one or two chords that share its beats, and maybe
 * write the chord again in a blank bar after it (`resume`: a long chord's second half).
 */
interface Change { spot: Spot; parts: Part[]; resume?: { bar: number; beats: number } }

/** The blank bar where the second half of a chord held over blank bars starts (none: it is not held over 2 bars or more). */
function halfway(spot: Spot): { bar: number; beats: number } | undefined {
  if (!spot.blanks.length) return undefined
  let at = spot.beats
  for (const blank of spot.blanks) {
    if (at >= spot.length / 2 - 1e-6) return blank
    at += blank.beats
  }
  return undefined
}

/** What one substitution needs to plan its changes: the spots around one, chord names and the random coin. */
interface Planning {
  at: (i: number) => Spot | undefined // the spot i (the chart goes round: the first chord follows the last; a piece of a line does not)
  name: (pc: number) => string // a root in the song's key
  take: (spot: Spot) => boolean // random mode: this spot this chorus
}

/** A substitution's changes on a chart (its chords as the substitutions before it left them). */
type Rule = (spot: Spot, i: number, plan: Planning) => Change[]

/** One chord replaced whole by another. */
const whole = (spot: Spot, symbol: string, allowed: number[], root: number): Change =>
  ({ spot, parts: [{ symbol, beats: spot.beats, allowed, root }] })

const RULES: Record<SubstitutionId, Rule> = {
  // A long V7 (a bar or more, not already after its ii): its first half becomes the ii, in its own
  // bar or, over blank bars, for half of the bars (the V written again in the blank bar halfway)
  addII: (spot, i, { at, name, take }) => {
    const { chord } = spot
    const next = at(i + 1)?.chord
    const prev = at(i - 1)?.chord
    if (!next || !isDominant(chord) || !downFifth(chord, next) || spot.length < 4 || (prev && isMinor(prev) && downFifth(prev, chord)) || !take(spot)) return []
    const toMinor = isMinor(next)
    const ii = (chord.root + 7) % 12
    const iiPart = (beats: number): Part => ({ symbol: `${name(ii)}${toMinor ? 'h7' : '-7'}`, beats, allowed: toMinor ? ALLOWED.half : ALLOWED.min7, root: ii })
    const resume = halfway(spot)
    if (resume) return [{ spot, parts: [{ ...iiPart(spot.beats), sounds: spot.length / 2 }], resume }]
    if (spot.beats < 2) return []
    return [{ spot, parts: [iiPart(spot.beats / 2), { symbol: '', beats: spot.beats / 2, allowed: ALLOWED.dom, root: chord.root, kept: true }] }]
  },
  // A diminished chord a half step under a minor chord, leading to it from the chord a whole step
  // under it: in place of a short chord (2 beats or less) between the two (C A-7 D-7 -> C C#o7 D-7,
  // Bb Bb6 C-7 -> Bb Bo7 C-7, as in Rhythm Changes), or on the last beats (2 of 4, 1 of 2 or 3) of
  // the chord a whole step under it (C D-7 -> C C#o7 D-7). Spelled up: C#o7, not Dbo7
  passingDim: (spot, i, { at, take }) => {
    const { chord } = spot
    const next = at(i + 1)?.chord
    const prev = at(i - 1)?.chord
    if (!next || !isMinor(next) || spot.length !== spot.beats) return []
    const dim = (next.root + 11) % 12
    const dimPart = (beats: number): Part => ({ symbol: `${noteName(dim, false)}o7`, beats, allowed: ALLOWED.dim, root: dim })
    // Between: a vi, a VI7, a repeated chord; not a I between a V and a vi
    const between = prev && (next.root - prev.root + 12) % 12 === 2 && spot.beats <= 2 && chord.root !== dim
      && (chord.root === prev.root || !isMajor(chord))
    if (between) return take(spot) ? [{ spot, parts: [dimPart(spot.beats)] }] : []
    if ((next.root - chord.root + 12) % 12 !== 2 || spot.beats < 2 || !take(spot)) return []
    const passing = spot.beats >= 4 ? 2 : 1
    return [{ spot, parts: [{ symbol: '', beats: spot.beats - passing, allowed: [], root: chord.root, kept: true }, dimPart(passing)] }]
  },
  // A ii-V to a major I: iv-7 bVII7 instead
  backdoor: (spot, i, { at, name, take }) => {
    const v = at(i + 1)
    const target = at(i + 2)?.chord
    if (!v || !target || !isMinor(spot.chord) || !isDominant(v.chord) || !downFifth(spot.chord, v.chord) || !isMajor(target)
      || !downFifth(v.chord, target) || !take(spot)) return []
    const iv = (target.root + 5) % 12
    const bVII = (target.root + 10) % 12
    return [whole(spot, `${name(iv)}-7`, ALLOWED.min7, iv), whole(v, `${name(bVII)}7`, ALLOWED.tritone, bVII)]
  },
  // A minor chord going down a 5th to another minor chord (vi to ii, iii to vi) becomes its dominant
  turnaround: (spot, i, { at, name, take }) => {
    const next = at(i + 1)?.chord
    if (!next || !isMinor(spot.chord) || !isMinor(next) || !downFifth(spot.chord, next) || !take(spot)) return []
    return [whole(spot, `${name(spot.chord.root)}7`, ALLOWED.dom, spot.chord.root)]
  },
  // The ii of a ii-V-I becomes a dominant: the V's own dominant (not a ii-V going elsewhere, such
  // as the backdoor's iv-7 bVII7)
  secondary: (spot, i, { at, name, take }) => {
    const next = at(i + 1)?.chord
    const target = at(i + 2)?.chord
    if (!next || !target || !isMinor(spot.chord) || !isDominant(next) || !downFifth(spot.chord, next) || !downFifth(next, target) || !take(spot)) return []
    return [whole(spot, `${name(spot.chord.root)}7`, ALLOWED.dom, spot.chord.root)]
  },
  // A plain dominant 7th going down a 5th takes the b9, and the b13 too before a minor chord (the
  // notes of the minor key's harmonic minor scale). Written b9 and b9b13 rather than alt
  altered: (spot, i, { at, name, take }) => {
    const next = at(i + 1)?.chord
    const { chord } = spot
    if (!next || !isDominant(chord) || !downFifth(chord, next) || isAlteredChord(chord) || !take(spot)) return []
    const toMinor = isMinor(next) || next.quality === 'half' || next.quality === 'min6' || next.quality === 'minMaj7'
    return [whole(spot, `${name(chord.root)}7${toMinor ? 'b9b13' : 'b9'}`, toMinor ? ALLOWED.b9b13 : ALLOWED.b9, chord.root)]
  },
  // Any dominant 7th going down a 5th: the dominant a tritone away, going down a half step
  tritone: (spot, i, { at, name, take }) => {
    const next = at(i + 1)?.chord
    if (!next || !isDominant(spot.chord) || !downFifth(spot.chord, next) || !take(spot)) return []
    const sub = (spot.chord.root + 6) % 12
    return [whole(spot, `${name(sub)}7`, ALLOWED.tritone, sub)]
  },
}

/**
 * How to substitute: `piece` for a piece of a longer line (an infinite line's sheet), whose last
 * chord does not lead back to its first and whose chords stay where they are (only whole chords
 * replaced, none split, so a line keeps two chords to a bar).
 */
export interface SubstituteOptions { piece?: boolean }

/**
 * The chart of one chorus with its substitutions, applied one after another in the order of
 * `settings.ids` (each substituted chord keeps the written symbol in `written`, for the sheet's
 * colour). The chart itself when none applies.
 */
export function substituteChart(chart: Chart, settings: SubstitutionSettings | undefined, chorus: number,
  options: SubstituteOptions = {}): Chart {
  if (!substitutes(settings) || !playsInChorus(settings.when, chorus)) return chart
  const name = (pc: number) => spellRoot(pc, chart.key)
  return settings.ids.reduce((sheet, id) => {
    const spots = spotsOf(sheet)
    if (spots.length < 2) return sheet
    const rule = SUBSTITUTIONS.findIndex((s) => s.id === id)
    const take = (spot: Spot) => settings.when.kind !== 'random' || coin(settings.seed, chorus, spot.bar, spot.index, rule)
    const at = (i: number) => options.piece ? spots[i] : spots[(i + spots.length) % spots.length]
    const plan: Planning = { at, name, take }
    // Each chord changed once by a substitution (the backdoor changes the V after its ii)
    const changes = new Map<Spot, Change>()
    spots.forEach((spot, i) => {
      if (changes.has(spot)) return
      for (const change of RULES[id](spot, i, plan)) if (!changes.has(change.spot)) changes.set(change.spot, change)
    })
    // A piece of a line: whole chords only
    if (options.piece) for (const [spot, change] of changes) if (change.parts.length !== 1 || change.resume) changes.delete(spot)
    return applyChanges(sheet, [...changes.values()])
  }, chart)
}

/** Where each written bar starts, in beats from the top of the chart (for the melody's notes). */
function barStarts(chart: Chart): number[] {
  const meters = barMeters(chart)
  let at = 0
  return chart.bars.map((_, i) => {
    const start = at
    at += chart.bars[i].spacer ? 0 : meters[i].beats
    return start
  })
}

/** Whether a melody note of a beat or more, sounding over a part, is outside the part's allowed notes. */
function clashes(chart: Chart, starts: number[], from: number, beats: number, root: number, allowed: number[]): boolean {
  if (!chart.melody?.notes.length) return false
  return chart.melody.notes.some((note) => {
    const start = starts[note.bar] + note.at
    const overlap = Math.min(start + note.beats, from + beats) - Math.max(start, from)
    return note.beats >= 1 - 1e-6 && overlap >= 1 - 1e-6 && !allowed.includes(((note.pitch - root) % 12 + 12) % 12)
  })
}

/**
 * The chart with the planned changes written into its bars (a lead sheet's clashing ones left
 * out). A new chord keeps the symbol first written there in `written`, however many substitutions
 * changed it.
 */
function applyChanges(chart: Chart, changes: Change[]): Chart {
  if (!changes.length) return chart
  const starts = barStarts(chart)
  const bars = chart.bars.map((bar) => ({ ...bar, chords: [...bar.chords] }))
  // Right to left inside a bar, so splitting a chord keeps the indices of those before it
  const ordered = [...changes].sort((a, b) => a.spot.bar - b.spot.bar || b.spot.index - a.spot.index)
  for (const { spot, parts, resume } of ordered) {
    const here = chart.bars[spot.bar].chords[spot.index]
    const written = here.written ?? here.symbol
    const offset = chart.bars[spot.bar].chords.slice(0, spot.index).reduce((sum, c) => sum + c.beats, 0)
    let at = starts[spot.bar] + offset
    const fits = parts.every((part) => {
      const ok = part.kept || !clashes(chart, starts, at, part.sounds ?? part.beats, part.root, part.allowed)
      at += part.beats
      return ok
    })
    if (!fits) continue
    const replaced: BarChord[] = parts.map((part) => part.kept ? { ...here, beats: part.beats }
      : { ...here, symbol: part.symbol, beats: part.beats, written })
    bars[spot.bar].chords.splice(spot.index, 1, ...replaced)
    // The chord again halfway through its blank bars, as it was there (a substitute stays one)
    if (resume) bars[resume.bar].chords = [{ ...here, beats: resume.beats }]
  }
  return { ...chart, bars }
}
