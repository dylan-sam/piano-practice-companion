// Edit Song's Manage playlists dialog: tick the playlists the song is in (a song can be in
// several), untick to take it out, or make a new playlist with it.

import { useEffect, useRef } from 'react'
import type { Tune } from '../music/songs'
import { useBackClose } from './backButton'
import { PlaylistTicks } from './PlaylistPanel'

/** The dialog. */
export function ManagePlaylists({ song, onClose, onDeleted }: {
  song: Tune | null // null: closed
  onClose: () => void
  onDeleted?: (ids: string[]) => void // songs deleted (taken out of "Without playlist")
}) {
  useBackClose(!!song, onClose)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (song && !dialog.open) dialog.showModal()
    if (!song && dialog.open) dialog.close()
  }, [song])
  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="manage-title">
      {song && <>
        <h2 id="manage-title" className="dialog-title">Playlists of {song.chart.title}</h2>
        <p className="dialog-text">Tick the playlists this song is in; untick one to take it out.</p>
        <PlaylistTicks song={song} onDeleted={onDeleted} />
        <div className="dialog-row">
          <span className="dialog-spacer" />
          <button className="button button-primary" onClick={onClose}>Done</button>
        </div>
      </>}
    </dialog>
  )
}
