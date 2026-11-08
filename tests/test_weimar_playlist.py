"""Check the conversion of Weimar Jazz Database solos into Studio lead sheets."""

import os
import sqlite3
import tempfile
import unittest

from weimar_playlist import build_playlist, chart_chord, read_key


def database(path):
    """A two-bar solo in the Weimar schema: a pickup beat, then a bar of swing eighths."""
    db = sqlite3.connect(path)
    db.executescript("""
        create table solo_info (melid, performer, title, instrument, key, avgtempo, rhythmfeel);
        create table melody (melid, onset, pitch, duration, bar, beat, tatum, division, beatdur);
        create table beats (melid, onset, bar, beat, chord, form);
    """)
    db.execute("insert into solo_info values (1, 'Art Pepper', 'Test', 'as', 'Bb-maj', 200.0, 'SWING')")
    beats = [(1, 0.0, 0, 4, "", ""), (1, 0.3, 1, 1, "Bbj7", "A1"), (1, 0.6, 1, 2, "", ""),
             (1, 0.9, 1, 3, "G79b", ""), (1, 1.2, 1, 4, "", "")]
    db.executemany("insert into beats values (?, ?, ?, ?, ?, ?)", beats)
    notes = [
        (1, 0.0, 65.0, 0.29, 0, 4, 1, 1, 0.3),  # the pickup, a quarter on beat 4
        (1, 0.3, 70.0, 0.14, 1, 1, 1, 2, 0.3),  # an eighth on the downbeat...
        (1, 0.45, 72.0, 0.2, 1, 1, 2, 2, 0.3),  # ...and one on the "and" ending just before the next: held to it
        (1, 0.6, 74.0, 0.1, 1, 2, 2, 3, 0.3),  # the second note of a triplet
        (1, 0.9, 75.0, 0.6, 1, 3, 1, 1, 0.3),  # a half note to the end
    ]
    db.executemany("insert into melody values (?, ?, ?, ?, ?, ?, ?, ?, ?)", notes)
    db.commit()
    db.close()


class ChordTests(unittest.TestCase):
    """Weimar chord symbols become chart symbols."""

    def test_qualities_and_tensions(self):
        self.assertEqual(chart_chord("Bbj7"), "Bb^7")
        self.assertEqual(chart_chord("Am7b5"), "Ah7")
        self.assertEqual(chart_chord("D79b"), "D7b9")
        self.assertEqual(chart_chord("C-79"), "C-9")
        self.assertEqual(chart_chord("G7alt"), "G7alt")
        self.assertEqual(chart_chord("F+j7"), "F^7#5")
        self.assertEqual(chart_chord("Eb7/G"), "Eb7/G")
        self.assertIsNone(chart_chord("NC"))

    def test_keys(self):
        self.assertEqual(read_key("Bb-maj"), (10, False))
        self.assertEqual(read_key("C-min"), (0, True))
        self.assertEqual(read_key(""), (0, False))


class SoloTests(unittest.TestCase):
    """A solo becomes one chart with its melody."""

    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.dir.name, "wjazzd.db")
        database(self.path)

    def tearDown(self):
        self.dir.cleanup()

    def test_chart(self):
        playlist, skipped = build_playlist(self.path)
        self.assertEqual(skipped, [])
        self.assertEqual(playlist["format"], "ear-training-studio-playlists")
        chart = playlist["playlists"][0]["charts"][0]
        self.assertEqual((chart["title"], chart["composer"], chart["style"], chart["key"], chart["bpm"]),
                         ("Test", "Art Pepper solo", "swing", 10, 200))
        # The pickup bar is a whole 4/4 bar, with no chord before the first change
        self.assertEqual(chart["time"], [4, 4])
        self.assertEqual(chart["bars"][0]["chords"], [{"symbol": None, "beats": 4}])
        self.assertEqual(chart["bars"][1]["chords"], [{"symbol": "Bb^7", "beats": 2}, {"symbol": "G7b9", "beats": 2}])
        self.assertEqual(chart["bars"][1]["section"], "A")
        notes = [(n["bar"], round(n["at"], 3), round(n["beats"], 3), n["pitch"]) for n in chart["melody"]["notes"]]
        self.assertEqual(notes, [(0, 3.0, 1.0, 65), (1, 0.0, 0.5, 70), (1, 0.5, 0.833, 72),
                                 (1, 1.333, 0.333, 74), (1, 2.0, 2.0, 75)])
        self.assertEqual(chart["melody"]["program"], 65)


if __name__ == "__main__":
    unittest.main()
