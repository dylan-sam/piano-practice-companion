// The tune library, stored in the browser (IndexedDB). Nothing leaves the device.

import Dexie, { type EntityTable } from 'dexie'
import { mapStyle } from '../formats/ireal'
import type { Chart } from '../music/chart'
import type { Tune } from '../music/songs'
import { playlistsFromNames, type Playlist } from './playlists'

export const db = new Dexie('ear-training-studio') as Dexie & { tunes: EntityTable<Tune, 'id'>; playlists: EntityTable<Playlist, 'id'> }

db.version(1).stores({ tunes: 'id, playlist, addedAt' })
// Version 2: playlists of their own (a song can be in several); the saved songs' playlist names become playlists
db.version(2).stores({ tunes: 'id, playlist, addedAt', playlists: 'id, createdAt' }).upgrade(async (tx) => {
  const tunes = await tx.table<Tune, string>('tunes').toArray()
  await tx.table<Playlist, string>('playlists').bulkPut(playlistsFromNames(tunes, Date.now()))
})

// Load the saved tunes, oldest first, with imported styles mapped again
export async function loadTunes(): Promise<Tune[]> {
  const tunes = await db.tunes.orderBy('addedAt').toArray()
  // Imported tunes follow the current style mapping, so new styles reach tunes imported earlier
  return tunes.map((t) =>
    t.chart.sourceStyle ? { ...t, chart: { ...t.chart, style: mapStyle(t.chart.sourceStyle, t.chart.time) } } : t,
  )
}

// A stable id from the chart's content, so importing the same tune twice doesn't duplicate it
export async function chartId(chart: Chart): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(chart))
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  return Array.from(hash.slice(0, 9), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Save charts as tunes (written, imported or opened from a link); playlists.ts puts them in playlists. */
export async function addTunes(charts: Chart[], source: Tune['source']): Promise<Tune[]> {
  const now = Date.now()
  const tunes = await Promise.all(
    charts.map(async (chart, i): Promise<Tune> => ({ id: await chartId(chart), chart, source, addedAt: now + i })),
  )
  await db.tunes.bulkPut(tunes)
  return tunes
}

/** Save some tunes as they are (a ChoCo chart added to a playlist). */
export async function saveTunes(tunes: Tune[]): Promise<void> {
  if (tunes.length) await db.tunes.bulkPut(tunes)
}

/** Delete some tunes. */
export async function deleteTunes(ids: string[]): Promise<void> {
  if (ids.length) await db.tunes.bulkDelete(ids)
}

// Save one tune
export async function saveTune(tune: Tune): Promise<void> {
  await db.tunes.put(tune)
}

/** Delete the whole tune library (Delete all my data). */
export async function deleteLibrary(): Promise<void> {
  await db.delete()
}
