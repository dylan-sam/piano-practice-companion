# Exercises

The app has two exercises built on the catalog: **Name the progression** (ear
training) and **Chord Sightreading** (playing chords on a MIDI keyboard). Both
use real songs, and both remember your settings and progress in the browser (or
in the phone app).

- [Name the progression](#name-the-progression)
  - [A question](#a-question)
  - [Options](#options)
  - [Levels](#levels)
  - [The question bank](#the-question-bank)
- [Chord Sightreading](#chord-sightreading)
  - [Modes](#modes)
  - [The band](#the-band)
  - [Scoring](#scoring)
  - [Infinite progressions](#infinite-progressions)
  - [MIDI keyboards](#midi-keyboards)

## Name the progression

### A question

You hear one line of a real song and choose which catalog progression fills
the gap in its chart. The line has the bar before the progression, the bars it
occupies, and the bar after it:

```
| Am7 D7 | [   ?   ] | [   ?   ] | F7  E7 |
```

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

## Chord Sightreading

Connect a MIDI keyboard, choose a song or an endless line, and play its chords
while bass and drums play along.

### Modes

| Mode | What it plays |
|---|---|
| **Pick a song** | any chart: search the catalog (with versions and the progression filter) or your saved playlists |
| **Random song** | a random song of the catalog, if you like one containing a chosen progression |
| **Infinite progressions** | an endless line of short catalog progressions (see below) |

- Moving between *Pick a song* and *Random song* keeps the current song selected
  and playing.
- Pressing *Pick a song* again (or *Songs*) opens or closes the song list, like
  the *Tunes* button of the player.
- Only *Infinite progressions* stops the song, since it replaces the chart.
- While a song plays, a chart taller than the screen scrolls by itself to keep
  the playing bar near the middle, as in the player (Display → Sheet
  auto-scroller On/Off).

### The band

You play the chords; the band plays only **bass and drums**, with no piano. The
notes you play sound through an acoustic piano.

| Control | Choices |
|---|---|
| Style | the drum groove: Swing, Bossa Nova, Latin, Ballad, Blues, Straight Pop/Rock |
| Bass pattern | Walking Bass, Boogie Walking Bass, Latin Bassline, Ballad Bassline, Root-Fifth Bassline, for any style |
| Key | the song's key, a random key (chosen when a song loads), or any key |
| Tempo, choruses, Practice | as in the player (loop, keys, speed up) |
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
