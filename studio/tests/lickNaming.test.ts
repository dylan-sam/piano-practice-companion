import { describe, expect, it } from 'vitest'
import type { Chart } from '../src/music/chart'
import { parseChord } from '../src/music/chords'
import { lickShape, shapePitch } from '../src/exercises/lickReading'
import { makeLickChart, parseChords, parseNotes } from '../src/exercises/builder/lickCharts'
import { VOCABULARY } from '../scripts/lickExercises'
import { groupOneChordLicks, lickDegrees, lickGroup, lickTitle } from '../scripts/lickNaming'

/** A mined one-chord lick in C over `symbol`. */
function mined(notes: string, symbol: string, context: string, level = 1, tune = 'Tune'): Chart {
  return makeLickChart({
    title: 'Standards: lick', chords: parseChords(`${symbol}:4`), notes: parseNotes(notes),
    info: { kind: 'lick', category: 'Dominant chord', context, source: 'OpenEWLD', license: 'Public domain', tune, bar: 3, level },
  })
}

const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
/** A lick's notes as Lick Sightreading writes them over a chord in C. */
const over = (chart: Chart, symbol: string) => lickShape(chart)!.notes.map((n) => NAMES[shapePitch(n, parseChord(symbol)!, 60) % 12]).join(' ')

describe('one-chord lick names', () => {
  it('reads a lick as the degrees Lick Sightreading plays over any chord', () => {
    expect(lickDegrees(mined('C4:4 Bb4:4 G4:4 E4:4', 'C7', 'dom7'))).toEqual(['1', '7', '5', '3'])
    expect(lickDegrees(mined('G4:4 Gb4:4 F4:4 E4:4', 'C^7', 'maj7'))).toEqual(['5', 'b5', '4', '3'])
  })

  it('plays the half-diminished arpeggio as 1-3-5-7 over any chord, ending on the 9', () => {
    const lick = VOCABULARY.find((l) => l.context === 'half')!
    const chart = makeLickChart({ title: lick.title, chords: parseChords(lick.chords), notes: parseNotes(lick.notes),
      info: { kind: 'lick', category: 'Arpeggios', context: 'half', source: 'x', license: 'x' } })
    expect(lick.title).toBe('Arpeggio 1-3-5-7, scale down to the 9')
    expect(lickDegrees(chart)).toEqual(['1', '3', '5', '7', '6', '5', '3', '2'])
    expect(over(chart, 'Ch7')).toBe('C Eb Gb Bb Ab Gb Eb D')
    expect(over(chart, 'C7')).toBe('C E G Bb A G E D')
    expect(over(chart, 'C^7')).toBe('C E G B A G E D')
  })

  it('groups licks by the idea they practise', () => {
    expect(lickGroup(mined('C4:4 Bb4:4 G4:4 E4:4', 'C7', 'dom7'))).toBe('Arpeggios')
    expect(lickGroup(mined('E4:4 D4:4 C4:4 Bb3:4', 'C7', 'dom7'))).toBe('Scale lines')
    expect(lickGroup(mined('G4:4 F4:4 G4:4 A4:4 G4:4', 'C7', 'dom7'))).toBe('Neighbours and turns')
    expect(lickGroup(mined('Ab4:4 G4:4 E4:4 C4:4', 'C7', 'dom7'))).toBe('Approach notes')
    expect(lickGroup(mined('G4:4 F#4:4 A4:4 G4:4', 'C^7', 'maj7'))).toBe('Colours')
    expect(lickGroup(mined('E4:4 Eb4:4 E4:4 G4:4', 'C7', 'dom7'))).toBe('Blues')
  })

  it('titles a lick after what it does, in degrees that hold over any chord', () => {
    expect(lickTitle(mined('C4:4 Bb4:4 G4:4 E4:4', 'C7', 'dom7'), 'Arpeggios')).toBe('Arpeggio down 1-7-5-3')
    expect(lickTitle(mined('Ab4:4 G4:4 E4:4 C4:4', 'C7', 'dom7'), 'Approach notes')).toBe('Approach into the 5: b6-5-3-1')
    expect(lickTitle(mined('G4:4 F#4:4 A4:4 G4:4', 'C^7', 'maj7'), 'Colours')).toBe('Line with the b5: 5-b5-6-5')
  })

  it('orders a group from easy to hard, written vocabulary first, with unique titles', () => {
    const written = { ...mined('C4:8 E4:8 G4:8 Bb4:8', 'C7', 'dom7'), title: 'Written arpeggio' }
    written.lick = { ...written.lick!, category: 'Arpeggios' }
    const groups = groupOneChordLicks([
      mined('C4:4 Bb4:4 G4:4 E4:4 C4:4', 'C7', 'dom7', 2, 'Long'),
      mined('C4:4 Bb4:4 G4:4 E4:4', 'C7', 'dom7', 1, 'First'),
      mined('C4:4 Bb4:4 G4:4 E4:4', 'C7', 'dom7', 1, 'Second'),
      written,
    ])
    expect(groups.map((g) => g.group)).toEqual(['Arpeggios'])
    expect(groups[0].charts.map((c) => c.title)).toEqual([
      'Written arpeggio', 'Arpeggio down 1-7-5-3', 'Arpeggio down 1-7-5-3 (2)', 'Arpeggio down 1-7-5-3-1',
    ])
    expect(groups[0].charts[1].composer).toBe('First, bar 3')
    expect(groups[0].charts[1].lick?.category).toBe('Arpeggios')
  })
})
