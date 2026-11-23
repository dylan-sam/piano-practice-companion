// What to improvise with over each lesson song: a scale map per song, part by part, with the
// unit's new idea explained in a few lines. Each unit brings one new idea and keeps the earlier
// ones (pentatonic, then blues, then ii-V-I, then V7 to minor and bebop, then pentatonics per
// chord, then modes). Shown before an improvising step (Lessons) and under the sheet of Free
// Improvisation, which also shows the scale of the chord sounding for any song.
//
// Notes are written relative to the song's key, so they follow any transposition: "{0}" is the
// tonic, "{7}" the note a 5th above it ("{7}7" is the V7 chord), and so on. A note that must be
// spelled on a given letter says how many letters above the tonic's: "{1.0}" is a half step up on
// the tonic's own letter (F# in F, where "{1}" would be Gb).

import { keyPrefersFlats, noteName, type Chord } from '../music/chords'

/** One idea for a part of a song: a scale, where to play it, and why it works. */
export interface ScaleIdea { scale: string; over: string; why: string }

/** A part of a song (written bars, counted from 0 as the chart stores them) and its ideas. */
export interface ScaleSection { label: string; bars: [number, number]; ideas: ScaleIdea[] }

/** The scale map of a lesson song. */
export interface ScaleMap {
  song: string // the start of the song's title
  tonic: number // the song's key as written, a pitch class (the placeholders count from it)
  unit: string // the unit whose idea it brings
  idea: string // the unit's new idea, in a few lines
  sections: ScaleSection[]
}

// The unit's new ideas
const PENTATONIC = 'The major pentatonic of the key (its 1st, 2nd, 3rd, 5th and 6th notes) has no note that clashes with the ' +
  "key's main chords, so almost anything you play over the song sounds right. Start there, then aim for the chord's own " +
  'notes (root, 3rd, 5th) on beat 1.'
const BLUES = "The blues plays the key's minor pentatonic or blues scale over every chord, even though its chords are major: " +
  'the minor 3rd rubbing against the major 3rd is the blues sound. Then follow the chords: each dominant 7th takes its ' +
  'Mixolydian scale (a major scale with a flat 7th).'
const II_V_I = 'In a ii-V-I, the scales of the three chords (Dorian on ii, Mixolydian on V, major on I) have the same notes: ' +
  "those of the I's major scale. Think of one scale for the three chords, and land on a guide tone (3rd or 7th) as the chord changes."
const V_TO_MINOR = 'A V7 going to a minor chord takes a darker scale, Mixolydian with a flat 9th and flat 13th: the notes of the ' +
  'minor key it goes to. A V7 going to a major chord can take the bebop dominant scale (Mixolydian with the major 7th as a ' +
  'passing note), which keeps the chord tones on the beats in eighth-note lines.'
const PER_CHORD = "Fewer notes and more space: a major pentatonic built on each chord's root (a minor pentatonic over a minor " +
  'chord), long notes that sing, and rests between phrases.'
const MODES = 'A modal tune stays on one chord for many bars: play its mode (Dorian over a minor 7th) and make phrases, not ' +
  'runs. The minor pentatonic a 5th above the chord (A minor pentatonic over Dm7) gives an open, modern sound.'

