// The ChoCo score search: request to the local server, results and version choice.
// library/catalog.ts answers the same searches from the bundled catalog in the native app.

export const SCORE_LIMIT = 100 // the server returns at most this many songs per search

// A catalog progression that the ChoCo search can filter by
export interface CatalogProgression {
  id: string
  label: string
  unique_song_count: number
}

/** The ChoCo search request: title text, plus the progressions a song must contain. */
export function scoresUrl(query: string, progressions: string[], matchAll: boolean): string {
  const params = new URLSearchParams({ q: query })
  if (progressions.length) {
    params.set('progressions', progressions.join(','))
    if (!matchAll) params.set('match', 'any')
  }
  return `/api/scores?${params}`
}

export interface ScoreVersion {
  id: string
  title: string
  corpus: string
  artist: string
}

export interface ScoreGroup extends ScoreVersion {
  versions: ScoreVersion[] // only the versions that pass the progression filter
}

/**
 * The version a song opens: the one picked earlier from its menu while it is still
 * offered, otherwise the song's default. A filter can hide a version picked before it.
 */
export function versionToOpen(group: Pick<ScoreGroup, 'id' | 'versions'>, picked: string | undefined): string {
  return picked && group.versions.some((version) => version.id === picked) ? picked : group.id
}
