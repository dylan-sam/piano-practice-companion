import { describe, expect, it } from 'vitest'
import { chartFromMeasures } from '../src/music/chart'
import type { Tune } from '../src/music/songs'
import { categoryNames, exportFileName, inCategories, parseStudioPlaylists, serializeStudioPlaylists } from '../src/library/playlistExport'

/** Create one tune with a distinct chart and category. */
function tune(title: string, playlist: string, source: Tune['source'] = 'import'): Tune {
  return {
    id: title, source, playlist, addedAt: 1,
    chart: chartFromMeasures({ title, style: 'swing', key: 0, bpm: 120 }, [['C^7'], ['F7']]),
  }
}

const charts = (titles: string[]) => titles.map((title) => tune(title, '').chart)

describe('categories of licks and exercises', () => {
  it('keeps the file order of the categories and of their items', () => {
    const licks = [tune('Easy', 'Arpeggios', 'bundled'), tune('Turn', 'Turns', 'bundled'), tune('Hard', 'Arpeggios', 'bundled')]
    expect(categoryNames(licks)).toEqual(['Arpeggios', 'Turns'])
    expect(inCategories(licks, ['Arpeggios']).map((item) => item.id)).toEqual(['Easy', 'Hard'])
    expect(inCategories(licks, [])).toHaveLength(3)
  })
})

describe('Studio export files', () => {
  it('round-trips playlists under the names chosen, leaving empty ones out', () => {
    const file = serializeStudioPlaylists([{ name: ' Jazz ', charts: charts(['Zebra', 'Alpha']) }, { name: 'Empty', charts: [] }, { name: '', charts: charts(['Folk']) }])
    expect(parseStudioPlaylists(file).map((list) => [list.name, list.charts.map((c) => c.title)]))
      .toEqual([['Jazz', ['Zebra', 'Alpha']], ['My playlist', ['Folk']]])
    expect(() => serializeStudioPlaylists([{ name: 'Empty', charts: [] }])).toThrow('No songs to export')
  })

  it('names the file after one playlist, or "playlists"', () => {
    expect(exportFileName(['My Bossa songs!'])).toBe('my-bossa-songs.json')
    expect(exportFileName(['A', 'B'])).toBe('playlists.json')
  })

  it('rejects malformed files before saving any tune', () => {
    expect(() => parseStudioPlaylists('not JSON')).toThrow('Invalid Studio export JSON')
    expect(() => parseStudioPlaylists(JSON.stringify({ format: 'other', version: 1, playlists: [] })))
      .toThrow('Unsupported Studio playlist export')
    const invalid = JSON.parse(serializeStudioPlaylists([{ name: 'Jazz', charts: charts(['Zebra']) }]))
    invalid.playlists[0].charts[0].bars[0].chords[0].beats = -1
    expect(() => parseStudioPlaylists(JSON.stringify(invalid)))
      .toThrow('Studio export contains an invalid playlist or chart')
    invalid.playlists[0].charts[0].bars[0].chords[0].beats = 4
    invalid.playlists[0].charts[0].bars[0].repeatTimes = 'twice'
    expect(() => parseStudioPlaylists(JSON.stringify(invalid)))
      .toThrow('Studio export contains an invalid playlist or chart')
  })
})