export const SCALE_MAPS: ScaleMap[] = [
  {
    song: 'Avalon', tonic: 5, unit: 'Unit 1', idea: PENTATONIC,
    sections: [
      { label: 'A (bars 1 to 16)', bars: [0, 16], ideas: [
        { scale: '{0} major pentatonic', over: 'the whole part', why: 'The key of the song: its five notes fit {7}7, {0} and {2}-7.' },
        { scale: '{7}7 chord tones ({7} {11} {2} {5})', over: 'the {7}7 bars', why: 'The V7 leads home: its 3rd ({11}) wants to rise to {0}.' },
      ] },
      { label: 'B (bars 17 to 24)', bars: [17, 24], ideas: [
        { scale: '{9}7 chord tones ({9} {1.0} {4} {7})', over: 'the {9}7 bars', why: "The pentatonic's {0} clashes with the chord's 3rd ({1.0}): play the chord's notes instead." },
        { scale: '{0} major pentatonic', over: 'the {2}- bars', why: '{2} minor is the ii of {0}: the pentatonic fits it again.' },
      ] },
      { label: 'C (bars 25 to 32)', bars: [25, 32], ideas: [
        { scale: '{0} major pentatonic', over: 'the whole part', why: 'The key again; over {9}7, stay on its chord tones as before.' },
      ] },
    ],
  },
  {
    song: 'Study Blues', tonic: 5, unit: 'Unit 2', idea: BLUES,
    sections: [
      { label: 'Bars 1 to 4 (I)', bars: [0, 3], ideas: [
        { scale: '{0} blues scale', over: 'the whole blues', why: 'One scale for every chord: the blues sound, and nothing to think about.' },
        { scale: '{0} Mixolydian', over: '{0}7', why: 'Following the chord: a major scale with the flat 7th, the 7th of {0}7.' },
      ] },
      { label: 'Bars 5 and 6 (IV)', bars: [4, 5], ideas: [
        { scale: '{5} Mixolydian', over: '{5}7', why: "The IV7's own scale: its 7th is the blues scale's flat 3rd of the key." },
      ] },
      { label: 'Bars 7 to 12 (turnaround)', bars: [6, 11], ideas: [
        { scale: '{0} blues scale', over: '{0}7 and {9}7', why: 'Still the blues sound.' },
        { scale: '{0} major scale', over: '{2}-7 {7}7 (the ii-V home)', why: 'The ii-V back to {0}: one major scale for both bars.' },
      ] },
    ],
  },
  {
    song: 'Tin Roof Blues', tonic: 3, unit: 'Unit 2', idea: BLUES,
    sections: [
      { label: 'Each chorus of 12 bars', bars: [0, 36], ideas: [
        { scale: '{0} blues scale', over: 'every chord', why: 'One scale for the whole blues: the minor 3rd against the major chords is the blues sound.' },
        { scale: '{0} major pentatonic', over: 'the {0} bars', why: 'A brighter sound on the I.' },
        { scale: 'each chord\'s Mixolydian', over: '{0}7, {5}7, {7}7', why: 'Following the chords: each dominant 7th takes its own Mixolydian scale.' },
        { scale: '{9}7 {2}7 {7}7: Mixolydian of each', over: 'the dominant chain before the end', why: 'Each V7 goes to the next a 4th up: Mixolydian on each.' },
      ] },
    ],
  },
  {
    song: 'Oh Lady Be Good', tonic: 7, unit: 'Unit 3', idea: II_V_I,
    sections: [
      { label: 'A (bars 1 to 16)', bars: [0, 15], ideas: [
        { scale: '{0} major pentatonic, or {0} blues scale', over: 'the {0} bars', why: 'A riff tune: the pentatonic or the blues scale fits its bluesy melody.' },
        { scale: '{5} Mixolydian', over: '{5}7', why: 'The IV7 borrowed from the blues: its flat 7th is {3}.' },
        { scale: '{0} major scale', over: '{7}7 {0}', why: 'V-I: the major scale of {0}.' },
      ] },
      { label: 'B (bars 17 to 24)', bars: [16, 23], ideas: [
        { scale: '{0} major scale', over: '{2}-7 {7}7 (ii-V of {0})', why: 'ii and V share the notes of the I they go to: one scale, the major scale of {0}.' },
        { scale: '{9} minor pentatonic', over: 'the {9}- bars', why: '{9} minor is the relative minor of {0}: the same notes as its major pentatonic.' },
      ] },
      { label: 'A (bars 25 to 34)', bars: [24, 33], ideas: [
        { scale: '{0} major pentatonic, or {0} blues scale', over: 'the whole part', why: 'As in the first A.' },
      ] },
    ],
  },
  {
    song: 'Honeysuckle Rose', tonic: 5, unit: 'Unit 3', idea: II_V_I,
    sections: [
      { label: 'A (bars 1 to 10)', bars: [0, 9], ideas: [
        { scale: '{0} major scale', over: '{2}-7 {7}7 (the ii-V, again and again)', why: '{2} Dorian and {7} Mixolydian have the notes of {0} major, where the A resolves: think {0} major for the whole A.' },
        { scale: '{0} major pentatonic', over: 'the whole A', why: 'Fewer notes, the same sound.' },
      ] },
      { label: 'Bridge (bars 11 to 18)', bars: [10, 17], ideas: [
        { scale: '{0} Mixolydian', over: '{0}7', why: 'A V going to {5}6: Mixolydian.' },
        { scale: '{5} major pentatonic', over: '{5}6', why: 'The pentatonic of the chord.' },
        { scale: '{2} Mixolydian, then {7} blues scale', over: '{2}7, then {7}7#9', why: 'Two dominant chords: each its Mixolydian; the #9 asks for the blues sound.' },
      ] },
      { label: 'A (bars 19 to 25)', bars: [18, 24], ideas: [
        { scale: '{0} major scale', over: 'the whole part', why: 'As in the first A; bar 20 slips a half step down ({3}-7 {8}7): just follow it.' },
      ] },
    ],
  },
  {
    song: 'Just You, Just Me', tonic: 0, unit: 'Unit 4', idea: V_TO_MINOR,
    sections: [
      { label: 'A (bars 1 to 16)', bars: [0, 15], ideas: [
        { scale: '{9} Mixolydian b9 b13', over: '{9}7 going to {2}-', why: 'A V7 going to a minor chord: the notes of {2} minor ({10} and {5}).' },
        { scale: '{0} major scale', over: '{2}- {7} {0}', why: 'ii-V-I: one major scale.' },
        { scale: '{5} minor (a borrowed {8})', over: '{5}-', why: 'The IV turns minor for a beat: its {8} is a lovely bluesy colour.' },
      ] },
      { label: 'B (bars 17 to 24)', bars: [16, 23], ideas: [
        { scale: '{0} major scale', over: '{2}- {7}7', why: 'A ii-V: one major scale.' },
        { scale: '{2} Mixolydian', over: '{2}7 going to {7}', why: 'A V going to a major chord.' },
        { scale: '{7} bebop dominant', over: '{7}7 going to {0}', why: 'Mixolydian with a passing major 7th: chord tones fall on the beats.' },
      ] },
      { label: 'A (bars 25 to 32)', bars: [24, 31], ideas: [
        { scale: '{0} major pentatonic', over: 'the whole part', why: 'Back home; keep {9}7 → {2}- dark as in the first A.' },
      ] },
    ],
  },
  {
    song: 'I Got Rhythm', tonic: 10, unit: 'Unit 4', idea: V_TO_MINOR,
    sections: [
      { label: 'Verse (bars 1 to 28)', bars: [0, 27], ideas: [
        { scale: '{9} Dorian, or {9} minor pentatonic', over: 'the {9}- bars', why: 'The verse is in {9} minor.' },
        { scale: '{4} Mixolydian b9 b13', over: '{4}7 going to {9}-', why: 'A V7 going to a minor chord.' },
      ] },
      { label: 'Refrain, A sections', bars: [28, 43], ideas: [
        { scale: '{0} major pentatonic, or {0} blues scale', over: 'the whole A', why: 'Rhythm Changes go by fast: one scale carries you through I-vi-ii-V.' },
        { scale: '{7} bebop dominant', over: '{7}7', why: 'Eighth-note lines with the chord tones on the beats.' },
      ] },
      { label: 'Refrain, bridge', bars: [44, 51], ideas: [
        { scale: 'Mixolydian of each dominant', over: '{4}7 {9}7 {2}7 {7}7 (two bars each)', why: 'A chain of V7s, each going to the next a 4th up.' },
      ] },
      { label: 'Refrain, last A', bars: [52, 62], ideas: [
        { scale: '{0} major pentatonic, or {0} blues scale', over: 'the whole A', why: 'As in the first As.' },
      ] },
    ],
  },
  {
    song: 'What Is This Thing Called Love', tonic: 0, unit: 'Unit 4', idea: V_TO_MINOR,
    sections: [
      { label: 'A (bars 1 to 16)', bars: [0, 16], ideas: [
        { scale: '{5} harmonic minor (= {0} Mixolydian b9 b13)', over: '{7}ø7 {0}7b9 {5}-6', why: 'A minor ii-V-i in {5} minor: the {0}7b9 goes to a minor chord.' },
        { scale: '{7} Mixolydian b9 b13', over: '{2}ø7 {7}7#5', why: 'The same dark V, which then resolves to major...' },
        { scale: '{0} major pentatonic', over: '{0}^7', why: '...the surprise of the song: major where minor was expected.' },
      ] },
      { label: 'Bridge (bars 17 to 24)', bars: [17, 24], ideas: [
        { scale: '{10} major scale', over: '{0}-7 {5}7 {10}^7', why: 'A ii-V-I in {10}: one major scale for the three chords.' },
        { scale: '{8} Mixolydian', over: '{8}7', why: "A dominant chord a step down: its own scale." },
      ] },
      { label: 'A (bars 25 to 32)', bars: [25, 32], ideas: [
        { scale: '{5} harmonic minor, then {0} major pentatonic', over: 'as in the first A', why: 'The same moves.' },
      ] },
    ],
  },
  {
    song: 'Embraceable You', tonic: 7, unit: 'Unit 5', idea: PER_CHORD,
    sections: [
      { label: 'First half (bars 1 to 16)', bars: [0, 15], ideas: [
        { scale: '{0} major pentatonic', over: 'the {0} bars', why: 'The pentatonic of the chord.' },
        { scale: '{7} major pentatonic', over: '{7}7', why: "The chord's pentatonic: no clash with its 3rd." },
        { scale: '{9} minor pentatonic', over: 'the {9}- bars', why: 'A minor chord: its minor pentatonic.' },
        { scale: '{7} major scale', over: '{4}-7 {9}7 ... {2}7 to {7}', why: 'The song visits {7} (the key of the V) for a few bars.' },
      ] },
      { label: 'Second half (bars 17 to 34)', bars: [16, 33], ideas: [
        { scale: '{0} major pentatonic', over: 'the {0} bars', why: 'As before.' },
        { scale: '{5} major pentatonic', over: '{5}', why: 'The IV, after its V7 ({0}7).' },
        { scale: 'long notes', over: 'the whole half', why: 'A ballad: let notes ring, leave space.' },
      ] },
    ],
  },
  {
    song: "'S Wonderful", tonic: 3, unit: 'Unit 5', idea: PER_CHORD,
    sections: [
      { label: 'A (bars 1 to 16)', bars: [0, 15], ideas: [
        { scale: '{0} major pentatonic', over: 'the {0} bars', why: 'The pentatonic of the chord, in the bossa rhythm.' },
        { scale: '{0} major scale', over: '{2}-7 {7}7 (ii-V)', why: 'One scale for ii and V.' },
        { scale: '{1.0} diminished scale', over: '{1.0}o', why: 'A diminished chord: the diminished scale (whole step, half step).' },
      ] },
      { label: 'B (bars 17 to 24)', bars: [16, 23], ideas: [
        { scale: '{4} major pentatonic', over: 'the {4} bars', why: 'The bridge moves to {4}.' },
        { scale: 'Mixolydian of each', over: '{4}9 {2}9 {7}13', why: 'Three dominant chords leading back home.' },
      ] },
      { label: 'A (bars 25 to 32)', bars: [24, 31], ideas: [
        { scale: '{0} major pentatonic', over: 'the whole part', why: 'As in the first A.' },
      ] },
    ],
  },
  {
    song: 'Tea for two', tonic: 5, unit: 'Unit 5', idea: PER_CHORD,
    sections: [
      { label: 'Bars 1 to 8', bars: [0, 7], ideas: [
        { scale: '{0} major pentatonic', over: '{2}- {7}7 {0}', why: 'ii-V-I in {0}: its pentatonic fits all three.' },
      ] },
      { label: 'Bars 9 to 16', bars: [8, 15], ideas: [
        { scale: '{4} major pentatonic', over: 'the {9} and {4} bars', why: 'The tune moves up to {4}.' },
      ] },
      { label: 'Bars 17 to 32', bars: [16, 31], ideas: [
        { scale: '{0} major pentatonic', over: 'the {0} bars', why: 'Home again.' },
        { scale: '{9} Mixolydian b9 b13', over: '{9}7 going to {2}-', why: 'A V7 going to a minor chord.' },
      ] },
    ],
  },
  {
    song: 'Modal Study', tonic: 2, unit: 'Unit 6', idea: MODES,
    sections: [
      { label: 'A sections', bars: [0, 15], ideas: [
        { scale: '{0} Dorian', over: '{0}-7', why: 'The mode of a minor 7th chord.' },
        { scale: '{7} minor pentatonic', over: '{0}-7', why: 'A minor pentatonic a 5th up: an open, modern sound.' },
      ] },
      { label: 'Bridge', bars: [16, 23], ideas: [
        { scale: '{1} Dorian', over: '{1}-7', why: 'The same mode a half step up: move every idea up with it.' },
        { scale: '{8} minor pentatonic', over: '{1}-7', why: 'A 5th up again.' },
      ] },
      { label: 'Last A', bars: [24, 31], ideas: [
        { scale: '{0} Dorian', over: '{0}-7', why: 'Back down.' },
      ] },
    ],
  },
]

