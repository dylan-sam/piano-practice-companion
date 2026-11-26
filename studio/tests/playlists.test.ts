import { describe, expect, it } from 'vitest'
import { chartFromMeasures } from '../src/music/chart'
import type { Tune } from '../src/music/songs'
import {
  DEFAULT_PLAYLIST_NAME, inDefaultPlaylist, keptForPlaylists, playlistNamed, playlistsFromNames, songsInNoPlaylist, songsOf,
  uniqueName, type Playlist,
} from '../src/library/playlists'
import { choiceReady, firstChoice, targetOf } from '../src/library/playlistChoice'

/** A tune of some source. */
const tune = (id: string, source: Tune['source'], playlist?: string): Tune => ({
  id, source, playlist, addedAt: 1, chart: chartFromMeasures({ title: id, style: 'swing', key: 0, bpm: 120 }, [['C^7']]),
})
const list = (id: string, name: string, songs: string[]): Playlist => ({ id, name, songs, createdAt: 1 })

describe('playlists', () => {
  it('puts the shipped songs and the ChoCo charts in the default playlist, not the licks or the saved songs', () => {
    expect(inDefaultPlaylist(tune('bundled:catalog.json:OpenEWLD lead sheets:Avalon', 'bundled'))).toBe(true)
    expect(inDefaultPlaylist(tune('choco:jaah_1', 'choco'))).toBe(true)
    expect(inDefaultPlaylist(tune('bundled:licks.json:Licks: Arpeggios:Lick 1', 'bundled'))).toBe(false)
    expect(inDefaultPlaylist(tune('abc', 'own'))).toBe(false)
    expect(keptForPlaylists({ source: 'own' })).toBe(true)
    expect(keptForPlaylists({ source: 'bundled' })).toBe(false)
  })

  it('makes names unique, never the default playlist\'s', () => {
    const lists = [list('a', 'Jazz', []), list('b', 'Jazz 2', [])]
    expect(uniqueName(' jazz ', lists)).toBe('jazz 3')
    expect(uniqueName('Bossa', lists)).toBe('Bossa')
    expect(uniqueName('', lists)).toBe('My playlist')
    expect(uniqueName(DEFAULT_PLAYLIST_NAME, [])).toBe(`${DEFAULT_PLAYLIST_NAME} 2`)
    expect(playlistNamed('JAZZ', lists)?.id).toBe('a')
  })

  it('lists a playlist\'s songs in its order, and finds the songs in no playlist', () => {
    const tunes = [tune('x', 'own'), tune('y', 'import'), tune('z', 'link')]
    expect(songsOf(list('a', 'A', ['z', 'missing', 'x']), tunes).map((t) => t.id)).toEqual(['z', 'x'])
    expect(songsInNoPlaylist(['x', 'y', 'z'], [list('a', 'A', ['x']), list('b', 'B', ['z'])])).toEqual(['y'])
  })

  it('turns the playlist names of a library saved before into playlists', () => {
    const made = playlistsFromNames([tune('x', 'own', 'My tunes'), tune('y', 'import', 'Jazz'), tune('z', 'own'), tune('c', 'bundled', 'Folk')], 10)
    expect(made.map((item) => [item.name, item.songs])).toEqual([['My tunes', ['x', 'z']], ['Jazz', ['y']]])
  })

  it('suggests the playlist of the same name, else a new one', () => {
    const lists = [list('a', 'Jazz', [])]
    expect(firstChoice('jazz', lists)).toMatchObject({ mode: 'existing', playlist: 'a' })
    expect(firstChoice('Bossa', lists)).toMatchObject({ mode: 'new', name: 'Bossa' })
    expect(firstChoice('My songs', lists, 'a')).toMatchObject({ mode: 'existing', playlist: 'a' })
    expect(targetOf({ mode: 'existing', name: 'x', playlist: 'a' })).toEqual({ playlist: 'a' })
    expect(targetOf({ mode: 'new', name: 'Bossa', playlist: 'a' })).toEqual({ newName: 'Bossa' })
    expect(choiceReady({ mode: 'new', name: ' ', playlist: '' })).toBe(false)
  })
})
