// The main menu's Restore all default songs button, beside Delete all my data: the songs of the
// App Playlist deleted (they are only hidden), the App Playlist itself, and the example exercises
// of Exercises Sightreading deleted, come back.

import { useState } from 'react'
import { defaultHidden, hiddenSongCount, showHiddenSongs, useHiddenSongs } from '../library/playlists'
import { isHiddenExample } from '../exercises/builder/exercisePresets'

/** The button; greyed out while nothing is deleted, then saying what came back. */
export function RecoverAppSongs() {
  const hidden = useHiddenSongs()
  const [done, setDone] = useState('')
  const exercises = hidden.filter(isHiddenExample).length
  const songs = hiddenSongCount(hidden) - exercises
  /** Bring everything hidden back. */
  const recover = () => {
    const count = (n: number, word: string) => (n ? [`${n} ${word}${n === 1 ? '' : 's'}`] : [])
    const parts = [...count(songs, 'song'), ...count(exercises, 'example exercise'), ...(defaultHidden(hidden) ? ['the App Playlist'] : [])]
    showHiddenSongs()
    setDone(`Recovered ${parts.slice(0, -1).join(', ')}${parts.length > 1 ? ' and ' : ''}${parts.at(-1)}.`)
  }
  return (
    <span className="recover-songs">
      <button className="chip" disabled={!hidden.length} onClick={recover}
        title={hidden.length ? undefined : 'No song of the app is deleted'}>Restore all default songs</button>
      {done && <span className="sight-hint" role="status">{done}</span>}
    </span>
  )
}
