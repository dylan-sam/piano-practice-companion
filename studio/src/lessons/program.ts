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
import { FRAMES, frameText } from './introEndings'
import { prettyChordText } from '../music/chordText'
import { exerciseTitle, readSpec, specText } from '../exercises/builder/exerciseBuilder'

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
  patternText: string // the pattern in words, a full sentence or two
  about?: string // the song and its form, told the first time the song comes in the program
}

const SONGS = {
  avalon: { title: 'Avalon', pattern: 'open_fifths',
    patternText: 'The left hand plays the root of each chord with the 5th above it (an "open 5th"), both notes together, on beats 1 and 3. It is the simplest jazz accompaniment, and Jeremy Siskind starts his students with it.',
    about: 'Avalon (Vincent Rose and Al Jolson, 1920) is a 32-bar song in F made of four phrases of 8 bars. The first two phrases wait on C7 for several bars and then land on F. The third phrase moves to D7 and then to G minor, and the last phrase comes home to F through C7. Count the phrases as you play: knowing where each one starts is how you keep your place in a song.' },
  studyBlues: { title: 'Study Blues', pattern: 'charleston',
    patternText: 'The left hand plays the Charleston rhythm: the chord on beat 1 and again on the "and" of beat 2, then nothing on beats 3 and 4. This short-long figure is one of the most common comping rhythms in jazz.',
    about: 'Study Blues is a 12-bar jazz blues in F written for this course. A blues has three lines of four bars. The first line stays on F7, with a B♭7 in bar 2. The second line goes to B♭7 for two bars and comes back to F7. The third line is a ii-V (G−7 C7) that leads back to F, followed by a short turnaround that takes you back to the top. One time through the 12 bars is called a chorus.' },
  tinRoof: { title: 'Tin Roof Blues', pattern: 'walking_bass',
    patternText: 'The left hand plays a walking bass: one note on every beat, mostly notes of the chord, with the last note of each bar a half step above or below the next root, so that the line leads into the next chord.',
    about: 'Tin Roof Blues (the New Orleans Rhythm Kings, 1923) is a 12-bar blues in E♭. The lead sheet writes it out three times, so you read 36 bars, but every chorus follows the same plan as Study Blues: E♭ in the first line, A♭ at the start of the second line, and B♭7 leading back to E♭ in the third line.' },
  ladyBeGood: { title: 'Oh Lady Be Good', pattern: 'type_a_shells',
    patternText: 'The left hand plays Type A shell voicings: the root at the bottom with the 3rd and the 7th above it (the 3rd under the 7th), held on beat 1 and played short on beat 3. A shell keeps only the notes that say what the chord is (Siskind).',
    about: 'Oh, Lady Be Good! (George and Ira Gershwin, 1924) is a 32-bar song in G in AABA form: an 8-bar phrase (A), the same phrase again, a contrasting 8-bar phrase called the bridge (B), and the first phrase one last time. The A phrase stays close to G, with a C7 and a passing G♯°. The bridge starts on C and travels through E minor and A7 before D7 brings it back to G.' },
  honeysuckle: { title: 'Honeysuckle Rose', pattern: 'ragtime_bass',
    patternText: 'The left hand plays a ragtime (stride) bass: a low bass note on beats 1 and 3 (the root, then the 5th) and the chord in the middle of the keyboard on beats 2 and 4, so the hand jumps back and forth (Winn).',
    about: 'Honeysuckle Rose (Fats Waller, 1929) is a 32-bar AABA song in F. Its A section is built almost entirely on the ii-V G−7 C7, repeated several times, before it finally lands on F. The bridge climbs through a chain of dominants: F7 to B♭, then G7 to C7, which leads back to the last A.' },
  justYou: { title: 'Just You, Just Me', pattern: 'type_a_charleston',
    patternText: 'The left hand plays Type A shells in the Charleston rhythm: the whole shell (root, 3rd and 7th) on beat 1, then only the 3rd and the 7th on the "and" of beat 2 (Siskind).',
    about: 'Just You, Just Me (Jesse Greer, 1929) is a 32-bar song in C in AABA form, written in cut time (two beats in a bar). Its A sections are full of turnarounds and secondary dominants: A7 leads to D minor, and D7 G7 lead back to C. The bridge passes through F and F minor before more dominants bring it home.' },
  gotRhythm: { title: 'I Got Rhythm', pattern: 'walking_bass',
    patternText: 'The left hand plays a walking bass through Rhythm Changes. Start with roots and 5ths, one note per beat, and add passing notes when that is comfortable.',
    about: 'I Got Rhythm (George and Ira Gershwin, 1930) opens on this lead sheet with its verse, in G minor. Then comes the chorus in B♭, the part jazz musicians play: 32 bars in AABA form. Its chords are so common that they have their own name, Rhythm Changes. The A sections are quick turnarounds (I vi ii V) and the bridge is a chain of dominant chords that leads back to B♭.' },
  thisThing: { title: 'What Is This Thing Called Love', pattern: 'rootless_charleston',
    patternText: 'The left hand plays rootless voicings in the Charleston rhythm: four notes without the root (the band\'s bass plays it), with the 3rd or the 7th at the bottom, whichever moves least from the chord before (Levine).',
    about: 'What Is This Thing Called Love? (Cole Porter, 1929) is a 32-bar AABA song. Each A section is made of two minor ii-V\'s: Gø7 C7♭9 going to F minor, then Dø7 G7 going to C major. The bridge is a major ii-V to B♭ (C−7 F7 B♭maj7), followed by A♭7 and Dø7 G7, which lead back to the last A.' },
  embraceable: { title: 'Embraceable You', style: 'ballad', pattern: 'rootless_held',
    patternText: 'The left hand plays rootless voicings held for two beats each, while the band\'s bass plays the roots (Levine). In a ballad, let each voicing ring until the next one.',
    about: 'Embraceable You (George and Ira Gershwin, 1928) is a 32-bar ballad in G in ABAC form: four phrases of 8 bars, the third like the first. A ballad is slow, so every note is exposed: play evenly, and let the chords ring.' },
  wonderful: { title: "'S Wonderful", style: 'bossa-nova', pattern: 'bossa_bass',
    patternText: 'The left hand plays a bossa nova bass: the root on beat 1 and the 5th just before beat 3, with the chord above it, in the rhythm the band\'s bass plays.',
    about: "'S Wonderful (George and Ira Gershwin, 1927) is a 32-bar AABA song in E♭, played here as a bossa nova, the Brazilian style of the late 1950s. The A sections sit on E♭ with a passing E°; the bridge moves to G and comes back through F9 and B♭13." },
  teaForTwo: { title: 'Tea for two', style: 'bossa-nova', pattern: 'bossa_bass',
    patternText: 'The left hand plays the bossa bass you learnt with \'S Wonderful: the root on beat 1 and the 5th just before beat 3.',
    about: 'Tea for Two (Vincent Youmans, 1925) is a 32-bar song in F in ABAC form. Its first phrase is a ii-V (G−7 C7) going to F; the second phrase takes the same idea up to the key of A.' },
  modalStudy: { title: 'Modal Study', pattern: 'fourths_from_ninth',
    patternText: 'The left hand plays fourth chords: three notes stacked in 4ths, starting on the 9th of the chord, held for the whole bar (Levine). Over D−7 these are E, A and D.',
    about: 'Modal Study, written for this course, is a 32-bar AABA tune built like Miles Davis\'s So What: 16 bars of D−7, 8 bars of E♭−7 for the bridge (a half step higher), then 8 more bars of D−7. With so few chords, the shape of the music is up to you.' },
  loveMe: { title: 'Love Me Or Leave Me', pattern: 'type_a_shells',
    patternText: 'The left hand plays Type A shells: the root with the 3rd under the 7th. Over the half-diminished chords, play the root, the 3rd and the ♭5 instead, because the ♭5 is what makes the chord half-diminished (Siskind).',
    about: 'Love Me or Leave Me (Walter Donaldson, 1928) is a 32-bar AABA song in A minor. Its A sections are minor ii-V-i\'s (Bø7 E7 A−7) that turn towards C major; the bridge goes from A7 to D minor, then from G7 to C.' },
  loveMeAltered: { title: 'Love Me Or Leave Me', pattern: 'rootless_charleston',
    patternText: 'The left hand plays rootless voicings in the Charleston rhythm. Over the dominant chords, include the ♭9 and the ♭13 that the band plays (Levine).' },
  minorBlues: { title: 'Minor Study Blues', pattern: 'rootless_charleston',
    patternText: 'The left hand plays rootless voicings in the Charleston rhythm. Over G7♭9♭13, include its ♭9 (A♭) and its ♭13 (E♭), as the band does (Levine).',
    about: 'Minor Study Blues, written for this course, is a 12-bar minor blues in C minor. The first line stays on C−7 (with F−7 in bar 2), the second line goes to F−7 for two bars and back to C−7, and the third line plays A♭7 and G7♭9♭13 before landing on C−7, with a minor ii-V (Dø7 G7) to turn around.' },
  blackTan: { title: 'Black And Tan Fantasy', pattern: 'walking_bass',
    patternText: 'The left hand plays a walking bass: one note per beat on chord tones, reaching the next root by a half step.',
    about: 'Black and Tan Fantasy (Duke Ellington and Bubber Miley, 1927) begins with a 12-bar minor blues in B♭ minor. A second strain follows in B♭ major, with faster-moving chords. It is one of the first famous jazz pieces in a minor key.' },
} satisfies Record<string, CourseSong>
type SongId = keyof typeof SONGS

