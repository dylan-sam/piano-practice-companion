// Write a chart with a melody as ABC notation, for abcjs to engrave as a lead sheet.
//
// The melody is quantized for reading: each beat is written on a straight grid (sixteenths) or,
// when its notes fall on thirds of the beat, as a triplet of eighths. Notes are split with ties at
// bar lines, at triplet beats and where a chord starts, so every chord symbol sits on a note or a
// rest. The writer also returns the written time of every note and rest it draws, in drawing
// order, so the sheet can follow the player note by note.

import { barMeters, type Chart, type ChartBar } from './chart'
import { noteName, parseChord, spellRoot, transposeChord } from './chords'
import { notesByBar, type MelodyNote } from './melody'
import { displayText, type DisplaySettings } from '../ui/display'

/** A note or rest as drawn: its written bar, start and length in quarter notes. */
export interface DrawnEvent {
  bar: number
  at: number
  beats: number
  rest: boolean
  note?: number // the index of the melody note it draws (a tied note is drawn in several pieces)
}

/** A note as written: a letter, an accidental (-1 flat, 0 natural, +1 sharp) and an octave (4 holds middle C). */
export interface Spelled { letter: string; accidental: number; octave: number }

/** The clef a melody is written in. */
export type Clef = 'treble' | 'bass'

/** How some melody notes are written (by index in the chart's melody), for exercises. */
export interface NoteWriting {
  rhythmOnly?: (index: number) => boolean // drawn as a slash on the middle line: the rhythm without the pitch
  spelling?: (index: number) => Spelled | undefined // written with this letter and accidental instead of the key's spelling
  chords?: boolean // false: no chord symbols (and notes are not cut where chords change)
  clef?: Clef // instead of the clef chosen from the melody's range
}

export interface LeadSheetAbc {
  abc: string
  events: DrawnEvent[] // one per note or rest symbol, in the order abcjs draws them
}

const UNIT = 4 // ABC length unit L:1/16: four units to a quarter note
const EPS = 1e-6
// Lengths with a single note symbol, in sixteenths: 16th, 8th, dotted 8th, quarter, dotted quarter,
// half, dotted half, whole
const SIMPLE_LENGTHS = [16, 12, 8, 6, 4, 3, 2, 1]
// Sharps and flats of the major keys by tonic pitch class, as the key signature writes them
const SIGNATURE_FIFTHS = [0, -5, 2, -3, 4, -1, -6, 1, -4, 3, -2, 5]
const SHARP_ORDER = 'FCGDAEB'
const LETTERS = 'CDEFGAB'
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11]

/** The accidental (-1, 0, +1) the key signature of a major key gives to each letter. */
export function signature(majorPc: number): Record<string, number> {
  const fifths = SIGNATURE_FIFTHS[majorPc]
  const out: Record<string, number> = Object.fromEntries([...LETTERS].map((l) => [l, 0]))
  const order = fifths >= 0 ? SHARP_ORDER : [...SHARP_ORDER].reverse().join('')
  for (const letter of order.slice(0, Math.abs(fifths))) out[letter] = Math.sign(fifths)
  return out
}

/**
 * Spell a MIDI pitch as a letter, an accidental and an octave in a major key: notes of the key
 * follow its signature; chromatic notes take sharps in sharp keys, flats in flat keys, and in C
 * flats except the raised fourth (F#).
 */
export function spellPitch(pitch: number, majorPc: number): { letter: string; accidental: number; octave: number } {
  const pc = ((pitch % 12) + 12) % 12
  const sig = signature(majorPc)
  const inKey = [...LETTERS].find((l, i) => (LETTER_PC[i] + sig[l] + 12) % 12 === pc)
  const fifths = SIGNATURE_FIFTHS[majorPc]
  const name = inKey
    ? inKey + (sig[inKey] > 0 ? '#' : sig[inKey] < 0 ? 'b' : '')
    : noteName(pc, fifths < 0 || (fifths === 0 && pc !== 6))
  const letter = name[0]
  const accidental = name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0
  // The octave of the letter: B#/Cb would cross it, but neither is ever spelled here
  const octave = Math.floor((pitch - LETTER_PC[LETTERS.indexOf(letter)] - accidental) / 12) - 1
  return { letter, accidental, octave }
}

