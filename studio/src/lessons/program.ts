// The Lessons tab's program: 30 weeks of 20 to 30 minutes a day for a pianist new to jazz, in six
// units and a review (docs/LESSONS.md explains how it was built and where each idea comes from).
// Each week has the four parts of a session: hands together, the song, improvising and ear
// training. Every step says what to do, why, how long and when it is done, and opens the screen
// that practises it (lessonLink.ts). Nothing is locked.

import { ROUTES } from '../router'
import type { LessonLink } from './lessonLink'

/** The part of a session a step belongs to. */
export type StepKind = 'hands' | 'listen' | 'song' | 'improvise' | 'ear' | 'check'

export interface LessonStep {
  id: string // unique and stable: progress is kept by it
  kind: StepKind
  title: string
  what: string // what to do
  why: string // what it trains
  minutes: [number, number]
  done: string // when it is done: a target, never "mastered"
  link?: LessonLink // the screen that practises it
  goal?: Goal // a target the screen can check: the step is ticked when it is reached
  selfCheck?: string[] // what to tick for what the app cannot score
}

/**
 * A target a screen can check: this percent right, at this tempo or faster (0: any), through the
 * whole piece, and on time within `timingMs` on average when given.
 */
export interface Goal { percent: number; bpm: number; timingMs?: number }

export interface LessonWeek { week: number; steps: LessonStep[] }

export interface LessonUnit {
  id: string
  title: string
  weeks: string // e.g. "Weeks 1 to 4"
  goal: string
  source: string // where the unit's order and exercises come from
  weekList: LessonWeek[]
}

// How long each part of a session lasts, in minutes
const MINUTES: Record<StepKind, [number, number]> = {
  hands: [6, 8], listen: [2, 3], song: [10, 12], improvise: [4, 6], ear: [2, 4], check: [2, 5],
}

/** A song of the course, with the left-hand pattern learnt with it. */
interface CourseSong {
  title: string // as in the app's lead sheets
  style?: string // the band style the lessons play it in (else the song's own)
  pattern: string // piano pattern id (data/left_hand_patterns.json)
  patternText: string // the pattern in words
}

const SONGS = {
  avalon: { title: 'Avalon', pattern: 'two_feel', patternText: 'a two-feel: the root, then the 5th, in half notes' },
  studyBlues: { title: 'Study Blues', pattern: 'charleston', patternText: 'the Charleston rhythm: the chord on beat 1 and on the "and" of 2' },
  tinRoof: { title: 'Tin Roof Blues', pattern: 'walking_bass', patternText: 'a walking bass: quarter notes on chord tones, reaching the next root by a half step' },
  ladyBeGood: { title: 'Oh Lady Be Good', pattern: 'bass_shells', patternText: 'bass shells: root, 3rd and 7th (the 3rd under the 7th)' },
  honeysuckle: { title: 'Honeysuckle Rose', pattern: 'light_stride', patternText: 'light stride: a bass note on beats 1 and 3, a shell on 2 and 4' },
  justYou: { title: 'Just You, Just Me', pattern: 'shells_charleston', patternText: 'shells in the Charleston rhythm, with an anticipation on the "and" of 4' },
  gotRhythm: { title: 'I Got Rhythm', pattern: 'walking_bass', patternText: 'a walking bass through Rhythm Changes: roots and 5ths first' },
  thisThing: { title: 'What Is This Thing Called Love', pattern: 'two_note_shells', patternText: 'two-note shells: root and 7th, root and 10th' },
  embraceable: { title: 'Embraceable You', style: 'ballad', pattern: 'broken_tenths', patternText: 'a broken chord: root, 5th and 10th in eighth notes' },
  wonderful: { title: "'S Wonderful", style: 'bossa-nova', pattern: 'bossa_bass', patternText: 'a bossa bass: root and 5th in the bossa rhythm, with the chord' },
  teaForTwo: { title: 'Tea for two', style: 'bossa-nova', pattern: 'bossa_bass', patternText: 'the bossa bass' },
  modalStudy: { title: 'Modal Study', pattern: 'quartal_pad', patternText: 'a quartal pad: the chord in stacked 4ths, held' },
} satisfies Record<string, CourseSong>
type SongId = keyof typeof SONGS

