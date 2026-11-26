# The app (Studio)

The web app of the project, and the base of the Android and iOS apps. It is a
modified version of [OpenStand](https://github.com/canbmaj7/openstand),
revision `9d49d2ae3b49e3960c099754814f987e2192955b`, integrated on 2026-11-03.
OpenStand's copyright notices and its [AGPL-3.0-or-later license](LICENSE) are
kept.

**Changed from OpenStand:** song search in the ChoCo catalog and chart
conversion, the project's seven styles and their piano patterns, the two
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
| Main menu (the home screen), and the menus of its areas | `/`, `/play-along`, `/ear-training`, `/sightreading`, `/improvisation` | `src/Home.tsx` (`Menu`, texts in `MENUS`): today's lesson (`src/lessons/TodayLesson.tsx`, loaded after the screen is drawn), the statistics (`src/PracticeStats.tsx`, worked out in `src/library/practiceStats.ts` from the practice log `src/library/practiceLog.ts`: time and answers per day by area, a screen opened from a lesson step counting under Lessons, Free Improvisation counting each chorus's notes inside the harmony; the chords missed in Chord Sightreading and the answers of Name the progression), the tiles (icons in `src/ui/Icon.tsx`), Appearance (`src/ui/Appearance.tsx`) |
| Chord Player (Studio) | `/play-along/chords` | `src/App.tsx` (`mode="chords"`) |
| Lead Sheet Player | `/play-along/lead-sheets` | `src/App.tsx` (`mode="lead"`) |
| Name the progression | `/ear-training/name-the-progression` | `src/exercises/NameProgression.tsx`, questions in `public/exercises/name-progression.json` |
| Melodic Dictation | `/ear-training/melodic-dictation` | `src/exercises/MelodicDictation.tsx`, excerpts and answers in `src/exercises/melodicDictation.ts`; notes are written on the staff with `src/ui/useStaffInput.ts` (places on the staff in `src/music/staff.ts`) |
| Chord Sightreading | `/sightreading/chords` | `src/exercises/ChordSightreading.tsx`, voicing drills in `matchesVoicing` (`src/exercises/sightReading.ts`) |
| Lead Sheet Sightreading | `/sightreading/lead-sheets` | `src/exercises/MelodySightreading.tsx` (`kind="lead-sheets"`), note judging in `src/exercises/melodyReading.ts` |
| Exercises Sightreading | `/sightreading/exercises` | `src/exercises/MelodySightreading.tsx` (`kind="exercises"`); the exercise builder in `src/exercises/builder/` (`exerciseBuilder.ts` settings, titles and charts, `exerciseMusic.ts` chord tones and lines, `lickCharts.ts` charts from notes, `ExerciseBuilder.tsx` its panel, `exercisePresets.ts` the examples and the person's presets, `eartraining:exercise-presets`) |
| Lick Sightreading | `/sightreading/licks` | `src/exercises/LickSightreading.tsx`, the lick over the chords in `src/exercises/lickReading.ts`; the melody screens share `useMelodyJudging.ts` and `ReadingControls.tsx` (the Scoring button of the bottom bar); the left-hand stages are `ChordJudge` options (`src/exercises/sightReading.ts`), text helpers in `readingText.ts` |
| Free Improvisation | `/improvisation/free` | `src/exercises/FreeImprovisation.tsx`, the keys written out in `src/exercises/improvisation.ts`, coloured by `toneColors.ts` |
| Lessons, a step's page | `/lessons`, `/lessons/step?id=` | `src/lessons/`: the program (`program.ts`), a step's page (`LessonStepPage.tsx`, its theory cards in `theory.ts` drawn by `TheoryPictures.tsx` in the key chosen or as Roman numerals with `theoryMusic.ts`, heard with `listen.ts`, the engraver shared in `src/ui/abcjsLoad.ts`; chord symbols in the texts written for reading by `src/music/chordText.ts`), the links that set screens up (`lessonLink.ts`, `useLessonSong.ts`, `useLessonOverride.ts`), the intros and endings added to a song for a step (`introEndings.ts`), targets that tick a step (`useLessonGoal.ts`), progress (`useLessonProgress.ts`), the songs' scale maps (`scaleMaps.ts`, shown by `ScaleMap.tsx`), the screen (`Lessons.tsx`) |

**Themes** (`src/ui/theme.ts`): `index.css` holds Dark mode (the root's
variables, the default) and Light mode (`:root[data-mode='light']`); a custom
theme sets its colours inline on the root, the other shades worked out from
them (`customVariables`: the secondary text, lines and controls mixed from the
text and the sheet; the text on the accent black or white by its luminance).
The theme is applied before the first drawing (`main.tsx`). New styles use the
theme's `--accent`, `--accent-2`, `--on-accent`, `--display` (titles) and
`--card-radius`.

**Practice log** (`src/library/practiceLog.ts`): seconds and answers judged by
day and area (play along, sightreading, ear training, improvisation).
`usePracticeClock` (in `Root.tsx`) counts PRACTICE_TICK seconds at a time while
a practice screen is in view and in use: clicks and keys are seen there, MIDI
notes (`useMidiKeyboard`) and the band playing (`usePlayer`) call
`markActivity`. Answers are counted by `countAnswer` (Name the progression,
Melodic Dictation) or through the effects (`judged`), and written every tick.

**Effects while playing** (`src/ui/effects.ts`, drawn by `src/ui/Effects.tsx`
in `Root.tsx`): the judging screens (Chord Sightreading, `useMelodyJudging` for
the melody screens) call `judged(area, judgement)` for each chord or note:
right ones "perfect" within PERFECT_WITHIN of a beat (`judgementOf`), wrong or
missed ones "miss" when they are settled. `useChorusEffects(chorus, playing)`
ends a chorus (a burst when `earnsBurst`: 90% right of 6 answers or more);
`celebrate()` bursts for a lesson unit finished. The setting is
`eartraining:effects` (`data-effects` on the root).

The back button and a screen's title go up one level (`parentRoute` in
`src/router.ts`): a screen to its area's menu, an area's menu to the main menu.
Import works the same on every screen that offers it (`src/library/importTunes.ts`,
`src/ui/ImportDialog.tsx`): an import is read first (iReal Pro links, a MusicXML
lead sheet, Studio links pasted from Share, or a Studio export), then saved into
the playlists chosen for its lists (`src/ui/PlaylistTarget.tsx`,
`src/library/playlistChoice.ts`). Charts are saved in the one library of saved
tunes, so a chart imported in a sightreader is in the matching player too.