// The middle line of each clef: B4 in the treble clef, D3 in the bass clef
const MIDDLE_LINE: Record<Clef, Spelled> = { treble: { letter: 'B', accidental: 0, octave: 4 }, bass: { letter: 'D', accidental: 0, octave: 3 } }

/** The clef of a melody: the bass clef for a low one (a bass or baritone solo), else the treble clef. */
export function melodyClef(pitches: number[]): Clef {
  const sorted = [...pitches].sort((a, b) => a - b)
  return sorted.length && sorted[Math.floor(sorted.length / 2)] < 57 ? 'bass' : 'treble'
}

/** An ABC note letter with its octave marks (middle C is C, the octave above c). */
function abcLetter(letter: string, octave: number): string {
  if (octave >= 5) return letter.toLowerCase() + "'".repeat(octave - 5)
  return letter + ','.repeat(Math.max(0, 4 - octave))
}

/** The chord symbol shown over the melody, as plain text in the Display menu's notation. */
export function chordText(symbol: string | null, transpose: number, keyPc: number, display: DisplaySettings): string {
  if (symbol === null) return 'N.C.'
  const chord = parseChord(symbol)
  if (!chord) return symbol
  // Roots are spelled as the chord chart spells them (spellRoot): Bb7 in C, not A#7
  const moved = transposeChord(chord, transpose)
  const label = spellRoot(moved.root, keyPc) + moved.suffix + (moved.bass !== moved.root ? `/${spellRoot(moved.bass, keyPc)}` : '')
  return displayText(label, display, display.roman ? keyPc : null)
    .replace(/\^/g, '\u0394').replace(/h/g, '\u00f8').replace(/(?<!n)o/g, '\u00b0')
}

/** The time signature as ABC writes it. */
const meterText = ([beats, unit]: [number, number]) => `${beats}/${unit}`

/** Whether a point lies on a grid of `steps` divisions of the beat. */
const onGrid = (fraction: number, steps: number) => Math.abs(fraction * steps - Math.round(fraction * steps)) < 0.04

/**
 * Choose each beat's grid: 3 (triplet eighths) when a note starts on a third of it, else 4
 * (sixteenths); note ends follow the grid of their beat. Compound meters and partial beats are
 * always written straight.
 */
function beatGrids(notes: MelodyNote[], length: number, straight: boolean): number[] {
  const grids = Array.from({ length: Math.ceil(length - EPS) }, () => UNIT)
  if (straight) return grids
  for (const { at } of notes) {
    const beat = Math.floor(at + EPS)
    const fraction = at - beat
    if (beat + 1 <= length + EPS && fraction > 0.04 && onGrid(fraction, 3) && !onGrid(fraction, 4)) grids[beat] = 3
  }
  return grids
}

/** Snap a time of the bar to its beat's grid. */
function snap(t: number, grids: number[], length: number): number {
  if (t >= length - EPS) return length
  const beat = Math.floor(t + EPS)
  const steps = grids[beat] ?? UNIT
  return Math.min(length, beat + Math.round((t - beat) * steps) / steps)
}

/** A run of the bar to draw: a note (pitch) or a rest (null), with a chord symbol at its start. */
interface Piece { start: number; end: number; pitch: number | null; text?: string; note?: number }

/** A melody note with its index in the chart's melody. */
type IndexedNote = MelodyNote & { index?: number }

/**
 * Cut the bar's pieces so each one can be written: at chord starts, at the edges of triplet beats,
 * and into lengths that a single note symbol can show (splitting first at beat lines).
 */
