import { useEffect, useRef, useState } from 'react'

export interface ImportResult {
  tunes: number
  playlists: string[]
}

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  onImport: (text: string) => Promise<ImportResult>
  onImportStudio: (text: string) => Promise<ImportResult>
}

/** Import iReal Pro links or portable Studio playlist JSON files. */
export function ImportDialog({ open, onClose, onImport, onImportStudio }: ImportDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [source, setSource] = useState<'ireal' | 'studio'>('ireal')
  const [text, setText] = useState('')
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; message?: string }>({
    kind: 'idle',
  })

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      setStatus({ kind: 'idle' })
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  /** Parse and save the selected import format, reporting errors in the dialog. */
  const run = async (input: string) => {
    setStatus({ kind: 'busy' })
    try {
      const result = await (source === 'ireal' ? onImport(input) : onImportStudio(input))
      if (result.tunes === 0) {
        setStatus({ kind: 'error', message: 'No tunes found in this import.' })
        return
      }
      setText('')
      setStatus({
        kind: 'done',
        message: `Added ${result.tunes} ${result.tunes === 1 ? 'tune' : 'tunes'} to ${result.playlists.join(', ')}.`,
      })
    } catch (err) {
      setStatus({ kind: 'error', message: String(err) })
    }
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="import-title">
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          void run(text)
        }}
      >
        <h2 id="import-title" className="dialog-title">
          Import tunes
        </h2>
        <div className="import-source" role="group" aria-label="Import tunes from">
          <button type="button" className="chip" aria-pressed={source === 'ireal'}
            onClick={() => { setSource('ireal'); setText(''); setStatus({ kind: 'idle' }) }}>iReal Pro</button>
          <button type="button" className="chip" aria-pressed={source === 'studio'}
            onClick={() => { setSource('studio'); setText(''); setStatus({ kind: 'idle' }) }}>Studio export</button>
        </div>
        <p className="dialog-text">
          {source === 'ireal' ? <>
            Paste an iReal Pro link (<code>irealb://...</code>) or a whole playlist, or choose an iReal Pro HTML export.
          </> : <>
            Choose a Studio playlist JSON export or paste its contents. Playlist names and editable charts are restored.
          </>}{' '}Tunes are stored in this browser only.
        </p>
        <textarea
          className="dialog-input"
          rows={5}
          placeholder={source === 'ireal' ? 'irealb://…' : '{ "format": "ear-training-studio-playlists", ... }'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={source === 'ireal' ? 'iReal Pro link' : 'Studio export JSON'}
        />
        <div className="dialog-row">
          <label className="file-button">
            Choose file
            <input
              type="file"
              accept={source === 'ireal' ? '.html,.htm,.txt' : '.json'}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) await run(await file.text())
                e.target.value = ''
              }}
            />
          </label>
          <span className="dialog-spacer" />
          <button type="button" className="button" onClick={onClose}>
            Close
          </button>
          <button type="submit" className="button button-primary" disabled={!text.trim() || status.kind === 'busy'}>
            Import
          </button>
        </div>
        {status.message && (
          <p className={status.kind === 'error' ? 'dialog-status dialog-status-error' : 'dialog-status'} role="status">
            {status.message}
          </p>
        )}
      </form>
    </dialog>
  )
}
