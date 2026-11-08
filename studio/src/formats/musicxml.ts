// Read a MusicXML lead sheet (MuseScore, Audiveris, homr exports) into a chart with a melody.
//
// The melody is the first part's first voice (the top note of a chord); chord symbols come from
// <harmony> elements, or from short texts above the staff that read as chords (scans). Repeats,
// endings, segno, coda, rehearsal marks, key, meter and tempo are kept. A pickup bar is drawn as
// a whole bar with its notes at the end. Only DOM methods that @xmldom/xmldom also has are used,
// so the reader can be tested outside a browser.

import type { BarChord, Chart, ChartBar, TimeSignature } from '../music/chart'
import { parseChord } from '../music/chords'
import type { MelodyNote } from '../music/melody'

const STEP_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
// MusicXML chord kinds as chart suffixes
const KINDS: Record<string, string> = {
  major: '', minor: '-', augmented: '+', diminished: 'o', dominant: '7', 'major-seventh': '^7',
  'minor-seventh': '-7', 'diminished-seventh': 'o7', 'augmented-seventh': '7#5', 'half-diminished': 'h7',
  'major-minor': '-^7', 'major-sixth': '6', 'minor-sixth': '-6', 'dominant-ninth': '9', 'major-ninth': '^9',
  'minor-ninth': '-9', 'dominant-11th': '11', 'major-11th': '^9#11', 'minor-11th': '-11', 'dominant-13th': '13',
  'major-13th': '^13', 'minor-13th': '-13', 'suspended-second': 'sus2', 'suspended-fourth': 'sus',
  power: '5', Neapolitan: '', Italian: '7', French: '7', German: '7', Tristan: '7',
}
const ROW = 4 // bars to a row of the chord chart

/** The child elements of an element with a tag name. */
function children(element: Element, name: string): Element[] {
  const out: Element[] = []
  for (let node = element.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 1 && (node as Element).nodeName === name) out.push(node as Element)
  }
  return out
}

/** The first child element with a tag name. */
const child = (element: Element | undefined, name: string): Element | undefined =>
  element ? children(element, name)[0] : undefined

/** The text of a child element (trimmed), or ''. */
const text = (element: Element | undefined, name: string): string => child(element, name)?.textContent?.trim() ?? ''

/** A note name from a MusicXML step and alteration (B and -1 is Bb). */
function noteName(step: string, alter: number): string {
  return step + (alter > 0 ? '#'.repeat(alter) : 'b'.repeat(-alter))
}

/** A chord symbol from a <harmony> element; null for N.C., undefined if it cannot be read. */
export function harmonySymbol(harmony: Element): string | null | undefined {
  const kind = child(harmony, 'kind')
  const kindValue = kind?.textContent?.trim() ?? ''
  if (kindValue === 'none') return null
  const root = child(harmony, 'root')
  const step = text(root, 'root-step')
  if (!step) return undefined
  const rootName = noteName(step, Number(text(root, 'root-alter') || 0))
  const bass = child(harmony, 'bass')
  const bassName = bass && text(bass, 'bass-step') ? noteName(text(bass, 'bass-step'), Number(text(bass, 'bass-alter') || 0)) : ''
  // The kind's own spelling (kind text="m7") is the fallback for kinds the table lacks
  const suffix = KINDS[kindValue] ?? kind?.getAttribute('text') ?? ''
  const degrees = children(harmony, 'degree').map((degree) => {
    const value = text(degree, 'degree-value')
    const alter = Number(text(degree, 'degree-alter') || 0)
    const type = text(degree, 'degree-type')
    const accidental = alter > 0 ? '#' : alter < 0 ? 'b' : ''
    if (type === 'subtract') return `no${value}`
    return type === 'add' && !accidental ? `add${value}` : `${accidental}${value}`
  }).join('')
  const slash = bassName ? `/${bassName}` : ''
  for (const candidate of [rootName + suffix + degrees + slash, rootName + suffix + slash, rootName + suffix]) {
    if (parseChord(candidate)) return candidate
  }
  return undefined
}

