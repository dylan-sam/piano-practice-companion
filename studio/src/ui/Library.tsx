import { useEffect, useMemo, useState } from 'react'
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

const ALL = ''
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
  const [playlist, setPlaylist] = useState(ALL)
  const [confirming, setConfirming] = useState(false)
  const [catalog, setCatalog] = useState<CatalogProgression[]>([])
  const [chosen, setChosen] = useState<string[]>([]) // progressions a song must contain
  const [matchAll, setMatchAll] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)
  const filtering = chosen.length > 0
  const showActions = !!(onImport || onNew)
  const searchCatalog = !!onLoadChoco

  const playlists = useMemo(() => playlistNames(tunes, true), [tunes])
  // Playlists that can be removed: saved in this browser (not bundled with the build)
  const removable = useMemo(() => new Set(playlistNames(tunes)), [tunes])
  const activePlaylist = playlists.includes(playlist) ? playlist : ALL

  // A selected playlist leads the saved tunes; the remaining playlists stay searchable.
  const matches = useMemo(() => {
    const q = fold(query.trim())
    return orderSavedTunes(tunes, activePlaylist)
      .filter((t) => !q || fold(`${t.chart.title} ${t.chart.composer ?? ''}`).includes(q))
  }, [tunes, query, activePlaylist])

  const canRemove = activePlaylist !== ALL && activePlaylist !== 'Examples' && removable.has(activePlaylist)

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

  /** Add or remove one progression from the filter. */
  const toggleProgression = (id: string) =>
    setChosen((current) => (current.includes(id) ? current.filter((p) => p !== id) : [...current, id]))
  const chosenLabels = catalog.filter((p) => chosen.includes(p.id)).map((p) => p.label.replaceAll(' \u2013 ', '\u2013'))

  return (
    <nav className="library" aria-label="Tunes" inert={disabled}>
      <div className="library-head">
        <h2 className="label">
          Tunes <span className="library-count">{scoreGroups.length + (filtering ? 0 : matches.length)}</span>
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
        placeholder={searchCatalog ? 'Search ChoCo title, artist or saved tune' : 'Search title or performer'}
        aria-label="Search tunes"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {catalog.length > 0 && (
        <div className="progression-filter">
          <div className="progression-filter-bar">
            <button className="library-import" aria-expanded={filterOpen} onClick={() => setFilterOpen(!filterOpen)}>
              Progressions{filtering ? ` (${chosen.length})` : ''} {filterOpen ? '\u25b4' : '\u25be'}
            </button>
            {filtering && (
              <button className="library-import" onClick={() => setChosen([])}>
                Clear
              </button>
            )}
          </div>
          {filterOpen && (
            <div className="progression-filter-panel">
              <div className="progression-match" role="group" aria-label="Songs must contain">
                <button aria-pressed={matchAll} onClick={() => setMatchAll(true)}>All of them</button>
                <button aria-pressed={!matchAll} onClick={() => setMatchAll(false)}>Any of them</button>
              </div>
              <ul className="progression-options">
                {catalog.map((p) => (
                  <li key={p.id}>
                    <label>
                      <input type="checkbox" checked={chosen.includes(p.id)} onChange={() => toggleProgression(p.id)} />
                      <span className="progression-label">{p.label}</span>
                      <span className="progression-count">{p.unique_song_count}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {filtering && (
            <p className="library-more">
              Songs with {chosenLabels.join(matchAll ? ' and ' : ' or ')}. Search by title within them.
            </p>
          )}
        </div>
      )}

      {playlists.length > 1 && (
        <div className="library-filter">
          <select
            className="select"
            aria-label="Playlist"
            value={activePlaylist}
            onChange={(e) => {
              setPlaylist(e.target.value)
              setConfirming(false)
            }}
          >
            <option value={ALL}>All playlists</option>
            {playlists.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {showActions && canRemove && onRemovePlaylist && (
            <button
              className={confirming ? 'library-remove library-remove-confirm' : 'library-remove'}
              onClick={() => {
                if (!confirming) return setConfirming(true)
                onRemovePlaylist(activePlaylist)
                setPlaylist(ALL)
                setConfirming(false)
              }}
              onBlur={() => setConfirming(false)}
            >
              {confirming ? 'Remove?' : 'Remove'}
            </button>
          )}
        </div>
      )}

      {matches.length > 0 && !filtering && (
        <h3 className="label">Saved tunes{activePlaylist ? ` · ${activePlaylist} first` : ''}</h3>
      )}
      <ul className="library-list">
        {(filtering ? [] : matches.slice(0, LIMIT)).map((tune) => (
          <li key={tune.id}>
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
                {' · '}{tune.playlist ?? 'My tunes'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {matches.length > LIMIT && !filtering && (
        <p className="library-more">{matches.length - LIMIT} more. Search to narrow the list.</p>
      )}
      {scoreError && <p className="library-more">{scoreError}</p>}
      {scoreGroups.length > 0 && <h3 className="label">ChoCo scores</h3>}
      {scoreGroups.length >= SCORE_LIMIT && (
        <p className="library-more">Showing the first {SCORE_LIMIT}. Type a title to narrow the list.</p>
      )}
      <ul className="library-list">
        {scoreGroups.map((group) => (
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
      {(filtering || matches.length === 0) && scoreGroups.length === 0 && (
        <p className="library-more">{!tunes.length && emptyText ? emptyText : 'No tunes match.'}</p>
      )}
    </nav>
  )
}
