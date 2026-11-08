# Left-hand accompaniment audit

Studio offers 16 distinct piano patterns across six styles, with two to five
choices per style, plus a style chord comping entry for every style except
Blues. Patterns removed from the menus have been deleted from the catalog.
Run `python left_hand_patterns.py` to rebuild `data/left_hand_patterns.json`.

## Source and fidelity

The supplied TopMusic worksheet, Creative Piano Teacher handout, and Mark
Mellis index were inspected page by page. Philip Wesley's article describes
pattern families, without note-by-note notation. A `scored example` records
the attacks, note lengths, and simultaneous notes from one representative
measure or multi-measure example in a supplied score. It does not reproduce
every printed variation. The engine maps the written C-based interval roles to
each chord quality and inversion; this is an accompaniment arrangement rather
than a literal performance of a song. The source meter is stored, and playing
the figure in another meter stretches its timing to that meter.

The active set contains 11 scored examples, four adaptations, and one
original prototype (`bossa_bass`). The blocked-chord figure is an adaptation
because its requested four-beat pulse differs from the printed half-note
example. The bossa comp and montuno preserve published rhythmic outlines, but
are not literal transcriptions. `boogie_walking_shells` adds an arranged shell
part to a scored bass line.

Scored figures retain explicit note lengths, including dotted values. A held
note remains sounding over a chord change or tie; a rest creates silence; and
an optional grace note sounds just before its nominal beat. Two-bar boogie and
walking figures retain their full cycle. Blocked chords strike at the bar
start and every four quarter-note beats within longer bars. A chord change
alters subsequent pattern attacks without resetting the phase or adding an
artificial attack.

The walking bass and boogie walking bass keep the printed C figure when one
harmony spans the figure. If a chord changes inside the two-bar cycle, the
next bass attack uses the written bass of the new chord in a nearby octave.
Later attacks continue the printed up/down contour using tones and passing
notes from that chord. These harmonic transitions are arranged, not literal
notes from the C-only source examples.

For the walking bass, boogie walking bass, and boogie walking with chord
shells, a whole-tone distance between the last bass note of one measure and
the first of the next adds the intervening chromatic pitch. The original last
note ends at the new attack. Swing and blues place this eighth-note approach
two-thirds of the way through the final beat; straight playback uses the
midpoint. Semitone, unison, and larger intervals do not get a passing note.

## Curated styles

| Style | Piano patterns |
| --- | --- |
| Swing | Swing chord comping, stride, walking bass |
| Blues | Simple boogie, boogie walking bass, left-hand shuffle, New Orleans bass, boogie walking with chord shells |
| Bossa nova | Bossa chord comp 1 (style comping), blocked chords, bossa bass, Bossa chord comp 2 (`bossa_chord_comp`) |
| Latin | Latin chord comping, tango, bossa bass, Latin montuno (2-3 clave) |
| Straight pop/rock | Straight Pop/Rock chord comping, broken chords, pop/rock bass |
| Ballad | Ballad chord comping, broken chords, ascending arpeggio, rolled chords |

The bossa and Latin menus are intentionally short. `block_chords` is a general
pattern that can be played with the bossa drum groove; it is not documented as
a traditional bossa piano figure. `boogie_walking_shells` retains the boogie
walking bass and adds upper third-and-seventh shell hits. Each measure selects
one of six comping rhythms: Charleston, shifted Charleston, Red Garland's two
offbeats, a held hit on the and of three, a beat-two push, or a sparse
and-of-three hit. The same rhythm is not selected in adjacent measures. Hits
range from short swung eighths to longer sustains, and the selection is stable
for a given random seed. Swing-delayed shell attacks use the chord active at
the sounded time. These shell rhythms are arrangement choices rather than
part of the bass score. The generated catalog exposes all six variations.
`bossa_chord_comp` alternates root and fifth half-note bass under a two-bar
syncopated chord rhythm. `latin_montuno` uses a two-bar 2-3 son-clave piano
figure and matching clave percussion. ChoCo does not identify clave direction,
so this prototype assumes 2-3; it does not reverse for 3-2 songs.

## Research basis

The TopMusic worksheet explicitly calls its selection common patterns and
shows pop root-fifth-octave, arpeggios, and stride/ragtime. Creative Piano
Teacher emphasizes blocked chords, broken chords, fifths, and root-fifth-
octave as a foundation, then presents boogie, tango, and waltz families.
Berklee's jazz piano syllabus teaches left-hand comping, walking bass in four,
and bossa comping as separate skills. Its keyboard method teaches shell
voicings and guide tones. Yamaha's keyboard guide treats flowing arpeggios as
a useful pop backing. These are educational recommendations, not measured
usage frequencies. The curated list aims for stylistic coverage and distinct
sound, rather than a statistical popularity ranking.

References: [TopMusic's left-hand guide](https://topmusic.co/the-ultimate-guide-to-left-hand-piano-styles-patterns/),
[Creative Piano Teacher's pattern guide](https://creativepianoteacher.com/120-left-hand-piano-patterns-and-how-to-use-them-in-your-teaching/),
[Berklee Jazz Piano syllabus](https://online.berklee.edu/courses/jazz-piano),
[Berklee Keyboard Method syllabus](https://online.berklee.edu/courses/berklee-keyboard-method),
[Berklee's piano voicing guide](https://online.berklee.edu/takenote/basic-piano-voicing-techniques/),
and [Yamaha's arpeggio guide](https://hub.yamaha.com/keyboards/k-how-to/how-to-create-flowing-keyboard-accompaniments/).
For the new figures, see [Yamaha's Latin rhythm guide](https://hub.yamaha.com/keyboards/k-how-to/exploring-latin-rhythms/),
[the bossa comp description](https://www.rhythmdictionary.com/p/bossa-piano),
[the two-bar son montuno description](https://www.rhythmdictionary.com/p/montuno-son-2-3),
and [the Midwest Clinic's montuno handout](https://www.midwestclinic.org/user_files_1/pdfs/clinicianmaterials/2005/victor_lopez.pdf).
The distinction between a backing style and its piano pattern follows
[iReal Pro's style guide](https://www.irealpro.com/learn/backing-track-styles/).
The shell rhythm choices draw on [Jazz Empowers' five comping patterns](https://www.jazzresources.org/jazz-band-director-cohort-blog/the-first-5-comping-patterns-to-teach-your-students),
[Jens Larsen's comping rhythm examples](https://jenslarsen.nl/WP/wp-content/uploads/2019/12/Comping-Rhythms-10-Examples-You-Need-To-Know-PDF.pdf),
and Berklee's discussion of [rhythmic phrasing](https://college.berklee.edu/bt/193/lesson.html).

## Chord handling

Harte slash intervals are measured from the chord root. `/3` means a major
third; `/b3` means a minor third, even with a minor chord. Thus `Eb:min/3`
places G-natural in the bass, while `Eb:min/b3` places Gb in the bass. Triad
and seventh tones are placed above an in-chord slash bass. An out-of-chord
slash bass stays lowest. Extended blocked chords retain a seventh and one
color tone. Root-relative passing-note roles keep the source octave on slash
chords; the walking patterns additionally connect bass pitches across chord
changes. Smooth upper-voice leading remains a separate arrangement improvement.
