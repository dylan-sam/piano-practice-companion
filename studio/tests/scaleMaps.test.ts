import { describe, expect, test } from 'vitest'
import bundled from '../public/leadsheets/catalog.json'
import lessonSongs from '../public/leadsheets/lessons.json'
import { parseChord } from '../src/music/chords'
import { chordScale } from '../src/exercises/toneColors'
import { ALL_STEPS } from '../src/lessons/program'
import { describeScale, inKey, keysWithPassages, scaleMapFor, sectionAt, SCALE_MAPS } from '../src/lessons/scaleMaps'
import { barKeyCentres } from '../src/music/roman'

const charts = [...bundled.playlists, ...lessonSongs.playlists].flatMap((list) => list.charts)

describe('scale maps', () => {
  test('notes are named in the key played', () => {
    expect(inKey('{7}7 going to {2}-', 5)).toBe('C7 going to G-')
    expect(inKey('{0} blues scale', 3)).toBe('Eb blues scale')
    expect(inKey('{1}o', 7)).toBe('G#o')
    expect(inKey('{1.0} and {1}', 5)).toBe('F# and Gb')
    expect(inKey('{1.0}o', 3)).toBe('Eo')
  })

  test("every map is a lesson song's, in its key, with parts inside its bars", () => {
    for (const map of SCALE_MAPS) {
      const chart = charts.find((c) => c.title.toLowerCase().startsWith(map.song.toLowerCase()))
      expect(chart, map.song).toBeDefined()
      for (const section of map.sections) {
        expect(section.bars[0] <= section.bars[1] && section.bars[1] < chart!.bars.length, `${map.song} ${section.label}`).toBe(true)
        for (const idea of section.ideas) expect(`${idea.scale}${idea.over}${idea.why}`).not.toMatch(/\{(1[2-9]|[2-9]\d)(\.\d)?\}/)
      }
    }
    expect(scaleMapFor('Avalon')?.tonic).toBe(charts.find((c) => c.title === 'Avalon')!.key) // F, after the key fix
  })

  test('every song improvised over in the lessons has a map', () => {
    for (const item of ALL_STEPS.filter((step) => step.kind === 'improvise' && step.link?.song)) {
      expect(scaleMapFor(item.link!.song), item.link!.song).toBeDefined()
    }
  })

  test('the part being played', () => {
    const map = scaleMapFor('Avalon')!
    expect(sectionAt(map, 18)?.label).toBe('B (bars 18 to 25)')
  })

  test("the scale of a chord in words, for every chord family", () => {
    const chord = (symbol: string) => parseChord(symbol)!
    expect(describeScale(chord('G7'), chordScale(chord('G7'), chord('C-')), 0)).toBe('G Mixolydian b9 b13: G A♭ B C D E♭ F')
    for (const symbol of ['C', 'C^7', 'C7', 'C-7', 'Ch7', 'Co7', 'C7sus', 'C+', 'C-6', 'C7alt', 'C7#11', 'C^7#11', 'C7b13', 'C7b5', 'C7b9']) {
      expect(describeScale(chord(symbol), chordScale(chord(symbol)), 0), symbol).not.toMatch(/ scale:/)
    }
  })

  test('the key of each bar: the chart, its key changes, and the passages of a map', () => {
    const chart = { key: 5, bars: [{}, { keys: [{ beats: 0, key: 2, minor: true }] }, {}, { comment: 'Key: Bb:major' }] }
    expect(barKeyCentres(chart)).toEqual([{ tonic: 5, minor: false }, { tonic: 2, minor: true }, { tonic: 2, minor: true },
      { tonic: 10, minor: false }])
    // Tea for Two in F: bars 9 to 15 in A, bars 23 to 27 in G minor
    const map = scaleMapFor('Tea for two')!
    const keys = keysWithPassages(Array.from({ length: 32 }, () => ({ tonic: 5, minor: false })), map)
    expect([keys[0], keys[8], keys[14], keys[15], keys[22]]).toEqual([{ tonic: 5, minor: false }, { tonic: 9, minor: false },
      { tonic: 9, minor: false }, { tonic: 5, minor: false }, { tonic: 7, minor: true }])
  })

  test('the key passages lie inside their songs', () => {
    for (const map of SCALE_MAPS) {
      const last = Math.max(...map.sections.map((section) => section.bars[1]))
      for (const passage of map.keys ?? []) expect(passage.bars[1], map.song).toBeLessThanOrEqual(last)
    }
  })
})