// What each stage of the song routine asks of the left hand
const STAGES = {
  1: { name: 'stage 1, bass', what: 'Right hand: the melody. Left hand: the root of each chord on beat 1, then on beats 1 and 3.', leftHand: 'bass' },
  2: { name: 'stage 2, chords', what: 'Right hand: the melody. Left hand: the whole chord on every beat, in the closest inversion (the 5th may be left out).', leftHand: 'beats' },
  3: { name: 'stage 3, pattern', what: "Right hand: the melody. Left hand: the song's pattern, in the rhythm of the band's piano (muted, so you hear your own).", leftHand: 'pattern' },
} as const

const WHY = {
  hands: 'Both hands together on the same material builds the coordination the songs need.',
  listen: 'Hearing a pattern before playing it makes its rhythm easier to copy.',
  song: 'Each song is learnt with both hands, the left hand one stage at a time.',
  improvise: 'A few minutes of improvising every day, with one new tool per unit.',
  ear: 'Hearing progressions and melodies helps you play what you hear.',
  check: 'Some things are best checked by listening to yourself.',
}

/** Options of a step: its key (pitch class), tempo, target (with a timing in ms), and more of its link. */
interface StepOptions { key?: number; bpm?: number; done?: string; timing?: number; link?: Partial<LessonLink>; title?: string; what?: string }

/** A step's link carrying its goal, so the screen can tick it. */
function goalLink(link: LessonLink, step: string, goal: Goal): LessonLink {
  return { ...link, step, goal: goal.percent, ...(goal.bpm ? { bpm: goal.bpm } : {}), ...(goal.timingMs ? { timing: goal.timingMs } : {}) }
}

/**
 * A step with its id made from the week and a short name. A step with a goal sends it with its
 * link, so the screen can tick the step when the goal is reached.
 */
function step(week: number, name: string, kind: StepKind, title: string, what: string, done: string,
  link?: LessonLink, extra: { selfCheck?: string[]; goal?: Goal } = {}): LessonStep {
  const id = `w${week}-${name}`
  const { goal, selfCheck } = extra
  return {
    id, kind, title, what, why: WHY[kind], minutes: MINUTES[kind], done,
    ...(link ? { link: goal ? goalLink(link, id, goal) : link } : {}),
    ...(goal ? { goal } : {}), ...(selfCheck ? { selfCheck } : {}),
  }
}

/** Hands together on an exercise of Exercises Sightreading (by title), both hands judged. */
function hands(week: number, n: number, exercise: string, what: string, options: StepOptions & { check?: LessonLink['check'] } = {}): LessonStep {
  const { bpm = 70, done = `90% right at ${bpm} BPM`, check = 'together' } = options
  return step(week, `hands${n}`, 'hands', exercise, what, done,
    { route: ROUTES.exerciseSightreading, song: exercise, bpm, check, ...(check === 'both' ? { leftHand: 'chord' as const } : {}), ...options.link },
    { goal: { percent: 90, bpm } })
}

/** A voicing drill of Chord Sightreading over an endless line of progressions. */
function voicings(week: number, n: number, voicing: NonNullable<LessonLink['voicing']>, title: string, what: string, bpm = 60): LessonStep {
  return step(week, `hands${n}`, 'hands', title, what, `every chord green at ${bpm} BPM for one line`,
    { route: ROUTES.chordSightreading, voicing, bpm, infinite: true }, { goal: { percent: 100, bpm } })
}