/** A short text above the staff that reads as a chord symbol (OMR exports often write chords so). */
function textChord(words: string): string | undefined {
  const cleaned = words.replace(/\s+/g, '').replace('♭', 'b').replace('♯', '#').replace(/maj7|M7|Δ/, '^7')
    .replace(/^([A-G][b#]?)m(?!aj)/, '$1-').replace('ø', 'h').replace('°', 'o')
  return cleaned.length <= 12 && parseChord(cleaned) ? cleaned : undefined
}

/** A MIDI note number from a <pitch> element. */
function midiPitch(pitch: Element): number {
  const step = STEP_PC[text(pitch, 'step')] ?? 0
  return (Number(text(pitch, 'octave')) + 1) * 12 + step + Math.round(Number(text(pitch, 'alter') || 0))
}

/** The tonic pitch class and mode of a <key> element (fifths and mode). */
function readKey(key: Element): { key: number; minor: boolean } {
  const fifths = Number(text(key, 'fifths') || 0)
  const major = (((fifths * 7) % 12) + 12) % 12
  const minor = text(key, 'mode') === 'minor'
  return { key: minor ? (major + 9) % 12 : major, minor }
}

/** What a measure holds once read. */
interface ReadMeasure {
  length: number // in quarter notes, from the meter
  content: number // quarter notes the notes fill (shorter in a pickup)
  time?: TimeSignature
  notes: MelodyNote[]
  chords: { at: number; symbol: string | null }[]
  marks: Partial<ChartBar>
}

/** Read a MusicXML document (score-partwise) into a chart with a melody. */
export function chartFromMusicXml(doc: Document): Chart {
  const score = doc.documentElement
  if (!score || score.nodeName !== 'score-partwise') {
    throw new Error(score?.nodeName === 'score-timewise' ? 'Timewise MusicXML is not supported: export it as partwise' : 'Not a MusicXML score')
  }
  const title = text(child(score, 'work'), 'work-title') || text(score, 'movement-title') || 'Untitled'
  const composer = children(child(score, 'identification') ?? score, 'creator')
    .find((c) => c.getAttribute('type') === 'composer')?.textContent?.trim()
  const part = child(score, 'part')
  if (!part) throw new Error('The score has no part')

  let divisions = 1
  let time: TimeSignature = [4, 4]
  let keyInfo: { key: number; minor: boolean } | null = null
  let bpm = 0
  let voice: string | null = null // the melody voice: the first one with a note
  const measures: ReadMeasure[] = []
  let tied: MelodyNote | null = null // the last note, while a tie continues it

  for (const measure of children(part, 'measure')) {
    const read: ReadMeasure = { length: 0, content: 0, notes: [], chords: [], marks: {} }
    let cursor = 0 // in divisions
    let lastStart = 0
    let end = 0
    for (let node = measure.firstChild; node; node = node.nextSibling) {
      if (node.nodeType !== 1) continue
      const element = node as Element
      const name = element.nodeName
      if (name === 'attributes') {
        divisions = Number(text(element, 'divisions')) || divisions
        const timeElement = child(element, 'time')
        if (timeElement && text(timeElement, 'beats')) {
          const next: TimeSignature = [Number(text(timeElement, 'beats')), Number(text(timeElement, 'beat-type'))]
          if (measures.length && (next[0] !== time[0] || next[1] !== time[1])) read.time = next
          time = next
        }
        const keyElement = child(element, 'key')
        if (keyElement && !keyInfo) keyInfo = readKey(keyElement)
      } else if (name === 'backup') {
        cursor -= Number(text(element, 'duration'))
      } else if (name === 'forward') {
        cursor += Number(text(element, 'duration'))
      } else if (name === 'harmony') {
        const symbol = harmonySymbol(element)
        const offset = Number(text(element, 'offset') || 0)
        if (symbol !== undefined) read.chords.push({ at: (cursor + offset) / divisions, symbol })
      } else if (name === 'direction') {
        const type = child(element, 'direction-type')
        if (child(type, 'segno')) read.marks.segno = true
        if (child(type, 'coda')) read.marks.coda = true
        const rehearsal = text(type, 'rehearsal')
        if (rehearsal) read.marks.section = rehearsal.slice(0, 6)
        const words = text(type, 'words')
        const chord = words ? textChord(words) : undefined
        if (chord) read.chords.push({ at: cursor / divisions, symbol: chord })
        else if (words && /D\.?\s?[CS]\.|Fine|To Coda/i.test(words)) read.marks.directive = words
        const tempo = child(element, 'sound')?.getAttribute('tempo')
        if (tempo && !bpm) bpm = Number(tempo)
      } else if (name === 'sound') {
        const tempo = element.getAttribute('tempo')
        if (tempo && !bpm) bpm = Number(tempo)
      } else if (name === 'barline') {
        const repeat = child(element, 'repeat')
        if (repeat?.getAttribute('direction') === 'forward') read.marks.repeatStart = true
        if (repeat?.getAttribute('direction') === 'backward') {
          read.marks.repeatEnd = true
          const times = Number(repeat.getAttribute('times'))
          if (times > 2) read.marks.repeatTimes = times
        }
        const ending = child(element, 'ending')
        if (ending?.getAttribute('type') === 'start') read.marks.ending = Number(ending.getAttribute('number')?.split(/[,\s]/)[0]) || 1
        const style = text(element, 'bar-style')
        if (style === 'light-heavy') read.marks.barline = 'final'
        else if (style === 'light-light' && !repeat) read.marks.barline = 'double'
      } else if (name === 'note') {
        if (child(element, 'grace') || child(element, 'cue')) continue
        const duration = Number(text(element, 'duration') || 0)
        const isChordTone = !!child(element, 'chord')
        const start = isChordTone ? lastStart : cursor
        if (!isChordTone) {
          lastStart = cursor
          cursor += duration
          end = Math.max(end, cursor)
        }
        const noteVoice = text(element, 'voice') || '1'
        const pitch = child(element, 'pitch')
        if (!pitch) continue
        if (voice === null) voice = noteVoice
        if (noteVoice !== voice) continue
        const midi = midiPitch(pitch)
        const ties = children(element, 'tie').map((t) => t.getAttribute('type'))
        if (isChordTone) {
          // The melody is the chord's top note
          const last = read.notes.at(-1)
          if (last && Math.abs(last.at - start / divisions) < 1e-6 && midi > last.pitch) last.pitch = midi
          continue
        }
        if (ties.includes('stop') && tied && tied.pitch === midi) {
          tied.beats += duration / divisions // continues the note from before (perhaps from the bar before)
        } else {
          const note: MelodyNote = { bar: measures.length, at: start / divisions, beats: duration / divisions, pitch: midi }
          read.notes.push(note)
          tied = note
        }
        if (!ties.includes('start')) tied = null // the next note starts afresh
      }
    }
    read.length = (time[0] * 4) / time[1]
    read.content = end / divisions
    measures.push(read)
  }
  if (!measures.length) throw new Error('The score has no measures')

  // A pickup (a first bar shorter than its meter) becomes a whole bar ending with its notes
  const first = measures[0]
  if (first.content > 0 && first.content < first.length - 1e-6) {
    const shift = first.length - first.content
    for (const note of first.notes) note.at += shift
    for (const chord of first.chords) chord.at += shift
  }

  let playing: string | null = null // the chord sounding at the end of the bar before
  const bars: ChartBar[] = measures.map((m, index) => {
    const changes = [...m.chords].filter((c) => c.at < m.length - 1e-6).sort((a, b) => a.at - b.at)
    const chords: BarChord[] = []
    if (changes.length && changes[0].at > 1e-6) chords.push({ symbol: playing, beats: changes[0].at })
    changes.forEach((change, i) => {
      const next = changes[i + 1]?.at ?? m.length
      if (next - change.at > 1e-6) chords.push({ symbol: change.symbol, beats: next - change.at })
    })
    if (!chords.length && index === 0) chords.push({ symbol: null, beats: m.length })
    if (chords.length) playing = chords[chords.length - 1].symbol
    return {
      chords,
      cells: 4,
      ...(index % ROW === 0 ? { rowStart: true } : {}),
      ...(m.time ? { time: m.time } : {}),
      ...m.marks,
    }
  })
  if (!bars.at(-1)!.barline && !bars.at(-1)!.repeatEnd) bars[bars.length - 1].barline = 'final'
  const notes = measures.flatMap((m) => m.notes).filter((n) => n.beats > 0)
  if (!notes.length) throw new Error('No melody notes found in the first part')

  return {
    format: 'openstand-chart',
    version: 1,
    title,
    ...(composer ? { composer } : {}),
    style: 'swing',
    key: keyInfo?.key ?? 0,
    ...(keyInfo?.minor ? { minor: true } : {}),
    bpm: bpm > 0 ? Math.round(Math.min(300, Math.max(40, bpm))) : 120,
    time: initialTime(part),
    bars,
    melody: { notes, source: 'MusicXML import' },
  }
}

/** The time signature of the first measure of a part (4/4 when none is written). */
function initialTime(part: Element): TimeSignature {
  const time = child(child(children(part, 'measure')[0], 'attributes'), 'time')
  return time && text(time, 'beats') ? [Number(text(time, 'beats')), Number(text(time, 'beat-type'))] : [4, 4]
}

/** The XML text of a compressed MusicXML file (.mxl): the score its container points to. */
export async function unzipMxl(data: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(data)
  const view = new DataView(data)
  // The central directory lists the entries; it ends with a record signed 0x06054b50
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Not a compressed MusicXML (.mxl) file')
  const count = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  const entries = new Map<string, { method: number; size: number; local: number }>()
  for (let i = 0; i < count; i++) {
    const nameLength = view.getUint16(offset + 28, true)
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    entries.set(name, { method: view.getUint16(offset + 10, true), size: view.getUint32(offset + 20, true), local: view.getUint32(offset + 42, true) })
    offset += 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
  }
  /** The uncompressed text of an entry. */
  const read = async (name: string): Promise<string> => {
    const entry = entries.get(name)
    if (!entry) throw new Error(`Missing ${name} in the .mxl file`)
    const start = entry.local + 30 + view.getUint16(entry.local + 26, true) + view.getUint16(entry.local + 28, true)
    const raw = bytes.subarray(start, start + entry.size)
    if (entry.method === 0) return new TextDecoder().decode(raw)
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    return new Response(stream).text()
  }
  const container = entries.has('META-INF/container.xml') ? await read('META-INF/container.xml') : ''
  const root = /full-path="([^"]+)"/.exec(container)?.[1] ??
    [...entries.keys()].find((name) => !name.startsWith('META-INF') && /\.(musicxml|xml)$/i.test(name))
  if (!root) throw new Error('No score found in the .mxl file')
  return read(root)
}

/** Read MusicXML text into a chart; `parse` turns text into a document (DOMParser in browsers). */
export function parseMusicXml(xml: string, parse: (text: string) => Document = (t) => new DOMParser().parseFromString(t, 'application/xml')): Chart {
  const doc = parse(xml.replace(/^﻿/, ''))
  if (doc.getElementsByTagName('parsererror').length) throw new Error('This is not valid XML')
  return chartFromMusicXml(doc)
}
