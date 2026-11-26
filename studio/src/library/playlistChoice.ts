// The choice of the playlist songs go into (an import, a song saved from the editor), as the
// dialogs hold it (ui/PlaylistTarget.tsx draws it): a new playlist with a name, or an existing one.

import type { ImportTarget } from './importTunes'
import { playlistNamed, type Playlist } from './playlists'

/** Where songs go, as chosen: a new playlist (named) or an existing one (by id). */
export interface PlaylistChoice { mode: 'new' | 'existing'; name: string; playlist: string }

/** The first choice for a suggested name: the playlist of that name when there is one, else a new one with it. */
export function firstChoice(name: string, playlists: readonly Playlist[], preferred?: string): PlaylistChoice {
  const same = playlistNamed(name, playlists) ?? playlists.find((item) => item.id === preferred)
  return same ? { mode: 'existing', name, playlist: same.id } : { mode: 'new', name, playlist: playlists[0]?.id ?? '' }
}

/** What a choice saves into. */
export const targetOf = (choice: PlaylistChoice): ImportTarget =>
  choice.mode === 'existing' && choice.playlist ? { playlist: choice.playlist } : { newName: choice.name }

/** Whether a choice can be saved: a new playlist needs a name. */
export const choiceReady = (choice: PlaylistChoice): boolean => choice.mode === 'existing' || !!choice.name.trim()
