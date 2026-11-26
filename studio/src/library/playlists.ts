// Playlists of songs. The default one, the App Playlist, is every song shipped
// with the app (the study tunes, the OpenEWLD lead sheets, the Nottingham folk tunes) and the
// ChoCo chord charts; it cannot be changed, deleted or exported. The person's own playlists are
// kept in the browser (IndexedDB, library/db.ts) as lists of song ids: a song can be in several,
// and any song can be added (a ChoCo chart is then kept on the device). A song written, imported
// or opened from a link always stays in at least one playlist: left in none (taken out of its
// last one, or its playlist deleted with the songs kept), it goes to "Without playlist". Any song
// can be deleted for good (after a confirmation): a saved one is erased, a shipped or ChoCo one is
// only hidden, as is the whole App Playlist when it is deleted: they stay in the
// app for the lessons and exercises, and Restore all default songs (main menu, or Delete all my
// data) brings them back. The licks and exercises are not songs: they keep their own lists.

import { useSyncExternalStore } from 'react'
import type { Tune } from '../music/songs'
import { db, deleteTunes, saveTunes } from './db'
import { reportError } from '../errorReports'

export interface Playlist {
  id: string
  name: string
  songs: string[] // song ids, in the order they were added
  createdAt: number
}

export const DEFAULT_PLAYLIST_ID = 'default'
export const DEFAULT_PLAYLIST_NAME = 'App Playlist'
export const SHARED_PLAYLIST = 'Shared with me' // songs opened from a Studio link
export const WITHOUT_PLAYLIST = 'Without playlist' // saved songs left in no other playlist
const LICKS_FILE = 'bundled:licks.json:' // the id start of a shipped lick or exercise

/** Whether a song is in the default playlist: shipped with the app (not a lick or an exercise), or a ChoCo chart. */
export function inDefaultPlaylist(tune: Tune): boolean {
  return (tune.source === 'bundled' && !tune.id.startsWith(LICKS_FILE)) || tune.source === 'choco'
}

/** Whether a song is kept only for the playlists it is in: written, imported or opened from a link, or a ChoCo chart added to one. */
export const keptForPlaylists = (tune: Pick<Tune, 'source'>): boolean => tune.source !== 'bundled' && tune.source !== 'example'

/**
 * A playlist name not taken yet: the name itself, else with a number ("Jazz 2"). Names are
 * compared without case and surrounding spaces; an empty name becomes "My playlist".
 */