**Playlists** (`src/library/playlists.ts`, IndexedDB table `playlists` of
`src/library/db.ts`, version 2, which turned the old playlist names of the
saved songs into playlists): the default App Playlist is every
shipped lead sheet (not the licks and exercises) and the ChoCo catalog; the
person's playlists are lists of song ids, a song in several, a ChoCo chart
kept on the device once added. A saved song left in no playlist goes to
"Without playlist". Deleting a saved song erases it; deleting a shipped or ChoCo
song, or the whole default playlist, only hides it (`eartraining:hidden-songs`),
so the lessons and exercises keep their songs; Restore all default songs (`src/ui/RecoverAppSongs.tsx`,
main menu) brings them back, with the example exercises deleted (hidden as `exercise:<id>`). The song list (`src/ui/Library.tsx`; the number listed in its search box)
shows one playlist (the chooser only when there is more than one; the playlist
shown is shared by every screen: `useShownPlaylist`), the Playlists panel
(`src/ui/PlaylistPanel.tsx`: make, show and delete playlists; a song's playlists are ticked in Edit Song's Manage playlists, `src/ui/ManagePlaylists.tsx`) and, for the licks and exercises, their categories.
Export (`src/ui/ExportPlaylists.tsx`) writes the playlists ticked, each under the
name typed, with `serializeStudioPlaylists`; a new song is saved into a playlist
chosen in `src/ui/SaveToPlaylist.tsx`.

Routes live in `src/router.ts` and `src/Root.tsx`. The exercises are described
in [docs/EXERCISES.md](../docs/EXERCISES.md).

## Styles and piano patterns

Each style has its drums, its bass and a menu of piano patterns. Choosing a
pattern replaces the style's own piano comping.

