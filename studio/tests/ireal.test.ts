import { describe, expect, test } from 'vitest'
import { cellBeats, parseIrealLinks, parseMusic, unscramble } from '../src/formats/ireal'

// An original progression written in iReal Pro's text notation:
// A section with first and second endings, a B section, and a final bar.
const MUSIC =
  '{*AT44C^7   |A-7   |D-7 G7 |N1E-7 A7 }' +
  '        |N2D-7 G7 |C6   ]' +
  '[*BF^7   |Bb7   |E-7 A7 |D-7 G7 Z '

const IREALBOOK = `irealbook://${encodeURIComponent(
  ['Test Tune', 'Writer Some', 'Medium Swing', 'C', 'n', MUSIC].join('='),
)}`

// iReal Pro scrambles 50-character blocks; the swap is its own inverse
function scramble(plain: string): string {
  let s = plain.replace(/ {3}/g, 'XyQ').replace(/ \|/g, 'LZ')
  let out = ''
  while (s.length > 51) {
    const block = s.slice(0, 50).split('')
    s = s.slice(50)
    const swapped = block.slice()
    for (let i = 0; i < 5; i++) [swapped[i], swapped[49 - i]] = [block[49 - i], block[i]]
    for (let i = 10; i < 24; i++) [swapped[i], swapped[49 - i]] = [block[49 - i], block[i]]
    out += swapped.join('')
  }
  return out + s
}

describe('iReal Pro links', () => {
  test('reads an irealbook:// link', () => {
    const [list] = parseIrealLinks(IREALBOOK)
    expect(list.charts).toHaveLength(1)
    const chart = list.charts[0]
    expect(chart.title).toBe('Test Tune')
    expect(chart.composer).toBe('Some Writer')
    expect(chart.style).toBe('swing')
    expect(chart.key).toBe(0)
    expect(chart.time).toEqual([4, 4])
  })

  test('reads bars, chord lengths and markings', () => {
    const { bars } = parseMusic(MUSIC, [4, 4])
    const played = bars.filter((b) => !b.spacer)
    expect(played.map((b) => b.chords.map((c) => `${c.symbol}:${c.beats}`).join(' '))).toEqual([
      'C^7:4',
      'A-7:4',
      'D-7:2 G7:2',
      'E-7:2 A7:2',
      'D-7:2 G7:2',
      'C6:4',
      'F^7:4',
      'Bb7:4',
      'E-7:2 A7:2',
      'D-7:2 G7:2',
    ])
    expect(played[0]).toMatchObject({ section: 'A', repeatStart: true })
    expect(played[3]).toMatchObject({ ending: 1, repeatEnd: true })
    expect(played[4]).toMatchObject({ ending: 2 })
    expect(played[5].barline).toBe('double')
    expect(played[6].section).toBe('B')
    expect(played[9].barline).toBe('final')
  })

  test('unscrambles irealb:// music the same way', () => {
    const plain = MUSIC.replace(/Z $/, 'Z')
    expect(unscramble(scramble(plain))).toBe(plain)
    const link = `irealb://${encodeURIComponent(
      ['Test Tune', 'Writer Some', '', 'Bossa Nova', 'A-', '', `1r34LbKcu7${scramble(plain)}`, '', '120', '3'].join('='),
    )}===My%20List`
    const [list] = parseIrealLinks(link)
    expect(list.name).toBe('My List')
    expect(list.charts[0]).toMatchObject({ style: 'bossa-nova', key: 9, minor: true, bpm: 120 })
    expect(list.charts[0].bars.filter((b) => !b.spacer)).toHaveLength(10)
  })

  test('finds several links in pasted HTML', () => {
    const html = `<a href="${IREALBOOK}">one</a> and <a href="${IREALBOOK}">two</a>`
    expect(parseIrealLinks(html)).toHaveLength(2)
  })
})

// Same cases as tests/test_ireal_playlist.py CellTests: one reading convention for both importers
describe('chord lengths from cells', () => {
  const beats = (music: string, time: [number, number] = [4, 4]) =>
    parseMusic(music, time).bars.map((bar) => bar.chords.map((c) => c.beats))

  test('three chords in a 4/4 bar start where their cells lie', () => {
    expect(beats('F Abo,G-7 |')).toEqual([[2, 1, 1]])
    expect(beats('F,Abo  G-7|')).toEqual([[1, 2, 1]])
    expect(beats('F,Abo,G-7 |')).toEqual([[1, 1, 2]])
    expect(beats('F,Abo G-7 |')).toEqual([[1, 1, 2]])
  })

  test('evenly spaced, packed and crowded bars are shared evenly', () => {
    expect(beats('F Abo G-7 |')).toEqual([[2, 1, 1]])
    expect(beats('F,Abo,G-7|')).toEqual([[2, 1, 1]])
    expect(beats('C,D|', [3, 4])).toEqual([[2, 1]])
    expect(cellBeats([1, 1, 1, 1, 1], [4, 4])).toEqual([0.8, 0.8, 0.8, 0.8, 0.8])
  })

  test('a slash holds the chord before it', () => {
    expect(beats('F p Bb p D- p C|')).toEqual([[1, 1, 1, 1]])
    expect(beats('C7 p p p |')).toEqual([[4]])
  })

  test('two chords and leading blanks', () => {
    expect(beats('D-7 G7 |')).toEqual([[2, 2]])
    expect(beats('C,D  |')).toEqual([[1, 3]])
    expect(beats('C D  |')).toEqual([[2, 2]])
    expect(beats('  C D |')).toEqual([[2, 2]])
  })
})