function cutPieces(pieces: Piece[], cuts: number[], grids: number[]): Piece[] {
  // Cut at fixed points
  const out: Piece[] = []
  for (const piece of pieces) {
    let start = piece.start
    for (const cut of cuts) {
      if (cut > start + EPS && cut < piece.end - EPS) {
        out.push({ ...piece, start, end: cut })
        start = cut
      }
    }
    out.push({ ...piece, start, end: piece.end })
  }
  // Split lengths a note symbol cannot show
  const result: Piece[] = []
  const split = (piece: Piece) => {
    const beat = Math.floor(piece.start + EPS)
    if ((grids[beat] ?? UNIT) === 3) return result.push(piece) // a triplet slot or two: always writable
    const units = Math.round((piece.end - piece.start) * UNIT)
    const firstLine = Math.ceil(piece.start - EPS)
    const lastLine = Math.floor(piece.end - EPS)
    // A note crosses a beat line only from an eighth to an eighth (the syncopated quarter)
    const crossesOddly = firstLine < piece.end - EPS && firstLine > piece.start + EPS &&
      !(onGrid(piece.start, 2) && onGrid(piece.end, 2))
    if (SIMPLE_LENGTHS.includes(units) && !crossesOddly) return result.push(piece)
    // Across beats: cut at the first beat line (an offbeat start) or the last one (a downbeat start)
    const at = firstLine > piece.start + EPS && firstLine < piece.end - EPS ? firstLine
      : lastLine > piece.start + EPS ? lastLine
        : piece.start + (SIMPLE_LENGTHS.find((n) => n < units) ?? 1) / UNIT
    split({ ...piece, end: at })
    split({ ...piece, start: at })
  }
  for (const piece of out) split(piece)
  return result
}

/** What to write around a bar: quoted annotations and decorations at its start and end. */
interface BarMarks { start: string; end: string }

/** Quote a text for an ABC chord symbol or annotation (`place` is ^ above, _ below, or none). */
const quoted = (text: string, place = '') => `"${place}${text.replace(/"/g, "'")}"`

/**
 * Write one bar of ABC: its notes, rests, ties and chord symbols. `carry` is a note tied over from
 * the bar before; the result's `carry` is the part of the last note that runs into the next bar.
 */
