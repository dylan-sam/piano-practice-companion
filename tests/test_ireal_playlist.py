"""Check the iReal chart layout and the curation of forum charts."""

import sqlite3
import unittest
from collections import Counter

from ireal_playlist import RawSong, bar_beats, chart_bars, curation_reason, song_track
from track_store import Track, add_track, create_schema


def chart(title, bars, chords=("C:maj", "F:maj")):
    """A minimal iReal track with the given number of bars."""
    events = [((bar + 1, 1), 4.0, chords[bar % len(chords)]) for bar in range(bars)]
    return Track(id="t", title=title, artist="", composers="", genre="", corpus="iReal Pro forum",
                 collection="ireal-pro-forum", license="", chords=events, keys=[((1, 1), 4.0 * bars, "C:major")],
                 metadata={"bars": bars})


class LayoutTests(unittest.TestCase):
    """Chart text is laid out in playing order."""

    def test_custom_quality_and_repeat_counts(self):
        """G*m7* keeps its quality; a repeat count outside a repeat is ignored, not read as x."""
        self.assertEqual(chords(chart_bars("{Db*min7*XyQ|Ab7XyQ}")), ["Db-7", "Ab7", "Db-7", "Ab7"])
        self.assertEqual(chords(chart_bars("C7XyQ <4x>|F7|")), ["C7", "F7"])


def chords(bars):
    """The chords of laid-out bars, one string per bar."""
    return [" ".join(chord for chord, _ in bar) for bar in bars]


def lengths(chart, meter=4):
    """The beats of each chord, bar by bar, of a chart string."""
    return [bar_beats([cells for _, cells in bar], meter) for bar in chart_bars(chart)]


class CellTests(unittest.TestCase):
    """A chord lasts as long as the cells it fills (docs/CHORD_NOTATION.md)."""

    def test_cells(self):
        """A chord fills its cell and the empty cells after it; a comma adds no cell, XyQ adds three."""
        self.assertEqual(chart_bars("F Abo,G-7 |"), [[("F", 2), ("Abo", 1), ("G-7", 2)]])
        self.assertEqual(chart_bars("C^7XyQ|"), [[("C^7", 4)]])
        self.assertEqual(chart_bars("  C D |"), [[("C", 2), ("D", 2)]])  # leading blanks are skipped
        self.assertEqual(chart_bars("C<Fine> D |"), [[("C", 2), ("D", 2)]])  # a comment takes no cell

    def test_three_chords_in_four_four(self):
        """The cells place the chords; packed or evenly spaced chords are 2+1+1."""
        self.assertEqual(lengths("F Abo,G-7 |"), [[2, 1, 1]])
        self.assertEqual(lengths("F,Abo  G-7|"), [[1, 2, 1]])
        self.assertEqual(lengths("F,Abo G-7 |"), [[1, 1, 2]])  # closest whole beats to 0, 0.8, 2.4
        self.assertEqual(lengths("F,Abo,G-7 |"), [[1, 1, 2]])
        self.assertEqual(lengths("F,Abo,G-7|"), [[2, 1, 1]])
        self.assertEqual(lengths("F Abo G-7 |"), [[2, 1, 1]])

    def test_slashes(self):
        """A slash holds the chord before it: an empty cell in a bar, the chord again at a bar's start."""
        self.assertEqual(lengths("F p Bb p D- p C|"), [[1, 1, 1, 1]])
        self.assertEqual(chords(chart_bars("C7 p p p |p p F7 |")), ["C7", "C7 F7"])

    def test_other_bars(self):
        """Two chords, 3/4, and more chords than beats."""
        self.assertEqual(lengths("D-7 G7 |C^7 XyQ|"), [[2, 2], [4]])
        self.assertEqual(lengths("C,D  |"), [[1, 3]])
        self.assertEqual(lengths("C D  |"), [[2, 2]])  # D starts 2/5 into the bar, 1.6 beats: closest to 2
        self.assertEqual(lengths("C,D|", 3), [[2, 1]])
        self.assertEqual(lengths("C,D,E,F,G|"), [[0.8] * 5])

    def test_positions(self):
        """Chords are placed at (bar, beats already played): F on 0, Abo on 2, G-7 on 3."""
        song = RawSong("T", "", "Jazz", "C", "T44F Abo,G-7 |C^7XyQZ")
        track, _ = song_track(song, "t", {"corpus": "c", "collection": "c", "license": "", "name": "n"})
        self.assertEqual(track.first_beat, 0)
        self.assertEqual([(position, length) for position, length, _ in track.chords],
                         [((1, 0), 2), ((1, 2), 1), ((1, 3), 1), ((2, 0), 4)])


