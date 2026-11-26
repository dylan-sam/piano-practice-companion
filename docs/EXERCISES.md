# Exercises

The app has seven exercises. In the **Ear Training** menu: **Name the
progression** and **Melodic Dictation**. In the **Sightreading** menu, with a MIDI keyboard: **Chord
Sightreading** (playing chords), **Lead Sheet Sightreading** (playing the
melody of a lead sheet), **Exercises Sightreading** (playing an exercise or a
lick of a few bars) and **Lick Sightreading** (playing a lick over every chord
of a chord chart). In the **Improvisation** menu: **Free Improvisation**. The
**Lessons** tab ([LESSONS.md](LESSONS.md)) opens them set up for each step. All remember your settings in the browser (or in the phone
app).

- [The song list](#the-song-list)
- [Name the progression](#name-the-progression)
  - [A question](#a-question)
  - [Options](#options)
  - [Levels](#levels)
  - [The question bank](#the-question-bank)
- [Melodic Dictation](#melodic-dictation)
  - [An excerpt](#an-excerpt)
  - [Writing the notes](#writing-the-notes)
  - [Checking](#checking)
  - [Melodic Dictation options](#melodic-dictation-options)
- [Chord Sightreading](#chord-sightreading)
  - [Modes](#modes)
  - [The band](#the-band)
  - [Scoring](#scoring)
  - [Infinite progressions](#infinite-progressions)
  - [MIDI keyboards](#midi-keyboards)
- [Lead Sheet and Exercises Sightreading](#lead-sheet-and-exercises-sightreading)
  - [Songs and the band](#songs-and-the-band)
  - [The exercise builder](#the-exercise-builder)
  - [How notes are judged](#how-notes-are-judged)
  - [The score](#the-score)
- [Lick Sightreading](#lick-sightreading)
  - [Chords and licks](#chords-and-licks)
  - [How the lick follows the chords](#how-the-lick-follows-the-chords)
- [Free Improvisation](#free-improvisation)

## The song list

Every screen with a song list shows one playlist: the **Practice Companion
Playlist** (every song shipped with the app and a search of the ChoCo catalog,
28,000+ chord charts) or one of yours, chosen above the list once you have made
one (**Playlists**). Exercises and licks are listed by **Categories** instead.
Every list has a **Progressions** filter: the songs that contain **any of** the
checked progressions (the default) or **all of** them. The catalog finds its own
songs; the shipped lead sheets, imported playlists and saved songs are read in
the app with the same rules (`studio/src/library/progressionMatch.ts`, after
`find_progressions.py`): each chord is a degree of the song's key (or of a key
it changes to) and a major or minor family, repeated chords count once, a chord
with an altered 5th, a sus chord or N.C. breaks a progression, and a 7 in the
progression (♭II7) wants a dominant 7th. The counts beside the progressions are
those of the songs listed. My tunes alone (songs being written) has no
progression filter.

## Name the progression

### A question

You hear one line of a real song and choose which catalog progression fills
the gap in its chart. The line has the bar before the progression, the bars it
occupies, and the bar after it:

```
| Am7 D7 | [   ?   ] | [   ?   ] | F7  E7 |
```

- Each new question **plays by itself** as soon as it appears (first question,
  *Next*, a new level). Browsers only allow sound after a first tap or click on
  the page: when the exercise is opened straight from a link, press *Play*
  once.
- The band plays every chord, including the hidden ones.
- The hidden chords are drawn as **one blank per bar**, so you see how many bars
  the gap takes, but not how many chords it holds.
- After you answer, the hidden chords and the song's title appear. Here the
  answer could be `ii V I` (`Gm7 C7 | Fmaj7`).

### Options

| Option | What it does |
|---|---|
| **Key** | the song's key, a random key for each question, or one fixed tonic. The mode (major or minor) is always the song's. |
| **Hear the key**: *Tonic* (K) | plays the tonic triad of the line's key |
| **Hear the key**: *Cadence* (C) | plays I-IV-V-I in major, i-iv-V-i in minor |
| **Hear an answer in the gap** | after answering, tap any choice to hear the line with that progression in the gap |
| **Display → Hide the key** | hides the key's name in the sheet, the readout and the key menu; the song plays in its own key, since a chosen key would give it away |
| **Display → Hide all chords** | leaves the chords around the gap empty too; the gap keeps its box so you know which passage to name |
| **Display → Minor written / Repeat sign** | C− or Cm, and % for a repeated bar, as in the player. Roman numerals are not offered: they would name the answer. |
| **Focus on mistakes** (On / Off) | asks more often the progressions you get wrong |
| **Master** slider and **Mixer** | volumes of bass, piano or guitar and drums, shared with the player |

Details:

- **Unknown mode.** A few relaxed questions (see below) are in a key whose mode
  is unknown. The key then shows "(major or minor)", *Tonic* plays the triad
  without its third, and two buttons offer the *Major cadence* (C) and the
  *Minor cadence* (M).
- **Answers in the gap.** A choice with as many chords as the real answer keeps
  the song's rhythm; others share the gap evenly on whole beats. Jazz and Latin
  styles play the choices with seventh chords, with major chords on II, III, V,
  VI and VII played as dominants (`II` becomes D7 in C).
- **Hide the key** restarts playback only if the key must change back to the
  song's key. Turning it off shows the key without restarting.
- **Focus on mistakes.** Results are kept per progression: how often it was
  right, and what it was taken for. With focus on, a progression is chosen with
  weight `0.5 + 2 × (1 − accuracy)`, where accuracy is
  `(right + 1) / (asked + 2)`. A new progression starts at 50 %; one you always
  miss is chosen up to five times as often as one you always get.

### Levels

Progressions are ranked by the number of distinct songs they occur in (see the
[list](DATA.md#the-catalog-progressions)). Versions of one song in several
collections count once.

| Level | Progressions asked |
|---|---|
| 1 | ii V I, II V I |
| 2 | the same + IV V I |
| 3 | the same + I IV V |
| ... | one more each level |

- A round has **10 questions**; **8 right answers** pass the level. The chosen
  level and the levels passed are remembered.
- A question picks a progression of the level at random, then one of its songs,
  avoiding songs already asked in the round.
- The two eight-chord progressions (I V vi iii IV I IV V and I V IV IV I V I V,
  a handful of songs each) are not asked, but still count when checking that
  only one answer fits a gap. Progressions with fewer than five usable questions
  are left out of the levels.

### The question bank

`python build_exercises.py` writes `studio/public/exercises/name-progression.json`
from `data/common_progressions.json`. Run it after `python find_progressions.py`.
The file is static, so the exercise works without the server, as it must in
the phone apps.

For each progression it takes up to **150 songs**, better-known sources first
(iReal Pro: ChoCo's playlists, your playlists, then forum charts; then the Real
Book, the Rock Corpus, When in Rome...), shuffled with a fixed seed within a
source. For each song it keeps the first passage, in the preferred version,
that passes every rule:

| Rule | Example of a passage left out |
|---|---|
| a whole bar before and after it, and a gap of at most 4 bars | a ii-V-I in the very first bar of the song |
| no key change in the line, no N.C. among the hidden chords | a ii-V that modulates in the bar after |
| starts and ends on chord boundaries | a passage starting in the middle of a held chord |
| its chords are not also exactly another catalog progression, so only one answer fits | a gap where two of the choices would both be right |
| a key with a known mode | a song whose key stayed undecided (`C`) |

A progression left with fewer than 40 questions (the rare ones) then tries its
other songs with **relaxed** rules: the gap may be of any length and may start
or end inside a bar; the line still starts and ends on bar lines, holds at most
6 bars, takes the bar before and after only when they exist in the same key (so
a progression may open or close the song), and may be in a key of unknown
mode. This adds 35 questions to six progressions; they carry
`"relaxed": true` in the file.

## Melodic Dictation

### An excerpt

You hear a few bars of a song or a lick and write the notes that are hidden.

- An excerpt is **at most four bars** of one simple meter (2/4, 3/4, 4/4...),
  cut from a shipped or saved lead sheet, or from a lick or pattern of the lick
  database (its drills, such as scales, are left out). Its notes keep to the
  lick grid: no value shorter than a sixteenth, and eighth-note triplets
  ([LICKS.md](LICKS.md)).
- It never starts in the middle of a held note, and it does not cross a key
  change, a repeat sign or an ending.
- The **first and last notes are always shown**. The notes to write are one run
  in between; the other notes around it are shown too.
- Hidden notes are drawn as **slashes**, with their real stems, beams, ties and
  triplets: the rhythm is written, only the pitch is missing. The title stays
  hidden until you check.
- Each new excerpt **plays by itself** (after a first tap on the page, as
  browsers ask), with a count-in and the band, in the source's style.

### Writing the notes

As in a score editor:

| Action | How |
|---|---|
| Put a note | tap (or click) the staff above or below its slash, on the line or space you want; a grey note with its name shows where it goes |
| Move it | tap again elsewhere, or press and drag it up and down, then let go |
| Sharp, flat, natural | the ♯ ♭ ♮ buttons, or the + − = keys |
| Up or down a step | the ↑ ↓ buttons or keys (Ctrl ↑ ↓: an octave) |
| Choose the note | tap its slash, or the ← → buttons or keys |
| Type it | a letter A–G writes that note nearest to the note before, then moves on |
| Play it | a note played on a MIDI keyboard is written, then the next note is selected |
| Clear it | the *Clear* button, or Delete |

- A placed note takes the key signature's sharp or flat for its line, as on
  paper; accidentals then follow the usual rules (a natural sign where needed).
- Placed notes are **silent** by default, since hearing them would give the
  answer away; *Options → Sound of placed notes* plays each one as it is
  placed. A note played on a MIDI keyboard always sounds, as on any keyboard.
  *Play my notes* plays the excerpt with your notes (empty ones are left out).
- On a phone the staff does not scroll the page, so a drag always moves the
  note; scroll from the buttons under it.

### Checking

*Check* (or Enter) judges every hidden note: **green** right, **orange** wrong,
**red** left empty. A note is right when its pitch, **with the octave**, is
the hidden note's; the spelling does not count (G♯ and A♭ are the same).

The sheet then shows the right notes with the chords, the song or lick, its
composer or source and the bars. *Show mine* shows your notes again, with the
same colours; *Play mine* plays them. The count of right notes this session is
kept under the result.

### Melodic Dictation options

| Option | What it does |
|---|---|
| **Options → Nb of notes to guess** | 1 to 12 notes in a row, or every note but the first and last (excerpts then have at most 16 notes). An excerpt is the shortest run of at least two bars with enough notes. |
| **Options → Excerpts from** | songs and licks, songs only, or licks only |
| **Options → Alterations** | with or without alterations; *No alterations*: every note of the excerpt is in the key signature (in minor, that of the relative major, so a raised seventh counts as an alteration); *With alterations*: at least one note to guess is outside the key signature |
| **Options → Show the chords** (Off) | writes the chord symbols over the staff while you write; they are always shown once you check |
| **Options → Play with the band** (On) | bass, piano and drums play the chords under the melody; off, the melody plays alone after a count-in. Turning it on or off, or changing the style, pattern or choruses, lets a playing excerpt go on from where it is |
| **Options → Sound of placed notes** (Off) | plays each note on the piano as it is placed on the staff |
| **Hear the key**: *Tonic* (T) and *Cadence* (Y) | the tonic triad, and I-IV-V-I in major or i-iv-V-i in minor |
| **Key** | the source's key, a random key for each excerpt, or one fixed tonic. Placed notes move with a key change. |
| **Style**, **Tempo**, **Choruses** | the band's style (with or without the band, it sets the swing), the tempo (excerpts start at most at 100), and how many times the excerpt plays |
| **Mixer** | melody, bass, piano, drums and master volume, shared with the player; with the band off, melody and drums (the count-in) |

## Chord Sightreading

Connect a MIDI keyboard, choose a song or an endless line, and play its chords
while bass and drums play along.

### Modes

| Mode | What it plays |
|---|---|
| **Pick a song** | any chart: search the catalog (with versions) or your saved playlists, with the progression filter for both; **Import** iReal Pro charts or a Studio export, saved for the Chord Player and Lick Sightreading too |
| **Random song** | a random song of the catalog, if you like one containing a chosen progression |
| **Infinite progressions** | an endless line of short catalog progressions (see below) |

- Moving between *Pick a song* and *Random song* keeps the current song selected
  and playing.
- Pressing *Pick a song* again (or *Songs*) opens or closes the song list, like
  the *Songs* button of the player.
- While an infinite line plays, *Pick a song* and *Random song* only open their
  menu: the line goes on until you choose a song (*Infinite progressions*
  closes the menu again). Starting an infinite line stops a song, since it
  replaces the chart.
- From one chunk of an infinite line to the next, the band does not stop: the
  next chunk is loaded ahead on a second synthesizer and starts exactly on the
  bar line, while the last notes of the chunk before ring out. Lick
  Sightreading does the same.
- While a song plays, a chart taller than the screen scrolls by itself to keep
  the playing bar near the middle, as in the player (Display → Sheet
  auto-scroller On/Off).

### The band

You play the chords; the band plays only **bass and drums**, with no piano. The
notes you play sound through an acoustic piano.

| Control | Choices |
|---|---|
| Style | the drum groove: Swing, Bossa Nova, Latin, Ballad, Blues, Straight Pop/Rock; a new style or bass pattern goes on from where the band is (in infinite mode too), and the chords already played keep their colours |
| Bass pattern | Walking Bass, Boogie Walking Bass, Latin Bassline, Ballad Bassline, Root-Fifth Bassline, for any style |
| Key | the song's key, a random key (chosen when a song loads), or any key |
| Tempo, choruses, Practice | as in the player (loop, keys, speed up); choosing keys or a speed-up while the band plays goes on from where it is, with the choruses needed to go round the keys, and the chords already played keep their colours; a new loop starts over |
| Substitutions | as in the players (not in infinite mode): the band plays the chosen chord substitutions, the sheet shows them in blue, and the chords to play are the substitutes |
| Mixer | bass, drums and master volume |

Each style starts with its natural bass:

| Style | Bass pattern |
|---|---|
| Swing | Walking Bass |
| Blues | Boogie Walking Bass |
| Bossa Nova, Latin | Latin Bassline |
| Ballad | Ballad Bassline |
| Straight Pop/Rock | Root-Fifth Bassline |

### Scoring

Each chord must be played while it sounds. It turns **green** as soon as the
notes you hold make it, and **red** if its time runs out first. The band keeps
playing whatever you play. The rules, for `C7` (C E G B♭):

| You hold | Counts? | Why |
|---|---|---|
| C E G B♭ | yes | all the chord tones |
| E G B♭ C (any inversion), or with C doubled an octave up | yes | inversions and octave doublings are accepted |
| C E B♭ | yes | the perfect fifth of a four-note chord may be left out |
| C E G | no | the written seventh is required |
| C E G B♭ D | no | D is not written in `C7`: a foreign note |
| C E G B♭ D, for `C9` | yes | the ninth is written, so it belongs to the chord |

More rules:

- An **altered fifth** is required: for `Ch7` (C E♭ G♭ B♭) or `C7#5`, the fifth
  cannot be left out.
- **Written color tones** are allowed: for `C13`, the 13th may be played.
- A **slash bass** must be the lowest note: for `C/E`, E must be at the bottom.
- Missed chords are remembered (by root and major or minor family) for **Focus
  on mistakes**, so a missed `Dm9` also brings back `Dm`.
- Without a MIDI keyboard you can still listen; nothing is counted as missed.

**Voicing** (above the chart) turns the screen into a voicing drill: each chord
must then be voiced as asked (`matchesVoicing` in
`studio/src/exercises/sightReading.ts`), here for `C7`:

| Voicing | What counts | C7 |
|---|---|---|
| Any voicing (default) | the rules above | |
| Shells | root at the bottom, 3rd and 7th (a triad's 6th), nothing else | C E B♭, C B♭ E |
| Two hands | a shell under the 9th and 5th | C B♭ E, then D G |
| Rootless | 3rd, 7th and 9th (5th or 13th allowed), no root | E A B♭ D, B♭ D E A |
| Quartal | three or more notes a perfect 4th apart, all from the chord's scale | over `D-7`: E A D G |

### Infinite progressions

An endless line of short progressions (two to four chords) from the catalog. It
starts in a random key, then each new progression follows the last chord in one
of three ways:

| Transition | Example |
|---|---|
| the last chord becomes the first chord of the next progression, in a key where it fits | ...`Dm7 G7 C`, then `C D G` (IV V I in G, starting on the same C) |
| the last chord becomes the tonic of the next progression, which starts on another chord | ...`Dm7 G7 C`, then `F G C` (IV V I in C) |
| a major last chord is heard as V: it resolves to I, then the next progression starts on another chord | ...`Em C D`, D heard as V of G: `G`, then `Am D G` (ii V I in G) |

The line scrolls to the left on large screens, and upwards on phones.

Chord substitutions come into the line at random, as part of it: a backdoor
ii-V, a turnaround or secondary dominant, a passing diminished chord, a tritone
substitution (whole chords only, so two chords stay in each bar). A substitute
is written in blue, and it is the chord to play. The same goes for the
infinite lines of Lick Sightreading and Free Improvisation.

- **7th chords** slider (0 to 100 %): how often a progression that has a
  seventh-chord version is played in that version (`SEVENTH_VARIANTS` in
  `studio/src/exercises/sightReading.ts`). At 100 %, ii V I is always
  `ii-7 V7 I^7`; at 0 %, always `ii V I` in triads. The progressions with a
  seventh version: ii-7 V7 I^7, vi-7 ii-7 V7 I^7, II7 V7 I, I^7 vi-7 IV^7 V7,
  V7 in I IV V, IV V I, I V vi IV, vi IV I V and IV V I vi, i-7 bVII bVI^7 V7,
  iv-7 V7 i-7, I III7 IV iv-6 and bVI^7 bVII7 I.
- **Focus on mistakes** chooses more often the progressions in keys that
  contain chords you missed.
- **Scrolling.** The line scrolls by itself, so the Display menu does not offer
  the sheet auto-scroller in this mode.
- **No pause.** The line is built in long chunks. While one plays, the next is
  prepared, and it starts on the synthesizer's clock 60 ms before the current
  one ends.

### MIDI keyboards

| Where | MIDI support |
|---|---|
| Chrome, Edge, Opera (desktop) | yes (Web MIDI) |
| Firefox (desktop) | yes, after allowing the site |
| Safari | no |
| Android and iOS apps | yes, USB and Bluetooth, through the app's own plugin ([mobile apps](MOBILE.md)) |

In a browser, Web MIDI needs a secure page (`localhost` or HTTPS); the
*Connect MIDI keyboard* button asks for access to the devices.

## Lead Sheet and Exercises Sightreading

Connect a MIDI keyboard, choose a lead sheet (Lead Sheet Sightreading) or an
exercise (Exercises Sightreading), and play its melody while the band plays
the chords. The two screens are one screen in two modes and work the same. The sheet is the one of the Lead Sheet Player: the
playing note is highlighted and the sheet scrolls by itself (Display → Sheet
auto-scroller On/Off).

### Songs and the band

| Control | Choices |
|---|---|
| Mode | **Pick a song** or **Random song** (Lead Sheet Sightreading), **Pick an exercise** or **Random exercise** (Exercises Sightreading) |
| Songs | Lead Sheet Sightreading: the 1,479 shipped lead sheets (OpenEWLD and Nottingham) and every saved tune with a melody. **Import** MuseScore MusicXML files or a Studio export: they are saved for the Lead Sheet Player too |
| Exercises | Exercises Sightreading: six example exercises (one per category), your own presets, and the 175 licks of the [lick database](LICKS.md). **Build** opens the [exercise builder](#the-exercise-builder) |
| Style, piano pattern | as in the players |
| Key | the song's key, a random key, or any key; the sheet is redrawn in that key |
| Tempo, choruses, Practice | as in the players (loop, keys, speed up); keys and speed-up apply without starting over, as in Chord Sightreading |
| Substitutions | as in the players: the band plays the chosen substitutes (in blue on the sheet; with Check > Both, the left hand plays them), never under a melody note of a beat or more it clashes with |
| Mixer | bass, piano, drums and melody: the band plays the melody too, so turn the Melody slider down or mute it to read on your own |

The notes you play sound through an acoustic piano. Swing and Blues play
eighth-note "ands" late, and the notes are expected where the band swings them.
A beat written in sixteenths is not swung: its four sixteenths stay even in
every style (moving only its "and" would make them uneven).

### The exercise builder

Exercises Sightreading writes its exercises from a few settings
(`studio/src/exercises/builder/`, the kinds in [LICKS.md](LICKS.md#exercises)).
**Build**, above the list, opens the builder on the exercise on the stand (or on
major triads, when the stand is empty):

| Setting | Choices |
|---|---|
| Kind | Arpeggios, Scales, Lines through a progression, Approach notes, Intervals, Rhythm |
| The kind's settings | the chord and its notes, the note to start on, the direction; the scale and its pattern, one or two octaves; the progression and the line; the chord and the approach; the interval and the order; the rhythm figure; and for most kinds the rhythm (quarter notes, eighth notes, triplets) |
| Key | the key it starts in |
| Then | stay in the key, or move up a half step, a whole step, a minor 3rd, a fourth (the cycle of fourths) or a fifth; arpeggios can also go through the diatonic chords of the key |
| Keys | how many keys it goes through: 2, 3, 4, 6 or all 12 |

Each change writes the exercise again on the stand, titled from its settings
("Dominant 7th chords in fourths: 1-3-5-7 up"). A setting that does not fit
the others is set to one that does (a triad has no 7th to start on).

**Presets**: give the exercise a name (or keep the title) and **Save as a new
preset**: it is listed under its category with the examples, and kept in the
browser. On one of your presets, **Save changes** saves its new settings or its
new name, and **Delete preset** deletes it (after asking). The six examples can
be deleted too: they are only hidden, and **Restore all default songs** (main
menu) brings them back.

A [lesson step](LESSONS.md) that plays an exercise builds it from the settings
in its link: its settings are locked (the builder shows them greyed out), as
the step asks for this exercise.

### How notes are judged

The reading settings are in the **Scoring** button of the bottom bar, next to
Practice and Mixer (on phones, under Settings), so the sheet keeps the page.

**Check** says what is judged:

| Check | What you play | What is judged |
|---|---|---|
| Melody only (default) | the melody | the melody's notes, as below |
| Chords only | the chord symbols | each chord, in any voicing, inversion or rhythm |
| Melody and chords | the melody with the right hand, the chords with the left | both, each with its own score |
| Melody, hands together | the melody with both hands, an octave apart | each note, once per hand |

A chord counts once every required note of it has been played during the time
it sounds, held together or one after the other (a broken chord, a comping
rhythm, a walking bass): the rules of [Chord Sightreading](#scoring) (the 5th of
a four-note chord may be left out; for a slash chord the bass must be the
lowest note), except that other notes are left out rather than refused, so a
melody or passing notes played with it don't spoil it. The chord symbol turns
**green** when the chord is played, **red** when its time runs out first.
With Melody and chords, a key that is not the melody note due but belongs to
the chord sounding is the left hand's: it is not an extra key.

**Left hand** (shown when chords are checked) says what each chord wants from
the left hand: the stages of learning a song's left hand
(`LEFT_HAND_STAGES` in `studio/src/exercises/sightReading.ts`). A key struck up
to the timing window before a chord counts for that chord.

| Left hand | A chord counts when |
|---|---|
| Bass note only | its bass (the root, or the note after the slash) is played |
| Whole chord, any rhythm (default) | every required note is played, as above |
| Whole chord on each beat | every required note is played, with a key near each of its beats |
| The piano pattern's rhythm | its bass is among the notes, with a key near each attack of the band's piano (its pattern, or its comping) |

**Melody, hands together** asks for each note twice: the written note and the
same note an octave below (with Any octave, any two octaves of it), for scales
and arpeggios with both hands. Each hand's note counts in the score.

For the melody, every written note gets a window around its start (`TIMING_WINDOWS` in
`studio/src/exercises/melodyReading.ts`):

| Timing | Window, each side |
|---|---|
| Easy | 0.4 beat |
| Normal (default) | 1/4 beat |
| Strict | 1/8 beat |

- A window never reaches past half the gap to the next or previous note, so
  fast runs stay fair: a key always belongs to the nearest note.
- A key with the right pitch inside the window makes the note **right**
  (green).
- A key with a wrong pitch marks the note **wrong** (orange), but it can still
  be put right by the right key before the window ends.
- A note not played when its window ends is **missed** (red).
- A key pressed where no note is due is an **extra key**.
- **Any octave** (On by default): a note played in another octave than written
  counts. Off: the written octave is required.
- Repeats, endings and choruses are followed: each pass through a bar is judged
  again, and the colours show the last pass.
- Without a MIDI keyboard you can still listen; nothing is counted.

### The score

The line under the settings shows, for the play-through so far: notes right,
wrong notes, missed notes, extra keys, the percentage of judged notes played
right, and the average timing of the right notes in milliseconds (early or
late); when chords are checked, the chords played and missed and their
percentage. The bar readout adds what was right out of what was judged. It starts again with each play, and whenever the sheet changes (key,
choruses, a Practice loop). What leaves the sheet as it is goes on from where
the band is and keeps the score: a new style or piano pattern (the notes still
to come are judged where the new style swings them), Timing and Any octave
(the notes still to come are judged the new way), Check and Left hand (what is
still to come is judged as now checked).
Practice > Keys and the speed-up go on from where the band is and keep the
score: the notes still to come are judged in their new keys.

MIDI keyboards work as for Chord Sightreading ([MIDI keyboards](#midi-keyboards)).

## Lick Sightreading

Choose where the chords come from and a lick: the lick is written over every
chord, as a lead sheet, and you play it on a MIDI keyboard with the band. Notes
are judged and scored as in [Lead Sheet Sightreading](#how-notes-are-judged), with
the same Check, Timing and Any octave settings (the Scoring button). The
lick picker sits above the sheet, with the lick's source and chord on the line
below it.

### Chords and licks

| Control | Choices |
|---|---|
| Chords | **Pick a song** (chord charts: search the ChoCo catalog, or your own saved chord charts; **Import** iReal Pro charts or a Studio export, saved for the Chord Player and Chord Sightreading too; lead sheets are not offered), **Random song** (a catalog song, if you like one containing a chosen progression), **Infinite progressions** (an endless line of catalog progressions in 7th-chord versions, as in [Chord Sightreading](#infinite-progressions), in chunks of 12 progressions that follow one another without a break (the band never plays an ending between them); the score goes on across chunks. Each new sheet starts at the top with a bar of rest while the band plays, so there is time to look back up before the lick starts again) |
| Licks | check boxes, like the Progressions filter: the playlists of one-chord licks of the [lick database](LICKS.md) (133) to offer, vocabulary and licks from standards over a major, minor, dominant or diminished chord; none checked offers them all. Kept on this device |
| Lick | one lick of the checked playlists, listed by playlist; **Random lick** picks any of them (licks of two bars over one chord, such as *Blue third*, cross the song's chord changes and follow them) |
| Rest between licks | Off: the lick starts again on the bar line after it ends. On: a rest as long as the lick comes first |
| Style, piano pattern, key, tempo, choruses, Practice, Substitutions, Mixer | as in Lead Sheet Sightreading (no key choice, Practice or Substitutions in infinite mode: the key changes with the progressions). With Substitutions, the lick stays as written over the written chords, and a substitute is left out under a lick note of a beat or more it clashes with. A new style or piano pattern goes on from where the band is, in infinite mode too, and the lick's eighths then swing as the new style does |

The first lick starts on the first full bar. Notes over N.C. are left out.

### How the lick follows the chords

The lick is read as a **shape** relative to its own chord
(`src/exercises/lickReading.ts`):

1. Each chord has seven **slots**: root, 9th, 3rd, 11th, 5th, 13th, 7th, as its
   scale alters them (`chordSlots`). Slots 1, 3, 5 and 7 are always the chord
   tones.

   | Chord | Slots (semitones above the root) |
   |---|---|
   | major, 6th, major 7th | 0 2 4 5 7 9 11 (#11 with a written #11) |
   | minor, minor 7th | 0 2 3 5 7 9 10 (Dorian) |
   | minor 6th, minor-major 7th | 0 2 3 5 7 9 11 (melodic minor) |
   | dominant 7th | 0 2 4 5 7 9 10 (Mixolydian; #11 and b13 when written) |
   | dominant with b9 | 0 1 4 5 7 8 10 (Phrygian dominant) |
   | altered dominant (alt, #5, #9) | 0 1 4 6 8 8 10 (b9, #11, #5 = b13) |
   | half-diminished | 0 1 3 5 6 8 10 (Locrian) |
   | diminished 7th | 0 2 3 5 6 8 9 (whole-half) |
   | augmented | 0 2 4 6 8 9 11 |
   | sus | 0 2 5 5 7 9 10 |

2. Each note of the lick becomes a slot of its chord in some octave, plus a
   chromatic step when it lies between two slots (counted from the slot above:
   a chromatic note is most often an approach from below).
3. Each note is then written on the chord **sounding at its start**, with that
   chord's slots: "The Lick" (C D Eb F D Bb C over C-7) reads C D E F D B C over
   C^7, and over D-7 G7 it starts D E F G on D-7 and goes on A F G on G7 when
   the chord changes in the middle of the lick.
4. When the chord changes, the new chord's root is taken in the octave that
   puts the next note closest to the note before, so the line stays smooth; a
   new lick starts around middle C. Notes are kept between C3 and E6.
5. A note held over a chord change keeps its pitch.

Over its own chord a lick comes back unchanged (the tests check every
one-chord lick of the database).

A V going to the next chord takes that chord's scale, as in Free Improvisation:
over a V (a major triad or a 7th, nothing altered) going up a 4th to a minor
chord, the lick's 9th and 13th are flat (G7 to Cm: A♭ and E♭); going to a major
chord, its 7th is flat, even over a triad (G to C: F).

## Free Improvisation

The band plays a chord chart (**Pick a song**: the shipped lead sheets, whose
melody is left out, the ChoCo catalog or your own charts; **Random song**; or
**Infinite progressions**, as in Chord Sightreading) and you improvise on a MIDI
keyboard. Nothing is right or wrong: every key is written out on the chart as
you play (`writeLine` in `studio/src/exercises/improvisation.ts`), and the page
starts again at each chorus (each sheet of an infinite line).

- Keys are written on a grid: sixteenths in a straight style, eighths in a swung
  one (the swung "and" is written as an eighth). A bar played twice in a chorus
  shows its last pass.
- Keys struck together write only the highest (the line on top). A note lasts
  until its key goes up or the next note starts; a held key grows with the band.
- Notes are written in the key of the song, so they are spelled with its
  sharps or flats.

Each note is coloured after the note coloration of Impro-Visor, on the chord
sounding where it starts, and the line under the sheet counts each kind (with
its share) (`studio/src/exercises/toneColors.ts`):

| Colour | Kind | Over C7, in the key of F |
|---|---|---|
| black | chord tone | C E G B♭ |
| green | colour tone: another note of the chord's scale, except the 11th over a major 3rd (it clashes with it), or a note of the key's major pentatonic, minor pentatonic or blues scale (a minor key: its minor pentatonic and blues scale) | D A, and F A♭ B... |
| blue | approach tone: a short outside note followed by a key a half step away on a chord or colour tone; it turns blue when that key is played | D♭ then C |
| red | outside: none of these; a note of a beat or more on a strong beat (1 or 3 in 4/4) stays red even when it resolves | D♭ held on beat 1 |

The chord's scale (`chordScale`) is read from its symbol, with two corrections
from the chord after it:

| Chord | Scale |
|---|---|
| major | major (Lydian with ♯11) |
| dominant 7th | Mixolydian (the written alterations choose: ♭9 Phrygian dominant, ♯11 Lydian dominant, ♭13 Mixolydian ♭13, alt or ♯5 or ♯9 altered) |
| a V (major triad or dominant 7th, nothing altered) going up a 4th to a minor chord | Mixolydian ♭9 ♭13 (G7 to Cm: G A♭ B C D E♭ F) |
| a V going up a 4th to a major chord, even a triad | Mixolydian (G to C: F natural) |
| minor 7th | Dorian |
| minor 6th, minor-major 7th | melodic minor |
| half-diminished | Locrian ♮2 |
| diminished | the full diminished scale, 8 notes (whole step, half step) |
| sus | Mixolydian |
| augmented | Lydian augmented |

The key of each bar is the chart's, changed where the chart marks a key change
(`barKeyCentres`). A lesson song's scale map also lists the passages where the
song moves to another key without the chart marking it (Tea for Two going up a
major 3rd, the D Dorian of the Modal Study), so the key's scales follow the song. On an
infinite line, each bar takes the key of the progression playing at its
downbeat (`lineKeys`).

A tap on a bar, or the **Chords** button of the bottom bar, opens the **chord
helper** (with **Follow the chord playing**): its chords on a keyboard with the
scales to improvise with, best first (the chord's scale where it is, also for a
bar left blank, where the chord carries on; its pentatonic; the key's scales,
with the lesson map's key passages; other good choices), as in the players
(`studio/src/exercises/scaleSuggestions.ts`). The **Substitutions** button (songs,
not an infinite line) has the band play chord substitutions, as in the players:
the sheet and the chord helper show them, with the substitutes' own scales
(Lydian dominant over a tritone substitution), and a change goes on from where
the band is, the page kept. For a lesson song, the song's
**scale ideas** for the part being played (**Show all** lists every part) sit
under the sheet, from its scale map (`studio/src/lessons/scaleMaps.ts`,
[LESSONS.md](LESSONS.md#scales)).

Keys in the count-in are not written. Opened from a lesson, the band's piano
starts muted so your left hand is heard.
