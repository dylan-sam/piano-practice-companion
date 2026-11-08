"""Verify catalog score conversion for the integrated Studio player."""

import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from studio_bridge import key_fields, choco_chart, studio_chord, studio_style


class StudioBridgeTests(unittest.TestCase):
    """Cover chord spelling, meter changes, gaps, and key markers."""

    def test_harte_chords_keep_inversions_and_color(self):
        """Map Harte extensions and relative slash intervals to playable symbols."""
        self.assertEqual(studio_chord("G:(3,5,b7,b9)"), "G7b9")
        self.assertEqual(studio_chord("Eb:min/3"), "Eb-/G")
        self.assertEqual(studio_chord("C:maj9"), "C^9")
        self.assertEqual(studio_chord("C:7(*3,4)"), "C7sus")
        self.assertEqual(studio_chord("C:7(b13)"), "C7b13")
        self.assertIsNone(studio_chord("N"))

    def test_styles_choose_project_presets(self):
        """Use this project's categories for source genre tags."""
        self.assertEqual(studio_style("Bossa Nova"), "bossa-nova")
        self.assertEqual(studio_style("Rock"), "straight pop/rock")
        self.assertEqual(studio_style("Unknown"), "ballad")

    def test_score_becomes_timed_editable_chart(self):
        """Keep a mid-bar change, meter change, key marker, and silent gap."""
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "score.sqlite"
            with closing(sqlite3.connect(database)) as connection:
                connection.executescript("""
                    CREATE TABLE tracks (id TEXT, title TEXT, composers TEXT,
                                         artist TEXT, genre TEXT, media_type TEXT);
                    CREATE TABLE events (track_id TEXT, kind TEXT, ordinal INTEGER,
                                         onset REAL, duration REAL, value TEXT,
                                         measure INTEGER, beat REAL);
                """)
                connection.execute("INSERT INTO tracks VALUES (?,?,?,?,?,?)",
                                   ("one", "Example", "Writer", "", "Jazz", "score"))
                # (kind, ordinal, onset and duration in quarters, value, measure, beat)
                events = [
                    ("key", 0, 0, 0, "C:major", 1, 1),
                    ("timesig", 0, 0, 0, "4/4", 1, 1),
                    ("chord", 0, 0, 2, "C:maj", 1, 1),
                    ("chord", 1, 2, 2, "G:7", 1, 3),
                    ("key", 1, 4, 0, "F:major", 2, 1),
                    ("timesig", 1, 4, 0, "3/4", 2, 1),
                    ("chord", 2, 4, 2, "F:maj", 2, 1),
                ]
                connection.executemany(
                    "INSERT INTO events VALUES ('one',?,?,?,?,?,?,?)", events)
                connection.commit()
            chart = choco_chart(database, "one")
        self.assertEqual((chart["title"], chart["style"], chart["key"]),
                         ("Example", "swing", 0))
        self.assertEqual(chart["bars"][0]["chords"],
                         [{"symbol": "C", "beats": 2.0},
                          {"symbol": "G7", "beats": 2.0}])
        self.assertEqual(chart["bars"][1]["time"], [3, 4])
        self.assertEqual(chart["bars"][1]["comment"], "Key: F:major")
        self.assertEqual(chart["bars"][1]["keys"], [{"beats": 0.0, "key": 5, "minor": False}])
        self.assertEqual(chart["bars"][1]["chords"],
                         [{"symbol": "F", "beats": 2.0}])


    def test_key_fields_keep_an_unknown_mode(self):
        """Read major, minor, and a key whose mode could not be decided."""
        self.assertEqual(key_fields("Bb:minor"), (10, True))
        self.assertEqual(key_fields("D:major"), (2, False))
        self.assertEqual(key_fields("C"), (0, None))

if __name__ == "__main__":
    unittest.main()
