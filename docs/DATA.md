# The data

This page explains where the song catalog comes from, how it is stored, how it
was curated and every correction made to the source data. The short version is
in the [README](../README.md#the-data).

- [Sources](#sources)
- [Database layout](#database-layout)
- [Building the database](#building-the-database)
- [Curation](#curation)
- [Corrections to ChoCo](#corrections-to-choco)
- [Key modes](#key-modes)
- [The catalog progressions](#the-catalog-progressions)
- [Piano patterns](#piano-patterns)
- [Rights](#rights)

## Sources

`data/progressions.sqlite` holds **38,307 songs** with **2,517,870 chords**,
**43,126 key annotations** and their time signatures. Coverage includes jazz
charts (iReal Pro, Real Book, Jazz Corpus), pop and rock songs (Wikifonia,
Band-in-a-Box, Rock Corpus), folk tunes (Nottingham) and classical analyses
(When in Rome, Schubert Winterreise). A title may appear in several
collections with different arrangements; each version stays a separate entry,
but duplicate and near-identical versions of a song are kept once.

All of it comes from [ChoCo](https://github.com/smashub/choco) (Chord Corpus),
which gathers 18 chord collections in one format:

| Source | File | Songs |
|---|---|---|
| ChoCo v1.0.0 release, iReal Pro collection skipped | `choco-v1.0.0.zip` (download, see the README) + `choco-nottingham-bass-5fe168f.zip` | 15,141 |
| ChoCo's iReal Pro playlists, read from their irealb:// links | `choco-ireal-raw-5fe168f.zip` (`playlists/`) | 2,064 |
| Your own iReal Pro playlists (optional) | `data/ireal-playlists/` | - |
| iReal Pro forum charts collected by ChoCo, curated | `choco-ireal-raw-5fe168f.zip` (`forum/`) | 23,223 |
| Duplicate and near-identical versions removed afterwards | (all sources) | -2,121 |

Songs of the ChoCo release by collection (before duplicates are removed):
Wikifonia 5,965, Band-in-a-Box Internet Corpus 4,986, Real Book 2,456,
Nottingham 985, When in Rome 449, Rock Corpus 200, Jazz Corpus 76, Schubert
Winterreise 24.

`choco-ireal-raw-5fe168f.zip` holds ChoCo's raw iReal Pro data at commit
`5fe168f` (`partitions/ireal-pro/raw` in the ChoCo repository).
`data/sources.json` lists the sources, read in that order.

## Database layout

- `tracks`: title, artist/performer, composers, source corpus, media type (`score`), duration and original metadata JSON.
- `events`: ordered `chord`, `key`, and `timesig` annotations. `value` is a canonical Harte chord, a key (`C:minor`, or `C` when the mode is unknown) or a meter (`4/4`); see [chord notation](CHORD_NOTATION.md). `ordinal` gives the canonical order of a song's chords.
- `catalog_info`: source, license, and timing conventions.

Every event is stored at its **bar and beat** and at its **position in quarter notes** (`score_timing.py`): `measure` is the bar number (1 for the first full bar, 0 for a pickup), `beat` the beat in that bar counted from 1 in the meter's own unit (6/8 has beats 1 to 6, 12/8 beats 1 to 12), `onset` the position in quarter notes from the start of bar 1 (negative in a pickup) and `duration` the length in quarter notes. Sources give bars and beats in their own way (ChoCo as one number, measure + beat / 10; iReal charts counting beats from 0; ChoCo's Schubert Winterreise counting from 0, `Track.first_beat`), and `track_store.add_track` stores them all this way, so every import, new iReal playlists included, is stored the same way. Two ChoCo writing problems are corrected at import: its single number cannot write beats 10 and above (beat 10 of bar 8 comes out as `9.0`), so a chord written where the chord before it would roll over is put back on its beat (`import_choco.choco_positions`; 781 chords of 98 songs now sit on beats 10 to 12, mostly in 12/8), and the last beat of some BiaB bars, written as beat 0 of the next bar, is stored as the beat it is. Use `ordinal` or `onset` for event order. Chord values `N` and `X` mean no chord and unknown/ambiguous chord, respectively, and remain unchanged as Roman numerals; they should not become trainer questions.

Roman numerals are not stored: `chord_notation.roman_rows` computes them from a song's chord and key events when a script needs them (progression search, exercise building). They use **uppercase scale degrees with explicit chord quality**. The root is measured against a major-scale grid starting at the current key's tonic, even when that key is minor. Accidentals follow the numeral, matching `F:min` → `I:min`, `G:maj7` → `II:maj7`, and `Gb:min` → `IIb:min` in F minor. The rest of the canonical Harte symbol, including quality, extensions, and bass degree, is retained. A key change applies to chords at its onset. For pickup chords that precede the first key marker, the first annotated key is used.

Example (Python) for the chords of one song with their Roman numerals:

```python
import sqlite3
from chord_notation import roman_rows

db = sqlite3.connect("data/progressions.sqlite")
track = "real-book_1299"
keys = db.execute("SELECT onset,value FROM events WHERE track_id=? AND kind='key' ORDER BY onset,ordinal", (track,)).fetchall()
chords = db.execute("SELECT ordinal,onset,duration,value FROM events WHERE track_id=? AND kind='chord' ORDER BY ordinal", (track,)).fetchall()
for (ordinal, onset, duration, chord), (_, _, _, roman) in zip(chords, roman_rows(chords, keys)):
    print(ordinal, chord, roman, onset, duration)
```

The catalog stores whole songs. The exercises extract short passages from them (see [exercises](EXERCISES.md)).

## Building the database

With Python 3.10 or newer (standard library only), from the project root:

```sh
python build_database.py      # data/progressions.sqlite from data/sources.json (about 2 min)
python find_progressions.py   # data/common_progressions.json
python build_exercises.py     # studio/public/exercises/name-progression.json
python build_mobile_catalog.py # studio/public/catalog/, the catalog bundled in the apps
```

The modules are: `build_database.py` (runs the
sources), `import_choco.py` (reads the ChoCo release), `ireal_playlist.py`
(reads irealb:// charts and curates the forum charts), `track_store.py` (writes tracks and
settles key modes) and `chord_notation.py` (all chord notation, see
[chord notation](CHORD_NOTATION.md)).

## Curation

**Left out.** Only score annotations with a key are kept: ChoCo's audio-based
annotations (2,144 entries) and songs without a key (38) are left out, as are
the three collections ChoCo licenses for non-commercial use only (193 entries,
see [Rights](#rights)). When a song has several annotators, one primary
annotation is kept.

**Duplicates.** A track with the same bars and chords as one already in the
catalog is not imported, whatever its corpus or title (515 ChoCo tracks and
56,931 iReal Pro charts).

**Duplicate and very similar songs.** Once every source is read,
`song_dedupe.py` compares the versions of each song, by sound: a chord is its
root pitch, its intervals without the 7th and its bass, so a change of key and
added or removed sevenths do not count. Two tracks are the same song when
their titles are related (the same `song_key`, or one title is the other with
words added before or after it, the shorter title having at least 5 letters:
"Misty - Erroll Garner", "When Lights Are Low 1", "P19 We Will Rock You"),
and their chords are

- the same at the same positions (duplicates, 435 removed), or
- at most 2 edits apart (chords inserted, removed or replaced, repeated chords
  merged), with at most 2 bars difference in length (very similar, 1,686
  removed).

The version with the shortest title stays, then the preferred source. The
title condition keeps different songs on the same changes: blues heads,
rhythm-changes tunes and four-chord pop songs would otherwise collapse into
one. `logs/similar-songs-<time>.log` lists every removed track with the one it
repeats. Other versions of a song stay and are grouped by title.

**Forum curation.** The forum charts are user-contributed, so the forum source
is curated (`"curate"` in `data/sources.json`). A forum chart is left out
(8,090 in all) when:

| Rule | Charts |
|---|---|
| Its song is already in the catalog from another source (same `song_key`), unless the chart was posted in at least `min_threads` (2) distinct forum threads | 5,696 |
| All the threads it was posted in are practice, exercise or lesson threads (thread name has exercise, practice, drill, lesson, etude, scales, warm-up, licks, test, how to) | 2,135 |
| It has fewer than 4 bars | 119 |
| Its title marks an exercise or placeholder (exercise, practice, New Song, untitled, Blues in F, Rhythm Changes, degree names such as II - V - I) | 107 |
| It has a single chord | 33 |

Thread counts use distinct threads, not copies: half of the merged copies are
repeats inside one thread (quotes, re-posts). Popular forum versions stay
(Fly Me To The Moon was posted in 16 threads, Misty in 12). Titles in the
source's `keep` list are never left out. Each curated chart has a `CURATED`
line with its reason in the import log.

## Adding iReal Pro playlists

Put playlist files (`.txt` or `.html` holding `irealb://` links, as iReal Pro
exports them or forums share them; a folder or `.zip` of them also works) in
`data/ireal-playlists/` and run the three rebuild commands. The charts become
the corpus "iReal Pro playlists", searchable in the Accompaniment Player and
used by the exercises. To add another source, add an entry of type `ireal` to
`data/sources.json` (path, collection, corpus, license).

Each iReal source writes `logs/ireal-import-<source>-<time>.log`: one line per
song, `OK` (track id, key, meter, bars), `DUPLICATE` (and the chart it repeats),
`CURATED` or `ERROR` with the reason, then `WARNING` lines (meter changes, ignored ending
signs) and a summary. Charts that cannot be read exactly are not imported:
an unreadable chord, repeat or coda signs that cannot be laid out, a repeat
that would grow the chart without end (2,099 charts, all but three from the
forum).

**Chart layout.** `ireal_playlist.py` follows ChoCo's iReal conversion
(ChoCoTune, based on pyRealParser): repeats, numbered endings, codas and repeat
signs are written out, and one meter is used per chart. Unlike ChoCo, which
shares each bar evenly (1 1/3 beats for three chords in 4/4), a chord lasts as
long as the cells it fills, as iReal Pro plays it ([chord lengths in iReal bars](CHORD_NOTATION.md#chord-lengths-in-ireal-bars)). Checked against ChoCo's own layout, 2,007 of 2,028 playlist
charts have the same bars and chords in the same order; the rest differ where ChoCo is wrong.
It reads the charts from their links rather than from ChoCo's converted files,
whose chords are damaged in several ways: ChoCo removes the first letter of
custom chord text (`F*maj7*` -> `Faj7`, `A*m*` -> `A`), the `l` of `alt`
(`7at`) and comments only after splitting bars; pyRealParser reads 12/8 as 1/2;
its music21 conversion adds notes (`7#11` -> `9(#11)`), copies slash basses into
the chord, reads `7b9#9` as a major seventh, and ChoCo v1.0.0 read `Dh7` as
`Db:7`.

## Corrections to ChoCo

Every collection was checked against ChoCo's latest repository (no collection other than iReal Pro changed since v1.0.0) and against its source notation, converted independently (music21 for Wikifonia, Nottingham, When in Rome and the Rock Corpus). The chord symbols of Wikifonia, Real Book, BiaB, When in Rome and the Rock Corpus are converted correctly. Everything below is corrected at import, by code (`import_choco.py`, `ireal_playlist.py`) or a correction file, never by editing data by hand.

### Chord symbols, keys, beats and lengths

- **Nottingham slash chords.** The tunes write the bass in ABC style, `+` meaning sharp: `D/f+` is D/F#. ChoCo dropped the sharp (D/F). `python build_nottingham_fix.py <ChoCo repository> choco-v1.0.0.zip` rebuilds `choco-nottingham-bass-5fe168f.zip` from the source chords at ChoCo commit `5fe168f`; it corrects 445 chords in 82 tunes and leaves already correct ones (`Gm/b-`) alone.
- **Jazz Corpus keys** are written `C:majoror`; the import spells them `C:major`.
- **Beats and lengths of the music21 collections.** Wikifonia, Nottingham, Schubert Winterreise and When in Rome count beats as music21 does: in compound meters (6/8, 9/8, 12/8, 6/4, 3/8) a beat is a group of three units, so a 12/8 bar has 4 beats, not 12; When in Rome also gives lengths in quarter notes, in every meter. The other collections count in the meter's unit. The import reads each collection its own way (`import_choco.COUNTING`), each When in Rome song with the 3/8 reading under which its chords follow each other (music21 counts a 3/8 bar as one beat or three eighths depending on the score; `song_counting`), and lengths bar by bar across meter changes; read as eighths, the 6/8 and 12/8 songs had chords at half length with false "N.C." gaps, and When in Rome's 2/2 chords twice too long. Measured on consecutive chords, the next chord now starts where the previous one ends in 99 to 100 % of cases in every collection except three, where ChoCo's own conversion is wrong:

  - **Jazz Corpus** (74 songs, every chord): ChoCo's parser (`choco/parsers/harm_parser.py`, `process_multiline_annotation`) places each chord at the running sum of the lengths *including* its own, counted from bar 0, so every chord is written where it ends, minus one bar. The lengths are right.
  - **BiaB in 3/4** (81 songs): ChoCo's parser (`choco/parsers/biab_parser.py`) moves to the next beat with the meter's denominator instead of the bar length, which is only right when they are equal (4/4); in 3/4 chords drift by a beat. In 4/4 the same line writes a chord on beat 4 as beat 0 of the next bar, which the import reads correctly. The lengths are right.
  - **Real Book time signatures** (12 songs read in 3/4 that are in 4/4, and 3/4 songs read in 4/4): ChoCo (`parse_rbook` in `choco/parsers/instances.py`) takes each song's meter from a metadata table by an ID it generates anew, so a song gets another song's meter; 127 of 2,839 songs differ from their own row (Belle Of The Ball, a waltz, is in 4/4). Chords and keys come from the song's own file and are right.

  The rest (Wikifonia 179 songs, Nottingham 12, When in Rome 12) are single scores with grace chords, chords at the same position or overlaps.

  The import corrects all three (`import_choco.release_tracks`): the Jazz Corpus (76 songs) and BiaB songs whose meter's numerator and denominator differ (95 songs) have their chords laid end to end again from their lengths (`POSITIONS_FROM_LENGTHS`, `laid_end_to_end`); Real Book songs are read in 4/4, except the twelve waltzes of ChoCo's own meter table (`REAL_BOOK_WALTZES`), rescaled to three beats a bar (142 meters corrected).

### Other problems

- **Jazz Corpus chords are in C.** The corpus writes every song transposed to C, with the song's real key beside it; ChoCo kept both, so the chords did not match their key. They are transposed to the key (`chord_notation.transpose_from_c`).
- **Untitled entries.** The Jazz Corpus has no titles (they are named `Jazz Corpus sequence N`; other untitled entries `Untitled (id)`, `song_title`). Search no longer folds non-Latin titles (Greek, Cyrillic, Japanese) to an empty text that made them look like duplicates of each other (`score_search._fold`, `library/catalog.ts foldText`).
- **Grace chords.** A chord of no length followed by another at the same place never sounds; 2,504 such chords (mostly Wikifonia) are dropped, and an entry left with no chord is left out.
- **Over-expanded Nottingham tunes.** ChoCo writes out the tunes' repeats and, for six of them, went on to 1,000-2,000 bars; tunes over 500 bars are left out (`MAX_BARS`).

### iReal Pro charts

iReal Pro charts are read as iReal Pro plays them ([chord notation](CHORD_NOTATION.md#chord-lengths-in-ireal-bars)): a slash cell (`p`) inside a bar continues the chord before it, at the start of a bar it repeats the previous chord; a chart whose unpaired repeat signs would expand it more than four times (thousands of bars) fails to import with a message instead (273 forum charts, `ireal_playlist.MAX_GROWTH`). About 800 forum charts are left in the default key C although no tonic chord of C appears: their contributors did not set the key, and no key estimate was reliable enough (74 % agreement on charts with a known key) to replace it.

## Key modes

BiaB and the Rock Corpus give only a tonic (always stored as major); the Real Book and Wikifonia mark many minor tunes as major (56 of 109 and 133 of 147 that iReal Pro marks minor), and Wikifonia keys come from key signatures, so a C-minor tune is labelled Eb major. For these keys `settle_modes` (in `track_store.py`, with the rule in `key_modes.py`) takes the mode from another version of the song with a trusted mode and the same tonic, otherwise from the time spent on the tonic chords: major I, minor I, or for Wikifonia also the relative minor (minor VI), whose key then replaces the annotated one. Thresholds were measured on trusted versions (94-96 % agreement; 99 % on iReal Pro). A key the chords cannot decide keeps only its tonic, e.g. `C`. After the import, 821 of 43,126 key annotations have no mode. Measured on the current catalog (key annotations of each collection, minor share in the ChoCo release and after settling):

| Collection | Keys | Minor before | Minor after | No mode after |
|---|---|---|---|---|
| BiaB | 3,827 | 0 % | 8 % | 205 |
| Rock Corpus | 315 | 0 % | 19 % | 6 |
| Real Book | 2,427 | 6 % | 7 % | 107 |
| Wikifonia | 6,553 | 2 % | 13 % | 503 |
| Jazz Corpus | 76 | 21 % | 21 % | 0 |

The Jazz Corpus modes are trusted once read (ChoCo writes them `C:majoror`).

## The catalog progressions

`data/common_progressions.json` holds the **20 progressions** of the exercises (defined in `common_progressions.py`), ordered by the number of distinct songs they occur in; versions of one song in several corpora count once (see [exercises](EXERCISES.md#levels)). Run `python find_progressions.py` to rebuild the catalog and its ChoCo song matches together. Each entry has a stable ID, its original spelling, the converted chord sequence, and a source URL where one was supplied. The repeated `I–IV–V` was removed; its source link is retained on the first entry. [Native Instruments](https://www.native-instruments.com/blogs/blog/common-chord-progressions) and [Wikipedia's list](https://en.wikipedia.org/wiki/List_of_chord_progressions) are useful references for expanding the catalog later.

The conversion uses uppercase numerals and explicit quality: `ii` → `II:min`, `vi` → `VI:min`, `IV` → `IV:maj`, `VIb` → `VIb:maj`, and `IIb7` → `IIb:7`. The JSON values are **base forms for matching**, so `I:maj` also represents a plain `I`/`I:` major chord and may match major-quality extensions such as a seventh. Minor-quality extensions may likewise match `II:min`. Augmented and diminished qualities are excluded from these major/minor matches. A token with an explicit `7` requires a dominant-seventh quality. The source chord's bass inversion does not change the progression degree.

Run `python find_progressions.py` to attach a `songs` list and `song_count` to every progression in the JSON catalog. The importable function is `attach_songs(database_path, catalog)`. Each song result includes its score entry ID, title, artist, composers, source corpus, the key and bar of its first match, and a count of matching passages. Duplicate score entries for a song remain separate because their analyses may differ. Each song also carries a `song_key`, and `unique_song_count` counts distinct songs, which sets the catalog order.

The search reads the `chord` events of each song as Roman numerals (`roman_rows`) for chord matching. `key` events split a score into independent parts; a match cannot cross a key boundary. Consecutive chord events with the same degree and major/minor family form a run, so repeated annotations or changes of color do not block a progression. An explicitly repeated step in a pattern, such as `IV IV`, requires at least two chord events in that run. Beat lengths are ignored. A plain major/minor step allows extensions, while altered fifths, augmented, diminished, suspended, and ambiguous chords do not match. A written `:7` requires a dominant-seventh quality, including extended dominant forms such as `:9`.

Each matched song has a `passages` list. Every passage records its key part, first and exclusive last chord ordinals, the bar and beat where it starts, and start/end positions in quarter notes. The end is clipped at the next key change. Use the ordinals to fetch the exact source chords and the quarter positions to locate the playback interval. The catalog contains 143,324 passages across its 20 progressions.

The minor-key patterns use explicit flattened degrees in our major-scale-relative spelling: `i–VIIb–VIb–V` and `i–VIIb–VIb–VIIb` convert to `I:min VIIb:maj VIb:maj V:maj` and `I:min VIIb:maj VIb:maj VIIb:maj`.

## Piano patterns

`data/left_hand_patterns.json` contains the 16 piano patterns offered in the
app, with their styles and step definitions. Rebuild it with
`python left_hand_patterns.py`; see the [pattern audit](../PATTERN_AUDIT.md) for
sources and menus. The app's engine (`studio/src/engine`) turns charts and
patterns into MIDI and plays them with SpessaSynth and the GeneralUser GS sound
bank.

## Rights

ChoCo licenses its data under CC BY 4.0, except the collections derived from
the Chordify Annotator Subjectivity Dataset (`casd`), Jazz Audio-Aligned
Harmony (`jaah`) and the Mozart Piano Sonatas (`mozart-piano-sonatas`), which
are CC BY-NC-SA 4.0 ([ChoCo's license](../data/CHOCO_LICENSE.md)). Those three
are not imported, so the whole catalog is CC BY 4.0 ([data license](../data/LICENSE.md)).
ChoCo's iReal Pro data is labelled CC BY 4.0 by ChoCo; the forum charts were
contributed by iReal Pro forum users. The catalog holds chord symbols, titles,
composers and keys only: no melodies, lyrics, audio or sheet music images.

Credit: J. de Berardinis, A. Meroño-Peñuela, A. Poltronieri and V. Presutti,
"ChoCo: a Chord Corpus and a Data Transformation Workflow for Musical Harmony
Knowledge Graphs", *Scientific Data* 10, 641 (2023).
[Dataset](https://github.com/smashub/choco).

Before publishing anything built on this catalog, check the rights for the
particular songs, charts and titles you show; ChoCo's license covers its
annotations, not the songs themselves.
