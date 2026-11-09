// Importing charts, shared by the players and the sightreaders: every import is saved in the one
// library of saved tunes (library/db.ts), so a chart imported on one screen is on the others too.
import { parseIrealLinks } from '../formats/ireal'
import { parseMusicXml } from '../formats/musicxml'
import type { Tune } from '../music/songs'
import type { ImportResult, ImportSource } from '../ui/ImportDialog'
import { addTunes } from './db'
import { parseStudioPlaylists } from './playlistExport'

// The formats offered for chord charts and for lead sheets (the first one is selected)
export const CHORD_SOURCES: ImportSource[] = ['ireal', 'studio']
export const LEAD_SOURCES: ImportSource[] = ['musicxml', 'studio']
export const MUSICXML_PLAYLIST = 'MusicXML imports'

/** Read an import in one of the formats and save its tunes, in their playlists. */
export async function importTunes(source: ImportSource, text: string): Promise<{ added: Tune[]; result: ImportResult }> {
  const added: Tune[] = []
  if (source === 'musicxml') {
    added.push(...(await addTunes([parseMusicXml(text)], 'import', MUSICXML_PLAYLIST)))
    return { added, result: { tunes: added.length, playlists: [MUSICXML_PLAYLIST] } }
  }
  const lists = source === 'ireal' ? parseIrealLinks(text) : parseStudioPlaylists(text)
  for (const list of lists) added.push(...(await addTunes(list.charts, 'import', list.name)))
  return { added, result: { tunes: added.length, playlists: [...new Set(lists.filter((l) => l.charts.length).map((l) => l.name))] } }
}
