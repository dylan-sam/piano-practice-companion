// Build the lead sheets shipped with the app (studio/public/leadsheets/catalog.json) from two
// public domain collections kept in the project as zips:
//
//   openewld-ec03cbd.zip             OpenEWLD (F. Simonetta, MIT): public domain Wikifonia lead
//                                    sheets as MusicXML, with Discogs genres (CC0)
//   choco-nottingham-raw-5fe168f.zip the Nottingham Music Database in ABC, as ChoCo keeps it
//
// Every tune is read with the app's own readers (formats/musicxml.ts, formats/abcImport.ts),
// checked, and left out when it cannot be read reliably; duplicates are left out too. The log
// lists every tune with its outcome. Run with `pnpm run leadsheets` (scripts/build-lead-sheets.mjs).

import { readFileSync, writeFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { DOMParser } from '@xmldom/xmldom'
import { parseMusicXml, unzipMxl } from '../src/formats/musicxml'
import { parseAbcBook } from '../src/formats/abcImport'
import { barMeters, beatsPerBar, isChart, type Chart } from '../src/music/chart'
import { isChartSymbol } from '../src/music/notation'
import { melodyToAbc } from '../src/music/abc'
import { DEFAULT_DISPLAY } from '../src/ui/display'

const FORMAT = 'ear-training-studio-playlists'
const MIN_NOTES = 16
const MIN_BARS = 4
const LOWEST = 28 // E1: lower notes are reading errors
const HIGHEST = 103 // G7

/** The files of a zip archive, by name. */
function readZip(path: string): Map<string, Buffer> {
  const data = readFileSync(path)
  let eocd = data.length - 22
  while (eocd >= 0 && data.readUInt32LE(eocd) !== 0x06054b50) eocd--
  if (eocd < 0) throw new Error(`${path} is not a zip file`)
  const files = new Map<string, Buffer>()
  let offset = data.readUInt32LE(eocd + 16)
  for (let i = 0; i < data.readUInt16LE(eocd + 10); i++) {
    const method = data.readUInt16LE(offset + 10)
    const size = data.readUInt32LE(offset + 20)
    const nameLength = data.readUInt16LE(offset + 28)
    const local = data.readUInt32LE(offset + 42)
    const name = data.toString('utf8', offset + 46, offset + 46 + nameLength)
    const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28)
    const raw = data.subarray(start, start + size)
    if (!name.endsWith('/')) files.set(name, method === 8 ? inflateRawSync(raw) : Buffer.from(raw))
    offset += 46 + nameLength + data.readUInt16LE(offset + 30) + data.readUInt16LE(offset + 32)
  }
  return files
}

/** A tune read from a collection, before curation. */
interface Candidate {
  source: string
  file: string
  title: string
  chart?: Chart
  error?: string
  warnings: string[]
}

/** The Studio style of an OpenEWLD song, from its Discogs genres and styles. */
function ewldStyle(meta: { genres: string[]; styles: string[] } | undefined): string {
  const styles = meta?.styles ?? []
  const genres = meta?.genres ?? []
  if (styles.some((s) => /bossa|samba/i.test(s)) || genres[0] === 'Latin') return 'bossa-nova'
  if (styles.some((s) => /swing|big band|dixieland|bop|cool jazz|ragtime/i.test(s)) || genres[0] === 'Jazz') return 'swing'
  if (styles[0] === 'Ballad') return 'ballad'
  if (['Rock', 'Folk, World, & Country', 'Funk / Soul', 'Reggae'].includes(genres[0] ?? '')) return 'straight pop/rock'
  return 'swing'
}

