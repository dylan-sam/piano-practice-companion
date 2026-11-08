# Chord notation

Every chord in `data/progressions.sqlite` is written in one notation, whatever
corpus it comes from, so that one chord has exactly one spelling. All reading,
writing and converting of chord symbols is done by `chord_notation.py`; no other
module parses chord text.

| Where | Notation | Example | Functions |
|---|---|---|---|
| Database, `chord` events | canonical Harte | `Eb:min7/b7` | `canonical_harte`, `parse_harte`, `write_harte` |
| Roman numerals (computed, not stored) | Roman root + the same quality | `IIb:7/3` | `roman_chord`, `roman_rows` |
| Studio and iReal Pro charts | chart symbols (iReal Pro notation) | `Eb-7/Db` | `parse_chart`, `write_chart`, `chart_to_harte`, `harte_to_chart` |
| Keys | `tonic:major`, `tonic:minor`, or a bare tonic when the mode is unknown | `C:minor`, `C` | `canonical_key`, `chart_key` (iReal `C-` -> `C:minor`) |
| Meters | `numerator/denominator` | `4/4` | `track_store.canonical_meter` |

`N` means no chord is played and `X` an unknown chord; both stay as they are.
A source chord that cannot be read is stored as `X` (ChoCo sources) or makes
the chart not imported (iReal charts, see the import log).

## How a chord is represented

A chord is a root (spelled as in the source: `Db` and `C#` stay different), a
set of intervals above it, and an optional bass interval. Every notation is read
into that form and written from it, so converting never depends on how a source
happened to spell a chord: BiaB's `C:(3,5,b7)`, the Real Book's `C:maj(b7)` and
iReal's `C7` are all stored `C:7`.

## Canonical Harte

