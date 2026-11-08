import sqlite3
import unittest
from collections import Counter

from chord_notation import roman_chord
from import_choco import choco_positions, corrected_chords, in_three, laid_end_to_end, song_counting, superseded
from score_timing import METER_BEATS, MUSIC21_BEATS, MUSIC21_LONG_BEATS, QUARTERS
from track_store import Track, add_track, create_schema


class RomanChordTests(unittest.TestCase):
    """Check Roman numeral conversion during the ChoCo import."""

    def test_requested_f_minor_examples(self):
        """Use the tonic major grid for Roman roots in a minor key."""
        self.assertEqual(roman_chord("F:min", "F:minor"), "I:min")
        self.assertEqual(roman_chord("G:maj7", "F:minor"), "II:maj7")
        self.assertEqual(roman_chord("Gb:min", "F:minor"), "IIb:min")

    def test_quality_and_bass_degree_are_preserved(self):
        """Retain chord quality and inversion in the Roman event value."""
        self.assertEqual(roman_chord("Eb:7/3", "Bb:major"), "IV:7/3")
        self.assertEqual(roman_chord("N", "Bb:major"), "N")


class CorrectionTests(unittest.TestCase):
    """Check that corrected chords replace the release's only when they align."""

    def test_aligned_correction_replaces_the_chords(self):
        """Keep metadata, take the corrected values (Dh7 read as D:hdim7, not Db:7)."""
        release = {"annotation_metadata": {"corpus": "iReal Pro"},
                   "data": [{"time": 1.0, "duration": 4.0, "value": "Db:7"}]}
        fixed = {"data": [{"time": 1.0, "duration": 4.0, "value": "D:hdim7"}]}
        merged, applied = corrected_chords(release, fixed)
        self.assertTrue(applied)
        self.assertEqual(merged["data"][0]["value"], "D:hdim7")
        self.assertEqual(merged["annotation_metadata"]["corpus"], "iReal Pro")

    def test_misaligned_correction_is_ignored(self):
        """Keep the release when the corrected stream has different timing."""
        release = {"data": [{"time": 1.0, "duration": 4.0, "value": "Db:7"}]}
        fixed = {"data": [{"time": 1.5, "duration": 3.5, "value": "D:hdim7"}]}
        self.assertEqual(corrected_chords(release, fixed), (release, False))