/** The scale map of a song, by the start of its title (case ignored). */
export function scaleMapFor(title: string | undefined): ScaleMap | undefined {
  const folded = title?.toLowerCase() ?? ''
  return SCALE_MAPS.find((map) => folded.startsWith(map.song.toLowerCase()))
}

/**
 * A scale map's text in the key played: "{n}" becomes the note n semitones above the key, spelled
 * as the key prefers; "{n.d}" spells it on the letter d letters above the key's.
 *
 *   ('{7}7 going to {2}-', key F) -> 'C7 going to G-'      ('{1.0}', key F) -> 'F#'
 */
export function inKey(text: string, keyPc: number): string {
  const flats = keyPrefersFlats(keyPc)
  const tonic = noteName(keyPc, flats)
  return text.replace(/\{(\d+)(?:\.(\d))?\}/g, (_, step: string, letters?: string) =>
    letters === undefined ? noteName(keyPc + Number(step), flats) : spelled(tonic, Number(step), Number(letters)))
}

/** The note `step` semitones above a tonic, written on the letter `letters` letters above the tonic's. */
function spelled(tonic: string, step: number, letters: number): string {
  const letter = LETTERS[(LETTERS.indexOf(tonic[0]) + letters) % 7]
  const tonicPc = (NATURAL[LETTERS.indexOf(tonic[0])] + (tonic[1] === 'b' ? -1 : tonic[1] === '#' ? 1 : 0) + 12) % 12
  const shift = ((((tonicPc + step - NATURAL[LETTERS.indexOf(letter)]) % 12) + 18) % 12) - 6
  return letter + (shift < 0 ? 'b'.repeat(-shift) : '#'.repeat(shift))
}

