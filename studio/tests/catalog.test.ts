import { describe, expect, it } from 'vitest'
import { filterSongs, foldText } from '../src/library/catalog'

// A bundled index as build_mobile_catalog.py writes it: songs with their versions, default first
const index = {
  format: 1,
  progressions: [
    { id: 'progression-02', label: 'ii – V – I', unique_song_count: 2 },
    { id: 'progression-01', label: 'I – IV – V', unique_song_count: 1 },
  ],
  songs: [
    [['ireal-pro_1', 'Autumn Leaves', 'Kosma', 'iReal Pro', 'Jazz', 'autumnleaves', 0b01, 0],
      ['real-book_7', 'Autumn Leaves', '', 'Real Book', 'Jazz', 'autumnleaves', 0b00, 0]],
    [['wikifonia_3', 'Blue Moon', 'Rodgers', 'Wikifonia', 'Pop', 'bluemoon', 0b11, 1]],
  ] as [string, string, string, string, string, string, number, number][][],
}

describe('bundled catalog search', () => {
  it('folds titles like the server', () => {
    expect(foldText('Café Été, A')).toBe('cafeetea')
  })

  it('matches titles, artists and ids, default version first', () => {
    expect(filterSongs(index, 'autumn', [], true).map((g) => [g.id, g.versions.length])).toEqual([['ireal-pro_1', 2]])
    expect(filterSongs(index, 'rodgers', [], true).map((g) => g.id)).toEqual(['wikifonia_3'])
    expect(filterSongs(index, '', [], true).map((g) => g.title)).toEqual(['Autumn Leaves', 'Blue Moon'])
  })

  it('keeps only the versions holding the progressions', () => {
    const iiVI = filterSongs(index, '', ['progression-02'], true)
    expect(iiVI.map((g) => [g.id, g.versions.map((v) => v.id)])).toEqual([['ireal-pro_1', ['ireal-pro_1']], ['wikifonia_3', ['wikifonia_3']]])
    expect(filterSongs(index, '', ['progression-02', 'progression-01'], true).map((g) => g.id)).toEqual(['wikifonia_3'])
    expect(filterSongs(index, '', ['progression-02', 'progression-01'], false)).toHaveLength(2)
  })
})
