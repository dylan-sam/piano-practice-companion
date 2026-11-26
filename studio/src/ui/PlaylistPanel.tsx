// Playlists in two places: the Playlists panel of the song list (make a playlist, show one, delete
// one with all its songs, only those in no other playlist, or none) and the Manage playlists dialog
// of Edit Song (tick the playlists the song is in, or make one with it). The App Playlist is listed
// first in the panel; deleting it only hides it.

import { useState } from 'react'
import {
  createPlaylist, DEFAULT_PLAYLIST_ID, DEFAULT_PLAYLIST_NAME, defaultHidden, deletePlaylist, hideDefaultPlaylist,
  songsOf, songsToDelete, togglePlaylist, useHiddenSongs, usePlaylists, type Playlist, type PlaylistSongs,
} from '../library/playlists'
import type { Tune } from '../music/songs'
import { Icon } from './Icon'

/** The box ticking a song in a playlist. */
function Tick({ list, song, onDeleted }: { list: Playlist; song: Tune | null; onDeleted?: (ids: string[]) => void }) {
  return (
    <input type="checkbox" className="playlist-check" disabled={!song} checked={!!song && list.songs.includes(song.id)}
      aria-label={song ? `${song.chart.title} in ${list.name}` : list.name}
      onChange={() => { if (song) void togglePlaylist(list, song).then((gone) => { if (gone.length) onDeleted?.(gone) }) }} />
  )
}

/** Make a playlist, with a song in it when one is given. */
export function NewPlaylist({ song, onMade }: { song: Tune | null; onMade?: (list: Playlist) => void }) {
  const [name, setName] = useState('')
  return (
    <form className="playlist-new" onSubmit={(e) => {
      e.preventDefault()
      setName('') // cleared at once, ready for another name
      void createPlaylist(name, song ? [song] : []).then((list) => onMade?.(list))
    }}>
      <input className="library-search" value={name} placeholder="New playlist name" aria-label="New playlist name"
        onChange={(e) => setName(e.target.value)} />
      <button className="button" type="submit" disabled={!name.trim()}>Create</button>
    </form>
  )
}

/** The person's playlists with a box each for the song (Edit Song's Manage playlists). */
export function PlaylistTicks({ song, onDeleted }: { song: Tune; onDeleted?: (ids: string[]) => void }) {
  const playlists = usePlaylists()
  return (
    <>
      {playlists.length
        ? <ul className="playlist-list playlist-ticks">
          {playlists.map((list) => (
            <li key={list.id}>
              <Tick list={list} song={song} onDeleted={onDeleted} />
              <span className="playlist-name">{list.name}</span>
            </li>
          ))}
        </ul>
        : <p className="dialog-text">You have no playlist yet: make one below.</p>}
      <NewPlaylist song={song} />
    </>
  )
}

/** The panel of the song list. */
export function PlaylistPanel({ tunes, shownId, onShow, onTunesDeleted, onClose }: {
  tunes: Tune[] // the songs of the screen
  shownId: string // the playlist shown in the list
  onShow: (id: string) => void
  onTunesDeleted?: (ids: string[]) => void
  onClose: () => void
}) {
  const playlists = usePlaylists()
  const [deleting, setDeleting] = useState('') // the playlist whose trash was pressed: what about its songs?
  const hidden = useHiddenSongs()

  /** Delete a playlist, with all its songs, those in no other playlist, or none. */
  const remove = async (list: Playlist, songs: PlaylistSongs) => {
    setDeleting('')
    const gone = await deletePlaylist(list.id, tunes, songs)
    if (gone.length) onTunesDeleted?.(gone)
    if (shownId === list.id) onShow(DEFAULT_PLAYLIST_ID)
  }

  return (
    <section className="playlist-panel" aria-label="Playlists">
      <div className="playlist-panel-head">
        <strong>Playlists</strong>
        <button className="library-import" onClick={onClose}>Close</button>
      </div>
      <p className="library-more">Make, show or delete playlists here. To put a song in a playlist, open it, then use <b>Edit Song &gt; Manage playlists</b>.</p>
      <ul className="playlist-list">
        {!defaultHidden(hidden) && <li>
          <button className="link-button playlist-name" onClick={() => onShow(DEFAULT_PLAYLIST_ID)} aria-current={shownId === DEFAULT_PLAYLIST_ID ? 'true' : undefined}>
            {DEFAULT_PLAYLIST_NAME}
          </button>
          <span />
          <button className="tune-remove" aria-label={`Delete ${DEFAULT_PLAYLIST_NAME}`} title={`Delete ${DEFAULT_PLAYLIST_NAME} (it is only hidden)`}
            onClick={() => { if (window.confirm(`Delete the ${DEFAULT_PLAYLIST_NAME}? Its songs are only hidden: the lessons and exercises still use them, and Restore all default songs (main menu) brings it back.`)) hideDefaultPlaylist() }}>
            <Icon name="trash" />
          </button>
        </li>}
        {playlists.map((list) => (
          <li key={list.id}>
            <button className="link-button playlist-name" onClick={() => onShow(list.id)} aria-current={shownId === list.id ? 'true' : undefined}>
              {list.name}
            </button>
            <span className="library-count">{songsOf(list, tunes).length}</span>
            <button className="tune-remove" aria-label={`Delete ${list.name}`} title={`Delete ${list.name}`} aria-expanded={deleting === list.id}
              onClick={() => setDeleting(deleting === list.id ? '' : list.id)}>
              <Icon name="trash" />
            </button>
            {deleting === list.id && <DeleteChoices list={list} tunes={tunes} onChoose={(songs) => void remove(list, songs)} onCancel={() => setDeleting('')} />}
          </li>
        ))}
      </ul>
      <NewPlaylist song={null} onMade={(list) => onShow(list.id)} />
    </section>
  )
}

/** What to do with a deleted playlist's songs: delete all of them, only those in no other playlist, or none. */
function DeleteChoices({ list, tunes, onChoose, onCancel }: {
  list: Playlist
  tunes: Tune[]
  onChoose: (songs: PlaylistSongs) => void
  onCancel: () => void
}) {
  const { all, only } = songsToDelete(list.id, tunes)
  const songs = (n: number) => `${n} song${n === 1 ? '' : 's'}`
  return (
    <div className="playlist-delete" role="group" aria-label={`Delete ${list.name}`}>
      <span>Delete {list.name} and:</span>
      <button className="library-remove library-remove-confirm" disabled={!all.length} onClick={() => onChoose('all')}>its {songs(all.length)}</button>
      <button className="library-remove library-remove-confirm" disabled={!only.length} onClick={() => onChoose('only')}>
        the {songs(only.length)} in no other playlist
      </button>
      <button className="library-remove" onClick={() => onChoose('none')}>none of its songs</button>
      <button className="library-import" onClick={onCancel}>Cancel</button>
    </div>
  )
}