/** The section of a map that holds a written bar, if any. */
export function sectionAt(map: ScaleMap, bar: number): ScaleSection | undefined {
  return map.sections.find((section) => bar >= section.bars[0] && bar <= section.bars[1])
}

// Names of the scales chordScale gives, by their steps
const SCALE_NAMES: Record<string, string> = {
  '0,2,4,5,7,9,11': 'major', '0,2,4,6,7,9,11': 'Lydian', '0,2,4,5,7,9,10': 'Mixolydian', '0,2,4,6,7,9,10': 'Lydian dominant',
  '0,1,4,5,7,8,10': 'Mixolydian b9 b13', '0,2,4,5,7,8,10': 'Mixolydian b13', '0,1,4,6,8,10': 'altered', '0,2,3,5,7,9,10': 'Dorian',
  '0,2,3,5,7,9,11': 'melodic minor', '0,2,3,5,6,8,10': 'Locrian natural 2', '0,2,3,5,6,8,9,11': 'diminished',
  '0,2,4,6,8,9,11': 'Lydian augmented', '0,2,5,7,9,10': 'Mixolydian (sus)', '0,2,4,5,6,9,10': 'Mixolydian b5',
}

/**
 * The scale of a chord in words, with its notes.
 *
 *   (G7 going to Cm) -> 'G Mixolydian b9 b13: G A♭ B C D E♭ F'
 */
