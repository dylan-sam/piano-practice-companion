// The music theory shown on a lesson step's page (LessonStepPage.tsx), before its exercise: short
// cards on the scale, chord, progression or way of working the step practises, each with a picture
// (a staff written in ABC notation, or a progression's chords with their Roman numerals) and the
// book it comes from. A step gets the cards whose `match` fits its title, text, kind or link, at
// most MAX_CARDS, the most specific first: progressions and substitutions, scales, the song's
// left-hand pattern, chords and voicings, then ways of working. Examples are written in C; the
// page draws them in the key chosen (theoryMusic.ts).

import type { SubstitutionId } from '../music/substitutions'
import { chordLabel, parseChord, prettyNoteName, transposeChord } from '../music/chords'
import { placeOf, type LessonStep } from './program'
import { FRAMES, type Frame, type FrameBars } from './introEndings'

/** A progression drawn as chord boxes, each with its Roman numeral under it. */
export interface ProgressionPicture { chords: string[]; numerals: string[] }

export interface TheoryCard {
  id: string
  title: string
  text: string[] // paragraphs
  abc?: string // a staff (ABC notation, one tune), drawn by abcjs
  progression?: ProgressionPicture
  source?: string // the book or page it comes from
  match: (step: LessonStep) => boolean
}

export const MAX_CARDS = 3

/** Whether a step's title has one of some words (case ignored). */
const titled = (...words: string[]) => (step: LessonStep) => words.some((word) => step.title.toLowerCase().includes(word.toLowerCase()))
/** Whether a step's band plays a substitution. */
const playsSub = (id: SubstitutionId) => (step: LessonStep) => !!step.link?.subs?.includes(id)
/** Whether a step's title or text has one of some words (case ignored). */
const mentions = (...words: string[]) => (step: LessonStep) =>
  words.some((word) => `${step.title} ${step.what}`.toLowerCase().includes(word.toLowerCase()))

/**
 * The card of a song's left-hand pattern (data/left_hand_patterns.json), on the steps that play it:
 * the song at stage 3 and the step that listens to it.
 */
function pattern(id: string, title: string, text: string, abc: string): TheoryCard {
  return {
    id: `pattern-${id}`, title: `The left hand: ${title.charAt(0).toLowerCase()}${title.slice(1)}`, text: [text], abc, source: SISKIND,
    match: (step) => step.link?.pattern === id && (step.kind === 'song' || step.kind === 'listen'),
  }
}

/** Bars written in a song's key ("Eb C7"), written in C instead (the pictures are drawn from C). */
function barsInC(bars: string[], key: number): string[] {
  return bars.map((bar) => bar.split(/\s+/).map((text) => {
    const chord = parseChord(text)
    return chord ? chordLabel(transposeChord(chord, -key), true) : text
  }).join(' '))
}

/**
 * The two cards of a song's intro and ending (introEndings.ts): the bars with their Roman
 * numerals, how to build them, and an example written out, on the step that frames the song.
 */
function frameCards(id: string, frame: Frame): TheoryCard[] {
  const where = frame.key ? ` The pictures are in C; choose ${prettyNoteName(frame.key)} in the key menu above to see them in the key of the song.` : ''
  /** One card: the intro or the ending. */
  const card = (part: 'intro' | 'ending', bars: FrameBars): TheoryCard => ({
    id: `${part}-${id}`, title: part === 'intro' ? `The intro, ${bars.bars.length} bars` : `The ending, ${bars.bars.length} bars`,
    text: [bars.example.text + where], // the step's own text already says how to build it
    progression: { chords: barsInC(bars.bars, frame.key), numerals: bars.numerals }, abc: bars.example.abc, source: LEVINE,
    match: (step) => step.link?.frame === id,
  })
  return [card('intro', frame.intro), card('ending', frame.ending)]
}

/** A staff of one line in C, quarter notes, with a chord symbol over it. */
const staff = (body: string, length = '1/4') => `X:1\nL:${length}\nK:C\n${body}`

const LEVINE = 'Mark Levine, The Jazz Piano Book (1989)'
const LEVINE_THEORY = 'Mark Levine, The Jazz Theory Book (1995)'
const OMT = 'Open Music Theory (viva.pressbooks.pub/openmusictheory)'
const SISKIND = 'Jeremy Siskind, Jazz Piano Fundamentals and Playing Solo Jazz Piano'
const AEBERSOLD = 'Jamey Aebersold, How to Play Jazz and Improvise (Volume 1)'