/** The song at one stage of the routine (stage 3 starts with hearing the pattern). */
function song(week: number, id: SongId, stage: 1 | 2 | 3, options: StepOptions = {}): LessonStep[] {
  const item: CourseSong = SONGS[id]
  const { key, bpm = 80, done = `90% right at ${bpm} BPM` } = options
  const band = { key, style: item.style, pattern: stage === 3 ? item.pattern : undefined }
  const play = step(week, `${id}${stage}`, 'song', `${item.title}, ${STAGES[stage].name}`,
    stage === 3 ? `${STAGES[3].what} The pattern: ${item.patternText}.` : STAGES[stage].what, done,
    { route: ROUTES.leadSheetSightreading, song: item.title, bpm, check: 'both', leftHand: STAGES[stage].leftHand, mute: ['comp'], ...band },
    { goal: { percent: 90, bpm, ...(options.timing ? { timingMs: options.timing } : {}) } })
  if (stage !== 3) return [play]
  const listen = step(week, `${id}-listen`, 'listen', `Hear the pattern: ${item.title}`,
    `Play the song and listen to the band's piano: it plays ${item.patternText}. Then play along with it on your left hand.`,
    'you can hum the rhythm', { route: ROUTES.leadSheetSightreading, song: item.title, bpm, check: 'melody', ...band, pattern: item.pattern })
  return [listen, play]
}

/** Improvising over a song in Free Improvisation, the left hand keeping its pattern (or a simpler stage). */
function improvise(week: number, id: SongId, what: string, options: StepOptions = {}): LessonStep {
  const item: CourseSong = SONGS[id]
  const { key, bpm = 80, done = 'one chorus without stopping' } = options
  return step(week, `improvise-${id}`, 'improvise', options.title ?? `Improvise over ${item.title}`,
    `${what} Your left hand keeps the song's pattern, or stage 1 or 2 if that is too much.`, done,
    { route: ROUTES.freeImprovisation, song: item.title, bpm, key, style: item.style, pattern: item.pattern, mute: ['comp'] },
    { selfCheck: ['I kept my place in the form', 'I played some notes on purpose, not only scale runs', 'I came back to the melody at the end'] })
}

/** Licks of Lick Sightreading, from one playlist, over an endless line. */
function licks(week: number, playlist: string, what: string, bpm = 80): LessonStep {
  return step(week, 'licks', 'improvise', `${playlist.replace(/^Licks: /, '')} licks`, what, `90% right at ${bpm} BPM`,
    { route: ROUTES.lickSightreading, playlist, bpm, infinite: true }, { goal: { percent: 90, bpm } })
}

/** A few minutes of ear training, ticked at 80% right (a round of 10 questions, or 20 notes written). */
function ear(week: number, kind: 'progression' | 'dictation', what: string): LessonStep {
  const goal = { goal: { percent: 80, bpm: 0 } }
  return kind === 'progression'
    ? step(week, 'ear', 'ear', 'Name the progression', what, '8 right out of 10 (a round)', { route: ROUTES.nameProgression }, goal)
    : step(week, 'ear', 'ear', 'Melodic dictation', what, '80% of the notes right, over 20 notes or more', { route: ROUTES.melodicDictation }, goal)
}

/** A step to tick by yourself (recording, playing for someone...). */
function selfCheck(week: number, title: string, what: string, items: string[]): LessonStep {
  return step(week, 'check', 'check', title, what, 'every box ticked', undefined, { selfCheck: items })
}

const C = 0, F = 5, Bb = 10, G = 7, Eb = 3

