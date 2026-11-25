# Piano patterns

The app offers **29 piano patterns** across its seven styles, one to eleven per
style (the Lessons tab's song patterns among them, [docs/LESSONS.md](docs/LESSONS.md)), plus a "chord comping" entry (the style's own comping) for every style
except Blues. Patterns removed from the menus have been deleted from the
catalog. Rebuild `data/left_hand_patterns.json` with
`python left_hand_patterns.py`.

- [The patterns](#the-patterns)
- [Sources and fidelity](#sources-and-fidelity)
- [How a pattern follows the chords](#how-a-pattern-follows-the-chords)
- [Pattern details](#pattern-details)
- [Why these patterns](#why-these-patterns)
- [References](#references)

## The patterns

| Pattern | Id | Styles | Kind |
|---|---|---|---|
| Walking bass | `walking_bass` | Swing | scored example |
| Stride bass | `stride` | Swing | scored example |
| Light stride: bass and shells | `light_stride` | Swing | adaptation (Lessons) |
| Simple boogie / barrelhouse shuffle | `boogie_simple` | Blues | scored example |
| Boogie walking bass | `boogie_walking` | Blues | scored example |
| Boogie walking with chord shells | `boogie_walking_shells` | Blues | adaptation |
| Left hand shuffle | `left_hand_shuffle` | Blues | scored example |
| New Orleans bass | `new_orleans_bass` | Blues | scored example |
| Ragtime bass: bass note, chord | `ragtime_bass` | Swing, Blues | adaptation (Lessons, Winn) |
| Latin montuno (2-3 clave) | `latin_montuno` | Latin | adaptation |
| Tango bass | `tango` | Latin | scored example |
| Bossa bass | `bossa_bass` | Bossa Nova, Latin | original prototype |
| Bossa chord comp 2 | `bossa_chord_comp` | Bossa Nova | adaptation |
| Pop and rock bass | `pop_rock` | Straight Pop/Rock | scored example |
| Root and open 5th | `open_fifths` | Swing, Straight Pop/Rock, Ballad | adaptation (Lessons, Siskind) |
| Blocked chords | `block_chords` | Bossa Nova | adaptation |
| Broken chords | `broken_chords` | Straight Pop/Rock, Ballad | scored example |
| Broken chord: root, 5th, 10th | `broken_tenths` | Ballad | adaptation (Lessons) |
| Ascending arpeggio | `arpeggio_ascending` | Ballad | scored example |
| Rolled chords | `rolled_chords` | Ballad | scored example |
| Type A shells: root, 3rd under 7th | `type_a_shells` | Swing, Blues, Ballad | adaptation (Lessons, Siskind) |
| Charleston: chords | `charleston` | Swing | adaptation (Lessons) |
| Charleston: shells | `shells_charleston` | Swing | adaptation (Lessons) |
| Charleston: Type A shells | `type_a_charleston` | Swing | adaptation (Lessons, Siskind) |
| Charleston: rootless voicings | `rootless_charleston` | Swing, Blues | adaptation (Lessons, Levine) |
| Rootless voicings, held | `rootless_held` | Bossa Nova, Ballad | adaptation (Lessons, Levine) |
| Waltz: bass on 1, chords on 2 and 3 | `jazz_waltz_two_three` | Jazz Waltz | adaptation (waltz accompaniment, Levine) |
| Quartal pad (stacked 4ths) | `quartal_pad` | Ballad | adaptation (Lessons) |
| Fourth chords from the 9th | `fourths_from_ninth` | Swing, Bossa Nova, Ballad | adaptation (Lessons, Levine) |

The menus, with the default of each style first; the patterns follow one
order in every menu (`MENU_ORDER`): bass lines, then broken and held chords,
shells, the Charleston rhythm's patterns together, and the jazz voicings last.

| Style | Piano patterns |
|---|---|
| Jazz Waltz | Jazz Waltz chord comping (Wynton Kelly's figures), Waltz: bass on 1, chords on 2 and 3 |
| Swing | Swing chord comping, walking bass, stride bass, light stride, ragtime bass, root and open 5th, Type A shells, Charleston: chords, shells, Type A shells, rootless voicings; fourth chords from the 9th |
| Blues | simple boogie, boogie walking bass, boogie walking with chord shells, left-hand shuffle, New Orleans bass, ragtime bass, Type A shells, Charleston: rootless voicings |
| Bossa Nova | Bossa chord comp 1 (the style's comping), bossa bass, Bossa chord comp 2, blocked chords, rootless voicings held, fourth chords from the 9th |
| Latin | Latin montuno, Latin chord comping, tango bass, bossa bass |
| Straight Pop/Rock | pop and rock bass, Straight Pop/Rock chord comping, root and open 5th, broken chords |
| Ballad | ascending arpeggio, Ballad chord comping, root and open 5th, broken chords, broken chord with tenths, rolled chords, Type A shells, rootless voicings held, quartal pad, fourth chords from the 9th |

The Lessons patterns follow three books: Jeremy Siskind, *Playing Solo Jazz
Piano* (2022) for the bass note with an open 5th and the Type A shells (the
3rd under the 7th, between C3 and G4); Mark Levine, *The Jazz Piano Book*
(1989) for the rootless left-hand voicings of chapter 7 (four notes, the 3rd or
the 7th at the bottom, whichever moves least from the last chord; the b9, #9
and b13 of chapter 8 when the symbol writes them, from the same voicing table
as the band's comping, `rootlessVoicings`) and the fourth chords; and Edward R. Winn, *How to Play Ragtime* (1913, public domain)
for the bass note and chord alternation, here with single bass notes. The
two-feel, bass shells and two-note shells were removed.

The Jazz Waltz's two choices were picked by ear from three proposals. Its
chord comping varies, bar to bar, the figures of a published transcription of
Wynton Kelly comping on Miles Davis's "Someday My Prince Will Come" (1961): the
dotted-quarter cell (1 and the "and" of 2), the two off-beats, beat 2 held,
beats 1 and 3, a chord held on 1, a chord laid in on the "and" of 1. Its
pattern is the classic waltz accompaniment (bass on 1, chords on 2 and 3) with
Levine's rootless voicings, while the band's bass holds each chord's root; it
is written in 4/4 on beats 2 and 4, which a 3/4 bar plays on 2 and 3
(`meter.ts`). Kelly's two-bar hemiola and a plain "on-off" rhythm (1 and the
"and" of 2 every bar) were left out.

## Sources and fidelity

The TopMusic worksheet, the Creative Piano Teacher handout and Mark Mellis's
index were read page by page; Philip Wesley's article describes pattern
families without notes. Each pattern is one of three kinds:

| Kind | Meaning | Count |
|---|---|---|
| **scored example** | the attacks, note lengths and chords of one representative bar (or bars) of a printed score, not every printed variation | 11 |
| **adaptation** | a published figure changed for the app (see [details](#pattern-details)) | 4 |
| **original prototype** | written for the app | 1 (`bossa_bass`) |

The scores are written in C. The engine maps each written note to its role in
the chord (root, third, fifth...) and plays that role in the actual chord and
inversion: an accompaniment arrangement, not a literal performance of a song.
The source meter is stored; in another meter the figure is stretched to fit.

## How a pattern follows the chords

**Lengths.** Scored figures keep their written note lengths, dotted ones
included:

| In the score | Played |
|---|---|
| a held note over a chord change or a tie | keeps sounding |
| a rest | silence |
| a grace note | just before its beat |
| a two-bar figure (boogie, walking) | the full two-bar cycle |
| blocked chords | struck at the start of the bar, and every four beats in longer bars |

A chord change changes the notes of the following attacks, without restarting
the figure or adding an attack.

**Other meters.** Every pattern is written for a 4/4 bar. A bar of another
meter keeps its hits on the beat, as the styles' own comping, bass and drums do
(`studio/src/engine/meter.ts`):

| Bar | Plays | Stride bass, for example |
|---|---|---|
| 3/4 | beats 1, 2 and 4 of the 4/4 bar | bass, chord, chord (oom-pah-pah) |
| 2/4, 5/4, 6/4 | beats 1-2; 1, 2, 4, 3, 4; 1, 2, 4, 3, 2, 4 | |
| a pickup of one beat | beat 1 | bass |
| 6/8, 9/8, 12/8 | each half of the 4/4 bar on one dotted-quarter pulse, on the eighths, never swung | bass, chord on the 3rd eighth, bass, chord on the 6th |

A walking bass in 3/4 walks in three quarter notes; the passing note between
two bars is added only within one beat.

The styles' own chord comping (no piano pattern chosen) follows the same rule:
a 3-beat chord plays beats 1, 2 and 4 of the style's 4-beat rhythms. Until
1.2 a 3-beat chord used them as written, so a hit on beat 4 (Bossa Nova,
Latin, Straight Pop/Rock) sounded on the next bar's downbeat with the old
chord (`studio/src/styles/index.ts`; `tests/meter.test.ts`, "comping in 3/4").

**Walking basses.** The walking bass and boogie walking bass play the printed
figure when one chord lasts the whole figure. When the chord changes inside the
two-bar cycle:

1. the next bass note is the written bass of the new chord, in a nearby octave;
2. the following notes continue the printed up and down shape with tones and
   passing notes of the new chord.

These transitions are arranged; the source examples are in C only.

**Chromatic approach.** In the walking bass, boogie walking bass and boogie
walking with chord shells, when the last bass note of a bar and the first of the
next are a whole tone apart, the note between them is added:

| Last note | Next bar starts on | Played |
|---|---|---|
| D | E | D, then D♯ as a passing eighth, then E |
| D | D♯ (a semitone) | no passing note |
| D | G (larger) | no passing note |

The passing note falls two thirds of the way through the last beat in Swing
and Blues, and halfway in straight styles; the note before it ends there.

**Slash chords.** Harte bass intervals are measured from the root: `/3` is a
major third and `/b3` a minor third, even on a minor chord.

| Chord | Bass |
|---|---|
| `Eb:min/3` | G (natural) |
| `Eb:min/b3` | G♭ |

Triad and seventh tones are placed above a bass that belongs to the chord; a
bass foreign to the chord stays the lowest note. Extended blocked chords keep a
seventh and one color tone. Passing notes keep the source's octave on slash
chords, and the walking patterns connect the bass across chord changes. Smooth
voice leading of the upper notes is left for a later improvement.

## Pattern details

- **Blocked chords** (`block_chords`) is an adaptation: it plays four beats
  where the printed example has half notes. It is a general pattern that goes
  well with the bossa drums, not a traditional bossa piano figure.
- **Bossa chord comp 2** (`bossa_chord_comp`) keeps the published rhythm
  outline, not a literal transcription: root and fifth in half notes in the
  bass, under a two-bar syncopated chord rhythm.
- **Latin montuno** (`latin_montuno`) keeps the published outline of a two-bar
  2-3 son clave piano figure, with matching clave percussion. ChoCo does not say
  which way the clave goes, so it always assumes 2-3, even for 3-2 songs.
- **Boogie walking with chord shells** (`boogie_walking_shells`) adds upper
  third-and-seventh shells to the scored boogie walking bass. Each bar takes one
  of six comping rhythms, never the same in two bars in a row:

  | Rhythm | Hits (4/4) |
  |---|---|
  | Charleston | beat 1, the and of 2 |
  | shifted Charleston | the and of 1, beat 3 |
  | Red Garland | the and of 2, the and of 4 |
  | held hit | beat 1, the and of 3 held |
  | beat-two push | beat 2, the and of 4 |
  | sparse | the and of 3 only, held |

  Hits range from short swung eighths to longer sustains. The choice is stable
  for a given random seed, and a shell delayed by the swing uses the chord
  sounding at that moment. These rhythms are arrangement choices, not part of
  the bass score.

## Why these patterns

The choice aims at covering the styles with patterns that sound distinct, not
at a statistical ranking of popularity:

- the TopMusic worksheet calls its selection common patterns: pop
  root-fifth-octave, arpeggios, stride and ragtime;
- Creative Piano Teacher starts from blocked chords, broken chords, fifths and
  root-fifth-octave, then boogie, tango and waltz families;
- Berklee's jazz piano course teaches left-hand comping, walking bass in four
  and bossa comping as separate skills, and its keyboard method shell voicings
  and guide tones;
- Yamaha's keyboard guide uses flowing arpeggios as a pop backing.

These are teaching recommendations, not measured usage. The distinction between
a backing style and its piano pattern follows iReal Pro's style guide.

## References

- [TopMusic's left-hand guide](https://topmusic.co/the-ultimate-guide-to-left-hand-piano-styles-patterns/)
- [Creative Piano Teacher's pattern guide](https://creativepianoteacher.com/120-left-hand-piano-patterns-and-how-to-use-them-in-your-teaching/)
- [Berklee Jazz Piano syllabus](https://online.berklee.edu/courses/jazz-piano),
  [Berklee Keyboard Method syllabus](https://online.berklee.edu/courses/berklee-keyboard-method),
  [Berklee's piano voicing guide](https://online.berklee.edu/takenote/basic-piano-voicing-techniques/),
  [rhythmic phrasing](https://college.berklee.edu/bt/193/lesson.html)
- [Yamaha's arpeggio guide](https://hub.yamaha.com/keyboards/k-how-to/how-to-create-flowing-keyboard-accompaniments/),
  [Yamaha's Latin rhythm guide](https://hub.yamaha.com/keyboards/k-how-to/exploring-latin-rhythms/)
- [The bossa comp](https://www.rhythmdictionary.com/p/bossa-piano),
  [the two-bar son montuno](https://www.rhythmdictionary.com/p/montuno-son-2-3),
  [the Midwest Clinic's montuno handout](https://www.midwestclinic.org/user_files_1/pdfs/clinicianmaterials/2005/victor_lopez.pdf)
- [iReal Pro's style guide](https://www.irealpro.com/learn/backing-track-styles/)
- Jeremy Siskind, *Playing Solo Jazz Piano* (2022), [its left-hand chapter](https://jeremysiskind.com/wp-content/uploads/2022/12/Chapter-B-1.pdf);
  Mark Levine, *The Jazz Piano Book* (Sher Music, 1989): chapter 7 (left-hand voicings) and its fourth chords;
  Edward R. Winn, [*How to Play Ragtime*](https://archive.nyu.edu/bitstream/2451/61723/2/937644_1.pdf) (1913-1921)
- [Jazz Empowers' five comping patterns](https://www.jazzresources.org/jazz-band-director-cohort-blog/the-first-5-comping-patterns-to-teach-your-students),
  [Jens Larsen's comping rhythm examples](https://jenslarsen.nl/WP/wp-content/uploads/2019/12/Comping-Rhythms-10-Examples-You-Need-To-Know-PDF.pdf)