// What each stage of the song routine asks of the left hand
const STAGES = {
  1: { name: 'stage 1, bass', leftHand: 'bass',
    what: 'Play the melody with your right hand, reading it from the lead sheet. With your left hand, play only the root of each chord, the note the chord is named after (the F of F7, the G of G−7). Start with one root on beat 1 of each bar; once that feels easy, play it on beats 1 and 3. The band plays along, but its piano is muted, so the harmony you hear comes from your own left hand.' },
  2: { name: 'stage 2, chords', leftHand: 'beats',
    what: 'Play the melody with your right hand. With your left hand, play the whole chord on every beat, in the inversion closest to the chord before it, so that your hand moves as little as possible from chord to chord. When a chord has four notes you may leave out the 5th: the root, the 3rd and the 7th are what say what the chord is. Keep the chords short and even, like a guitarist strumming four beats in a bar.' },
  3: { name: 'stage 3, pattern', leftHand: 'pattern',
    what: "Play the melody with your right hand and the song's own accompaniment pattern with your left hand, in the rhythm of the band's piano (which is muted, so that you hear yourself)." },
} as const

const WHY = {
  hands: 'Playing the same material with both hands at once builds the coordination that the songs need, and reading it from the staff trains your eyes at the same time. Short drills repeated every day make chords and scales automatic, which frees your attention for the music itself.',
  listen: 'Hearing a pattern before you play it makes its rhythm much easier to copy. Jazz is learnt by ear first: the band plays the pattern you are about to learn, so that you absorb its feel before you think about the notes.',
  song: 'Each song is learnt with both hands, the left hand growing one stage at a time: first the roots, then the full chords, then the song\'s own pattern. A real tune is where everything else comes together, and every song you learn becomes material for improvising.',
  improvise: 'Improvising a little every day, with one new tool at a time, is how you learn to make up music rather than only read it. The aim is not to play many notes but to choose them: each tool gives you a reason to play one note rather than another.',
  ear: 'Hearing progressions and melodies is what lets you play what you hear, follow other musicians and learn tunes from recordings. A few minutes every day add up quickly.',
  check: 'Some things cannot be scored by the app. You check them by listening to yourself honestly, which is a skill in itself.',
}

/** Options of a step: its key (pitch class), tempo, target (with a timing in ms), substitutions, and more of its link. */
interface StepOptions { key?: number; bpm?: number; done?: string; timing?: number; link?: Partial<LessonLink>; title?: string; what?: string
  subs?: SubstitutionId[] }

/** A step's link carrying its goal, so the screen can tick it. */
function goalLink(link: LessonLink, step: string, goal: Goal): LessonLink {
  return { ...link, step, goal: goal.percent, ...(goal.bpm ? { bpm: goal.bpm } : {}), ...(goal.timingMs ? { timing: goal.timingMs } : {}) }
}

/**
 * A step with its id made from the week and a short name. Its link carries the id, so the
 * screen's back button returns to the step's explanation page; a step with a goal sends the goal
 * too, so the screen can tick the step when it is reached. Chord symbols in its words are written
 * for reading (Cmaj7, not C^7: music/chordText.ts); its link keeps the names the screens look for.
 */
function step(week: WeekId, name: string, kind: StepKind, title: string, what: string, done: string,
  link?: LessonLink, extra: { selfCheck?: string[]; goal?: Goal } = {}): LessonStep {
  const id = `${typeof week === 'number' ? `w${week}` : week}-${name}`
  const { goal, selfCheck } = extra
  return {
    id, kind, title: prettyChordText(title), what: prettyChordText(what), why: WHY[kind], minutes: MINUTES[kind], done: prettyChordText(done),
    ...(link ? { link: goal ? goalLink(link, id, goal) : { ...link, step: id } } : {}),
    ...(goal ? { goal } : {}), ...(selfCheck ? { selfCheck } : {}),
  }
}

/** How a short exercise is repeated: this many times through, the key moving by `keyStep` semitones each time. */
interface Repeat { times?: number; keyStep?: number }

/** The words saying how an exercise is repeated ("Play it 4 times, a fourth higher each time: C, F, B♭ and E♭."). */
function repeatText({ times = 1, keyStep = 0 }: Repeat): string {
  if (times <= 1) return ''
  if (!keyStep) return ` The band plays it ${times} times in a row: keep going without stopping, and make each time a little better than the last.`
  const names = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B']
  const keys = Array.from({ length: times }, (_, i) => names[(i * keyStep) % 12])
  const step = keyStep === 5 ? 'a fourth higher' : keyStep === 7 ? 'a fifth higher' : keyStep === 1 ? 'a half step higher' : `${keyStep} half steps higher`
  return ` The band plays it ${times} times in a row, ${step} each time: ${keys.slice(0, -1).join(', ')} and ${keys.at(-1)}. Read the new key from the staff each time rather than working it out in your head.`
}

/** Hands together on an exercise built from its settings (exerciseBuilder.ts spec text, locked on the step), both hands judged, repeated as asked. */
function hands(week: WeekId, n: number, spec: string, what: string,
  options: StepOptions & Repeat & { check?: LessonLink['check'] } = {}): LessonStep {
  const { bpm = 70, times = 1, keyStep, check = 'together' } = options
  const settings = readSpec(spec)
  if (!settings) throw new Error(`Lesson ${week} hands${n}: the exercise "${spec}" cannot be read`)
  const exercise = exerciseTitle(settings)
  const done = options.done ?? (times > 1 ? `90% of the notes right over the ${times} times through, at ${bpm} BPM` : `90% of the notes right at ${bpm} BPM`)
  return step(week, `hands${n}`, 'hands', exercise, what + repeatText(options), done,
    { route: ROUTES.exerciseSightreading, exercise: specText(settings), song: exercise, bpm, check, ...(check === 'both' ? { leftHand: 'chord' as const } : {}),
      ...(times > 1 ? { choruses: times } : {}), ...(keyStep ? { keyStep } : {}), ...options.link },
    { goal: { percent: 90, bpm } })
}

/** A voicing drill of Chord Sightreading over an endless line of progressions. */
function voicings(week: WeekId, n: number, voicing: NonNullable<LessonLink['voicing']>, title: string, what: string, bpm = 60): LessonStep {
  return step(week, `hands${n}`, 'hands', title,
    `${what} The screen writes an endless line of progressions; play each chord when the band reaches it, and it turns green when your voicing is right.`,
    `every chord green for one whole line at ${bpm} BPM`,
    { route: ROUTES.chordSightreading, voicing, bpm, infinite: true }, { goal: { percent: 100, bpm } })
}

// The songs already introduced: the first step of a song tells what the song is and its form
const introduced = new Set<string>()

/** The song's story and form, the first time it comes in the program (an empty text after that). */
function aboutOnce(id: SongId): string {
  const item: CourseSong = SONGS[id]
  if (introduced.has(item.title) || !item.about) return ''
  introduced.add(item.title)
  return `\nAbout the song: ${item.about}`
}

