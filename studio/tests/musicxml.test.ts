import { describe, expect, test } from 'vitest'
import { DOMParser } from '@xmldom/xmldom'
import { harmonySymbol, parseMusicXml } from '../src/formats/musicxml'
import { isChart } from '../src/music/chart'

/** Parse XML text without a browser. */
const parse = (text: string) => new DOMParser().parseFromString(text, 'text/xml') as unknown as Document

/** A note element: pitch (step, octave, alter), duration in divisions, and extras inside it. */
const note = (step: string, octave: number, duration: number, extra = '', alter = 0) =>
  `<note><pitch><step>${step}</step>${alter ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>` +
  `<duration>${duration}</duration><voice>1</voice>${extra}</note>`
const harmony = (step: string, kind: string, extra = '') =>
  `<harmony><root><root-step>${step}</root-step></root><kind>${kind}</kind>${extra}</harmony>`

// A pickup of one beat, then a bar with two chords, a tie into the last bar, a chord tone
const SCORE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Test Tune</work-title></work>
  <identification><creator type="composer">Someone</creator></identification>
  <part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list>
  <part id="P1">
    <measure number="0" implicit="yes">
      <attributes><divisions>2</divisions><key><fifths>-1</fifths><mode>major</mode></key>
        <time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction><direction-type><words>Swing</words></direction-type><sound tempo="160"/></direction>
      ${note('C', 5, 2)}
    </measure>
    <measure number="1">
      <barline location="left"><repeat direction="forward"/></barline>
      <direction><direction-type><rehearsal>A</rehearsal></direction-type></direction>
      ${harmony('G', 'minor-seventh')}
      ${note('D', 5, 1)}${note('E', 5, 1)}<backup><duration>2</duration></backup>
      <forward><duration>4</duration></forward>
      ${harmony('C', 'dominant', '<degree><degree-value>9</degree-value><degree-alter>-1</degree-alter><degree-type>add</degree-type></degree>')}
      ${note('F', 5, 4, '<tie type="start"/>')}
      <barline location="right"><repeat direction="backward"/></barline>
    </measure>
    <measure number="2">
      ${harmony('F', 'major-seventh')}
      ${note('F', 5, 2, '<tie type="stop"/>')}
      ${note('A', 4, 6)}${note('C', 5, 6, '<chord/>')}
    </measure>
  </part>
</score-partwise>`

describe('MusicXML import', () => {
  const chart = parseMusicXml(SCORE, parse)

  test('title, composer, key, tempo and meter', () => {
    expect(isChart(chart)).toBe(true)
    expect([chart.title, chart.composer, chart.key, chart.minor, chart.bpm, chart.time]).toEqual(
      ['Test Tune', 'Someone', 5, undefined, 160, [4, 4]])
  })

  test('a pickup becomes a whole bar ending with its notes', () => {
    expect(chart.melody!.notes[0]).toEqual({ bar: 0, at: 3, beats: 1, pitch: 72 })
    expect(chart.bars[0].chords).toEqual([{ symbol: null, beats: 4 }])
  })

  test('chords at their positions, repeats and rehearsal marks', () => {
    expect(chart.bars[1].chords).toEqual([{ symbol: 'G-7', beats: 2 }, { symbol: 'C7b9', beats: 2 }])
    expect(chart.bars[1]).toMatchObject({ repeatStart: true, repeatEnd: true, section: 'A' })
    expect(chart.bars[2].chords).toEqual([{ symbol: 'F^7', beats: 4 }])
    expect(chart.bars[2].barline).toBe('final')
  })

  test('ties join notes across the bar line; a chord gives its top note', () => {
    const notes = chart.melody!.notes.map((n) => [n.bar, n.at, n.beats, n.pitch])
    expect(notes).toEqual([[0, 3, 1, 72], [1, 0, 0.5, 74], [1, 0.5, 0.5, 76], [1, 2, 3, 77], [2, 1, 3, 72]])
  })

  test('chord kinds, alterations and bass notes', () => {
    const h = (xml: string) => harmonySymbol(parse(xml).documentElement as unknown as Element)
    expect(h(harmony('B', 'half-diminished'))).toBe('Bh7')
    expect(h('<harmony><root><root-step>E</root-step><root-alter>-1</root-alter></root><kind>major</kind><bass><bass-step>G</bass-step></bass></harmony>')).toBe('Eb/G')
    expect(h(harmony('C', 'none'))).toBeNull()
  })

  test('not a score', () => {
    expect(() => parseMusicXml('<html/>', parse)).toThrow('Not a MusicXML score')
  })
})
