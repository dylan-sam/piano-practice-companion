// The main menu's Delete all my data button: it asks once more, with what will be lost, before
// deleting everything the app keeps on this device (resetData.ts) and starting afresh.

import { useState } from 'react'
import { deleteAllData } from '../library/resetData'
import { reportError } from '../errorReports'

/** A button, then a warning that must be confirmed. */
export function DeleteAllData() {
  const [asking, setAsking] = useState(false)
  const [deleting, setDeleting] = useState(false)

  /** Delete, then load the app again, as on a first visit. */
  const confirm = async () => {
    setDeleting(true)
    try {
      await deleteAllData()
    } catch (cause) {
      reportError(cause, 'delete all data')
    }
    window.location.reload()
  }

  if (!asking) {
    return <button className="chip delete-data" onClick={() => setAsking(true)}>Delete all my data</button>
  }
  return (
    <div className="delete-data-confirm" role="alertdialog" aria-labelledby="delete-data-title" aria-describedby="delete-data-text">
      <strong id="delete-data-title">Are you sure?</strong>
      <p id="delete-data-text">
        All your data on this device will be deleted forever: your saved and imported songs and playlists, your
        settings and styles, remembered mistakes, levels passed and lesson progress. This cannot be undone.
      </p>
      <div className="delete-data-actions">
        <button className="button delete-data-yes" onClick={() => void confirm()} disabled={deleting}>
          {deleting ? 'Deleting...' : 'Yes, delete everything'}
        </button>
        <button className="chip" onClick={() => setAsking(false)} disabled={deleting} autoFocus>Cancel</button>
      </div>
    </div>
  )
}
