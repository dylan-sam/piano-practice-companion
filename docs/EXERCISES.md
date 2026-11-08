# Exercises

## Chord Sightreading

Connect a MIDI keyboard, then choose **Pick a song**, **Random song**, or
**Infinite progressions**. Pick a song uses Studio's ChoCo search, title versions,
saved playlists, and progression filters. Random song chooses a distinct ChoCo
song from the whole keyed catalog, optionally restricted to one catalog
progression. Moving between these two modes keeps the current song selected
and playing; pressing Pick a song again (or Songs) opens or closes the song
list, like the Tunes button of the Accompaniment Player. Only Infinite
progressions stops the song. Both song modes play the whole chart with bass and drums; the
player supplies the chords. Live MIDI keys sound through the existing acoustic
piano sound bank, while the backing track has no generated piano notes. The
Mixer offers bass, drums, and Master, without a piano strip. Style selects the
drum groove. The bass pattern can be chosen independently from Walking Bass,
Boogie Walking Bass, Latin Bassline, Ballad Bassline, and Root-Fifth Bassline
for any style. Swing defaults to Walking Bass, Blues to Boogie Walking Bass,
Bossa Nova and Latin to Latin Bassline, Ballad to Ballad Bassline, and Straight
Pop/Rock to Root-Fifth Bassline. Tempo, key, repetitions, and Practice controls
can be changed as in Studio. Random key is chosen when a song loads.

Each written chord must be played during its sounding beats. Chord detection
uses the held MIDI notes: octave doublings and inversions are accepted, all
basic chord tones (including a written seventh) are required, except the
perfect fifth of a four-note chord, which may be left out (an altered fifth,
as in h7 or 7#5, is required). Written color tones are allowed, and foreign
notes are rejected. A written slash bass must
be the lowest played pitch class.
The chord turns green once complete; if its time expires first, it turns red.
The chart's accompaniment keeps playing regardless of the score. Missed chord
roots and major/minor chord families are counted in browser storage for Focus
on mistakes, so a missed colored chord also reinforces its basic triad.
Playback without a connected MIDI input is available for listening and does
not add missed chords to the score.

Infinite progressions picks a random initial key and a catalog progression of
two to four chords. It then selects one of three valid transitions: reuse the
last chord as the first chord of a new progression in a matching key; treat it
as a new major or minor tonic and begin a progression on a different chord; or
for a major last chord, treat it as V, resolve to I, then begin a progression
on a different chord. The line scrolls left on larger screens and up on phones.
The **7th chords** slider (0-100 %, kept in the browser) sets how often a
progression with a 7th-chord version is played in that version
(`SEVENTH_VARIANTS` in `sightReading.ts`): ii-7 V7 I^7, vi-7 ii-7 V7 I^7,
II7 V7 I, I^7 vi-7 IV^7 V7, V7 in I IV V, IV V I, I V vi IV, vi IV I V and
IV V I vi, i-7 bVII bVI^7 V7, iv-7 V7 i-7, I III7 IV iv-6 and bVI^7 bVII7 I.
Focus on mistakes gives more weight to patterns in keys containing previously
missed chords. The line is generated in long chunks: while one plays, the next
is generated and arranged, and it starts from the synthesizer's clock 60 ms
before the current chunk ends, so only the sequencer's load of the prepared
file falls at the boundary instead of a pause.

In a desktop browser the app uses the Web MIDI API: Chrome, Edge and Opera
support it, Firefox asks for a site permission, and Safari has none. It needs a
secure context (`localhost` or HTTPS); the Connect button asks for access to the
devices. The Android and iOS apps read MIDI through their own plugin, behind the
same note interface (see [mobile apps](MOBILE.md)).

## Name the progression

The player hears one line of a real chart and chooses which catalog progression
fills its gap. The line has the bar before the progression, the bars the
progression occupies, and the bar after it. The hidden chords are drawn as one
blank per bar, so the gap shows its length in bars without giving away how
many chords it holds. The band plays every chord, including the hidden ones.
**Hear the key** plays the tonic triad or a cadence of the line's key. Answers reveal the
hidden chords and the song.

### Options

- **Key**: the song's key, a random key for each question, or one fixed tonic.
  The mode (major or minor) always stays the song's.
- **Display > Hide the key**: uses the song's original key (a fixed or random
  key would give it away) and conceals its name in the sheet, playback readout,
  and key control. Turning it on restarts playback only if the current key must
  change to the song key. Turning it off reveals the song key without
  restarting playback. The key reference remains available by ear.