/** The song at one stage of the routine (stage 3 starts with hearing the pattern); `what` adds to its text. */
function song(week: WeekId, id: SongId, stage: 1 | 2 | 3, options: StepOptions = {}): LessonStep[] {
  const item: CourseSong = SONGS[id]
  const { key, bpm = 80, done = `90% of the notes right at ${bpm} BPM`, subs } = options
  const band = { key, style: item.style, pattern: stage === 3 ? item.pattern : undefined, subs }
  const listen = stage === 3 ? step(week, `${id}-listen`, 'listen', `Hear the pattern: ${item.title}`,
    `Play the song and listen carefully to the band's piano: it plays the pattern you will learn next. ${item.patternText}\n` +
    'Listen to a whole chorus first, without playing. Then join in softly with your left hand, copying the rhythm before you worry about the exact notes.' + aboutOnce(id),
    'you can tap or hum the rhythm of the pattern', { route: ROUTES.leadSheetSightreading, song: item.title, bpm, check: 'melody', ...band, pattern: item.pattern }) : null
  const words = stage === 3
    ? `${STAGES[3].what} ${item.patternText} Go slowly at first: a steady pattern at a slow tempo is worth more than a stumbling one at the target tempo.`
    : STAGES[stage].what
  const play = step(week, `${id}${stage}`, 'song', options.title ?? `${item.title}, ${STAGES[stage].name}`,
    words + (options.what ? `\n${options.what}` : '') + (listen ? '' : aboutOnce(id)), done,
    { route: ROUTES.leadSheetSightreading, song: item.title, bpm, check: 'both', leftHand: STAGES[stage].leftHand, mute: ['comp'], ...band },
    { goal: { percent: 90, bpm, ...(options.timing ? { timingMs: options.timing } : {}) } })
  return listen ? [listen, play] : [play]
}

/** Improvising over a song in Free Improvisation, the left hand keeping its pattern (or a simpler stage). */
function improvise(week: WeekId, id: SongId, what: string, options: StepOptions = {}): LessonStep {
  const item: CourseSong = SONGS[id]
  const { key, bpm = 80, done = 'one chorus without stopping' } = options
  return step(week, `improvise-${id}`, 'improvise', options.title ?? `Improvise over ${item.title}`,
    `${what}\nYour left hand keeps the song's pattern while you improvise. If that is too much at first, go back to stage 1 (the roots) or stage 2 (the chords): today, the ideas of your right hand matter more than the left hand. Every note you play is written on the sheet and coloured, so you can see which notes belonged to the chord.`, done,
    { route: ROUTES.freeImprovisation, song: item.title, bpm, key, style: item.style, pattern: item.pattern, mute: ['comp'], subs: options.subs },
    { selfCheck: ['I kept my place in the form', 'I played some notes on purpose, not only scale runs', 'I came back to the melody at the end'] })
}

/** Licks of Lick Sightreading, from one playlist, over an endless line. */
function licks(week: WeekId, playlist: string, what: string, bpm = 80): LessonStep {
  return step(week, 'licks', 'improvise', `${playlist.replace(/^Licks: /, '')} licks`,
    `${what}\nA lick is a short phrase from the jazz language. The screen writes a lick over an endless line of chords and moves it to fit each new chord; read it, play it, and listen to how it sounds against the band. Pick one lick you like and play it from memory before you move on.`,
    `90% of the notes right at ${bpm} BPM`,
    { route: ROUTES.lickSightreading, playlist, bpm, infinite: true }, { goal: { percent: 90, bpm } })
}

/** A few minutes of ear training, ticked at 80% right (a round of 10 questions, or 20 notes written). */
function ear(week: WeekId, kind: 'progression' | 'dictation', what: string): LessonStep {
  const goal = { goal: { percent: 80, bpm: 0 } }
  return kind === 'progression'
    ? step(week, 'ear', 'ear', 'Name the progression',
      `${what}\nThe screen plays a short chord progression and you choose its name among the answers. Questions come in rounds of 10: the counter at the top of the screen shows how many you have answered and how many were right. Listen to the bass first, and play each progression as many times as you need before you answer.`,
      '8 right answers in a round of 10 questions', { route: ROUTES.nameProgression }, goal)
    : step(week, 'ear', 'ear', 'Melodic dictation',
      `${what}\nThe screen plays a short melody; write its notes on the staff or play them on your keyboard. Sing the melody back before you answer, and find each note by its distance from the tonic of the key. The counter adds up the notes you have written.`,
      '80% of the notes right, over 20 notes or more', { route: ROUTES.melodicDictation }, goal)
}

/** A step to tick by yourself (recording, playing for someone...). */
function selfCheck(week: WeekId, title: string, what: string, items: string[]): LessonStep {
  return step(week, 'check', 'check', title, what, 'every box ticked', undefined, { selfCheck: items })
}

/**
 * Intros and endings on a song (introEndings.ts): the sheet opens with bars added before and after
 * the head, their chords written and no melody, and the step says how to build the intro and the
 * ending in them. The band plays them with you (its piano muted, so your left hand is heard).
 */
function introEnding(week: WeekId, id: keyof typeof FRAMES, options: StepOptions = {}): LessonStep {
  const item: CourseSong = SONGS[id]
  const { key, bpm = 80 } = options
  return step(week, `intro-${id}`, 'check', `Intro and ending: ${item.title}`, frameText(FRAMES[id]),
    'the intro, the head and the ending with the band, twice in a row without stopping',
    { route: ROUTES.leadSheetSightreading, song: item.title, bpm, key, style: item.style, check: 'melody', mute: ['comp'], frame: id },
    { selfCheck: ['My intro led into the first bar of the head, on time', 'I played the ending to its last bar', 'I made a second intro of my own in the same bars'] })
}

/** What a substitution week teaches: its exercise, its song, and the words for each step. */
interface SubstitutionPlan {
  sub: SubstitutionId
  exercise: string // the settings of the exercise over the new chords (exerciseBuilder.ts specText)
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
    hands(week, 1, plan.exercise, 'This exercise practises the new chords on their own before you meet them in the song. Play shells of the new chords with your left hand (the root with the 3rd or the 7th) and the guide tones with your right hand, one note per chord, so that you hear how the new chord leads on to the next one.',
      { check: 'both', bpm: Math.min(plan.bpm, 80) }),
    step(week, `${plan.song}-hear`, 'listen', `Hear the ${name}: ${item.title}`,
      `${plan.hear}\nThe new chords are written in blue on the sheet. Listen to two choruses without playing, and raise a hand (or say "now") each time the new chord comes.`,
      'you can tell when the new chord comes without looking', { route: ROUTES.leadSheetSightreading, song: item.title, bpm: plan.bpm, check: 'melody',
        style: item.style, pattern: item.pattern, subs }),
    ...song(week, plan.song, 3, { bpm: plan.bpm, subs, title: `${item.title} with the ${name}`, what: plan.play,
      done: `90% of the notes right at ${plan.bpm} BPM, the new chords included` }).slice(1),
    improvise(week, plan.song, plan.improvise, { bpm: plan.bpm, subs, title: `Improvise over ${item.title} with the ${name}`,
      done: 'one chorus in which the new chord can be heard in your line' }),
    ear(week, ...plan.ear),
  ]
}

const C = 0, F = 5, Bb = 10, G = 7, Eb = 3
const FOURTH = 5 // semitones: a scale or chord exercise repeated a fourth higher each time

/** A unit as written: its weeks by their ids (WeekId), numbered by `numberWeeks`. */
type WrittenUnit = Omit<LessonUnit, 'number' | 'weeks' | 'weekList'> & { weekList: { week: WeekId; steps: LessonStep[] }[] }

