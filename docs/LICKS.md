# Licks and exercises

A database of licks for Exercises Sightreading and Lick Sightreading (424 made,
**175 shipped**, see [What ships](#what-ships)): phrases to play over one chord
or a chord progression, to build the vocabulary used when improvising.

The drills (arpeggios, guide tones, scales, enclosures, intervals, rhythm) are
not in the database: Exercises Sightreading **builds** them from their settings,
in any key ([Exercises](#exercises)).

- [What is in it](#what-is-in-it)
- [What ships](#what-ships)
- [The rhythm rule](#the-rhythm-rule)
- [Exercises](#exercises)
- [Vocabulary licks](#vocabulary-licks)
- [Licks mined from melodies](#licks-mined-from-melodies)
- [Common patterns](#common-patterns)
- [The format](#the-format)
- [Rebuilding](#rebuilding)
- [Rights and credits](#rights-and-credits)

## What is in it

Everything is written **in C** and the players move it to any key (Key menu,
Practice > Keys). Each lick or exercise is a short chart, a melody over chords,
listed in its own playlist:

| File | Playlists | Charts | License |
|---|---|---|---|
| `studio/public/licks/licks.json` (made; shipped: see below) | Licks: vocabulary | 24 | CC BY 4.0 |
| | Licks from standards (OpenEWLD melodies), by context | 301 | public domain |
| | Licks from folk tunes (Nottingham Music Database), by context (not shipped) | 99 | CC BY 4.0 |
| `weimar/licks_weimar.json` (not shipped, not in git) | Weimar licks, by context | 704 | ODbL 1.0 |
| | Weimar licks: common patterns | 120 | ODbL 1.0 |

### What ships

The app ships a curated choice (`studio/scripts/lickCuration.ts`), so a list can
be worked through rather than scrolled: at most 15 licks per list, taken in turn
from each level (easy, intermediate, harder) and kept in the list's order. The
licks mined from folk tunes are not shipped. Everything left out stays in the
miner; `data/licks.log` says how many were kept.

| Shipped list | Count |
|---|---|
| Licks: vocabulary over progressions, Colours, Blues | 12, 13, 9 |
| Licks: Arpeggios, Scale lines, Neighbours and turns, Approach notes | 15 each |
| Licks from standards: ii-V-I major, ii-V, V-I, I-vi-ii-V turnaround, Blues I7-IV7 | 15 each |
| Licks from standards: minor ii-V-i | 6 |

The Weimar licks are built only on a computer that has the Weimar solos
([Testing lead sheets](DATA.md#testing-lead-sheets-with-the-weimar-jazz-database)),
in the `weimar/` folder, which git ignores; the app does not load them. They
can be tried with **Import > Studio export**.

The contexts, for every mined collection:

| Context | Chords (in C) | Window |
|---|---|---|
| ii-V-I major | D-7 G7 C^7 | ii and V (2 or 4 beats each), then the first bar of the I |
| minor ii-V-i | Dh7 G7 C- | the same |
| ii-V | D-7 G7, not resolved | ii and V |
| V-I | G7 C (or C-), without a ii before | V, then the first bar of the I |
| I-vi-ii-V turnaround | C^7 A7 (or A-7) D-7 G7 | two beats each |
| Blues I7-IV7 | C7 F7 | a bar each |
| Major, minor, dominant, altered dominant, half-diminished, diminished chord | one chord held for a bar or more | its first bar |

**Exercises Sightreading** lists them, after the exercises; the players and
Lead Sheet Sightreading, which list songs, do not. **Lick Sightreading** writes any of the 133 one-chord
licks (vocabulary and standards) over every chord of a chord chart or of an
endless line of progressions ([how](EXERCISES.md#lick-sightreading)).

## The rhythm rule

No note value is shorter than a **sixteenth**, and **eighth-note triplets**
are allowed (quarter-note triplets too). In practice:

- every note starts and ends on a sixteenth or on a third of a beat;
- one beat is written either in sixteenths or in triplets, never both;
- no note is shorter than a sixteenth.

The rule lives in one function, `onLickGrid` (`studio/src/music/licks.ts`).
The build refuses a generated chart that breaks it and leaves out a mined one;
the tests check both shipped files against it.

## Exercises

The exercises are built in the app by the **exercise builder**
(`studio/src/exercises/builder/exerciseBuilder.ts`) from a few settings: the
kind of exercise, its own settings, the key it starts in and how it moves
through the keys. Exercises Sightreading lists six examples (one per category)
and the person's own presets; its **Build** button opens the builder
([how](EXERCISES.md#the-exercise-builder)). A lesson step builds its exercise
the same way, from the settings in its link.

| Kind | Settings | What they practise |
|---|---|---|
| Arpeggios | major, minor, diminished, augmented and sus4 triads; major 7th, minor 7th, dominant 7th, half-diminished, diminished 7th and minor-major 7th chords; the notes (1-3-5, 1-3-5-8, 1-3-5-7, 1-3-5-7-8, **without the fifth** 1-3-7-8, the upper structure 3-5-7-9, 1-3-5-7-9), the note to start on, up, down, up and down, or up one and down the next; in a key, through the keys, or the diatonic chords of a key | the 1-3-5 drills of Kelly and Rasmussen's Module 1, arpeggios with and without the fifth |
| Scales | 25 scales over their chord (the modes of the major and melodic minor scales, harmonic minor, Phrygian dominant, the bebop scales, pentatonics, blues, whole tone and both diminished scales); straight, in thirds, 1-2-3-5, groups of four or triads on every step; one or two octaves | chord scales |
| Lines through a progression | 16 progressions (ii-V-I, minor ii-V-i, ii-V7b9-I, minor ii-V7b9b13-i, I-vi-ii-V, iii-VI-ii-V, jazz blues, minor blues, rhythm changes A section, the four substitutions of the Lessons tab, the diatonic cycle, the cycle of dominants, the Coltrane cycle): guide tones one per chord from the 3rd or from the 7th, two per chord, chord tones or chord scales in eighth notes, every 3rd enclosed | voice leading through the changes |
| Approach notes | into 1, 3, 5, 7 and 8 of a major 7th, minor 7th or dominant chord: chromatic approach from below, scale approach from above, double chromatic approach, three enclosures | bebop chromaticism |
| Intervals | minor 2nds to octaves: lower note first, upper note first, or up one and down the next (no chords) | Kelly and Rasmussen's interval drills |
| Rhythm | on a dominant vamp: every off-beat, anticipations of 1 and 3, on then off the beat, the Charleston, groups of 3, 4 and 5 eighths with a rest, quarter-note triplets | Kelly and Rasmussen's rhythmic exercises |

Most kinds also take a rhythm (quarter notes, eighth notes, triplets). An
exercise that goes through the keys (half steps, whole steps, minor 3rds,
fourths, fifths; 2, 3, 4, 6 or all 12 keys) ends on its first chord again. The
title is made from the settings ("Major triads in fourths: 1-3-5-8 up"), and a
preset keeps the name the person gives it. A test plays every combination of
settings: the chart is valid, on the rhythm grid and within G3 to A5.

How the lines are made:

- **Guide tones**: each chord's 3rd and 7th (`chordTones` of the app). The line
  takes the guide tone closest to the note before (a common tone or a step),
  between G3 and G5; a line through all the keys jumps an octave when it would
  leave that range.
- **Eighth-note lines**: the line runs on through the chord's tones (or its
  scale) in one direction, turns at the edges of G3 to A5, and moves to the
  nearest tone of the next chord when the chord changes.
- **Chord scales** (`chordScale`): major 7th Ionian (Lydian with a #11), minor
  7th Dorian, minor 6th and minor-major Melodic minor, half-diminished
  Locrian, diminished whole-half, dominant Mixolydian, with a b9 Phrygian
  dominant, with #11 Lydian dominant, altered (alt, #5, #9) the altered scale.

## Vocabulary licks

24 short licks written for this project (`VOCABULARY` in
`studio/scripts/lickExercises.ts`), each showing one device: "The Lick" (a traditional figure),
3-to-9 arpeggios, 1-2-3-5 cells, bebop scale lines, enclosures, triplet
arpeggios, b9 diminished arpeggios, the altered scale, the blue third, the blues
scale, Lydian and Dorian colours, minor 9th arpeggios, and turnaround arpeggios.
A test checks that every note on a beat belongs to the chord's scale (or is the
blue third over a dominant).

## Licks mined from melodies

`studio/scripts/lickMining.ts` reads three collections:

| Collection | Songs read | Windows that make licks | Kept |
|---|---|---|---|
| Weimar Jazz Database solos | 450 | 7,299 | 704, at most 60 per context, 2 per solo, 6 per player |
| OpenEWLD melodies (the shipped lead sheets) | 498 | 883 | 301, at most 40 per context, 2 per tune |
| Nottingham folk tunes in 4/4 (the shipped lead sheets) | 512 | 362 | 99, at most 40 per context, 1 per tune |

For each song:

1. Its written bars are laid on one time line (repeats are not followed). A
   window covers full 4/4 bars only, starts on a bar line, and does not run
   over a repeat sign, an ending, a segno or a coda.
2. The windows of the contexts above are found from the chords. In folk tunes
   a major chord a fourth below the tonic counts as the V (folk tunes rarely
   write the 7th).
3. The notes of a window are a lick when:
   - no note is held into the window from before;
   - the first note comes in the first beat;
   - there are enough notes: one a beat for solos, 0.75 for standards, 1.5 for
     folk tunes;
   - at least 4 different notes, and at most a quarter of the moves repeat a
     note;
   - the range is a 12th at most and no leap is wider than an octave;
   - there is no rest of more than a beat and a half inside, and the phrase
     does not stop more than two beats before the end;
   - in a cadence, a note on the first beat of the I (or held into it) is a
     chord tone or the 9th of the I;
   - every note starts on the grid of the [rhythm rule](#the-rhythm-rule).
     Played lengths are rounded to the grid; a staccato note becomes a
     sixteenth (a triplet eighth in a triplet beat).
4. The lick is moved to C (by at most a tritone) and to the octave around G4.
5. Licks are ranked by how clearly they spell the harmony: notes on the beat
   that are chord tones (counted twice) or in the chord's scale, stepwise
   motion, starting a phrase, between 1.5 and 3.5 notes a beat, and varied note
   lengths. Duplicates (the same notes at the same times) are left out.

Within a playlist the licks are ordered by level, then by rank. The level is 1
for fewer than 1.25 notes a beat, 2 below 2.25, else 3, one more (up to 3)
with triplets or sixteenths.

`data/licks.log` lists, for every collection, how many windows were turned
down and why, and how many licks each context kept.

## Common patterns

Runs of **7 notes**, played without a break (no gap longer than a beat), that
start on the same degree of the same chord family and move by the same
intervals, played by **at least 3 different players** of the Weimar Jazz
Database: 307 such runs. Plain scale runs are left out (a pattern needs two
changes of direction or two leaps of a third or more), and so is a run that is
one already kept, shifted by a note. The 120 most widely played are kept, each
in the first place where it is played on the rhythm grid, with the chords
under it, moved to C. The title names the degree it starts on ("from the 9th
of a dominant chord"); the composer line, how many players play it and one of
them.

This follows the pattern mining of the Dig That Lick project (K. Frieler,
F. Hoeger, M. Pfleiderer and S. Dixon, "Two web applications for exploring
melodic patterns in jazz solos", ISMIR 2018), on a much smaller scale.

## The format

Both files are Studio playlist exports, the format the app imports and exports.
Each chart has its chords, its melody (in C, notes placed by bar and beat as in
every lead sheet) and a `lick` record (`LickInfo` in `studio/src/music/licks.ts`):

```json
"lick": {
  "kind": "lick",
  "category": "ii-V-I major",
  "context": "ii-V-I",
  "source": "Weimar Jazz Database",
  "license": "ODbL 1.0",
  "performer": "John Coltrane",
  "tune": "Oleo",
  "bar": 120,
  "tags": ["sixteenths", "phrase start"],
  "level": 2
}
```

| Field | Meaning |
|---|---|
| `kind` | `lick` (a phrase from music), `pattern` (shared by several players) or `exercise` (built in the app) |
| `category`, `context` | the playlist group and the harmony it is played over |
| `source`, `license` | where it comes from, under which terms |
| `performer`, `tune`, `bar` | for mined licks: who played it, on which tune, from which bar (1 = first written bar of the solo or tune) |
| `count` | for patterns: how many players play it |
| `credit` | who to credit for the exercise or its idea |
| `tags` | the devices it uses: arpeggio, enclosure, chromatic, triplets, guide tones... |
| `level` | 1 to 3 |
| `spec` | for an exercise: its settings, as the builder writes them (`arpeggio;chord=dom7;notes=1-3-5-7`) |

## Rebuilding

```sh
cd studio
pnpm run licks
```

This writes `studio/public/licks/licks.json` and `data/licks.log`, and
`weimar/licks_weimar.json` when `weimar/weimar_solos.json` is present (made by
`weimar_playlist.py` from `wjazzd.db`, see [Testing lead sheets](DATA.md#testing-lead-sheets-with-the-weimar-jazz-database)). The other licks come from the shipped lead
sheets (`studio/public/leadsheets/catalog.json`), so rebuild those first
(`pnpm run leadsheets`) when their sources change.

| File | Does |
|---|---|
| `studio/src/music/licks.ts` | the `lick` record, its check, and the rhythm rule (`onLickGrid`) |
| `studio/src/exercises/builder/lickCharts.ts` | chords into bars, note lines, the text notation of the vocabulary (`D4:8 F4:8t A4:4.`), transposition |
| `studio/src/exercises/builder/exerciseMusic.ts` | chord tones, chord scales, guide-tone and eighth-note lines (shared by the builder and the miner) |
| `studio/src/exercises/builder/exerciseBuilder.ts` | the exercise builder: settings, titles, categories, examples, charts |
| `studio/scripts/lickExercises.ts` | the vocabulary licks |
| `studio/scripts/lickMining.ts` | contexts, windows, grid snapping, ranking, common patterns |
| `studio/scripts/lickCatalog.ts` | builds and checks the files, writes the log |
| `studio/tests/licks.test.ts` | tests, including the shipped file |
| `studio/tests/exerciseBuilder.test.ts` | the builder's titles, settings and every combination |

## Rights and credits

- **Exercises and vocabulary**: written for this project, shared under
  CC BY 4.0 like the project's data. The triad, interval and rhythm drills
  follow the exercise families of K. B. Kelly and E. Rasmussen,
  [*A Guide to Exploring Jazz Improvisation - Book 1*](https://open.maricopa.edu/exploringjazzimprovisationbook1/)
  (Maricopa Open Digital Press, 2023), CC BY 4.0; the notes are generated by
  the builder, not copied. The other devices (guide tones, enclosures,
  bebop scales, digital patterns) are common teaching material and are
  generated by rule, not copied from any book.
- **Licks from standards**: from the OpenEWLD lead sheets (F. Simonetta),
  public domain scores.
- **Licks from folk tunes**: from the Nottingham Music Database (E. Foxley,
  revised by J. Allwright), as kept by ChoCo under CC BY 4.0.
- **Weimar licks and common patterns** (`weimar/licks_weimar.json`, not
  shipped and not in git): derived from the
  [Weimar Jazz Database](https://jazzomat.hfm-weimar.de/), released under the
  [Open Database License (ODbL 1.0)](https://opendatacommons.org/licenses/odbl/1-0/),
  so the file is under the ODbL 1.0 too. Credit: M. Pfleiderer,
  K. Frieler, J. Abesser, W.-G. Zaddach and B. Burkhart (eds.), *Inside the
  Jazzomat: New Perspectives for Jazz Research*, Schott Campus, Mainz (2017).
  The ODbL covers the database; each lick is a short excerpt (one to three
  bars) of an improvisation whose rights belong to its performer, credited by
  name, tune and bar.
