// Lead sheets served with the app, read-only:
// - leadsheets/catalog.json: the public domain lead sheets shipped with the project (OpenEWLD,
//   Nottingham Music Database), built by `pnpm run leadsheets` (scripts/leadSheetCatalog.ts)
// - licks/licks.json: the lick and exercise database, built by `pnpm run licks`
//   (scripts/lickCatalog.ts, docs/LICKS.md); only the screens that use it load it
import type { Tune } from '../music/songs'
import { reportError } from '../errorReports'
import { parseStudioPlaylists } from './playlistExport'

const LEAD_SHEETS = ['leadsheets/catalog.json']
const LICKS = ['licks/licks.json']

/** The lead sheets of one bundled file (a path under public/), or none when the build does not have it. */
async function loadFile(path: string): Promise<Tune[]> {
  const file = path.split('/').pop() ?? path
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}${path}`)
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

/** All the bundled lead sheets, and the licks and exercises when `licks` is asked for. */
export async function loadBundledLeadSheets(options: { licks?: boolean } = {}): Promise<Tune[]> {
  const files = [...LEAD_SHEETS, ...(options.licks ? LICKS : [])]
  return (await Promise.all(files.map(loadFile))).flat()
}