const UNITS: WrittenUnit[] = [
  {
    id: 'u1', title: 'Time, chords and the first song',
    goal: 'Play a song with both hands in time and improvise a little over it, in F, then C.',
    source: 'Kelly and Rasmussen, A Guide to Exploring Jazz Improvisation, Book 1, Module 1',
    weekList: [
      { week: 1, steps: [
        hands(1, 1, 'scale;scale=Ionian (major)', 'Play the major scale up and down with both hands together, one octave apart. Use the usual fingering (in C: 1 2 3, thumb under, 1 2 3 4 5 in the right hand) and keep the two hands exactly together. The major scale is the starting point of all the scales in this course: the others are described by how they differ from it.', { times: 4, keyStep: FOURTH }),
        hands(1, 2, 'rhythm', 'Count "1 and 2 and 3 and 4 and" out loud, and play only on the "and"s, the off-beats. This feels strange at first, because we are used to playing on the beat. Jazz lives on the off-beat: once you can place a note there calmly, your lines start to swing.', { check: 'melody', times: 4 }),
        ...song(1, 'avalon', 1, { bpm: 70, done: 'the melody 90% right at 70 BPM, with the roots' }),
        improvise(1, 'avalon', 'Improvise using only three notes: the root, the 3rd and the 5th of the chord that is playing (C, E and G over C7; F, A and C over F). Play them in any order and any rhythm, while your left hand plays the roots. With so few notes you cannot play a wrong one, so listen to how each note sounds against the chord.', { bpm: 70 }),
        ear(1, 'progression', 'Today\'s progressions use the chords I, IV and V. Follow the bass: from I it goes up a fourth to IV, or up a fifth to V, and from V it falls back home to I.'),
      ] },
      { week: 2, steps: [
        hands(2, 1, 'arpeggio;move=halfUp', 'Play each major triad as an arpeggio (root, 3rd, 5th and the octave), both hands together, then move up a half step to the next triad. A major triad is a major 3rd (four half steps) with a minor 3rd (three half steps) on top. Moving through all the keys makes every triad familiar, not only C, F and G.'),
        hands(2, 2, 'arpeggio;move=halfUp;chord=minor', 'Play the same exercise with minor triads. A minor triad turns the order around: a minor 3rd at the bottom and a major 3rd on top, so only the middle note changes. Listen to the darker sound that this one note makes.'),
        ...song(2, 'avalon', 2, { bpm: 80 }),
        improvise(2, 'avalon', 'Improvise again with the root, the 3rd and the 5th of each chord, but this time choose one rhythm two bars long and keep repeating it, changing only the notes. A repeated rhythm makes even simple notes sound like a melody, and the listener can follow it.'),
        ear(2, 'dictation', 'Today\'s melodies have 4 notes. Write what you hear.'),
      ] },
      { week: 3, steps: [
        hands(3, 1, 'scale;scale=Dorian', 'Play the Dorian scale up and down, both hands together. Dorian is a minor scale with a natural 6th: on C, it is C D E♭ F G A B♭. It is the scale jazz musicians use most over minor 7th chords, as you will see in the theory below.', { times: 4, keyStep: FOURTH }),
        hands(3, 2, 'arpeggio;chord=dom7;notes=1-3-5-7', 'Play each dominant 7th chord as an arpeggio (root, 3rd, 5th and 7th), both hands together, moving round the circle of fourths: C7, F7, B♭7 and so on. A dominant 7th chord is a major triad with a minor 7th added. Going up by fourths is the way chords most often move in jazz, so this order prepares you for real songs.'),
        ...song(3, 'avalon', 3, { bpm: 80, done: 'one chorus with the band without stopping' }),
        improvise(3, 'avalon', 'Play two bars of the melody, then improvise two bars of your own, and keep alternating all the way through the song. The melody keeps you in the right place, and your own bars can borrow its rhythm or its notes.'),
        ear(3, 'progression', 'Today\'s progressions use I, IV and V again, now in other songs and other keys.'),
      ] },
      { week: 4, steps: [
        hands(4, 1, 'interval', 'Play major 3rds (two notes four half steps apart) moving up by half steps, both hands together. The 3rd is the note that tells you whether a chord is major or minor, so finding it quickly on the keyboard is worth the practice.'),
        hands(4, 2, 'rhythm;figure=groups3', 'Play groups of three eighth notes followed by an eighth rest. Because each group lasts two beats, the groups start on a different part of the beat each time, and your phrases learn to begin anywhere, not only on beat 1. When this is easy, try groups of 4 and of 5 eighth notes.', { check: 'melody', times: 4 }),
        ...song(4, 'avalon', 2, { key: C, bpm: 90, done: 'in C at 90 BPM' }),
        ...song(4, 'avalon', 3, { key: C, bpm: 90, done: 'two keys (F and C) at 90 BPM' }),
        improvise(4, 'avalon', 'Improvise one chorus over the open 5ths and build it with space: play for two bars, then rest for two bars. Make each phrase answer the one before it, as in a conversation; musicians call this call and response.', { key: C, bpm: 90 }),
        introEnding(4, 'avalon', { key: C, bpm: 90 }),
        ear(4, 'dictation', 'Today\'s melodies have 4 notes, then 6.'),
      ] },
      { week: 'sub1', steps: substitutionWeek('sub1', {
        sub: 'addII', exercise: 'line;progression=add ii;key=5;move=fifthUp;keys=2;line=guide3', song: 'avalon', bpm: 90,
        hear: 'Where C7 lasts four bars, the band now plays G−7 for the first two bars, then C7. G−7 is the ii chord of C7 (the minor chord built a 5th above C), and together they form a ii-V, the move you will meet in almost every song from Unit 3 onwards.',
        play: 'Where the band plays G−7, your left hand plays G and D (the open 5th of G) instead of C and G.',
        improvise: 'Over G−7, aim for its own notes (G, B♭, D and F). When C7 arrives, move to E and B♭, the 3rd and 7th of C7. Listen to how the ii leads into the V.',
        ear: ['progression', 'Listen for the ii chord that comes before the V.'],
      }) },
    ],
  },
  {
    id: 'u2', title: 'The 12-bar blues',
    goal: 'Play a blues head with a left-hand comp or a walking bass, then improvise 2 choruses, in F and Bb.',
    source: 'Kelly and Rasmussen, Book 1, Module 2 (the blues steps, in order)',
    weekList: [
      { week: 5, steps: [
        hands(5, 1, 'arpeggio;chord=dom7;notes=1-3-5-7', 'Play the dominant 7th arpeggios again, both hands together. Every chord of a blues is a dominant 7th, so these are the chords of this whole unit.', { bpm: 80 }),
        ...song(5, 'studyBlues', 1, { bpm: 80 }),
        ...song(5, 'studyBlues', 2, { bpm: 80, done: '2 choruses at 80 BPM' }),
        improvise(5, 'studyBlues', 'Improvise with the triad of each chord only: the root, the 3rd and the 5th of F7, then of B♭7, and so on. Changing notes exactly when the chord changes teaches you to hear the form of the blues.'),
        ear(5, 'progression', 'Today\'s progressions are 12-bar blues. Listen for the IV chord that arrives in bar 5, at the start of the second line.'),
      ] },
      { week: 6, steps: [
        hands(6, 1, 'line;progression=jazz blues;line=guide3', 'Play shells with your left hand (the root with the 3rd or the 7th) and the guide-tone line with your right hand: one note per chord, the 3rd or the 7th, each moving as little as possible to the next. The guide tones are the notes that define each chord, so this line sounds the whole progression with very few notes.', { check: 'both', bpm: 80 }),
        ...song(6, 'studyBlues', 3, { bpm: 90 }),
        improvise(6, 'studyBlues', 'Improvise with the chord triads again, but reach each note from a half step below: play E before F, G♯ before A, and so on. These approach notes are the first step towards the sound of bebop.', { bpm: 90 }),
        ear(6, 'dictation', 'Today\'s melodies have 6 notes.'),
      ] },
      { week: 7, steps: [
        hands(7, 1, 'scale;scale=Blues', 'Play the blues scale up and down, both hands together. It has six notes: on C, C E♭ F G♭ G B♭. The G♭, called the blue note, is what gives the scale its sound.', { times: 4, keyStep: FOURTH }),
        hands(7, 2, 'scale;scale=Minor pentatonic', 'Play the minor pentatonic scale up and down, both hands together: on C, C E♭ F G B♭. It is the blues scale without its blue note, and it has no half steps, so none of its notes clash.', { times: 4, keyStep: FOURTH }),
        ...song(7, 'studyBlues', 2, { key: Bb, bpm: 90, done: 'in B♭ at 90 BPM' }),
        improvise(7, 'studyBlues', 'Improvise with the blues scale of the key and work on the blue third: slide from the minor 3rd to the major 3rd (in B♭, from D♭ to D), as blues singers and guitarists bend their notes. On the piano you cannot bend a note, so play the two notes quickly one after the other, or both together.', { key: Bb, done: '2 choruses improvised' }),
        licks(7, 'Licks: Blues', 'Today\'s licks are blues licks, the phrases you hear in every blues solo.'),
        ear(7, 'progression', 'Today\'s progressions mix blues and I-IV-V progressions.'),
      ] },
      { week: 8, steps: [
        hands(8, 1, 'arpeggio', 'Play major triad arpeggios moving round the circle of fourths, both hands together. The blues moves the same way (F7 to B♭7), and these arpeggios are the skeleton of the walking bass you will learn next week.'),
        ...song(8, 'tinRoof', 1, { bpm: 80 }),
        ...song(8, 'tinRoof', 2, { bpm: 80, done: 'the head at 80 BPM' }),
        improvise(8, 'tinRoof', 'Improvise with the blues scale over the roots, and put rhythm first. Choose just two notes and change only their rhythm. Then make up a short riff and repeat it as the chords change underneath, as blues players do: the same riff sounds different over each chord.'),
        ear(8, 'dictation', 'Today\'s melodies have 6 notes.'),
      ] },
      { week: 9, steps: [
        hands(9, 1, 'line;progression=jazz blues;line=chordTones', 'Play the notes of each chord in eighth notes through the blues, both hands together, then fill in the gaps with notes of the chord\'s scale. Landing on a chord tone on each beat is what makes a line follow the chords.', { bpm: 80 }),
        ...song(9, 'tinRoof', 3, { bpm: 90, done: 'the head with a walking bass at 90 BPM' }),
        improvise(9, 'tinRoof', 'Improvise with the notes of each chord, filling the spaces between them with notes of the scale. Aim to land on a chord tone at the start of each bar.', { bpm: 90 }),
        ear(9, 'progression', 'Today\'s progressions are blues with a turnaround at the end.'),
      ] },
      { week: 10, steps: [
        hands(10, 1, 'line;progression=jazz blues;line=chordScales', 'Play eighth notes through the scale of each chord of the blues, both hands together. This is a review in three keys: the key moves at each chorus.', { bpm: 90, times: 3, keyStep: FOURTH }),
        improvise(10, 'tinRoof', 'Improvise two choruses over the walking bass (or over the roots if the walking bass is still hard), with the head before and after, as in a real performance.', { bpm: 90, done: 'the head, 2 choruses, the head' }),
        selfCheck(10, 'Record a blues', 'Record yourself playing the head, two improvised choruses, and the head again. Listen back the next day, when you hear it with fresh ears, and use the boxes below to check how it went.',
          ['I recorded it', 'The time was steady', 'I knew where I was in the 12 bars', 'I listened back']),
        introEnding(10, 'tinRoof', { bpm: 90 }),
        ear(10, 'dictation', 'Today\'s melodies have 8 notes.'),
      ] },
      { week: 'sub2', steps: substitutionWeek('sub2', {
        sub: 'secondary', exercise: 'line;progression=secondary;line=guide3', song: 'studyBlues', bpm: 90,
        hear: 'In the last bar, the band now plays G7 instead of G−7: the ii chord is turned into a dominant (II7), with B natural instead of B♭. The turnaround F7 D7 G7 C7 becomes a chain of dominants, each one the V of the next.',
        play: 'In the last bar, your left hand plays G7 (with B natural) where the chart says G−7.',
        improvise: 'In the turnaround, land on the 3rd of each dominant: F♯ over D7, B over G7, E over C7. Each of these notes leads up a half step to the root of the next chord.',
        ear: ['progression', 'Listen for the chain of dominants in the turnaround.'],
      }) },
    ],
  },
  {
    id: 'u3', title: 'The ii-V-I',
    goal: 'Play ii-V-I with shells in 6 keys, and two ii-V songs with both hands.',
    source: 'Kelly and Rasmussen, Book 1, Module 3; Open Music Theory, ii-V-I',
    weekList: [
      { week: 11, steps: [
        hands(11, 1, 'line;move=fourthUp;keys=12;line=guide3', 'Play shells with your left hand and guide tones with your right hand, one note per chord, starting from the 3rd of the ii. Begin with the keys of C, F and B♭. Notice how each guide tone either stays or moves down a half step: this smooth movement is the sound of the ii-V-I.', { check: 'both', bpm: 70 }),
        ...song(11, 'ladyBeGood', 1, { bpm: 80 }),
        ...song(11, 'ladyBeGood', 2, { bpm: 80 }),
        improvise(11, 'ladyBeGood', 'Improvise freely, but land on a guide tone (the 3rd or the 7th of the chord) on beat 1 of every bar. Notes on the downbeat are the ones the ear remembers, so a guide tone there makes your line sound the chords.'),
        ear(11, 'progression', 'Today\'s progressions are ii-V-I\'s in major keys.'),
      ] },
      { week: 12, steps: [
        hands(12, 1, 'line;move=fourthUp;keys=12;line=guide7', 'Play the same guide-tone exercise, this time starting from the 7th of the ii, in six keys. Starting from the 7th gives a second line that moves the same way: you now know both guide-tone paths through a ii-V-I.', { check: 'both', bpm: 80 }),
        voicings(12, 2, 'shell', 'Shells through endless progressions', 'Play shell voicings with your left hand: the root at the bottom, with the 3rd or the 7th above it, and nothing else. Shells are what jazz pianists play when they want a clear, light sound that leaves room for the melody.'),
        ...song(12, 'ladyBeGood', 3, { bpm: 90, done: 'the head at 90 BPM with shells' }),
        improvise(12, 'ladyBeGood', 'Improvise with the guide tones, filling the space between them with notes of the scale. Then try a motif: a two-bar idea that you play once, repeat, and then move so that it fits the next ii-V-I. Developing one idea is far more musical than playing new notes all the time.', { bpm: 90 }),
        ear(12, 'dictation', 'Today\'s melodies have 6 notes, over a ii-V-I.'),
      ] },
      { week: 13, steps: [
        voicings(13, 1, 'twoHand', 'Two-hand voicings', 'Play a shell with your left hand and add the 9th and the 5th above it with your right hand. Two hands give a fuller, richer chord, the way a pianist sounds when there is no other instrument playing chords.'),
        improvise(13, 'ladyBeGood', 'Improvise with short cells over each ii-V-I: the pattern 1-2-3-5 of each chord, and the arpeggio licks you have learnt. Cells are small building blocks that you can join into longer lines.', { bpm: 90, done: 'one chorus improvised' }),
        licks(13, 'Licks from standards: ii-V-I major', 'Today\'s licks are ii-V-I phrases taken from the melodies of standards.'),
        ear(13, 'progression', 'Today\'s progressions are ii-V-I\'s and I-vi-ii-V turnarounds.'),
      ] },
      { week: 14, steps: [
        hands(14, 1, 'line;progression=minor ii-V-i;move=fourthUp;keys=12;line=guide2', 'Play shells with your left hand and two guide tones per chord with your right hand, through minor ii-V-i\'s. In a minor key the ii chord is half-diminished and the V chord often takes a ♭9: you will study them properly in the next unit.', { check: 'both', bpm: 80 }),
        ...song(14, 'honeysuckle', 1, { bpm: 90 }),
        ...song(14, 'honeysuckle', 2, { bpm: 90 }),
        licks(14, 'Licks: Arpeggios', 'Today\'s licks are built on arpeggios: the notes of the chord played one after another.', 90),
        ear(14, 'dictation', 'Today\'s melodies have 6 notes.'),
      ] },
      { week: 15, steps: [
        hands(15, 1, 'line;move=fourthUp;keys=12;line=chordScales', 'Play eighth notes through the scale of each chord, both hands together, starting each chord on one of its chord tones. This is the raw material of bebop lines.', { bpm: 80 }),
        ...song(15, 'honeysuckle', 3, { bpm: 100, done: 'the head at 100 BPM' }),
        licks(15, 'Licks: Approach notes', 'Today\'s licks use approach notes: chord tones reached from a half step away, above or below.', 90),
        ear(15, 'progression', 'Today\'s progressions are minor ii-V-i\'s.'),
      ] },
      { week: 16, steps: [
        voicings(16, 1, 'shell', 'ii-V-I shells in 12 keys', 'Play shell voicings through every key, slowly. Reading the chords as they come, rather than from memory, is the skill this drill trains.', 60),
        improvise(16, 'honeysuckle', 'Improvise one chorus over the ragtime bass (or over shells if the jumps are still too hard), with the head before and after.', { bpm: 100, done: 'the head, one chorus, the head' }),
        introEnding(16, 'honeysuckle', { bpm: 100 }),
        ear(16, 'dictation', 'Today\'s melodies have 8 notes.'),
      ] },
      { week: 'sub3', steps: substitutionWeek('sub3', {
        sub: 'tritone', exercise: 'line;progression=tritone;move=fourthUp;keys=12;line=guide3', song: 'honeysuckle', bpm: 100,
        hear: 'Before F, the band now plays G♭7 instead of C7: the dominant a tritone away. G♭7 has the same 3rd and 7th as C7 (B♭ and E, which G♭7 spells F♭), so it leads to F just as well, and the bass now falls by half steps: G, G♭, F. The song already does this once by itself, with A♭−7 D♭7 before G−7.',
        play: 'Where the band plays G♭7, your ragtime bass plays G♭ (then D♭), and the chord in the middle keeps B♭ and E (F♭).',
        improvise: 'Over G♭7, play the guide tones of C7 (B♭ and E): they still fit, because the two chords share them. Then try the G♭ major triad and listen to it fall to F.',
        ear: ['progression', 'Listen for the difference between a ii-V-I and the same progression with its tritone substitution.'],
      }) },
    ],
  },
  {
    id: 'uMinor', title: 'The minor ii-V-i',
    goal: 'Play the minor ii-V-i with shells and guide tones in all keys, and a song in a minor key with both hands.',
    source: 'Mark Levine, The Jazz Piano Book (ch. 9, minor scale harmony); Jeremy Siskind, Jazz Piano Fundamentals; Open Music Theory, the minor ii-V-i',
    weekList: [
      { week: 'minor1', steps: [
        hands('minor1', 1, 'arpeggio;chord=half;notes=1-3-5-7', 'Play half-diminished chords as arpeggios, both hands together, round the circle of fourths. A half-diminished chord (ø7) is a minor 7th chord with a flat 5th: on C, C E♭ G♭ B♭. It is the ii chord of a minor key.'),
        hands('minor1', 2, 'scale;scale=Harmonic minor', 'Play the harmonic minor scale up and down, both hands together. It is the minor scale with its 7th raised a half step (on C: C D E♭ F G A♭ B). The raised 7th gives the V chord of a minor key its major 3rd, the leading tone that pulls towards the tonic.', { times: 4, keyStep: FOURTH }),
        ...song('minor1', 'loveMe', 1, { bpm: 100 }),
        ...song('minor1', 'loveMe', 2, { bpm: 100 }),
        improvise('minor1', 'loveMe', 'Improvise with the A minor pentatonic over the A minor bars, and the C major pentatonic over the C major bars. Leave space: two bars of music, then two bars of rest.', { bpm: 100 }),
        ear('minor1', 'progression', 'Today\'s progressions mix minor ii-V-i\'s and major ii-V-I\'s. The minor ones sound darker: listen for the half-diminished ii and the ♭9 of the V.'),
      ] },
      { week: 'minor2', steps: [
        hands('minor2', 1, 'line;progression=minor ii-V-i;move=fourthUp;keys=12;line=guide7', 'Play shells with your left hand and guide tones with your right hand, starting from the 7th of the ii, through minor ii-V-i\'s in all keys.', { check: 'both', bpm: 80 }),
        hands('minor2', 2, 'scale;scale=Phrygian dominant', 'Play the Phrygian dominant scale up and down, both hands together. It is Mixolydian with a flat 9th and a flat 13th (on C: C D♭ E F G A♭ B♭), and it is the fifth mode of the harmonic minor scale. It is the sound of the V chord in a minor key.', { times: 4, keyStep: FOURTH }),
        ...song('minor2', 'loveMe', 3, { bpm: 100, done: 'the head at 100 BPM with shells' }),
        improvise('minor2', 'loveMe', 'Over each E7, play its ♭9 (F) and let it fall a half step to E, the 5th of A−7. Lines that resolve like this make the minor ii-V-i sound complete.', { bpm: 100 }),
        ear('minor2', 'dictation', 'Today\'s melodies have 6 notes, in a minor key.'),
      ] },
      { week: 'minor3', steps: [
        hands('minor3', 1, 'scale;scale=Locrian #2', 'Play the Locrian ♮2 scale up and down, both hands together. It is the scale of the half-diminished chord: the Locrian mode with a natural 2nd (on C: C D E♭ F G♭ A♭ B♭).', { times: 4, keyStep: FOURTH }),
        hands('minor3', 2, 'line;progression=minor ii-V-i;move=fourthUp;keys=12;line=chordScales', 'Play eighth notes through the three scales of the minor ii-V-i, both hands together: Locrian ♮2 over the ii, Phrygian dominant over the V, and the minor scale over the i.', { bpm: 90 }),
        licks('minor3', 'Licks from standards: minor ii-V-i', 'Today\'s licks are minor ii-V-i phrases from standards.', 90),
        improvise('minor3', 'loveMe', 'In each minor ii-V-i, play one of the licks from the licks step, then a phrase of your own that answers it.', { bpm: 110 }),
        ear('minor3', 'progression', 'Today\'s progressions are minor ii-V-i\'s.'),
      ] },
      { week: 'minor4', steps: [
        hands('minor4', 1, 'line;progression=minor ii-V-i;move=fourthUp;keys=12;line=guide3', 'Review the minor ii-V-i in six keys: shells with your left hand, guide tones with your right hand.', { check: 'both', bpm: 90 }),
        ...song('minor4', 'loveMe', 3, { key: G, bpm: 110, done: 'in G (E minor) at 110 BPM' }).slice(1),
        improvise('minor4', 'loveMe', 'Improvise one chorus over the shells, with the head before and after.', { key: G, bpm: 110, done: 'the head, one chorus, the head' }),
        introEnding('minor4', 'loveMe', { bpm: 100 }),
        ear('minor4', 'dictation', 'Today\'s melodies have 8 notes, in a minor key.'),
      ] },
    ],
  },
  {
    id: 'u4', title: 'Song form and Rhythm Changes',
    goal: 'Keep your place in a 32-bar form while comping and improvising.',
    source: 'Kelly and Rasmussen, Book 1, Module 4 (song form, What Is This Thing Called Love?, melodic embellishment); Rhythm Changes added for the course',
    weekList: [
      { week: 17, steps: [
        hands(17, 1, 'line;progression=I-vi-ii-V;line=guide3', 'Play the I-vi-ii-V turnaround with shells in your left hand and guide tones in your right hand. Turnarounds are the two-bar progressions that take a song back to its beginning, and you will find them everywhere in this unit\'s songs.', { check: 'both', bpm: 80 }),
        ...song(17, 'justYou', 1, { bpm: 100 }),
        ...song(17, 'justYou', 2, { bpm: 100 }),
        ...song(17, 'justYou', 3, { bpm: 100, done: 'the head at 100 BPM without losing a bar' }),
        improvise(17, 'justYou', 'Improvise by embellishing the melody: play some of its notes a little early (anticipation) or a little late (delay). Jazz singers do this all the time; it is the first step from playing a melody to making it your own.', { bpm: 100 }),
        ear(17, 'progression', 'Today\'s progressions are turnarounds.'),
      ] },
      { week: 18, steps: [
        hands(18, 1, 'line;progression=rhythm changes;line=guide3', 'Play the A section of Rhythm Changes with shells in your left hand and guide tones in your right hand. The chords change twice a bar, so plan the smallest possible move from each chord to the next.', { check: 'both', bpm: 90 }),
        improvise(18, 'justYou', 'Alternate a phrase of the melody with a phrase of your own, all the way through the song.', { bpm: 100, done: 'one chorus with the band' }),
        ...song(18, 'gotRhythm', 1, { bpm: 100 }),
        ...song(18, 'gotRhythm', 2, { bpm: 100 }),
        ear(18, 'dictation', 'Today\'s melodies have 8 notes.'),
      ] },
      { week: 19, steps: [
        hands(19, 1, 'line;progression=rhythm changes;line=guide2', 'Play two guide tones per chord through the A section of Rhythm Changes, both hands together, as a smooth two-voice line.', { bpm: 100 }),
        ...song(19, 'gotRhythm', 3, { bpm: 110, done: 'the A sections at 110 BPM' }),
        licks(19, 'Licks: Neighbours and turns', 'Today\'s licks use turns: a note circled by its neighbours above and below before you land on it.', 100),
        ear(19, 'progression', 'Today\'s progressions come from Rhythm Changes.'),
      ] },
      { week: 20, steps: [
        hands(20, 1, 'line;progression=iii-VI-ii-V;line=guide3', 'Play the iii-VI-ii-V turnaround with shells and guide tones. It is a variation of I-vi-ii-V in which the iii chord replaces the I and the VI becomes a dominant.', { check: 'both', bpm: 90 }),
        improvise(20, 'gotRhythm', 'Add approach notes to the melody. Then quote it: start a phrase with the first notes of the melody and continue in your own way. Quoting the melody helps the listener follow your solo.', { bpm: 110, done: 'the head, one chorus, the head' }),
        introEnding(20, 'gotRhythm', { bpm: 110 }),
        ear(20, 'dictation', 'Today\'s melodies have 8 notes.'),
      ] },
      { week: 21, steps: [
        hands(21, 1, 'line;progression=minor ii-V-i;move=fourthUp;keys=12;line=chordTones', 'Play the chord tones of each chord of the minor ii-V-i in eighth notes, through all keys, both hands together. This week\'s song is built on minor ii-V\'s, so this prepares you for it.', { bpm: 90 }),
        ...song(21, 'thisThing', 1, { bpm: 100 }),
        ...song(21, 'thisThing', 2, { bpm: 100, done: '90% of the notes right at 100 BPM' }),
        improvise(21, 'thisThing', 'Embellish the melody: anticipate and delay some notes, add approach notes, then answer each phrase of the melody with a phrase of your own.', { bpm: 100 }),
        ear(21, 'progression', 'Today\'s progressions are minor ii-V-i\'s.'),
      ] },
      { week: 22, steps: [
        voicings(22, 1, 'rootless', 'Rootless voicings', 'Play rootless voicings with your left hand: the 3rd, the 7th and the 9th (with the 5th or the 13th if you like), but no root, because the bass player plays it. They are the sound of modern jazz piano, and the pattern of What Is This Thing Called Love?', 60),
        ...song(22, 'thisThing', 3, { bpm: 100 }),
        improvise(22, 'thisThing', 'Improvise one chorus over the rootless voicings (or over shells), with the head before and after.', { bpm: 100, done: 'the head, one chorus, the head' }),
        ear(22, 'dictation', 'Today\'s melodies have 8 notes.'),
      ] },
      { week: 'sub4', steps: substitutionWeek('sub4', {
        sub: 'passingDim', exercise: 'line;progression=passing dim;line=guide3', song: 'gotRhythm', bpm: 110,
        hear: 'In the A sections, the band now plays B°7 between B♭ and C−7: a diminished chord a half step above the I, leading up to the ii, as in most recordings of Rhythm Changes. The bass walks up by half steps: B♭, B, C.',
        play: 'Your walking bass goes B♭, B, C there.',
        improvise: 'Over B°7, play its arpeggio (B, D, F and A♭) going up, and let it lead into the root of C−7.',
        ear: ['progression', 'Listen for the bass walking up by half steps in Rhythm Changes.'],
      }) },
    ],
  },
  {
    id: 'uAltered', title: 'Altered dominants',
    goal: 'Hear and play the b9 and b13 of a dominant chord: in rootless voicings, and in lines that resolve them.',
    source: 'Mark Levine, The Jazz Piano Book (ch. 8, altering notes in left-hand voicings; ch. 9, melodic minor and diminished scale harmony); Jeremy Siskind, Jazz Piano Fundamentals, Book 1 (units 10 to 12)',
    weekList: [
      { week: 'alt1', steps: [
        hands('alt1', 1, 'line;progression=ii-V7b9-I;move=fourthUp;keys=12;line=guide3', 'Play shells with your left hand and guide tones with your right hand through ii-V7♭9-I\'s, and listen for the ♭9 of the V in the band\'s chords. The ♭9 adds tension that resolves when the I arrives.', { check: 'both', bpm: 80 }),
        hands('alt1', 2, 'scale;scale=Half-whole diminished', 'Play the half-whole diminished scale up and down, both hands together. It alternates half steps and whole steps (on C: C D♭ E♭ E F♯ G A B♭), so it contains the ♭9, the ♯9 and the natural 13th. Use it over a V7♭9 that goes to a major chord.', { times: 4, keyStep: FOURTH }),
        voicings('alt1', 3, 'rootless', 'Rootless voicings with alterations', 'Play rootless voicings in which the dominant chords are altered: a 7♭9 chord takes the ♭9 instead of the 9th, and a 7♭9♭13 chord also takes the ♭13 instead of the 13th. The endless line adds some altered chords by itself.', 70),
        ...song('alt1', 'thisThing', 3, { bpm: 110, subs: ['altered'], title: 'What Is This Thing Called Love? with altered dominants',
          what: 'The band now plays the dominant chords with their ♭9 (and with the ♭13 when they lead to a minor chord). Play these alterations in your rootless voicings too.', done: 'the head at 110 BPM, the altered dominants included' }),
        ear('alt1', 'progression', 'Today\'s progressions compare V7 and V7♭9: listen for the darker sound of the ♭9.'),
      ] },
      { week: 'alt2', steps: [
        hands('alt2', 1, 'line;progression=minor ii-V7b9b13-i;move=fourthUp;keys=12;line=guide2', 'Play shells with your left hand and two guide tones per chord with your right hand through minor ii-V7♭9♭13-i\'s.', { check: 'both', bpm: 80 }),
        hands('alt2', 2, 'scale;scale=Altered', 'Play the altered scale up and down, both hands together. It contains every alteration of a dominant chord: the ♭9, the ♯9, the ♯11 and the ♭13. It is the melodic minor scale started a half step above the root (C altered is D♭ melodic minor).', { times: 4, keyStep: FOURTH }),
        improvise('alt2', 'thisThing', 'Work on tension and release: over each altered dominant, play its ♭9 or its ♭13, then resolve it down a half step into the next chord.', { bpm: 110, subs: ['altered'] }),
        ear('alt2', 'dictation', 'Today\'s melodies have 8 notes.'),
      ] },
      { week: 'alt3', steps: [
        hands('alt3', 1, 'line;progression=ii-V7b9-I;move=fourthUp;keys=12;line=chordScales', 'Play eighth notes through the scale of each chord, both hands together, using the V\'s scale with its ♭9.', { bpm: 90 }),
        ...song('alt3', 'loveMeAltered', 3, { bpm: 110, subs: ['altered'], title: 'Love Me Or Leave Me with altered dominants', done: 'the head at 110 BPM with rootless voicings' }),
        improvise('alt3', 'loveMeAltered', 'Over each E7♭9♭13, play F (its ♭9) moving down to E, and C (its ♭13) held into A−7, where it becomes the 3rd of the new chord. One note, two meanings: that is the magic of resolution.', { bpm: 110, subs: ['altered'] }),
        ear('alt3', 'progression', 'Today\'s progressions are minor ii-V-i\'s.'),
      ] },
      { week: 'alt4', steps: [
        hands('alt4', 1, 'line;progression=minor ii-V7b9b13-i;move=fourthUp;keys=12;line=chordScales', 'Play eighth notes through the scales of the minor ii-V7♭9♭13-i, both hands together.', { bpm: 90 }),
        improvise('alt4', 'loveMeAltered', 'Improvise one chorus in which every dominant chord has an altered note in your line, resolved each time into the next chord.', { bpm: 120, subs: ['altered'], done: 'the head, one chorus, the head' }),
        introEnding('alt4', 'thisThing', { bpm: 110 }),
        ear('alt4', 'dictation', 'Today\'s melodies have 8 notes.'),
      ] },
    ],
  },
  {
    id: 'uMinorBlues', title: 'The minor blues',
    goal: 'Play a minor blues with rootless voicings and a walking bass, and improvise over it for several choruses with a shape.',
    source: 'Kerry Politzer, Beginning Jazz Piano (the minor blues module); Duke Ellington and Bubber Miley, Black and Tan Fantasy (1927); Mark Levine, The Jazz Piano Book',
    weekList: [
      { week: 'mblues1', steps: [
        hands('mblues1', 1, 'line;progression=minor blues;line=guide3', 'Play shells with your left hand and the guide-tone line through the minor blues with your right hand.', { check: 'both', bpm: 80 }),
        ...song('mblues1', 'minorBlues', 1, { bpm: 100 }),
        ...song('mblues1', 'minorBlues', 2, { bpm: 100 }),
        improvise('mblues1', 'minorBlues', 'Improvise with the C minor pentatonic and the C blues scale over every chord. In a minor blues these scales are the notes of the key, so nothing clashes. Repeat a riff, changing it a little each time.', { bpm: 100 }),
        ear('mblues1', 'progression', 'Today\'s progressions are minor blues. Listen for the ♭VI7 and the V7 in bars 9 and 10.'),
      ] },
      { week: 'mblues2', steps: [
        hands('mblues2', 1, 'line;progression=minor blues;line=guide2', 'Play two guide tones per chord through the minor blues, both hands together.', { check: 'both', bpm: 90 }),
        ...song('mblues2', 'minorBlues', 3, { bpm: 110, done: '2 choruses at 110 BPM with rootless voicings' }),
        improvise('mblues2', 'minorBlues', 'Now follow the chords: Dorian over C−7 and F−7, Mixolydian over A♭7, and the ♭9 and ♭13 over G7♭9♭13.', { bpm: 110 }),
        ear('mblues2', 'dictation', 'Today\'s melodies have 8 notes, in a minor key.'),
      ] },
      { week: 'mblues3', steps: [
        hands('mblues3', 1, 'line;progression=minor blues;line=chordScales', 'Play eighth notes through the scales of the minor blues, both hands together.', { bpm: 90 }),
        ...song('mblues3', 'blackTan', 1, { bpm: 100 }),
        ...song('mblues3', 'blackTan', 2, { bpm: 100 }),
        improvise('mblues3', 'blackTan', 'The first 12 bars are a minor blues in B♭ minor: improvise there with the B♭ minor pentatonic and the B♭ blues scale. The second strain turns to B♭ major, so change to the major scale there.', { bpm: 100 }),
        ear('mblues3', 'progression', 'Today\'s progressions mix major and minor blues.'),
      ] },
      { week: 'mblues4', steps: [
        hands('mblues4', 1, 'line;progression=minor blues;line=guide7', 'Play the guide-tone line through the minor blues starting from the 7th, both hands together.', { check: 'both', bpm: 100 }),
        ...song('mblues4', 'blackTan', 3, { bpm: 110, done: 'the whole tune with a walking bass at 110 BPM' }),
        improvise('mblues4', 'minorBlues', 'Improvise three choruses with a shape: the first low and sparse, the second higher and busier, the third the highest and busiest, then play the head. A solo that builds like this tells a story.', { bpm: 110, done: 'the head, 3 choruses, the head' }),
        introEnding('mblues4', 'minorBlues', { bpm: 100 }),
        selfCheck('mblues4', 'Record a minor blues', 'Record yourself playing the intro, the head, three improvised choruses, the head and the ending. Listen back the next day and check the boxes below.',
          ['I recorded it', 'My solo had a shape: from low and sparse to high and busy', 'I kept the form', 'I listened back']),
        ear('mblues4', 'dictation', 'Today\'s melodies have 8 notes.'),
      ] },
    ],
  },
  {
    id: 'u5', title: 'Ballad and bossa',
    goal: 'Play slowly and evenly, and feel the bossa.',
    source: 'Added for the course; rootless voicings from Mark Levine, The Jazz Piano Book (ch. 7); styles from the band',
    weekList: [
      { week: 23, steps: [
        voicings(23, 1, 'rootless', 'Rootless voicings, faster', 'Play rootless voicings again, a little faster. They are the pattern of this week\'s ballad, Embraceable You.', 70),
        ...song(23, 'embraceable', 1, { bpm: 60 }),
        ...song(23, 'embraceable', 2, { bpm: 60, timing: 60, done: 'even notes, without rushing: 90% right at 60 BPM, on time within 60 ms on average' }),
        improvise(23, 'embraceable', 'Improvise with long notes and space: let a note ring for a whole bar, and listen to it against the chords.', { bpm: 60 }),
        ear(23, 'dictation', 'Today\'s melodies have 6 notes and are played slowly.'),
      ] },
      { week: 24, steps: [
        voicings(24, 1, 'rootless', 'Rootless voicings in 6 keys', 'Play rootless voicings through six keys, faster than last week.', 80),
        ...song(24, 'embraceable', 3, { bpm: 60, done: 'one whole chorus at 60 BPM' }),
        improvise(24, 'embraceable', 'Improvise for 8 bars, then play the melody. Among the long notes, play one phrase in double time (twice as fast), then come back to long notes. The contrast makes both sound better.', { bpm: 60 }),
        introEnding(24, 'embraceable', { bpm: 60 }),
        ear(24, 'progression', 'Today\'s progressions come from ballads.'),
      ] },
      { week: 25, steps: [
        voicings(25, 1, 'twoHand', 'Bossa comping with two hands', 'Play two-hand voicings, then try them in the bossa nova rhythm while the band plays.', 100),
        ...song(25, 'wonderful', 1, { bpm: 120 }),
        ...song(25, 'wonderful', 2, { bpm: 120 }),
        ...song(25, 'wonderful', 3, { bpm: 120, done: 'the head at 120 BPM' }),
        improvise(25, 'wonderful', 'Improvise with short rhythmic motifs two bars long, repeated and varied. The bossa has straight (not swung) eighth notes: keep them even.', { bpm: 120 }),
        ear(25, 'dictation', 'Today\'s melodies have 8 notes.'),
      ] },
      { week: 26, steps: [
        hands(26, 1, 'line;move=fourthUp;keys=12;line=chordScales', 'Review the chord scales of the ii-V-I in eighth notes, both hands together, this time at a faster tempo.', { bpm: 100 }),
        improvise(26, 'wonderful', 'Improvise one chorus over the bossa, with the head before and after.', { bpm: 120, done: 'the head, one chorus, the head' }),
        ...song(26, 'teaForTwo', 2, { bpm: 120, done: 'the head in bossa' }),
        ear(26, 'progression', 'Today is a review of all the progressions so far.'),
      ] },
    ],
  },
  {
    id: 'u6', title: 'Modal playing',
    goal: 'Improvise in phrases over long chords.',
    source: 'Added for the course; chord scales from Open Music Theory, fourth chords from Mark Levine, The Jazz Piano Book',
    weekList: [
      { week: 27, steps: [
        voicings(27, 1, 'quartal', 'Quartal voicings', 'Play quartal voicings: chords built from notes stacked in 4ths, taken from the chord\'s scale. They sound open and modern, and they are the sound of modal jazz.', 80),
        hands(27, 2, 'scale;scale=Dorian;pattern=thirds;direction=up', 'Play the Dorian scale in thirds (C E♭, D F, E♭ G and so on), both hands together. Thirds break up the scale and make it sound less like an exercise.', { bpm: 80, times: 4, keyStep: FOURTH }),
        ...song(27, 'modalStudy', 1, { bpm: 100 }),
        ...song(27, 'modalStudy', 2, { bpm: 100 }),
        improvise(27, 'modalStudy', 'Improvise in phrases of two bars, each followed by two bars of rest. Over a long chord there is no harmony to guide you, so phrasing is what gives the music its shape.', { bpm: 100, done: '2 minutes without stopping at 100 BPM' }),
        ear(27, 'dictation', 'Today\'s melodies have 8 notes.'),
      ] },
      { week: 28, steps: [
        hands(28, 1, 'scale;scale=Mixolydian', 'Play the Mixolydian scale up and down, both hands together, then the minor pentatonic. Mixolydian is the major scale with a flat 7th (on C: C D E F G A B♭), the scale of the dominant 7th chord.', { bpm: 100, times: 4, keyStep: FOURTH }),
        ...song(28, 'modalStudy', 3, { bpm: 100, done: 'one whole chorus with the band' }),
        improvise(28, 'modalStudy', 'Improvise with the Dorian scale and the minor pentatonic. Try moving between them: the pentatonic sounds open, Dorian adds colour with its 6th.', { bpm: 100 }),
        licks(28, 'Licks: Scale lines', 'Today\'s licks are scale lines: phrases that run along the chord\'s scale.', 100),
        ear(28, 'progression', 'Today is a review of all the progressions so far.'),
      ] },
      { week: 29, steps: [
        voicings(29, 1, 'quartal', 'Quartal voicings, review', 'Play quartal voicings through endless progressions, at a faster tempo.', 100),
        improvise(29, 'modalStudy', 'Improvise two choruses. Take one motif up a half step when the bridge moves to E♭−7, and bring it back down afterwards.', { bpm: 110, done: 'the head, 2 choruses, the head' }),
        ear(29, 'dictation', 'Today\'s melodies have 8 notes.'),
      ] },
    ],
  },
  {
    id: 'review', title: 'Review',
    goal: "Each unit's last song in a key not used yet, 10 to 20 BPM faster, then a recording of a blues and of a standard.",
    source: "As in Kelly and Rasmussen's module projects",
    weekList: [
      { week: 30, steps: [
        ...song(30, 'avalon', 3, { key: Bb, bpm: 100, done: 'in B♭ at 100 BPM' }).slice(1),
        ...song(30, 'tinRoof', 3, { key: F, bpm: 100, done: 'in F at 100 BPM' }).slice(1),
        ...song(30, 'honeysuckle', 3, { key: C, bpm: 110, done: 'in C at 110 BPM' }).slice(1),
        ...song(30, 'gotRhythm', 3, { key: Eb, bpm: 120, done: 'in E♭ at 120 BPM' }).slice(1),
        ...song(30, 'embraceable', 3, { key: F, bpm: 70, done: 'in F at 70 BPM' }).slice(1),
        ...song(30, 'modalStudy', 3, { key: G, bpm: 120, done: 'a fourth higher at 120 BPM' }).slice(1),
        selfCheck(30, 'Record a blues and a standard', 'Record a blues and a standard, each with the head, a chorus of comping, a solo and the head again. Then start again at Unit 1, faster: the program is a loop, not a ladder, and every time round the same songs teach you something new.',
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

/** The unit and week a step is in (none for a step not in the program). */
export function placeOf(step: LessonStep): { unit: LessonUnit; week: number } | null {
  for (const unit of PROGRAM) for (const week of unit.weekList) if (week.steps.includes(step)) return { unit, week: week.week }
  return null
}
