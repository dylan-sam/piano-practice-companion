"""Write tracks from any source into the SQLite catalog, in one notation.

Every source adapter (import_choco.py, ireal_playlist.py) yields Track
objects; add_track writes them. Chords are stored in canonical Harte
notation (chord_notation.canonical_harte), keys as tonic:major/minor, meters
as "4/4", so the rest of the app never needs to know where a song came
from. Roman numerals are not stored: chord_notation.roman_rows computes them
from the chord and key events when a script needs them.
finish_catalog then settles uncertain key modes and adds the indexes.
"""

import json
import sqlite3
from collections import Counter
from dataclasses import dataclass, field

from chord_notation import NO_CHORD, NotationError, canonical_harte, canonical_key, note_pc
from key_modes import MINOR_TONICS, PARALLEL, WITH_RELATIVE, settle_key
from score_search import song_key
from score_timing import FIRST_BEAT, METER_BEATS, QUARTERS, BarGrid, parse_time_signature


# Collections whose annotated mode cannot be trusted, checked against iReal Pro:
# which annotated modes are doubtful ("any": only a tonic is given; "major":
# many minor tunes are marked major), the readings and the threshold to use.
UNCERTAIN_MODES = {
    "biab-internet-corpus": ("any", PARALLEL, 0.75),
    "rock-corpus": ("any", PARALLEL, 0.75),
    "real-book": ("major", PARALLEL, 0.75),
    "wikifonia": ("major", WITH_RELATIVE, 0.6),  # keys come from key signatures
}


@dataclass
class Track:
    """One song version as a source adapter delivers it.

    Events are ((measure, beat), duration, value): the bar number, the beat in
    the bar in the meter's own unit, and the length in those beats. `first_beat`
    is the number the source gives the downbeat (ChoCo 1, iReal and Schubert
    Winterreise 0). `beats` and `lengths` say how the source counts beats and lengths
    (score_timing: METER_BEATS, MUSIC21_BEATS or QUARTERS). add_track stores the positions as score_timing describes:
    bar, beat counted from 1, and onset and duration in quarter notes.
    Chords may use any Harte spelling; add_track stores the canonical one.
    """

    id: str
    title: str
    artist: str
    composers: str
    genre: str
    corpus: str
    collection: str
    license: str
    chords: list
    keys: list
    meters: list = field(default_factory=list)
    segments: list = field(default_factory=list)
    media_type: str = "score"
    duration: float | None = None
    metadata: dict = field(default_factory=dict)
    first_beat: int = FIRST_BEAT
    beats: str = METER_BEATS
    lengths: str = METER_BEATS


def create_schema(db):
    """Create the track, event, and catalog metadata tables."""
    db.executescript("""
        PRAGMA journal_mode = OFF;
        PRAGMA synchronous = OFF;
        CREATE TABLE catalog_info (name TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE tracks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            composers TEXT NOT NULL,
            genre TEXT NOT NULL,
            corpus TEXT NOT NULL,
            media_type TEXT NOT NULL CHECK (media_type IN ('audio', 'score')),
            duration REAL,
            license TEXT NOT NULL,
            metadata_json TEXT NOT NULL
        );
        CREATE TABLE events (
            track_id TEXT NOT NULL REFERENCES tracks(id),
            kind TEXT NOT NULL CHECK (kind IN ('chord', 'key', 'segment', 'timesig')),
            ordinal INTEGER NOT NULL,
            onset REAL NOT NULL,     -- quarter notes from the start of bar 1
            duration REAL,           -- quarter notes
            value TEXT NOT NULL,
            measure INTEGER NOT NULL,  -- bar number (0 for a pickup)
            beat REAL NOT NULL,        -- beat in the bar, from 1, in the meter's unit
            PRIMARY KEY (track_id, kind, ordinal)
        ) WITHOUT ROWID;
    """)


