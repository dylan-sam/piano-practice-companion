// Where the music of a sightreading screen comes from: a song picked in the song list, a random
// song, or (on some screens) an endless line of progressions. The song list, Import, the catalog
// and the moves between these sources are the same on every sightreading screen.

import { useEffect, useState } from 'react'
import { listProgressions, randomSong } from '../library/catalog'
import { fetchChocoTune } from '../library/choco'
import { importTunes } from '../library/importTunes'
import type { CatalogProgression } from '../library/scoreSearch'
import type { Tune } from '../music/songs'
import { useBackClose } from '../ui/backButton'
import type { ImportResult, ImportSource } from '../ui/ImportDialog'
import { useDrawerScreen } from '../ui/useNarrowScreen'
import { BANK_URL, type QuestionBank } from './nameProgression'

/** A source of music: a picked song, a random one, or an endless line of progressions. */
export type SourceMode = 'pick' | 'random' | 'infinite'

/** What a screen does when the source changes. */
interface SourceEvents {
  playing: boolean
  onOpen: (tune: Tune) => void // a song goes on the stand: stop, forget the judge, take its style and tempo...
  onLeave: () => void // a song is replaced by an endless line, or the other way round: stop and clear
  onError: (message: string) => void
}

/**
 * The source of a sightreading screen and its song list. Moving between Pick a song and Random
 * song keeps the song (and it goes on playing); Pick a song again opens or closes the list. While
 * an endless line plays, Pick a song and Random song only open their menu (`menu`, shown instead
 * of the mode): the line goes on until a song is chosen, and Infinite progressions closes it.
 */
export function useSongSource({ playing, onOpen, onLeave, onError }: SourceEvents) {
  const [mode, setMode] = useState<SourceMode>('pick')
  const [menu, setMenu] = useState<SourceMode | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(true)
  const [tunes, setTunes] = useState<Tune[]>([])
  const [tune, setTune] = useState<Tune | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const shown = menu ?? mode // the source whose button and menu are shown

  // The Android back button closes the song drawer
  const drawer = useDrawerScreen()
  useBackClose(drawer && shown === 'pick' && libraryOpen, () => setLibraryOpen(false))

  /** Put a song on the stand; chosen from a menu opened over an endless line, its source becomes the mode. */
  const open = (next: Tune) => {
    onOpen(next)
    setTune(next)
    setLibraryOpen(false)
    onError('')
    if (menu) {
      setMode(menu)
      setMenu(null)
    }
  }

  /** Add songs to the list (replacing older copies). */
  const addTunes = (added: Tune[]) => {
    const ids = new Set(added.map((item) => item.id))
    setTunes((current) => [...current.filter((item) => !ids.has(item.id)), ...added])
  }

  /** Fetch a song of the catalog, as the players do, and open it. */
  const loadChoco = async (id: string) => {
    const loaded = await fetchChocoTune(id)
    addTunes([loaded])
    open(loaded)
  }

  /**
   * Import charts (saved for every screen that shows them) and open the first one this screen
   * reads (`readable`).
   */
  const importFrom = async (source: ImportSource, text: string, readable: (tune: Tune) => boolean = () => true): Promise<ImportResult> => {
    const { added, result } = await importTunes(source, text)
    addTunes(added)
    const first = added.find(readable)
    if (first) open(first)
    return result
  }

  /** Open a random song of the catalog, containing a chosen progression if one is chosen. */
  const openRandomSong = async (progressionId: string) => {
    try {
      const group = await randomSong(progressionId)
      await loadChoco(group.id)
    } catch (cause) {
      onError(String(cause))
    }
  }

  /** Move to another source (see the hook's description). */
  const chooseMode = (next: SourceMode) => {
    if (mode === 'infinite' && playing && next !== 'infinite') {
      setLibraryOpen(next === 'pick' && menu === 'pick' ? !libraryOpen : next === 'pick')
      setMenu(next)
      onError('')
      return
    }
    if (menu) {
      setMenu(null)
      setLibraryOpen(false)
      if (next === 'infinite') return
    }
    if (next === 'pick' && mode === 'pick') {
      setLibraryOpen((current) => !current)
      return
    }
    onError('')
    if (next !== 'infinite' && mode !== 'infinite') {
      setMode(next)
      setLibraryOpen(next === 'pick')
      return
    }
    onLeave()
    setMode(next)
    setLibraryOpen(next === 'pick')
    if (next !== 'infinite') setTune(null)
  }

  return {
    mode, shown, libraryOpen, setLibraryOpen, tunes, setTunes, tune, importOpen, setImportOpen,
    open, loadChoco, importFrom, openRandomSong, chooseMode,
  }
}

/**
 * The catalog's progressions (for Random song) and the progression bank (for endless lines),
 * loaded once per visit.
 */
export function useProgressionSources(onError: (message: string) => void) {
  const [catalog, setCatalog] = useState<CatalogProgression[]>([])
  const [bank, setBank] = useState<QuestionBank | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    const fail = (cause: unknown) => { if (!controller.signal.aborted) onError(String(cause)) }
    void listProgressions(controller.signal).then(setCatalog).catch(fail)
    void fetch(BANK_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Progression bank unavailable')
        return response.json() as Promise<QuestionBank>
      })
      .then(setBank)
      .catch(fail)
    return () => controller.abort()
    // The sources are loaded once; the error callback only sets the screen's message
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return { catalog, bank }
}
