// The scales the chord helper suggests for a chord, best first:
//
//   1. the chord's scale where it is (chordScale: the app's choice, the one Free Improvisation
//      colours with), e.g. G Mixolydian b9 b13 for a G7 going to Cm
//   2. the chord's pentatonic (major for a major or dominant chord, minor for a minor one)
//   3. the key's scales, which sound over most chords of a song (major pentatonic, minor
//      pentatonic and blues scale of the key; a minor key leaves out the major pentatonic)
//   4. other good choices, kept from OpenStand's chord helper after checking them against jazz
//      teaching (Levine, The Jazz Theory Book): Lydian over a major chord, bebop dominant over a
//      dominant, altered or half-whole over a V, Lydian dominant over a dominant that does not
//      resolve down a 5th, Aeolian over a minor chord, Phrygian over a iii, Locrian over a
//      half-diminished chord, whole tone over an augmented chord. Left out: OpenStand's Phrygian
//      over every minor chord (wrong over a ii, the commonest minor chord) and its altered scale
//      as first choice over a 7b9 with a natural 13th.

import { chordTones, type Chord } from '../music/chords'
import type { KeyCentre } from '../music/roman'
import { scaleName } from '../music/scales'
import { isAltered, resolvesAsV } from './lickReading'
import { chordScale, stepDominant } from './toneColors'

/** Where a suggestion comes from: the chord here, the song's key, or another good choice. */
export type SuggestionKind = 'chord' | 'key' | 'more'

/** A scale to improvise with over a chord: its root, steps above the root, name and why. */
export interface ScaleSuggestion {
  root: number // pitch class
  steps: number[] // semitones above the root, sorted
  name: string
  why: string
  kind: SuggestionKind
}

const MAJOR_PENTATONIC = [0, 2, 4, 7, 9]
const MINOR_PENTATONIC = [0, 3, 5, 7, 10]
const BLUES = [0, 3, 5, 6, 7, 10]

/** Why the chord's own scale fits, in a few words. */
function chordScaleWhy(chord: Chord, next: Chord | null): string {
  const asV = resolvesAsV(chord, next)
  const step = stepDominant(chord, next)
  if (step === 'tritone') return 'A dominant going down a half step (bII7, the tritone substitution): the #11 is the root of the V it stands for.'
  if (step === 'backdoor') return 'The backdoor dominant (bVII7, up a step to I): Mixolydian with a #11, nothing to avoid.'
  if (asV === 'minor') return 'The V of a minor chord: its b9 and b13 lead to the next chord.'
  if (asV === 'major') return 'The V of the next chord: every note but the 4th sounds well.'
  if (isAltered(chord)) return 'Every altered tension (b9, #9, #11, b13) over the 3rd and 7th.'
  switch (chord.quality) {
    case 'min7': case 'min': return 'The minor scale with a natural 6th: the jazz sound of a minor 7th chord.'
    case 'half': return 'A half-diminished chord with a natural 9th, softer than Locrian.'
    case 'dim7': case 'dim': return 'Whole step, half step: the notes of two diminished chords.'
    case 'min6': case 'minMaj7': return 'Minor with a natural 6th and a major 7th, like the chord.'
    case 'sus7': case 'sus': case 'sus2': return 'Mixolydian without the 3rd, so nothing rubs against the 4th.'
    case 'aug': return 'Major with a #4 and a #5, which the chord holds.'
    case 'dom7': return chord.tensions.includes('b9') || chord.tensions.includes('b13')
      ? 'The b9 (and b13) written: Mixolydian with the b9 and b13, the V of the harmonic minor scale.'
      : 'The scale of a dominant chord: major with a b7.'
    default: return 'The scale of the chord: go easy on the 4th, which rubs against the 3rd.'
  }
}

/** The chord's pentatonic: major over a major or dominant chord, minor over a minor 7th, none for the others. */
function chordPentatonic(chord: Chord): ScaleSuggestion | null {
  const third = chordTones(chord)[1]
  const plain = !isAltered(chord) && !chord.tensions.some((t) => t === 'b9' || t === 'b5' || t === '#11')
  if (!plain) return null
  if (third === 4 && ['maj', 'maj7', 'maj6', 'dom7'].includes(chord.quality)) {
    return { root: chord.root, steps: MAJOR_PENTATONIC, name: 'major pentatonic', kind: 'chord',
      why: 'Five notes, no note to avoid: root, 9th, 3rd, 5th and 13th.' }
  }
  if (chord.quality === 'min7' || chord.quality === 'min') {
    return { root: chord.root, steps: MINOR_PENTATONIC, name: 'minor pentatonic', kind: 'chord',
      why: 'Five notes, no note to avoid: root, b3, 4th, 5th and b7.' }
  }
  return null
}