function writeBar(
  index: number, bar: ChartBar, notes: IndexedNote[], length: number, straight: boolean,
  majorPc: number, chordAt: (symbol: string | null) => string, carry: IndexedNote | null, marks: BarMarks,
  writing: NoteWriting, clef: Clef,
): { body: string; events: DrawnEvent[]; carry: IndexedNote | null } {
  // Monophonic: a note ends where the next one starts
  const sorted = [...(carry ? [carry] : []), ...notes].filter((n) => n.at < length - EPS).sort((a, b) => a.at - b.at)
  const clipped = sorted.map((n, i) => ({ ...n, beats: Math.min(n.at + n.beats, sorted[i + 1]?.at ?? Infinity) - n.at }))
  const lastNote = clipped.at(-1)
  const nextCarry = lastNote && lastNote.at + lastNote.beats > length + 0.02
    ? { bar: index + 1, at: 0, beats: lastNote.at + lastNote.beats - length, pitch: lastNote.pitch, index: lastNote.index } : null
  const inBar = clipped.map((n) => ({ ...n, beats: Math.min(n.beats, length - n.at) }))
  const grids = beatGrids(inBar, length, straight)
  // Notes on the grid, dropping any that shrink to nothing
  const placed: Piece[] = []
  for (const note of inBar) {
    const start = snap(note.at, grids, length)
    const end = snap(note.at + note.beats, grids, length)
    const last = placed.at(-1)
    if (last && last.end > start) last.end = start
    if (last && last.end <= last.start + EPS) placed.pop()
    if (end > start + EPS) placed.push({ start, end, pitch: note.pitch, note: note.index })
  }
  // Rests fill the gaps
  const pieces: Piece[] = []
  let time = 0
  for (const piece of placed) {
    if (piece.start > time + EPS) pieces.push({ start: time, end: piece.start, pitch: null })
    pieces.push(piece)
    time = piece.end
  }
  if (length > time + EPS) pieces.push({ start: time, end: length, pitch: null })
  // Cut at chord starts and around triplet beats, then hang the chord symbols on the pieces
  const chordStarts: number[] = []
  let at = 0
  const chords = writing.chords === false ? [] : bar.chords
  for (const chord of chords) {
    chordStarts.push(snap(at, grids, length))
    at += chord.beats
  }
  const triplets = grids.flatMap((g, beat) => (g === 3 ? [beat, beat + 1] : []))
  const cuts = [...new Set([...chordStarts, ...triplets])].filter((t) => t > EPS && t < length - EPS).sort((a, b) => a - b)
  const cut = cutPieces(pieces, cuts, grids)
  chords.forEach((chord, i) => {
    const target = cut.find((p) => Math.abs(p.start - chordStarts[i]) < EPS)
    if (target) target.text = (target.text ?? '') + quoted(chordAt(chord.symbol))
  })
  if (cut.length) {
    cut[0].text = marks.start + (cut[0].text ?? '')
    cut[cut.length - 1].text = (cut[cut.length - 1].text ?? '') + marks.end
  }

  // A bar of rest only, with no chord change inside, is a whole-bar rest
  if (cut.every((p) => p.pitch === null) && chords.length <= 1) {
    return { body: `${cut.map((p) => p.text ?? '').join('')}Z`, events: [{ bar: index, at: 0, beats: length, rest: true }], carry: null }
  }

  // Accidentals in force in this bar, by letter and octave
  const sig = signature(majorPc)
  const inForce = new Map<string, number>()
  const tokens: string[] = []
  const events: DrawnEvent[] = []
  let tripletLeft = 0
  let lastBeat = -1
  cut.forEach((piece, i) => {
    const beat = Math.floor(piece.start + EPS)
    const grid = grids[beat] ?? UNIT
    let token = ''
    // A space between beats breaks the beams
    if (beat !== lastBeat && tokens.length) token += ' '
    lastBeat = beat
    if (grid === 3 && tripletLeft === 0) {
      tripletLeft = cut.filter((p) => Math.floor(p.start + EPS) === beat).length
      token += `(3:2:${tripletLeft}`
    }
    token += piece.text ?? ''
    // Triplet slots are written as eighths (two units), squeezed three into a beat
    const units = grid === 3 ? Math.round((piece.end - piece.start) * 3) * 2 : Math.round((piece.end - piece.start) * UNIT)
    const size = units === 1 ? '' : String(units)
    if (piece.pitch === null) token += `z${size}`
    else if (piece.note !== undefined && writing.rhythmOnly?.(piece.note)) {
      // The rhythm without the pitch: a slash on the middle line, with no accidental
      const { letter, octave } = MIDDLE_LINE[clef]
      token += `!style=rhythm!${abcLetter(letter, octave)}${size}`
      const next = cut[i + 1]
      if (next && next.note === piece.note && Math.abs(next.start - piece.end) < EPS) token += '-'
    } else {
      const { letter, accidental, octave } = (piece.note !== undefined && writing.spelling?.(piece.note)) || spellPitch(piece.pitch, majorPc)
      const place = `${letter}${octave}`
      const current = inForce.get(place) ?? sig[letter]
      const tiedOver = i === 0 && carry !== null && carry.pitch === piece.pitch // a continuation: no new accidental
      if (accidental !== current && !tiedOver) {
        token += accidental > 0 ? '^' : accidental < 0 ? '_' : '='
        inForce.set(place, accidental)
      }
      token += abcLetter(letter, octave) + size
      const next = cut[i + 1]
      if (next && next.pitch === piece.pitch && Math.abs(next.start - piece.end) < EPS && isTie(placed, piece, next)) token += '-'
    }
    if (tripletLeft > 0) tripletLeft--
    tokens.push(token)
    events.push({ bar: index, at: piece.start, beats: piece.end - piece.start, rest: piece.pitch === null,
      ...(piece.note !== undefined && piece.pitch !== null ? { note: piece.note } : {}) })
  })
  // The last note is tied into the next bar when it runs past the bar line
  const last = cut.at(-1)
  if (nextCarry && last?.pitch === nextCarry.pitch) tokens[tokens.length - 1] += '-'
  return { body: tokens.join(''), events, carry: nextCarry }
}

/** Whether two adjacent pieces are parts of one note (cut by the writer), not repeated notes. */
function isTie(placed: Piece[], a: Piece, b: Piece): boolean {
  return placed.some((p) => p.start <= a.start + EPS && p.end >= b.end - EPS)
}

/** The ABC barline closing a bar, with the repeat sign or ending bracket that opens the next. */
function barline(bar: ChartBar, next: ChartBar | undefined): string {
  let line = bar.repeatEnd ? ':|' : bar.barline === 'final' ? '|]' : bar.barline === 'double' ? '||' : '|'
  if (next?.repeatStart) line = bar.repeatEnd ? ':|:' : '|:'
  return next?.ending ? `${line}[${next.ending}` : line
}

