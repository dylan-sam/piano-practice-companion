// Reader for iReal Pro share links (irealb:// and irealbook://).
//
// A link holds one or more songs separated by "===", followed by the playlist
// name. Each song is "title=composer=?=style=key=transpose=music=...=bpm=repeats".
// The music string of irealb:// links is lightly scrambled; once restored it is
// a sequence of 16-cell rows: chords, blank cells, barlines and markings.

import { beatsPerBar, evenSplit, type BarChord, type Chart, type ChartBar, type TimeSignature } from '../music/chart'
import { parseChord } from '../music/chords'
import { getStyle } from '../styles'

export interface IrealPlaylist {
  name: string
  charts: Chart[]
}

export const MUSIC_PREFIX = '1r34LbKcu7'

const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

// Pitch class of a note name such as Bb or F#, or null
export function pitchClass(name: string): number | null {
  const base = NOTE_PC[name[0]?.toUpperCase()]
  if (base === undefined) return null
  const acc = name[1] === 'b' ? -1 : name[1] === '#' ? 1 : 0
  return (base + acc + 12) % 12
}

// iReal style names mapped to the closest OpenStand style
export function mapStyle(name: string, time: TimeSignature = [4, 4]): string {
  const s = name.toLowerCase()
  const inThree = beatsPerBar(time) === 3
  if (/bossa/.test(s)) return 'bossa-nova'
  if (/samba|latin|bolero|cha|son |montuno|tango|salsa|afro|rumba|mambo/.test(s)) return 'latin'
  if (/shuffle|blues|boogie/.test(s)) return 'blues'
  if (/ballad/.test(s) && !/soul|rock|pop|rnb|r&b/.test(s)) return 'ballad'
  if (/swing|bop|jazz|gypsy|trad|new orleans|second line|waltz/.test(s)) return 'swing'
  if (/pop|rock|funk|rnb|r&b|disco|soul|even|reggae|country|folk|house|smooth|bluegrass/.test(s)) return 'straight pop/rock'
  return inThree ? 'ballad' : 'swing'
}

// The irealb:// character scramble on 50-character blocks; the swap is its own inverse
export function swapBlocks(s: string): string {
  let out = ''
  while (s.length > 51) {
    const block = s.slice(0, 50).split('')
    s = s.slice(50)
    const swapped = block.slice()
    for (let i = 0; i < 5; i++) {
      swapped[49 - i] = block[i]
      swapped[i] = block[49 - i]
    }
    for (let i = 10; i < 24; i++) {
      swapped[49 - i] = block[i]
      swapped[i] = block[49 - i]
    }
    out += swapped.join('')
  }
  return out + s
}

// Undo the scrambling iReal Pro applies to a chart's music text
export function unscramble(s: string): string {
  return swapBlocks(s).replace(/Kcl/g, '| x').replace(/LZ/g, ' |').replace(/XyQ/g, '   ')
}

