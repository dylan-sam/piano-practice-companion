# The app (Studio)

The web app of the project, and the base of the Android and iOS apps. It is a
modified version of [OpenStand](https://github.com/canbmaj7/openstand),
revision `9d49d2ae3b49e3960c099754814f987e2192955b`, integrated on 2026-11-03.
OpenStand's copyright notices and its [AGPL-3.0-or-later license](LICENSE) are
kept.

**Changed from OpenStand:** song search in the ChoCo catalog and chart
conversion, the project's six styles and their piano patterns, the two
exercises, the Display menu, Android and iOS apps, a link to the source code,
and the removal of OpenStand's example songs, telemetry and submission action.

- [Screens](#screens)
- [Styles and piano patterns](#styles-and-piano-patterns)
- [Charts on screen](#charts-on-screen)
- [The Display menu](#the-display-menu)
- [Tunes and playlists](#tunes-and-playlists)
- [Building and running](#building-and-running)
- [Code map](#code-map)
- [Licenses](#licenses)

## Screens

| Screen | Address | Code |
|---|---|---|
| Menu | `/` | `src/Home.tsx` |
| Accompaniment Player (Studio) | `/studio` | `src/App.tsx` |
| Name the progression | `/exercises/name-progression` | `src/exercises/NameProgression.tsx`, questions in `public/exercises/name-progression.json` |
| Chord Sightreading | `/exercises/chord-sightreading` | `src/exercises/ChordSightreading.tsx` |

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
- With a Style lab style, the "chord comping" entry plays the comping rhythm
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
| upright phones | 2 bars per row instead of 4 | `src/ui/useNarrowScreen.ts`, [mobile](../docs/MOBILE.md) |
| playing a chart taller than the screen (player and sightreader) | once the highlight reaches the middle of the visible area, the sheet scrolls so it stays there: the reading point moves down the row as the highlight runs along it, so the speed follows the tempo and the beats in a row. Scrolling by hand (wheel, swipe, arrow keys) pauses it for 3 seconds | `src/ui/useAutoScroll.ts` |

Charts from the catalog arrive in iReal Pro chord notation, written by
`chord_notation.py` ([chord notation](../docs/CHORD_NOTATION.md)).

## The Display menu

In the Accompaniment Player and Chord Sightreading (`src/ui/DisplayMenu.tsx`,
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
| Export | Studio's top bar | downloads one playlist, or all, as a JSON file of editable charts (catalog songs opened for preview are not included) |
| Share → Copy Studio link | Studio's top bar | a link that opens the chart in this app; nothing is uploaded |
| Share → Copy iReal Pro link | Studio's top bar | an `irealb://` link that opens in iReal Pro |

Export a file before clearing the browser's storage, or the tunes are lost.

The **Mixer** (part volumes, mutes, master volume, kept in the browser) is
shared by the player and the exercises (`src/audio/useMixer.ts`).

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

See [docs/MOBILE.md](../docs/MOBILE.md) for the phone apps.

The build writes `dist/source.zip`, linked from the app's header and menu: the
editable source code and the licenses, as the AGPL asks. The database is not
in it; it is rebuilt with the project's scripts ([the data](../docs/DATA.md)).

## Code map

| Folder | Holds |
|---|---|
| `src/engine/` | arranges a chart into MIDI: bass (`bass.ts`), piano (`comp.ts`, `pianoPatterns.ts`), drums (`drums.ts`), timeline and count-in (`timeline.ts`) |
| `src/styles/` | the six styles, compound meters (`compound.ts`) and the Style lab (`lab.ts`) |
| `src/audio/` | the synthesizer (SpessaSynth, `player.ts`), playback (`usePlayer.ts`), mixer, MIDI input (`useMidiKeyboard`, `nativeMidi.ts`) |
| `src/music/` | chords (`chords.ts`), charts and tuplets (`chart.ts`), Roman numerals (`roman.ts`), practice settings (`practice.ts`), chart editing (`edit.ts`) |
| `src/formats/` | iReal Pro import (`ireal.ts`) and export (`irealWrite.ts`), share links (`share.ts`) |
| `src/library/` | the catalog (`catalog.ts`), saved tunes (`db.ts`), saved styles, browser storage |
| `src/ui/` | screens and controls: chart, transport, mixer, menus, editor, Style lab |
| `src/exercises/` | Name the progression and Chord Sightreading |
| `tests/` | the app's tests |
| `android/`, `ios/` | the native projects |

## Licenses

- The app: [AGPL-3.0-or-later](LICENSE), as OpenStand.
- The GeneralUser GS sound bank: its own terms, in
  `public/soundfonts/GeneralUser-GS-LICENSE.txt`.
- The Petaluma fonts: SIL Open Font License, `src/assets/fonts/Petaluma-OFL.txt`.
- The song catalog in `public/catalog/` and `public/exercises/`: CC BY 4.0
  ([data license](../data/LICENSE.md)).