export const THEORY: TheoryCard[] = [
  // ---------- Progressions ----------
  {
    id: 'iiVI', title: 'The ii-V-I', match: (step) => /ii-V-I in all keys|ii-V-I shells/.test(step.title),
    text: ['The ii-V-I is the most common progression in jazz: the minor 7th chord on the 2nd degree of the key, the dominant 7th on the 5th degree, then the tonic. Each root falls a 5th to the next (D, G, C in the key of C).',
      'Its guide tones move by a half step or stay where they are: the 7th of D−7 (C) falls to the 3rd of G7 (B), and the 7th of G7 (F) falls to the 3rd of Cmaj7 (E). This smooth movement is what makes the progression sound so natural.'],
    progression: { chords: ['D−7', 'G7', 'Cmaj7'], numerals: ['ii', 'V7', 'I'] },
    abc: staff('"D-7"F4 | "G7"F4 | "Cmaj7"E4 |]\nw: 3rd 7th 3rd', '1/4'), source: LEVINE_THEORY,
  },
  {
    id: 'minorIIVI', title: 'The minor ii-V-i', match: titled('Minor ii-V'),
    text: ['In a minor key, the ii chord is half-diminished and the V chord takes the ♭9 (and often the ♭13) from the minor key: in C minor, Dø7 G7♭9 C−6.',
      'A good line aims for the ♭9 of the V (A♭ over G7♭9) and lets it fall a half step onto the 5th of the i (G).'],
    progression: { chords: ['Dø7', 'G7♭9', 'C−6'], numerals: ['iiø7', 'V7♭9', 'i'] }, source: LEVINE_THEORY,
  },
  {
    id: 'blues12', title: 'The 12-bar jazz blues', match: titled('Jazz blues'),
    text: ['The 12-bar blues has three lines of four bars. The first line stays on the I7 (with the IV7 in bar 2), the second goes to the IV7 for two bars and back to the I7, and the third is a ii-V-I followed by a turnaround.',
      'Every chord of a blues is a dominant 7th chord, even the I: the blues lives between major and minor.'],
    progression: { chords: ['F7', 'B♭7', 'F7', 'F7', 'B♭7', 'B♭7', 'F7', 'D7', 'G−7', 'C7', 'F7 D7', 'G−7 C7'],
      numerals: ['I7', 'IV7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'VI7', 'ii', 'V7', 'I VI', 'ii V'] }, source: AEBERSOLD,
  },
  {
    id: 'minorBlues', title: 'The minor blues', match: (step) => step.title.startsWith('Minor blues') || step.title.includes('minor blues'),
    text: ['A minor blues has twelve bars in a minor key: the i−7 for four bars, the iv−7 for two, the i−7 for two, then the ♭VI7 and the V7, back to the i, and a minor ii-V to turn around.',
      'The minor pentatonic and blues scale of the key fit every chord. To follow the chords more closely, play Dorian over the minor chords and the ♭9 over the V7.'],
    progression: { chords: ['C−7', 'F−7', 'C−7', 'C−7', 'F−7', 'F−7', 'C−7', 'C−7', 'A♭7', 'G7♭9♭13', 'C−7', 'Dø7 G7'],
      numerals: ['i', 'iv', 'i', 'i', 'iv', 'iv', 'i', 'i', '♭VI7', 'V7', 'i', 'iiø V'] }, source: 'Kerry Politzer, Beginning Jazz Piano',
  },
  {
    id: 'turnaround', title: 'The turnaround', match: (step) => /I-vi-ii-V|I-VI7-ii-V|iii-VI-ii-V/.test(step.title),
    text: ['A turnaround is a two-bar progression that leads back to the top of a song: I vi ii V, or iii VI ii V. Each chord falls a 5th to the next one.',
      'The vi and the iii can be turned into dominant chords (VI7, III7) to pull harder towards the next chord: these are secondary dominants.'],
    progression: { chords: ['Cmaj7', 'A−7', 'D−7', 'G7'], numerals: ['I', 'vi', 'ii', 'V7'] }, source: LEVINE_THEORY,
  },
  {
    id: 'rhythmChanges', title: 'Rhythm Changes', match: titled('Rhythm changes'),
    text: ['Rhythm Changes are the chords of George Gershwin\'s I Got Rhythm, the most played form in jazz after the blues. Its A section is a string of turnarounds: I vi ii V, iii VI ii V, then I I7 IV ♯iv° and a last turnaround.'],
    progression: { chords: ['B♭ G−7', 'C−7 F7', 'D−7 G7', 'C−7 F7', 'B♭ B♭7', 'E♭ E°7', 'D−7 G7', 'C−7 F7'],
      numerals: ['I vi', 'ii V', 'iii VI', 'ii V', 'I I7', 'IV ♯iv°', 'iii VI', 'ii V'] }, source: LEVINE_THEORY,
  },
  // ---------- Substitutions ----------
  {
    id: 'addII', title: 'Adding the ii before a long V7', match: (step) => playsSub('addII')(step) || step.title.startsWith('V7 with its ii added'),
    text: ['A V7 chord that lasts two bars or more can share its time with its own ii chord, the minor 7th chord built a 5th above its root. Two bars of G7 become a bar of D−7 and a bar of G7; four bars of G7 become two of each. The song gains a ii-V without losing its sound, because the ii simply prepares the V.',
      'Each box below is one bar: first the chords as written, then the same two bars with the ii added. Listen to both and hear how the ii makes the V sound like an arrival.'],
    progression: { chords: ['G7', 'G7', '→', 'D−7', 'G7'], numerals: ['V7', 'V7', '', 'ii', 'V7'] }, source: LEVINE_THEORY,
  },
  {
    id: 'secondary', title: 'Secondary dominants', match: (step) => playsSub('secondary')(step) || step.title.includes('secondary dominants'),
    text: ['Any chord can be preceded by its own dominant. In C, D−7 can become D7, which is the V7 of G7: the ii-V-I becomes II7 V7 I, with a stronger pull towards the V.',
      'In a turnaround, I vi ii V becomes I VI7 II7 V7: a chain of dominants, each one resolving to the next.'],
    progression: { chords: ['C', 'A7', 'D7', 'G7'], numerals: ['I', 'VI7 (V7/ii)', 'II7 (V7/V)', 'V7'] }, source: `${OMT}, applied chords`,
  },
  {
    id: 'tritone', title: 'The tritone substitution', match: (step) => playsSub('tritone')(step) || step.title.includes('tritone substitution'),
    text: ['A dominant 7th chord can be replaced by the dominant 7th a tritone away: G7 by D♭7. The two chords share their 3rd and 7th (B and F; D♭7 spells them C♭ and F), so the guide tones resolve in the same way, while the bass now slides down by half steps (D, D♭, C).'],
    progression: { chords: ['D−7', 'D♭7', 'Cmaj7'], numerals: ['ii', '♭II7', 'I'] },
    abc: staff('"G7"[FB]2 "Db7"[F_c]2 | "Cmaj7"[EB]4 |]'), source: `${LEVINE}, ch. 6`,
  },
  {
    id: 'passingDim', title: 'The passing diminished chord', match: (step) => playsSub('passingDim')(step) || step.title.includes('passing diminished'),
    text: ['A diminished 7th chord a half step below a minor chord leads up into it: C C♯°7 D−7. C♯°7 is in fact A7♭9 without its root, a dominant of D−7 in disguise.',
      'It can also replace the vi of I vi ii V (C C♯°7 D−7 G7), as in many versions of Rhythm Changes.'],
    progression: { chords: ['C', 'C♯°7', 'D−7', 'G7'], numerals: ['I', '♯I°7', 'ii', 'V7'] }, source: `${OMT}, embellishing diminished chords`,
  },
  {
    id: 'alteredDominant', title: 'Altered dominants', match: (step) => playsSub('altered')(step) || /V7♭9/.test(step.title) || step.title.includes('with alterations'),
    text: ['A dominant chord going to its I can take a ♭9, and also a ♭13 when it goes to a minor chord: G7♭9 to C, G7♭9♭13 to C minor. These notes sit a half step away from notes of the next chord and resolve onto them, which adds tension and release.',
      'In rootless voicings, the ♭9 takes the place of the 9th and the ♭13 the place of the 13th.'],
    progression: { chords: ['D−7', 'G7♭9', 'Cmaj7'], numerals: ['ii', 'V7♭9', 'I'] }, source: `${LEVINE}, ch. 8`,
  },
  // ---------- Scales ----------
  {
    id: 'major', title: 'The major scale (Ionian)', match: titled('Ionian'),
    text: ['The major scale has seven notes, separated by the steps whole, whole, half, whole, whole, whole, half. On C it uses only the white keys. Its 1st, 3rd, 5th and 7th notes form the major 7th chord (C E G B), which is why the scale fits that chord.',
      'One note needs care: the 4th (F over Cmaj7) rubs against the 3rd of the chord. Use it as a passing note on the way to E or G rather than holding it.'],
    abc: staff('"Cmaj7"C D E F | G A B c |]'), source: LEVINE_THEORY,
  },
  {
    id: 'dorian', title: 'Dorian: the scale of the minor 7th chord', match: mentions('Dorian'),
    text: ['Dorian is a minor scale with a natural 6th: on C, it is C D E♭ F G A B♭. It has exactly the notes of the B♭ major scale, started from its 2nd note. This is why it fits the ii chord of a key so well: over D−7 in the key of C, Dorian uses only the notes of C major.',
      'Its 6th (A over C−7) is the note that gives the minor 7th chord its jazz colour. Dorian is the scale of the ii in a ii-V-I, and of the long minor chords in modal tunes such as So What.'],
    abc: staff('"C-7"C D _E F | G A _B c |]'), source: LEVINE_THEORY,
  },
  {
    id: 'mixolydian', title: 'Mixolydian: the scale of the dominant 7th chord', match: mentions('Mixolydian'),
    text: ['Mixolydian is the major scale with a flat 7th: on C, it is C D E F G A B♭. It has the notes of the F major scale started from its 5th note, and it contains the whole dominant 7th chord (C E G B♭).',
      'Over a V7 chord that goes to a major chord, Mixolydian is the simplest choice. As in the major scale, the 4th (F over C7) is best used as a passing note rather than held.'],
    abc: staff('"C7"C D E F | G A _B c |]'), source: LEVINE_THEORY,
  },
  {
    id: 'blues', title: 'The blues scale', match: mentions('Blues scale', 'Blues licks'),
    text: ['The blues scale has six notes: the minor pentatonic with one extra note, the flat 5th, called the "blue note". On C, it is C E♭ F G♭ G B♭.',
      'Over a whole blues, the scale of the key works on every chord. Its minor 3rd (E♭) against the major 3rd of the chords (E) is the very sound of the blues. Slide from E♭ to E as singers bend their notes, and use G♭ as a passing note between F and G.'],
    abc: staff('"C7"C _E F _G | =G _B c2 |]'), source: AEBERSOLD,
  },
  {
    id: 'minorPentatonic', title: 'The minor pentatonic scale', match: mentions('pentatonic'),
    text: ['The minor pentatonic scale has five notes and no half steps between them: on C, it is C E♭ F G B♭ (the 1st, ♭3rd, 4th, 5th and ♭7th degrees). Because there are no half steps, none of its notes clash with each other.',
      'Over a minor 7th chord every note of the scale fits. Over a blues, it is the blues scale without its blue note. The major pentatonic (C D E G A) has the same shape started from the 6th note of the major scale.'],
    abc: staff('"C-7"C _E F G | _B c2 z |]'), source: AEBERSOLD,
  },
  {
    id: 'harmonicMinor', title: 'The harmonic minor scale', match: titled('Harmonic minor'),
    text: ['The harmonic minor scale is the natural minor scale with its 7th degree raised by a half step: on C, it is C D E♭ F G A♭ B. The raised 7th (B) is the leading tone, a half step below the tonic, and it gives the V chord of a minor key its major 3rd (G B D F).',
      'The chords of the minor ii-V-i come from this scale: Locrian ♮2 is used over the half-diminished ii, and the scale\'s fifth mode, Phrygian dominant, over the V7.'],
    abc: staff('"C-maj7"C D _E F | G _A =B c |]'), source: LEVINE_THEORY,
  },
  {
    id: 'phrygianDominant', title: 'Phrygian dominant: the V7 of a minor key', match: titled('Phrygian dominant'),
    text: ['Phrygian dominant is the fifth mode of the harmonic minor scale. Over C7♭9 it is C D♭ E F G A♭ B♭: Mixolydian with a flat 9th and a flat 13th.',
      'The ♭9 (D♭) and the ♭13 (A♭) are notes of the minor key the V7 goes to (F minor). That is why they sound so natural before the i chord: the ♭9 falls a half step onto the 5th of the i.'],
    abc: staff('"C7b9"C _D E F | G _A _B c |]'), source: LEVINE_THEORY,
  },
  {
    id: 'locrian2', title: 'Locrian ♮2: the scale of the half-diminished chord', match: titled('Locrian'),
    text: ['Over Cø7 (C E♭ G♭ B♭), the scale is C D E♭ F G♭ A♭ B♭: the Locrian mode with a natural 9th instead of a flat one. It is the sixth mode of the melodic minor scale (here E♭ melodic minor).',
      'It is the scale of the ii chord in a minor ii-V-i. Its natural 9th (D) is the colour note that makes it sound less dark than plain Locrian.'],
    abc: staff('"Cm7b5"C D _E F | _G _A _B c |]'), source: LEVINE_THEORY,
  },
  {
    id: 'halfWhole', title: 'The half-whole diminished scale', match: titled('Half-whole'),
    text: ['The half-whole diminished scale has eight notes, alternating a half step and a whole step: on C, it is C D♭ E♭ E F♯ G A B♭. It contains the ♭9, the ♯9, the ♯11 and the natural 13th of a dominant chord.',
      'Use it over a 7♭9 chord that goes to a major chord, or over a dominant chord with a 13th written in the chart.'],
    abc: staff('"C7b9"C _D _E =E | ^F G A _B | c4 |]'), source: LEVINE_THEORY,
  },
  {
    id: 'altered', title: 'The altered scale', match: titled('Altered scale'),
    text: ['The altered scale contains every alteration of a dominant chord. Over C7alt it is C D♭ D♯ E F♯ G♯ B♭: the ♭9, the ♯9, the 3rd, the ♯11, the ♭13 and the ♭7. It has the same notes as the melodic minor scale a half step above the root (D♭ melodic minor).',
      'It is the most tension a V7 can hold before it resolves. Aim each altered note at a note of the next chord a half step away, so that the tension is released.'],
    abc: staff('"C7alt"C _D ^D E | ^F ^G _B c |]'), source: LEVINE_THEORY,
  },
  // ---------- Left-hand patterns of the songs ----------
  pattern('open_fifths', 'The open 5th', 'The root and the 5th together, on beats 1 and 3. Without the 3rd, the chord is neither major nor minor; the melody and the band complete it.',
    'X:1\nL:1/4\nK:C clef=bass\n"C7"[C,G,]2 [C,G,]2 | "F7"[F,,C,]2 [F,,C,]2 |]'),
  pattern('charleston', 'The Charleston rhythm', 'The chord on beat 1, held for a beat and a half, and again on the "and" of beat 2, then silence. Count "1 (2) and" out loud while you play.',
    'X:1\nL:1/8\nK:C clef=bass\n"C7"[E,_B,]3 [E,_B,] z4 | "F7"[E,A,]3 [E,A,] z4 |]'),
  pattern('walking_bass', 'The walking bass', 'One note on every beat. Start each bar on the root, use chord tones on the strong beats, and make the last note of the bar a half step away from the next root.',
    'X:1\nL:1/4\nK:C clef=bass\n"C7"C, E, G, E, | "F7"F, A, C B, | "C7"C4 |]'),
  pattern('type_a_shells', 'Type A shells', 'The root with the 3rd and the 7th above it, held on beat 1, then the 3rd and the 7th short on beat 3.',
    'X:1\nL:1/8\nK:C clef=bass\n"D-7"[D,F,C]4 [F,C] z3 | "G7"[G,,B,F]4 [B,F] z3 | "Cmaj7"[C,E,B,]4 [E,B,] z3 |]'),
  pattern('type_a_charleston', 'Type A shells in the Charleston rhythm', 'The whole shell on beat 1, then the 3rd and the 7th on the "and" of beat 2.',
    'X:1\nL:1/8\nK:C clef=bass\n"D-7"[D,F,C]3 [F,C] z4 | "G7"[G,,B,F]3 [B,F] z4 |]'),
  pattern('ragtime_bass', 'The ragtime (stride) bass', 'A low root on beat 1, the chord in the middle of the keyboard on beat 2, the 5th low on beat 3, the chord again on beat 4.',
    'X:1\nL:1/4\nK:C clef=bass\n"C"C,, [E,G,C] G,, [E,G,C] | "G7"G,, [F,B,D] D, [F,B,D] |]'),
  pattern('rootless_charleston', 'Rootless voicings in the Charleston rhythm', 'Four notes without the root, on beat 1 and on the "and" of beat 2. The bass player plays the roots.',
    'X:1\nL:1/8\nK:C clef=bass\n"D-7"[F,A,CE]3 [F,A,CE] z4 | "G7"[F,A,B,E]3 [F,A,B,E] z4 | "Cmaj7"[E,G,B,D]3 [E,G,B,D] z4 |]'),
  pattern('rootless_held', 'Held rootless voicings', 'Four notes without the root, each held for two beats while the bass plays the roots.',
    'X:1\nL:1/8\nK:C clef=bass\n"D-7"[F,A,CE]4 "G7"[F,A,B,E]4 | "Cmaj7"[E,G,B,D]8 |]'),
  pattern('bossa_bass', 'The bossa nova bass', 'The root held from beat 1, then the 5th just before beat 3, tied over: the gentle rocking of the bossa.',
    'X:1\nL:1/8\nK:C clef=bass\n"Cmaj7"C,3 G,,- G,,4 | "D-7"D,3 A,,- A,,4 |]'),
  pattern('fourths_from_ninth', 'Fourth chords from the 9th', 'Three notes in 4ths starting on the 9th of the chord, held for the bar: E A D over D−7, F B♭ E♭ over E♭−7.',
    'X:1\nL:1/1\nK:C\n"D-7"[EAd] | "Eb-7"[F_B_e] |]'),
  // ---------- Chords and voicings ----------
  {
    id: 'triads', title: 'Triads', match: mentions('triads', 'root, the 3rd and the 5th'),
    text: ['A triad is three notes stacked in 3rds. A major triad has a major 3rd at the bottom and a minor 3rd on top (C E G); a minor triad has a minor 3rd at the bottom and a major 3rd on top (C E♭ G). Only the middle note, the 3rd, is different.',
      'Moving a triad by half steps or by 4ths through all twelve keys trains your hands to find every chord without having to think about it.'],
    abc: staff('"C"[CEG] "Db"[_DF_A] "D"[D^FA] "Eb"[_EG_B] | "C-"[C_EG] "C#-"[^CE^G] "D-"[DFA] "Eb-"[_E_G_B] |]'), source: OMT,
  },
  {
    id: 'seventh', title: 'Seventh chords around the circle of 4ths', match: titled('7th chords in fourths', 'Dominant 7th chords'),
    text: ['A seventh chord adds another 3rd on top of a triad. C7, the dominant 7th chord, is a major triad with a minor 7th: C E G B♭. Cmaj7 has a major 7th (B), and C−7 is a minor triad with a minor 7th (C E♭ G B♭).',
      'Moving up by 4ths (C7, F7, B♭7 and so on) follows the most common root movement in jazz: each chord acts as the V7 of the next one, like a chain of resolutions.'],
    abc: staff('"C7"[CEG_B] "F7"[FAc_e] "Bb7"[_B,DF_A] "Eb7"[_EG_B_d] |]'), source: LEVINE_THEORY,
  },
  {
    id: 'halfDiminished', title: 'The half-diminished chord', match: titled('Half-diminished'),
    text: ['A half-diminished chord is a minor 7th chord with a flat 5th: Cø7 is C E♭ G♭ B♭ (it is also written Cm7♭5). It is called half-diminished because only its triad is diminished; a fully diminished 7th chord would also lower the 7th.',
      'It is the ii chord of a minor key: in C minor, the minor ii-V-i is Dø7 G7 C−.'],
    abc: staff('"Cm7b5"[C_E_G_B] "Fm7b5"[F_A_c_e] "Bbm7b5"[_B,_D_F_A] |]'), source: LEVINE_THEORY,
  },
  {
    id: 'shells', title: 'Shell voicings', match: mentions('Shells', 'shells'),
    text: ['A shell voicing is the root of the chord with its 3rd or its 7th: the notes that say what kind of chord it is. Through a ii-V-I the shells alternate so that the hand hardly moves: D−7 with the root and the 7th, G7 with the root and the 3rd, Cmaj7 with the root and the 7th again.',
      'With the chord reduced to its essentials, the right hand is free for the melody or for a solo.'],
    abc: 'X:1\nL:1/2\nK:C clef=bass\n"D-7"[D,C]2 | "G7"[G,,B,,]2 | "Cmaj7"[C,B,]2 |]', source: SISKIND,
  },
  {
    id: 'rootless', title: 'Rootless voicings', match: titled('Rootless'),
    text: ['A rootless voicing has four notes and leaves out the root, which the bass player plays. It keeps the 3rd and the 7th and adds colour notes: the 9th and the 5th or the 13th. In position A the 3rd is at the bottom; in position B the 7th is at the bottom.',
      'Through a ii-V-I the positions alternate A, B, A, and each note moves by a step at most: D−7 is F A C E, G7 is F A B E, Cmaj7 is E G B D. On an altered dominant, the ♭9 and the ♭13 replace the 9th and the 13th (G7♭9♭13 is F A♭ B E♭).'],
    abc: staff('"D-7"[FAce] "G7"[FABe] "Cmaj7"[EGBd] "G7b9b13"[F_AB_e] |]', '1/2'), source: `${LEVINE}, ch. 7 and 8`,
  },
  {
    id: 'twoHands', title: 'Two-hand voicings', match: titled('Two-hand voicings', 'Bossa comping'),
    text: ['The left hand plays a shell (the root and the 7th, or the root and the 3rd), and the right hand adds the guide tone the left hand left out, with colour notes on top: the 5th, the 9th or the 13th. Together the two hands sound like the full chords of a band\'s pianist.'],
    abc: 'X:1\nL:1/2\n%%staves {RH LH}\nV:RH clef=treble\nV:LH clef=bass\n[V:RH]"D-7"[FAe]2 | "G7"[FBe]2 | "Cmaj7"[EGd]2 |]\n[V:LH][D,C]2 | [G,,F,]2 | [C,B,]2 |]',
    source: LEVINE,
  },
  {
    id: 'quartal', title: 'Quartal voicings', match: titled('Quartal'),
    text: ['Quartal voicings are chords built from 4ths instead of 3rds: over D−7, for example, D G C or E A D. They sound open and modern, and they are the sound of McCoy Tyner and of Bill Evans on So What.',
      'Moving the same shape up and down the Dorian scale colours a long minor chord without changing its harmony.'],
    abc: staff('"D-7"[DGc] [EAd] [FBe] [Gcf] |]', '1/2'), source: `${LEVINE}, the fourth chords`,
  },
  {
    id: 'arpeggios', title: 'Arpeggios: a chord one note at a time', match: titled('Arpeggios', 'chord tones in eighth notes', '1-3-5-7 up', '1-3-5-8 up'),
    text: ['An arpeggio plays the notes of a chord one after another, going up or down. Played through a progression, arpeggios put a chord tone on every beat, so the line spells out the changes.',
      'At the top of an arpeggio, turn round on the nearest note of the next chord rather than going back to its root: the line then flows from chord to chord.'],
    abc: staff('"D-7"D F A c "G7"B G F D | "Cmaj7"E G B d c4 |]', '1/8'), source: `${LEVINE_THEORY}; PianoFitness (github.com/PianoFitness/app)`,
  },
  {
    id: 'intervals', title: 'Intervals', match: titled('Major 3rds'),
    text: ['An interval is the distance between two notes. A major 3rd is four half steps (C to E), a minor 3rd three half steps (C to E♭). Practising major 3rds by half steps through the twelve keys trains your ear and your hand to find the 3rd of any chord at once.'],
    abc: staff('[CE] [_DF] [D^F] [_EG] | [E^G] [FA] [^F^A] [GB] |]'), source: OMT,
  },
  // ---------- Styles ----------
  {
    id: 'bossa', title: 'The bossa nova rhythm', match: (step) => step.link?.style === 'bossa-nova',
    text: ['Bossa nova came from Brazil in the late 1950s (João Gilberto, Antônio Carlos Jobim). Unlike swing, its eighth notes are straight: two even halves of the beat. The piano and the guitar repeat a two-bar rhythm that falls partly on the beat and partly between the beats, while the bass rocks gently between the root and the 5th.',
      'The staff shows the rhythm the band\'s piano plays. Bar 1: beat 1, the "and" of 2, beat 4. Bar 2: the "and" of 1, beat 3, the "and" of 4. Count the eighth notes "1 and 2 and 3 and 4 and" and clap only the written notes before you play them. Keep the chords short and soft: the bossa should whisper.'],
    abc: 'X:1\nL:1/8\nK:C\n"Cmaj7"[EGB]3 [EGB]3 [EGB]2 | z [EGB]3 [EGB]3 [EGB] | "D-7"[FAc]3 [FAc]3 [FAc]2 | z [FAc]3 [FAc]3 [FAc] |]\nw: 1 2& 4 1& 3 4& 1 2& 4 1& 3 4&', source: 'The band\'s Bossa Nova style; Mark Levine, The Jazz Piano Book, the bossa nova',
  },
  {
    id: 'ballad', title: 'Playing a ballad', match: (step) => step.link?.style === 'ballad',
    text: ['A ballad is a slow song, often a love song. With so few notes in each bar, every note is heard: play the melody as a singer would, connecting the notes and shaping each phrase so that it rises and falls.',
      'Let the left hand hold each voicing for its full length and use the sustain pedal lightly, lifting it at each new chord so the harmonies do not blur. In the long notes of the melody, count the beats inside you rather than rushing on to the next phrase.'],
    abc: staff('"Cmaj7"E4- | E2 D2 | "D-7"C4- | C2 "G7"B,2 |]'), source: SISKIND,
  },
  // ---------- Ways of working ----------
  {
    id: 'guideTones', title: 'Guide tones', match: mentions('guide tone'),
    text: ['The guide tones are the 3rd and the 7th of each chord: the notes that say whether a chord is major or minor, dominant or not. Played one per chord, they make a smooth line in which each note moves by a half step or stays where it is.',
      'A solo built on guide tones sounds the changes clearly even with very few notes, and it is the backbone you can decorate with other notes later.'],
    abc: staff('"D-7"F2 "G7"F2 | "Cmaj7"E4 | "D-7"c2 "G7"B2 | "Cmaj7"B4 |]'), source: 'Bert Ligon, Connecting Chords with Linear Harmony',
  },
  {
    id: 'eighths', title: 'Chord scales in eighth notes', match: titled('chord scales in eighth notes', 'Scale lines'),
    text: ['Play a line of eighth notes through the scale of each chord, starting each chord on one of its chord tones, on the beat. Swing the eighths: long-short, with the second note of each pair a little late and a little lighter.'],
    abc: staff('"D-7"D E F G A B c d | "G7"B A G F E D C B, |]', '1/8'), source: AEBERSOLD,
  },
  {
    id: 'offbeat', title: 'Swing and the off-beat', match: titled('Rhythm on'),
    text: ['Jazz eighth notes swing: long-short, like a triplet whose first two notes are tied together. The note on the "and" of the beat, the off-beat, is played a little late and is often accented: that is where jazz pushes forward.'],
    abc: staff('"C7"z c z c z c z c |]', '1/8'), source: AEBERSOLD,
  },
  {
    id: 'stages', title: 'A song in three stages', match: (step) => step.kind === 'song' && /stage \d/.test(step.title),
    text: ['Every song in this course is learnt with a left hand that grows in three stages. In stage 1 the left hand plays only the bass, the root of each chord. In stage 2 it plays the whole chord on each beat. In stage 3 it plays the song\'s own accompaniment pattern. The right hand plays the melody all the way through.',
      'Learn each stage slowly first; the tempo comes later, once the hands know where to go.'],
    abc: 'X:1\nL:1/4\nK:F clef=bass\n"G-7"G,, z D, z | "C7"C, z G,, z |]', source: SISKIND,
  },
  {
    id: 'licks', title: 'Learning licks', match: (step) => /\blicks?\b/i.test(step.title) || step.link?.route === '/sightreading/licks',
    text: ['A lick is a short phrase of the jazz language. Learn it slowly, then in other keys, then over other chords. Use it in a solo, and then change it a little: that is how a borrowed phrase becomes your own.',
      'Approach notes (a half step below or above a chord tone) and enclosures (the note above, the note below, then the target) are what make lines sound like jazz.'],
    abc: staff('"Cmaj7"^D E z2 | F ^D E z |]\nw: approach * enclosure', '1/4'), source: AEBERSOLD,
  },
  {
    id: 'improvise', title: 'Improvising over a song', match: (step) => step.kind === 'improvise',
    text: ['Start from the melody and from the tool of the week. Play little and leave space: one idea placed well is worth more than many notes.',
      'Every note you play is written on the sheet and coloured: chord tones in the ink colour, colour tones in green, approach tones in blue and outside notes in red. Look at the colours after each chorus to see what you played.'],
    source: 'Hal Crook, How to Improvise',
  },
  {
    id: 'ear', title: 'Training the ear', match: (step) => step.kind === 'ear',
    text: ['For a progression, listen to the bass first: in a ii-V-I it moves by 4ths, in a turnaround it falls by 5ths. Sing the tonic before you answer.',
      'For a melody, find the tonic first, then hear each note as a degree of the key (1, 3, 5 and so on). Singing a melody back before you write it is the surest way to remember it.'],
    source: OMT,
  },
  {
    id: 'listen', title: 'Listening first', match: (step) => step.kind === 'listen',
    text: ['Hear what you are going to play before you play it: the rhythm of the left hand and the places where the chords change. Sing or hum along with the bass line.'],
    source: SISKIND,
  },
  ...Object.entries(FRAMES).flatMap(([id, frame]) => frameCards(id, frame)),
  {
    id: 'introEnding', title: 'Intros and endings', match: (step) => !!step.link?.frame,
    text: ['An intro sets the key, the tempo and the feel, and leads into the first bar of the song; an ending tells everyone that the song is over. Most of them are a few bars of chords taken from the song itself, and four kinds cover most of what you will hear on records:',
      'The last bars of the song, played before the head (the easiest intro). A turnaround (I vi ii V), played once or twice. A vamp: one ii-V, usually the song\'s first, repeated until everyone is ready. A tag: the last ii-V of the song repeated two or three times before the final chord, often through iii VI ii V.',
      'Whatever the kind, keep the time steady, play little, and make the last bar of an intro lead clearly into the first note of the melody. On the final chord of an ending, add a colour note (the 6th or the 9th) and let it ring.'],
    source: LEVINE,
  },
  {
    id: 'record', title: 'Recording yourself', match: titled('Record'),
    text: ['Listen to your recording the next day, with fresh ears. Check that the form and the time held, and note one idea you liked and one thing to work on. Recording yourself is the quickest teacher there is.'],
  },
]

/** The theory cards of a step, the most specific first (at most MAX_CARDS). */
export function theoryFor(step: LessonStep): TheoryCard[] {
  return THEORY.filter((card) => card.match(step)).slice(0, MAX_CARDS)
}

/** A step's one-sentence summary: the first sentence of what it asks. */
export function summaryOf(step: LessonStep): string {
  const first = step.what.split('\n')[0].match(/^.*?[.!?](\s|$)/)
  return (first ? first[0] : step.what).trim()
}

/** The books and pages a step comes from: its unit's source, then its theory cards' (each once). */
export function referencesOf(step: LessonStep): string[] {
  const unit = placeOf(step)?.unit
  return [...new Set([unit?.source, ...theoryFor(step).map((card) => card.source)].filter((source): source is string => !!source))]
}