| Style | Default piano | Other piano patterns |
|---|---|---|
| Swing | Swing chord comping | walking bass, stride bass, light stride, ragtime bass, root and open 5th, Type A shells, Charleston: chords, shells, Type A shells, rootless voicings; fourth chords from the 9th |
| Blues | simple boogie | boogie walking bass, boogie walking with chord shells, left-hand shuffle, New Orleans bass, ragtime bass, Type A shells, Charleston: rootless voicings |
| Bossa Nova | Bossa chord comp 1 | bossa bass, Bossa chord comp 2, blocked chords, rootless voicings held, fourth chords from the 9th |
| Latin | Latin montuno (2-3 clave) | Latin chord comping, tango bass, bossa bass |
| Straight Pop/Rock | pop and rock bass | Straight Pop/Rock chord comping, root and open 5th, broken chords |
| Ballad | ascending arpeggio | Ballad chord comping, root and open 5th, broken chords, broken chord with tenths, rolled chords, Type A shells, rootless voicings held, quartal pad, fourth chords from the 9th |

- Every menu lists its patterns in one order (`MENU_ORDER` in
  `left_hand_patterns.py`): bass lines, then broken and held chords, shells, the
  Charleston rhythm's patterns together, and the jazz voicings last.

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
| **Sheet size** A− / A+ (70% to 175%, 100% by default) | the title and the bars of a chord chart are zoomed (CSS `zoom` on `.sheet > .rows` and `.sheet-head`, the paper keeps its margins; chords still shrink to fit their bar); a lead sheet is engraved with a narrower or wider layout width, so its music is drawn larger or smaller |
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
| New, Edit | Studio | write or change a chart; a new song is saved into a playlist chosen then (Edit > Delete song deletes a song for good) |
| New, Playlists, Import | Studio's tune list (above the Progressions filter and the search box) | Playlists makes, shows and deletes playlists; songs are put in playlists with Edit Song > Manage playlists |
| Edit Song → Manage playlists, Save, Save new song, Delete song | the editor | the song's playlists (no edits yet); the edits saved in place (one's own song) or as a new song into a playlist chosen, then edited on; the song deleted for good (an app song only hidden) |
| Restore all default songs | main menu, beside Delete all my data | the App Playlist's songs deleted (hidden), the App Playlist itself, and the example exercises deleted, come back |
| Import → iReal Pro (MusicXML on the lead sheet screens) | Studio's tune list | reads iReal Pro links or playlist files, then saves them into the playlists chosen |
| Import → Studio shared link | Studio's tune list | reads one or more links copied with Share, then saves them into a playlist |
| Import → Studio export | Studio's tune list | reads a file made by Export; its playlist names are suggested for new playlists |
| Export → MIDI file, WAV audio, MP3 audio | Studio's top bar | the band's track as it plays now (see below) |
| Export → Playlists to export | Studio's top bar | downloads the playlists ticked, each under the name typed, as a JSON file of editable charts (not the App Playlist) |
| Share → Copy Studio link | Studio's top bar | a link that opens the chart in this app; nothing is uploaded |
| Share → Copy iReal Pro link | Studio's top bar | an `irealb://` link that opens in iReal Pro |

Export a file before clearing the browser's storage, or the tunes are lost.

The **Mixer** (part volumes, mutes, master volume, kept in the browser) is
shared by the player and the exercises (`src/audio/useMixer.ts`). Its parts:

| Part | Channel | Notes |
|---|---|---|
| Bass, Piano (or Guitar), Melody, Drums | 0, 1, 3, 9 | channel 2 is the live MIDI keyboard's piano |
| Click | 4 | the metronome (`src/engine/click.ts`, adapted from OpenStand): a bell (GM note 34) on each downbeat, a click (33) on the other beats, every dotted quarter in 6/8, 9/8 and 12/8; none in the count-in (the drums count) or the ending. Channel 4 is made a percussion part by a Roland GS "use for rhythm part" message (`gsRhythmPart` in `midiWriter.ts`), so the click has its own fader apart from the drums. Always written, muted until turned on; on or off is kept in the browser |

**Sync** (-300 to +300 ms, kept in the browser) is added to the output
latency the browser reports (`player.ts` `heardPosition`): with Bluetooth
headphones the band is heard later than it is played, so the highlight, the
scale shown and the judging of your notes wait for it.

