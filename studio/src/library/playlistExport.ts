import { isChart, type Chart } from '../music/chart'
import type { Tune } from '../music/songs'

const FORMAT = 'ear-training-studio-playlists'
const VERSION = 1

export interface StudioPlaylist {
  name: string
  charts: Chart[]
}

/**
 * The categories of a list of shipped licks or exercises (their file's playlists, in its order)
 * and the items of the checked ones (all when none is checked), in the file's order.
 */
export function categoryNames(tunes: readonly Tune[]): string[] {
  return [...new Set(tunes.map((tune) => tune.playlist ?? ''))]
}

/** The items of the checked categories (all of them when none is checked), keeping their order. */
export function inCategories(tunes: readonly Tune[], chosen: readonly string[]): Tune[] {
  return tunes.filter((tune) => !chosen.length || chosen.includes(tune.playlist ?? ''))
}

/** Encode playlists, each under the name chosen for the file, without browser-specific record ids. */
export function serializeStudioPlaylists(playlists: readonly StudioPlaylist[]): string {
  const kept = playlists.filter((list) => list.charts.length)
  if (!kept.length) throw new Error('No songs to export')
  return JSON.stringify({ format: FORMAT, version: VERSION, playlists: kept.map(({ name, charts }) => ({ name: name.trim() || 'My playlist', charts })) }, null, 2) + '\n'
}

/** A file name from a playlist name: lower case, words joined by hyphens. */
export const exportFileName = (names: readonly string[]): string =>
  `${names.length === 1 ? names[0].toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'playlist' : 'playlists'}.json`

/** Validate a Studio export before any of its charts are written to IndexedDB. */
export function parseStudioPlaylists(text: string): StudioPlaylist[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Invalid Studio export JSON')
  }
  if (!data || typeof data !== 'object') throw new Error('Not a Studio playlist export')
  const exportData = data as Record<string, unknown>
  if (exportData.format !== FORMAT || exportData.version !== VERSION || !Array.isArray(exportData.playlists)) {
    throw new Error('Unsupported Studio playlist export')
  }
  const playlists = exportData.playlists
  if (!playlists.length || !playlists.every((item: unknown) => {
    if (!item || typeof item !== 'object') return false
    const group = item as Record<string, unknown>
    return typeof group.name === 'string' && group.name.trim().length > 0 && group.name.length <= 200 &&
      Array.isArray(group.charts) && group.charts.length > 0 && group.charts.every(isChart)
  })) throw new Error('Studio export contains an invalid playlist or chart')
  return playlists as StudioPlaylist[]
}
