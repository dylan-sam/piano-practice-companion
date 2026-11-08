"""Test ChoCo score search and version ordering used by Studio."""

import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

import json

from score_search import (catalog_progressions, random_score_group, search_score_groups, search_scores, song_key,
                          tracks_with_progressions)


class ScoreSearchTests(unittest.TestCase):
    """Keep score search and version choice stable for Studio."""

    def test_search_and_score_metadata(self):
        """Search score titles and skip audio or untitled entries."""
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "sample.sqlite"
            with closing(sqlite3.connect(database)) as connection:
                with connection:
                    connection.execute("CREATE TABLE tracks (id TEXT, title TEXT, artist TEXT, composers TEXT, genre TEXT, corpus TEXT, media_type TEXT, duration REAL)")
                    connection.execute("CREATE TABLE events (track_id TEXT, kind TEXT, ordinal INT, onset REAL, value TEXT)")
                    connection.execute("INSERT INTO tracks VALUES ('score-1', 'Blue Song', 'A Band', '', '', 'test', 'score', 4)")
                    connection.execute("INSERT INTO tracks VALUES ('audio-1', 'Blue Song', 'A Band', '', '', 'test', 'audio', 4)")
                    connection.execute("INSERT INTO tracks VALUES ('blank-1', '', 'A Band', '', '', 'test', 'score', 4)")
                    connection.execute("INSERT INTO events VALUES ('score-1', 'key', 0, 1.1, 'Eb:major')")
                    connection.execute("INSERT INTO events VALUES ('score-1', 'chord', 0, 1.1, 'Eb:maj')")
            self.assertEqual([row[0] for row in search_scores(database, "blue")], ["score-1"])
            self.assertEqual([row[0] for row in search_scores(database)], ["score-1"])

    def test_song_versions_follow_source_genre_and_metadata_priority(self):
        """Group title variants and prefer iReal, genre sources, then completeness."""
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "versions.sqlite"
            tracks = (
                ("rb-blue", "Blue Bossa", "", "", "jazz", "Real Book", "score", 32),
                ("ireal-blue", "BLUEBOSSA", "", "", "", "iReal Pro", "score", None),
                ("wiki-blue", "blue bossa", "", "", "", "Wikifonia", "score", None),
                ("rb-jazz", "Jazz Tune", "", "", "jazz", "Real Book", "score", 32),
                ("wiki-jazz", "JazzTune", "A", "B", "jazz", "Wikifonia", "score", 32),
                ("rock", "Rock Tune", "A", "B", "rock", "A Corpus Study of Rock Music", "score", 32),
                ("wiki-rock", "RockTune", "A", "B", "", "Wikifonia", "score", 32),
                ("classical", "Classical Tune", "", "", "", "When in Rome", "score", 32),
                ("folk", "Folk Tune", "", "", "", "Nottingham Music Database", "score", 32),
                ("wiki-folk", "FolkTune", "A", "", "", "Wikifonia", "score", 32),
                ("biab-only", "Broad Tune", "", "", "", "BiaB Internet Corpus", "score", 32),
                ("wiki-broad", "BroadTune", "", "", "", "Wikifonia", "score", 32),
                ("rb-conflict", "Conflict", "", "", "jazz", "Real Book", "score", None),
                ("rock-conflict", "CONFLICT", "A", "B", "rock", "A Corpus Study of Rock Music", "score", 32),
            )
            with closing(sqlite3.connect(database)) as connection:
                with connection:
                    connection.execute("CREATE TABLE tracks (id TEXT, title TEXT, artist TEXT, composers TEXT, genre TEXT, corpus TEXT, media_type TEXT, duration REAL)")
                    connection.execute("CREATE TABLE events (track_id TEXT, kind TEXT, ordinal INT, onset REAL, value TEXT)")
                    connection.executemany("INSERT INTO tracks VALUES (?,?,?,?,?,?,?,?)", tracks)
                    for track_id, *_ in tracks:
                        connection.executemany("INSERT INTO events VALUES (?,?,?,?,?)", (
                            (track_id, "key", 0, 0, "C:major"),
                            (track_id, "chord", 0, 0, "C:maj"),
                            (track_id, "timesig", 0, 0, "4/4"),
                        ))
            groups = {group["title"].casefold().replace(" ", ""): group
                      for group in search_score_groups(database, limit=100)}
            self.assertEqual(groups["bluebossa"]["id"], "ireal-blue")
            self.assertEqual(len(groups["bluebossa"]["versions"]), 3)
            self.assertEqual(groups["jazztune"]["id"], "rb-jazz")
            self.assertEqual(groups["rocktune"]["id"], "rock")
            self.assertEqual(groups["classicaltune"]["id"], "classical")
            self.assertEqual(groups["folktune"]["id"], "folk")
            self.assertEqual(groups["broadtune"]["id"], "wiki-broad")
            self.assertEqual(groups["conflict"]["id"], "rock-conflict")
            self.assertEqual(search_score_groups(database, "blue bossa")[0]["id"], "ireal-blue")

    def test_song_key_merges_spelling_variants(self):
        """Ignore punctuation, bracketed notes and a leading article."""
        same = ("Over The Rainbow (Somewhere)", "OVER THE RAINBOW", "Over the Rainbow")
        self.assertEqual({song_key(title) for title in same}, {"overtherainbow"})
        self.assertEqual(song_key("My Romance [3/4]"), song_key("MY ROMANCE"))
        self.assertEqual(song_key("Hello, Dolly!"), song_key("Hello Dolly"))
        self.assertEqual(song_key("The Good Life"), song_key("* The Good Life"))
        self.assertNotEqual(song_key("Blue Bossa"), song_key("Blue Moon"))
        self.assertEqual(song_key("(Untitled)"), "untitled")

    def test_song_key_ignores_articles_and_version_suffixes(self):
        """Match iReal Pro's trailing articles and its version suffixes."""
        self.assertEqual(song_key("Foggy Day, A"), song_key("A Foggy Day"))
        self.assertEqual(song_key("Night In Tunisia, A"), song_key("A Night in Tunisia"))
        self.assertEqual(song_key("Girl From Ipanema, The"), song_key("The Girl From Ipanema"))
        self.assertEqual(song_key("Milestones-New"), song_key("Milestones"))
        self.assertEqual(song_key("I've Found A New Baby v2"), song_key("I've Found A New Baby"))
        self.assertNotEqual(song_key("Symphony No. 4"), song_key("Symphony No. 5"))
        self.assertEqual(song_key("Take The 'A' Train"), "taketheatrain")  # an inner "A" stays
        self.assertEqual(song_key("A"), "a")

    def test_progression_filter_keeps_matching_versions(self):
        """Keep songs whose versions contain all (or any) chosen progressions."""
        with tempfile.TemporaryDirectory() as directory:
            catalog = Path(directory) / "catalog.json"
            catalog.write_text(json.dumps([
                {"id": "p1", "label": "ii - V - I", "unique_song_count": 2,
                 "songs": [{"track_id": "a1"}, {"track_id": "b1"}]},
                {"id": "p2", "label": "I - IV - V", "unique_song_count": 1,
                 "songs": [{"track_id": "a1"}, {"track_id": "c1"}]},
            ]), encoding="utf-8")
            self.assertEqual(tracks_with_progressions(catalog, ["p1", "p2"]), {"a1"})
            self.assertEqual(tracks_with_progressions(catalog, ["p1", "p2"], match_all=False),
                             {"a1", "b1", "c1"})
            self.assertEqual([p["id"] for p in catalog_progressions(catalog)], ["p1", "p2"])
            with self.assertRaises(ValueError):
                tracks_with_progressions(catalog, ["missing"])

            database = Path(directory) / "scores.sqlite"
            with closing(sqlite3.connect(database)) as connection:
                with connection:
                    connection.execute("CREATE TABLE tracks (id TEXT, title TEXT, artist TEXT, composers TEXT, genre TEXT, corpus TEXT, media_type TEXT, duration REAL)")
                    connection.execute("CREATE TABLE events (track_id TEXT, kind TEXT, ordinal INT, onset REAL, value TEXT)")
                    for track_id, title, corpus in (("a1", "Song A", "Real Book"), ("a2", "SONG A", "iReal Pro"),
                                                    ("b1", "Song B", "Wikifonia")):
                        connection.execute("INSERT INTO tracks VALUES (?,?,'','','',?,'score',4)", (track_id, title, corpus))
                        connection.execute("INSERT INTO events VALUES (?,'key',0,1.1,'C:major')", (track_id,))
                        connection.execute("INSERT INTO events VALUES (?,'chord',0,1.1,'C:maj')", (track_id,))
            groups = search_score_groups(database, "song", track_ids={"a1"})
            self.assertEqual([(g["id"], [v["id"] for v in g["versions"]]) for g in groups],
                             [("a1", ["a1"])])
            self.assertEqual(len(search_score_groups(database, "song")), 2)
            self.assertEqual(random_score_group(database, catalog, "p1", lambda groups: groups[0])["id"], "a1")
            self.assertEqual(random_score_group(database, catalog, "p2", lambda groups: groups[0])["id"], "a1")


if __name__ == "__main__":
    unittest.main()
