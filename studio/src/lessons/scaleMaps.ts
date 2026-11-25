// What to improvise with over each lesson song: a scale map per song, part by part, with the
// unit's new idea explained in a few lines. Each unit brings one new idea and keeps the earlier
// ones (pentatonic, then blues, then ii-V-I, then V7 to minor and bebop, then pentatonics per
// chord, then modes). Shown before an improvising step (Lessons) and under the sheet of Free
// Improvisation; the scale of any chord is in the chord helper (exercises/scaleSuggestions.ts).
//
// Notes are written relative to the song's key, so they follow any transposition: "{0}" is the
// tonic, "{7}" the note a 5th above it ("{7}7" is the V7 chord), and so on. A note that must be
// spelled on a given letter says how many letters above the tonic's: "{1.0}" is a half step up on
// the tonic's own letter (F# in F, where "{1}" would be Gb).

import { keyPrefersFlats, NOTE_LETTERS, noteName, pitchClassOf, spellOnLetter } from '../music/chords'
import type { KeyCentre } from '../music/roman'

/** One idea for a part of a song: a scale, where to play it, and why it works. */
export interface ScaleIdea { scale: string; over: string; why: string }

/** A part of a song (written bars, counted from 0 as the chart stores them) and its ideas. */
export interface ScaleSection { label: string; bars: [number, number]; ideas: ScaleIdea[] }

/**
 * A passage of a song in another key than the chart says (the charts mark no key change): its
 * written bars and its tonic in semitones above the map's tonic, and whether it is minor.
 */
export interface KeyPassage { bars: [number, number]; tonic: number; minor?: boolean }

