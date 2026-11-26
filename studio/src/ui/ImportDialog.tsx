import { useEffect, useRef, useState, type ReactNode } from 'react'
import { unzipMxl } from '../formats/musicxml'
import { readImport, saveImport, type ImportSource } from '../library/importTunes'
import type { StudioPlaylist } from '../library/playlistExport'
import { usePlaylists } from '../library/playlists'
import type { Tune } from '../music/songs'
import { useBackClose } from './backButton'
import { choiceReady, firstChoice, targetOf, type PlaylistChoice } from '../library/playlistChoice'
import { PlaylistTargetFields } from './PlaylistTarget'

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  sources: ImportSource[] // the formats this screen offers, the first one selected
  onImported: (added: Tune[]) => void // the songs saved, to list and open
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
    label: 'MusicXML lead sheets',
    help: <>Choose a MuseScore MusicXML export file or paste its contents below.</>,
    placeholder: '<?xml version="1.0"?> <score-partwise ...>',
    input: 'MusicXML',
    accept: '.musicxml,.xml,.mxl',
  },
  link: {
    label: 'Studio shared link',
    help: <>Paste one or more links copied with Share &gt; Copy Studio link, one per line.</>,
    placeholder: 'https://\u2026#tune=\u2026',
    input: 'Studio links',
    accept: '.txt',
  },
  studio: {
    label: 'Studio export',
    help: <>Choose a file made with Export, or paste its contents below. The playlist names in the file are suggested.</>,
    placeholder: '{ "format": "ear-training-studio-playlists", ... }',
    input: 'Studio export JSON',
    accept: '.json',
  },
}

/** The text of a chosen file: a compressed MusicXML file (.mxl) is unpacked first. */
async function fileText(file: File): Promise<string> {
  return /\.mxl$/i.test(file.name) ? unzipMxl(await file.arrayBuffer()) : file.text()
}

/**
 * Import iReal Pro links, MusicXML lead sheets, Studio links or Studio export files, in two steps:
 * read the import, then choose the playlist each of its lists goes into.
 */
export function ImportDialog({ open, onClose, sources, onImported }: ImportDialogProps) {
  useBackClose(open, onClose)
  const ref = useRef<HTMLDialogElement>(null)
  const playlists = usePlaylists()
  const [source, setSource] = useState<ImportSource>(sources[0])
  const format = SOURCES[source]
  const [text, setText] = useState('')
  const [found, setFound] = useState<{ lists: StudioPlaylist[]; choices: PlaylistChoice[] } | null>(null)
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'done' | 'error'; message?: string }>({
    kind: 'idle',
  })

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      setStatus({ kind: 'idle' })
      setFound(null)
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  /** Read the import (nothing saved yet), then ask where its lists go. */
  const read = async (input: string) => {
    if (!input) return // a file that could not be read (its error is shown)
    setStatus({ kind: 'busy' })
    try {
      const lists = await readImport(source, input)
      if (!lists.length) {
        setStatus({ kind: 'error', message: 'No songs found in this import.' })
        return
      }
      setFound({ lists, choices: lists.map((list) => firstChoice(list.name, playlists)) })
      setStatus({ kind: 'idle' })
    } catch (err) {
      setStatus({ kind: 'error', message: String(err) })
    }
  }

  /** Save the songs into the chosen playlists. */
  const save = async () => {
    if (!found) return
    setStatus({ kind: 'busy' })
    try {
      const { added, playlists: names } = await saveImport(source, found.lists, found.choices.map(targetOf))
      onImported(added)
      setText('')
      setFound(null)
      setStatus({ kind: 'done', message: `Added ${added.length} ${added.length === 1 ? 'song' : 'songs'} to ${[...new Set(names)].join(', ')}.` })
    } catch (err) {
      setStatus({ kind: 'error', message: String(err) })
    }
  }

  /** Change where one list goes. */
  const choose = (index: number, change: Partial<PlaylistChoice>) =>
    found && setFound({ ...found, choices: found.choices.map((choice, i) => (i === index ? { ...choice, ...change } : choice)) })

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="import-title">
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          void (found ? save() : read(text))
        }}
      >
        <h2 id="import-title" className="dialog-title">
          Import songs
        </h2>
        {!found && <>
          {sources.length > 1 && (
            <div className="import-source" role="group" aria-label="Import songs from">
              {sources.map((id) => (
                <button key={id} type="button" className="chip" aria-pressed={source === id}
                  onClick={() => { setSource(id); setText(''); setStatus({ kind: 'idle' }) }}>{SOURCES[id].label}</button>
              ))}
            </div>
          )}
          <p className="dialog-text">
            {format.help} Songs are stored in this browser only.
          </p>
          <textarea
            className="dialog-input"
            rows={5}
            placeholder={format.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label={format.input}
          />
        </>}
        {found && <div className="import-targets">
          <p className="dialog-text">
            Found {found.lists.reduce((sum, list) => sum + list.charts.length, 0)} songs. Choose the playlist they go into.
          </p>
          {found.lists.map((list, i) => {
            const choice = found.choices[i]
            return (
              <fieldset key={`${list.name}-${i}`} className="import-target">
                <legend>{list.name} <span className="library-count">{list.charts.length}</span></legend>
                <PlaylistTargetFields id={`target-${i}`} label={list.name} choice={choice} playlists={playlists}
                  onChange={(change) => choose(i, change)} />
              </fieldset>
            )
          })}
        </div>}
        <div className="dialog-row">
          {!found && source !== 'link' && <label className="file-button">
            Choose file
            <input
              type="file"
              accept={format.accept}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) await read(await fileText(file).catch((err: unknown) => { setStatus({ kind: 'error', message: String(err) }); return '' }))
                e.target.value = ''
              }}
            />
          </label>}
          {found && <button type="button" className="button" onClick={() => setFound(null)}>Back</button>}
          <span className="dialog-spacer" />
          <button type="button" className="button" onClick={onClose}>
            Close
          </button>
          <button type="submit" className="button button-primary"
            disabled={status.kind === 'busy' || (found ? !found.choices.every(choiceReady) : !text.trim())}>
            {found ? 'Add the songs' : 'Next'}
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
