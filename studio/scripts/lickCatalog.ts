// Build the lick and exercise database (pnpm run licks):
//
//   studio/public/licks/licks.json  shipped with the app: generated exercises and vocabulary, and
//                                   licks from the shipped lead sheets (OpenEWLD melodies,
//                                   Nottingham folk tunes); CC BY 4.0 like the project's data
//   weimar/licks_weimar.json        not shipped (weimar/ is ignored by git): licks and common
//                                   patterns from the Weimar Jazz Database solos (ODbL 1.0)
//   data/licks.log                  what was kept and turned down, and why
//
// The Weimar licks are built only when weimar/weimar_solos.json is there (made by
// weimar_playlist.py from wjazzd.db, see docs/DATA.md). Every chart is checked: chart format,
// chord symbols, the lick grid (onLickGrid) and range.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { isChart, type Chart } from '../src/music/chart'
import { onLickGrid } from '../src/music/licks'
import { isChartSymbol } from '../src/music/notation'
import { parseStudioPlaylists } from '../src/library/playlistExport'
import { generatedPlaylists } from './lickExercises'
import {
  candidateChart, distinctPatterns, findPatterns, mineLicks, patternChart, selectLicks,
  type MelodySource, type MiningOptions, type Selection,
} from './lickMining'

const FORMAT = 'ear-training-studio-playlists'
const LOWEST = 36 // C2
const HIGHEST = 96 // C7
const PATTERN_NOTES = 7 // a common pattern is a run of 7 notes...
const PATTERN_PLAYERS = 3 // ...played by at least 3 different players

// Order of the mined categories in the playlists
const CATEGORIES = ['ii-V-I major', 'minor ii-V-i', 'ii-V', 'V-I', 'I-vi-ii-V turnaround', 'Blues I7-IV7',
  'Major chord', 'Minor chord', 'Dominant chord', 'Altered dominant', 'Half-diminished chord', 'Diminished chord']

/** Paths of the inputs and outputs. */
export interface LickPaths {
  leadSheets: string // the shipped lead sheet catalog (OpenEWLD and Nottingham)
  weimar: string // weimar/weimar_solos.json (optional, not in git)
  out: string
  outWeimar: string
  log: string
}

/** Why a chart cannot ship, or null when it can. */
export function chartProblem(chart: Chart): string | null {
  if (!isChart(chart)) return 'not a valid chart'
  const symbols = chart.bars.flatMap((bar) => bar.chords.map((c) => c.symbol)).filter((s): s is string => s !== null)
  const bad = symbols.find((s) => !isChartSymbol(s))
  if (bad) return `chord ${bad} is not chart notation`
  const notes = chart.melody?.notes ?? []
  if (!notes.length) return 'no notes'
  if (!onLickGrid(notes)) return 'off the lick grid'
  if (notes.some((n) => n.pitch < LOWEST || n.pitch > HIGHEST)) return 'notes out of range'
  const length = chart.bars.length * 4
  if (notes.some((n) => n.bar * 4 + n.at + n.beats > length + 1e-6)) return 'notes past the last bar'
  return null
}

/** Write a playlist file, after checking every chart. Generated charts must all pass. */
function writePlaylists(path: string, playlists: { name: string; charts: Chart[] }[], log: string[], strict: boolean): number {
  const kept = playlists.map(({ name, charts }) => ({
    name,
    charts: charts.filter((chart) => {
      const problem = chartProblem(chart)
      if (problem && strict) throw new Error(`${name}: ${chart.title}: ${problem}`)
      if (problem) log.push(`  dropped ${chart.title}: ${problem}`)
      return !problem
    }),
  })).filter((p) => p.charts.length)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify({ format: FORMAT, version: 1, playlists: kept }))
  // The app must read back what was written
  parseStudioPlaylists(readFileSync(path, 'utf8'))
  return kept.reduce((sum, p) => sum + p.charts.length, 0)
}