export function describeScale(chord: Chord, steps: readonly number[], keyPc: number): string {
  const sorted = [...steps].sort((a, b) => a - b)
  const name = SCALE_NAMES[sorted.join(',')] ?? 'scale'
  const root = noteName(chord.root, keyPrefersFlats(keyPc) || keyPrefersFlats(chord.root))
  return `${pretty(root)} ${name}: ${spellScale(root, sorted).map(pretty).join(' ')}`
}

const LETTERS = 'CDEFGAB'
const NATURAL = [0, 2, 4, 5, 7, 9, 11]
/** A note name with typeset flats and sharps. */
const pretty = (name: string) => name.replace(/b/g, '♭').replace(/#/g, '♯')

/**
 * The notes of a scale spelled from its root: a seven-note scale takes each letter once (G Ab B C
 * D Eb F, not G G# B...); other scales follow the root's sharps or flats.
 */
export function spellScale(root: string, steps: readonly number[]): string[] {
  const rootPc = (NATURAL[LETTERS.indexOf(root[0])] + (root.length > 1 ? (root[1] === 'b' ? -1 : 1) : 0) + 12) % 12
  if (steps.length !== 7) return steps.map((step) => noteName(rootPc + step, root.includes('b')))
  return steps.map((step, i) => {
    const letter = LETTERS[(LETTERS.indexOf(root[0]) + i) % 7]
    const shift = ((((rootPc + step - NATURAL[LETTERS.indexOf(letter)]) % 12) + 18) % 12) - 6
    return letter + (shift < 0 ? 'b'.repeat(-shift) : '#'.repeat(shift))
  })
}