**Practice > Keys** (`src/music/practice.ts` `KEY_STEPS`, `src/engine/keyOrder.ts`):
a step each chorus (a fourth or a fifth, a half step up or down, a whole step,
a minor or a major third), or random keys (from OpenStand #124): the twelve
keys in a shuffled order, the written key first, each once in twelve choruses
and never the same key twice in a row. The order comes from a seed chosen when
random keys are picked (Mulberry32), so the band, the key on the stand, the
melody and the sightreaders' expected notes agree (`chorusKeyOffset`).
Choosing random keys makes at least twelve choruses.

**The chord helper** (Chord Player, Lead Sheet Player, Free Improvisation;
`src/ui/ChordHelper.tsx`, `useChordHelper.ts`; idea, keyboard drawing and
Follow from OpenStand's chord helper, keyboard only): a tap on a chord (a bar
of a lead sheet), or the bottom bar's **Chords** button (beside Practice; in the
Settings panel below 1760 px), shows the bar's chords as the band plays them (`chordsOfBar`: in the
chorus playing, its key with Practice > Keys; a bar with no chord written shows
the chord it holds), each on two octaves of keys with its tones marked and the
chosen scale dotted, and **Hear** (the chord, or the scale up an octave, on the
live piano channel: `src/audio/hear.ts`). The scales (`src/exercises/scaleSuggestions.ts`), each once, best first:

| Group | Scales |
|---|---|
| For this chord | its scale where it is (`chordScale`, as Free Improvisation colours: a V to minor gets Mixolydian b9 b13, a V to major Mixolydian, a dominant going down a half step or up a step to I (a tritone substitution, a backdoor ♭VII7: `stepDominant`) Lydian dominant, a minor 7th Dorian...), then its pentatonic (major over a major or unaltered dominant chord, minor over a minor 7th) |
| From the key | the key's major pentatonic (major keys), minor pentatonic and blues scale |
| Also good | kept from OpenStand after checking them: Lydian (major chords), bebop dominant (dominants), altered and half-whole (a V), Lydian dominant (a dominant that does not go down a 5th), half-whole first for a 7b9 with a 13th, Aeolian (minor chords), Phrygian (only over the key's iii; OpenStand offers it over every minor chord, wrong over a ii), Locrian (half-diminished), whole tone (augmented, 7#5) |

**Follow the chord playing** (on by default, kept in the browser) shows the
chord sounding, chord after chord, while the band plays or is paused; tapping
a chord while the band is on one turns it off. Only the chord's own scales
show until **Show more scales** (the key's and the other good ones). Escape,
× or the Chords button closes it.

**Substitutions** (every screen with a band and a song: Chord Player, Lead
Sheet Player, Lead Sheet, Exercises, Lick and Chord Sightreading, Free
Improvisation; not an infinite line; the bottom bar's button beside Practice;
`src/music/substitutions.ts`, `src/ui/Substitutions.tsx`): the band plays
chord substitutions instead of the written chords, drawn in blue
(`--sub-color`; `.chord-sub` on a chart, `text.lead-chord-sub` on a lead sheet,
`useSubstitutedChart`), in the chord helper too, which says which chord is
written there (`Slot.written`, `chordsOfBar`).
`substituteChart(chart, settings, chorus)` gives the chart a chorus plays;
`buildTimeline` calls it for each chorus (`PracticeOptions.subs`), so the MIDI,
WAV and MP3 downloads play them too. The sheet shows the chorus playing.

| Substitution | Roman numerals | Example in C | Where |
|---|---|---|---|
| Add the ii before a long V7 | V7 → ii−7 V7 | G7 (a bar or more) → D−7 G7, half each | a V7 going down a 5th, not after its ii; over blank bars the ii takes half of them |
| Passing diminished chord | I ii−7 → I ♯I°7 ii−7, ii−7 iii−7 → ii−7 ♯ii°7 iii−7 (and I vi−7 ii−7 → I ♯I°7 ii−7) | C D−7 → C C♯°7 D−7, C A−7 D−7 → C C♯°7 D−7 | a minor chord a whole step above a chord, from any degree (I to ii, ii to iii, V to vi), not a major or dominant one: in place of a short chord (2 beats or less) between the two that is not a major chord (the vi or VI7 of I vi ii V, a repeated chord: B♭ B♭6 C−7 → B♭ B°7 C−7), or on the last 2 beats (1 of 2 or 3) of the chord a whole step under |
| Backdoor ii-V | ii−7 V7 I → iv−7 ♭VII7 I | D−7 G7 C → F−7 B♭7 C | a ii-V to a major chord |
| Turnaround with dominants | vi−7 ii−7 → VI7 ii−7 | A−7 D−7 → A7 D−7 | a minor chord going down a 5th to a minor chord |
| Secondary dominant on the ii | ii−7 V7 I → II7 V7 I | D−7 G7 C → D7 G7 C | a ii-V whose V goes down a 5th (not the backdoor's iv−7 ♭VII7) |
| Tritone substitution | V7 I → ♭II7 I | G7 C → D♭7 C | any dominant 7th going down a 5th, to any chord (a V7, a secondary dominant, I7 to IV7 in a blues); not one going elsewhere |
| Altered dominant | V7 I → V7♭9 I, V7 i−7 → V7♭9♭13 i−7 | G7 C → G7♭9 C, G7 C−7 → G7♭9♭13 C−7 | a dominant 7th going down a 5th with no alteration written: the ♭9, and the ♭13 before a minor chord (written so, not "alt"); the rootless voicings and the chord helper (half-whole and altered scales) follow |

Roman numerals count from the chord a chord leads to, so each works in any key
area. The ticked ones are applied one after another from the top of the menu
(`settings.ids`, in the menu's order `settings.order`, `substitutionOrder`),
each on the chart the ones before it made (a chord keeps in `written` the symbol
first written there). The order matters, and the menu's rows are dragged by
their handles (`useDragReorder`: mouse, pen or finger, or the arrow keys on a
handle) to change it: Turnaround, then Secondary dominant, then Tritone
substitution turn C A−7 D−7 G7 into C A7 D−7 G7, C A7 D7 G7, then
C E♭7 A♭7 D♭7; with the secondary dominant above the turnaround, the A−7
stays, as the D7 after it is no longer minor. The default order lets them build
on each other (the list above). The menu shows each one's Roman numerals and,
under the list, a short note on the order and the clash rule.

**Infinite lines** (Chord and Lick Sightreading, Free Improvisation) have no
Substitutions menu: substitutions are part of the line instead
(`withSubstitutions` in `src/exercises/sightReading.ts`). Each substitution is
used on about half of the sheets, in a random order, at about one place in two
where it fits (`substituteChart(..., { piece: true })`: whole chords only, so
no ii added and no chord split, two chords to a bar; the sheet's first and
last chords as written, as the line goes on to the next sheet). A substituted
step keeps its chord in `written`: blue on the sheet and on Chord
Sightreading's scrolling cards, and the chord to play is the substitute. **When**: every chorus, from a
chosen chorus (2 to 12), every other chorus (the 2nd, 4th...), or here and
there at random (each spot about one time in two; a seed kept in the settings
so the sheet and the band agree, a new one each time Random is chosen). On a
lead sheet, a substitute is left out where a melody note at least a beat long
would clash with it (a note outside its chord tones and tensions). Substitutions
change the sheet but not the song's length: the band goes on at once.
A lesson step's link can set them (`subs=addII`, always on).

The whole bottom bar (its buttons 16 px apart, so a sightreading screen's four
fit beside its controls on one line) needs about 1760 px: below that (`COMPACT_TRANSPORT_QUERY`
in `src/ui/useNarrowScreen.ts`), its controls, Chords, Practice and Mixer move
into the **Settings** panel, as on phones and tablets. Chords there closes the
panel (`data-closes-settings`), so the helper shows. On the full bar the helper's bottom is on the
bottom of the other panels (Practice, Substitutions, Mixer). The browser tests run in a
1760 px wide window, the full desktop bar. A lesson song's **scale ideas** sit under the sheet of
Free Improvisation (`SongScaleIdeas`).

**Start from a chord** (Chord Player and Lead Sheet Player): while the band is
stopped or paused, the chord helper's **Start the band from here** makes the
chord the start point: `chordStartBeat` (`src/engine/timeline.ts`) finds where it is first
played (outside the loop: no start point), and `usePausedAt().holdAt` keeps it
like a pause, with a mark (`.chord-start`). Play then goes on from there
(20 ms early, so its first notes sound) without a count-in; the
play-from-the-beginning button, a new loop, and **Start from the beginning
again** in the helper forget it.

**Jazz Waltz** (`src/styles/jazzWaltz.ts`): drums and bass from OpenStand's
jazz-waltz.ts (ride on 1, 2 and the "and" of 2, hi-hat pedal on 2 and 3, a
feathered kick, an occasional snare comment; a bass mixing a held root, root
and 5th, and three walking quarters with a half-step approach), checked and
kept unchanged. Its chord comping picks one figure a bar from Wynton Kelly's
comping on "Someday My Prince Will Come" (Miles Davis, 1961, after a published
transcription): the dotted-quarter cell (1 and the "and" of 2), the two
off-beats, beat 2 held, beats 1 and 3, a chord held on 1, a chord laid in on
the "and" of 1. Its piano pattern **Waltz: bass on 1, chords on 2 and 3** plays
rootless voicings on 2 and 3 while the bass holds each chord's root
(`WALTZ_DOWNBEAT_BASS`). Every song in 3/4 starts as a Jazz Waltz
(`styleForChart`; iReal Pro's swing and waltz styles in 3/4 map to it), unless a
lesson step asks for another style.

**The crash catch** (`src/ui/CrashScreen.tsx`, around every screen in
`Root.tsx`): an error while drawing a screen, or a screen's code that cannot be
downloaded (offline after an update), shows *Something went wrong* with
**Reload** and **Main menu** instead of a blank page; the error goes to the
console.

**Downloading the band** (Export menu, `src/engine/exportTrack.ts`,
`src/audio/exportAudio.ts`; ideas from OpenStand #1, #70, #122, #126):

| Step | What happens |
|---|---|
| arrangement | `arrange` with the settings of the moment (style, piano pattern, choruses, loop, keys); the tracks of muted parts are left out (the click only when it is on) |
| MIDI file | written at the song's real tempo, a tempo change at each chorus with Practice's speed-up (`rampedBpm`), and time signatures where the meter changes (6/8 written in eighths). The app itself plays its files at 120 bpm and sets the speed |
| audio | the MIDI file is rendered at 44.1 kHz by SpessaSynth's core synthesizer in a worker (`synthWorker.ts`; on the page where workers are missing), with the mixer's channel volumes locked like the player's, then passed through the same master gain and limiter as the live band (`mastering.ts` `outputStage`) on an `OfflineAudioContext` |
| WAV | 16-bit stereo (about 10 MB a minute) |
| MP3 | 192 kbps, encoded by LAME in JavaScript (`@breezystack/lamejs`, LGPL-3.0, loaded only for this) |

SpessaSynth's two packages are pinned (`spessasynth_core` 4.4.4,
`spessasynth_lib` 4.4.2): the live player's audio worklet comes with the
library, and a newer core on the page could not read the songs the worklet
sends back (errors when a song loads).

**First screen.** Every screen is its own download (`React.lazy` in
`src/Root.tsx`), and the audio engine is loaded after a screen is drawn
(`usePlayer`), so the menu shows without waiting for the band, the
engraver or the exercises (the first download went from 1.2 MB to 0.34 MB of
script).

## Playback without clicks

Loading a song makes SpessaSynth reset its synthesizer, which cuts the notes
still ringing and the reverb. `src/audio/player.ts` therefore keeps a second
synthesizer (made in the background after the warm-up):

- a change while the band plays (style, pattern, choruses, the
  band on or off...) loads the new arrangement on the second synthesizer, which
  takes over at the band's position while the first lets its notes fade
  (`play(midi, fromSeconds)`);
- an endless exercise loads its next chunk there ahead of time (`queue`) and
  starts it on the bar line (`startQueued`).

**Pause** works the same way: each screen keeps where the band was paused
(`usePausedAt` in `src/audio/usePlayer.ts`), and Play arranges the band again
with the current settings and goes on from there (`play(midi, fromSeconds)`),
the notes and chords before it judged already; an endless line goes on with the
sheet on the stand, then the next ones. The button beside Play (`onRestart` of
`Transport`) starts from the beginning; a new song, or a change made while
paused that would start the song again while playing (a new loop; in the
sightreaders and Free Improvisation a new key too), also starts over. A new
number of choruses goes on from where the band is, as a new style does.

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

Windows and macOS ignore letter case in file names. Where a component and a
module of the same folder differ only in case (`ui/Effects.tsx` and
`ui/effects.ts`), the component is imported with its extension
(`'./ui/Effects.tsx'`); otherwise the build on Windows opens the `.ts` file.
`tests/fileCasing.test.ts` checks it.

| Folder | Holds |
|---|---|
| `src/engine/` | arranges a chart into MIDI: bass (`bass.ts`), piano (`comp.ts`, `pianoPatterns.ts`), drums (`drums.ts`), melody (`melody.ts`: `melodyOccurrences` lists every note as the band plays it, which the melody sightreaders also judge), timeline and count-in (`timeline.ts`) |
| `src/styles/` | the seven styles (the Jazz Waltz in `jazzWaltz.ts`), compound meters (`compound.ts`) and the Pattern Creator (`lab.ts`) |
| `src/audio/` | the synthesizer (SpessaSynth, `player.ts`), playback (`usePlayer.ts`), mixer, MIDI input (`useMidiKeyboard`, `nativeMidi.ts`) |
| `src/music/` | chords (`chords.ts`), charts and tuplets (`chart.ts`), melodies (`melody.ts`) and their ABC notation (`abc.ts`), places on the staff (`staff.ts`), the `lick` record of licks and exercises and their rhythm rule (`licks.ts`), Roman numerals (`roman.ts`), practice settings (`practice.ts`), chart editing (`edit.ts`) |
| `src/formats/` | iReal Pro import (`ireal.ts`) and export (`irealWrite.ts`), share links (`share.ts`) |
| `src/library/` | the catalog (`catalog.ts`), saved tunes (`db.ts`), playlists (`playlists.ts`, `playlistChoice.ts`, export files in `playlistExport.ts`), imports (`importTunes.ts`), saved styles, browser storage (`storage.ts`, and a screen's settings kept there: `useStoredSettings.ts`) |
| `src/ui/` | screens and controls: chart, lead sheet (`LeadSheet.tsx`, measured by `engraving.ts`, notes written on it by `useStaffInput.ts`), transport, mixer, menus, editor, Pattern Creator, loop picking (`useLoopPicking.ts`), keyboard shortcuts (`useWindowKeys.ts`), check-box filters (`CheckFilter.tsx`: Progressions, Playlists, Licks) |
| `src/exercises/` | Name the progression, Melodic Dictation (`MelodicDictation.tsx`, `melodicDictation.ts`), Chord Sightreading, Lead Sheet and Exercises Sightreading (`MelodySightreading.tsx`, `melodyReading.ts`: `arrangeMelody`), Lick Sightreading (`LickSightreading.tsx`, `lickReading.ts`), Free Improvisation (`FreeImprovisation.tsx`, `improvisation.ts`, `toneColors.ts`). Shared by the exercises: the key menu, Tonic and Cadence, status messages, MIDI notes held, source buttons and random song picker (`ExerciseControls.tsx`); by the sightreaders: where the music comes from, with the song list, Import and the catalog (`useSongSource.ts`, laid out by `SongWorkspace.tsx`), the band's settings (`useBand.ts`), the hand-over of endless lines (`useEndlessLine.ts`); by the melody screens: judging (`useMelodyJudging.ts`) and the Scoring button, sheet and score line (`ReadingControls.tsx`) |
| `src/lessons/` | The Lessons tab: its 46-week program, each step's page (what to do, why, the theory with staves and progressions, references), the links that open a screen set up for a step, the targets that tick a step, progress kept on the device, the lesson songs' scale maps |
| `scripts/` | builds the shipped lead sheets (`leadSheetCatalog.ts`, `pnpm run leadsheets`) and the licks (`lickCatalog.ts`, `lickExercises.ts` the vocabulary, `lickMining.ts`, `lickCuration.ts`, `pnpm run licks`; the chart helpers are in `src/exercises/builder/`) |
| `tests/` | the app's unit tests (`pnpm test`) |
| `e2e/` | the browser tests (Playwright, `pnpm run test:e2e`): every screen at three sizes, settings that must not restart the song, endless lines, Melodic Dictation, Export |
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