/** Read the OpenEWLD lead sheets. */
async function readOpenEwld(zip: string): Promise<Candidate[]> {
  const files = readZip(zip)
  const genres = JSON.parse(files.get('discogs_genres.json')?.toString('utf8') ?? '{}') as Record<string, { genres: string[]; styles: string[] }>
  const parse = (text: string) => new DOMParser().parseFromString(text, 'text/xml') as unknown as Document
  const out: Candidate[] = []
  for (const [name, bytes] of files) {
    if (!name.endsWith('.mxl')) continue
    const candidate: Candidate = { source: 'OpenEWLD', file: name, title: name.split('/').at(-2)?.replace(/_/g, ' ') ?? name, warnings: [] }
    try {
      const xml = await unzipMxl(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
      const chart = parseMusicXml(xml, parse)
      chart.style = ewldStyle(genres[name])
      chart.melody!.source = 'OpenEWLD (public domain Wikifonia lead sheet)'
      candidate.chart = chart
      candidate.title = chart.title
    } catch (error) {
      candidate.error = error instanceof Error ? error.message : String(error)
    }
    out.push(candidate)
  }
  return out
}

/** Read the Nottingham Music Database tune books. */
function readNottingham(zip: string): Candidate[] {
  const out: Candidate[] = []
  for (const [name, bytes] of readZip(zip)) {
    if (!name.endsWith('.abc')) continue
    const book = name.split('/').at(-1)!
    for (const result of parseAbcBook(bytes.toString('latin1'), { style: 'straight pop/rock', source: 'Nottingham Music Database', bpm: 100 })) {
      out.push({ source: 'Nottingham', file: book, title: result.title, chart: result.chart, error: result.error, warnings: result.warnings })
    }
  }
  return out
}

/** Why a chart cannot be shipped, or null when it is fine. */
export function problem(chart: Chart, warnings: string[]): string | null {
  if (!isChart(chart)) return 'not a valid chart'
  const notes = chart.melody?.notes ?? []
  if (notes.length < MIN_NOTES) return `only ${notes.length} melody notes`
  if (chart.bars.length < MIN_BARS) return `only ${chart.bars.length} bars`
  const symbols = chart.bars.flatMap((b) => b.chords.map((c) => c.symbol)).filter((s): s is string => !!s)
  if (!symbols.length) return 'no chord symbols'
  const unreadable = symbols.find((s) => !isChartSymbol(s))
  if (unreadable) return `unreadable chord ${unreadable}`
  const unreadText = warnings.find((w) => w.startsWith('Unreadable chord') || w.startsWith('Bass note'))
  if (unreadText) return unreadText
  const range = notes.find((n) => n.pitch < LOWEST || n.pitch > HIGHEST)
  if (range) return `note ${range.pitch} out of range in bar ${range.bar + 1}`
  // A bar shorter or longer than its meter is only right as a pickup or the bar completing one:
  // at the start or end of the tune or of a part, or next to a repeat or an ending
  const meters = barMeters(chart)
  let meter = beatsPerBar(chart.time) // the meter in force, which a partial bar leaves unchanged
  // Marks on a bar: repeats, endings, double bars, rehearsal marks, meter changes
  const marked = (b: Chart['bars'][number] | undefined) => !!b && !!(b.repeatStart || b.repeatEnd || b.ending ||
    b.barline || b.section || (b.time && !b.partial))
  for (const [i, bar] of chart.bars.entries()) {
    if (bar.time && !bar.partial) meter = beatsPerBar(bar.time)
    if (!bar.partial) continue
    const boundary = i === 0 || i === chart.bars.length - 1 || marked(bar) || marked(chart.bars[i + 1]) || marked(chart.bars[i - 1])
    if (!boundary) return `bar ${i + 1} holds ${meters[i].beats} of ${meter} beats`
    if (meters[i].beats > meter + 1e-6) return `bar ${i + 1} is too long (${meters[i].beats} of ${meter} beats)`
  }
  try {
    melodyToAbc(chart, 0, DEFAULT_DISPLAY)
  } catch (error) {
    return `cannot be drawn: ${String(error)}`
  }
  return null
}

/** A title folded for comparison: lower case, no accents, punctuation or leading "The". */
const titleKey = (title: string) => title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the /, '')

/** The melody's opening as a fingerprint: the same tune under another title is a duplicate. */
const melodyKey = (chart: Chart) => chart.melody!.notes.slice(0, 24).map((n) => n.pitch - chart.melody!.notes[0].pitch).join(',')

/** Build the catalog and its log. */
export async function buildCatalog(options: { openewld: string; nottingham: string; out: string; log: string }): Promise<string> {
  const candidates = [...await readOpenEwld(options.openewld), ...readNottingham(options.nottingham)]
  const lines: string[] = []
  const kept = new Map<string, Candidate[]>() // by source
  const titles = new Map<string, Candidate[]>()
  const melodies = new Map<string, Candidate>()
  const counts: Record<string, Record<string, number>> = {}
  const count = (source: string, outcome: string) => {
    counts[source] ??= {}
    counts[source][outcome] = (counts[source][outcome] ?? 0) + 1
  }
  for (const c of candidates) {
    const where = `${c.source} ${c.file}`
    if (c.error || !c.chart) {
      lines.push(`ERROR      ${where} "${c.title}": ${c.error}`)
      count(c.source, 'error')
      continue
    }
    const reason = problem(c.chart, c.warnings)
    if (reason) {
      lines.push(`LEFT OUT   ${where} "${c.title}": ${reason}`)
      count(c.source, 'left out')
      continue
    }
    // The same tune twice: the same opening melody, under any title. Folk tunes often share a
    // title with a different tune: those are kept, numbered (Cuckoo's Nest 2)
    const sameMelody = melodies.get(melodyKey(c.chart))
    if (sameMelody) {
      lines.push(`DUPLICATE  ${where} "${c.title}": same melody as ${sameMelody.source} "${sameMelody.title}"`)
      count(c.source, 'duplicate')
      continue
    }
    const key = titleKey(c.title)
    const others = titles.get(key) ?? []
    if (others.length) {
      c.chart.title = `${c.chart.title} ${others.length + 1}`
      lines.push(`RENAMED    ${where} "${c.title}": "${c.chart.title}", another tune has this title`)
      c.title = c.chart.title
    }
    titles.set(key, [...others, c])
    melodies.set(melodyKey(c.chart), c)
    if (!kept.has(c.source)) kept.set(c.source, [])
    kept.get(c.source)!.push(c)
    for (const warning of c.warnings) lines.push(`WARNING    ${where} "${c.title}": ${warning}`)
    lines.push(`OK         ${where} "${c.title}"`)
    count(c.source, 'ok')
  }
  const names: Record<string, string> = { OpenEWLD: 'OpenEWLD lead sheets', Nottingham: 'Nottingham folk tunes' }
  const playlists = [...kept].map(([source, list]) => ({
    name: names[source] ?? source,
    charts: list.map((c) => c.chart!).sort((a, b) => a.title.localeCompare(b.title)),
  }))
  writeFileSync(options.out, JSON.stringify({ format: FORMAT, version: 1, playlists }))
  const summary = Object.entries(counts).map(([source, c]) =>
    `${source}: ${Object.entries(c).map(([k, v]) => `${v} ${k}`).join(', ')}`)
  writeFileSync(options.log, ['Lead sheets shipped with the app (pnpm run leadsheets)', ...summary, '', ...lines].join('\n') + '\n')
  return summary.join('\n')
}