def open_catalog(path):
    """Create an empty catalog file, replacing any previous one."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    db = sqlite3.connect(path)
    create_schema(db)
    return db


def canonical_chord(value, counts):
    """Canonical Harte for one source chord; an unreadable one is stored as X (unknown)."""
    try:
        return canonical_harte(str(value))
    except NotationError:
        counts["unreadable_chords"] += 1
        return "X"


def canonical_meter(value):
    """Write a meter as numerator/denominator (4/4) from any ChoCo spelling."""
    numerator, denominator = parse_time_signature(value)
    return f"{numerator}/{denominator}"


def position_key(position):
    """A (measure, beat) position rounded so that equal positions compare equal (beats from 1)."""
    measure, beat = position
    return measure, round(beat, 4)


def _timed(events, grid, track):
    """Turn ((measure, beat), duration, value) source events into catalog rows.

    Rows are (onset, duration, value, measure, beat): onset and duration in quarter
    notes, the beat counted from FIRST_BEAT in the meter's unit, whatever the track's counting. A beat outside its bar (ChoCo writes the
    last beat of some BiaB bars as beat 0 of the next) is moved to the bar it falls in.
    """
    rows = []
    for (measure, beat), duration, value in events:
        onset = grid.quarters(measure, beat + FIRST_BEAT - track.first_beat, track.beats)
        if duration is None:
            length = None
        elif track.lengths == QUARTERS:
            length = duration
        else:  # lengths in beats: counted bar by bar, as a length may cross a meter change
            length = grid.length_quarters(measure, beat + FIRST_BEAT - track.first_beat, duration, track.lengths)
        rows.append((round(onset, 6), length, value, *grid.locate(onset)))
    return rows


def add_track(db, track, counts):
    """Write one track and its events in canonical notation, with bar, beat and quarter positions."""
    meters = [((measure, beat), duration, canonical_meter(value))
              for (measure, beat), duration, value in track.meters]
    grid = BarGrid([(measure, value) for (measure, _), _, value in meters])
    chords = [(position, duration, canonical_chord(value, counts)) for position, duration, value in track.chords]
    keys = [(position, duration, canonical_key(value)) for position, duration, value in track.keys]
    db.execute(
        "INSERT INTO tracks VALUES (?,?,?,?,?,?,?,?,?,?)",
        (track.id, track.title.strip(), track.artist.strip(), track.composers.strip(), track.genre.strip(),
         track.corpus, track.media_type, track.duration, track.license,
         json.dumps({**track.metadata, "collection": track.collection}, ensure_ascii=False)),
    )
    streams = {
        "chord": _timed(chords, grid, track),
        "key": sorted(_timed(keys, grid, track), key=lambda row: row[0]),
        "timesig": _timed(meters, grid, track),
        "segment": _timed(track.segments, grid, track),
    }
    for kind, rows in streams.items():
        db.executemany("INSERT INTO events VALUES (?,?,?,?,?,?,?,?)",
                       [(track.id, kind, index, *row) for index, row in enumerate(rows)])
        counts[kind + "_events"] += len(rows)
    counts["tracks"] += 1
    counts[track.collection] += 1


# ---------- Key modes ----------

def _mode_is_trusted(collection, key):
    """Tell whether a collection's annotated mode can be used as it is."""
    doubt = UNCERTAIN_MODES.get(collection)
    return doubt is None or (doubt[0] == "major" and key.endswith(":minor"))


def _tonic_pc(key):
    """Pitch class of a key's tonic, e.g. Bb:minor -> 10."""
    return note_pc(key.split(":", 1)[0])


def _root_and_quality(chords):
    """Turn (ordinal, onset, Harte chord, duration) rows into (root pitch class, quality, duration)."""
    out = []
    for _, _, value, duration in chords:
        if value not in NO_CHORD:
            root, _, quality = value.partition(":")
            out.append((note_pc(root), quality.split("/", 1)[0], duration))
    return out