def stored(chart_text):
    """Import an iReal chart into an empty catalog; return its (kind, onset, duration, measure, beat) rows."""
    song = RawSong("T", "", "Jazz", "C", chart_text)
    track, _ = song_track(song, "t", {"corpus": "c", "collection": "c", "license": "", "name": "n"})
    db = sqlite3.connect(":memory:")
    create_schema(db)
    add_track(db, track, Counter())
    return db.execute("SELECT kind, onset, duration, measure, beat FROM events ORDER BY kind, ordinal").fetchall()


class StoredPositionTests(unittest.TestCase):
    """Every source is stored at bar and beat, beats from 1, and in quarter notes from bar 1."""

    def test_beats_from_one(self):
        """F on bar 1 beat 1 (quarter 0), Abo on beat 3, G-7 on beat 4; the key and meter on 1.1."""
        self.assertEqual(stored("T44F Abo,G-7 |C^7XyQZ"), [
            ("chord", 0, 2, 1, 1), ("chord", 2, 1, 1, 3), ("chord", 3, 1, 1, 4), ("chord", 4, 4, 2, 1),
            ("key", 0, 8, 1, 1), ("timesig", 0, 8, 1, 1)])

    def test_twelve_eight_beat_ten(self):
        """A chord on beat 10 of a 12/8 bar stays there: eighths are half a quarter."""
        rows = stored("T12Eb XyQXyQ   Eb/Bb  |Eb XyQXyQXyQ  Z")
        self.assertEqual([row for row in rows if row[0] == "chord"], [
            ("chord", 0, 4.5, 1, 1), ("chord", 4.5, 1.5, 1, 10), ("chord", 6, 6, 2, 1)])


class CurationTests(unittest.TestCase):
    """Forum charts are left out for the documented reasons only."""

    settings = {"min_threads": 2, "keep": ["Minor Blues"]}

    def test_reasons(self):
        """Practice threads, placeholder titles, fragments, single chords and unpopular extra versions."""
        known = {"misty"}
        self.assertIn("practice", curation_reason(chart("Stella", 32), "Stella", {"forum/jazz/jazz practice exercises.csv"}, known, self.settings))
        self.assertIn("placeholder", curation_reason(chart("New Song", 32), "New Song", {"forum/x.csv"}, known, self.settings))
        self.assertIn("bars", curation_reason(chart("Medley", 2), "Medley", {"forum/x.csv"}, known, self.settings))
        self.assertIn("single", curation_reason(chart("Vamp", 16, ("C:7",)), "Vamp", {"forum/x.csv"}, known, self.settings))
        self.assertIn("already", curation_reason(chart("Misty", 32), "Misty", {"forum/x.csv"}, known, self.settings))

    def test_kept_charts(self):
        """Popular versions, songs new to the catalog, real 4-bar loops and the keep list stay."""
        known = {"misty"}
        self.assertIsNone(curation_reason(chart("Misty", 32), "Misty", {"forum/a.csv", "forum/b.csv"}, known, self.settings))
        self.assertIsNone(curation_reason(chart("Free Fallin", 4), "Free Fallin", {"forum/a.csv"}, known, self.settings))
        self.assertIsNone(curation_reason(chart("Minor Blues", 12), "Minor Blues", {"forum/a.csv"}, known, self.settings))
        self.assertIsNone(curation_reason(chart("Test Drive", 32), "Test Drive", {"forum/how deep is your love? - the bee gees.csv"}, known, self.settings))


if __name__ == "__main__":
    unittest.main()
