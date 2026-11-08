"""Attach score entries containing each curated Roman-numeral progression."""

import itertools
import json
import sqlite3
from bisect import bisect_right
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
from typing import NamedTuple

from chord_notation import ROMAN_ROOT, NotationError, parse_harte, roman_rows
from common_progressions import build_catalog
from score_search import song_key


class ChordRun(NamedTuple):
    """Describe adjacent equivalent chords and their score boundaries."""

    signature: tuple | None
    count: int
    start_ordinal: int
    start_onset: float
    has_dominant_seventh: bool
    end_ordinal: int
    end_onset: float


@lru_cache(maxsize=None)
def chord_signature(value):
    """Return (degree, major/minor family, has dominant seventh) of a Roman chord, or None.

    The chord is read by chord_notation: a major third makes it major, a minor
    third minor. Chords without exactly one of them (sus, power chords, the
    root alone) and chords with an altered fifth (dim, aug, hdim, 7b5) match no
    pattern chord. Only a major chord with a minor seventh counts as dominant.
    """
    try:
        chord = parse_harte(value)
    except NotationError:
        return None
    if chord is None or not ROMAN_ROOT.fullmatch(chord.root):
        return None
    major, minor = chord.has("3"), chord.has("b3")
    if major == minor or chord.has("b5") or chord.has("#5"):
        return None
    family = "maj" if major else "min"
    return chord.root, family, family == "maj" and chord.has("b7")


def pattern_runs(chords):
    """Group repeated pattern chords into runs with minimum event counts."""
    runs = []
    for chord in chords:
        signature = chord_signature(chord)
        if signature is None:
            raise ValueError(f"Unsupported pattern chord: {chord}")
        if runs and runs[-1][0] == signature:
            runs[-1] = (signature, runs[-1][1] + 1)
        else:
            runs.append((signature, 1))
    return runs


def observed_runs(events):
    """Group adjacent observed chords by degree and major or minor quality."""
    runs = []
    for ordinal, onset, value in events:
        signature = chord_signature(value)
        if signature is None:
            runs.append(ChordRun(None, 1, ordinal, onset, False, ordinal, onset))
        elif runs and runs[-1].signature is not None and runs[-1].signature[:2] == signature[:2]:
            previous = runs[-1]
            runs[-1] = ChordRun(
                previous.signature, previous.count + 1,
                previous.start_ordinal, previous.start_onset,
                previous.has_dominant_seventh or signature[2], ordinal, onset,
            )
        else:
            runs.append(ChordRun(signature, 1, ordinal, onset, signature[2], ordinal, onset))
    return runs


def match_passages_in_key_part(events, patterns):
    """Find full start and end boundaries for matching runs in one key part."""
    runs = observed_runs(events)
    for pattern_index, pattern in enumerate(patterns):
        for start in range(len(runs) - len(pattern) + 1):
            window = runs[start:start + len(pattern)]
            if all(
                observed.signature is not None
                and observed.signature[:2] == wanted[:2]
                and observed.count >= minimum_count
                and (not wanted[2] or observed.has_dominant_seventh)
                for observed, (wanted, minimum_count) in zip(window, pattern)
            ):
                yield (pattern_index, window[0].start_ordinal, window[0].start_onset,
                       window[-1].end_ordinal + 1, window[-1].end_onset)


def matches_in_key_part(events, patterns):
    """Keep the original match summary API for callers needing only starts."""
    for pattern_index, start_ordinal, start_onset, _, _ in match_passages_in_key_part(events, patterns):
        yield pattern_index, start_ordinal, start_onset


def split_at_keys(events, keys):
    """Yield (key value, events) without ever carrying chords into the next key part."""
    key_index = 0
    part = []
    for event in events:
        while key_index + 1 < len(keys) and keys[key_index + 1][0] <= event[1]:
            if part:
                yield keys[key_index][1], part
                part = []
            key_index += 1
        part.append(event)
    if part:
        yield keys[key_index][1], part


def attach_songs(database, catalog):
    """Attach score matches by key part and rank entries by distinct song count."""
    patterns = [pattern_runs(entry["chords"]) for entry in catalog]
    for entry in catalog:
        entry["songs"] = []
    db = sqlite3.connect(database)
    try:
        tracks = {
            row[0]: dict(zip(("track_id", "title", "artist", "composers", "corpus"), row))
            for row in db.execute("SELECT id,title,artist,composers,corpus FROM tracks WHERE media_type='score'")
        }
        keys = defaultdict(list)
        for track_id, onset, value in db.execute("SELECT track_id,onset,value FROM events WHERE kind='key' ORDER BY track_id,onset,ordinal"):
            keys[track_id].append((onset, value))
        rows = db.execute("""
            SELECT track_id,ordinal,onset,duration,value,measure,beat
            FROM events WHERE kind='chord' ORDER BY track_id,ordinal
        """)
        for track_id, group in itertools.groupby(rows, key=lambda row: row[0]):
            if track_id not in tracks or not keys[track_id]:
                continue
            group = list(group)
            bar_beat = {row[1]: (row[5], row[6]) for row in group}  # ordinal -> (measure, beat)
            # Roman numerals are computed from the chords and the song's keys
            track_events = [(track_id, *row) for row in roman_rows([row[1:5] for row in group], keys[track_id])]
            events = [(ordinal, onset, value) for _, ordinal, onset, _, value in track_events]
            durations = {ordinal: duration for _, ordinal, _, duration, _ in track_events}
            key_onsets = [key_onset for key_onset, _ in keys[track_id]]
            found = {}
            for key_part_index, (key, part) in enumerate(split_at_keys(events, keys[track_id])):
                for pattern_index, ordinal, onset, end_ordinal, last_onset in match_passages_in_key_part(part, patterns):
                    last_duration = durations[end_ordinal - 1]
                    end_quarter = last_onset + (last_duration or 0)  # onsets and durations are quarters
                    next_key = bisect_right(key_onsets, last_onset)
                    if next_key < len(key_onsets):
                        end_quarter = min(end_quarter, key_onsets[next_key])
                    passage = {
                        "key_part_index": key_part_index,
                        "key": key,
                        "start_ordinal": ordinal,
                        "end_ordinal_exclusive": end_ordinal,
                        "start_measure": bar_beat[ordinal][0],
                        "start_beat": bar_beat[ordinal][1],
                        "start_quarter": onset,
                        "end_quarter": end_quarter,
                    }
                    if pattern_index not in found:
                        found[pattern_index] = {**tracks[track_id],
                                                "song_key": song_key(tracks[track_id]["title"]),
                                                "first_key": key,
                                                "first_measure": bar_beat[ordinal][0], "first_ordinal": ordinal,
                                                "matching_passages": 0, "passages": []}
                    found[pattern_index]["passages"].append(passage)
                    found[pattern_index]["matching_passages"] += 1
            for pattern_index, song in found.items():
                catalog[pattern_index]["songs"].append(song)
        for entry in catalog:
            entry["song_count"] = len(entry["songs"])
            # A song found in several corpora (iReal Pro, Real Book, ...) counts once.
            entry["unique_song_count"] = len({song["song_key"] for song in entry["songs"]})
        catalog.sort(key=lambda entry: (-entry["unique_song_count"], -entry["song_count"],
                                        entry["id"]))
    finally:
        db.close()
    return catalog


if __name__ == "__main__":
    output = Path("data/common_progressions.json")
    catalog = attach_songs(Path("data/progressions.sqlite"), build_catalog())
    output.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for entry in catalog:
        print(entry["id"], entry["unique_song_count"], entry["song_count"], entry["original"])