/** Mine one collection and log what came of it. */
function mine(label: string, sources: MelodySource[], options: MiningOptions, selection: Selection, prefix: string, log: string[]): Chart[] {
  const { candidates, rejected } = mineLicks(sources, options)
  const chosen = selectLicks(candidates, selection)
  log.push(`${label}: ${sources.length} songs, ${candidates.length} windows make licks, ${chosen.length} kept`)
  for (const [reason, count] of [...rejected].sort((a, b) => b[1] - a[1])) log.push(`  turned down (${reason}): ${count}`)
  const charts: Chart[] = []
  for (const category of CATEGORIES) {
    const list = chosen.filter((c) => c.window.category === category).sort((a, b) => a.level - b.level || b.score - a.score)
    if (list.length) log.push(`  ${category}: ${list.length} of ${candidates.filter((c) => c.window.category === category).length}`)
    list.forEach((c, i) => charts.push(candidateChart(c, i + 1, prefix)))
  }
  return charts
}

/** Group charts into playlists by lick category, under a name prefix. */
function byCategory(charts: Chart[], prefix: string): { name: string; charts: Chart[] }[] {
  return CATEGORIES.map((category) => ({ name: `${prefix}${category}`, charts: charts.filter((c) => c.lick?.category === category) }))
    .filter((p) => p.charts.length)
}

/** Build the lick files and the log; returns a one-line summary. */
export function buildLickCatalog(paths: LickPaths): string {
  const log: string[] = [`Lick database built ${new Date().toISOString().slice(0, 10)}`, '']
  const generated = generatedPlaylists()
  log.push('Generated exercises and vocabulary:')
  for (const p of generated) log.push(`  ${p.name}: ${p.charts.length}`)
  log.push('')

  const shipped = parseStudioPlaylists(readFileSync(paths.leadSheets, 'utf8'))
  const collection = (name: string) => shipped.find((p) => p.name.startsWith(name))?.charts ?? []
  const standards: MelodySource[] = collection('OpenEWLD').map((chart) => ({
    chart, source: 'OpenEWLD', license: 'Public domain', tune: chart.title, performer: undefined,
  }))
  const folk: MelodySource[] = collection('Nottingham').filter((chart) => chart.time[0] === 4 && chart.time[1] === 4).map((chart) => ({
    chart, source: 'Nottingham Music Database', license: 'CC BY 4.0', tune: chart.title, folk: true,
  }))
  const standardLicks = mine('OpenEWLD melodies', standards, { minNotesPerBeat: 0.75 }, { perCategory: 40, perTune: 2, perPlayer: 2 }, 'Standards: ', log)
  const folkLicks = mine('Nottingham folk tunes (4/4)', folk, { minNotesPerBeat: 1.5 }, { perCategory: 40, perTune: 1, perPlayer: 1 }, 'Folk: ', log)
  log.push('')
  const main = [
    ...generated,
    ...byCategory(standardLicks, 'Licks from standards: '),
    ...byCategory(folkLicks, 'Licks from folk tunes: '),
  ]
  const written = writePlaylists(paths.out, main, log, true)
  let summary = `${written} charts in ${paths.out}`

  if (existsSync(paths.weimar)) {
    const solos = parseStudioPlaylists(readFileSync(paths.weimar, 'utf8')).flatMap((p) => p.charts)
    const sources: MelodySource[] = solos.map((chart) => ({
      chart, source: 'Weimar Jazz Database', license: 'ODbL 1.0', tune: chart.title,
      performer: chart.composer?.replace(/ solo$/, '') ?? 'unknown',
    }))
    const weimarLicks = mine('Weimar Jazz Database solos', sources, { minNotesPerBeat: 1 }, { perCategory: 60, perTune: 2, perPlayer: 6 }, 'Weimar: ', log)
    const found = findPatterns(sources, PATTERN_NOTES, PATTERN_PLAYERS)
    const patterns = distinctPatterns(found, 160).map((p, i) => patternChart(p, i + 1)).filter((c): c is Chart => !!c).slice(0, 120)
    log.push(`Common patterns: ${found.length} runs of ${PATTERN_NOTES} notes shared by ${PATTERN_PLAYERS} players or more, ${patterns.length} kept`)
    log.push('')
    const weimar = [...byCategory(weimarLicks, 'Weimar licks: '), { name: 'Weimar licks: common patterns', charts: patterns }]
    const count = writePlaylists(paths.outWeimar, weimar, log, false)
    summary += `, ${count} in ${paths.outWeimar}`
  } else {
    log.push(`No ${paths.weimar}: no Weimar licks built`)
  }
  writeFileSync(paths.log, log.join('\n') + '\n')
  return summary
}
