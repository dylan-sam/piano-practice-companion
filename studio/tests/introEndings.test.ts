import { describe, expect, test } from 'vitest'
import bundled from '../public/leadsheets/catalog.json'
import lessonSongs from '../public/leadsheets/lessons.json'
import { FRAMES, withFrame, withFrameOf } from '../src/lessons/introEndings'
import { lessonUrl, readLessonLink } from '../src/lessons/lessonLink'
import type { Chart } from '../src/music/chart'
import { parseChord } from '../src/music/chords'
import { ROUTES } from '../src/router'

const charts = [...bundled.playlists, ...lessonSongs.playlists].flatMap((list) => list.charts) as unknown as Chart[]
const find = (title: string) => charts.find((chart) => chart.title.toLowerCase().startsWith(title.toLowerCase()))!
const chordsOf = (chart: Chart, from: number, to: number) => chart.bars.slice(from, to).map((bar) => bar.chords.map((c) => c.symbol).join(' '))

describe('intros and endings', () => {
  test('every frame fits its song: its chords read, 4/4 bars added before and after', () => {
    for (const frame of Object.values(FRAMES)) {
      const chart = find(frame.song)
      expect(chart, frame.song).toBeDefined()
      for (const bar of [...frame.intro.bars, ...frame.ending.bars]) for (const symbol of bar.split(' ')) expect(parseChord(symbol), symbol).not.toBeNull()
      const framed = withFrame(chart, frame)
      const pickup = !chart.bars[0].chords[0]?.symbol
      expect(framed.bars.length).toBe(chart.bars.length + frame.intro.bars.length - (pickup ? 1 : 0) + frame.ending.bars.length)
      expect(framed.bars.at(-1)!.barline).toBe('final')
      expect(framed.bars.filter((bar) => bar.barline === 'final')).toHaveLength(1)
    }
  })

  test('a pickup bar takes the intro\'s last chord; the melody moves along', () => {
    const avalon = find('Avalon')
    const framed = withFrame(avalon, FRAMES.avalon)
    expect(chordsOf(framed, 0, 5)).toEqual(['G-7', 'C7', 'F', 'F', 'C7'])
    const first = avalon.melody!.notes[0]
    expect(framed.melody!.notes[0]).toEqual({ ...first, bar: first.bar + 3 })
    expect(chordsOf(framed, framed.bars.length - 4, framed.bars.length)).toEqual(['G-7', 'C7', 'F6', 'F6'])
    // No pickup: all the intro's bars before the first
    const honeysuckle = withFrame(find('Honeysuckle Rose'), FRAMES.honeysuckle)
    expect(chordsOf(honeysuckle, 0, 5)).toEqual(['G-7 C7', 'G-7 C7', 'G-7 C7', 'G-7 C7', 'G-7 C7'])
  })

  test('only the song of the frame, only from a lesson link; the catalog keeps its chart', () => {
    const avalon = find('Avalon')
    expect(withFrame(avalon, FRAMES.honeysuckle)).toBe(avalon)
    expect(withFrameOf(avalon, undefined)).toBe(avalon)
    expect(withFrameOf(avalon, 'nothing')).toBe(avalon)
    expect(avalon.bars[0].chords[0].symbol).toBeNull()
    const url = lessonUrl({ route: ROUTES.leadSheetSightreading, song: 'Avalon', frame: 'avalon' })
    expect(readLessonLink(url.slice(url.indexOf('?')))?.frame).toBe('avalon')
    expect(readLessonLink('?frame=unknown')?.frame).toBeUndefined()
  })
})
