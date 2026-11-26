# Lessons

The **Lessons** tab (main menu; the home screen also offers today's lesson) is a
46-week jazz piano program: about 11 months
at 20 to 30 minutes a day, 5 days a week, for a pianist who reads music and has
a MIDI keyboard. The program is in `studio/src/lessons/program.ts`; this page
says what it holds, how the screens are set up from it, and where it comes
from.

- [The program](#the-program)
- [How a song is learnt](#how-a-song-is-learnt)
- [Substitution weeks](#substitution-weeks)
- [Minor, altered and minor blues](#minor-altered-and-minor-blues)
- [Intros and endings](#intros-and-endings)
- [Building a solo](#building-a-solo)
- [Steps and their links](#steps-and-their-links)
- [Progress](#progress)
- [Songs](#songs)
- [Sources](#sources)

## The program

Nine units and a review, each unit bringing 1 to 3 songs and most songs one new
left-hand pattern. Every week has the four parts of a session: **hands
together** (6 to 8 minutes), **the song** (10 to 12), **improvising** (4 to 6)
and **ear training** (2 to 4).

| Unit | Weeks | Theme | Songs |
|---|---|---|---|
| 1 | 1 to 5 | Time, chords and the first song | Avalon (in F, then C); week 5: adding the ii |
| 2 | 6 to 12 | The 12-bar blues | Study Blues, Tin Roof Blues; week 12: the secondary dominant |
| 3 | 13 to 19 | The ii-V-I | Oh Lady Be Good, Honeysuckle Rose; week 19: the tritone substitution |
| 4 | 20 to 23 | The minor ii-V-i | Love Me or Leave Me |
| 5 | 24 to 30 | Song form and Rhythm Changes | Just You, Just Me; I Got Rhythm; What Is This Thing Called Love?; week 30: the passing diminished chord |
| 6 | 31 to 34 | Altered dominants | What Is This Thing Called Love? and Love Me or Leave Me, their dominants with the ♭9 (and ♭13) |
| 7 | 35 to 38 | The minor blues | Minor Study Blues, Black and Tan Fantasy |
| 8 | 39 to 42 | Ballad and bossa | Embraceable You, 'S Wonderful, Tea for Two |
| 9 | 43 to 45 | Modal playing | Modal Study |
| Review | 46 | Each unit's last song in a new key, faster; a recording of a blues and a standard | |

The units and weeks are numbered from the program (`numberWeeks`; `unitName`
gives "Unit 5" from a unit's id): a step's id keeps the week it was first
written in (`w23-embraceable2`, now in week 39), and a unit keeps its id
(`u4` is now Unit 5), so the progress kept on the device stays when weeks are
added; the weeks added later have ids of their own (`sub1-...` to `sub4-...`,
`minor1-...`, `alt1-...`, `mblues1-...`).

Nothing is locked: any step can be opened at any time. Each step ends with a
concrete target ("90% right at 80 BPM") rather than "until you know it". On the
page, units start closed; an open unit shows one week at a time, with a tab for
each week. The units opened and the weeks shown are kept for the visit, so going
back from a step's screen finds the page as it was.

## How a song is learnt

Each song goes through the same stages, the right hand on the melody in Lead
Sheet Sightreading, the band's piano muted so the left hand is heard:

1. **Bass**: the root of each chord (Scoring > Left hand: Bass note only).
2. **Chords**: the whole chord on every beat (Whole chord on each beat).
3. **Pattern**: the song's left-hand pattern, first heard from the band's piano
   (a Listen step), then played in its rhythm (The piano pattern's rhythm).
4. **Improvise**: Free Improvisation over the song, the left hand keeping its
   pattern.

| Song | Left-hand pattern | Piano pattern id |
|---|---|---|
| Avalon | the root with an open 5th above it, on beats 1 and 3 (Siskind) | `open_fifths` |
| Study Blues | Charleston: the chord on 1 and on the "and" of 2 | `charleston` |
| Tin Roof Blues, I Got Rhythm | walking bass | `walking_bass` |
| Oh Lady Be Good | Type A shells: the root, the 3rd under the 7th from C3; long on 1, short on 3 (Siskind) | `type_a_shells` |
| Honeysuckle Rose | ragtime bass: the root and the 5th on 1 and 3, the chord on 2 and 4 (Winn) | `ragtime_bass` |
| Just You, Just Me | Type A shells in the Charleston rhythm: the whole shell on 1, the 3rd and 7th on the "and" of 2 (Siskind) | `type_a_charleston` |
| What Is This Thing Called Love? | rootless voicings in the Charleston rhythm, the 3rd or the 7th at the bottom, whichever moves least (Levine) | `rootless_charleston` |
| Love Me or Leave Me (Unit 4) | Type A shells; over the ø7, the root, 3rd and ♭5 (Siskind) | `type_a_shells` |
| Love Me or Leave Me (Unit 6), Minor Study Blues | rootless voicings in the Charleston rhythm, the dominants with the ♭9 and ♭13 written or played by the band | `rootless_charleston` |
| Black and Tan Fantasy | walking bass | `walking_bass` |
| Embraceable You | rootless voicings held for two beats (Levine) | `rootless_held` (Ballad) |
| 'S Wonderful, Tea for Two | bossa bass | `bossa_bass` (Bossa Nova) |
| Modal Study | fourth chords: three notes in 4ths from the 9th, held (Levine) | `fourths_from_ninth` |

The patterns are in `left_hand_patterns.py` (the Lessons tab entries), so they
are in the Piano pattern menu of the other screens too, under every style they
suit. They follow three books: Jeremy Siskind, *Playing Solo Jazz Piano* (2022)
for the bass notes and the Type A shells (the 3rd under the 7th, between C3
and G4); Mark Levine, *The Jazz Piano Book* (1989) for the rootless left-hand
voicings (chapter 7: four notes, the 3rd or the 7th at the bottom; chapter 8:
the ♭9, ♯9 and ♭13 of a dominant written in its symbol take the place of the
9th and 13th, as in the band's comping, one shared voicing table) and the
fourth chords; and Edward R. Winn, *How to Play Ragtime* (1913, public domain)
for the bass note and chord alternation, here with single bass notes instead of
octaves.

## Scales

Each unit brings one new scale idea and keeps the earlier ones:

| Unit | New idea |
|---|---|
| 1 | the major pentatonic of the key over the whole song; the chord's own notes on beat 1 |
| 2 | the key's minor pentatonic and blues scale over a whole blues; then each dominant 7th's Mixolydian |
| 3 | a ii-V-I as one scale: Dorian, Mixolydian and major share the notes of the I's major scale; guide tones |
| 4 | the minor ii-V-i as the minor key's harmonic minor: Locrian ♮2 over the ø7, Mixolydian ♭9 ♭13 over the V7; the ♭9 falling to the 5th of the i |
| 5 | a V7 going to a minor chord takes Mixolydian ♭9 ♭13; the bebop dominant scale over a V7 going to major |
| 6 | the altered dominant: half-whole over a 7♭9 going to major, the altered scale, the ♭9 and ♭13 resolved by a half step |
| 7 | the minor blues: the key's minor pentatonic and blues scale over every chord; Dorian over i−7 and iv−7 |
| 8 | a pentatonic on each chord's root (minor over a minor chord), long notes and space |
| 9 | Dorian over long minor chords; the minor pentatonic a 5th up |

Each lesson song has a **scale map** (`studio/src/lessons/scaleMaps.ts`): its
parts (bars), and for each part the scales to try, over which chords, and why,
in a few words. The map is shown on the song's improvising steps (the **Scale
ideas for this song** button, named in the key the step plays) and under the
sheet of Free Improvisation, following the part being played; a tap on a
chord there opens the chord helper, with the scales of that chord. Where the song
moves to another key that its chart does not mark, the map lists the passage
(`keys`), so the green notes of Free Improvisation take the scales of that key.
A part's bar numbers are those of the sheet, where a pickup counts as bar 1.
The idea order follows Kelly and Rasmussen (major, Dorian and Mixolydian first,
chord tones as the best notes, the blues scale with the blues).

## Steps and their links

Each step says what to do, why, how long and when it is done. Its **Start**
button opens a screen set up for it: the settings ride in the address
(`studio/src/lessons/lessonLink.ts`), e.g.
`/sightreading/lead-sheets?song=Avalon&bpm=70&check=both&leftHand=bass&mute=comp`,
and the screen applies those it knows when it opens, for that visit only: the
screen's own settings (Scoring, the lick playlists, the voicing) are left as
they were, unless you change one on the screen:

| Setting | Screens | What it does |
|---|---|---|
| `song` | Lead Sheet and Exercises Sightreading, Free Improvisation | opens the first song or exercise whose title starts with it |
| `exercise` | Exercises Sightreading | the settings of the exercise the step builds (`exercise=arpeggio;chord=dom7;notes=1-3-5-7`, [the builder](EXERCISES.md#the-exercise-builder)), locked for the step; `song` is its title |
| `key`, `bpm`, `style`, `pattern` | the same | the band for that song |
| `check`, `leftHand` | Lead Sheet and Exercises Sightreading | Scoring > Check and Left hand |
| `subs` | Lead Sheet and Exercises Sightreading, Free Improvisation | the chord substitutions the band plays, every chorus (`subs=addII`) |
| `frame` | Lead Sheet Sightreading | bars added before and after the head for an intro and an ending (`frame=avalon`, [Intros and endings](#intros-and-endings)) |
| `mute` | every screen with a band | parts muted in the Mixer at first |
| `playlist`, `infinite` | Lick Sightreading | the lick playlist; an endless line |
| `voicing`, `infinite` | Chord Sightreading | the voicing drill; an endless line |
| `step`, `goal` (with `bpm`, `timing`) | Lead Sheet, Exercises, Lick and Chord Sightreading, Name the progression, Melodic Dictation | the step to tick, and its target |

A step's address ends with `from=lessons` and carries the step's id (`step`,
also for steps without a target): the back button, the screen's title and the
"Target reached" line lead back to the step's page (`/lessons/step?id=...`),
not to the screen's menu; the page leads back to the Lessons tab, which opens
at that step again.

Hands-together steps use Scoring > Check > **Melody, hands together**; voicing
steps use Chord Sightreading's **Voicing** menu ([EXERCISES.md](EXERCISES.md)).
Steps the app cannot score (recording yourself) have a short **self-check** to
tick. Chord symbols in the titles and texts are written for reading (Cmaj7,
C−7, Cø7, ♭9) by `music/chordText.ts`; the links keep the song names the
screens look for. A hands-together step names its exercise by its settings
(`hands(week, n, 'scale;scale=Dorian', ...)` in `program.ts`): its title is made
from them, and the screen builds the exercise.

## Progress

The screen draws the program as a **path**: each unit a card with its number
(a trophy once complete), its progress, and a row of week circles: done (a
tick, in the second accent colour), the week of the next step (larger, in the
accent colour, a play sign), started (a ring), or to come (its number).
Clicking a circle opens the unit at that week; the week's steps are cards with
an icon and a colour for each kind (hands together, the song, improvising, ear,
self-check), a title and one sentence (the first of what to do), **Start** and
**Mark done**.

## A step's page

Start (on a step card or Today's lesson) opens the step's page
(`LessonStepPage.tsx`) before its exercise:

- **What to do**, in full sentences as a teacher would say it, when it is
  done, how long, its tempo and key. The first step of each song also tells
  the song's story and its form (blues, AABA, ABAC...). A short exercise
  (a scale, a rhythm) is played several times in a row, often a fourth higher
  each time (lessonLink `choruses` and `keyStep`), and its target counts every
  time through;
- **Why**: what it trains;
- **The theory** (`theory.ts`): up to three short cards, the most specific
  first: the progression or substitution, the scale, the song's left-hand
  pattern (on the song's stage 3 and its listening step), the chord or voicing,
  then the way of working. They are matched by the step's title, text, kind or
  link. Each has a picture written in C: a staff engraved by abcjs (a scale, a
  voicing on one or two staves, a pattern, a guide-tone line, a lick), or a
  progression as chord boxes with their Roman numerals (the ii-V-I, the minor
  ii-V-i, the jazz and minor blues, the turnarounds, Rhythm Changes, the
  substitutions). The page draws them in the step's key or any key chosen,
  with chord names or Roman numerals (`theoryMusic.ts`), and **Listen** plays
  each picture on the app's piano (`listen.ts`; the sound loads with the first
  press);
- the song's scale ideas, for an improvising step; the self-check, when it has
  one;
- **Understood, start** (opens the exercise set up for the step), Mark done,
  Back to the lessons;
- **References**: the unit's source and the books of its theory cards (Levine,
  Aebersold, Siskind, Ligon, Open Music Theory, PianoFitness...).
Today's lesson (the first step not done) heads the page as on the home screen.
Finishing a unit's last step earns a burst of colour (with the effects on).

A step with a target is **ticked by itself** when its screen reaches it
(`useLessonGoal`), and stays ticked:

- hands-together, song, lick and voicing steps ("90% right at 80 BPM", "every
  chord green"): the whole song or exercise judged (32 notes or 16 chords of an
  endless line), at least that percent right, at the step's tempo or faster;
  Embraceable You's stage 2 also wants the notes on time within 60 ms on
  average;
- ear training: a round of 10 questions of Name the progression with 8 right
  (the screen counts the round at its top: "3/10 answered · 2 correct"), or 20
  notes or more of Melodic Dictation with 80% right.

The screen then says so, with a way back to the step's page. The other steps
(listening, improvising, self-checks) are ticked with **Mark done**.

Steps marked done and ticked boxes are kept in the browser (or the phone app)
under `eartraining:lessons:progress`; the first step not done is suggested as
the next one. **Forget my progress** clears it; **Delete all my data** (main
menu) clears everything the app keeps.

## Songs

The lead sheets come from the shipped OpenEWLD set (published before 1931,
public domain in the US; Love Me or Leave Me, 1928, and Black and Tan Fantasy,
1927, among them), plus three study tunes written for the course
(`studio/scripts/build-lesson-songs.mjs`, built into
`studio/public/leadsheets/lessons.json` with `pnpm run lesson-songs`): **Study
Blues** (a riff on chord tones over a blues in F), **Minor Study Blues** (the
same idea over a minor blues in C minor) and **Modal Study** (AABA in D
Dorian, the bridge a half step up), and the refrain of **What Is This Thing
Called Love?** (1929): its melody is written out from the first edition's score
([IMSLP](https://imslp.org/wiki/What_Is_this_Thing_Called_Love%3F_(Porter,_Cole))),
its chords are the jazz changes most charts give (Gø7, C7♭9, Fm6, Fm6, Dø7,
G7♯5, Cmaj7; the bridge Cm7, F7, B♭maj7, A♭7, Dø7, G7), which fit the first
edition's piano part.
Summertime (1935) and Blue Moon (1934) are in the OpenEWLD set for extra
practice.

## Substitution weeks

Units 1, 2, 3 and 5 end with a week on one chord substitution, once the unit's song is
learnt with its pattern and improvised over: the band plays the substitute
(drawn in blue on the sheet, `subs` in the step's link; see the players'
Substitutions menu, [studio/README.md](../studio/README.md)).

| Week | Substitution | Song | The change |
|---|---|---|---|
| 5 | Adding the ii before a long V7 | Avalon | 4 bars of C7 become 2 of G−7 and 2 of C7: a first ii-V, before Unit 3 |
| 12 | Secondary dominant on the ii | Study Blues | the turnaround F7 D7 G−7 C7 becomes F7 D7 G7 C7 (the G−7 of bar 9 stays: the melody holds a B♭ over it) |
| 19 | Tritone substitution | Honeysuckle Rose | C7 before F becomes G♭7 (the song already has A♭−7 D♭7 before G−7) |
| 30 | Passing diminished chord | I Got Rhythm | B♭ B♭6 C−7 becomes B♭ B°7 C−7 in the A sections |

Each week has the same steps: an exercise of guide tones over the new chords
(both hands, Exercises Sightreading; built from the substitution's progression,
see [LICKS.md](LICKS.md#exercises)), hearing the song with the substitute, playing it with
the song's pattern on the new chords, improvising over it, and ear training.
The order follows the teaching sources: the ii-V before its substitutions,
the tritone substitution after the ii-V-I (Mark Levine's *The Jazz Piano Book*
puts it in chapter 6, after the major modes and the ii-V-I), and secondary
dominants and passing diminished chords as embellishing chords (Open Music
Theory's chapters on applied chords and on embellishing diminished chords,
before its chapter on substitutions). A substitution is left out where it
would clash with a long melody note.

## Minor, altered and minor blues

Three units bring the minor side of jazz harmony, each after what it needs:

- **Unit 4, the minor ii-V-i** (after the ii-V-I, before What Is This Thing
  Called Love?, whose A sections are minor ii-V-i): the ø7 chord and the
  harmonic minor scale, then the minor ii-V-i's guide tones in all keys, the
  Phrygian dominant (Mixolydian ♭9 ♭13) and Locrian ♮2 scales, and minor ii-V-i
  licks from standards, around **Love Me or Leave Me** (Donaldson, 1928), whose
  A sections are Bø7 E7 A−7 before turning to C major.
- **Unit 6, altered dominants** (after the rootless voicings of Unit 5): the
  band plays the Substitutions menu's **altered dominant** (`subs=altered`):
  each dominant going down a 5th takes its ♭9, and its ♭13 too before a minor
  chord, written G7♭9 or G7♭9♭13. The rootless voicings take those notes
  (Levine, chapter 8), and the right hand plays them in new exercises
  (ii-V7♭9-I and minor ii-V7♭9♭13-i in all keys), the half-whole and altered
  scales, and lines that resolve them by a half step, over What Is This Thing
  Called Love? and Love Me or Leave Me.
- **Unit 7, the minor blues**: a study tune written for the course, **Minor
  Study Blues** (C minor: i−7, iv−7, ♭VI7, V7♭9♭13, and the minor ii-V of the
  turnaround) with rootless voicings, then **Black and Tan Fantasy** (Ellington
  and Miley, 1927), a minor blues in B♭ minor followed by a strain in B♭ major,
  with a walking bass; new guide-tone exercises over the minor blues, and a
  recording to finish.

## Intros and endings

Intros and endings come back on eight songs rather than in one unit, so they
are practised again and again. Their step opens Lead Sheet Sightreading with the
song **framed** (`frame` in the step's link, `studio/src/lessons/introEndings.ts`):
bars added before the head and after it, their chords written and no melody, so
the intro and the ending have a fixed number of bars and the band plays them
with you (its piano muted, so your left hand is heard). The framed sheet exists
for that visit only: the catalog keeps the song as it is. A song starting with
a pickup bar (no chord) takes the intro's last chord in that bar. The step says
what an intro and an ending are for, and how to build this one:

| Week | Song | Intro | Ending |
|---|---|---|---|
| 4 | Avalon | the last 4 bars of the song (4 bars) | the last 4 bars again, the I as a 6th chord, held (4 bars) |
| 11 | Tin Roof Blues | a turnaround twice, I VI ii V (4 bars) | ♭II7 then I (2 bars) |
| 18 | Honeysuckle Rose | a vamp on the first ii-V (4 bars) | the "three times" tag: iii VI ii V twice, then I (5 bars) |
| 23 | Love Me or Leave Me | a vamp on the minor ii-V, aiming for the ♭9 (4 bars) | the iv minor to the I, twice (4 bars) |
| 27 | I Got Rhythm | I vi ii V, then a minor ii-V into the verse (4 bars) | ♭VI7, ♭II7, I (4 bars) |
| 34 | What Is This Thing Called Love? | a vamp on the first ii-V, with its ♭9 (4 bars) | the "three times" tag with altered dominants (5 bars) |
| 38 | Minor Study Blues | the last 4 bars of the blues (4 bars) | ♭VI7, V7, i−6 (4 bars) |
| 40 | Embraceable You | the last 2 bars and a turnaround (4 bars) | the iv minor to the I^7 (3 bars) |

## Building a solo

Each unit's improvising brings one tool to build a solo, kept afterwards (after
Hal Crook's *How to Improvise*, one thing at a time, and Jamey Aebersold's
*How to Play Jazz and Improvise*, developing creativity):

| Unit | Tool |
|---|---|
| 1 | space: 2 bars played, 2 bars of rest; each phrase answers the one before (call and response) |
| 2 | rhythm first: two notes, only the rhythm changing; a riff repeated as the chords change |
| 3 | motifs: a 2-bar idea played again, then moved to fit the next ii-V-I |
| 4 | lines that land on the i: the ♭9 of the V falling to the 5th of the i |
| 5 | quoting the melody, then going your own way; approach notes |
| 6 | tension and release: an altered note on each dominant, resolved by a half step |
| 7 | a shape over 3 choruses: low and sparse, then higher and busier |
| 8 | one double-time phrase among long notes |
| 9 | a motif moved up a half step with the bridge, and back |

## Sources

- The order of Units 1 to 4, the drills and the step lists for the blues and
  song form: Keith B. Kelly and Eric Rasmussen,
  [A Guide to Exploring Jazz Improvisation, Book 1](https://open.maricopa.edu/exploringjazzimprovisationbook1/)
  (Maricopa Open Digital Press, 2023, CC BY 4.0), in our own words.
- ii-V-I and chord scales: [Open Music Theory](https://viva.pressbooks.pub/openmusictheory/part/jazz/)
  (CC BY-SA 4.0), ideas only.
- The order of the voicings (bass, shells, rootless, fourths): jazz-piano
  method books (Jeremy Siskind, *Jazz Piano Fundamentals*), pacing only,
  nothing copied.
- The left-hand patterns: Jeremy Siskind, *Playing Solo Jazz Piano* (2022:
  bass notes with an open 5th, Type A shells), Mark Levine, *The Jazz Piano
  Book* (Sher Music, 1989: the rootless left-hand voicings of chapter 7, fourth
  chords) and Edward R. Winn, *How to Play Ragtime* (1913, public domain: bass
  note and chord); the patterns are written in our own notes, nothing copied.
- The minor ii-V-i and the altered dominants: Mark Levine, *The Jazz Piano
  Book* (chapter 8, altering notes in left-hand voicings; chapter 9, melodic
  minor and diminished scale harmony); Jeremy Siskind, *Jazz Piano
  Fundamentals*, Book 1 (its units on altered dominants), pacing only.
- The minor blues: Kerry Politzer, *Beginning Jazz Piano* (its minor blues
  module), pacing only.
- Building a solo: Hal Crook, *How to Improvise* (Advance Music, 1991), and
  Jamey Aebersold, *How to Play Jazz and Improvise* (Volume 1), ideas only.
- The substitutions: Mark Levine, *The Jazz Piano Book* (1989, chapter 6,
  tritone substitution) and *The Jazz Theory Book* (1995, reharmonisation);
  [Open Music Theory](https://viva.pressbooks.pub/openmusictheory/chapter/substitutions/),
  "Substitutions"; ideas only.
- Rhythm Changes (Unit 5) and Units 8 and 9 are added for the course; Kelly
  and Rasmussen's Module 3 works on ii-V-I through "Solar", and their Module 4
  on What Is This Thing Called Love?
- The note colours of Free Improvisation follow
  [Impro-Visor](https://github.com/Impro-Visor/Impro-Visor) (GPL-2.0-or-later),
  ideas only.
