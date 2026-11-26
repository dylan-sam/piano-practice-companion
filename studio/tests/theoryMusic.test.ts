import { describe, expect, it } from 'vitest'
import { abcNote, cardChord, progressionAbc, romanAbc, romanText, toSymbol, transposeFor } from '../src/lessons/theoryMusic'

describe('theory pictures in other keys', () => {
  it('reads the cards\' chords and moves them to a key', () => {
    expect(toSymbol('C♯°7')).toBe('C#o7')
    expect(toSymbol('Dø7')).toBe('Dh7')
    expect(cardChord('D−7', 2)?.root).toBe(4)
    expect(cardChord('→', 0)).toBeNull()
    expect(transposeFor(0)).toBe(0)
    expect(transposeFor(7)).toBe(-5)
    expect(transposeFor(6)).toBe(6)
  })

  it('writes chord names as Roman numerals of C', () => {
    expect(romanText('D-7')).toBe('II-7')
    expect(romanText('Db7')).toBe('bII7')
    expect(romanText('G7b9b13')).toBe('V7b9b13')
    expect(romanAbc('"D-7"F2 "G7"F2 | "Cmaj7"E4')).toBe('"II-7"F2 "V7"F2 | "Imaj7"E4')
  })

  it('writes notes and progressions in ABC', () => {
    expect([abcNote(60), abcNote(72), abcNote(48), abcNote(61), abcNote(84), abcNote(36)]).toEqual(['C', 'c', 'C,', '^C', "c'", 'C,,'])
    expect(progressionAbc(['D−7', '→', 'F7 D7', 'Cmaj7'], 0).split('\n').at(-1)).toBe('[D,,DFAc]4 | [F,,FAc^d]2 [D,,D^FAc]2 | [C,,CEGB]4 |]')
    expect(progressionAbc(['Cmaj7'], 2).split('\n').at(-1)).toBe('[D,,D^FA^c]4 |]')
  })
})