- **Display > Minor written / Repeat sign**: the chart display options shared
  with the Accompaniment Player (C− or Cm, % for a repeated bar). Roman numerals
  are not offered here: they would name the progression.
- **Display > Hide all chords**: leaves the chords before and after the answer
  gap empty, without question boxes or blur. The answer gap retains its question
  box so it is clear which passage to identify. Both display options are saved
  in the browser; the chords are revealed after an answer. Hiding affects only
  the sheet, not accompaniment playback.
- **Hear the key**: *Tonic* plays the tonic triad (K); *Cadence* (C) plays the
  cadence of the song's mode: I-IV-V-I in major, i-iv-V-i in minor. A few
  relaxed questions of rare progressions (7) have no known mode: the key then
  shows "(major or minor)", the tonic is played without its third, and two
  buttons offer the *Major cadence* (C) and the *Minor cadence* (M).
- **Hear an answer in the gap**: after answering, tapping a choice plays the line
  with that progression in the gap. A choice with as many steps as the real
  answer keeps the song's rhythm (each hidden chord records its step); others
  share the gap evenly on whole beats. Jazz and Latin styles use seventh chords,
  with major chords on II, III, V, VI and VII as dominants.
- **Volumes**: a Master slider stays visible beside the Mixer button. The
  Mixer sets bass, piano/guitar and drum volumes and mutes. The Master and
  instrument levels are kept in the browser and shared with the
  Accompaniment Player.
- **Focus on mistakes**: the button shows On or Off. When on, progressions
  answered incorrectly come up more often. Results are kept per progression (right answers and
  which progressions it was taken for). With focus on, a progression is chosen
  with weight 0.5 + 2 x (1 - accuracy), where accuracy is (right + 1) / (asked + 2),
  so new progressions start at 50 %.

### Levels

Progressions are ranked by the number of distinct songs they occur in.
Versions of one song in several corpora (iReal Pro, Real Book, Wikifonia,
BiaB, ...) count once; they are grouped by `score_search.song_key`, which folds
case, accents, punctuation, bracketed notes and a leading "The". Level 1 offers
the two most common progressions, and each further level adds the next one.
The two eight-chord progressions (I-V-vi-iii-IV-I-IV-V and I-V-IV-IV-I-V-I-V, a handful of songs each) are not used by the exercise; they still count when checking that only one answer fits a gap. Progressions with fewer than five usable questions are left out of the levels.
A round has 10 questions; 8 correct answers pass the level. The chosen level and
passed levels are kept in the browser.

A question picks a progression of the level uniformly, then one of its songs
uniformly, avoiding songs already asked in the round.

### Question bank

`python build_exercises.py` writes `studio/public/exercises/name-progression.json`
from `data/common_progressions.json` and the ChoCo database. Run it after
`python find_progressions.py`. For each progression it takes up to 150 songs,
better-known sources first (iReal Pro: ChoCo's playlists, added playlists, forum charts; then Real Book, rock corpus, When in
Rome, ...), shuffled with a fixed seed within a source. For each song it uses
the first passage, in the preferred version, that:

- has a whole bar before and after it, and at most four bars of gap;
- has no key change in the line and no N.C. among the hidden chords;
- starts and ends on chord boundaries;
- does not also form another catalog progression exactly, so only one answer fits;
- is in a key with a known mode (keys the import could not settle are skipped).

A progression left with fewer than 40 such questions (the rare ones) then tries
its remaining songs with relaxed rules: the gap may be of any length and start
or end within a bar; the line still starts and ends on bar lines, takes the bar
before and after only when they exist in the same key (so a progression may
open or close the song), holds at most 6 bars, and may be in a key of unknown
mode. This adds 35 questions to six progressions. Such questions carry `"relaxed": true` in the bank.

The file is static, so the exercise works without the local server, as it must
in the mobile apps.

## Passage catalog

`python find_progressions.py` rebuilds `data/common_progressions.json` from
ChoCo. Each progression has `song_count` (score entries) and
`unique_song_count` (distinct songs). Each song's `passages` array contains:

| Field | Meaning |
|---|---|
| `key_part_index`, `key` | Independent annotated key section |
| `start_ordinal` | First included chord ordinal |
| `end_ordinal_exclusive` | First chord ordinal after the passage |
| `start_measure`, `start_beat` | Bar and beat (from 1, in the meter's unit) of the first chord |
| `start_quarter`, `end_quarter` | Score positions in quarter notes from the start of bar 1 |

The end quarter is clipped before a following key change.