export const PROGRAM: LessonUnit[] = [
  {
    id: 'u1', title: 'Time, chords and the first song', weeks: 'Weeks 1 to 4',
    goal: 'Play a song with both hands in time and improvise a little over it, in F, then C.',
    source: 'Kelly and Rasmussen, A Guide to Exploring Jazz Improvisation, Book 1, Module 1',
    weekList: [
      { week: 1, steps: [
        hands(1, 1, 'Ionian (major) scale over C^7: up and down', 'The major scale with both hands, an octave apart.'),
        hands(1, 2, 'Rhythm on C7: eighth notes on every off-beat', 'Off-beat eighths: count "1 and", play on the "and".', { check: 'melody' }),
        ...song(1, 'avalon', 1, { bpm: 70, done: 'melody 90% right at 70 BPM with the roots' }),
        improvise(1, 'avalon', 'Only 3 notes: the root, 3rd and 5th of each chord, in any rhythm, over the roots.', { bpm: 70 }),
        ear(1, 'progression', 'I, IV and V: hear where the bass goes.'),
      ] },
      { week: 2, steps: [
        hands(2, 1, 'Major triads in half steps: 1-3-5-8 up', 'Major triads, both hands, moving up by half steps.'),
        hands(2, 2, 'Minor triads in half steps: 1-3-5-8 up', 'The same with minor triads.'),
        ...song(2, 'avalon', 2, { bpm: 80 }),
        improvise(2, 'avalon', '3 notes again, but keep one 2-bar rhythm and repeat it.'),
        ear(2, 'dictation', '4 notes: write what you hear.'),
      ] },
      { week: 3, steps: [
        hands(3, 1, 'Dorian scale over C-7: up and down', 'Dorian, both hands.'),
        hands(3, 2, 'Dominant 7th chords in fourths: 1-3-5-7 up', '7th chords around the circle of fourths.'),
        ...song(3, 'avalon', 3, { bpm: 80, done: 'one chorus with the band, no stop' }),
        improvise(3, 'avalon', '2 bars of the melody, then 2 bars of your own, all the way through.'),
        ear(3, 'progression', 'I, IV and V in other songs.'),
      ] },
      { week: 4, steps: [
        hands(4, 1, 'Major 3rds in half steps: lower note first', 'Intervals, both hands.'),
        hands(4, 2, 'Rhythm on C7: groups of 3 eighth notes and an eighth rest', 'Groups of 3, then 4 and 5 eighths: phrases that start on any beat.', { check: 'melody' }),
        ...song(4, 'avalon', 2, { key: C, bpm: 90, done: 'in C at 90 BPM' }),
        ...song(4, 'avalon', 3, { key: C, bpm: 90, done: 'two keys (F and C) at 90 BPM' }),
        improvise(4, 'avalon', 'One chorus over the two-feel.', { key: C, bpm: 90 }),
        ear(4, 'dictation', '4 notes, then 6.'),
      ] },
    ],
  },
  {
    id: 'u2', title: 'The 12-bar blues', weeks: 'Weeks 5 to 10',
    goal: 'Play a blues head with a left-hand comp or a walking bass, then improvise 2 choruses, in F and Bb.',
    source: 'Kelly and Rasmussen, Book 1, Module 2 (the blues steps, in order)',
    weekList: [
      { week: 5, steps: [
        hands(5, 1, 'Dominant 7th chords in fourths: 1-3-5-7 up', 'Dominant 7th arpeggios, both hands.', { bpm: 80 }),
        ...song(5, 'studyBlues', 1, { bpm: 80 }),
        ...song(5, 'studyBlues', 2, { bpm: 80, done: '2 choruses at 80 BPM' }),
        improvise(5, 'studyBlues', 'Triads only: the root, 3rd and 5th of each chord.'),
        ear(5, 'progression', 'The 12-bar blues: hear the IV in bar 5.'),
      ] },
      { week: 6, steps: [
        hands(6, 1, 'Jazz blues: guide tones, one per chord, from the 3rd', 'Left hand: shells (root, 3rd, 7th). Right hand: the guide-tone line.', { check: 'both', bpm: 80 }),
        ...song(6, 'studyBlues', 3, { bpm: 90 }),
        improvise(6, 'studyBlues', 'Triads, each reached from a half step below.', { bpm: 90 }),
        ear(6, 'dictation', '6 notes.'),
      ] },
      { week: 7, steps: [
        hands(7, 1, 'Blues scale over C7: up and down', 'The blues scale, both hands.'),
        hands(7, 2, 'Minor pentatonic scale over C-7: up and down', 'The minor pentatonic, both hands.'),
        ...song(7, 'studyBlues', 2, { key: Bb, bpm: 90, done: 'in Bb at 90 BPM' }),
        improvise(7, 'studyBlues', 'The blue third: slide from the minor 3rd to the major 3rd.', { key: Bb, done: '2 choruses improvised' }),
        licks(7, 'Licks: Blues', 'Blues licks over an endless line of progressions.'),
        ear(7, 'progression', 'Blues and I-IV-V.'),
      ] },
      { week: 8, steps: [
        hands(8, 1, 'Major triads in fourths: 1-3-5-8 up', 'Triads around the fourths, as the blues moves: the base of a walking bass.'),
        ...song(8, 'tinRoof', 1, { bpm: 80 }),
        ...song(8, 'tinRoof', 2, { bpm: 80, done: 'the head at 80 BPM' }),
        improvise(8, 'tinRoof', 'The blues scale over the roots.'),
        ear(8, 'dictation', '6 notes.'),
      ] },
      { week: 9, steps: [
        hands(9, 1, 'Jazz blues: chord tones in eighth notes', 'Chord tones, then the chord scales, in eighths, both hands.', { bpm: 80 }),
        ...song(9, 'tinRoof', 3, { bpm: 90, done: 'the head with a walking bass at 90 BPM' }),
        improvise(9, 'tinRoof', 'Chord tones, filled in with scale notes.', { bpm: 90 }),
        ear(9, 'progression', 'Blues with a turnaround.'),
      ] },
      { week: 10, steps: [
        hands(10, 1, 'Jazz blues: chord scales in eighth notes', 'Review in C, F and Bb (Practice > Keys moves the key at each chorus).', { bpm: 90 }),
        improvise(10, 'tinRoof', '2 choruses over the walking bass (or the roots).', { bpm: 90, done: 'head, 2 choruses, head' }),
        selfCheck(10, 'Record a blues', 'Record yourself: the head, 2 choruses improvised, the head again. Listen back the next day.',
          ['I recorded it', 'The time was steady', 'I knew where I was in the 12 bars', 'I listened back']),
        ear(10, 'dictation', '8 notes.'),
      ] },
    ],
  },
  {
    id: 'u3', title: 'The ii-V-I', weeks: 'Weeks 11 to 16',
    goal: 'Play ii-V-I with shells in 6 keys, and two ii-V songs with both hands.',
    source: 'Kelly and Rasmussen, Book 1, Module 3; Open Music Theory, ii-V-I',
    weekList: [
      { week: 11, steps: [
        hands(11, 1, 'ii-V-I in all keys: guide tones, one per chord, from the 3rd', 'Left hand: shells. Right hand: guide tones. C, F and Bb first.', { check: 'both', bpm: 70 }),
        ...song(11, 'ladyBeGood', 1, { bpm: 80 }),
        ...song(11, 'ladyBeGood', 2, { bpm: 80 }),
        improvise(11, 'ladyBeGood', 'Land on a guide tone (the 3rd or 7th) on beat 1 of each bar.'),
        ear(11, 'progression', 'ii-V-I in major.'),
      ] },
      { week: 12, steps: [
        hands(12, 1, 'ii-V-I in all keys: guide tones, one per chord, from the 7th', 'The same from the 7th, in 6 keys.', { check: 'both', bpm: 80 }),
        voicings(12, 2, 'shell', 'Shells through endless progressions', 'Root at the bottom, then the 3rd and 7th: nothing else.'),
        ...song(12, 'ladyBeGood', 3, { bpm: 90, done: 'the head at 90 BPM with shells' }),
        improvise(12, 'ladyBeGood', 'Guide tones, filled in with scale notes.', { bpm: 90 }),
        ear(12, 'dictation', '6 notes over a ii-V-I.'),
      ] },
      { week: 13, steps: [
        voicings(13, 1, 'twoHand', 'Two-hand voicings', 'Left hand: a shell. Right hand: the 9th and 5th above it.'),
        improvise(13, 'ladyBeGood', 'Short cells over each ii-V-I: 1-2-3-5 and the arpeggio licks.', { bpm: 90, done: '1 chorus improvised' }),
        licks(13, 'Licks from standards: ii-V-I major', 'ii-V-I licks from standards.'),
        ear(13, 'progression', 'ii-V-I and I-vi-ii-V.'),
      ] },
      { week: 14, steps: [
        hands(14, 1, 'Minor ii-V-i in all keys: guide tones, two per chord', 'Minor ii-V-i: shells in the left hand, guide tones in the right.', { check: 'both', bpm: 80 }),
        ...song(14, 'honeysuckle', 1, { bpm: 90 }),
        ...song(14, 'honeysuckle', 2, { bpm: 90 }),
        licks(14, 'Licks: Arpeggios', 'Arpeggio licks over endless progressions.', 90),
        ear(14, 'dictation', '6 notes.'),
      ] },
      { week: 15, steps: [
        hands(15, 1, 'ii-V-I in all keys: chord scales in eighth notes', 'Chord tones, then scales, in eighths, hands together.', { bpm: 80 }),
        ...song(15, 'honeysuckle', 3, { bpm: 100, done: 'the head at 100 BPM' }),
        licks(15, 'Licks: Approach notes', 'Approach notes: reach chord tones from a half step away.', 90),
        ear(15, 'progression', 'Minor ii-V-i.'),
      ] },
      { week: 16, steps: [
        voicings(16, 1, 'shell', 'ii-V-I shells in 12 keys', 'Shells through every key, slowly.', 60),
        improvise(16, 'honeysuckle', '1 chorus over the stride (or shells).', { bpm: 100, done: 'head, chorus, head' }),
        ear(16, 'dictation', '8 notes.'),
      ] },
    ],
  },
  {
    id: 'u4', title: 'Song form and Rhythm Changes', weeks: 'Weeks 17 to 22',
    goal: 'Keep your place in a 32-bar form while comping and improvising.',
    source: 'Kelly and Rasmussen, Book 1, Module 4 (and their Rhythm Changes handout)',
    weekList: [
      { week: 17, steps: [
        hands(17, 1, 'I-vi-ii-V turnaround: guide tones, one per chord, from the 3rd', 'The I-vi-ii-V turnaround: shells and guide tones.', { check: 'both', bpm: 80 }),
        ...song(17, 'justYou', 1, { bpm: 100 }),
        ...song(17, 'justYou', 2, { bpm: 100 }),
        ...song(17, 'justYou', 3, { bpm: 100, done: 'the head at 100 BPM, no lost bars' }),
        improvise(17, 'justYou', 'Embellish the melody: play some notes early (anticipate) or late (delay).', { bpm: 100 }),
        ear(17, 'progression', 'Turnarounds.'),
      ] },
      { week: 18, steps: [
        hands(18, 1, 'Rhythm changes A section: guide tones, one per chord, from the 3rd', 'Comping with two hands through the A section of Rhythm Changes.', { check: 'both', bpm: 90 }),
        improvise(18, 'justYou', 'One phrase of the melody, one of your own.', { bpm: 100, done: '1 chorus with the band' }),
        ...song(18, 'gotRhythm', 1, { bpm: 100 }),
        ...song(18, 'gotRhythm', 2, { bpm: 100 }),
        ear(18, 'dictation', '8 notes.'),
      ] },
      { week: 19, steps: [
        hands(19, 1, 'Rhythm changes A section: guide tones, two per chord', 'Rhythm Changes A: chord tones in eighths.', { bpm: 100 }),
        ...song(19, 'gotRhythm', 3, { bpm: 110, done: 'the A sections at 110 BPM' }),
        licks(19, 'Licks: Neighbours and turns', 'Turns: circle a note before landing on it.', 100),
        ear(19, 'progression', 'Rhythm Changes.'),
      ] },
      { week: 20, steps: [
        hands(20, 1, 'iii-VI-ii-V turnaround: guide tones, one per chord, from the 3rd', 'The iii-VI-ii-V turnaround.', { check: 'both', bpm: 90 }),
        improvise(20, 'gotRhythm', 'Add approach notes to the melody.', { bpm: 110, done: 'head, chorus, head' }),
        ear(20, 'dictation', '8 notes.'),
      ] },
      { week: 21, steps: [
        hands(21, 1, 'Minor ii-V-i in all keys: chord tones in eighth notes', 'Minor ii-V-i in all keys.', { bpm: 90 }),
        ...song(21, 'thisThing', 1, { bpm: 100 }),
        ...song(21, 'thisThing', 2, { bpm: 100, done: '90% right at 100 BPM' }),
        improvise(21, 'thisThing', 'Embellish the melody: anticipate, delay, add approach notes, then answer it with phrases of your own.', { bpm: 100 }),
        ear(21, 'progression', 'Minor ii-V-i.'),
      ] },
      { week: 22, steps: [
        voicings(22, 1, 'shell', 'Shells in 3 keys', 'Review: shells through endless progressions.', 80),
        ...song(22, 'thisThing', 3, { bpm: 100 }),
        improvise(22, 'thisThing', '1 chorus over the shells.', { bpm: 100, done: 'head, chorus, head' }),
        ear(22, 'dictation', '8 notes.'),
      ] },
    ],
  },
  {
    id: 'u5', title: 'Ballad and bossa', weeks: 'Weeks 23 to 26',
    goal: 'Play slowly and evenly, and feel the bossa.',
    source: 'Added for the course; voicings from jazz-piano teaching, styles from the band',
    weekList: [
      { week: 23, steps: [
        voicings(23, 1, 'rootless', 'Rootless voicings', 'Left hand: 3rd, 7th and 9th (5th or 13th allowed), no root: the bass plays it.', 60),
        ...song(23, 'embraceable', 1, { bpm: 60 }),
        ...song(23, 'embraceable', 2, { bpm: 60, timing: 60, done: 'even notes, no rush: 90% right at 60 BPM, on time within 60 ms on average' }),
        improvise(23, 'embraceable', 'Long notes and space: let a note ring for a whole bar.', { bpm: 60 }),
        ear(23, 'dictation', '6 notes, slowly.'),
      ] },
      { week: 24, steps: [
        voicings(24, 1, 'rootless', 'Rootless voicings in 6 keys', 'The same, faster.', 80),
        ...song(24, 'embraceable', 3, { bpm: 60, done: 'one form at 60 BPM' }),
        improvise(24, 'embraceable', '8 bars improvised, then the melody.', { bpm: 60 }),
        ear(24, 'progression', 'Ballad progressions.'),
      ] },
      { week: 25, steps: [
        voicings(25, 1, 'twoHand', 'Bossa comping with two hands', 'Two-hand voicings; then try them in the bossa rhythm with the band.', 100),
        ...song(25, 'wonderful', 1, { bpm: 120 }),
        ...song(25, 'wonderful', 2, { bpm: 120 }),
        ...song(25, 'wonderful', 3, { bpm: 120, done: 'the head at 120 BPM' }),
        improvise(25, 'wonderful', 'Short rhythm motifs of 2 bars, repeated and varied.', { bpm: 120 }),
        ear(25, 'dictation', '8 notes.'),
      ] },
      { week: 26, steps: [
        hands(26, 1, 'ii-V-I in all keys: chord scales in eighth notes', 'Review, hands together.', { bpm: 100 }),
        improvise(26, 'wonderful', '1 chorus over the bossa.', { bpm: 120, done: 'head, chorus, head' }),
        ...song(26, 'teaForTwo', 2, { bpm: 120, done: 'the head in bossa' }),
        ear(26, 'progression', 'Review.'),
      ] },
    ],
  },
  {
    id: 'u6', title: 'Modal playing', weeks: 'Weeks 27 to 29',
    goal: 'Improvise in phrases over long chords.',
    source: 'Added for the course; chord scales from Open Music Theory',
    weekList: [
      { week: 27, steps: [
        voicings(27, 1, 'quartal', 'Quartal voicings', 'Chords in stacked 4ths, from the chord scale.', 80),
        hands(27, 2, 'Dorian over C-7: in thirds', 'Dorian in thirds, hands together.', { bpm: 80 }),
        ...song(27, 'modalStudy', 1, { bpm: 100 }),
        ...song(27, 'modalStudy', 2, { bpm: 100 }),
        improvise(27, 'modalStudy', 'Phrases of 2 bars, then 2 bars of rest.', { bpm: 100, done: '2 minutes without stopping at 100 BPM' }),
        ear(27, 'dictation', '8 notes.'),
      ] },
      { week: 28, steps: [
        hands(28, 1, 'Mixolydian scale over C7: up and down', 'Mixolydian, then the minor pentatonic, hands together.', { bpm: 100 }),
        ...song(28, 'modalStudy', 3, { bpm: 100, done: 'one form with the band' }),
        improvise(28, 'modalStudy', 'Dorian and the minor pentatonic.', { bpm: 100 }),
        licks(28, 'Licks: Scale lines', 'Scale-line licks over endless progressions.', 100),
        ear(28, 'progression', 'Review.'),
      ] },
      { week: 29, steps: [
        voicings(29, 1, 'quartal', 'Quartal voicings, review', 'Stacked 4ths through endless progressions.', 100),
        improvise(29, 'modalStudy', '2 choruses.', { bpm: 110, done: 'head, 2 choruses, head' }),
        ear(29, 'dictation', '8 notes.'),
      ] },
    ],
  },
  {
    id: 'review', title: 'Review', weeks: 'Week 30',
    goal: "Each unit's last song in a key not used yet, 10 to 20 BPM faster, then a recording of a blues and of a standard.",
    source: "As in Kelly and Rasmussen's module projects",
    weekList: [
      { week: 30, steps: [
        ...song(30, 'avalon', 3, { key: Bb, bpm: 100, done: 'in Bb at 100 BPM' }).slice(1),
        ...song(30, 'tinRoof', 3, { key: F, bpm: 100, done: 'in F at 100 BPM' }).slice(1),
        ...song(30, 'honeysuckle', 3, { key: C, bpm: 110, done: 'in C at 110 BPM' }).slice(1),
        ...song(30, 'gotRhythm', 3, { key: Eb, bpm: 120, done: 'in Eb at 120 BPM' }).slice(1),
        ...song(30, 'embraceable', 3, { key: F, bpm: 70, done: 'in F at 70 BPM' }).slice(1),
        ...song(30, 'modalStudy', 3, { key: G, bpm: 120, done: 'a 4th up at 120 BPM' }).slice(1),
        selfCheck(30, 'Record a blues and a standard', 'Record a blues and a standard: the head, comping, a solo, the head again. Then start again at Unit 1, faster: a loop, not a ladder.',
          ['I recorded a blues', 'I recorded a standard', 'I kept the form', 'I listened back and noted one thing to work on']),
      ] },
    ],
  },
]

/** Every step of the program, in order. */
export const ALL_STEPS: LessonStep[] = PROGRAM.flatMap((unit) => unit.weekList.flatMap((week) => week.steps))
