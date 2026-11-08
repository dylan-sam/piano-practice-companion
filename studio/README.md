# Ear Training Studio

This is a modified integration of [OpenStand](https://github.com/canbmaj7/openstand),
revision `9d49d2ae3b49e3960c099754814f987e2192955b`, into the ChoCo
accompaniment project. It was modified on 2026-11-03. OpenStand's original
copyright notices and [AGPL-3.0-or-later license](LICENSE) are retained.

Changes include ChoCo score search and chart conversion, a six-style project
library, source licensing link, and removal of upstream example songs,
telemetry, and upstream submission action. The integrated player provides
independent bass, piano, and drum mixing, Style Lab, chart editing, local tune
storage, and iReal Pro import/export. The transport offers the project's six
accompaniment styles and their curated piano patterns. Choosing a pattern
replaces the style's piano comping. The style-named "chord comping" option uses
the editable Style Lab rhythm when a custom style is selected. Pattern metadata is built
from `left_hand_patterns.py` into `data/left_hand_patterns.json`.
Blues offers no style chord comping entry; Bossa Nova names its style
comping "Bossa chord comp 1" and the scored figure "Bossa chord comp 2".
Swing chord comping and Bossa chord comp 1 are selected by default when their
styles load, in the Accompaniment Player and in Name the progression
(`defaultPatternForStyle`). The scored walking bass and Bossa chord comp 2 remain selectable.
Walking bass patterns replace the style's bassline on the bass track. Their
chord shells, when present, play on the piano track.
Swing chord comping uses the scored walking bass figure. Blues and Straight
Pop/Rock piano patterns omit the separate style bassline; Blues walking
patterns supply their own bass notes.

The tune search lists saved charts before ChoCo scores. Selecting a playlist
puts its tunes first, followed by tunes in other saved playlists and then
ChoCo results. **Export**, beside **Share** in the Studio header, downloads
one playlist or all saved playlists as a JSON file with playlist names and
editable charts. ChoCo scores fetched for preview are excluded. To restore
the file, choose **Import** in the tune library, select **Studio export**, and
choose the JSON file. The same dialog also imports iReal Pro links and files
when **iReal Pro** is selected. Saved tunes and imported playlists are kept
in this browser's IndexedDB; export a file before clearing browser storage.

Build with `pnpm install` and `pnpm run build` from this directory. Start
`python server.py` from the project root and open `http://127.0.0.1:8765/`.
The app opens on the main menu (`src/Home.tsx`); **Accompaniment Player** opens
Studio at `/studio`; **Name the progression** (`src/exercises/`) opens at
`/exercises/name-progression` and loads `public/exercises/name-progression.json`.
**Chord Sightreading** opens at `/exercises/chord-sightreading`, reuses Studio's
ChoCo search and practice controls, and scores notes received from Web MIDI.
It plays bass and drums without a generated piano track; incoming MIDI notes
are monitored through an acoustic piano sound. Style sets the drum groove,
while Walking, Boogie Walking, Latin, Ballad, and Root-Fifth basslines can be
selected independently for any style. The infinite mode uses short
ChoCo catalog patterns from the generated exercise bank and regenerates them
in audio chunks; a brief seam can occur when one chunk is replaced.
Routes live in `src/router.ts` and `src/Root.tsx`. The build also writes `dist/source.zip`, linked from the Studio header,
with the editable source code and license. The ChoCo SQLite dataset is not in
that archive; rebuild it using the project import scripts and the dataset's
license requirements.

The bundled GeneralUser GS sound bank has its own terms in
`public/soundfonts/GeneralUser-GS-LICENSE.txt`.

The Mixer's state (part volumes, mutes, Master volume, kept in the browser) lives in
`src/audio/useMixer.ts`, shared by Studio and the exercises. Charts from the
catalog arrive in iReal Pro chord notation, written by `chord_notation.py`
(see `docs/CHORD_NOTATION.md`).
The progression exercise also shows a Master slider beside Mixer and an
explicit On/Off state for Focus on mistakes. Chord charts share each bar
between its chords by beats; a long symbol may take room from a short one, and
when the chords of a bar do not fit together they are drawn smaller, by the
same factor for the whole bar (`src/ui/fitChords.ts`, down to 45 %, or 10 %
for a bar of more than six chords). Upright phones (below 820 px) show two bars
per row instead of four; landscape phones (below 500 px high) keep the desktop
layout, made compact, and up to 1100 px wide the transport's settings open
from a Settings button (`docs/MOBILE.md`). Chords lasting a tuplet (three
in the time of four beats, five in a bar...) get a bracket with its count over
them, as in printed music (`tuplets` in `src/music/chart.ts`; up to 7 notes
and two notes a beat, so a bar crowded with chords is shared, not marked). A time signature at the start of a line (the first bar, or a
change that starts a new line) is drawn before the barline, in the sheet's
margin, so it does not take room from the chords; a change inside a line is
drawn at the start of its bar.
The Display button of the Accompaniment Player and Chord Sightreading
(`src/ui/DisplayMenu.tsx`, settings in `src/ui/display.ts`, kept in the browser)
switches Roman numerals on and off (each chord as a degree of the key in force,
the accidental first: bII7; a key change of a catalog chart, carried by its bar
as `keys` with the beat where it happens, applies from that beat; the band
still plays in the chosen key), writes minor as C− or Cm, and
draws a bar that repeats the bar before (same chords and lengths) as %. Name
the progression has the minor and % options in its own Display menu, without
Roman numerals, which would give the answer away.
Its Display menu can hide the key (which uses the original song key) and leave
all surrounding chords blank while keeping the answer gap marked. The band
still plays the complete line, and the chords return after answering.

The iOS and Android apps wrap this app with Capacitor (`capacitor.config.ts`,
`android/`, `ios/`); `src/library/catalog.ts` reads the bundled song catalog
there and `src/audio/nativeMidi.ts` the app's MIDI plugin. Build with
`pnpm run native`; see `docs/MOBILE.md`.
