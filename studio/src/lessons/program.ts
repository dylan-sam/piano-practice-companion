// The Lessons tab's program: 46 weeks of 20 to 30 minutes a day for a pianist new to jazz, in nine
// units and a review (docs/LESSONS.md explains how it was built and where each idea comes from).
// Units 1 to 3 and 5 end with a substitution week: one chord substitution, practised in an
// exercise, then heard, played and improvised over in the unit's song, once the song is learnt.
// The minor ii-V-i, the altered dominants and the minor blues have units of their own; intros and
// endings come back on several songs, and each unit's improvising brings one tool to build a solo.
// Each week has the four parts of a session: hands together, the song, improvising and ear
// training. Every step says what to do, why, how long and when it is done, and opens the screen
// that practises it (lessonLink.ts). Nothing is locked.

import { ROUTES } from '../router'
import type { LessonLink } from './lessonLink'
import { SUBSTITUTIONS, type SubstitutionId } from '../music/substitutions'

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

export interface LessonWeek { week: number; steps: LessonStep[] } // week: its number in the program, counted from 1

// What a step's id starts with: its week as first written (w5-...), so the progress kept by id
// stays when weeks are added; the weeks added later have their own (sub1-..., minor1-..., alt1-...,
// mblues1-...)
type WeekId = number | `${'sub' | 'minor' | 'alt' | 'mblues'}${number}`

