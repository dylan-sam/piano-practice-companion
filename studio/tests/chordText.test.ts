import { expect, test } from 'vitest'
import { prettyChordText } from '../src/music/chordText'

test('chord symbols in text are written for reading', () => {
  expect(prettyChordText('Ionian (major) scale over C^7: up and down')).toBe('Ionian (major) scale over Cmaj7: up and down')
  expect(prettyChordText('Harmonic minor scale over C-^7: up and down')).toBe('Harmonic minor scale over C−maj7: up and down')
  expect(prettyChordText('Dorian scale over C-7')).toBe('Dorian scale over C−7')
  expect(prettyChordText('Locrian #2 scale over Ch7: up and down')).toBe('Locrian ♮2 scale over Cø7: up and down')
  expect(prettyChordText('Phrygian dominant scale over C7b9')).toBe('Phrygian dominant scale over C7♭9')
  expect(prettyChordText('Minor ii-V7b9b13-i in all keys')).toBe('Minor ii-V7♭9♭13-i in all keys')
  expect(prettyChordText('I-#Io7-ii-V with a passing diminished chord')).toBe('I-♯I°7-ii-V with a passing diminished chord')
  expect(prettyChordText('ii-bII7-I with the tritone substitution')).toBe('ii-♭II7-I with the tritone substitution')
  expect(prettyChordText('in C, F and Bb, the b9 and #9, F# and Eb7. About it.')).toBe('in C, F and B♭, the ♭9 and ♯9, F♯ and E♭7. About it.')
  expect(prettyChordText('Major triads in half steps: 1-3-5-8 up, the ii-V-I')).toBe('Major triads in half steps: 1-3-5-8 up, the ii-V-I')
})
