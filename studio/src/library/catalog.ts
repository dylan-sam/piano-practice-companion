// Where the ChoCo catalog comes from: the local server (server.py) on desktop, or the files
// bundled in the native app (studio/public/catalog, written by build_mobile_catalog.py),
// which hold the same songs, version order and charts as the server's answers.

import { Capacitor } from '@capacitor/core'
import type { Chart } from '../music/chart'
import { SCORE_LIMIT, scoresUrl, type CatalogProgression, type ScoreGroup, type ScoreVersion } from './scoreSearch'

const BASE = `${import.meta.env.BASE_URL}catalog/`

// One version in index.bin: id, title, artist, corpus, genre, folded title, progression mask, chart shard
type IndexVersion = [string, string, string, string, string, string, number, number]

interface CatalogIndex {
  format: number
  progressions: CatalogProgression[]
  songs: IndexVersion[][] // versions of each song, default version first
}

/** Whether the app reads the bundled catalog: in the native app, or when the build asks for it. */
export const usesBundledCatalog = () =>
  Capacitor.isNativePlatform() || import.meta.env.VITE_BUNDLED_CATALOG === '1'

/** Fetch and decompress one gzipped JSON file of the bundled catalog. */
async function readGzipJson<T>(name: string): Promise<T> {
  const response = await fetch(BASE + name)
  if (!response.ok || !response.body) throw new Error(`The song catalog is missing (${name})`)
  return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json() as Promise<T>
}

let index: Promise<CatalogIndex> | null = null
// Load the catalog index once
const loadIndex = () => (index ??= readGzipJson<CatalogIndex>('index.bin'))

/**
 * Fold a search text as the server does (score_search._fold): lowercase letters and digits of
 * any script, without accents or punctuation ("Cafe (with an accent)" is "cafe", Cyrillic and Hebrew stay).
 */
export function foldText(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]+/gu, '')
}

// Unpack an index row into a score version
const toVersion = ([id, title, artist, corpus]: IndexVersion): ScoreVersion => ({ id, title, artist, corpus })

/**
 * Filter the bundled songs like score_search.search_score_groups: a version is kept when its
 * title, artist or id matches the text and it holds all (or any) of the progressions; a song
 * keeps only its matching versions and opens the first of them.
 */
export function filterSongs(catalog: CatalogIndex, query: string, progressions: string[], matchAll: boolean,
  limit = SCORE_LIMIT): ScoreGroup[] {
  const text = query.trim().toLowerCase()
  const folded = foldText(text)
  const wanted = progressions.reduce((mask, id) => {
    const bit = catalog.progressions.findIndex((p) => p.id === id)
    if (bit < 0) throw new Error(`Unknown progression: ${id}`)
    return mask | (1 << bit)
  }, 0)
  const groups: ScoreGroup[] = []
  for (const song of catalog.songs) {
    const versions = song.filter(([id, , artist, , , foldedTitle, mask]) =>
      (!wanted || (matchAll ? (mask & wanted) === wanted : (mask & wanted) !== 0)) &&
      (!text || foldedTitle.includes(folded) || artist.toLowerCase().includes(text) || id.toLowerCase().includes(text)))
    if (versions.length) groups.push({ ...toVersion(versions[0]), versions: versions.map(toVersion) })
  }
  groups.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()) || a.id.localeCompare(b.id))
  return groups.slice(0, limit)
}

/** Search songs by title, optionally keeping those that contain catalog progressions. */
export async function searchSongs(query: string, progressions: string[], matchAll: boolean,
  signal?: AbortSignal): Promise<ScoreGroup[]> {
  if (usesBundledCatalog()) return filterSongs(await loadIndex(), query, progressions, matchAll)
  const response = await fetch(scoresUrl(query, progressions, matchAll), { signal })
  if (!response.ok) throw new Error('ChoCo catalog unavailable')
  return response.json() as Promise<ScoreGroup[]>
}

/** The catalog progressions offered by the filters, most common first. */
export async function listProgressions(signal?: AbortSignal): Promise<CatalogProgression[]> {
  if (usesBundledCatalog()) return (await loadIndex()).progressions
  const response = await fetch('/api/progressions', { signal })
  return response.ok ? (response.json() as Promise<CatalogProgression[]>) : []
}

/** One random song, optionally containing a catalog progression. */
export async function randomSong(progressionId = '', random: () => number = Math.random): Promise<ScoreGroup> {
  if (usesBundledCatalog()) {
    const songs = filterSongs(await loadIndex(), '', progressionId ? [progressionId] : [], true, Infinity)
    if (!songs.length) throw new Error('No matching song')
    return songs[Math.floor(random() * songs.length)]
  }
  const params = new URLSearchParams()
  if (progressionId) params.set('progression', progressionId)
  const response = await fetch(`/api/random-score?${params}`)
  const group = await response.json() as ScoreGroup & { error?: string }
  if (!response.ok) throw new Error(group.error ?? 'No matching song')
  return group
}

let shardOf: Promise<Map<string, number>> | null = null
const shards = new Map<number, Promise<Record<string, Chart>>>()

/** The Studio chart of one catalog version. */
export async function loadChart(id: string): Promise<Chart> {
  if (!usesBundledCatalog()) {
    const response = await fetch(`/api/studio/chart?id=${encodeURIComponent(id)}`)
    const chart = await response.json() as Chart & { error?: string }
    if (!response.ok) throw new Error(chart.error ?? 'Could not load the ChoCo score')
    return chart
  }
  shardOf ??= loadIndex().then((catalog) => new Map(catalog.songs.flat().map((v) => [v[0], v[7]] as const)))
  const shard = (await shardOf).get(id)
  if (shard === undefined) throw new Error(`Unknown score: ${id}`)
  if (!shards.has(shard)) shards.set(shard, readGzipJson<Record<string, Chart>>(`charts-${shard}.bin`))
  const chart = (await shards.get(shard)!)[id]
  if (!chart) throw new Error(`Unknown score: ${id}`)
  return chart
}
