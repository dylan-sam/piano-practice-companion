import { describe, expect, it } from 'vitest'
import { chartFromMeasures } from '../src/music/chart'
import type { Tune } from '../src/music/songs'
import { exportTunes, orderSavedTunes, parseStudioPlaylists, playlistNames, serializeStudioPlaylists } from '../src/library/playlistExport'

/** Create one saved tune with a distinct chart and playlist. */
function tune(title: string, playlist: string, source: Tune['source'] = 'import'): Tune {
  return {
    id: title, source, playlist, addedAt: 1,
    chart: chartFromMeasures({ title, style: 'swing', key: 0, bpm: 120 }, [['C^7'], ['F7']]),
  }
}

const tunes = [
  tune('Zebra', 'Jazz'), tune('Alpha', 'My tunes', 'own'),
  tune('Bravo', 'Folk'), tune('ChoCo result', 'ChoCo', 'choco'), tune('Linked', 'Shared with me', 'link'),
]

describe('saved playlist ordering and export', () => {
  it('shows the selected playlist first, other saved playlists next, and excludes fetched ChoCo scores', () => {
    expect(orderSavedTunes(tunes, 'Jazz').map((item) => item.chart.title)).toEqual(['Zebra', 'Alpha', 'Bravo', 'Linked'])
    expect(orderSavedTunes(tunes).map((item) => item.chart.title)).toEqual(['Alpha', 'Bravo', 'Zebra', 'Linked'])
    expect(playlistNames(tunes)).toEqual(['My tunes', 'Folk', 'Jazz', 'Shared with me'])
  })

  it('round-trips all saved songs, or the written, shared or imported ones', () => {
    const all = parseStudioPlaylists(serializeStudioPlaylists(tunes))
    expect(all.map((list) => list.name)).toEqual(['My tunes', 'Folk', 'Jazz', 'Shared with me'])
    expect(all.flatMap((list) => list.charts.map((chart) => chart.title))).toEqual(['Alpha', 'Bravo', 'Zebra', 'Linked'])
    const titles = (group: 'own' | 'link' | 'import') =>
      parseStudioPlaylists(serializeStudioPlaylists(tunes, group)).map((list) => [list.name, list.charts.map((c) => c.title)])
    expect(titles('own')).toEqual([['My tunes', ['Alpha']]])
    expect(titles('link')).toEqual([['Shared with me', ['Linked']]])
    expect(titles('import')).toEqual([['Folk', ['Bravo']], ['Jazz', ['Zebra']]])
    expect(exportTunes(tunes, 'import')).toHaveLength(2)
  })

  it('rejects malformed files before saving any tune', () => {
    expect(() => parseStudioPlaylists('not JSON')).toThrow('Invalid Studio export JSON')
    expect(() => parseStudioPlaylists(JSON.stringify({ format: 'other', version: 1, playlists: [] })))
      .toThrow('Unsupported Studio playlist export')
    const invalid = JSON.parse(serializeStudioPlaylists(tunes))
    invalid.playlists[0].charts[0].bars[0].chords[0].beats = -1
    expect(() => parseStudioPlaylists(JSON.stringify(invalid)))
      .toThrow('Studio export contains an invalid playlist or chart')
    invalid.playlists[0].charts[0].bars[0].chords[0].beats = 4
    invalid.playlists[0].charts[0].bars[0].repeatTimes = 'twice'
    expect(() => parseStudioPlaylists(JSON.stringify(invalid)))
      .toThrow('Studio export contains an invalid playlist or chart')
  })
})
