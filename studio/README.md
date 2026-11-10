# The app (Studio)

The web app of the project, and the base of the Android and iOS apps. It is a
modified version of [OpenStand](https://github.com/canbmaj7/openstand),
revision `9d49d2ae3b49e3960c099754814f987e2192955b`, integrated on 2026-11-03.
OpenStand's copyright notices and its [AGPL-3.0-or-later license](LICENSE) are
kept.

**Changed from OpenStand:** song search in the ChoCo catalog and chart
conversion, the project's six styles and their piano patterns, the two
exercises, the Display menu, Android and iOS apps, a link to the source code,
and lead sheets (a melody over the chords, drawn with abcjs), and the removal of
OpenStand's example songs, telemetry and submission action.

- [Screens](#screens)
- [Styles and piano patterns](#styles-and-piano-patterns)
- [Charts on screen](#charts-on-screen)
- [Lead sheets](#lead-sheets)
- [The Display menu](#the-display-menu)
- [Tunes and playlists](#tunes-and-playlists)
- [Playback without clicks](#playback-without-clicks)
- [Building and running](#building-and-running)
- [Code map](#code-map)
- [Licenses](#licenses)

## Screens

| Screen | Address | Code |
|---|---|---|
| Main menu, and the menus of its three areas | `/`, `/play-along`, `/ear-training`, `/sightreading` | `src/Home.tsx` (`Menu`, texts in `MENUS`) |
| Chord Player (Studio) | `/play-along/chords` | `src/App.tsx` (`mode="chords"`) |
| Lead Sheet Player | `/play-along/lead-sheets` | `src/App.tsx` (`mode="lead"`) |
| Name the progression | `/ear-training/name-the-progression` | `src/exercises/NameProgression.tsx`, questions in `public/exercises/name-progression.json` |
| Melodic Dictation | `/ear-training/melodic-dictation` | `src/exercises/MelodicDictation.tsx`, excerpts and answers in `src/exercises/melodicDictation.ts`; notes are written on the staff with `src/ui/useStaffInput.ts` (places on the staff in `src/music/staff.ts`) |
| Chord Sightreading | `/sightreading/chords` | `src/exercises/ChordSightreading.tsx` |
| Lead Sheet Sightreading | `/sightreading/lead-sheets` | `src/exercises/MelodySightreading.tsx` (`kind="lead-sheets"`), note judging in `src/exercises/melodyReading.ts` |
| Exercises Sightreading | `/sightreading/exercises` | `src/exercises/MelodySightreading.tsx` (`kind="exercises"`) |
| Lick Sightreading | `/sightreading/licks` | `src/exercises/LickSightreading.tsx`, the lick over the chords in `src/exercises/lickReading.ts`; the melody screens share `useMelodyJudging.ts` and `ReadingControls.tsx` (the Scoring button of the bottom bar) |

The back button and a screen's title go up one level (`parentRoute` in
`src/router.ts`): a screen to its area's menu, an area's menu to the main menu.
Import works the same on every screen that offers it (`src/library/importTunes.ts`):
charts are saved in the one library of saved tunes, so a chart imported in a
sightreader is in the matching player too, and the other way round.

Routes live in `src/router.ts` and `src/Root.tsx`. The exercises are described
in [docs/EXERCISES.md](../docs/EXERCISES.md).

## Styles and piano patterns

Each style has its drums, its bass and a menu of piano patterns. Choosing a
pattern replaces the style's own piano comping.

| Style | Default piano | Other piano patterns |
|---|---|---|
| Swing | Swing chord comping | stride bass, walking bass |
| Blues | simple boogie | boogie walking bass, left-hand shuffle, New Orleans bass, boogie walking with chord shells |
| Bossa Nova | Bossa chord comp 1 | blocked chords, bossa bass, Bossa chord comp 2 |
| Latin | Latin montuno (2-3 clave) | Latin chord comping, tango bass, bossa bass |
| Straight Pop/Rock | pop and rock bass | Straight Pop/Rock chord comping, broken chords |
| Ballad | ascending arpeggio | Ballad chord comping, broken chords, rolled chords |

- The defaults are the same in the player and in Name the progression
  (`defaultPatternForStyle` in `src/engine/pianoPatterns.ts`).
- Blues has no "chord comping" entry; its patterns are all left-hand figures.
- **Walking bass** patterns replace the style's bass line; their chord shells,
  when they have some, play on the piano. Swing chord comping uses the scored
  walking bass.
- Blues and Straight Pop/Rock piano patterns leave out the style's separate
  bass line; the blues walking patterns bring their own bass notes.
- With a Pattern Creator style, the "chord comping" entry plays the comping rhythm
  drawn in the lab.

The patterns, their sources and how they follow the chords:
[PATTERN_AUDIT.md](../PATTERN_AUDIT.md). Their data is built by
`left_hand_patterns.py` into `data/left_hand_patterns.json`.

## Charts on screen

| Situation | How it is drawn | Code |
|---|---|---|
| chords of a bar | share the bar by their beats; a long symbol may take room from a short one | `src/ui/Chart.tsx` |
| chords too wide for their bar | drawn smaller, all by the same factor, down to 45 % (10 % for a bar of more than six chords) | `src/ui/fitChords.ts` |
| chords sharing beats in tuplets (three in four beats, five in a bar) | a bracket with the count over them, as in printed music: up to 7 notes, at most two a beat | `tuplets` in `src/music/chart.ts` |
| a time signature at the start of a line (the first bar, or a change starting a line) | in the margin before the bar line, so the chords keep their room | `src/ui/Chart.tsx` |
| a time signature change inside a line | at the start of its bar | `src/ui/Chart.tsx` |
| a style that swings its eighths (swing above 0.5) | the swing marking (two eighths = a triplet quarter and eighth) under the style at the top left, on chord charts and lead sheets | `SwingMark` in `src/ui/Chart.tsx` |
| upright phones | 2 bars per row instead of 4 | `src/ui/useNarrowScreen.ts`, [mobile](../docs/MOBILE.md) |
| playing a chart taller than the screen (player and sightreader) | once the highlight reaches the middle of the visible area, the sheet scrolls so it stays there: the reading point moves down the row as the highlight runs along it, so the speed follows the tempo and the beats in a row. Scrolling by hand (wheel, swipe, arrow keys) pauses it for 3 seconds | `src/ui/useAutoScroll.ts` |

Charts from the catalog arrive in iReal Pro chord notation, written by
`chord_notation.py` ([chord notation](../docs/CHORD_NOTATION.md)).

## Lead sheets

The two players are one screen (`src/App.tsx`) in two modes, sharing the saved
tunes:

| | Chord Player | Lead Sheet Player |
|---|---|---|
| tunes | the catalog, the shipped lead sheets and every saved tune | the 1,479 shipped lead sheets and saved tunes with a melody (no catalog search, no New; the licks and exercises are in Exercises Sightreading) |
| a lead sheet | drawn as a chord chart, played without its melody | drawn on a staff, played with its melody |
| Mixer | bass, piano, drums | bass, piano, melody, drums |
| Import | iReal Pro and Studio exports | MusicXML and Studio exports |
| last tune opened | remembered | remembered separately |
| no tune to play | (the catalog is always there) | a page explaining how to import lead sheets |

The editor of either player shows the chords only and keeps the melody as it
is. The melody is stored with the chart:

```json
"melody": {
  "notes": [{ "bar": 0, "at": 0.5, "beats": 1.5, "pitch": 70 }],
  "program": 65,
  "source": "Weimar Jazz Database, melid 1"
}
```

| Field | Meaning |
|---|---|
| `bar` | the written bar (index in `bars`), so the note follows repeats, endings, loops and choruses |
| `at` | start in quarter notes from the start of the bar (0.5 is the "and" of beat 1) |
| `beats` | length in quarter notes; it may run past the bar line (the note is drawn tied) |
| `pitch` | MIDI note number in the written key (60 is middle C) |
| `program` | the General MIDI instrument (default 65, alto sax) |

How it is drawn and played:

| What | How | Code |
|---|---|---|
| engraving | the chart is written as ABC notation and drawn by [abcjs](https://github.com/paulrosen/abcjs) (MIT), loaded the first time a lead sheet opens | `src/music/abc.ts`, `src/ui/LeadSheet.tsx` |
| rhythm | each beat is written in sixteenths, or in triplet eighths when a note starts on a third of it; notes are cut and tied at bar lines, chord changes and odd beat crossings (a note crosses a beat only from an eighth to an eighth) | `melodyToAbc` |
| key and spelling | the key signature of the key on the stand; chromatic notes take sharps in sharp keys and flats in flat keys (in C, flats except F#); an accidental lasts for the bar | `spellPitch` |
| chord roots | spelled as on the chord chart: notes of the key's scale follow its signature, other roots take flats in sharp keys and C (Bb7 in C, not A#7) | `chordText`, `spellRoot` |
| clef | bass clef when the middle note of the melody is below A3 | `melodyToAbc` |
| layout | 4 bars a line (2 on upright phones); a rehearsal mark starts a line and is drawn boxed in the margin, as on the chord chart; a pickup bar stays on the first line | `melodyToAbc`, `sectionMarks` |
| chords | above the staff, in the Display menu's notation (C−7 or Cm7, Roman numerals) | `chordText` |
| playing | the bar being played gets the yellow highlighter and the note being played is coloured; the sheet scrolls like a chart (auto-scroller in the Display menu) | `src/ui/LeadSheet.tsx`, `src/ui/useAutoScroll.ts` |
| loops | Practice > Choose bars: click a bar (or its chords) on the staff | `src/ui/LeadSheet.tsx` |
| sound | channel 3, panned slightly right, with the style's swing (eighth-note "ands" move later; a beat written in sixteenths stays straight, so its sixteenths stay even); its own strip in the Mixer. The band's grooves follow the same rule (a Pattern Creator groove with sixteenths) | `src/engine/melody.ts` (`straightBeats`), `src/engine/events.ts` (`swingPlacer`), `src/engine/arrange.ts` |

Charts with a melody are imported as MusicXML (**Import > MusicXML**,
`src/formats/musicxml.ts`) or as a Studio export. From a MusicXML file:

| MusicXML | Chart |
|---|---|
| first part, first voice (the top note of a chord); ties joined, grace notes left out | the melody |
| `<harmony>` (root, kind, alterations, bass), or a short text above the staff that reads as a chord | chord symbols: `dominant` + flat 9 is `C7b9`, `half-diminished` is `Bh7` |
| `<key>`, `<time>`, `<sound tempo>` | key and mode, meter and its changes, tempo |
| repeats, endings, double and final bar lines, segno, coda, `<rehearsal>`, D.C./D.S. texts | the chart's marks |
| a first bar shorter than its meter (a pickup) | a whole bar with its notes at the end |

Compressed `.mxl` files are unpacked in the browser. ABC tunes are read by
`src/formats/abcImport.ts` (with abcjs's parser), so far for the shipped
Nottingham tunes only. A bar shorter than its meter (a pickup) is a `partial`
bar: `time` is its length and the meter goes on unchanged (`barMeters` in
`src/music/chart.ts`). The shipped lead sheets and how they were checked:
[docs/DATA.md](../docs/DATA.md#lead-sheets-shipped-with-the-app). To test with real solos, `weimar_playlist.py` turns the Weimar Jazz
Database into a Studio export in `weimar/` (not shipped, not in git) to import ([the data](../docs/DATA.md#testing-lead-sheets-with-the-weimar-jazz-database)).

## The Display menu

In the two players and Chord Sightreading (`src/ui/DisplayMenu.tsx`,
settings in `src/ui/display.ts`, kept in the browser):

| Setting | Example |
|---|---|
| **Roman numerals** On / Off | in C: `Dm7 G7 Cmaj7` is drawn `II-7 V7 I^7`; `Db7` is `bII7` |
| **Minor written** C− or Cm | `C-7` or `Cm7` |
| **Repeat sign** | a bar repeating the bar before (same chords, same lengths) is drawn `%` |
| **Sheet auto-scroller** On / Off (On by default) | while playing, a sheet taller than the screen scrolls to keep the highlighted bar near the middle |

Roman numerals follow the key changes of catalog charts from the beat where
they happen; the band still plays in the chosen key. Name the progression has
the minor and repeat options in its own Display menu, without Roman numerals
(they would give the answer away) or the auto-scroller (its line always fits),
plus *Hide the key* and *Hide all chords*.

## Tunes and playlists

**Search order.** The tune list shows saved tunes first: the selected
playlist, then the other saved playlists, then the catalog's results.

**Your tunes** are kept in the browser's IndexedDB:

| Action | Where | What it does |
|---|---|---|
| New, Edit | Studio | write or change a chart, saved as a tune |
| Import → iReal Pro | Studio's tune list | adds iReal Pro links or playlist files as a playlist |
| Import → Studio export | Studio's tune list | restores a file made by Export, with its playlist names |
| Export | Studio's top bar | downloads, as a JSON file of editable charts: the songs written or edited in the app (My tunes; an edited shared or imported song stays in its own group), the songs shared with you via link, the imported playlists, or all 3 (catalog songs opened for preview and the shipped songs are not included) |
| Share → Copy Studio link | Studio's top bar | a link that opens the chart in this app; nothing is uploaded |
| Share → Copy iReal Pro link | Studio's top bar | an `irealb://` link that opens in iReal Pro |

Export a file before clearing the browser's storage, or the tunes are lost.

The **Mixer** (part volumes, mutes, master volume, kept in the browser) is
shared by the player and the exercises (`src/audio/useMixer.ts`).

## Playback without clicks

Loading a song makes SpessaSynth reset its synthesizer, which cuts the notes
still ringing and the reverb. `src/audio/player.ts` therefore keeps a second
synthesizer (made in the background after the warm-up):

- a change while the band plays (style, pattern, choruses, guide melody, the
  band on or off...) loads the new arrangement on the second synthesizer, which
  takes over at the band's position while the first lets its notes fade
  (`play(midi, fromSeconds)`);
- an endless exercise loads its next chunk there ahead of time (`queue`) and
  starts it on the bar line (`startQueued`).

Only a real start (a new song, key or loop, or Play) loads on the playing
synthesizer, from the beginning.

## Building and running

From this folder:

```sh
pnpm install
pnpm run build     # type check, build into dist/, and write dist/source.zip
pnpm test          # tests (vitest)
pnpm run lint      # code checks (oxlint)
pnpm run dev       # live-reload server while working on the app
```

Then start `python server.py` from the project root and open
<http://127.0.0.1:8765/>. The server serves `dist/` and the song search.

| Command | Does |
|---|---|
| `pnpm run native` | phone catalog, build, copy into the Android and iOS projects |
| `pnpm run sync` | build and copy, with the phone catalog already present |
| `pnpm run android`, `pnpm run ios` | open the native project in Android Studio or Xcode |
| `pnpm run catalog` | rebuild the phone catalog only (`build_mobile_catalog.py`) |
| `pnpm run leadsheets` | rebuild the shipped lead sheets (`public/leadsheets/catalog.json`) |
| `pnpm run licks` | rebuild the licks and exercises (`public/licks/`, [docs/LICKS.md](../docs/LICKS.md)) |

See [docs/MOBILE.md](../docs/MOBILE.md) for the phone apps.

The build writes `dist/source.zip`, linked from the app's header and menu: the
editable source code and the licenses, as the AGPL asks. The database is not
in it; it is rebuilt with the project's scripts ([the data](../docs/DATA.md)).

## Code map

| Folder | Holds |
|---|---|
| `src/engine/` | arranges a chart into MIDI: bass (`bass.ts`), piano (`comp.ts`, `pianoPatterns.ts`), drums (`drums.ts`), melody (`melody.ts`: `melodyOccurrences` lists every note as the band plays it, which the melody sightreaders also judge), timeline and count-in (`timeline.ts`) |
| `src/styles/` | the six styles, compound meters (`compound.ts`) and the Pattern Creator (`lab.ts`) |
| `src/audio/` | the synthesizer (SpessaSynth, `player.ts`), playback (`usePlayer.ts`), mixer, MIDI input (`useMidiKeyboard`, `nativeMidi.ts`) |
| `src/music/` | chords (`chords.ts`), charts and tuplets (`chart.ts`), melodies (`melody.ts`) and their ABC notation (`abc.ts`), places on the staff (`staff.ts`), the `lick` record of licks and exercises and their rhythm rule (`licks.ts`), Roman numerals (`roman.ts`), practice settings (`practice.ts`), chart editing (`edit.ts`) |
| `src/formats/` | iReal Pro import (`ireal.ts`) and export (`irealWrite.ts`), share links (`share.ts`) |
| `src/library/` | the catalog (`catalog.ts`), saved tunes (`db.ts`), saved styles, browser storage |
| `src/ui/` | screens and controls: chart, lead sheet (`LeadSheet.tsx`, measured by `engraving.ts`, notes written on it by `useStaffInput.ts`), transport, mixer, menus, editor, Pattern Creator |
| `src/exercises/` | Name the progression, Melodic Dictation (`MelodicDictation.tsx`, `melodicDictation.ts`), Chord Sightreading, Lead Sheet and Exercises Sightreading (`MelodySightreading.tsx`, `melodyReading.ts`), Lick Sightreading (`LickSightreading.tsx`, `lickReading.ts`), and what the melody screens share (`useMelodyJudging.ts`, `ReadingControls.tsx`) |
| `scripts/` | builds the shipped lead sheets (`leadSheetCatalog.ts`, `pnpm run leadsheets`) and the licks and exercises (`lickCatalog.ts`, `lickExercises.ts`, `lickMining.ts`, `lickCharts.ts`, `pnpm run licks`) |
| `tests/` | the app's tests |
| `android/`, `ios/` | the native projects |

## Licenses

- The app: [AGPL-3.0-or-later](LICENSE), as OpenStand.
- [abcjs](https://github.com/paulrosen/abcjs), which draws lead sheets: MIT,
  Paul Rosen and Gregory Dyke.
- The GeneralUser GS sound bank: its own terms, in
  `public/soundfonts/GeneralUser-GS-LICENSE.txt`.
- The Petaluma fonts: SIL Open Font License, `src/assets/fonts/Petaluma-OFL.txt`.
- The song catalog in `public/catalog/` and `public/exercises/`: CC BY 4.0
  ([data license](../data/LICENSE.md)).
- The licks and exercises: `public/licks/licks.json` CC BY 4.0 ([docs/LICKS.md](../docs/LICKS.md)).
