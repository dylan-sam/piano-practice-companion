import { useEffect, useMemo, useState } from 'react'
import { CheckFilter } from './CheckFilter'
import { keyPrefersFlats, noteName } from '../music/chords'
import type { Tune } from '../music/songs'
import { getStyle } from '../styles'
import { orderSavedTunes, playlistNames } from '../library/playlistExport'
import { listProgressions, searchSongs } from '../library/catalog'
import { SCORE_LIMIT, versionToOpen, type CatalogProgression, type ScoreGroup } from '../library/scoreSearch'

interface LibraryProps {
  tunes: Tune[]
  selectedId: string
  onSelect: (id: string) => void
  onLoadChoco?: (id: string) => Promise<void> // omitted: no ChoCo catalog search (the Lead Sheet Player)
  onImport?: () => void
  onNew?: () => void
  emptyText?: string // shown when there is no tune at all
  disabled?: boolean // while a chart is being edited
  onRemovePlaylist?: (playlist: string) => void
}

const CHOCO = '\u0001choco' // the ChoCo catalog, listed with the playlists (no playlist can have this name)
const CHOCO_NAME = 'ChoCo chord charts'
const LIMIT = 250 // long playlists are filtered by search rather than scrolled
// Fold a text for search: lower case, no accents
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** The tune list: ChoCo search with a progression filter, saved tunes and playlists. */
export function Library({ tunes, selectedId, onSelect, onLoadChoco, onImport, onNew, emptyText, disabled, onRemovePlaylist }: LibraryProps) {
  const [query, setQuery] = useState('')
  const [scoreGroups, setScoreGroups] = useState<ScoreGroup[]>([])
  const [scoreError, setScoreError] = useState('')
  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>({})
  const [chosenPlaylists, setChosenPlaylists] = useState<string[]>([]) // none: every playlist
  const [confirming, setConfirming] = useState(false)
  const [catalog, setCatalog] = useState<CatalogProgression[]>([])
  const [chosen, setChosen] = useState<string[]>([]) // progressions a song must contain
  const [matchAll, setMatchAll] = useState(true)
  const showActions = !!(onImport || onNew)
  const searchCatalog = !!onLoadChoco

  // The Playlists filter: the saved playlists with their song counts and, where the catalog is
  // searched, the ChoCo charts
  const choices = useMemo(() => {
    const counts = new Map<string, number>()
    for (const tune of orderSavedTunes(tunes)) counts.set(tune.playlist ?? 'My tunes', (counts.get(tune.playlist ?? 'My tunes') ?? 0) + 1)
    const named = playlistNames(tunes, true).map((name) => ({ id: name, label: name, count: counts.get(name) }))
    if (!searchCatalog) return named
    return [...named, { id: CHOCO, label: CHOCO_NAME }]
      .sort((a, b) => (a.id === 'My tunes' ? -1 : b.id === 'My tunes' ? 1 : a.label.localeCompare(b.label)))
  }, [tunes, searchCatalog])
  // Playlists that can be removed: saved in this browser (not bundled with the build)
  const removable = useMemo(() => new Set(playlistNames(tunes)), [tunes])
  // Only the checked playlists are listed (all of them when none is checked)
  const picked = useMemo(() => chosenPlaylists.filter((id) => choices.some((c) => c.id === id)), [chosenPlaylists, choices])
  const pickedSaved = useMemo(() => picked.filter((id) => id !== CHOCO), [picked])
  const showCatalog = searchCatalog && (!picked.length || picked.includes(CHOCO))
  const showSaved = !picked.length || pickedSaved.length > 0
  const filtering = showCatalog && chosen.length > 0
  const shownGroups = showCatalog ? scoreGroups : []

  // The saved tunes of the checked playlists
  const matches = useMemo(() => {
    const q = fold(query.trim())
    if (!showSaved) return []
    return orderSavedTunes(tunes, pickedSaved)
      .filter((t) => !q || fold(`${t.chart.title} ${t.chart.composer ?? ''}`).includes(q))
  }, [tunes, query, pickedSaved, showSaved])

  // One saved playlist checked: it can be removed
  const removing = picked.length === 1 && pickedSaved.length === 1 ? pickedSaved[0] : ''
  const canRemove = !!removing && removing !== 'Examples' && removable.has(removing)

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
    if (!searchCatalog) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void searchSongs(query, chosen, matchAll, controller.signal)
        .then((groups) => { setScoreGroups(groups); setScoreError('') })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setScoreError(String(error))
        })
    }, 180)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, chosen, matchAll, searchCatalog])

  useEffect(() => {
    // Load the progressions offered by the filter once
    if (!searchCatalog) return
    const controller = new AbortController()
    void listProgressions(controller.signal)
      .then(setCatalog)
      .catch(() => {
        // Without the list the filter is simply not offered
      })
    return () => controller.abort()
  }, [searchCatalog])

  const chosenLabels = catalog.filter((p) => chosen.includes(p.id)).map((p) => p.label.replaceAll(' \u2013 ', '\u2013'))

  return (
    <nav className="library" aria-label="Songs" inert={disabled}>
      <div className="library-head">
        <h2 className="label">
          Songs <span className="library-count">{shownGroups.length + (filtering ? 0 : matches.length)}</span>
        </h2>
        {showActions && <span className="library-actions">
          {onNew && <button className="library-import" onClick={onNew}>
            New
          </button>}
          {onImport && <button className="library-import" onClick={onImport}>
            Import
          </button>}
        </span>}
      </div>

      <input
        className="library-search"
        type="search"
        placeholder={!showCatalog ? 'Search title or performer' : !showSaved ? 'Search ChoCo title or artist' : 'Search ChoCo title, artist or saved song'}
        aria-label="Search songs"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {choices.length > 1 && (
        <CheckFilter
          name="Playlists"
          options={choices}
          chosen={picked}
          onChange={(next) => { setChosenPlaylists(next); setConfirming(false) }}
          actions={showActions && canRemove && onRemovePlaylist && (
            <button
              className={confirming ? 'library-remove library-remove-confirm' : 'library-remove'}
              onClick={() => {
                if (!confirming) return setConfirming(true)
                onRemovePlaylist(removing)
                setChosenPlaylists([])
                setConfirming(false)
              }}
              onBlur={() => setConfirming(false)}
            >
              {confirming ? `Remove ${removing}?` : `Remove ${removing}`}
            </button>
          )}
        />
      )}

      {showCatalog && catalog.length > 0 && (
        <CheckFilter
          name="Progressions"
          options={catalog.map((p) => ({ id: p.id, label: p.label, count: p.unique_song_count }))}
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

      {matches.length > 0 && !filtering && (
        <h3 className="label">Saved songs</h3>
      )}
      <ul className="library-list">
        {(filtering ? [] : matches.slice(0, LIMIT)).map((tune, i, shown) => {
          // Each playlist starts under a bar with its name
          const name = tune.playlist ?? 'My tunes'
          const starts = i === 0 || (shown[i - 1].playlist ?? 'My tunes') !== name
          return (
            <li key={tune.id}>
              {starts && <div className="library-group">{name}</div>}
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
            </li>
          )
        })}
      </ul>
      {matches.length > LIMIT && !filtering && (
        <p className="library-more">{matches.length - LIMIT} more. Search to narrow the list.</p>
      )}
      {showCatalog && scoreError && <p className="library-more">{scoreError}</p>}
      {shownGroups.length > 0 && <h3 className="label">ChoCo scores</h3>}
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
      {(filtering || matches.length === 0) && shownGroups.length === 0 && (
        <p className="library-more">{!tunes.length && emptyText ? emptyText : 'No songs match.'}</p>
      )}
    </nav>
  )
}