def settle_modes(db):
    """Settle uncertain key modes; return how each was decided.

    A key part keeps its annotation when the collection's mode is trusted.
    Otherwise the song's main (first) key takes the mode of another version of
    the song with a trusted mode and the same tonic; failing that, every part
    takes the key its chords show (key_modes.settle_key), which may move the
    tonic to the relative minor.
    A mode that cannot be decided is removed, leaving only the tonic ("C").
    """
    tracks = {tid: (song_key(title), json.loads(meta)["collection"])
              for tid, title, meta in db.execute("SELECT id,title,metadata_json FROM tracks")}
    keys = {}
    for tid, ordinal, onset, value in db.execute(
            "SELECT track_id,ordinal,onset,value FROM events WHERE kind='key' ORDER BY track_id,onset,ordinal"):
        keys.setdefault(tid, []).append((ordinal, onset, value))
    trusted = {}
    for tid, parts in keys.items():
        song, collection = tracks[tid]
        if _mode_is_trusted(collection, parts[0][2]) and ":" in parts[0][2]:
            trusted.setdefault((song, _tonic_pc(parts[0][2])), parts[0][2].split(":", 1)[1])
    decided = Counter()
    for tid, parts in keys.items():
        song, collection = tracks[tid]
        if all(_mode_is_trusted(collection, value) for _, _, value in parts):
            decided["annotated"] += len(parts)
            continue
        _, readings, threshold = UNCERTAIN_MODES[collection]
        chords = db.execute("SELECT ordinal,onset,value,duration FROM events WHERE track_id=? "
                            "AND kind='chord' ORDER BY ordinal", (tid,)).fetchall()
        for index, (ordinal, onset, value) in enumerate(parts):
            if _mode_is_trusted(collection, value):
                decided["annotated"] += 1
                continue
            tonic_pc = _tonic_pc(value)
            end = parts[index + 1][1] if index + 1 < len(parts) else float("inf")
            part = [chord for chord in chords if onset <= chord[1] < end]
            other = trusted.get((song, tonic_pc)) if index == 0 else None
            if other:
                key, how = (tonic_pc, other), "other version"
            else:
                key, how = settle_key(_root_and_quality(part), tonic_pc, readings, threshold), "chords"
            if key is None:
                decided["unknown"] += 1
                new_value = value.split(":", 1)[0]
            else:
                decided[how if key[0] == tonic_pc else "relative minor"] += 1
                tonic = value.split(":", 1)[0] if key[0] == tonic_pc else MINOR_TONICS[key[0]]
                new_value = f"{tonic}:{key[1]}"
            db.execute("UPDATE events SET value=? WHERE track_id=? AND kind='key' AND ordinal=?",
                       (new_value, tid, ordinal))
    return decided


def finish_catalog(db, info, counts):
    """Settle key modes, add the indexes and the catalog description, and commit."""
    counts.update({f"key_mode_{how}": n for how, n in settle_modes(db).items()})
    db.executescript("""
        CREATE INDEX tracks_title_idx ON tracks(title);
        CREATE INDEX tracks_corpus_idx ON tracks(corpus);
        CREATE INDEX events_kind_value_idx ON events(kind, value);
        CREATE INDEX events_track_idx ON events(track_id, kind, onset);
    """)
    db.executemany("INSERT INTO catalog_info VALUES (?,?)", list(info.items()) + [
        ("timing", "onset and duration in quarter notes from the start of bar 1; measure is the bar "
                   "number and beat the beat in it, from 1, in the meter's unit (score_timing.py)"),
        ("chord notation", "canonical Harte, see docs/CHORD_NOTATION.md; X marks an unreadable source chord"),
        ("key modes", "uncertain modes taken from another version of the song or from the tonic chords; "
                      "a key without mode (e.g. 'C') could not be decided"),
        ("romanization", "not stored: computed from chord and key events (chord_notation.roman_rows); uppercase "
                         "degrees on the tonic major-scale grid; first key applies to leading pickup chords"),
    ])
    db.commit()
