import { isChart, type Chart } from '../music/chart'
import { isSavedTune, type Tune } from '../music/songs'

const FORMAT = 'ear-training-studio-playlists'
const VERSION = 1

export interface StudioPlaylist {
  name: string
  charts: Chart[]
}

/** Return charts saved on this device, excluding fetched ChoCo scores and bundled lead sheets. */
export function savedTunes(tunes: Tune[]): Tune[] {
  return tunes.filter(isSavedTune)
}

/** The tunes of the tune list's playlists: the saved ones and the bundled lead sheets. */
function listedTunes(tunes: Tune[]): Tune[] {
  return tunes.filter((tune) => isSavedTune(tune) || tune.source === 'bundled')
}

/** List playlist names with My tunes first: saved ones only, or also bundled ones (`listed`). */
export function playlistNames(tunes: Tune[], listed = false): string[] {
  return [...new Set((listed ? listedTunes(tunes) : savedTunes(tunes)).map((tune) => tune.playlist ?? 'My tunes'))]
    .sort((a, b) => (a === 'My tunes' ? -1 : b === 'My tunes' ? 1 : a.localeCompare(b)))
}

/** Put the selected playlist first, followed by My tunes and other saved lists. */
export function orderSavedTunes(tunes: Tune[], selected = ''): Tune[] {
  // Export order of a tune's playlist: the selected one, then My tunes, then the rest
  const rank = (tune: Tune) => {
    const name = tune.playlist ?? 'My tunes'
    return selected && name === selected ? 0 : name === 'My tunes' ? 1 : 2
  }
  return listedTunes(tunes).sort((a, b) => rank(a) - rank(b) ||
    (a.playlist ?? 'My tunes').localeCompare(b.playlist ?? 'My tunes') ||
    a.chart.title.localeCompare(b.chart.title))
}

/** Encode one or all saved playlists without browser-specific record IDs. */
export function serializeStudioPlaylists(tunes: Tune[], selected?: string): string {
  const available = savedTunes(tunes)
  const names = playlistNames(tunes).filter((name) => selected === undefined || name === selected)
  if (!names.length) throw new Error('No saved tunes to export')
  const playlists = names.map((name) => ({
    name, charts: available.filter((tune) => (tune.playlist ?? 'My tunes') === name).map((tune) => tune.chart),
  }))
  return JSON.stringify({ format: FORMAT, version: VERSION, playlists }, null, 2) + '\n'
}

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