/** The key's scales, whose notes sound over most chords of the song (as Free Improvisation colours them). */
function keyScales(key: KeyCentre): ScaleSuggestion[] {
  const scales: ScaleSuggestion[] = []
  if (!key.minor) {
    scales.push({ root: key.tonic, steps: MAJOR_PENTATONIC, name: 'major pentatonic', kind: 'key',
      why: 'The key\'s major pentatonic: it sounds over most chords of the song.' })
  }
  scales.push(
    { root: key.tonic, steps: MINOR_PENTATONIC, name: 'minor pentatonic', kind: 'key',
      why: key.minor ? 'The key\'s minor pentatonic: it sounds over most chords of the song.' : 'The key\'s minor pentatonic: a bluesy sound over the whole song.' },
    { root: key.tonic, steps: BLUES, name: 'blues scale', kind: 'key',
      why: 'The minor pentatonic with the b5, the blue note: over a blues, over the whole song.' },
  )
  return scales
}

/** A further suggestion by its steps, named from them. */
const more = (root: number, steps: number[], why: string): ScaleSuggestion => ({ root, steps, name: scaleName(steps), why, kind: 'more' })

/** Other good scales for the chord (point 4 above), in the order to try them. */
function otherScales(chord: Chord, next: Chord | null, key: KeyCentre | null): ScaleSuggestion[] {
  const { root, tensions: t } = chord
  const asV = resolvesAsV(chord, next)
  switch (chord.quality) {
    case 'maj': case 'maj7': case 'maj6':
      return [more(root, [0, 2, 4, 6, 7, 9, 11], 'Major with a #4 instead of the 4th: brighter, nothing to avoid.')]
    case 'dom7': {
      if (isAltered(chord)) {
        return [
          ...(t.includes('#5') && !t.includes('b9') && !t.includes('#9') ? [more(root, [0, 2, 4, 6, 8, 10], 'Six whole steps: the #5 and the #11, no b9.')] : []),
          more(root, [0, 1, 3, 4, 6, 7, 9, 10], 'Half step, whole step: b9 and #9 with the natural 5th and 13th.'),
        ]
      }
      // A b9 or b13 written (the Substitutions menu's altered dominant): the half-whole and altered scales
      if (t.includes('b9') || t.includes('b13')) {
        return [
          more(root, [0, 1, 3, 4, 6, 7, 9, 10], 'Half step, whole step: the b9 with the #9 and the natural 13th, bright before a major chord.'),
          more(root, [0, 1, 3, 4, 6, 8, 10], 'Every altered note: the b9, #9, #11 and b13.'),
        ]
      }
      const scales = [more(root, [0, 2, 4, 5, 7, 9, 10, 11], 'Mixolydian with a passing major 7th: eighth notes land on the chord tones on the beat.')]
      if (asV) {
        scales.push(more(root, [0, 1, 3, 4, 6, 8, 10], 'More tension before the resolution: every altered note.'),
          more(root, [0, 1, 3, 4, 6, 7, 9, 10], 'b9 and #9 with the natural 5th and 13th.'))
      } else {
        scales.push(more(root, [0, 2, 4, 6, 7, 9, 10], 'A dominant that does not go down a 5th (bII7, IV7, II7): Mixolydian with a #11.'))
        if (stepDominant(chord, next)) scales.push(more(root, [0, 2, 4, 5, 7, 9, 10], 'Plain Mixolydian: go easy on the 4th.'))
      }
      return scales
    }
    case 'min7': case 'min': {
      const scales = [more(root, [0, 2, 3, 5, 7, 8, 10], 'Darker, with a b6: over a vi, or a i in a minor key.')]
      if (key && !key.minor && (root - key.tonic + 12) % 12 === 4) scales.push(more(root, [0, 1, 3, 5, 7, 8, 10], 'The iii of the key: its notes are the key\'s major scale.'))
      return scales
    }
    case 'min6': return [more(root, [0, 2, 3, 5, 7, 9, 10], 'Dorian has the 6th too, with a b7.')]
    case 'minMaj7': return [more(root, [0, 2, 3, 5, 7, 8, 11], 'Minor with a b6 and a major 7th: the minor key\'s i.')]
    case 'half': return [more(root, [0, 1, 3, 5, 6, 8, 10], 'With the b9: the ii of a minor key.')]
    case 'aug': return [more(root, [0, 2, 4, 6, 8, 10], 'Six whole steps: the #5 and the #11.')]
    default: return []
  }
}

/** The pitch classes a suggestion plays, to leave out a scale already suggested under another name. */
const notesOf = (s: ScaleSuggestion) => s.steps.map((step) => (s.root + step) % 12).sort((a, b) => a - b).join(',')

/** The scales for a chord where it is (the chord after it, the key in force), best first, each once. */
export function scaleSuggestions(chord: Chord, next: Chord | null, key: KeyCentre | null): ScaleSuggestion[] {
  const own = [...chordScale(chord, next)].sort((a, b) => a - b)
  const all: ScaleSuggestion[] = [
    { root: chord.root, steps: own, name: scaleName(own), why: chordScaleWhy(chord, next), kind: 'chord' },
    ...[chordPentatonic(chord)].filter((s): s is ScaleSuggestion => !!s),
    ...(key ? keyScales(key) : []),
    ...otherScales(chord, next, key),
  ]
  const seen = new Set<string>()
  return all.filter((s) => {
    const notes = notesOf(s)
    if (seen.has(notes)) return false
    seen.add(notes)
    return true
  })
}
