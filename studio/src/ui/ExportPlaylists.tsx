// The Export menu's playlists: tick the person's playlists to download as one Studio export file,
// each under the name typed beside it (read back by Import > Studio export). The Practice
// Companion Playlist is not offered: its songs ship with the app.

import { useState } from 'react'
import { exportFileName, serializeStudioPlaylists } from '../library/playlistExport'
import { songsOf, usePlaylists } from '../library/playlists'
import type { Tune } from '../music/songs'
import { downloadBlob } from './useTrackDownload'

/** The playlists to tick and name, and the Download button. */
export function ExportPlaylists({ tunes, onDone }: { tunes: readonly Tune[]; onDone: () => void }) {
  const playlists = usePlaylists()
  const [ticked, setTicked] = useState<string[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const chosen = playlists.filter((list) => ticked.includes(list.id))
  const count = chosen.reduce((sum, list) => sum + songsOf(list, tunes).length, 0)

  /** Download the ticked playlists under their names. */
  const download = () => {
    const lists = chosen.map((list) => ({ name: names[list.id] ?? list.name, charts: songsOf(list, tunes).map((tune) => tune.chart) }))
    const file = serializeStudioPlaylists(lists)
    downloadBlob(new Blob([file], { type: 'application/json' }), exportFileName(lists.map((list) => list.name)))
    onDone()
  }

  if (!playlists.length) {
    return <p className="share-desc export-empty">Make a playlist first (Songs &gt; Playlists): playlists are what you export.</p>
  }
  return (
    <fieldset className="export-playlists">
      <legend className="share-name">Playlists to export</legend>
      {playlists.map((list) => (
        <div key={list.id} className="export-playlist">
          <label>
            <input type="checkbox" checked={ticked.includes(list.id)}
              onChange={() => setTicked(ticked.includes(list.id) ? ticked.filter((id) => id !== list.id) : [...ticked, list.id])} />
            <span className="library-count">{songsOf(list, tunes).length}</span>
          </label>
          <input className="library-search" value={names[list.id] ?? list.name} aria-label={`Name of ${list.name} in the file`}
            onChange={(e) => setNames({ ...names, [list.id]: e.target.value })} />
        </div>
      ))}
      <button className="button button-primary" disabled={!count} onClick={download}>
        Download {count ? `${count} song${count === 1 ? '' : 's'}` : ''}
      </button>
    </fieldset>
  )
}
