// Lead sheets served with a local build for testing, read-only: a Studio export placed at
// studio/public/leadsheets/weimar_solos.json (made by weimar_playlist.py; ignored by git, so
// the published web demo has none).
import type { Tune } from '../music/songs'
import { reportError } from '../errorReports'
import { parseStudioPlaylists } from './playlistExport'

const BUNDLED_URL = `${import.meta.env.BASE_URL}leadsheets/weimar_solos.json`

/** The bundled lead sheets, or none when the build has no such file. */
export async function loadBundledLeadSheets(): Promise<Tune[]> {
  try {
    const response = await fetch(BUNDLED_URL)
    // A missing file is served as the app's page (a client-side route) or as a 404
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) return []
    return parseStudioPlaylists(await response.text()).flatMap((list) => list.charts.map((chart, i) => ({
      id: `bundled:${chart.melody?.source ?? `${list.name}:${i}`}`,
      chart,
      source: 'bundled' as const,
      playlist: list.name,
      addedAt: 0,
    })))
  } catch (error) {
    reportError(error, 'bundled lead sheets')
    return []
  }
}