/** The scale map of a lesson song. */
export interface ScaleMap {
  song: string // the start of the song's title
  tonic: number // the song's key as written, a pitch class (the placeholders count from it)
  unit: string // the id of the unit whose idea it brings (program.ts; shown by unitName)
  idea: string // the unit's new idea, in a few lines
  sections: ScaleSection[]
  keys?: KeyPassage[] // where the song moves to another key, for the key's scales of the colours
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
const MINOR_KEY = "A minor ii-V-i takes its notes from the minor key's harmonic minor scale: Locrian with a natural 9th over the " +
  'ø7 (the ii), Mixolydian with a flat 9th and flat 13th over the V7, Dorian or melodic minor over the i. The b9 of the V wants ' +
  'to fall a half step to the 5th of the i: aim your lines there.'
const MINOR_BLUES = "The minor blues plays the key's minor pentatonic and blues scale over every chord, as the blues does, and now " +
  'nothing rubs: they are the notes of the minor key. Then follow the chords: Dorian over the i−7 and iv−7, Mixolydian over ' +
  'the ♭VI7, and the b9 and b13 over the V7.'
const MODES = 'A modal tune stays on one chord for many bars: play its mode (Dorian over a minor 7th) and make phrases, not ' +
  'runs. The minor pentatonic a 5th above the chord (A minor pentatonic over Dm7) gives an open, modern sound.'

export const SCALE_MAPS: ScaleMap[] = [
  {
    song: 'Avalon', tonic: 5, unit: 'u1', idea: PENTATONIC,
    sections: [
      { label: 'A (bars 1 to 17)', bars: [0, 16], ideas: [
        { scale: '{0} major pentatonic', over: 'the whole part', why: 'The key of the song: its five notes fit {7}7, {0} and {2}-7.' },
        { scale: '{7}7 chord tones ({7} {11} {2} {5})', over: 'the {7}7 bars', why: 'The V7 leads home: its 3rd ({11}) wants to rise to {0}.' },
      ] },
      { label: 'B (bars 18 to 25)', bars: [17, 24], ideas: [
        { scale: '{9}7 chord tones ({9} {1.0} {4} {7})', over: 'the {9}7 bars', why: "The pentatonic's {0} clashes with the chord's 3rd ({1.0}): play the chord's notes instead." },
        { scale: '{0} major pentatonic', over: 'the {2}- bars', why: '{2} minor is the ii of {0}: the pentatonic fits it again.' },
      ] },
      { label: 'C (bars 26 to 33)', bars: [25, 32], ideas: [
        { scale: '{0} major pentatonic', over: 'the whole part', why: 'The key again; over {9}7, stay on its chord tones as before.' },
      ] },
    ],
  },
  {
    song: 'Study Blues', tonic: 5, unit: 'u2', idea: BLUES,
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
    song: 'Tin Roof Blues', tonic: 3, unit: 'u2', idea: BLUES,
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
    song: 'Oh Lady Be Good', tonic: 7, unit: 'u3', idea: II_V_I,
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
    song: 'Honeysuckle Rose', tonic: 5, unit: 'u3', idea: II_V_I,
    keys: [{ bars: [10, 13], tonic: 5 }], // the bridge visits the IV
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
    song: 'Just You, Just Me', tonic: 0, unit: 'u4', idea: V_TO_MINOR,
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
    song: 'I Got Rhythm', tonic: 10, unit: 'u4', idea: V_TO_MINOR,
    keys: [{ bars: [0, 15], tonic: 9, minor: true }, // the verse, in the relative minor
      { bars: [44, 46], tonic: 9 }, { bars: [47, 48], tonic: 2 }, { bars: [49, 51], tonic: 7 }], // the bridge's chain of V7s
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
    song: 'What Is This Thing Called Love', tonic: 0, unit: 'u4', idea: V_TO_MINOR,
    keys: [{ bars: [1, 4], tonic: 5, minor: true }, { bars: [9, 12], tonic: 5, minor: true }, // each A starts in the IV's minor
      { bars: [17, 20], tonic: 10 }, { bars: [25, 28], tonic: 5, minor: true }], // the bridge's ii-V-I a step down
    sections: [
      { label: 'A (bars 2 to 17)', bars: [0, 16], ideas: [
        { scale: '{5} harmonic minor (= {0} Mixolydian b9 b13)', over: '{7}ø7 {0}7b9 {5}-6', why: 'A minor ii-V-i in {5} minor: the {0}7b9 goes to a minor chord.' },
        { scale: '{7} Mixolydian b9 b13', over: '{2}ø7 {7}7#5', why: 'The same dark V, which then resolves to major...' },
        { scale: '{0} major pentatonic', over: '{0}^7', why: '...the surprise of the song: major where minor was expected.' },
      ] },
      { label: 'Bridge (bars 18 to 25)', bars: [17, 24], ideas: [
        { scale: '{10} major scale', over: '{0}-7 {5}7 {10}^7', why: 'A ii-V-I in {10}: one major scale for the three chords.' },
        { scale: '{8} Mixolydian', over: '{8}7', why: "A dominant chord a step down: its own scale." },
      ] },
      { label: 'A (bars 26 to 33)', bars: [25, 32], ideas: [
        { scale: '{5} harmonic minor, then {0} major pentatonic', over: 'as in the first A', why: 'The same moves.' },
      ] },
    ],
  },
  {
    song: 'Love Me Or Leave Me', tonic: 0, unit: 'uMinor', idea: MINOR_KEY,
    keys: [{ bars: [0, 3], tonic: 9, minor: true }, { bars: [7, 11], tonic: 9, minor: true }, // the A sections start in the relative minor
      { bars: [16, 19], tonic: 2, minor: true }, { bars: [23, 27], tonic: 9, minor: true }], // the bridge visits the ii's minor
    sections: [
      { label: 'A (bars 1 to 16)', bars: [0, 15], ideas: [
        { scale: '{9} harmonic minor (= {4} Mixolydian b9 b13)', over: '{11}ø7 {4}7 {9}-7', why: 'A minor ii-V-i in {9} minor: one scale for the three chords.' },
        { scale: '{9} minor pentatonic', over: 'the {9}-7 bars', why: 'The minor pentatonic of the i: no note to avoid.' },
        { scale: '{0} major pentatonic', over: '{0}^7 {9}-6 {7}7', why: 'The relative major: the same notes, another home.' },
      ] },
      { label: 'Bridge (bars 17 to 24)', bars: [16, 23], ideas: [
        { scale: '{2} harmonic minor (= {9} Mixolydian b9 b13)', over: '{9}7 {9}7#5 {2}-7', why: 'The V7 of {2} minor, with its #5 (b13) written.' },
        { scale: '{7} Mixolydian', over: '{7}7', why: 'A V7 going to a major chord: its plain scale.' },
      ] },
      { label: 'A (bars 25 to 34)', bars: [24, 33], ideas: [
        { scale: '{9} harmonic minor, then {0} major pentatonic', over: 'as in the first A', why: 'The same moves.' },
        { scale: '{5} melodic minor', over: '{5}-6 in the last bar', why: 'The iv minor before the last {0}: a darker colour on the way home.' },
      ] },
    ],
  },
  {
    song: 'Minor Study Blues', tonic: 0, unit: 'uMinorBlues', idea: MINOR_BLUES,
    keys: [{ bars: [0, 11], tonic: 0, minor: true }],
    sections: [
      { label: 'Bars 1 to 8 (i and iv)', bars: [0, 7], ideas: [
        { scale: '{0} minor pentatonic or blues scale', over: 'the whole part', why: 'The notes of the minor key: they fit {0}-7 and {5}-7.' },
        { scale: '{0} Dorian, then {5} Dorian', over: '{0}-7, then {5}-7', why: 'Each minor 7th chord, its own mode.' },
      ] },
      { label: 'Bars 9 to 12 (turnaround)', bars: [8, 11], ideas: [
        { scale: '{8} Mixolydian', over: '{8}7', why: 'The ♭VI7: a dominant that falls a half step to the V.' },
        { scale: '{7} Mixolydian b9 b13 (= {0} harmonic minor)', over: '{7}7b9b13 and {2}ø7', why: 'The minor ii-V: aim the b9 ({8}) down to {7}, the 5th of {0}-7.' },
      ] },
    ],
  },
  {
    song: 'Black And Tan Fantasy', tonic: 1, unit: 'uMinorBlues', idea: MINOR_BLUES,
    keys: [{ bars: [0, 12], tonic: 9, minor: true }, { bars: [13, 27], tonic: 9 }], // a blues in Bb minor, then a strain in Bb major
    sections: [
      { label: 'Minor blues (bars 1 to 13)', bars: [0, 12], ideas: [
        { scale: '{9} minor pentatonic or blues scale', over: 'the whole blues', why: 'The minor blues in {9} minor: the notes of the key.' },
        { scale: '{9} Dorian, then {2} Dorian', over: '{9}-7, then {2}-7', why: 'The i and the iv, each its own mode.' },
        { scale: '{4} Mixolydian b9 b13', over: '{4}7', why: 'The V7 going to the minor i.' },
      ] },
      { label: 'Second strain (bars 14 to 28)', bars: [13, 27], ideas: [
        { scale: '{9} major pentatonic', over: 'the {9} bars', why: 'The tune turns to {9} major.' },
        { scale: 'Mixolydian of each', over: '{9}7 {2}7 {7}7 {0}7 {5}7', why: 'A cycle of dominants, each a 5th above the next.' },
      ] },
    ],
  },
  {
    song: 'Embraceable You', tonic: 7, unit: 'u5', idea: PER_CHORD,
    keys: [{ bars: [9, 13], tonic: 7 }, { bars: [22, 24], tonic: 5 }], // the key of the V, then of the IV
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
    song: "'S Wonderful", tonic: 3, unit: 'u5', idea: PER_CHORD,
    keys: [{ bars: [16, 19], tonic: 4 }], // the bridge, a major 3rd up
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
    song: 'Tea for two', tonic: 5, unit: 'u5', idea: PER_CHORD,
    keys: [{ bars: [8, 14], tonic: 4 }, { bars: [22, 26], tonic: 2, minor: true }], // a major 3rd up, then the ii's minor
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
    song: 'Modal Study', tonic: 2, unit: 'u6', idea: MODES,
    keys: [{ bars: [0, 15], tonic: 0, minor: true }, { bars: [16, 23], tonic: 1, minor: true }, { bars: [24, 31], tonic: 0, minor: true }],
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
  return spellOnLetter((pitchClassOf(tonic) + step) % 12, NOTE_LETTERS[(NOTE_LETTERS.indexOf(tonic[0]) + letters) % 7])
}

/**
 * The key of each written bar for the colours: the chart's own (barKeyCentres), except where a
 * lesson song's map says the song moves to another key.
 */
export function keysWithPassages(chartKeys: readonly KeyCentre[], map: ScaleMap | undefined): KeyCentre[] {
  return chartKeys.map((key, bar) => {
    const passage = map?.keys?.find((p) => bar >= p.bars[0] && bar <= p.bars[1])
    return passage ? { tonic: (map!.tonic + passage.tonic) % 12, minor: !!passage.minor } : key
  })
}

/** The section of a map that holds a written bar, if any. */
export function sectionAt(map: ScaleMap, bar: number): ScaleSection | undefined {
  return map.sections.find((section) => bar >= section.bars[0] && bar <= section.bars[1])
}
