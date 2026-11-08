// The tune library, stored in the browser (IndexedDB). Nothing leaves the device.

import Dexie, { type EntityTable } from 'dexie'
import { mapStyle } from '../formats/ireal'
import type { Chart } from '../music/chart'
import type { Tune } from '../music/songs'

const db = new Dexie('ear-training-studio') as Dexie & { tunes: EntityTable<Tune, 'id'> }

db.version(1).stores({ tunes: 'id, playlist, addedAt' })

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

// Save imported charts as tunes of a playlist
export async function addTunes(charts: Chart[], source: Tune['source'], playlist: string): Promise<Tune[]> {
  const now = Date.now()
  const tunes = await Promise.all(
    charts.map(async (chart, i): Promise<Tune> => ({ id: await chartId(chart), chart, source, playlist, addedAt: now + i })),
  )
  await db.tunes.bulkPut(tunes)
  return tunes
}

// Delete every tune of a playlist
export async function removePlaylist(playlist: string): Promise<void> {
  await db.tunes.where('playlist').equals(playlist).delete()
}

// Delete one tune
export async function removeTune(id: string): Promise<void> {
  await db.tunes.delete(id)
}

// Save one tune
export async function saveTune(tune: Tune): Promise<void> {
  await db.tunes.put(tune)
}
