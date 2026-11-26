// The question asked when a new song (or an edited copy of a shipped one) is saved: which of the
// person's playlists it goes into, or a new one. The last playlist chosen is offered first.

import { useEffect, useRef, useState } from 'react'
import type { ImportTarget } from '../library/importTunes'
import { usePlaylists } from '../library/playlists'
import { loadJson, saveJson } from '../library/storage'
import { useBackClose } from './backButton'
import { choiceReady, firstChoice, targetOf, type PlaylistChoice } from '../library/playlistChoice'
import { PlaylistTargetFields } from './PlaylistTarget'

const LAST_KEY = 'eartraining:last-playlist' // the playlist a song was last saved into
const NEW_NAME = 'My songs' // the name first suggested for a new playlist

/** The dialog; `onSave` gets where the song goes. */
export function SaveToPlaylist({ open, title, onSave, onCancel }: {
  open: boolean
  title: string // the song's title
  onSave: (target: ImportTarget) => void
  onCancel: () => void
}) {
  useBackClose(open, onCancel)
  const ref = useRef<HTMLDialogElement>(null)
  const playlists = usePlaylists()
  const [choice, setChoice] = useState<PlaylistChoice>(() => firstChoice(NEW_NAME, playlists))

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      setChoice(firstChoice(NEW_NAME, playlists, loadJson<string>(LAST_KEY, '', (v) => typeof v === 'string')))
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open, playlists])

  /** Remember the playlist chosen and save. */
  const save = () => {
    if (choice.mode === 'existing') saveJson(LAST_KEY, choice.playlist)
    onSave(targetOf(choice))
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onCancel} aria-labelledby="save-title">
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); save() }}>
        <h2 id="save-title" className="dialog-title">Save {title}</h2>
        <p className="dialog-text">Choose the playlist it goes into. You can add it to more playlists later (Songs &gt; Playlists).</p>
        <fieldset className="import-target">
          <PlaylistTargetFields id="save-target" label={title} choice={choice} playlists={playlists}
            onChange={(change) => setChoice({ ...choice, ...change })} />
        </fieldset>
        <div className="dialog-row">
          <span className="dialog-spacer" />
          <button type="button" className="button" onClick={onCancel}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={!choiceReady(choice)}>Save</button>
        </div>
      </form>
    </dialog>
  )
}
