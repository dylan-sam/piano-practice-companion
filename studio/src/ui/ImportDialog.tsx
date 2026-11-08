import { useEffect, useRef, useState, type ReactNode } from 'react'
import { unzipMxl } from '../formats/musicxml'
import { useBackClose } from './backButton'

export interface ImportResult {
  tunes: number
  playlists: string[]
}

export type ImportSource = 'ireal' | 'musicxml' | 'studio'

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  sources: ImportSource[] // the formats this player offers, the first one selected
  onImport: (source: ImportSource, text: string) => Promise<ImportResult>
}

// What each format is called, what to choose or paste, and what the file picker accepts
const SOURCES: Record<ImportSource, { label: string; help: ReactNode; placeholder: string; input: string; accept: string }> = {
  ireal: {
    label: 'iReal Pro',
    help: <>Paste an iReal Pro link (<code>irealb://...</code>) or a whole playlist, or choose an iReal Pro HTML export file.</>,
    placeholder: 'irealb://\u2026',
    input: 'iReal Pro link',
    accept: '.html,.htm,.txt',
  },
  musicxml: {
    label: 'MusicXML',
    help: <>Choose a MuseScore MusicXML export file or paste its contents below.</>,
    placeholder: '<?xml version="1.0"?> <score-partwise ...>',
    input: 'MusicXML',
    accept: '.musicxml,.xml,.mxl',
  },
  studio: {
    label: 'Studio export',
    help: <>Choose a Piano Practice Companion export file or paste its contents below. Playlist names and editable charts are restored.</>,
    placeholder: '{ "format": "ear-training-studio-playlists", ... }',
    input: 'Studio export JSON',
    accept: '.json',
  },
}

/** The text of a chosen file: a compressed MusicXML file (.mxl) is unpacked first. */
async function fileText(file: File): Promise<string> {
  return /\.mxl$/i.test(file.name) ? unzipMxl(await file.arrayBuffer()) : file.text()
}

/** Import iReal Pro links, MusicXML lead sheets or portable Studio playlist JSON files. */
export function ImportDialog({ open, onClose, sources, onImport }: ImportDialogProps) {
  useBackClose(open, onClose)
  const ref = useRef<HTMLDialogElement>(null)
  const [source, setSource] = useState<ImportSource>(sources[0])
  const format = SOURCES[source]
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
    if (!input) return // a file that could not be read (its error is shown)
    setStatus({ kind: 'busy' })
    try {
      const result = await onImport(source, input)
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
        {sources.length > 1 && (
          <div className="import-source" role="group" aria-label="Import tunes from">
            {sources.map((id) => (
              <button key={id} type="button" className="chip" aria-pressed={source === id}
                onClick={() => { setSource(id); setText(''); setStatus({ kind: 'idle' }) }}>{SOURCES[id].label}</button>
            ))}
          </div>
        )}
        <p className="dialog-text">
          {format.help} Tunes are stored in this browser only.
        </p>
        <textarea
          className="dialog-input"
          rows={5}
          placeholder={format.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={format.input}
        />
        <div className="dialog-row">
          <label className="file-button">
            Choose file
            <input
              type="file"
              accept={format.accept}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) await run(await fileText(file).catch((err: unknown) => { setStatus({ kind: 'error', message: String(err) }); return '' }))
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
