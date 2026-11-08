# Chord notation

Every chord of the catalog is written in one notation, whatever collection it
comes from, so a chord has exactly one spelling. All reading, writing and
converting of chord symbols is done by `chord_notation.py`; no other module
parses chord text.

- [The notations at a glance](#the-notations-at-a-glance)
- [How a chord is represented](#how-a-chord-is-represented)
- [Canonical Harte (the database)](#canonical-harte-the-database)
- [Chart symbols (iReal Pro notation)](#chart-symbols-ireal-pro-notation)
- [Chord lengths in iReal bars](#chord-lengths-in-ireal-bars)
- [Roman numerals](#roman-numerals)
- [Playing chart symbols in the app](#playing-chart-symbols-in-the-app)

## The notations at a glance

The same chord, E♭ minor seventh with D♭ in the bass, in each notation:

| Where | Notation | Example | Functions |
|---|---|---|---|
| Database (`chord` events) | canonical Harte | `Eb:min7/b7` | `canonical_harte`, `parse_harte`, `write_harte` |
| Roman numerals (computed, not stored), in D♭ major | Roman degree + the same quality | `II:min7/b7` | `roman_chord`, `roman_rows` |
| The app and iReal Pro charts | chart symbols (iReal Pro notation) | `Eb-7/Db` | `parse_chart`, `write_chart`, `chart_to_harte`, `harte_to_chart` |
| Keys | `tonic:major`, `tonic:minor`, or the tonic alone when the mode is unknown | `C:minor`, `C` | `canonical_key`, `chart_key` (iReal `C-` is `C:minor`) |
| Meters | `numerator/denominator` | `4/4` | `track_store.canonical_meter` |

Two special values stay as they are everywhere:

| Value | Meaning |
|---|---|
| `N` | no chord (N.C.) |
| `X` | an unknown chord |

A chord that cannot be read is stored as `X` in the ChoCo collections. In an
iReal Pro chart it stops the chart from being imported (see the import log in
[the data](DATA.md#the-import-log)).

## How a chord is represented

A chord is a **root**, a **set of intervals** above it and an optional **bass**
interval. Every notation is read into that form and written from it, so a
conversion never depends on how a source happened to spell a chord:

| Source | Written as | Stored as |
|---|---|---|
| Band-in-a-Box | `C:(3,5,b7)` | `C:7` |
| Real Book | `C:maj(b7)` | `C:7` |
| iReal Pro | `C7` | `C:7` |

The root keeps its source spelling: `Db` and `C#` stay different, because they
are read differently in a key.

## Canonical Harte (the database)

Harte notation ([Harte et al. 2005](https://ismir2005.ismir.net/proceedings/1080.pdf))
writes a chord as `root:shorthand(intervals)/bass`.

**Shorthands** are those of Harte and
[mir_eval](https://craffel.github.io/mir_eval/#mir_eval.chord):

| Group | Shorthands |
|---|---|
| triads | `maj min dim aug sus2 sus4` |
| sevenths | `maj7 min7 7 dim7 hdim7 minmaj7` |
| sixths | `maj6 min6` |
| extended | `9 maj9 min9 11 min11 13 maj13 min13` |
| other | `1` (root alone), `5` (power chord) |

Extended chords include the degrees below them: `13` is 1 3 5 ♭7 9 11 13, as
in every collection of the catalog.

**Choosing the spelling.** The writer picks the shorthand that covers most of
the chord's intervals, lists the others in brackets (by degree, flat before
sharp) and marks missing ones with `*`. Ties go to the shorthand needing no
omission, then to the order above:

| Chord | Canonical Harte |
|---|---|
| C E G♯ B♭ | `C:aug(b7)` |
| C E G B♭ D♭ F♯ | `C:7(b9,#11)` |
| C E G♭ B♭ | `C:7(b5,*5)` |
| C E (no fifth) | `C:maj(*5)` |

**The bass** is an interval from the root, within the octave (`/b7`, `/3`). A
bass equal to the root is not written. It is kept apart from the chord's
intervals, so a source's spelling survives:

| iReal Pro | Harte | Notes |
|---|---|---|
| `C-/Bb` | `C:min/b7` | C minor triad over B♭ |
| `C-7/Bb` | `C:min7/b7` | C minor seventh over its seventh |

**Reading Harte from the sources.** Omissions apply first, then an added
altered interval *replaces* the natural one on its degree, as ChoCo's
collections use it:

| Source | Read as |
|---|---|
| `C:7(b5)` | C E G♭ B♭ (the ♭5 replaces the 5) |
| `C:13(b5,5)` | both fifths, since the natural 5 is listed too |
| `C:7(b5,*5)` (strict Harte) | C E G♭ B♭, the same |
| `C:hdim` | `C:hdim7` |
| `C:6` | `C:maj6` |

The canonical form is valid strict Harte.

## Chart symbols (iReal Pro notation)

A chart symbol is a root (with at most one accidental), then the quality, then
alterations, then an optional bass:

| Part | Symbols | Examples |
|---|---|---|
| quality | `-` minor, `^` major seventh, `h` half-diminished, `o` diminished, `+` augmented | `C-`, `C^7`, `Ch7`, `Co7`, `C+` |
| number | `6 69 7 9 11 13`, `5` power chord, `2` sus2, `1` root alone | `C69`, `C13`, `C5` |
| alterations | `b9 #9 #11 b13...`, `sus`, `sus2`, `addN`, `noN`, `alt` | `C7b9`, `C7sus`, `Cadd9`, `C7no5`, `C7alt` |
| bass | `/note` | `C/E`, `D-7/C` |

`alt` is 1 3 ♭5 ♭7 ♭9 ♭13, as ChoCo reads it.

Symbols are read **literally**, adding no notes:

| Symbol | Read as | ChoCo (through music21) |
|---|---|---|
| `C7#11` | C E G B♭ F♯ | added a ninth: `C:9(#11)` |
| `C7b13` | C E G B♭ A♭ | added a ninth and an eleventh |

Spellings people type are read too:

| Typed | Same as |
|---|---|
| `Cmin7`, `Cm7` | `C-7` |
| `Cmaj7` | `C^7` |
| `Cmaj` | `C` |
| `Cdim` | `Co` |

`write_chart` writes the shortest symbol that `parse_chart` reads back as
exactly the same chord (`C13b9`, `C7#5`, `C7no5`, `Cadd9`). A root with two
accidentals (`Bbb`, from the classical collections) cannot be written in a
chart and is respelled `A`. Every chord of the catalog converts Harte → chart →
Harte without change (checked on all 8,097 spellings of an earlier catalog).

## Chord lengths in iReal bars

An iReal Pro chart is a grid of cells, 16 to a row (4 bars of 4 cells in 4/4).
Where a chord sits in its bar sets how long it lasts. The catalog
(`ireal_playlist.bar_beats`) and the app's Import (`cellBeats` in
`studio/src/formats/ireal.ts`) read a bar the same way, in four steps.

**1. Count the cells.**

| Text | Cells |
|---|---|
| a chord, a space, `n` (no chord) | 1 each |
| `XyQ` | 3 empty cells |
| `,` between two chords | none |
| comments, alternate chords `( )`, size marks `s` and `l` | none |

**2. A chord lasts its own cell and the empty cells after it.** Empty cells
before the first chord of a bar are skipped, and a bar of empty cells only is
not played, as in iReal Pro. A slash `p` stands for the chord before it:

| Text | Played |
|---|---|
| `F p Bb p` | F for 2 beats, then B♭ for 2 (inside a bar, `p` continues the chord) |
| `\| C7 \| p \|` | C7 in both bars (at the start of a bar, `p` repeats the previous chord) |

**3. Turn cells into beats.** Each chord starts where its cell lies in the
bar. When cells and beats do not line up (as in 3/4, with 4 cells for 3
beats), the chords take the whole-beat lengths, one beat at least, whose starts
are closest to the cells.

**4. Even split.** Evenly spaced chords, ties and bars with more chords than
beats are shared the way the app shares a bar given without lengths
(`evenSplit`):

| Bar | Shared as |
|---|---|
| one chord | the whole bar |
| three chords in 4/4 | 2 + 1 + 1 |
| two chords in 3/4 | 2 + 1 |
| five chords in 4/4 | 0.8 beat each |

Three chords in a 4/4 bar:

| Chart text | Cells | Beats |
|---|---|---|
| `F Abo,G-7 ` | 2 + 1 + 1 | 2 + 1 + 1 (F on beat 1, Abo on 3, G-7 on 4) |
| `F,Abo  G-7` | 1 + 2 + 1 | 1 + 2 + 1 |
| `F,Abo,G-7 ` | 1 + 1 + 2 | 1 + 1 + 2 |
| `F,Abo G-7 ` | starts at 0, 0.8 and 2.4 | 1 + 1 + 2 (closest whole beats) |
| `F Abo G-7 ` or `F,Abo,G-7` | evenly spaced | 2 + 1 + 1 (even split) |

The chords are then stored at their bar and beat, counted from 1 like every
source of the catalog. `F Abo,G-7 ` in bar 8 of a 4/4 chart gives:

| Chord | `measure` | `beat` | `onset` (quarters) | `duration` |
|---|---|---|---|---|
| F | 8 | 1 | 28 | 2 |
| Abo | 8 | 3 | 30 | 1 |
| G-7 | 8 | 4 | 31 | 1 |

Any bar length works: a chord on beat 10 of a 12/8 bar stays on beat 10. The
import counts beats from 0 and declares it with `Track.first_beat`;
`track_store.add_track` converts the positions (see `score_timing.py`).

ChoCo (and pyRealParser) instead share every bar evenly between its chords:
three chords in 4/4 last 1 1/3 beats each. That is why the catalog reads the
charts from their links.

**Tuplet marks.** When the chords of a chart really do share beats in lengths
plain notes cannot write, the app draws a bracket over them with the number of
equal notes they make, as in printed music (`tuplets` in
`studio/src/music/chart.ts`):

| Lengths | Mark |
|---|---|
| three chords of 1 1/3 beats in 4/4 | `3` |
| five chords of 0.8 beat in 4/4 | `5` |
| 2/3 + 2/3 + 2/3 after a half bar | `3` |
| 1.5 + 2.5 (a dotted length) | none, plain notes write it |

## Roman numerals

Roman numerals are computed when needed, not stored.
`roman_rows(chord rows, keys)` reads each chord of a song in the key in force at
its position; `roman_chord` replaces the root by its degree, measured on the
major scale of the tonic whatever the mode, and keeps the quality and bass:

| Key | Chord | Catalog numeral | The app shows |
|---|---|---|---|
| C major | `D:min7` | `II:min7` | `II-7` (or `IIm7`) |
| C major | `Db:7` | `IIb:7` | `bII7` |
| F minor | `G:hdim7` | `II:hdim7` | `IIø7` |
| F minor | `Gb:maj7` | `IIb:maj7` | `bII^7` |
| F minor | `F:min` | `I:min` | `I-` |

A change of key applies from its own beat. Pickup chords before the first key
use the first key.

The app's **Display → Roman numerals** uses the same degree rule
(`studio/src/music/roman.ts`), written the way musicians read it: the
accidental first (`bII7`), the quality as on the chart (`II-7`, or `IIm7` with
"Minor written Cm"). The band still plays in the chosen key.

## Playing chart symbols in the app

`studio/src/music/chords.ts` reads a chart symbol into a **family** with its
own bass notes and piano voicings, so nothing is played that the symbol does
not contain:

| Symbol | Family | Close voicing |
|---|---|---|
| `C`, `Cadd9` | maj | C E G |
| `C-` | min | C E♭ G |
| `Co` | dim | C E♭ G♭ |
| `Co7` | dim7 | C E♭ G♭ A |
| `C+` | aug | C E G♯ |
| `C7#5`, `C+7` | dominant seventh with ♯5 | C E G♯ B♭ |
| `Csus` | sus | C F G |
| `Csus2`, `C2` | sus2 | C D G |
| `C7sus`, `C9sus`, `C13sus` | sus7 | C F G B♭ |
| `C5` | power | C G |
| `C1` | root | C |

Sevenths, sixths and extensions (`^7 -7 7 h7 -^7 6 -6 9 11 13 alt` and their
alterations) use the jazz voicings of their family. Chord Sightreading checks
the notes you play against the same families.

The root takes one accidental and a slash bass up to two:

| Symbol | Read as |
|---|---|
| `Ab#11` | A♭ with a ♯11, not a root "A♭♯" |
| `C/Bbb` | C over B𝄫 |

**Checked across the datasets.** The notes the app plays were compared with
the notes of the canonical chord for every symbol of the catalog (5,151) and of
the iReal Pro charts (5,437). They agree, except about 80 rare classical
analyses (augmented sixths, added tones outside the families) and 21 iReal Pro
symbols written outside iReal Pro's own notation (`susadd3`, `Asusb9`,
`-7sus`), which are played as their nearest family.
