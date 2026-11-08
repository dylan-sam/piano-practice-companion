# Piano patterns

The app offers **16 piano patterns** across its six styles, two to five per
style, plus a "chord comping" entry (the style's own comping) for every style
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
| Simple boogie / barrelhouse shuffle | `boogie_simple` | Blues | scored example |
| Boogie walking bass | `boogie_walking` | Blues | scored example |
| Boogie walking with chord shells | `boogie_walking_shells` | Blues | adaptation |
| Left hand shuffle | `left_hand_shuffle` | Blues | scored example |
| New Orleans bass | `new_orleans_bass` | Blues | scored example |
| Blocked chords | `block_chords` | Bossa Nova | adaptation |
| Bossa bass | `bossa_bass` | Bossa Nova, Latin | original prototype |
| Bossa chord comp 2 | `bossa_chord_comp` | Bossa Nova | adaptation |
| Tango bass | `tango` | Latin | scored example |
| Latin montuno (2-3 clave) | `latin_montuno` | Latin | adaptation |
| Pop and rock bass | `pop_rock` | Straight Pop/Rock | scored example |
| Broken chords | `broken_chords` | Straight Pop/Rock, Ballad | scored example |
| Ascending arpeggio | `arpeggio_ascending` | Ballad | scored example |
| Rolled chords | `rolled_chords` | Ballad | scored example |

The menus, with the default of each style first:

| Style | Piano patterns |
|---|---|
| Swing | Swing chord comping, stride bass, walking bass |
| Blues | simple boogie, boogie walking bass, left-hand shuffle, New Orleans bass, boogie walking with chord shells |
| Bossa Nova | Bossa chord comp 1 (the style's comping), blocked chords, bossa bass, Bossa chord comp 2 |
| Latin | Latin montuno, Latin chord comping, tango bass, bossa bass |
| Straight Pop/Rock | pop and rock bass, Straight Pop/Rock chord comping, broken chords |
| Ballad | ascending arpeggio, Ballad chord comping, broken chords, rolled chords |

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
- [Jazz Empowers' five comping patterns](https://www.jazzresources.org/jazz-band-director-cohort-blog/the-first-5-comping-patterns-to-teach-your-students),
  [Jens Larsen's comping rhythm examples](https://jenslarsen.nl/WP/wp-content/uploads/2019/12/Comping-Rhythms-10-Examples-You-Need-To-Know-PDF.pdf)