/** A key as ABC names it: Bb, F#m. */
function abcKey(keyPc: number, minor: boolean): string {
  const majorPc = minor ? (keyPc + 3) % 12 : keyPc
  return noteName(keyPc, SIGNATURE_FIFTHS[majorPc] < 0) + (minor ? 'm' : '')
}

/** The marks written on the first and last notes of a bar: signs, fermata, directive. */
function barMarks(bar: ChartBar): BarMarks {
  const signs = [bar.segno && '!segno!', bar.coda && '!coda!', bar.fermata && '!fermata!'].filter(Boolean).join('')
  return { start: signs, end: bar.directive ? quoted(bar.directive, '_') : '' }
}

/**
 * Write the chart's melody and chords as ABC. `transpose` moves both into the key on the stand;
 * `barsPerLine` sets the most bars on a staff line (fewer on phones); a rehearsal mark starts a
 * new line.
 */
export function melodyToAbc(chart: Chart, transpose: number, display: DisplaySettings, barsPerLine = 4,
  writing: NoteWriting = {}): LeadSheetAbc {
  let keyPc = (chart.key + transpose + 120) % 12
  let majorPc = chart.minor ? (keyPc + 3) % 12 : keyPc
  // Each note knows its index in the melody, so exercises can write some notes their own way
  const indexed = chart.melody ? { ...chart.melody, notes: chart.melody.notes.map((n, index) => ({ ...n, index })) } : undefined
  const byBar = notesByBar(indexed) as Map<number, IndexedNote[]>
  // A low melody (a bass or baritone solo) is written in the bass clef
  const clef = writing.clef ?? melodyClef((chart.melody?.notes ?? []).map((n) => n.pitch + transpose))
  const meters = barMeters(chart)
  const header = ['X:1', '%%barnumbers 1', `M:${meterText(chart.bars[0]?.partial ? chart.time : (meters[0]?.time ?? chart.time))}`,
    `L:1/${UNIT * 4}`, `K:${abcKey(keyPc, !!chart.minor)} clef=${clef}`]

  const lines: string[] = []
  const events: DrawnEvent[] = []
  let line = ''
  let carry: IndexedNote | null = null
  // Chords are named in the key in force (for Roman numerals)
  const chordAt = (symbol: string | null) => chordText(symbol, transpose, keyPc, display)
  const shown = chart.bars.map((bar, index) => ({ bar, index })).filter(({ bar }) => !bar.spacer)
  let onLine = 0
  let pickup = 0 // 1 while the first line holds a pickup bar before the first rehearsal mark
  shown.forEach(({ bar, index }, i) => {
    // A rehearsal mark starts a staff line, as on a written lead sheet; a pickup bar stays on the
    // first line, as an extra bar
    if (bar.section && i === 1) pickup = 1
    else if (bar.section && onLine) {
      lines.push(line.trimEnd())
      line = ''
      onLine = 0
    }
    const meter = meters[index]
    const notes = (byBar.get(index) ?? []).map((n) => ({ ...n, pitch: n.pitch + transpose }))
    // A change of key on the downbeat changes the key signature (later in the bar it does not)
    const change = i > 0 ? bar.keys?.find((k) => k.beats === 0) : undefined
    if (change) {
      keyPc = (change.key + transpose + 120) % 12
      majorPc = change.minor ? (keyPc + 3) % 12 : keyPc
    }
    const opening = (i === 0 && bar.repeatStart ? '|:' : '') + (i === 0 && bar.ending ? `[${bar.ending}` : '') +
      (i > 0 && bar.time && !bar.partial ? `[M:${meterText(bar.time)}]` : '') +
      (change ? `[K:${abcKey(keyPc, !!change.minor)}]` : '')
    const straight = !!meter.compound || !Number.isInteger(meter.beats)
    const written = writeBar(index, bar, notes, meter.beats, straight, majorPc, chordAt, carry, barMarks(bar), writing, clef)
    carry = written.carry
    line += `${opening}${written.body} ${barline(bar, shown[i + 1]?.bar)} `
    events.push(...written.events)
    if (++onLine >= barsPerLine + pickup) {
      lines.push(line.trimEnd())
      line = ''
      onLine = 0
      pickup = 0
    }
  })
  if (line) lines.push(line.trimEnd())
  return { abc: [...header, ...lines].join('\n') + '\n', events }
}
