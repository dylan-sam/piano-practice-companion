// The choice of the playlist songs go into (an import, a song saved from the editor): a new
// playlist with a name, or an existing one. Never the App Playlist, which holds
// only the songs shipped with the app and the ChoCo charts.

import type { Playlist } from '../library/playlists'
import type { PlaylistChoice } from '../library/playlistChoice'

/** The two rows of a choice: a new playlist and its name, or an existing playlist. */
export function PlaylistTargetFields({ id, label, choice, playlists, onChange }: {
  id: string // unique among the choices of a form (the radio group's name)
  label: string // what goes in, for the fields' names ("Avalon", "the iReal Pro playlist Jazz")
  choice: PlaylistChoice
  playlists: readonly Playlist[]
  onChange: (change: Partial<PlaylistChoice>) => void
}) {
  return (
    <>
      <label className="import-target-row">
        <input type="radio" name={id} checked={choice.mode === 'new'} onChange={() => onChange({ mode: 'new' })} />
        A new playlist
        <input className="library-search import-target-name" value={choice.name} aria-label={`Name of the new playlist for ${label}`}
          onFocus={() => onChange({ mode: 'new' })} onChange={(e) => onChange({ name: e.target.value, mode: 'new' })} />
      </label>
      <label className="import-target-row">
        <input type="radio" name={id} checked={choice.mode === 'existing'} disabled={!playlists.length}
          onChange={() => onChange({ mode: 'existing', playlist: choice.playlist || playlists[0]?.id || '' })} />
        An existing playlist
        <select className="select" value={choice.playlist} disabled={!playlists.length} aria-label={`Existing playlist for ${label}`}
          onChange={(e) => onChange({ playlist: e.target.value, mode: 'existing' })}>
          {!playlists.length && <option value="">None yet</option>}
          {playlists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
    </>
  )
}