Harte notation ([Harte et al. 2005](https://ismir2005.ismir.net/proceedings/1080.pdf)):
`root:shorthand(intervals)/bass`.

- **Shorthands** are those of Harte and [mir_eval](https://craffel.github.io/mir_eval/#mir_eval.chord):
  `maj min dim aug maj7 min7 7 dim7 hdim7 minmaj7 maj6 min6 9 maj9 min9 sus2 sus4
  11 min11 13 maj13 min13 1 5`. Stacked chords include the degrees below them:
  `13` is 1 3 5 b7 9 11 13, as in every corpus of the catalog.
- **The writer picks the shorthand** that covers the most intervals of the chord,
  lists the remaining ones in brackets (by degree, flat before sharp), and writes
  missing ones as omissions: `aug(b7)`, `7(b9,#11)`, `7(b5,*5)`, `maj(*5)`.
  Ties go to the shorthand needing no omission, then to the order above.
- **Bass** is an interval from the root within the octave (`/b7`, `/3`); a bass
  equal to the root is not written. The bass is kept apart from the chord's
  intervals, so `C:min/b7` (iReal `C-/Bb`) and `C:min7/b7` (`C-7/Bb`) keep their
  source's spelling.
- **Reading source Harte**: omissions apply first, then an added altered
  interval replaces the shorthand's natural interval on its degree (`7(b5)` is
  C E Gb Bb), as ChoCo's corpora use it. Listing the natural interval as well
  keeps it (`13(b5,5)`). Strict Harte (`7(b5,*5)`) reads the same, and the
  canonical form is valid strict Harte. Non-standard shorthands are read as
  `hdim` = `hdim7` and `6` = `maj6`.

## Chart symbols (iReal Pro notation)

Root (one accidental at most), then `-` minor, `^` major seventh, `h`
half-diminished, `o` diminished, `+` augmented, a number (`6 69 7 9 11 13`,
`5` power chord, `2` sus2 as ChoCo reads it, `1` root alone), then
alterations (`b9 #11`), `sus`, `sus2`, `addN`, `noN`, `alt` (1 3 b5 b7 b9 b13,
as ChoCo reads it) and `/bass`. iReal symbols are read literally: `7#11` is
1 3 5 b7 #11 and `7b13` is 1 3 5 b7 b13 (ChoCo, through music21, adds a ninth to
the first and a ninth and eleventh to the second). Typed spellings are read
too: `min7` = `-7`, `maj7` = `^7`, `maj` = major triad, `m` = `-`, `dim` = `o`.

`write_chart` writes the shortest chart symbol that `parse_chart` reads back
as exactly the same chord (`13b9`, `7#5`, `7no5`, `add9`). A root with two
accidentals (`Bbb`, from the classical corpora) is respelled `A`, since charts
cannot write it. Every chord of the catalog converts Harte -> chart -> Harte
without change (checked on all 8,097 spellings of the earlier catalog).

## Chord lengths in iReal bars

An iReal Pro chart is a grid of cells, 16 to a row; where a chord sits in its
bar sets how long it lasts. Both importers (`ireal_playlist.bar_beats` for the
catalog, `cellBeats` in `studio/src/formats/ireal.ts` for Studio's Import) read
a bar the same way:

1. **Cells.** A chord, a space and an `n` (N.C.) fill one cell each; `XyQ` is
   three empty cells; a comma separates two chords without a cell; comments,
   alternate chords `( )`, size marks `s`/`l` and other signs fill none.
2. **A chord lasts its cell and the empty cells after it.** Empty cells before
   the first chord of a bar are skipped, and a bar of empty cells only is not
   played, as in iReal Pro.
   A slash `p` is a cell of the chord before it. Inside a bar it is an empty
   cell, so the chord goes on (`F p Bb p` is F for two beats, then Bb). At the
   start of a bar it repeats the previous bar's last chord
   (`ireal_playlist._fill_slashes`, `formats/ireal.ts`).
3. **Beats.** Each chord starts where its cell lies in the bar. When the cells
   and the beats do not line up, the chords take the whole-beat lengths (one
   beat at least) whose starts are closest to the cells' positions.
4. **Even split.** Evenly spaced chords, ties and bars with more chords than
   beats are shared as Studio shares a bar it is given without lengths
   (`evenSplit`): one chord fills the bar, three in 4/4 are 2+1+1, two in 3/4
   are 2+1, other bars are shared equally (five chords in 4/4: 0.8 each).

Three chords in a 4/4 bar:

| Chart text | Cells | Beats |
|---|---|---|
| `F Abo,G-7 ` | 2+1+1 | 2+1+1 (F on beat 1, Abo on 3, G-7 on 4) |
| `F,Abo  G-7` | 1+2+1 | 1+2+1 |
| `F,Abo,G-7 ` | 1+1+2 | 1+1+2 |
| `F,Abo G-7 ` | 1+2+2 (starts 0, 0.8, 2.4) | 1+1+2 |
| `F Abo G-7 ` or `F,Abo,G-7` | evenly spaced | 2+1+1 |

The chords are stored at their bar and beat, beats counted from 1 like every
source in the catalog, and in quarter notes from bar 1: `F Abo,G-7 ` in bar 8
of a 4/4 chart is F on bar 8 beat 1, Abo on beat 3 and G-7 on beat 4 (quarters
28, 30 and 31). Any bar length works: a chord on beat 10 of a 12/8 bar stays
there. The import counts beats from 0 and declares it with `Track.first_beat`;
`track_store.add_track` stores the positions (see `score_timing.py`).

ChoCo (and pyRealParser) instead share every bar evenly by its number of
chords, so three chords in 4/4 last 1 1/3 beats each; the catalog reads the
cells from the charts' links instead. Beats are counted in the meter's own unit
in the catalog (6 per bar in 6/8) and in quarter notes in Studio.

**Tuplet marks.** A chart whose chords share beats in lengths that plain notes
cannot write (1 1/3, 2/3, 0.8 beats) shows a bracket over them with the number
of equal notes they make, as in printed music: `3` over three chords of 1 1/3
beats in 4/4, `5` over five chords sharing a 4/4 bar, `3` over 2/3 + 2/3 + 2/3
after a half bar (`tuplets` in `studio/src/music/chart.ts`). Dotted lengths
(1.5 beats) are plain and get no mark.

## Roman numerals

Roman numerals are computed when needed, not stored: `roman_rows(chord rows, keys)`
rewrites a song's chord rows with each chord read in the key in force at its onset.
`roman_chord` replaces the root by its degree measured on the tonic's major
scale, whatever the mode: in F minor G is `II` and Gb `IIb`. The quality and
bass interval are the canonical Harte ones. A change of key applies from its
onset; pickup chords before the first key use the first key.

Studio's Display menu can draw a chart in Roman numerals with the same degree
rule (`studio/src/music/roman.ts`), written as musicians read them: the
accidental first (`bII7` for the catalog's `IIb:7`) and the chord's quality
as on the chart (`II-7`, or `IIm7` with "Minor written Cm").

## Playing chart symbols in the Studio

`studio/src/music/chords.ts` reads chart symbols into a voicing family. Every
family the catalog can send has its own bass tones and piano voicings, so
nothing is played that the symbol does not contain:

| Symbol | Family | Close voicing |
|---|---|---|
| `C`, `Cadd9` | maj | C E G |
| `C-` | min | C Eb G |
| `Co` | dim | C Eb Gb |
| `Co7` | dim7 | C Eb Gb A |
| `C+` | aug | C E G# |
| `C7#5`, `C+7` | dom7 with #5 | C E G# Bb |
| `Csus` | sus | C F G |
| `Csus2`, `C2` | sus2 | C D G |
| `C7sus`, `C9sus`, `C13sus` | sus7 | C F G Bb |
| `C5` | power | C G |
| `C1` | root | C |

Sevenths, sixths and extensions (`^7 -7 7 h7 -^7 6 -6 9 11 13 alt` and their
alterations) use the jazz voicings of their family. Chord Sightreading checks
the played notes against the same families.

The root takes one accidental and a slash bass two (`Ab#11` is Ab with a #11,
not a root Ab#; `C/Bbb` is a bass of Bbb). The catalog's canonical chords
and the iReal Pro symbols were checked against these families: for 5,151
catalog symbols and 5,437 iReal Pro symbols Studio plays the notes of the
canonical chord, except about 80 rare classical analyses (augmented sixths,
added tones beyond the families) and 21 iReal Pro symbols written outside its
own notation (`susadd3`, `Asusb9`, `-7sus`), which are played as their
nearest family.