class PositionTests(unittest.TestCase):
    """ChoCo measure.beat numbers become (measure, beat) positions."""

    def test_positions(self):
        """8.2333 is bar 8, beat 2 1/3."""
        self.assertEqual(choco_positions([(8.1, 1.333333, "C"), (8.233333, 2.666667, "D")]),
                         [((8, 1.0), 1.333333, "C"), ((8, 2.33333), 2.666667, "D")])

    def test_beat_ten_and_above_are_repaired(self):
        """In 12/8, beat 10 of bar 1 written 2.0 (after 1.7 + 3 beats) goes back to bar 1, beat 10."""
        events = [(1.1, 3, "A"), (1.4, 3, "B"), (1.7, 3, "C"), (2.0, 3, "D"), (2.1, 12, "E")]
        self.assertEqual([position for position, _, _ in choco_positions(events, [(1, "12/8")], repair=True)],
                         [(1, 1.0), (1, 4.0), (1, 7.0), (1, 10.0), (2, 1.0)])
        # A 4/4 bar never reaches beat 10: BiaB's "beat 0" stays for add_track to place
        self.assertEqual(choco_positions([(18.3, 1, "F"), (19.0, 1, "G")], [(1, "4/4")], repair=True)[1][0], (19, 0.0))


    def test_beat_zero_is_the_last_beat_before(self):
        """add_track stores BiaB's bar 19, beat 0 as bar 18, beat 4 (quarter 71)."""
        events = choco_positions([(18.3, 1, "F:sus4(b7)"), (19.0, 1, "F:7"), (19.1, 4, "Bb:maj")])
        track = Track(id="t", title="T", artist="", composers="", genre="", corpus="BiaB",
                      collection="biab-internet-corpus", license="", chords=events,
                      keys=choco_positions([(1.1, 0, "Bb:major")]), meters=choco_positions([(1.1, 0, "4/4")]))
        db = sqlite3.connect(":memory:")
        create_schema(db)
        add_track(db, track, Counter())
        self.assertEqual(db.execute("SELECT onset, measure, beat FROM events WHERE kind='chord' ORDER BY ordinal").fetchall(),
                         [(70, 18, 3), (71, 18, 4), (72, 19, 1)])


    def test_music21_beats_in_compound_meters(self):
        """Wikifonia counts a 12/8 bar in 4 dotted-quarter beats: beat 3 is beat 7 of 12."""
        events = choco_positions([(1.1, 2.0, "Ab:maj"), (1.3, 2.0, "F:min"), (2.1, 4.0, "Bb:min7")])
        track = Track(id="t", title="T", artist="", composers="", genre="", corpus="Wikifonia",
                      collection="wikifonia", license="", chords=events,
                      keys=choco_positions([(1.1, 0, "Ab:major")]), meters=choco_positions([(1.1, 8.0, "12/8")]),
                      beats=MUSIC21_BEATS, lengths=MUSIC21_BEATS)
        db = sqlite3.connect(":memory:")
        create_schema(db)
        add_track(db, track, Counter())
        self.assertEqual(db.execute("SELECT onset, duration, measure, beat FROM events WHERE kind='chord' ORDER BY ordinal").fetchall(),
                         [(0, 3, 1, 1), (3, 3, 1, 7), (6, 6, 2, 1)])


    def test_each_song_counts_its_own_way(self):
        """A When in Rome 3/8 song written in eighths (beats 1, 2, 3) is read in eighths, one in
        dotted quarters (beat 1.67 is two thirds into the bar) in music21's beats."""
        eighths = [(1.1, 0.5, "C:maj"), (1.2, 0.5, "F:maj"), (1.3, 0.5, "G:maj"), (2.1, 1.5, "C:maj")]
        dotted = [(1.1, 1.0, "C:maj"), (1.1666667, 0.5, "F:maj"), (2.1, 1.5, "C:maj")]
        self.assertEqual(song_counting(eighths, [(1, "3/8")], MUSIC21_LONG_BEATS, QUARTERS)[0], MUSIC21_LONG_BEATS)
        self.assertEqual(song_counting(dotted, [(1, "3/8")], MUSIC21_LONG_BEATS, QUARTERS)[0], MUSIC21_BEATS)
        self.assertEqual(song_counting(eighths, [(1, "4/4")], MUSIC21_BEATS, MUSIC21_BEATS), (MUSIC21_BEATS, MUSIC21_BEATS))


    def test_jazz_corpus_chords_are_laid_end_to_end(self):
        """ChoCo writes Jazz Corpus chords where they end, a bar early: C (8 beats) at 2.1, D7 at 4.1."""
        written = choco_positions([(2.1, 8.0, "C:maj"), (4.1, 8.0, "D:7"), (5.1, 4.0, "D:min7"), (7.3, 2.0, "D:min7")])
        self.assertEqual([position for position, _, _ in laid_end_to_end(written, [(1, "4/4")])],
                         [(1, 1.0), (3, 1.0), (5, 1.0), (6, 1.0)])
        # In 3/4 (BiaB): A- for two bars, then G
        self.assertEqual([p for p, _, _ in laid_end_to_end(choco_positions([(1.1, 6.0, "A:min"), (3.2, 6.0, "G:maj")]), [(1, "3/4")])],
                         [(1, 1.0), (3, 1.0)])

    def test_real_book_waltz_in_three(self):
        """Real Book bars are laid out in four beats: a waltz bar of 2 + 2 becomes 1.5 + 1.5 of 3."""
        bars = choco_positions([(1.1, 4.0, "F:maj"), (2.1, 2.0, "G:min7"), (2.3, 2.0, "C:7")])
        self.assertEqual(in_three(bars), [((1, 1.0), 3.0, "F:maj"), ((2, 1.0), 1.5, "G:min7"), ((2, 2.5), 1.5, "C:7")])

    def test_grace_chords(self):
        """A chord of no length with another at the same place is dropped; a real chord is kept."""
        chords = choco_positions([(9.15, 0.0, "C:maj"), (9.15, 0.5, "E:min"), (9.2, 0.5, "E:min")])
        self.assertTrue(superseded(chords[0], chords[1:2]))
        self.assertFalse(superseded(chords[1], chords[2:3]))
        self.assertFalse(superseded(chords[2], []))


if __name__ == "__main__":
    unittest.main()
