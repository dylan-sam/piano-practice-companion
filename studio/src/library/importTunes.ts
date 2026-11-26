// Importing charts, shared by the players and the sightreaders, in two steps: read an import
// (iReal Pro links, a MusicXML lead sheet, Studio links pasted from Share, or a Studio export) into
// named lists of charts, then save them into the playlists the person chose (an existing one or a
// new one). Every import is saved in the one library (library/db.ts), so a chart imported on one
// screen is on the others too.
import { parseIrealLinks } from '../formats/ireal'
import { parseMusicXml } from '../formats/musicxml'
import { chartsFromLinks } from '../formats/share'
import type { Tune } from '../music/songs'
import { addTunes } from './db'
import { parseStudioPlaylists, type StudioPlaylist } from './playlistExport'
import { addToPlaylist, createPlaylist, currentPlaylists, loadPlaylists, playlistNamed, SHARED_PLAYLIST, showPlaylist } from './playlists'

export type ImportSource = 'ireal' | 'musicxml' | 'link' | 'studio'

// The formats offered for chord charts and for lead sheets (the first one is selected)
export const CHORD_SOURCES: ImportSource[] = ['ireal', 'link', 'studio']
export const LEAD_SOURCES: ImportSource[] = ['musicxml', 'link', 'studio']
export const MUSICXML_PLAYLIST = 'MusicXML imports'

/** Read an import into named lists of charts, saving nothing yet (an empty list is left out). */
export async function readImport(source: ImportSource, text: string): Promise<StudioPlaylist[]> {
  if (source === 'musicxml') {
    const chart = parseMusicXml(text)
    return [{ name: MUSICXML_PLAYLIST, charts: [chart] }]
  }
  if (source === 'link') {
    const charts = await chartsFromLinks(text)
    return charts.length ? [{ name: SHARED_PLAYLIST, charts }] : []
  }
  const lists = source === 'ireal' ? parseIrealLinks(text) : parseStudioPlaylists(text)
  return lists.filter((list) => list.charts.length > 0)
}

/** Where a list of an import goes: an existing playlist (by id), or a new one with this name. */
export type ImportTarget = { playlist: string } | { newName: string }

/** Save the lists of an import into their playlists (the first one is then shown); returns the songs added and the playlists' names. */
export async function saveImport(source: ImportSource, lists: StudioPlaylist[], targets: ImportTarget[]): Promise<{ added: Tune[]; playlists: string[] }> {
  const added: Tune[] = []
  const names: string[] = []
  const ids: string[] = []
  for (const [i, list] of lists.entries()) {
    const tunes = await addTunes(list.charts, source === 'link' ? 'link' : 'import')
    const target = targets[i] ?? { newName: list.name }
    if ('playlist' in target) {
      await addToPlaylist(target.playlist, tunes)
      names.push(currentPlaylists().find((item) => item.id === target.playlist)?.name ?? list.name)
      ids.push(target.playlist)
    } else {
      const made = await createPlaylist(target.newName, tunes)
      names.push(made.name)
      ids.push(made.id)
    }
    added.push(...tunes)
  }
  if (ids.length) showPlaylist(ids[0])
  return { added, playlists: names }
}

/** Import without asking (an iReal Pro link pasted on the page): each list into the playlist of its name, made when missing. */
export async function importByName(source: ImportSource, text: string): Promise<Tune[]> {
  const lists = await readImport(source, text)
  await loadPlaylists()
  const targets = lists.map((list): ImportTarget => {
    const same = playlistNamed(list.name, currentPlaylists())
    return same ? { playlist: same.id } : { newName: list.name }
  })
  return (await saveImport(source, lists, targets)).added
}
