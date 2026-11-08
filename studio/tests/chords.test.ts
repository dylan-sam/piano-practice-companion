import { describe, expect, it } from 'vitest'
import { chordTones, closeVoicingTones, parseChord, rootlessVoicings } from '../src/music/chords'
import { matchesPlayedChord } from '../src/exercises/sightReading'

const chord = (symbol: string) => {
  const parsed = parseChord(symbol)
  if (!parsed) throw new Error(`Cannot parse ${symbol}`)
  return parsed
}

describe('chart qualities sent by the catalog', () => {
  it('voices triads without an added seventh', () => {
    expect(chord('Co').quality).toBe('dim')
    expect(closeVoicingTones(chord('Co'))).toEqual([0, 3, 6])
    expect(chord('Co7').quality).toBe('dim7')
    expect(chord('C+').quality).toBe('aug')
    expect(closeVoicingTones(chord('C+'))).toEqual([0, 4, 8])
    expect(rootlessVoicings(chord('C+')).flat().map((i) => i % 12)).not.toContain(10)
    expect(closeVoicingTones(chord('Csus'))).toEqual([0, 5, 7])
    expect(closeVoicingTones(chord('Csus2'))).toEqual([0, 2, 7])
    expect(chord('C2').quality).toBe('sus2')
  })

  it('reads sevenths, power chords and the root alone', () => {
    expect(chord('C7#5').quality).toBe('dom7')
    expect(chordTones(chord('C7#5'))).toEqual([0, 4, 8, 10])
    expect(chordTones(chord('C+7'))).toEqual([0, 4, 8, 10])
    expect(chord('C7sus').quality).toBe('sus7')
    expect(chord('C13sus').quality).toBe('sus7')
    expect(chord('C11').quality).toBe('dom7')
    expect(chord('C13').quality).toBe('dom7')
    expect(chord('C5').quality).toBe('power')
    expect(chord('C1').quality).toBe('root')
    expect(closeVoicingTones(chord('C1'))).toEqual([0])
  })

  it('checks played triads and power chords note by note', () => {
    expect(matchesPlayedChord(new Set([60, 63, 66]), chord('Co'))).toBe(true)
    expect(matchesPlayedChord(new Set([60, 63, 66, 69]), chord('Co'))).toBe(false)
    expect(matchesPlayedChord(new Set([48, 55]), chord('C5'))).toBe(true)
  })
})

// Chords the catalog writes (chord_notation.write_chart) and charts use, read with their exact tones
describe('written alterations', () => {
  const tones = (symbol: string) => {
    const chord = parseChord(symbol)!
    return closeVoicingTones(chord).map((t) => (chord.root + t) % 12).sort((a, b) => a - b)
  }
  it('altered or missing fifths and thirds replace the family tones', () => {
    expect(tones('C-#5')).toEqual([0, 3, 8])
    expect(tones('C^7b5')).toEqual([0, 4, 6, 11])
    expect(tones('C5b5')).toEqual([0, 6])
    expect(tones('C7no5')).toEqual([0, 0, 4, 10]) // the missing fifth doubles the root
    expect(tones('C7sus2')).toEqual([0, 2, 7, 10])
  })
  it('alt alone, o^7 and two accidentals in a bass', () => {
    expect(parseChord('Calt')!.quality).toBe('dom7')
    expect(tones('Co^7')).toEqual([0, 3, 6, 11])
    expect(parseChord('A#/C##')!.bass).toBe(2)
    expect(parseChord('Ab#11')!.root).toBe(8) // the # belongs to the 11
  })
})
