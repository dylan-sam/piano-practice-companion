import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from find_progressions import (attach_songs, chord_signature, match_passages_in_key_part,
                               matches_in_key_part, pattern_runs, split_at_keys)


class ProgressionSearchTests(unittest.TestCase):
    """Check progression matching in ChoCo Roman numeral events."""

    def test_colors_and_unequal_durations_do_not_block_match(self):
        """Allow quality extensions and ignore chord duration differences."""
        pattern = [pattern_runs(["II:min", "V:maj", "I:maj"])]
        events = [(0, 1.1, "II:min9"), (1, 2.1, "V:7"), (2, 2.3, "I:maj7")]
        self.assertEqual(list(matches_in_key_part(events, pattern)), [(0, 0, 1.1)])

    def test_augmented_and_diminished_do_not_match(self):
        """Exclude altered triads from major and minor progression matches."""
        pattern = [pattern_runs(["I:maj", "IV:maj", "V:maj"])]
        self.assertEqual(list(matches_in_key_part([(0, 1.1, "I:maj"), (1, 2.1, "IV:aug"),
                                                   (2, 3.1, "V:maj")], pattern)), [])
        self.assertIsNone(chord_signature("IV:dim7"))

    def test_explicit_seventh_and_repeated_step(self):
        """Require a seventh and enough events for repeated pattern steps."""
        pattern = [pattern_runs(["I:maj", "IV:maj", "IV:maj", "V:maj"])]
        events = [(0, 1.1, "I:maj"), (1, 2.1, "IV:maj"), (2, 3.1, "IV:maj7"), (3, 4.1, "V:7")]
        self.assertEqual(list(matches_in_key_part(events, pattern)), [(0, 0, 1.1)])
        seventh = [pattern_runs(["II:min", "IIb:7", "I:maj"])]
        self.assertEqual(list(matches_in_key_part([(0, 1.1, "II:min"), (1, 2.1, "IIb:maj7"),
                                                   (2, 3.1, "I:maj")], seventh)), [])

    def test_key_boundary_splits_progression(self):
        """Prevent a progression from spanning two annotated key parts."""
        events = [(0, 1.1, "II:min"), (1, 2.1, "V:7"), (2, 3.1, "I:maj")]
        parts = list(split_at_keys(events, [(1.1, "C:major"), (3.1, "G:major")]))
        self.assertEqual([len(part) for _, part in parts], [2, 1])
        pattern = [pattern_runs(["II:min", "V:maj", "I:maj"])]
        self.assertFalse(any(list(matches_in_key_part(part, pattern)) for _, part in parts))

    def test_passage_end_includes_the_last_repeated_chord(self):
        """Record the full exclusive ordinal boundary of a matched run."""
        events = [(0, 1.1, "I:maj"), (1, 2.1, "IV:maj"),
                  (2, 2.3, "IV:maj7"), (3, 3.1, "V:7")]
        patterns = [pattern_runs(["I:maj", "IV:maj", "IV:maj", "V:maj"])]
        self.assertEqual(list(match_passages_in_key_part(events, patterns)),
                         [(0, 0, 1.1, 4, 3.1)])

    def test_catalog_passage_ends_at_key_change(self):
        """Store exclusive ordinal ends and clip a long chord at the next key."""
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "test.sqlite"
            with closing(sqlite3.connect(database)) as db:
                db.execute("CREATE TABLE tracks (id TEXT, title TEXT, artist TEXT, composers TEXT, corpus TEXT, media_type TEXT)")
                db.execute("CREATE TABLE events (track_id TEXT, kind TEXT, ordinal INT, onset REAL, duration REAL, value TEXT, measure INT, beat REAL)")
                db.execute("INSERT INTO tracks VALUES ('song','Song','','','Test','score')")
                # (kind, ordinal, onset and duration in quarters, value, measure, beat)
                db.executemany("INSERT INTO events VALUES ('song',?,?,?,?,?,?,?)", [
                    ("key", 0, 0, 0, "C:major", 1, 1),
                    ("key", 1, 12, 0, "G:major", 4, 1),
                    ("timesig", 0, 0, 0, "4/4", 1, 1),
                    ("chord", 0, 0, 4, "C:maj", 1, 1),
                    ("chord", 1, 4, 4, "F:maj", 2, 1),
                    ("chord", 2, 8, 8, "G:7", 3, 1),
                    ("chord", 3, 12, 4, "G:maj", 4, 1),
                ])
                db.commit()
            result = attach_songs(database, [{
                "id": "test", "chords": ["I:maj", "IV:maj", "V:maj"],
            }])
            passage = result[0]["songs"][0]["passages"][0]
            self.assertEqual((passage["start_ordinal"], passage["end_ordinal_exclusive"]), (0, 3))
            self.assertEqual(passage["end_quarter"], 12)  # G7 is cut where the G major key starts (bar 4)
            self.assertEqual((passage["start_measure"], passage["start_beat"], passage["start_quarter"]), (1, 1, 0))

    def test_versions_of_one_song_count_once(self):
        """Count a title found in several corpora as one song for ranking."""
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "test.sqlite"
            with closing(sqlite3.connect(database)) as db:
                db.execute("CREATE TABLE tracks (id TEXT, title TEXT, artist TEXT, composers TEXT, corpus TEXT, media_type TEXT)")
                db.execute("CREATE TABLE events (track_id TEXT, kind TEXT, ordinal INT, onset REAL, duration REAL, value TEXT, measure INT, beat REAL)")
                for track_id, title in (("ireal", "Take The 'A' Train"), ("rb", "TAKE THE A TRAIN"),
                                        ("other", "Another Song")):
                    db.execute("INSERT INTO tracks VALUES (?,?,'','','Test','score')", (track_id, title))
                    db.executemany("INSERT INTO events VALUES (?,?,?,?,?,?,?,?)", [
                        (track_id, "key", 0, 0, 0, "C:major", 1, 1),
                        (track_id, "chord", 0, 0, 4, "D:min", 1, 1),
                        (track_id, "chord", 1, 4, 4, "G:7", 2, 1),
                        (track_id, "chord", 2, 8, 4, "C:maj", 3, 1),
                    ])
                db.commit()
            result = attach_songs(database, [
                {"id": "rare", "chords": ["I:maj", "IV:maj"]},
                {"id": "two-five-one", "chords": ["II:min", "V:maj", "I:maj"]},
            ])
            self.assertEqual(result[0]["id"], "two-five-one")
            self.assertEqual((result[0]["song_count"], result[0]["unique_song_count"]), (3, 2))


if __name__ == "__main__":
    unittest.main()
