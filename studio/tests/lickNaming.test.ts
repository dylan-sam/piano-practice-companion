import { describe, expect, it } from 'vitest'
import type { Chart } from '../src/music/chart'
import { makeLickChart, parseChords, parseNotes } from '../scripts/lickCharts'
import { degreeName, groupOneChordLicks, lickDegrees, lickGroup, lickTitle } from '../scripts/lickNaming'

/** A mined one-chord lick in C over `symbol`. */
function mined(notes: string, symbol: string, context: string, level = 1, tune = 'Tune'): Chart {
  return makeLickChart({
    title: 'Standards: lick', chords: parseChords(`${symbol}:4`), notes: parseNotes(notes),
    info: { kind: 'lick', category: 'Dominant chord', context, source: 'OpenEWLD', license: 'Public domain', tune, bar: 3, level },
  })
}

describe('one-chord lick names', () => {
  it('names chord degrees by the chord', () => {
    expect(degreeName(3, 'min7')).toBe('b3')
    expect(degreeName(3, 'dom7')).toBe('#9')
    expect(degreeName(11, 'dom7')).toBe('maj7')
    expect(degreeName(11, 'maj7')).toBe('7')
    expect(degreeName(9, 'dom7')).toBe('13')
    expect(degreeName(6, 'half')).toBe('b5')
  })

  it('groups licks by the idea they practise', () => {
    expect(lickGroup(mined('C4:4 Bb4:4 G4:4 E4:4', 'C7', 'dom7'))).toBe('Arpeggios')
    expect(lickGroup(mined('E4:4 D4:4 C4:4 Bb3:4', 'C7', 'dom7'))).toBe('Scale lines')
    expect(lickGroup(mined('G4:4 F4:4 G4:4 A4:4 G4:4', 'C7', 'dom7'))).toBe('Neighbours and turns')
    expect(lickGroup(mined('Ab4:4 G4:4 E4:4 C4:4', 'C7', 'dom7'))).toBe('Approach notes')
    expect(lickGroup(mined('C5:4 B4:4 Bb4:4 A4:4', 'C^7', 'maj7'))).toBe('Approach notes')
    expect(lickGroup(mined('G4:4 F#4:4 A4:4 G4:4', 'C^7', 'maj7'))).toBe('Colours')
    expect(lickGroup(mined('E4:4 Eb4:4 E4:4 G4:4', 'C7', 'dom7'))).toBe('Blues')
  })

  it('titles a lick after what it does', () => {
    const arpeggio = mined('C4:4 Bb4:4 G4:4 E4:4', 'C7', 'dom7')
    expect(lickDegrees(arpeggio)).toEqual(['1', 'b7', '5', '3'])
    expect(lickTitle(arpeggio, 'Arpeggios')).toBe('Dominant arpeggio down, root to 3rd')
    expect(lickTitle(mined('Ab4:4 G4:4 E4:4 C4:4', 'C7', 'dom7'), 'Approach notes')).toBe('Dominant line, b13 approaching the 5th')
    expect(lickTitle(mined('C4:4 Eb4:4 G4:4 C5:4', 'C-7', 'min7'), 'Arpeggios')).toBe('Minor arpeggio up, root to root')
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
      'Written arpeggio', 'Dominant arpeggio down, root to 3rd', 'Dominant arpeggio down, root to 3rd (2)', 'Dominant arpeggio down, on the root',
    ])
    expect(groups[0].charts[1].composer).toBe('1 b7 5 3 · First, bar 3')
    expect(groups[0].charts[1].lick?.category).toBe('Arpeggios')
  })
})
