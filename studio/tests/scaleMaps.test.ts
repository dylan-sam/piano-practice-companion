import { describe, expect, test } from 'vitest'
import bundled from '../public/leadsheets/catalog.json'
import lessonSongs from '../public/leadsheets/lessons.json'
import { parseChord } from '../src/music/chords'
import { chordScale } from '../src/exercises/toneColors'
import { ALL_STEPS } from '../src/lessons/program'
import { describeScale, inKey, scaleMapFor, sectionAt, SCALE_MAPS } from '../src/lessons/scaleMaps'

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
    expect(sectionAt(map, 18)?.label).toBe('B (bars 17 to 24)')
  })

  test("the scale of a chord in words, for every chord family", () => {
    const chord = (symbol: string) => parseChord(symbol)!
    expect(describeScale(chord('G7'), chordScale(chord('G7'), chord('C-')), 0)).toBe('G Mixolydian b9 b13: G A♭ B C D E♭ F')
    for (const symbol of ['C', 'C^7', 'C7', 'C-7', 'Ch7', 'Co7', 'C7sus', 'C+', 'C-6', 'C7alt', 'C7#11', 'C^7#11', 'C7b13', 'C7b5', 'C7b9']) {
      expect(describeScale(chord(symbol), chordScale(chord(symbol)), 0), symbol).not.toMatch(/ scale:/)
    }
  })
})
