import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CheckFilter } from './CheckFilter'
import { keyPrefersFlats, noteName } from '../music/chords'
import type { Tune } from '../music/songs'
import { getStyle } from '../styles'
import { categoryNames, inCategories } from '../library/playlistExport'
import { DEFAULT_PLAYLIST_ID, DEFAULT_PLAYLIST_NAME, defaultHidden, inDefaultPlaylist, removeSong, showPlaylist, songsOf, useHiddenSongs, usePlaylists, useShownPlaylist, type Playlist } from '../library/playlists'
import { listProgressions, searchSongs } from '../library/catalog'
import { chartProgressions, hasProgressions, patternFromLabel } from '../library/progressionMatch'
import { BANK_URL, type QuestionBank } from '../exercises/nameProgression'
import { SCORE_LIMIT, versionToOpen, type CatalogProgression, type ScoreGroup } from '../library/scoreSearch'
import { PlaylistPanel } from './PlaylistPanel'

interface LibraryProps {
  tunes: Tune[]
  selectedId: string
  onSelect: (id: string) => void
  onLoadChoco?: (id: string) => Promise<void> // omitted: no ChoCo catalog search (the Lead Sheet Player)
  onImport?: () => void
  onNew?: () => void
  emptyText?: string // shown when there is no tune at all
  disabled?: boolean // while a chart is being edited
  categories?: boolean // shipped licks or exercises: their categories instead of playlists
  onTunesDeleted?: (ids: string[]) => void // songs deleted from the device (taken out of their last playlist)
  newLabel?: string // the New button's words (Exercises Sightreading: Build)
  panel?: ReactNode // a panel under the buttons (Exercises Sightreading: the exercise builder)
}

const CHOCO_COUNT = '28,000+' // songs of the ChoCo catalog (28,823 in its last build)
const LIMIT = 250 // long playlists are filtered by search rather than scrolled
// Fold a text for search: lower case, no accents
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
// Titles in alphabetical order, their numbers in number order ("Blues 2" before "Blues 10")
const byTitle = (a: Tune, b: Tune) => a.chart.title.localeCompare(b.chart.title, undefined, { numeric: true })

/**
 * The tune list: the playlist shown (the App Playlist: the songs shipped with the
 * app and a search of the ChoCo catalog; or one of the person's playlists), the Playlists panel
 * that makes, fills and deletes playlists, and a progression filter. Licks and exercises
 * (`categories`) are listed by category instead.
 */
