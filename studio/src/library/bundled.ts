// Lead sheets served with the app, read-only:
// - catalog.json: the public domain lead sheets shipped with the project (OpenEWLD, Nottingham
//   Music Database), built by `pnpm run leadsheets` (scripts/leadSheetCatalog.ts)
// - weimar_solos.json: Weimar Jazz Database solos for testing, made by weimar_playlist.py; it
//   is ignored by git, so only a local build has it
import type { Tune } from '../music/songs'
import { reportError } from '../errorReports'
import { parseStudioPlaylists } from './playlistExport'

const FILES = ['catalog.json', ...(__WEIMAR_SOLOS__ ? ['weimar_solos.json'] : [])]

/** The lead sheets of one bundled file, or none when the build does not have it. */
async function loadFile(file: string): Promise<Tune[]> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}leadsheets/${file}`)
    // A missing file is served as the app's page (a client-side route) or as a 404
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) return []
    return parseStudioPlaylists(await response.text()).flatMap((list) => list.charts.map((chart) => ({
      id: `bundled:${file}:${list.name}:${chart.title}`,
      chart,
      source: 'bundled' as const,
      playlist: list.name,
      addedAt: 0,
    })))
  } catch (error) {
    reportError(error, `bundled lead sheets ${file}`)
    return []
  }
}

/** All the bundled lead sheets. */
export async function loadBundledLeadSheets(): Promise<Tune[]> {
  return (await Promise.all(FILES.map(loadFile))).flat()
}