export function uniqueName(name: string, playlists: readonly Pick<Playlist, 'name'>[]): string {
  const base = name.trim() || 'My playlist'
  const taken = new Set([DEFAULT_PLAYLIST_NAME, ...playlists.map((list) => list.name)].map((n) => n.trim().toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  let n = 2
  while (taken.has(`${base} ${n}`.toLowerCase())) n++
  return `${base} ${n}`
}

/** The playlist with this name (case and surrounding spaces ignored), if any. */
export function playlistNamed(name: string, playlists: readonly Playlist[]): Playlist | undefined {
  const wanted = name.trim().toLowerCase()
  return playlists.find((list) => list.name.trim().toLowerCase() === wanted)
}

/** The ids, of those given, that are in no playlist. */
export function songsInNoPlaylist(ids: readonly string[], playlists: readonly Playlist[]): string[] {
  const listed = new Set(playlists.flatMap((list) => list.songs))
  return ids.filter((id) => !listed.has(id))
}

/** The songs of a playlist that a screen has, in the playlist's order. */
export function songsOf(playlist: Playlist, tunes: readonly Tune[]): Tune[] {
  const byId = new Map(tunes.map((tune) => [tune.id, tune]))
  return playlist.songs.flatMap((id) => byId.get(id) ?? [])
}

/** A new playlist id. */
const newId = () => `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

/**
 * The playlists made from a library saved before playlists could hold several songs' places:
 * one per playlist name of the saved songs ("My tunes" for those without one).
 */
export function playlistsFromNames(tunes: readonly Pick<Tune, 'id' | 'source' | 'playlist'>[], now: number): Playlist[] {
  const lists = new Map<string, string[]>()
  for (const tune of tunes) {
    if (!keptForPlaylists(tune)) continue
    const name = tune.playlist ?? 'My tunes'
    lists.set(name, [...(lists.get(name) ?? []), tune.id])
  }
  return [...lists].map(([name, songs], i) => ({ id: `pl-old-${i}`, name: name === DEFAULT_PLAYLIST_NAME ? `${name} (mine)` : name, songs, createdAt: now + i }))
}

// ---- The playlists kept in the browser, shared by every screen ----

let playlists: Playlist[] = []
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

/** Tell every screen showing the playlists that they changed. */
function publish(next: Playlist[]): void {
  playlists = next
  for (const listener of listeners) listener()
}

/** Read the playlists once (the first screen that shows them asks). */
export function loadPlaylists(): Promise<void> {
  loading ??= db.playlists.orderBy('createdAt').toArray()
    .then(publish)
    .catch((error: unknown) => reportError(error, 'playlists'))
  return loading
}

/** The person's playlists, oldest first, re-rendering when they change. */
export function usePlaylists(): Playlist[] {
  return useSyncExternalStore((onChange) => {
    listeners.add(onChange)
    void loadPlaylists()
    return () => listeners.delete(onChange)
  }, () => playlists, () => playlists)
}

/** The playlists as they are now (after loadPlaylists). */
export const currentPlaylists = (): Playlist[] => playlists

/** Save a changed playlist. */
async function put(list: Playlist): Promise<void> {
  await db.playlists.put(list)
  publish(playlists.some((item) => item.id === list.id) ? playlists.map((item) => (item.id === list.id ? list : item)) : [...playlists, list])
}

/** Put the saved songs left in no playlist into "Without playlist" (made when needed). */
async function keepListed(tunes: readonly Tune[]): Promise<void> {
  const left = new Set(songsInNoPlaylist(tunes.filter(keptForPlaylists).map((tune) => tune.id), playlists))
  if (left.size) await addToPlaylistNamed(WITHOUT_PLAYLIST, tunes.filter((tune) => left.has(tune.id)))
}

/** Make a playlist (its name made unique) holding some songs; ChoCo charts are kept on the device. */
export async function createPlaylist(name: string, songs: Tune[] = []): Promise<Playlist> {
  await loadPlaylists()
  await saveTunes(songs.filter((tune) => tune.source === 'choco'))
  const list: Playlist = { id: newId(), name: uniqueName(name, playlists), songs: [...new Set(songs.map((tune) => tune.id))], createdAt: Date.now() }
  await put(list)
  return list
}

/** Add songs to a playlist (those already in it stay where they are). */
export async function addToPlaylist(id: string, songs: Tune[]): Promise<void> {
  const list = playlists.find((item) => item.id === id)
  if (!list) return
  await saveTunes(songs.filter((tune) => tune.source === 'choco'))
  await put({ ...list, songs: [...new Set([...list.songs, ...songs.map((tune) => tune.id)])] })
}

/** The playlist of this name, made when there is none, with some songs added. */
export async function addToPlaylistNamed(name: string, songs: Tune[]): Promise<Playlist> {
  await loadPlaylists()
  const found = playlistNamed(name, playlists)
  if (!found) return createPlaylist(name, songs)
  await addToPlaylist(found.id, songs)
  return found
}

/** Take a song out of a playlist; a saved song left in no playlist goes to "Without playlist". */
export async function removeFromPlaylist(id: string, tune: Tune): Promise<void> {
  const list = playlists.find((item) => item.id === id)
  if (!list) return
  await put({ ...list, songs: list.songs.filter((song) => song !== tune.id) })
  await keepListed([tune])
}

/** Whether a song is in this playlist and no other one. */
export const onlyIn = (id: string, tune: Pick<Tune, 'id'>): boolean =>
  playlists.some((item) => item.id === id && item.songs.includes(tune.id)) &&
  !playlists.some((item) => item.id !== id && item.songs.includes(tune.id))

/**
 * Take a song out of a playlist (the × of the song list, a box unticked). Out of "Without playlist",
 * where a saved song has nowhere else to go, it is deleted instead, after a confirmation. Returns
 * the ids deleted.
 */
export async function removeSong(list: Playlist, tune: Tune): Promise<string[]> {
  if (list.name === WITHOUT_PLAYLIST && keptForPlaylists(tune) && onlyIn(list.id, tune)) {
    return confirmDelete(tune) ? deleteSongs([tune]) : []
  }
  await removeFromPlaylist(list.id, tune)
  return []
}

/** Put a song in a playlist, or take it out; returns the ids deleted from the device (none but out of "Without playlist"). */
export async function togglePlaylist(list: Playlist, song: Tune): Promise<string[]> {
  if (list.songs.includes(song.id)) return removeSong(list, song)
  await addToPlaylist(list.id, [song])
  return []
}

/** Ask before a song is deleted for good. */
export function confirmDelete(tune: Tune): boolean {
  const how = keptForPlaylists(tune) ? 'It is erased from this device' : 'It is hidden from the app\'s songs (Restore all default songs, on the main menu, brings it back)'
  return window.confirm(`Delete ${tune.chart.title}? ${how} and taken out of every playlist.`)
}

/**
 * Delete songs for good: saved ones (and ChoCo charts kept for a playlist) are erased, shipped and
 * ChoCo ones hidden; all are taken out of every playlist. Returns the ids erased (the hidden songs
 * stay in the screens' lists, filtered out by useHiddenSongs, so they can come back).
 */
export async function deleteSongs(tunes: readonly Tune[]): Promise<string[]> {
  const gone = new Set(tunes.map((tune) => tune.id))
  await deleteTunes(tunes.filter((tune) => tune.source !== 'bundled').map((tune) => tune.id))
  hideSongs(tunes.filter((tune) => !keptForPlaylists(tune)).map((tune) => tune.id))
  for (const list of playlists.filter((item) => item.songs.some((song) => gone.has(song)))) {
    await put({ ...list, songs: list.songs.filter((song) => !gone.has(song)) })
  }
  return tunes.filter(keptForPlaylists).map((tune) => tune.id)
}

/** Rename a playlist (the name made unique among the others). */
export async function renamePlaylist(id: string, name: string): Promise<void> {
  const list = playlists.find((item) => item.id === id)
  if (list && name.trim() && name.trim() !== list.name) await put({ ...list, name: uniqueName(name, playlists.filter((item) => item.id !== id)) })
}

/** What happens to a deleted playlist's songs: all deleted, only those in no other playlist, or none. */
export type PlaylistSongs = 'all' | 'only' | 'none'

/** The songs of a playlist that a screen has, and those of them in no other playlist. */
export function songsToDelete(id: string, tunes: readonly Tune[]): { all: Tune[]; only: Tune[] } {
  const list = playlists.find((item) => item.id === id)
  const all = list ? songsOf(list, tunes) : []
  return { all, only: all.filter((tune) => onlyIn(id, tune)) }
}

/**
 * Delete a playlist and, as chosen, all its songs, those in no other playlist, or none (saved songs
 * then left in no playlist go to "Without playlist"). Returns the ids of the songs deleted.
 */
export async function deletePlaylist(id: string, tunes: readonly Tune[], songs: PlaylistSongs): Promise<string[]> {
  const list = playlists.find((item) => item.id === id)
  if (!list) return []
  const chosen = songsToDelete(id, tunes)
  const members = chosen.all
  await db.playlists.delete(id)
  publish(playlists.filter((item) => item.id !== id))
  const gone = songs === 'all' ? await deleteSongs(chosen.all) : songs === 'only' ? await deleteSongs(chosen.only) : []
  await keepListed(members.filter((tune) => !gone.includes(tune.id)))
  return gone
}

/** Take a song out of every playlist (it is being deleted). */
export async function forgetSong(tuneId: string): Promise<void> {
  for (const list of playlists.filter((item) => item.songs.includes(tuneId))) await put({ ...list, songs: list.songs.filter((song) => song !== tuneId) })
}

// ---- The shipped and ChoCo songs deleted (hidden), kept in the browser ----

const HIDDEN_KEY = 'eartraining:hidden-songs'
let hidden: string[] | null = null
const hiddenListeners = new Set<() => void>()

/** The hidden songs' ids, as kept in the browser. */
function readHidden(): string[] {
  if (hidden === null) {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]')
      hidden = Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
    } catch {
      hidden = []
    }
  }
  return hidden
}

/** Keep the hidden ids and tell the song lists. */
function writeHidden(next: string[]): void {
  hidden = next
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)) } catch { /* hidden for this visit only */ }
  for (const listener of hiddenListeners) listener()
}

/** Hide some shipped or ChoCo songs (deleted). */
export function hideSongs(ids: readonly string[]): void {
  if (ids.length) writeHidden([...new Set([...readHidden(), ...ids])])
}

/** Show the hidden songs again (and the App Playlist, when it was hidden). */
export const showHiddenSongs = (): void => writeHidden([])

// The whole App Playlist hidden: kept as a mark among the hidden ids, so one store
// holds both and Show brings everything back
const DEFAULT_HIDDEN = '\u0001default'

/** Hide the whole App Playlist (its songs stay in the app, for the lessons and exercises). */
export const hideDefaultPlaylist = (): void => hideSongs([DEFAULT_HIDDEN])

/** Whether the App Playlist is hidden, among the hidden ids. */
export const defaultHidden = (hiddenIds: readonly string[]): boolean => hiddenIds.includes(DEFAULT_HIDDEN)

/** How many songs are hidden one by one (the playlist's own mark left out). */
export const hiddenSongCount = (hiddenIds: readonly string[]): number => hiddenIds.filter((id) => id !== DEFAULT_HIDDEN).length

/** The hidden songs' ids, re-rendering when they change. */
export function useHiddenSongs(): readonly string[] {
  return useSyncExternalStore((onChange) => {
    hiddenListeners.add(onChange)
    return () => hiddenListeners.delete(onChange)
  }, readHidden, () => [])
}

// ---- The playlist the song lists show (the last one chosen, or one just filled) ----

const SHOWN_KEY = 'eartraining:playlist'
let shownId: string | null = null
const shownListeners = new Set<() => void>()

/** The playlist shown, as kept in the browser. */
function readShown(): string {
  if (shownId === null) {
    try { shownId = localStorage.getItem(SHOWN_KEY) ?? DEFAULT_PLAYLIST_ID } catch { shownId = DEFAULT_PLAYLIST_ID }
  }
  return shownId
}

/** Show a playlist in every song list (after a song is saved or imported into it, or when it is chosen). */
export function showPlaylist(id: string): void {
  shownId = id
  try { localStorage.setItem(SHOWN_KEY, id) } catch { /* shown for this visit only */ }
  for (const listener of shownListeners) listener()
}

/** The id of the playlist the song lists show, re-rendering when it changes. */
export function useShownPlaylist(): string {
  return useSyncExternalStore((onChange) => {
    shownListeners.add(onChange)
    return () => shownListeners.delete(onChange)
  }, readShown, () => DEFAULT_PLAYLIST_ID)
}

/** Forget the playlists read (Delete all my data, tests). */
export function resetPlaylists(): void {
  loading = null
  publish([])
}
