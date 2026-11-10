// The layout of a sightreading screen around its source of music: the source buttons, the song
// list (Pick a song) beside the stage, and the Songs button of the top bar.

import type { ReactNode } from 'react'
import type { Tune } from '../music/songs'
import { Library } from '../ui/Library'
import { SourceButtons } from './ExerciseControls'
import type { SourceMode, useSongSource } from './useSongSource'

type Source = ReturnType<typeof useSongSource>

/** The Songs button of the top bar: opens or closes the song list while Pick a song is shown. */
export function SongsToggle({ source, text = 'Songs' }: { source: Source; text?: string }) {
  if (source.shown !== 'pick') return null
  return (
    <button className="tunes-toggle" aria-expanded={source.libraryOpen}
      onClick={() => source.setLibraryOpen((current) => !current)}>{text}</button>
  )
}

/**
 * The source buttons, then the stage, with the song list beside it while Pick a song is shown.
 * `tunes` are the songs listed (the catalog is searched too when `catalog` is set); Import opens
 * the screen's import dialog when it has one.
 */
export function SongWorkspace({ source, modes, label, tunes, catalog = false, canImport = true, emptyText, children }: {
  source: Source
  modes: { id: SourceMode; text: string }[]
  label: string
  tunes: Tune[]
  catalog?: boolean
  canImport?: boolean
  emptyText?: string
  children: ReactNode
}) {
  const picking = source.shown === 'pick'
  return (
    <>
      <SourceButtons modes={modes} shown={source.shown} onChoose={source.chooseMode} label={label} />
      <div className={picking ? `workspace${source.libraryOpen ? ' library-open' : ''}` : 'sight-workspace'}>
        {picking && <Library tunes={tunes} selectedId={source.tune?.id ?? ''}
          onSelect={(id) => { const selected = tunes.find((item) => item.id === id); if (selected) source.open(selected) }}
          onLoadChoco={catalog ? source.loadChoco : undefined} emptyText={emptyText}
          onImport={canImport ? () => source.setImportOpen(true) : undefined} />}
        <main className="stage exercise-stage sight-stage" onClick={() => source.setLibraryOpen(false)}>
          {children}
        </main>
      </div>
    </>
  )
}
