# The data

Where the song catalog comes from, how it is stored, how it was curated and
every correction made to the source data. The short version is in the
[README](../README.md#the-data).

- [Sources](#sources)
- [Database layout](#database-layout)
- [Building the database](#building-the-database)
- [Curation](#curation)
- [Corrections to ChoCo](#corrections-to-choco)
- [Reading iReal Pro charts](#reading-ireal-pro-charts)
- [Key modes](#key-modes)
- [The catalog progressions](#the-catalog-progressions)
- [Piano patterns](#piano-patterns)
- [Testing lead sheets with the Weimar Jazz Database](#testing-lead-sheets-with-the-weimar-jazz-database)
- [Rights](#rights)

## Sources

`data/progressions.sqlite` holds **38,307 songs**, **2,517,870 chords** and
**43,126 key annotations**. Everything comes from
[ChoCo](https://github.com/smashub/choco) (Chord Corpus), which gathers 18
chord collections in one format. `data/sources.json` lists the sources, read in
this order:

| Source | File | Songs |
|---|---|---|
| ChoCo v1.0.0 release, iReal Pro collection skipped | `choco-v1.0.0.zip` (download, see the README) + `choco-nottingham-bass-5fe168f.zip` (corrections) | 15,141 |
| ChoCo's iReal Pro playlists, read from their `irealb://` links | `choco-ireal-raw-5fe168f.zip`, folder `playlists/` | 2,064 |
| Your own iReal Pro playlists (optional) | `data/ireal-playlists/` | - |
| iReal Pro forum charts collected by ChoCo, curated | `choco-ireal-raw-5fe168f.zip`, folder `forum/` | 23,223 |
| Duplicate and near-identical versions, removed at the end | (all sources) | −2,121 |

`choco-ireal-raw-5fe168f.zip` is ChoCo's raw iReal Pro data at commit
`5fe168f` (`partitions/ireal-pro/raw` in the ChoCo repository).

The ChoCo release, by collection (before duplicates are removed):

| Collection | Songs | Kind of music | Original format |
|---|---|---|---|
| Wikifonia | 5,965 | pop, jazz, film, folk lead sheets | MusicXML, converted with music21 |
| Band-in-a-Box (BiaB) Internet Corpus | 4,986 | jazz and pop standards | BiaB files |
| Real Book | 2,456 | jazz standards | text files |
| Nottingham | 985 | British and American folk tunes | ABC, converted with music21 |
| When in Rome | 449 | classical analyses | RomanText, converted with music21 |
| Rock Corpus | 200 | rock songs | text files |
| Jazz Corpus | 76 | jazz chord sequences | text files |
| Schubert Winterreise | 24 | the 24 songs of the cycle | converted with music21 |

## Database layout

Three tables:

| Table | One row per | Holds |
|---|---|---|
| `tracks` | song | id, title, artist, composers, genre, collection (`corpus`), license, the source's metadata as JSON |
| `events` | chord, key or time signature of a song | see below |
| `catalog_info` | setting | the sources, licenses and timing conventions |

### Events

Each event is stored with:

| Column | Meaning | Example |
|---|---|---|
| `kind` | what the event is | `chord`, `key` or `timesig` |
| `value` | the chord, key or meter, in one notation for every source ([chord notation](CHORD_NOTATION.md)) | `D:min7`, `C:major`, `4/4` |
| `measure` | the bar number, from 1 (0 for a pickup bar) | `1` |
| `beat` | the beat in that bar, from 1, counted in the meter's own unit: quarter notes in 4/4, eighths in 6/8 or 12/8, so a 12/8 bar has beats 1 to 12 | `3` |
| `onset` | the same position in quarter notes from the start of bar 1 (negative in a pickup), to sort and time events across changes of meter | `2.0` |
| `duration` | the length in quarter notes | `2.0` |
| `ordinal` | the order of the event among the song's chords (or keys, or meters), from 0 | `1` |

For example, the start of `| Dm7 G7 | Cmaj7 | Cmaj7 |` in C major, 4/4:

| kind | value | measure | beat | onset | duration | ordinal |
|---|---|---|---|---|---|---|
| timesig | 4/4 | 1 | 1 | 0 | 12 | 0 |
| key | C:major | 1 | 1 | 0 | 12 | 0 |
| chord | D:min7 | 1 | 1 | 0 | 2 | 0 |
| chord | G:7 | 1 | 3 | 2 | 2 | 1 |
| chord | C:maj7 | 2 | 1 | 4 | 8 | 2 |

More examples of positions:

| Position | `measure` | `beat` | `onset` |
|---|---|---|---|
| beat 3 of bar 5 in 4/4 | 5 | 3 | 18 |
| beat 11 of bar 8 in 12/8 (eighths) | 8 | 11 | 47 |
| second half of beat 2 in 4/4, bar 1 | 1 | 2.5 | 1.5 |
| a pickup note on beat 4 before bar 1 | 0 | 4 | −1 |

Special chord values: `N` is no chord (N.C.) and `X` an unknown or unreadable
chord. They stay as they are when read as Roman numerals, and the exercises
never ask about them.

### One position format for every source

Each source writes positions its own way; they are all converted to the form
above when they are read (`score_timing.py`, `track_store.add_track`), so the
rest of the project only ever sees bars and beats from 1:

| Source | How it writes "bar 8, beat 3" | Converted to |
|---|---|---|
| ChoCo collections | one number, bar + beat / 10: `8.3` | `measure` 8, `beat` 3 |
| ChoCo's Schubert Winterreise | the same, beats counted from 0: `8.2` | `measure` 8, `beat` 3 |
| iReal Pro charts | bar, then the beat counted from 0 | `measure` 8, `beat` 3 |
| Wikifonia, Nottingham, When in Rome, Schubert | beats as music21 counts them (dotted quarters in 6/8, 9/8, 12/8) | beats in the meter's unit |

The ChoCo number cannot hold beats 10 to 12, so beats in 12/8 bars need a
repair when they are read: see [Positions written as one number](#positions-written-as-one-number-781-chords-in-98-songs).

### Roman numerals

Roman numerals are not stored: `chord_notation.roman_rows` computes them from
a song's chords and the key in force at each chord. They are written as an
uppercase degree, measured on the major scale of the key's tonic (even in
minor), followed by the chord's quality:

| Key | Chord | Roman numeral |
|---|---|---|
| C major | `D:min7` | `II:min7` |
| C major | `G:7` | `V:7` |
| F minor | `F:min` | `I:min` |
| F minor | `G:maj7` | `II:maj7` |
| F minor | `Gb:min` | `IIb:min` (accidental after the numeral) |

A key change applies from its own position. Pickup chords before the first key
use the first key. The app writes the same numerals the way musicians read
them (`bII7` for `IIb:7`, `ii-7` style qualities), see
[chord notation](CHORD_NOTATION.md#roman-numerals).

Reading one song with its Roman numerals, in Python:

```python
import sqlite3
from chord_notation import roman_rows

db = sqlite3.connect("data/progressions.sqlite")
track = "real-book_1299"
keys = db.execute("SELECT onset, value FROM events WHERE track_id=? AND kind='key' ORDER BY onset, ordinal", (track,)).fetchall()
chords = db.execute("SELECT ordinal, onset, duration, value FROM events WHERE track_id=? AND kind='chord' ORDER BY ordinal", (track,)).fetchall()
for (ordinal, onset, duration, chord), (_, _, _, roman) in zip(chords, roman_rows(chords, keys)):
    print(ordinal, chord, roman, onset, duration)
```

## Building the database

With Python 3.10 or newer (standard library only), from the project root:

```sh
python build_database.py        # data/progressions.sqlite from data/sources.json (about 2 minutes)
python find_progressions.py     # data/common_progressions.json
python build_exercises.py       # studio/public/exercises/name-progression.json
python build_mobile_catalog.py  # studio/public/catalog/, the catalog bundled in the apps
```

The modules involved:

| Module | Role |
|---|---|
| `build_database.py` | reads the sources of `data/sources.json` in order and writes the database |
| `import_choco.py` | reads the ChoCo release and corrects its errors |
| `ireal_playlist.py` | reads `irealb://` charts, lays out repeats and cells, curates the forum charts |
| `track_store.py` | writes songs, converts positions, settles key modes (with `key_modes.py`) |
| `song_dedupe.py` | removes duplicate and near-identical versions |
| `chord_notation.py` | every chord, key and Roman numeral spelling |
| `score_timing.py` | bars and beats in every meter |

Each run writes logs to `logs/`: one per iReal Pro source (see
[the import log](#the-import-log)) and `similar-songs-<time>.log`, the list of
removed near-identical versions.

## Curation

### Entries left out

| Rule | Entries |
|---|---|
| ChoCo annotations made from audio recordings rather than scores | 2,144 |
| ChoCo collections licensed for non-commercial use only (see [Rights](#rights)) | 193 |
| Songs without a key | 38 |
| Songs without any chord | 1 |
| Nottingham tunes expanded to over 500 bars ([see below](#entries-that-cannot-be-played)) | 6 |

When a song has several annotators, one primary annotation is kept.

### Duplicates

A song with exactly the same bars and chords as one already read is not
imported, whatever its collection or title: 515 ChoCo songs and 56,931 iReal Pro
charts (the forum often holds the same chart many times).

### Near-identical versions

Once every source is read, `song_dedupe.py` compares the versions of each song
**by sound**: a chord counts as its root, its intervals without the seventh,
and its bass. So a change of key, or a seventh added or removed, does not make
two versions different.

Two songs are versions of the same song when their titles are related:

| Title A | Title B | Related? |
|---|---|---|
| Misty | Misty - Erroll Garner | yes, words added after |
| When Lights Are Low | When Lights Are Low 1 | yes |
| We Will Rock You | P19 We Will Rock You | yes, words added before |
| Tune | Tune Up | no, the shorter title has fewer than 5 letters |
| Autumn Leaves | All the Things You Are | no |

Two versions of the same song are then merged when their chords are:

- the same at the same positions (exact duplicates, 435 removed), or
- at most 2 edits apart, with at most 2 bars of difference in length
  (near-identical, 1,686 removed). An edit is a chord inserted, removed or
  replaced; repeated chords are merged first.

For example, two versions of *Misty*, one in E♭ and one in C, that differ only
by a Cm7 where the other has Cm, would be kept once. The version with
the shortest title stays, then the preferred source. The title condition keeps
apart different songs on the same chords: blues heads, rhythm-changes tunes and
four-chord pop songs would otherwise collapse into one. Versions that differ
more stay, and the app groups them under one title.

### Forum charts

The iReal Pro forum charts are user-contributed, so they are curated
(`"curate"` in `data/sources.json`). A forum chart is left out (8,090 in all)
when:

| Rule | Example | Charts |
|---|---|---|
| Its song is already in the catalog from another source, unless the chart was posted in at least 2 different forum threads | a third *Autumn Leaves* posted once | 5,696 |
| All the threads it was posted in are practice threads (exercise, practice, drill, lesson, etude, scales, warm-up, licks, test, how to) | a chart from "Jazz practice exercises" | 2,135 |
| It has fewer than 4 bars | a two-bar vamp | 119 |
| Its title marks an exercise or a placeholder | "New Song", "untitled", "Blues in F", "II - V - I" | 107 |
| It has a single chord | a drone | 33 |

Threads are counted, not copies: half of the copies are repeats inside one
thread (quotes, re-posts). Popular forum versions stay: *Fly Me To The Moon*
was posted in 16 threads, *Misty* in 12. Titles listed under `keep` in
`data/sources.json` are never left out.

## Corrections to ChoCo

Every collection was checked against ChoCo's latest repository (only the iReal
Pro data changed since v1.0.0) and against its original source, converted
independently (with music21 for Wikifonia, Nottingham, When in Rome and the
Rock Corpus). All the problems below are in **ChoCo's files**; all the fixes are
made **when those files are read**, by code or a correction file, never by
editing the data by hand. The database itself stores positions as bars and
beats and has none of these problems.

Each correction gives the problem, an example, the fix with the code that
makes it, and the result.

### Chords placed where they end (Jazz Corpus, 76 songs)

- **Problem:** ChoCo's parser (`choco/parsers/harm_parser.py`,
  `process_multiline_annotation`) places each chord at the running sum of the
  lengths *including its own*, counted from bar 0. So each chord is written
  where it ends, minus one bar: right only for chords of exactly one bar.
- **Example:** `| Dm7 G7 | Cmaj7 | Cmaj7 |` came out with Dm7 half a bar before
  the song, G7 on bar 1, beat 1, and Cmaj7 on bar 3.
- **Fix:** the lengths are right, so the chords are laid end to end again from
  bar 1, beat 1 (`import_choco.laid_end_to_end`, `POSITIONS_FROM_LENGTHS`).
- **Result:** Dm7 on bar 1, beat 1; G7 on bar 1, beat 3; Cmaj7 on bar 2.

### Chords drifting in 3/4 (Band-in-a-Box, 95 songs)

- **Problem:** ChoCo's parser (`choco/parsers/biab_parser.py`) moves on to the
  next chord with the meter's denominator instead of the bar length. That is
  only right when the two are equal (4/4, 2/2).
- **Example:** in a waltz with one chord per bar, the second chord was on
  beat 2 of bar 2, and the following ones drifted further.
- **Fix:** as for the Jazz Corpus, the chords of songs whose meter has a
  different numerator and denominator are laid end to end from their lengths.
- **Result:** one chord on beat 1 of every bar.

### Positions written as one number (781 chords in 98 songs)

- **Problem:** ChoCo writes a position as bar + beat / 10, so beats 10 to 12
  overflow into the next bar's number.
- **Example:** bar 8, beat 11 is written `8 + 11/10 = 9.1`, which looks exactly
  like bar 9, beat 1.
- **Fix** (`import_choco.choco_positions`): the number alone cannot tell the two
  apart, so the import uses the chord before. If chord A starts on bar 8,
  beat 1 and lasts 10 beats, it ends on bar 8, beat 11, which ChoCo writes
  `9.1`. A next chord written `9.1` therefore starts where A ends: bar 8,
  beat 11. When the numbers point to bar 9 (A lasted the whole bar), the chord
  stays on bar 9.
- **Result:** `measure` 8, `beat` 11.

The same reading handles **beat 0**: some BiaB chords on the last beat of a bar
are written as beat 0 of the next bar (`3.0` for bar 2, beat 4 in 4/4). Beats
start at 1, so beat 0 is read as the last beat of the bar before.

### Beats and lengths counted by music21 (Wikifonia, Nottingham, When in Rome, Schubert)

- **Problem:** these collections count beats as music21 does: in 6/8, 9/8 and
  12/8 a beat is a dotted quarter, so a 6/8 bar has 2 beats and a 12/8 bar 4.
  When in Rome also gives its lengths in quarter notes, even in 2/2. The other
  collections count in the meter's unit (6 beats in 6/8).
- **Example:** a 6/8 tune with one chord per bar gives each chord a length of
  2 beats. Read as 2 eighths, the chord lasted a third of its bar and left a
  false "no chord" gap; a chord on the second beat (the fourth eighth) moved
  to the second eighth. A When in Rome chord filling a 2/2 bar lasted two bars.
- **Fix:** each collection is read with its own counting
  (`import_choco.COUNTING`, `score_timing.BarGrid`), and lengths are converted
  bar by bar, so a chord crossing a change of meter is right too. When in Rome
  counts 3/8 bars as one beat or three eighths depending on the score; each song
  is read the way under which its chords follow each other
  (`import_choco.song_counting`).
- **Result:** the 6/8 chord lasts its whole bar. In every collection, 99 to
  100 % of chords now start exactly where the one before ends.

### Wrong time signatures (Real Book, 142 songs)

- **Problem:** ChoCo (`parse_rbook` in `choco/parsers/instances.py`) takes each
  song's meter from a metadata table, matched by an id it generates itself, so
  127 of 2,839 songs get another song's meter. The chords themselves come from
  the song's own file, always in bars of 4 beats.
- **Example:** *Belle of the Ball*, a waltz, was in 4/4; 12 songs in 4/4 were
  in 3/4.
- **Fix:** every Real Book song is read in 4/4, except the twelve waltzes of
  ChoCo's own table (`import_choco.REAL_BOOK_WALTZES`), whose chords are
  rescaled to bars of 3 beats (`import_choco.in_three`): a chord of 4 beats
  becomes 3, two chords of 2 beats become 1 1/2 each.
- **Result:** *Belle of the Ball* is in 3/4, the 4/4 songs in 4/4.

### Chords written in C (Jazz Corpus, 76 songs)

- **Problem:** the corpus writes every song transposed to C, with its real key
  beside it. ChoCo kept both, so the chords did not match their key. The keys
  were also misspelt (`C:majoror`).
- **Example:** a song in F was stored as `Dm7 G7 C` in F, read as vi-ii-V
  instead of ii-V-I.
- **Fix:** every chord is transposed from C to the song's key
  (`chord_notation.transpose_from_c`), and the key is spelt `C:major`.
- **Result:** `Gm7 C7 F` in F.

### Nottingham slash chords (445 chords in 82 tunes)

- **Problem:** the tunes write a sharp bass as `+` (ABC notation); ChoCo
  dropped it.
- **Example:** `D/f+` (D with F♯ in the bass) was stored as D/F.
- **Fix:** `choco-nottingham-bass-5fe168f.zip` holds the corrected chords, read
  again from the original tunes at ChoCo commit `5fe168f`. Rebuild it with
  `python build_nottingham_fix.py <ChoCo repository> choco-v1.0.0.zip`.
  Chords already right (`Gm/b-`) are left alone.
- **Result:** D/F♯.

### Grace chords (2,504 chords, mostly Wikifonia)

- **Problem:** a chord of zero length, followed by another at the same place,
  never sounds but showed in charts and exercises.
- **Fix:** it is dropped (`superseded` in `import_choco.py`); an entry left
  with no chord is left out.
- **Result:** only the chord that sounds remains.

### Entries that cannot be played

- **Endless Nottingham tunes (6):** ChoCo writes out each tune's repeats, and
  for six tunes this produced 1,000 to 2,000 bars (*Meggy's Foot*, *The Pinch
  of Snuff*...). Tunes over 500 bars are left out (`import_choco.MAX_BARS`).
- **Missing titles (76 Jazz Corpus songs):** named "Jazz Corpus sequence 1",
  "Jazz Corpus sequence 2"... (`import_choco.song_title`; other untitled
  entries would be "Untitled (id)"). Empty titles had made them look like
  duplicates of each other.
- **Titles in other alphabets:** search used to drop every letter outside a to
  z, so Greek, Cyrillic or Japanese titles became empty texts, equal to each
  other. Letters of every script are now kept (`score_search._fold`,
  `foldText` in `studio/src/library/catalog.ts`): "Катюша" is searched as
  "катюша", "Café" as "cafe".

## Reading iReal Pro charts

ChoCo's own conversion of the iReal Pro charts is not used: the charts are read
again from their original `irealb://` links by `ireal_playlist.py`.

### Why not ChoCo's conversion

ChoCo's converted iReal Pro files damage chords in several ways:

| ChoCo's step | What goes wrong | Example |
|---|---|---|
| removes comments and custom text after splitting bars | the first letter of custom text is lost | `F*maj7*` becomes `Faj7`, `A*m*` becomes `A` |
| the same | the `l` of `alt` is lost | `7alt` becomes `7at` |
| pyRealParser | 12/8 is read as 1/2 | a 12/8 blues in 1/2 |
| music21 conversion | notes are added | `7#11` becomes `9(#11)` |
| the same | slash basses are copied into the chord | `C/D` gains a D (a ninth) |
| the same | wrong quality | `7b9#9` becomes a major seventh |
| ChoCo v1.0.0 | `h` read as a flat | `Dh7` (D half-diminished) becomes `Db:7` |
| every chart | each bar shared equally between its chords | `F Abo,G-7`: 1 1/3 beats each instead of 2 + 1 + 1 |

### How charts are laid out

Like ChoCo (ChoCoTune, based on pyRealParser), repeats, numbered endings, codas
and repeat signs are written out, and one meter is used per chart. Unlike
ChoCo, a chord lasts as long as the cells it fills, as iReal Pro plays it
([chord lengths in iReal bars](CHORD_NOTATION.md#chord-lengths-in-ireal-bars)):

| Chart | iReal Pro plays | ChoCo stored |
|---|---|---|
| `F Abo,G-7` | F 2 beats, Abo 1, G-7 1 | 1 1/3 beats each |
| `F,Abo  G-7` | F 1 beat, Abo 2, G-7 1 | 1 1/3 beats each |
| `F,Abo,G-7` | F 1 beat, Abo 1, G-7 2 | 1 1/3 beats each |

A slash cell (`p`) inside a bar continues the chord before it; at the start of
a bar it repeats the previous bar's last chord. Checked against ChoCo's own
layout, 2,007 of 2,028 playlist charts have the same bars and chords in the same
order; the others differ where ChoCo is wrong.

### Charts that cannot be read

A chart that cannot be read exactly is not imported, rather than imported
wrongly (2,099 charts, all but three from the forum). The main reasons:

| Reason | Charts | Example |
|---|---|---|
| a chord quality iReal Pro does not define | 653 | `C4`, `C7+`, `C7M`, `Csus7` (*Man Of Constant Sorrow*: `Xy` in bar 24) |
| a numbered ending at the start of a repeat | 340 | *Like A Rolling Stone* |
| unpaired repeat signs that would expand the chart more than four times | 271 | *Baby Girl*: 27 written bars would become 327 |
| more coda signs than can be laid out | 213 | *Getting You Home*: 6 coda signs, at most 2 can be read |
| an invisible chord (`W`) before any chord | 139 | *I Walk The Line - Intro Vamp* |
| a repeat slash with no chord before it | 133 | *Perhaps Love* |
| no bars at all | 120 | *Jig Template* |
| an unreadable chord root | 103 | `2F` in *Proezas De Solon* |

### The import log

Each iReal Pro source writes `logs/ireal-import-<source>-<time>.log`, one line
per song:

| Line | Meaning | Example |
|---|---|---|
| `OK` | imported, with its id, key, meter and size | `Wind That Shakes the Barley \| ireal-pro-forum_3, D:major, 4/4, 16 bars, 23 chords` |
| `DUPLICATE` | the same as a chart already read | `Connaughtman's Rambles, The \| same chart as ireal-pro-forum_2` |
| `CURATED` | left out by curation, with the rule | `Orphan, The \| song already in the catalog, posted in 1 thread(s)` |
| `ERROR` | could not be read, with the reason | `Proezas De Solon \| bar 16: unreadable chord root in '2F'` |
| `WARNING` | imported, with a remark | `5 Oclock Somewhere \| meter changes (T54, T44) read as T54 throughout` |

Each line also names the file, link and song number it comes from
(`forum/bluegrass-country/"celtic" style.csv link 6 song 1`).

The log ends with a summary, such as `23224 imported, 56890 duplicates merged,
8090 left out by curation, 2096 failed`.

About 800 forum charts are in the default key C although no tonic chord of C
appears: their contributors did not set the key. No key estimate was reliable
enough to replace it (74 % agreement on charts whose key is known), so they keep
C.

### Adding iReal Pro playlists

Put playlist files (`.txt` or `.html` holding `irealb://` links, as iReal Pro
exports them or forums share them; a folder or a `.zip` of them also works) in
`data/ireal-playlists/` and build the data again. The charts join the catalog
as the collection "iReal Pro playlists", searchable in the app and used by the
exercises. To add another source, add an entry of type `ireal` to
`data/sources.json`:

```json
{
  "name": "My band's book",
  "type": "ireal",
  "path": "data/band-book",
  "collection": "band-book",
  "corpus": "Band book",
  "license": "private"
}
```

## Key modes

Some collections do not say whether a key is major or minor:

| Collection | Problem | Example |
|---|---|---|
| BiaB, Rock Corpus | only the key's note is given | "G" for a blues in G minor |
| Real Book | many minor songs marked major (56 of the 109 that iReal Pro marks minor) | a minor tune marked "C major" |
| Wikifonia | keys come from the key signature, the same for a major key and its relative minor (133 of 147) | a C minor song (three flats) marked "E♭ major" |

`settle_modes` (`track_store.py`, rule in `key_modes.py`) decides the mode:

1. From **another version of the same song** with the same tonic and a trusted
   mode (iReal Pro marks it reliably): if the iReal Pro *Autumn Leaves* is in
   G minor, the BiaB "G" becomes G minor.
2. Otherwise from **the chords**: the time spent on the major and minor tonic
   chords (C against Cm). For Wikifonia the relative minor counts too: an
   "E♭ major" song that spends more time on Cm than on E♭ becomes C minor.
   The thresholds were measured on songs whose mode is known (94 to 96 %
   agreement, 99 % on iReal Pro).
3. When neither decides, the key keeps only its note (`C`), and the app shows
   "(major or minor)". This is the case for 821 of 43,126 keys.

| Collection | Keys | Minor before | Minor after | Undecided |
|---|---|---|---|---|
| BiaB | 3,827 | 0 % | 8 % | 205 |
| Rock Corpus | 315 | 0 % | 19 % | 6 |
| Real Book | 2,427 | 6 % | 7 % | 107 |
| Wikifonia | 6,553 | 2 % | 13 % | 503 |
| Jazz Corpus | 76 | 21 % | 21 % | 0 |

## The catalog progressions

`data/common_progressions.json` holds the **20 progressions** of the exercises,
defined in `common_progressions.py`, with every song where each one occurs.
`python find_progressions.py` rebuilds it (the function is
`find_progressions.attach_songs(database_path, catalog)`).

| Progression | Stored as | Songs |
|---|---|---|
| ii V I | `II:min V:maj I:maj` | 9,877 |
| II V I | `II:maj V:maj I:maj` | 5,637 |
| IV V I | `IV:maj V:maj I:maj` | 5,522 |
| I IV V | `I:maj IV:maj V:maj` | 4,216 |
| vi ii V I | `VI:min II:min V:maj I:maj` | 2,766 |
| iv V i | `IV:min V:maj I:min` | 1,423 |
| IV V I vi | `IV:maj V:maj I:maj VI:min` | 985 |
| I V vi IV | `I:maj V:maj VI:min IV:maj` | 810 |
| vi IV I V | `VI:min IV:maj I:maj V:maj` | 722 |
| I vi IV V | `I:maj VI:min IV:maj V:maj` | 670 |
| ii bII7 I | `II:min IIb:7 I:maj` | 321 |
| I bVII IV I | `I:maj VIIb:maj IV:maj I:maj` | 303 |
| i bVII bVI V | `I:min VIIb:maj VIb:maj V:maj` | 259 |
| bVI bVII I | `VIb:maj VIIb:maj I:maj` | 206 |
| i bVII bVI bVII | `I:min VIIb:maj VIb:maj VIIb:maj` | 176 |
| ii bVII7 I | `II:min VIIb:7 I:maj` | 114 |
| V iv I | `V:maj IV:min I:maj` | 90 |
| I III IV iv | `I:maj III:maj IV:maj IV:min` | 34 |
| I V IV IV I V I V | `I:maj V:maj IV:maj IV:maj I:maj V:maj I:maj V:maj` | 26 |
| I V vi iii IV I IV V | `I:maj V:maj VI:min III:min IV:maj I:maj IV:maj V:maj` | 8 |

"Songs" counts distinct songs: versions of one song in several collections
count once (`unique_song_count`). The list is ordered by it.

### How a progression is found in a song

The song's chords are read as Roman numerals, then compared step by step:

| Rule | Example |
|---|---|
| `maj` and `min` match any chord with a major or minor third | `II:min` matches Dm, Dm7 and Dm9; `I:maj` matches C, Cmaj7, C6 and C7 |
| a written `7` needs a dominant seventh | `IIb:7` matches D♭7 and D♭9, not D♭maj7 |
| altered fifths, augmented, diminished, suspended and unknown chords do not match | `V:maj` does not match G7♯5 or Gsus |
| the bass does not count | `I:maj` matches C/E |
| repeated chords count once | `Dm7 Dm7 G7 C` contains ii V I |
| a step written twice needs two chords | `IV IV` in a progression needs two IV chords in a row |
| a key change splits the song | a ii-V in one key and a I in the next key do not make a ii-V-I |
| lengths are ignored | a ii of one beat counts as much as a ii of four bars |

### What is stored for each song

Each matching song has its id, title, artist, composers, collection, the key and
bar of its first match, and a list of **passages**, one per match:

```json
{
  "track_id": "biab-internet-corpus_1",
  "title": "All God's Chillun Got Rhythm",
  "corpus": "BiaB Internet Corpus",
  "first_key": "C:major",
  "first_measure": 4,
  "matching_passages": 4,
  "passages": [
    {"key": "C:major", "start_ordinal": 6, "end_ordinal_exclusive": 9,
     "start_measure": 4, "start_beat": 1.0, "start_quarter": 12.0, "end_quarter": 18.0}
  ]
}
```

The ordinals give the exact chords of the passage (chords 6, 7 and 8 here), and
the quarter positions its place in the music (from quarter note 12 to 18, so
bars 4 and 5 in 4/4). A passage ends at the next key change at the latest. The
catalog holds 143,324 passages. The exercises are built from them
([exercises](EXERCISES.md)).

## Piano patterns

`data/left_hand_patterns.json` holds the 16 piano patterns offered in the app,
with their styles and notes. Rebuild it with `python left_hand_patterns.py`;
the [pattern audit](../PATTERN_AUDIT.md) gives their sources and menus.

## Testing lead sheets with the Weimar Jazz Database

The catalog has chords only. To test the app's lead sheets (a melody over the
chords) on real music, `weimar_playlist.py` turns the solos of the
[Weimar Jazz Database](https://jazzomat.hfm-weimar.de/) into a Studio export
that the app imports with **Import > Studio export**. The database and the
files made from it are **not shipped** with the project (`data/weimar*` is
ignored by git): it is a test tool.

```sh
# wjazzd.db is in the ChoCo repository (partitions/weimar/raw/) or on the Jazzomat site
python weimar_playlist.py wjazzd.db data/weimar_solos.json            # all 450 solos
python weimar_playlist.py wjazzd.db data/weimar_some.json --melid 1 3  # chosen solos
```

The database holds 456 transcribed solos (saxophones, trumpets, trombone,
clarinet, vibraphone, piano, guitar) with every note's bar, beat and position
inside the beat, the beat track and the chord changes. How a solo becomes a chart:

| Database | Chart | Example |
|---|---|---|
| `solo_info.title`, `performer` | title, and "performer solo" in place of the composer | Anthropology, "Art Pepper solo" |
| `key` | key and minor flag | `Bb-maj` is B♭ major; `C-min`, `F-dor` are minor |
| `avgtempo`, `rhythmfeel` | tempo; style (SWING, TWOBEAT: Swing; LATIN: Latin; BALLAD: Ballad; FUNK: Straight Pop/Rock) | 218.8 bpm, SWING: Swing at 219 |
| `instrument` | the melody's instrument | `as` alto sax, `ts` tenor sax, `tp` trumpet, `vib` vibraphone |
| `beats.bar`, `beat` | bars from the first note to the last, four to a row; a pickup bar is a whole bar, with N.C. before the first chord | bar 0 (pickup), bars 1, 2... |
| `beats.chord` | chords where they change, in chart notation (checked with `chord_notation.py`) | `Bbj7` is B♭^7, `Am7b5` Ah7, `D79b` D7♭9, `F+j7` F^7#5, `NC` N.C. |
| `beats.form` | rehearsal marks | `A1` at bar 1 is mark A, `I1` an intro |
| `melody.beat`, `tatum`, `division` | position: (beat − 1) + (tatum − 1) / division quarter notes, rounded to a twelfth | beat 2, tatum 2 of 3 is 1.333 |
| `melody.duration`, `beatdur` | length: duration / beat duration, rounded to a twelfth; a silence shorter than a sixteenth before the next note is closed up | 0.14 s at 0.3 s a beat is an eighth |

Six free-time solos (transcribed without bars) are left out. On screen, the
app writes each beat in sixteenths or triplet eighths
([lead sheets](../studio/README.md#lead-sheets)), so a played rubato or a
laid-back phrase appears on the nearest of those positions.

Citation: M. Pfleiderer, K. Frieler, J. Abeßer, W.-G. Zaddach and B. Burkhart
(eds.), *Inside the Jazzomat: New Perspectives for Jazz Research*, Schott
Campus, Mainz (2017).

## Rights

ChoCo licenses its data under CC BY 4.0, except the collections derived from
the Chordify Annotator Subjectivity Dataset (`casd`), Jazz Audio-Aligned
Harmony (`jaah`) and the Mozart Piano Sonatas (`mozart-piano-sonatas`), which
are CC BY-NC-SA 4.0 ([ChoCo's license](../data/CHOCO_LICENSE.md)). Those three
are not imported, so the whole catalog is CC BY 4.0
([data license](../data/LICENSE.md)). ChoCo labels its iReal Pro data CC BY 4.0;
the forum charts were contributed by iReal Pro forum users. The catalog holds
chord symbols, titles, composers, keys and meters only: no melodies, lyrics,
audio or sheet music.

Credit: J. de Berardinis, A. Meroño-Peñuela, A. Poltronieri and V. Presutti,
"ChoCo: a Chord Corpus and a Data Transformation Workflow for Musical Harmony
Knowledge Graphs", *Scientific Data* 10, 641 (2023).
[Dataset](https://github.com/smashub/choco).

Before publishing anything built on this catalog, check the rights for the
songs, charts and titles you show: ChoCo's license covers its annotations, not
the songs themselves.
