# Lessons

The **Lessons** tab (main menu) is a 30-week jazz piano program: about 7 months
at 20 to 30 minutes a day, 5 days a week, for a pianist who reads music and has
a MIDI keyboard. The program is in `studio/src/lessons/program.ts`; this page
says what it holds, how the screens are set up from it, and where it comes
from.

- [The program](#the-program)
- [How a song is learnt](#how-a-song-is-learnt)
- [Steps and their links](#steps-and-their-links)
- [Progress](#progress)
- [Songs](#songs)
- [Sources](#sources)

## The program

Six units and a review, each unit bringing 2 or 3 songs and each song one new
left-hand pattern. Every week has the four parts of a session: **hands
together** (6 to 8 minutes), **the song** (10 to 12), **improvising** (4 to 6)
and **ear training** (2 to 4).

| Unit | Weeks | Theme | Songs |
|---|---|---|---|
| 1 | 1 to 4 | Time, chords and the first song | Avalon (in F, then C) |
| 2 | 5 to 10 | The 12-bar blues | Study Blues, Tin Roof Blues |
| 3 | 11 to 16 | The ii-V-I | Oh Lady Be Good, Honeysuckle Rose |
| 4 | 17 to 22 | Song form and Rhythm Changes | Just You, Just Me; I Got Rhythm; What Is This Thing Called Love? |
| 5 | 23 to 26 | Ballad and bossa | Embraceable You, 'S Wonderful, Tea for Two |
| 6 | 27 to 29 | Modal playing | Modal Study |
| Review | 30 | Each unit's last song in a new key, faster; a recording of a blues and a standard | |

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
| Avalon | two-feel: root, then 5th, in half notes | `two_feel` |
| Study Blues | Charleston: the chord on 1 and on the "and" of 2 | `charleston` |
| Tin Roof Blues, I Got Rhythm | walking bass | `walking_bass` |
| Oh Lady Be Good | bass shells: root, 3rd, 7th | `bass_shells` |
| Honeysuckle Rose | light stride: bass on 1 and 3, shells on 2 and 4 | `light_stride` |
| Just You, Just Me | shells in the Charleston rhythm, with an anticipation | `shells_charleston` |
| What Is This Thing Called Love? | two-note shells: root and 7th, root and 10th | `two_note_shells` |
| Embraceable You | broken chord: root, 5th, 10th | `broken_tenths` (Ballad) |
| 'S Wonderful, Tea for Two | bossa bass | `bossa_bass` (Bossa Nova) |
| Modal Study | quartal pad: stacked 4ths | `quartal_pad` |

The new patterns are in `left_hand_patterns.py` (the Lessons tab entries), so
they are in the Piano pattern menu of every screen too.

## Scales

Each unit brings one new scale idea and keeps the earlier ones:

| Unit | New idea |
|---|---|
| 1 | the major pentatonic of the key over the whole song; the chord's own notes on beat 1 |
| 2 | the key's minor pentatonic and blues scale over a whole blues; then each dominant 7th's Mixolydian |
| 3 | a ii-V-I as one scale: Dorian, Mixolydian and major share the notes of the I's major scale; guide tones |
| 4 | a V7 going to a minor chord takes Mixolydian ♭9 ♭13; the bebop dominant scale over a V7 going to major |
| 5 | a pentatonic on each chord's root (minor over a minor chord), long notes and space |
| 6 | Dorian over long minor chords; the minor pentatonic a 5th up |

Each lesson song has a **scale map** (`studio/src/lessons/scaleMaps.ts`): its
parts (bars), and for each part the scales to try, over which chords, and why,
in a few words. The map is shown on the song's improvising steps (the **Scale
ideas for this song** button, named in the key the step plays) and under the
sheet of Free Improvisation, following the part being played. Where the song
moves to another key that its chart does not mark, the map lists the passage
(`keys`), so the green notes of Free Improvisation take the scales of that key.
A part's bar numbers are those of the sheet, where a pickup counts as bar 1. The idea order follows Kelly and
Rasmussen (major, Dorian and Mixolydian first, chord tones as the best notes,
the blues scale with the blues).

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
| `key`, `bpm`, `style`, `pattern` | the same | the band for that song |
| `check`, `leftHand` | Lead Sheet and Exercises Sightreading | Scoring > Check and Left hand |
| `mute` | every screen with a band | parts muted in the Mixer at first |
| `playlist`, `infinite` | Lick Sightreading | the lick playlist; an endless line |
| `voicing`, `infinite` | Chord Sightreading | the voicing drill; an endless line |
| `step`, `goal` (with `bpm`, `timing`) | Lead Sheet, Exercises, Lick and Chord Sightreading, Name the progression, Melodic Dictation | the step to tick, and its target |

Hands-together steps use Scoring > Check > **Melody, hands together**; voicing
steps use Chord Sightreading's **Voicing** menu ([EXERCISES.md](EXERCISES.md)).
Steps the app cannot score (recording yourself) have a short **self-check** to
tick.

## Progress

A step with a target is **ticked by itself** when its screen reaches it
(`useLessonGoal`), and stays ticked:

- hands-together, song, lick and voicing steps ("90% right at 80 BPM", "every
  chord green"): the whole song or exercise judged (32 notes or 16 chords of an
  endless line), at least that percent right, at the step's tempo or faster;
  Embraceable You's stage 2 also wants the notes on time within 60 ms on
  average;
- ear training: a round of 10 questions of Name the progression with 8 right,
  or 20 notes or more of Melodic Dictation with 80% right.

The screen then says so, with a way back to the Lessons tab. The other steps
(listening, improvising, self-checks) are ticked with **Mark done**.

Steps marked done and ticked boxes are kept in the browser (or the phone app)
under `eartraining:lessons:progress`; the first step not done is suggested as
the next one. **Forget my progress** clears it; **Delete all my data** (main
menu) clears everything the app keeps.

## Songs

The lead sheets come from the shipped OpenEWLD set (published before 1931,
public domain in the US), plus two study tunes written for the course
(`studio/scripts/build-lesson-songs.mjs`, built into
`studio/public/leadsheets/lessons.json` with `pnpm run lesson-songs`): **Study
Blues** (a riff on chord tones over a blues in F) and **Modal Study** (AABA in D
Dorian, the bridge a half step up), and the refrain of **What Is This Thing
Called Love?** (1929): its melody is written out from the first edition's score
([IMSLP](https://imslp.org/wiki/What_Is_this_Thing_Called_Love%3F_(Porter,_Cole))),
its chords are the jazz changes most charts give (Gø7, C7♭9, Fm6, Fm6, Dø7,
G7♯5, Cmaj7; the bridge Cm7, F7, B♭maj7, A♭7, Dø7, G7), which fit the first
edition's piano part.
Summertime (1935) and Blue Moon (1934) are in the OpenEWLD set for extra
practice.

## Sources

- The order of Units 1 to 4, the drills and the step lists for the blues and
  song form: Keith B. Kelly and Eric Rasmussen,
  [A Guide to Exploring Jazz Improvisation, Book 1](https://open.maricopa.edu/exploringjazzimprovisationbook1/)
  (Maricopa Open Digital Press, 2023, CC BY 4.0), in our own words.
- ii-V-I and chord scales: [Open Music Theory](https://viva.pressbooks.pub/openmusictheory/part/jazz/)
  (CC BY-SA 4.0), ideas only.
- The order of the voicings (bass, shells, rootless): jazz-piano method books
  (Jeremy Siskind, *Jazz Piano Fundamentals*), pacing only, nothing copied.
- The note colours of Free Improvisation follow
  [Impro-Visor](https://github.com/Impro-Visor/Impro-Visor) (GPL-2.0-or-later),
  ideas only.