export interface LessonUnit {
  id: string // stable (the screen remembers the open units by it)
  number: number // its place in the program, counted from 1 (0 for the review)
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
  avalon: { title: 'Avalon', pattern: 'open_fifths', patternText: 'the root with an open 5th above it, on beats 1 and 3 (Siskind)' },
  studyBlues: { title: 'Study Blues', pattern: 'charleston', patternText: 'the Charleston rhythm: the chord on beat 1 and on the "and" of 2' },
  tinRoof: { title: 'Tin Roof Blues', pattern: 'walking_bass', patternText: 'a walking bass: quarter notes on chord tones, reaching the next root by a half step' },
  ladyBeGood: { title: 'Oh Lady Be Good', pattern: 'type_a_shells', patternText: 'Type A shells: the root, then the 3rd under the 7th, held on beat 1 and short on beat 3 (Siskind)' },
  honeysuckle: { title: 'Honeysuckle Rose', pattern: 'ragtime_bass', patternText: 'a ragtime bass: a bass note on beats 1 and 3 (the root, then the 5th), the chord on 2 and 4 (Winn)' },
  justYou: { title: 'Just You, Just Me', pattern: 'type_a_charleston', patternText: 'Type A shells in the Charleston rhythm: the whole shell on beat 1, the 3rd and 7th on the "and" of 2 (Siskind)' },
  gotRhythm: { title: 'I Got Rhythm', pattern: 'walking_bass', patternText: 'a walking bass through Rhythm Changes: roots and 5ths first' },
  thisThing: { title: 'What Is This Thing Called Love', pattern: 'rootless_charleston', patternText: 'rootless voicings in the Charleston rhythm: four notes without the root, the 3rd or the 7th at the bottom, whichever moves least (Levine)' },
  embraceable: { title: 'Embraceable You', style: 'ballad', pattern: 'rootless_held', patternText: 'rootless voicings held for two beats, the band\'s bass playing the root (Levine)' },
  wonderful: { title: "'S Wonderful", style: 'bossa-nova', pattern: 'bossa_bass', patternText: 'a bossa bass: root and 5th in the bossa rhythm, with the chord' },
  teaForTwo: { title: 'Tea for two', style: 'bossa-nova', pattern: 'bossa_bass', patternText: 'the bossa bass' },
  modalStudy: { title: 'Modal Study', pattern: 'fourths_from_ninth', patternText: 'fourth chords: three notes in 4ths from the 9th, held (Levine)' },
  loveMe: { title: 'Love Me Or Leave Me', pattern: 'type_a_shells', patternText: 'Type A shells: the root, then the 3rd under the 7th; over the ø7, the root, 3rd and b5 (Siskind)' },
  loveMeAltered: { title: 'Love Me Or Leave Me', pattern: 'rootless_charleston', patternText: 'rootless voicings in the Charleston rhythm: over the dominants, the b9 and b13 the band plays (Levine)' },
  minorBlues: { title: 'Minor Study Blues', pattern: 'rootless_charleston', patternText: 'rootless voicings in the Charleston rhythm, the G7b9b13 with its b9 and b13 (Levine)' },
  blackTan: { title: 'Black And Tan Fantasy', pattern: 'walking_bass', patternText: 'a walking bass: quarter notes on chord tones, reaching the next root by a half step' },
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

/** Options of a step: its key (pitch class), tempo, target (with a timing in ms), substitutions, and more of its link. */
interface StepOptions { key?: number; bpm?: number; done?: string; timing?: number; link?: Partial<LessonLink>; title?: string; what?: string
  subs?: SubstitutionId[] }

/** A step's link carrying its goal, so the screen can tick it. */
function goalLink(link: LessonLink, step: string, goal: Goal): LessonLink {
  return { ...link, step, goal: goal.percent, ...(goal.bpm ? { bpm: goal.bpm } : {}), ...(goal.timingMs ? { timing: goal.timingMs } : {}) }
}

/**
 * A step with its id made from the week and a short name. A step with a goal sends it with its
 * link, so the screen can tick the step when the goal is reached.
 */
function step(week: WeekId, name: string, kind: StepKind, title: string, what: string, done: string,
  link?: LessonLink, extra: { selfCheck?: string[]; goal?: Goal } = {}): LessonStep {
  const id = `${typeof week === 'number' ? `w${week}` : week}-${name}`
  const { goal, selfCheck } = extra
  return {
    id, kind, title, what, why: WHY[kind], minutes: MINUTES[kind], done,
    ...(link ? { link: goal ? goalLink(link, id, goal) : link } : {}),
    ...(goal ? { goal } : {}), ...(selfCheck ? { selfCheck } : {}),
  }
}

/** Hands together on an exercise of Exercises Sightreading (by title), both hands judged. */
function hands(week: WeekId, n: number, exercise: string, what: string, options: StepOptions & { check?: LessonLink['check'] } = {}): LessonStep {
  const { bpm = 70, done = `90% right at ${bpm} BPM`, check = 'together' } = options
  return step(week, `hands${n}`, 'hands', exercise, what, done,
    { route: ROUTES.exerciseSightreading, song: exercise, bpm, check, ...(check === 'both' ? { leftHand: 'chord' as const } : {}), ...options.link },
    { goal: { percent: 90, bpm } })
}

/** A voicing drill of Chord Sightreading over an endless line of progressions. */
function voicings(week: WeekId, n: number, voicing: NonNullable<LessonLink['voicing']>, title: string, what: string, bpm = 60): LessonStep {
  return step(week, `hands${n}`, 'hands', title, what, `every chord green at ${bpm} BPM for one line`,
    { route: ROUTES.chordSightreading, voicing, bpm, infinite: true }, { goal: { percent: 100, bpm } })
}

/** The song at one stage of the routine (stage 3 starts with hearing the pattern); `what` adds to its text. */
function song(week: WeekId, id: SongId, stage: 1 | 2 | 3, options: StepOptions = {}): LessonStep[] {
  const item: CourseSong = SONGS[id]
  const { key, bpm = 80, done = `90% right at ${bpm} BPM`, subs } = options
  const band = { key, style: item.style, pattern: stage === 3 ? item.pattern : undefined, subs }
  const play = step(week, `${id}${stage}`, 'song', options.title ?? `${item.title}, ${STAGES[stage].name}`,
    (stage === 3 ? `${STAGES[3].what} The pattern: ${item.patternText}.` : STAGES[stage].what) + (options.what ? ` ${options.what}` : ''), done,
    { route: ROUTES.leadSheetSightreading, song: item.title, bpm, check: 'both', leftHand: STAGES[stage].leftHand, mute: ['comp'], ...band },
    { goal: { percent: 90, bpm, ...(options.timing ? { timingMs: options.timing } : {}) } })
  if (stage !== 3) return [play]
  const listen = step(week, `${id}-listen`, 'listen', `Hear the pattern: ${item.title}`,
    `Play the song and listen to the band's piano: it plays ${item.patternText}. Then play along with it on your left hand.`,
    'you can hum the rhythm', { route: ROUTES.leadSheetSightreading, song: item.title, bpm, check: 'melody', ...band, pattern: item.pattern })
  return [listen, play]
}

/** Improvising over a song in Free Improvisation, the left hand keeping its pattern (or a simpler stage). */
function improvise(week: WeekId, id: SongId, what: string, options: StepOptions = {}): LessonStep {
  const item: CourseSong = SONGS[id]
  const { key, bpm = 80, done = 'one chorus without stopping' } = options
  return step(week, `improvise-${id}`, 'improvise', options.title ?? `Improvise over ${item.title}`,
    `${what} Your left hand keeps the song's pattern, or stage 1 or 2 if that is too much.`, done,
    { route: ROUTES.freeImprovisation, song: item.title, bpm, key, style: item.style, pattern: item.pattern, mute: ['comp'], subs: options.subs },
    { selfCheck: ['I kept my place in the form', 'I played some notes on purpose, not only scale runs', 'I came back to the melody at the end'] })
}

/** Licks of Lick Sightreading, from one playlist, over an endless line. */
function licks(week: WeekId, playlist: string, what: string, bpm = 80): LessonStep {
  return step(week, 'licks', 'improvise', `${playlist.replace(/^Licks: /, '')} licks`, what, `90% right at ${bpm} BPM`,
    { route: ROUTES.lickSightreading, playlist, bpm, infinite: true }, { goal: { percent: 90, bpm } })
}

/** A few minutes of ear training, ticked at 80% right (a round of 10 questions, or 20 notes written). */
function ear(week: WeekId, kind: 'progression' | 'dictation', what: string): LessonStep {
  const goal = { goal: { percent: 80, bpm: 0 } }
  return kind === 'progression'
    ? step(week, 'ear', 'ear', 'Name the progression', what, '8 right out of 10 (a round)', { route: ROUTES.nameProgression }, goal)
    : step(week, 'ear', 'ear', 'Melodic dictation', what, '80% of the notes right, over 20 notes or more', { route: ROUTES.melodicDictation }, goal)
}

/** A step to tick by yourself (recording, playing for someone...). */
function selfCheck(week: WeekId, title: string, what: string, items: string[]): LessonStep {
  return step(week, 'check', 'check', title, what, 'every box ticked', undefined, { selfCheck: items })
}

/**
 * Intros and endings on a song, on your own (the band muted: the sheet keeps the tempo): an intro
 * before the head and an ending after it, written out in `intro` and `ending`.
 */
function introEnding(week: WeekId, id: SongId, intro: string, ending: string, options: StepOptions = {}): LessonStep {
  const item: CourseSong = SONGS[id]
  const { key, bpm = 80 } = options
  return step(week, `intro-${id}`, 'check', `Intro and ending: ${item.title}`,
    `On your own (the band is muted, the sheet keeps the tempo). Intro: ${intro} Then the head. Ending: ${ending}`,
    'the intro, the head and the ending, twice in a row without stopping',
    { route: ROUTES.leadSheetSightreading, song: item.title, bpm, key, check: 'melody', mute: ['bass', 'comp', 'drums'] },
    { selfCheck: ['I played the intro in time and came in on the first bar', 'I played the ending', 'I did it in another key too (Key menu)'] })
}

/** What a substitution week teaches: its exercise, its song, and the words for each step. */
interface SubstitutionPlan {
  sub: SubstitutionId
  exercise: string // an exercise of Exercises Sightreading (by title) over the new chords
  song: SongId
  bpm: number
  hear: string // what to listen for
  play: string // what changes for the left hand
  improvise: string // what to try over the new chord
  ear: [kind: 'progression' | 'dictation', what: string]
}

/**
 * A substitution week, after the unit's song is learnt: the new chords in an exercise (guide tones,
 * both hands), then the song with the band playing the substitution (shown in a colour on the
 * sheet), played with the song's pattern on the new chords, and improvised over.
 */
function substitutionWeek(week: WeekId, plan: SubstitutionPlan): LessonStep[] {
  const name = SUBSTITUTIONS.find((s) => s.id === plan.sub)!.name.toLowerCase()
  const item: CourseSong = SONGS[plan.song]
  const subs = [plan.sub]
  return [
    hands(week, 1, plan.exercise, 'Left hand: shells of the new chords. Right hand: the guide tones, so you hear how the new chord leads on.',
      { check: 'both', bpm: Math.min(plan.bpm, 80) }),
    step(week, `${plan.song}-hear`, 'listen', `Hear the ${name}: ${item.title}`, `${plan.hear} The new chords are in blue on the sheet.`,
      'you can hear where it comes', { route: ROUTES.leadSheetSightreading, song: item.title, bpm: plan.bpm, check: 'melody',
        style: item.style, pattern: item.pattern, subs }),
    ...song(week, plan.song, 3, { bpm: plan.bpm, subs, title: `${item.title} with the ${name}`, what: plan.play,
      done: `90% right at ${plan.bpm} BPM, the new chords included` }).slice(1),
    improvise(week, plan.song, plan.improvise, { bpm: plan.bpm, subs, title: `Improvise over ${item.title} with the ${name}`,
      done: 'one chorus, the new chord heard in your line' }),
    ear(week, ...plan.ear),
  ]
}

const C = 0, F = 5, Bb = 10, G = 7, Eb = 3

/** A unit as written: its weeks by their ids (WeekId), numbered by `numberWeeks`. */
type WrittenUnit = Omit<LessonUnit, 'number' | 'weeks' | 'weekList'> & { weekList: { week: WeekId; steps: LessonStep[] }[] }

const UNITS: WrittenUnit[] = [
  {
    id: 'u1', title: 'Time, chords and the first song',
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
        improvise(4, 'avalon', 'One chorus over the open 5ths. Build the solo with space: play 2 bars, rest 2 bars, and make each phrase answer the one before (call and response).', { key: C, bpm: 90 }),
        introEnding(4, 'avalon', 'the last 4 bars of the song, then the melody from bar 1.', 'hold the last chord and add its 6th and 9th (C6/9: C E G A D), slowing down over the last 2 bars (ritardando).', { key: C, bpm: 90 }),
        ear(4, 'dictation', '4 notes, then 6.'),
      ] },
      { week: 'sub1', steps: substitutionWeek('sub1', {
        sub: 'addII', exercise: 'V7 with its ii added, in F and C: guide tones, one per chord, from the 3rd', song: 'avalon', bpm: 90,
        hear: 'Where C7 lasts 4 bars, the band plays G−7 for the first 2, then C7. G−7 is the ii of C7 (the chord a 5th above it): a ii-V, the move you will meet everywhere from Unit 3.',
        play: 'Where the band plays G−7, your left hand plays G and D (the open 5th) instead of C and G.',
        improvise: 'Over G−7, aim for its notes (G, B♭, D, F), then for E and B♭ when C7 comes: hear the ii lead to the V.',
        ear: ['progression', 'ii-V: hear the ii before the V.'],
      }) },
    ],
  },
  {
    id: 'u2', title: 'The 12-bar blues',
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
        improvise(8, 'tinRoof', 'The blues scale over the roots. Rhythm first: choose two notes and change only the rhythm; then a short riff, repeated as the chords change, as blues players do.'),
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
        introEnding(10, 'tinRoof', 'the last 4 bars of the blues (its turnaround), then the head.', 'in the last bar, the chord a half step above the I, then the I: E7, then E♭7 held (the ♭II7–I ending).', { bpm: 90 }),
        ear(10, 'dictation', '8 notes.'),
      ] },
      { week: 'sub2', steps: substitutionWeek('sub2', {
        sub: 'secondary', exercise: 'I-VI-II-V turnaround with secondary dominants: guide tones, one per chord, from the 3rd', song: 'studyBlues', bpm: 90,
        hear: 'In the last bar, the band plays G7 instead of G−7: the ii made a dominant (II7), with B natural instead of B♭. The turnaround F7 D7 G7 C7 is now a chain of dominants, each the V of the next.',
        play: 'In the last bar, your left hand plays G7 (with B natural) where the chart says G−7.',
        improvise: 'In the turnaround, land on the 3rd of each dominant: F♯ (D7), B (G7), E (C7). Each leads up a half step to the root of the next chord.',
        ear: ['progression', 'Blues with a turnaround: hear the dominants.'],
      }) },
    ],
  },
  {
    id: 'u3', title: 'The ii-V-I',
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
        improvise(12, 'ladyBeGood', 'Guide tones, filled in with scale notes. Then a motif: a 2-bar idea, played again, then moved so it fits the next ii-V-I.', { bpm: 90 }),
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
        improvise(16, 'honeysuckle', '1 chorus over the ragtime bass (or shells).', { bpm: 100, done: 'head, chorus, head' }),
        introEnding(16, 'honeysuckle', 'a ii-V vamp on the first chord: G−7 C7, 2 beats each, four times.', 'the "three times" tag: the last ii-V (G−7 C7) played three times, then F, held.', { bpm: 100 }),
        ear(16, 'dictation', '8 notes.'),
      ] },
      { week: 'sub3', steps: substitutionWeek('sub3', {
        sub: 'tritone', exercise: 'ii-bII7-I with the tritone substitution in all keys: guide tones, one per chord, from the 3rd', song: 'honeysuckle', bpm: 100,
        hear: 'Before F, the band plays G♭7 instead of C7: the dominant a tritone away. G♭7 has the same 3rd and 7th as C7 (B♭ and E, written F♭), so it leads to F too, and the bass falls by half steps: G, G♭, F. The song already does it once, with A♭−7 D♭7 before G−7.',
        play: 'Where the band plays G♭7, your ragtime bass plays G♭ (then D♭); the chord between keeps B♭ and E (F♭).',
        improvise: 'Over G♭7, play the guide tones of C7 (B♭ and E): they still fit. Then try the G♭ major triad and hear it fall to F.',
        ear: ['progression', 'ii-V-I, and the same with its tritone substitution.'],
      }) },
    ],
  },
  {
    id: 'uMinor', title: 'The minor ii-V-i',
    goal: 'Play the minor ii-V-i with shells and guide tones in all keys, and a song in a minor key with both hands.',
    source: 'Mark Levine, The Jazz Piano Book (ch. 9, minor scale harmony); Jeremy Siskind, Jazz Piano Fundamentals; Open Music Theory, the minor ii-V-i',
    weekList: [
      { week: 'minor1', steps: [
        hands('minor1', 1, 'Half-diminished chords in fourths: 1-3-5-7 up', 'The ø7 chord, the ii of a minor key: a minor 7th chord with a flat 5th.'),
        hands('minor1', 2, 'Harmonic minor scale over C-^7: up and down', "The minor key's scale with its 7th raised: it gives the V7 its major 3rd."),
        ...song('minor1', 'loveMe', 1, { bpm: 100 }),
        ...song('minor1', 'loveMe', 2, { bpm: 100 }),
        improvise('minor1', 'loveMe', 'The A minor pentatonic over the A minor bars, the C major pentatonic over the C bars. Leave space: 2 bars of music, 2 bars of rest.', { bpm: 100 }),
        ear('minor1', 'progression', 'Minor ii-V-i and major ii-V-I: hear the darker ii and V.'),
      ] },
      { week: 'minor2', steps: [
        hands('minor2', 1, 'Minor ii-V-i in all keys: guide tones, one per chord, from the 7th', 'Left hand: shells. Right hand: guide tones from the 7th.', { check: 'both', bpm: 80 }),
        hands('minor2', 2, 'Phrygian dominant scale over C7b9: up and down', 'Mixolydian with a flat 9th and flat 13th: the V7 of a minor key (its harmonic minor from the 5th note).'),
        ...song('minor2', 'loveMe', 3, { bpm: 100, done: 'the head at 100 BPM with shells' }),
        improvise('minor2', 'loveMe', 'Over each E7, play its b9 (F) and resolve it down a half step to E, the 5th of A−7: lines that land on the i.', { bpm: 100 }),
        ear('minor2', 'dictation', '6 notes in a minor key.'),
      ] },
      { week: 'minor3', steps: [
        hands('minor3', 1, 'Locrian #2 scale over Ch7: up and down', 'The scale of the ø7: Locrian with a natural 9th.'),
        hands('minor3', 2, 'Minor ii-V-i in all keys: chord scales in eighth notes', 'Eighth notes through the three scales, hands together.', { bpm: 90 }),
        licks('minor3', 'Licks from standards: minor ii-V-i', 'Minor ii-V-i licks from standards.', 90),
        improvise('minor3', 'loveMe', 'One lick from the licks step in each minor ii-V-i, then a phrase of your own that answers it.', { bpm: 110 }),
        ear('minor3', 'progression', 'Minor ii-V-i.'),
      ] },
      { week: 'minor4', steps: [
        hands('minor4', 1, 'Minor ii-V-i in all keys: guide tones, one per chord, from the 3rd', 'Review in 6 keys: shells in the left hand, guide tones in the right.', { check: 'both', bpm: 90 }),
        ...song('minor4', 'loveMe', 3, { key: G, bpm: 110, done: 'in G (E minor) at 110 BPM' }).slice(1),
        improvise('minor4', 'loveMe', '1 chorus over the shells.', { key: G, bpm: 110, done: 'head, chorus, head' }),
        introEnding('minor4', 'loveMe', 'a minor ii-V vamp: Bø7 E7, 2 beats each, four times.', 'A−6 (the i with its 6th), the ii-V once more, then A−6 held.', { bpm: 100 }),
        ear('minor4', 'dictation', '8 notes in a minor key.'),
      ] },
    ],
  },
  {
    id: 'u4', title: 'Song form and Rhythm Changes',
    goal: 'Keep your place in a 32-bar form while comping and improvising.',
    source: 'Kelly and Rasmussen, Book 1, Module 4 (song form, What Is This Thing Called Love?, melodic embellishment); Rhythm Changes added for the course',
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
        improvise(20, 'gotRhythm', 'Add approach notes to the melody. Then quote it: start a phrase with the first notes of the melody, and go on your own way.', { bpm: 110, done: 'head, chorus, head' }),
        introEnding(20, 'gotRhythm', 'I-vi-ii-V twice (B♭ G−7 C−7 F7), the intro of Rhythm Changes.', 'G♭7, then C♭7 (B7), then B♭, held: ♭VI7, ♭II7, I.', { bpm: 110 }),
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
        voicings(22, 1, 'rootless', 'Rootless voicings', 'Left hand: 3rd, 7th and 9th (5th or 13th allowed), no root: the bass plays it. They are the pattern of What Is This Thing Called Love?', 60),
        ...song(22, 'thisThing', 3, { bpm: 100 }),
        improvise(22, 'thisThing', '1 chorus over the rootless voicings (or shells).', { bpm: 100, done: 'head, chorus, head' }),
        ear(22, 'dictation', '8 notes.'),
      ] },
      { week: 'sub4', steps: substitutionWeek('sub4', {
        sub: 'passingDim', exercise: 'I-#Io7-ii-V with a passing diminished chord: guide tones, one per chord, from the 3rd', song: 'gotRhythm', bpm: 110,
        hear: 'In the A sections, the band plays B°7 between B♭ and C−7: a diminished chord a half step above the I, leading up to the ii, as in most recordings of Rhythm Changes. The bass walks up by half steps: B♭, B, C.',
        play: 'Your walking bass goes B♭, B, C there.',
        improvise: 'Over B°7, play its arpeggio (B, D, F, A♭) up into the root of C−7.',
        ear: ['progression', 'Rhythm Changes: hear the bass walk up.'],
      }) },
    ],
  },
  {
    id: 'uAltered', title: 'Altered dominants',
    goal: 'Hear and play the b9 and b13 of a dominant chord: in rootless voicings, and in lines that resolve them.',
    source: 'Mark Levine, The Jazz Piano Book (ch. 8, altering notes in left-hand voicings; ch. 9, melodic minor and diminished scale harmony); Jeremy Siskind, Jazz Piano Fundamentals, Book 1 (units 10 to 12)',
    weekList: [
      { week: 'alt1', steps: [
        hands('alt1', 1, 'ii-V7b9-I in all keys: guide tones, one per chord, from the 3rd', 'Left hand: shells. Right hand: guide tones; hear the b9 of the V in the band.', { check: 'both', bpm: 80 }),
        hands('alt1', 2, 'Half-whole diminished scale over C7b9: up and down', 'Half step, whole step: the b9 and #9 with the natural 13th, for a V7b9 going to a major chord.'),
        voicings('alt1', 3, 'rootless', 'Rootless voicings with alterations', 'Rootless voicings: a 7b9 takes the b9 instead of the 9th, a 7b9b13 the b13 instead of the 13th. The endless line adds some on its own.', 70),
        ...song('alt1', 'thisThing', 3, { bpm: 110, subs: ['altered'], title: 'What Is This Thing Called Love? with altered dominants',
          what: 'The band plays the dominants with their b9 (and b13 before a minor chord): play them in your rootless voicings.', done: 'the head at 110 BPM, the altered dominants included' }),
        ear('alt1', 'progression', 'V7 and V7b9: hear the darker dominant.'),
      ] },
      { week: 'alt2', steps: [
        hands('alt2', 1, 'Minor ii-V7b9b13-i in all keys: guide tones, two per chord', 'Left hand: shells. Right hand: guide tones, two per chord.', { check: 'both', bpm: 80 }),
        hands('alt2', 2, 'Altered scale over C7alt: up and down', 'Every alteration of a dominant: b9, #9, #11 and b13. It is the melodic minor scale a half step above the root.'),
        improvise('alt2', 'thisThing', 'Tension and release: over each altered dominant, play its b9 or b13, then resolve it down a half step into the next chord.', { bpm: 110, subs: ['altered'] }),
        ear('alt2', 'dictation', '8 notes.'),
      ] },
      { week: 'alt3', steps: [
        hands('alt3', 1, 'ii-V7b9-I in all keys: chord scales in eighth notes', "Eighth notes, hands together: the V's scale with its b9.", { bpm: 90 }),
        ...song('alt3', 'loveMeAltered', 3, { bpm: 110, subs: ['altered'], title: 'Love Me Or Leave Me with altered dominants', done: 'the head at 110 BPM with rootless voicings' }),
        improvise('alt3', 'loveMeAltered', 'Over each E7b9b13, play F (its b9) going down to E, and C (its b13) held into A−7, where it becomes the 3rd.', { bpm: 110, subs: ['altered'] }),
        ear('alt3', 'progression', 'Minor ii-V-i.'),
      ] },
      { week: 'alt4', steps: [
        hands('alt4', 1, 'Minor ii-V7b9b13-i in all keys: chord scales in eighth notes', 'The same in minor, hands together.', { bpm: 90 }),
        improvise('alt4', 'loveMeAltered', '1 chorus: an altered note in every dominant, resolved each time.', { bpm: 120, subs: ['altered'], done: 'head, chorus, head' }),
        introEnding('alt4', 'thisThing', 'a ii-V vamp on the first chord, altered: Gø7 C7b9, 2 beats each, four times.', 'the last ii-V (Dø7 G7b9) three times, then C^7, held.', { bpm: 110 }),
        ear('alt4', 'dictation', '8 notes.'),
      ] },
    ],
  },
  {
    id: 'uMinorBlues', title: 'The minor blues',
    goal: 'Play a minor blues with rootless voicings and a walking bass, and improvise over it for several choruses with a shape.',
    source: 'Kerry Politzer, Beginning Jazz Piano (the minor blues module); Duke Ellington and Bubber Miley, Black and Tan Fantasy (1927); Mark Levine, The Jazz Piano Book',
    weekList: [
      { week: 'mblues1', steps: [
        hands('mblues1', 1, 'Minor blues: guide tones, one per chord, from the 3rd', 'Left hand: shells. Right hand: the guide-tone line through the minor blues.', { check: 'both', bpm: 80 }),
        ...song('mblues1', 'minorBlues', 1, { bpm: 100 }),
        ...song('mblues1', 'minorBlues', 2, { bpm: 100 }),
        improvise('mblues1', 'minorBlues', 'The C minor pentatonic and blues scale over every chord: in a minor blues they are the notes of the key, nothing clashes. Repeat a riff, changing it a little each time.', { bpm: 100 }),
        ear('mblues1', 'progression', 'The minor blues: hear the ♭VI7 and the V7 in bars 9 and 10.'),
      ] },
      { week: 'mblues2', steps: [
        hands('mblues2', 1, 'Minor blues: guide tones, two per chord', 'Guide tones, two per chord, both hands.', { check: 'both', bpm: 90 }),
        ...song('mblues2', 'minorBlues', 3, { bpm: 110, done: '2 choruses at 110 BPM with rootless voicings' }),
        improvise('mblues2', 'minorBlues', 'Dorian over C−7 and F−7, Mixolydian over A♭7, the b9 and b13 over G7b9b13.', { bpm: 110 }),
        ear('mblues2', 'dictation', '8 notes in a minor key.'),
      ] },
      { week: 'mblues3', steps: [
        hands('mblues3', 1, 'Minor blues: chord scales in eighth notes', 'Eighth notes through the minor blues, hands together.', { bpm: 90 }),
        ...song('mblues3', 'blackTan', 1, { bpm: 100 }),
        ...song('mblues3', 'blackTan', 2, { bpm: 100 }),
        improvise('mblues3', 'blackTan', 'Its first 12 bars are a minor blues in B♭ minor: the B♭ minor pentatonic and blues scale. The second strain turns to B♭ major.', { bpm: 100 }),
        ear('mblues3', 'progression', 'Blues in major and in minor.'),
      ] },
      { week: 'mblues4', steps: [
        hands('mblues4', 1, 'Minor blues: guide tones, one per chord, from the 7th', 'The guide-tone line from the 7th, both hands.', { check: 'both', bpm: 100 }),
        ...song('mblues4', 'blackTan', 3, { bpm: 110, done: 'the whole tune with a walking bass at 110 BPM' }),
        improvise('mblues4', 'minorBlues', '3 choruses with a shape: the first low and sparse, the second higher and busier, the third the highest and busiest; then the head.', { bpm: 110, done: 'head, 3 choruses, head' }),
        introEnding('mblues4', 'minorBlues', 'the last 4 bars (A♭7, G7b9b13, C−7, Dø7 G7b9b13), then the head.', 'A♭7, G7b9b13, then C−6 held: ♭VI7, V7, i.', { bpm: 100 }),
        selfCheck('mblues4', 'Record a minor blues', 'Record yourself: the intro, the head, 3 choruses improvised, the head and the ending.',
          ['I recorded it', 'My solo had a shape: from low and sparse to high and busy', 'I kept the form', 'I listened back']),
        ear('mblues4', 'dictation', '8 notes.'),
      ] },
    ],
  },
  {
    id: 'u5', title: 'Ballad and bossa',
    goal: 'Play slowly and evenly, and feel the bossa.',
    source: 'Added for the course; rootless voicings from Mark Levine, The Jazz Piano Book (ch. 7); styles from the band',
    weekList: [
      { week: 23, steps: [
        voicings(23, 1, 'rootless', 'Rootless voicings, faster', 'The same, a little faster: the pattern of Embraceable You.', 70),
        ...song(23, 'embraceable', 1, { bpm: 60 }),
        ...song(23, 'embraceable', 2, { bpm: 60, timing: 60, done: 'even notes, no rush: 90% right at 60 BPM, on time within 60 ms on average' }),
        improvise(23, 'embraceable', 'Long notes and space: let a note ring for a whole bar.', { bpm: 60 }),
        ear(23, 'dictation', '6 notes, slowly.'),
      ] },
      { week: 24, steps: [
        voicings(24, 1, 'rootless', 'Rootless voicings in 6 keys', 'The same, faster.', 80),
        ...song(24, 'embraceable', 3, { bpm: 60, done: 'one form at 60 BPM' }),
        improvise(24, 'embraceable', '8 bars improvised, then the melody. Among the long notes, one phrase in double time (twice as fast), then long notes again.', { bpm: 60 }),
        introEnding(24, 'embraceable', 'the last 4 bars, slowly and freely (rubato), before the tempo starts.', 'slow down over the last 2 bars and hold G^7 with its 9th (A) on top.', { bpm: 60 }),
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
    id: 'u6', title: 'Modal playing',
    goal: 'Improvise in phrases over long chords.',
    source: 'Added for the course; chord scales from Open Music Theory, fourth chords from Mark Levine, The Jazz Piano Book',
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
        improvise(29, 'modalStudy', '2 choruses. Take a motif up a half step with the bridge, and back down after it.', { bpm: 110, done: 'head, 2 choruses, head' }),
        ear(29, 'dictation', '8 notes.'),
      ] },
    ],
  },
  {
    id: 'review', title: 'Review',
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

/**
 * The units numbered in order (the review apart), with their weeks numbered from 1 and each unit's
 * range of weeks ("Weeks 5 to 10").
 */
function numberWeeks(units: WrittenUnit[]): LessonUnit[] {
  let next = 1
  let unitNumber = 0
  return units.map((unit) => {
    const weekList = unit.weekList.map((week) => ({ week: next++, steps: week.steps }))
    const first = weekList[0].week
    const last = weekList[weekList.length - 1].week
    return { ...unit, number: unit.id === 'review' ? 0 : ++unitNumber, weeks: first === last ? `Week ${first}` : `Weeks ${first} to ${last}`, weekList }
  })
}

export const PROGRAM: LessonUnit[] = numberWeeks(UNITS)

/** Every step of the program, in order. */
export const ALL_STEPS: LessonStep[] = PROGRAM.flatMap((unit) => unit.weekList.flatMap((week) => week.steps))

/** A unit's name as shown: "Unit 4" by its id (the review: "Review"). */
export function unitName(id: string): string {
  const unit = PROGRAM.find((u) => u.id === id)
  return !unit ? id : unit.number ? `Unit ${unit.number}` : unit.title
}