// iReal chord notation is close to ours; only a few spellings differ
export function normalizeChord(symbol: string): string {
  return symbol
    .replace(/^([A-G][b#]?)-\^/, '$1-^') // minor-major stays as is
    .replace(/ø/g, 'h')
    .replace(/^([A-G][b#]?)\^$/, '$1^7')
}

// One cell of the bar being read
interface Cell {
  chord?: string | null // undefined = blank cell, null = N.C.
}

interface PendingBar {
  cells: Cell[]
  marks: Omit<ChartBar, 'chords' | 'cells'>
  copyOf?: number // bar index whose chords this bar repeats
}

const CHORD_RE = /^([A-GW][b#]?)((?:[-^+ohø0-9]|sus|add|alt|b(?=\d)|#(?=\d)|\/(?![A-G])|\d)*)(\/[A-G][b#]?)?/

// Read an iReal Pro music text into bars, with the time signature in force at the end
export function parseMusic(music: string, time: TimeSignature): { bars: ChartBar[]; time: TimeSignature } {
  const bars: ChartBar[] = []
  let current: PendingBar = { cells: [], marks: {} }
  let firstTime: TimeSignature | null = null
  let barTime = time
  let lastChord: string | null = null
  let cellCount = 0 // cells used so far, for row layout
  let copyNextFrom: number | null = null

  // Finish the current bar and start the next
  const closeBar = () => {
    const hasContent = current.cells.length > 0 || current.copyOf !== undefined
    if (!hasContent) return false
    const startCell = cellCount
    cellCount += Math.max(1, current.cells.length)
    const chords = current.copyOf !== undefined ? (bars[current.copyOf]?.chords ?? []) : durations(current.cells, barTime)
    bars.push({
      ...current.marks,
      chords: chords.map((c) => ({ ...c })),
      cells: Math.max(1, current.cells.length),
      rowStart: startCell % 16 === 0 || undefined,
    })
    current = { cells: [], marks: {} }
    if (copyNextFrom !== null) {
      current.copyOf = copyNextFrom
      copyNextFrom = null
    }
    return true
  }

  // Markings that belong to the next bar are stored on `current` before any cell is added
  let s = music
  while (s.length > 0) {
    let m: RegExpExecArray | null

    if ((m = /^T(\d)(\d)/.exec(s))) {
      const t: TimeSignature = m[1] === '1' && m[2] === '2' ? [12, 8] : [Number(m[1]), Number(m[2])]
      if (!firstTime && bars.length === 0) firstTime = t
      else current.marks.time = t
      barTime = t
      s = s.slice(3)
    } else if ((m = /^\*(\w)/.exec(s))) {
      current.marks.section = m[1]
      s = s.slice(2)
    } else if ((m = /^<([^>]*)>/.exec(s))) {
      const text = m[1].replace(/^\*\d\d/, '').trim()
      const times = /^(\d+)x$/i.exec(text)
      const target = current.cells.length || bars.length === 0 ? current.marks : bars[bars.length - 1]
      if (times) {
        // "3x" sits in the bar that closes the repeat
        target.repeatTimes = Number(times[1])
      } else if (/^(d\.[cs]\.|fine)/i.test(text)) {
        target.directive = text
      } else if (text) {
        target.comment = target.comment ? `${target.comment} ${text}` : text
      }
      s = s.slice(m[0].length)
    } else if ((m = /^N(\d)/.exec(s))) {
      current.marks.ending = Number(m[1])
      s = s.slice(2)
    } else if (s[0] === '{') {
      closeBar()
      current.marks.repeatStart = true
      s = s.slice(1)
    } else if (s[0] === '}') {
      // The repeat sign closes the bar in front of it
      const times = current.marks.repeatTimes
      closeBar()
      if (bars.length) bars[bars.length - 1].repeatEnd = true
      if (times && bars.length) {
        bars[bars.length - 1].repeatTimes = times
        delete current.marks.repeatTimes
      }
      s = s.slice(1)
    } else if (s[0] === '[' || s[0] === '|') {
      closeBar()
      s = s.slice(1)
    } else if (s[0] === ']' || s[0] === 'Z') {
      const kind = s[0] === 'Z' ? 'final' : 'double'
      closeBar()
      if (bars.length) bars[bars.length - 1].barline = kind
      s = s.slice(1)
    } else if (s[0] === 'x') {
      // Repeat the previous bar
      if (current.cells.every((c) => c.chord === undefined)) current.copyOf = bars.length - 1
      current.cells.push({})
      s = s.slice(1)
    } else if (s[0] === 'r') {
      // Repeat the previous two bars: this bar and the next copy them
      current.copyOf = bars.length - 2
      copyNextFrom = bars.length - 1
      current.cells.push({})
      s = s.slice(1)
    } else if (s[0] === 'S') {
      current.marks.segno = true
      s = s.slice(1)
    } else if (s[0] === 'Q') {
      current.marks.coda = true
      s = s.slice(1)
    } else if (s[0] === 'f') {
      current.marks.fermata = true
      s = s.slice(1)
    } else if (s[0] === 'U') {
      current.marks.end = true
      s = s.slice(1)
    } else if (s[0] === '(') {
      // Alternative chord shown small above the real one: not played
      const close = s.indexOf(')')
      s = s.slice(close === -1 ? 1 : close + 1)
    } else if (s[0] === 'n') {
      current.cells.push({ chord: null })
      s = s.slice(1)
    } else if (s[0] === 'p') {
      // A slash holds the chord before it: an empty cell inside a bar, the last chord again at
      // the start of a bar (as ireal_playlist._fill_slashes reads it)
      current.cells.push(current.cells.some((c) => c.chord !== undefined) ? {} : { chord: lastChord })
      s = s.slice(1)
    } else if (s[0] === ' ') {
      current.cells.push({})
      s = s.slice(1)
    } else if ((m = CHORD_RE.exec(s)) && m[0].length > 0) {
      let symbol = m[0]
      if (symbol.startsWith('W')) {
        // Invisible chord: the previous chord with a new bass note
        symbol = lastChord ? lastChord.split('/')[0] + (m[3] ?? '') : (m[3]?.slice(1) ?? 'C')
      } else {
        lastChord = symbol
      }
      current.cells.push({ chord: normalizeChord(symbol) })
      s = s.slice(m[0].length)
    } else {
      // Y (vertical space), s/l (chord size), commas and anything unknown carry no music
      s = s.slice(1)
    }
  }
  closeBar()

  return { bars: markSpacers(bars), time: firstTime ?? time }
}

// Blank cells after a closing barline or a jump are layout space, not bars of music
function markSpacers(bars: ChartBar[]): ChartBar[] {
  // Whether a bar holds nothing (no chord, section, repeat or ending)
  const isBlank = (b: ChartBar) => b.chords.length === 0 && !b.section && !b.repeatStart && !b.ending && !b.coda && !b.segno
  while (bars.length && isBlank(bars[bars.length - 1]) && !bars[bars.length - 1].repeatEnd) {
    const last = bars.pop()!
    if (last.barline && bars.length) bars[bars.length - 1].barline = last.barline
  }
  return bars.map((bar, i) => {
    const prev = bars[i - 1]
    const next = bars[i + 1]
    const closes =
      prev &&
      (prev.barline === 'final' ||
        /^d\.[cs]\./i.test(prev.directive ?? '') ||
        (prev.repeatEnd && next?.ending !== undefined))
    return isBlank(bar) && !bar.repeatEnd && closes ? { ...bar, spacer: true } : bar
  })
}

// Chord lengths from their cell positions within the bar (docs/CHORD_NOTATION.md, "Chord lengths in
// iReal bars"): a chord fills its own cell and the blank cells after it; blank cells before the
// first chord are skipped, as iReal Pro does
export function durations(cells: Cell[], time: TimeSignature): BarChord[] {
  const positions = cells.flatMap((c, i) => (c.chord !== undefined ? [i] : []))
  if (positions.length === 0) return []
  const filled = positions.map((p, i) => (positions[i + 1] ?? cells.length) - p)
  const beats = cellBeats(filled, time)
  return positions.map((p, i) => ({ symbol: cells[p].chord ?? null, beats: beats[i] }))
}

/**
 * Beats of each chord of a bar from the number of cells each fills. Each chord starts where its
 * cell lies: cells 2+1+1 in 4/4 are 2+1+1 beats, 1+1+2 are 1+1+2. When cells and beats do not
 * line up, the chords take the whole-beat lengths (one beat at least) whose starts are closest to
 * the cells' positions: cells 1+2+2 (starts 0, 0.8, 2.4) are 1+1+2. Evenly spaced chords, ties and
 * bars with more chords than beats are shared by evenSplit. Same rule as ireal_playlist.bar_beats.
 */
export function cellBeats(filled: number[], time: TimeSignature): number[] {
  const barBeats = beatsPerBar(time)
  const even = evenSplit(filled.length, time)
  if (new Set(filled).size === 1 || filled.length > barBeats || !Number.isInteger(barBeats)) return even
  const total = filled.reduce((a, b) => a + b, 0)
  const starts = filled.map((_, i) => (barBeats * filled.slice(0, i).reduce((a, b) => a + b, 0)) / total)
  // How far the starts of chords laid end to end are from the starts of their cells
  const distance = (lengths: number[]) => {
    let at = 0
    return lengths.reduce((sum, length, i) => {
      const d = sum + Math.abs(at - starts[i])
      at += length
      return d
    }, 0)
  }
  const candidates = compositions(barBeats, filled.length)
  const best = Math.min(...candidates.map(distance))
  const closest = candidates.filter((lengths) => distance(lengths) <= best + 1e-9)
  // Whether chord lengths are the even split
  const isEven = (lengths: number[]) => lengths.every((l, i) => l === even[i])
  return closest.length > 1 || closest.some(isEven) ? even : closest[0]
}

/** Every way of writing `total` whole beats as `parts` lengths of one beat or more, in order. */
function compositions(total: number, parts: number): number[][] {
  if (parts === 1) return [[total]]
  const out: number[][] = []
  for (let first = 1; first <= total - parts + 1; first++) {
    for (const rest of compositions(total - first, parts - 1)) out.push([first, ...rest])
  }
  return out
}

// Read an iReal Pro key such as Eb or C- into a pitch class and mode
function parseKey(raw: string): { key: number; minor: boolean } {
  const minor = raw.endsWith('-')
  return { key: pitchClass(raw) ?? 0, minor }
}

// Read one song of an iReal Pro link into a chart (null when it holds no music)
function parseSong(raw: string): Chart | null {
  const parts = raw.split('=')
  // irealb://    title=composer=?=style=key=transpose=1r34LbKcu7<music>=style2=bpm=repeats
  // irealbook:// title=composer=style=key=n=<music>
  const musicIndex = parts.findIndex((p) => p.startsWith(MUSIC_PREFIX))
  const scrambled = musicIndex !== -1
  if (!scrambled && parts.length < 6) return null
  const [title, composerRaw] = parts
  const styleName = scrambled ? parts[3] : parts[2]
  const keyRaw = scrambled ? parts[4] : parts[3]
  const music = scrambled ? unscramble(parts[musicIndex].slice(MUSIC_PREFIX.length)) : parts[5]
  const bpm = scrambled ? Number(parts[musicIndex + 2]) || 0 : 0
  if (!music) return null

  // Composer names are stored "Last First"
  const words = composerRaw.trim().split(' ')
  const composer = words.length === 2 ? `${words[1]} ${words[0]}` : composerRaw.trim()

  const { bars, time } = parseMusic(music, [4, 4])
  if (bars.length === 0) return null
  const { key, minor } = parseKey(keyRaw)
  const style = mapStyle(styleName, time)

  return {
    format: 'openstand-chart',
    version: 1,
    title: title.trim() || 'Untitled',
    composer: composer && !/unknown/i.test(composer) ? composer : undefined,
    style,
    sourceStyle: styleName,
    key,
    minor: minor || undefined,
    bpm: bpm || defaultTempo(style),
    time,
    bars,
  }
}

// A default tempo for an iReal Pro style
function defaultTempo(style: string): number {
  return getStyle(style).tempo.default
}

// Accepts a bare link, text containing links, or an iReal HTML playlist export
export function parseIrealLinks(input: string): IrealPlaylist[] {
  const links = input.match(/irealb(?:ook)?:\/\/[^\s"'<>]+/g) ?? []
  return links.map((link) => {
    let body = link.replace(/^irealb(?:ook)?:\/\//, '')
    try {
      body = decodeURIComponent(body)
    } catch {
      // Already decoded
    }
    const parts = body.split('===')
    const name = parts.length > 1 ? (parts.pop() ?? '').trim() : ''
    const charts = parts.map(parseSong).filter((c): c is Chart => c !== null)
    return { name: name || (charts.length === 1 ? charts[0].title : 'Imported tunes'), charts }
  })
}

// Chords our parser can't read yet, for reporting
export function unknownChords(chart: Chart): string[] {
  const out = new Set<string>()
  for (const bar of chart.bars) {
    for (const c of bar.chords) if (c.symbol && !parseChord(c.symbol)) out.add(c.symbol)
  }
  return [...out]
}