export function Library({ tunes, selectedId, onSelect, onLoadChoco, onImport, onNew, emptyText, disabled, categories = false, onTunesDeleted, newLabel = 'New', panel }: LibraryProps) {
  const [query, setQuery] = useState('')
  const [scoreGroups, setScoreGroups] = useState<ScoreGroup[]>([])
  const [scoreError, setScoreError] = useState('')
  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>({})
  const [chosenCategories, setChosenCategories] = useState<string[]>([]) // none: every category
  const [catalog, setCatalog] = useState<CatalogProgression[]>([])
  const [chosen, setChosen] = useState<string[]>([]) // progressions a song must contain
  const [matchAll, setMatchAll] = useState(false) // any of the chosen progressions (or all of them)
  const [panelOpen, setPanelOpen] = useState(false)
  const playlists = usePlaylists()
  const shownId = useShownPlaylist()
  const hidden = useHiddenSongs() // shipped and ChoCo songs deleted

  // The playlist shown: one of the person's, or the default one (unless it is hidden: then their first)
  const noDefault = defaultHidden(hidden)
  const shown: Playlist | null = categories ? null : playlists.find((list) => list.id === shownId) ?? (noDefault ? playlists[0] ?? null : null)
  const showsNothing = !categories && !shown && noDefault // the default playlist hidden, and no playlist of the person's
  const showCatalog = !categories && !shown && !noDefault && !!onLoadChoco
  const shownGroups = useMemo(() => (showCatalog ? scoreGroups.filter((group) => !hidden.includes(`choco:${group.id}`)) : []),
    [showCatalog, scoreGroups, hidden])

  // The songs of the list before the search and the progressions: a category's licks, a playlist's
  // songs in its order, or the shipped songs by title
  const listed = useMemo(() => {
    if (categories) return inCategories(tunes, chosenCategories)
    if (shown) return songsOf(shown, tunes)
    if (noDefault) return []
    return tunes.filter((tune) => tune.source === 'bundled' && inDefaultPlaylist(tune) && !hidden.includes(tune.id)).sort(byTitle)
  }, [categories, tunes, chosenCategories, shown, hidden, noDefault])

  // The progressions of each listed song, found once per list (progressionMatch.ts)
  const patterns = useMemo(() => catalog.flatMap((p) => patternFromLabel(p.id, p.label) ?? []), [catalog])
  // (just after the list is drawn: reading 1,500 songs takes a moment on a phone)
  const [songProgressions, setSongProgressions] = useState<Map<string, Set<string>>>(() => new Map())
  useEffect(() => {
    if (!patterns.length) return
    const timer = window.setTimeout(() => {
      setSongProgressions(new Map(tunes.map((tune) => [tune.id, chartProgressions(tune.chart, patterns)])))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [tunes, patterns])
  const offersProgressions = catalog.length > 0
  const progressionsChosen = useMemo(() => (offersProgressions ? chosen : []), [offersProgressions, chosen])

  // How many songs of the list hold each progression: the catalog's (when it is listed) and the listed songs'
  const progressionCounts = useMemo(() => {
    const counts = new Map(catalog.map((p) => [p.id, showCatalog ? p.unique_song_count : 0]))
    for (const tune of listed) {
      for (const id of songProgressions.get(tune.id) ?? []) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }, [catalog, showCatalog, listed, songProgressions])

  // The listed songs matching the search and the chosen progressions
  const matches = useMemo(() => {
    const q = fold(query.trim())
    return listed
      .filter((t) => !q || fold(`${t.chart.title} ${t.chart.composer ?? ''}`).includes(q))
      .filter((t) => hasProgressions(songProgressions.get(t.id) ?? new Set(), progressionsChosen, matchAll))
  }, [listed, query, songProgressions, progressionsChosen, matchAll])

  // Open one version of a score
  const openVersion = async (id: string) => {
    // Report a failed chart load in the library without losing the search.
    try {
      await onLoadChoco?.(id)
      setScoreError('')
    } catch (error) {
      setScoreError(String(error))
    }
  }

  useEffect(() => {
    // Query grouped ChoCo titles with a short pause while the user is typing.
    if (!showCatalog) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void searchSongs(query, progressionsChosen, matchAll, controller.signal)
        .then((groups) => { setScoreGroups(groups); setScoreError('') })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setScoreError(String(error))
        })
    }, 180)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, progressionsChosen, matchAll, showCatalog])

  useEffect(() => {
    // Load the progressions offered by the filter once (for the saved and shipped songs too)
    const controller = new AbortController()
    // Without the catalog (offline, no server), the progressions of Name the progression
    const bank = () => fetch(BANK_URL, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() as Promise<QuestionBank> : null))
      .then((loaded) => loaded?.progressions.map(({ id, label, unique_song_count }) => ({ id, label, unique_song_count })) ?? [])
    void listProgressions(controller.signal)
      .then((list) => (list.length ? list : bank()))
      .catch(bank)
      .then(setCatalog)
      .catch(() => {
        // Without either list the filter is simply not offered
      })
    return () => controller.abort()
  }, [])

  const chosenLabels = catalog.filter((p) => chosen.includes(p.id)).map((p) => p.label.replaceAll(' – ', '–'))
  const categoryOptions = useMemo(() => {
    if (!categories) return []
    const counts = new Map<string, number>()
    for (const tune of tunes) counts.set(tune.playlist ?? '', (counts.get(tune.playlist ?? '') ?? 0) + 1)
    return categoryNames(tunes).map((name) => ({ id: name, label: name, count: counts.get(name) }))
  }, [categories, tunes])

  return (
    <nav className="library" aria-label="Songs" inert={disabled}>
      <div className="library-head">
        <h2 className="visually-hidden">{categories ? 'List' : 'Songs'}</h2>
        <span className="library-actions">
          {onNew && <button className="library-import" onClick={onNew}>
            {newLabel}
          </button>}
          {!categories && <button className="library-import" aria-expanded={panelOpen} onClick={() => setPanelOpen(!panelOpen)}>
            Playlists
          </button>}
          {onImport && <button className="library-import" onClick={onImport}>
            Import
          </button>}
        </span>
      </div>

      {panel}
      {panelOpen && !categories && <PlaylistPanel tunes={tunes} shownId={shown?.id ?? DEFAULT_PLAYLIST_ID}
        onShow={showPlaylist} onTunesDeleted={onTunesDeleted} onClose={() => setPanelOpen(false)} />}

      {!categories && playlists.length + (noDefault ? 0 : 1) > 1 && (
        <select className="select library-playlist" aria-label="Playlist" value={shown?.id ?? DEFAULT_PLAYLIST_ID}
          onChange={(e) => showPlaylist(e.target.value)}>
          {!noDefault && <option value={DEFAULT_PLAYLIST_ID}>{DEFAULT_PLAYLIST_NAME}</option>}
          {playlists.map((list) => <option key={list.id} value={list.id}>{list.name} ({songsOf(list, tunes).length})</option>)}
        </select>
      )}


      {categories && categoryOptions.length > 1 && (
        <CheckFilter name="Categories" options={categoryOptions} chosen={chosenCategories} onChange={setChosenCategories} />
      )}

      {offersProgressions && (
        <CheckFilter
          name="Progressions"
          options={catalog.map((p) => ({ id: p.id, label: p.label, count: progressionCounts.get(p.id) ?? 0 }))}
          chosen={chosen}
          onChange={setChosen}
          before={
            <div className="check-filter-match" role="group" aria-label="Songs must contain">
              <button aria-pressed={matchAll} onClick={() => setMatchAll(true)}>All of them</button>
              <button aria-pressed={!matchAll} onClick={() => setMatchAll(false)}>Any of them</button>
            </div>
          }
          summary={
            <p className="library-more">
              Songs with {chosenLabels.join(matchAll ? ' and ' : ' or ')}. Search by title within them.
            </p>
          }
        />
      )}

      <input
        className="library-search"
        type="search"
        placeholder={`Search ${matches.length}${showCatalog ? ` songs and ${CHOCO_COUNT} ChoCo charts` : categories ? '' : matches.length === 1 ? ' song' : ' songs'}`}
        aria-label="Search songs"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <ul className="library-list">
        {matches.slice(0, LIMIT).map((tune, i, list) => {
          // In categories, each starts under a bar with its name
          const group = categories && (i === 0 || list[i - 1].playlist !== tune.playlist) ? tune.playlist : ''
          return (
            <li key={tune.id} className={shown ? 'tune-row' : undefined}>
              {group && <div className="library-group">{group}</div>}
              <button
                className="tune"
                aria-current={tune.id === selectedId ? 'true' : undefined}
                onClick={() => onSelect(tune.id)}
              >
                <span className="tune-title">{tune.chart.title}</span>
                <span className="tune-meta">
                  {tune.chart.composer ? `${tune.chart.composer} · ` : ''}
                  {tune.chart.sourceStyle ?? getStyle(tune.chart.style).name} ·{' '}
                  {noteName(tune.chart.key, keyPrefersFlats(tune.chart.key))}
                  {tune.chart.minor ? '−' : ''}
                </span>
              </button>
              {shown && <button className="tune-remove" aria-label={`Remove ${tune.chart.title} from ${shown.name}`}
                title={`Remove from ${shown.name}`}
                onClick={() => void removeSong(shown, tune).then((gone) => { if (gone.length) onTunesDeleted?.(gone) })}>×</button>}
            </li>
          )
        })}
      </ul>
      {matches.length > LIMIT && (
        <p className="library-more">{matches.length - LIMIT} more. Search to narrow the list.</p>
      )}
      {showCatalog && scoreError && <p className="library-more">{scoreError}</p>}
      {shownGroups.length > 0 && <h3 className="label">ChoCo chord charts <span className="library-count">{CHOCO_COUNT}</span></h3>}
      {shownGroups.length >= SCORE_LIMIT && (
        <p className="library-more">Showing the first {SCORE_LIMIT}. Type a title to narrow the list.</p>
      )}
      <ul className="library-list">
        {shownGroups.map((group) => (
          <li key={group.id} className="score-group">
            <button className="tune" onClick={() => void openVersion(versionToOpen(group, selectedVersions[group.id]))}>
              <span className="tune-title">{group.title}</span>
              <span className="tune-meta">{group.artist ? `${group.artist} · ` : ''}{group.corpus}</span>
            </button>
            {group.versions.length > 1 && (
              <select className="select score-versions" aria-label={`Version of ${group.title}`}
                value={versionToOpen(group, selectedVersions[group.id])} onChange={(event) => {
                  setSelectedVersions((selected) => ({ ...selected, [group.id]: event.target.value }))
                  void openVersion(event.target.value)
                }}>
                {group.versions.map((version) => (
                  <option key={version.id} value={version.id}>{version.corpus} · {version.id}</option>
                ))}
              </select>
            )}
          </li>
        ))}
      </ul>
      {matches.length === 0 && shownGroups.length === 0 && (
        <p className="library-more">{showsNothing
          ? 'No playlist to show: make one with Playlists, or bring the App Playlist back with Restore all default songs (main menu).'
          : shown && !shown.songs.length
          ? 'This playlist is empty. Open a song, then add it with Edit Song > Manage playlists.'
          : !tunes.length && emptyText ? emptyText : 'No songs match.'}</p>
      )}
    </nav>
  )
}
