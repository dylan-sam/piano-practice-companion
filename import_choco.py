"""Read the ChoCo v1.0.0 JAMS release as catalog tracks (a source for build_database.py).

Only licensed score tracks with chords and a key are read; the noncommercial
collections (casd, jaah, mozart-piano-sonatas) are left out. Collections
given in `skip` are left out too: the catalog reads iReal Pro charts from
their irealb:// links (ireal_playlist.py) instead of ChoCo's conversion.

Correction zips replace the chord stream of the tracks they contain when the
timing matches (keys, meters and timing are unchanged):

- choco-nottingham-bass-5fe168f.zip: Nottingham slash-chord basses lost their
  sharp (D/F# stored as D/F); built by build_nottingham_fix.py.

ChoCo writes a position as measure + beat / 10, beats counted from 1 (8.1 is
measure 8, beat 1), except the collections in BEAT_ZERO, which count from 0;
track_store.add_track moves them to 1. That number cannot write beats 10 and
above: beat 10 of bar 8 comes out as 9.0, beat 11 as 9.1. In bars that long, a
chord written where the chord before it would roll over in this way is put
back on its beat (choco_positions), from the length of the chord before it.

The collections ChoCo converted with music21 count beats as music21 does, by
groups of three in compound meters (a 12/8 bar has 4 beats, not 12), and When
in Rome gives lengths in quarter notes (COUNTING); add_track reads them so.
Where music21 could count a song either way (a 3/8 bar as one beat or three),
song_counting picks the reading under which its chords follow each other.
"""

import json
import zipfile
from pathlib import Path

from score_timing import (FIRST_BEAT, METER_BEATS, MUSIC21_BEATS, MUSIC21_LONG_BEATS, QUARTERS, BarGrid,
                          decode_measure_beat, is_compound, parse_time_signature)
from chord_notation import transpose_from_c
from track_store import Track, canonical_meter


NONCOMMERCIAL = {"casd", "mozart-piano-sonatas", "jaah"}
ANNOTATIONS = {
    "chord": "chord",
    "chord_harte": "chord",
    "key_mode": "key",
    "segment_open": "segment",
    "timesig": "timesig",
}
RELEASE_PREFIX = "v1.0.0/jams/"
# Collections whose chord positions ChoCo wrote wrongly but whose lengths are right: the chords
# are laid end to end again. The Jazz Corpus parser (harm_parser.process_multiline_annotation)
# places each chord where it ends, one bar early; the BiaB parser (biab_parser.process_biab_cpp)
# moves on by the meter's denominator instead of the bar length, so only 4/4 (and 2/2) is right.
POSITIONS_FROM_LENGTHS = {"jazz-corpus": lambda num, den: True, "biab-internet-corpus": lambda num, den: num != den}
# ChoCo gives each Real Book song the time signature of another song (parse_rbook joins its
# metadata table by an ID it generates anew). The Real Book files lay out every bar in four
# beats, so the songs are read in 4/4, except the twelve that ChoCo's table (partitions/real-book/
# raw, at commit 5fe168f) gives in 3/4, which are rescaled to three beats a bar.
REAL_BOOK_WALTZES = {
    "Belle Of The Ball", "We'll Never Know", "Blue Daniel", "Tara Lynne", "Beautiful Brown Eyes",
    "Take Me Out To The Ball Game", "Bless 'em All", "Wait Till You See Her", "Bomps-A-Daisy",
    "All Blues [3-4]", "The Flying Trapeze", "Mockingbird Hill",
}

# ChoCo writes out the repeats of the Nottingham tunes; for a few (Meggy's Foot, The Pinch of
# Snuff) it went on to 1,000-2,000 bars for tunes of a few dozen. Longer tunes are left out.
MAX_BARS = {"nottingham": 500}

# Collections whose onsets count beats from 0 (first chord at 1.0, not 1.1)
BEAT_ZERO = {"schubert-winterreise-score"}
# How collections converted with music21 count beats and lengths (score_timing): music21's
# beats group compound meters by three (two beats in 6/8, four in 12/8, one in 3/8), and When
# in Rome gives lengths in quarter notes and counts its 3/8 bars in eighths. The other collections count in the meter's unit.
# Measured on consecutive chords: the next chord starts where the length says (99 % or more).
COUNTING = {
    "nottingham": (MUSIC21_BEATS, MUSIC21_BEATS),
    "wikifonia": (MUSIC21_BEATS, MUSIC21_BEATS),
    "schubert-winterreise-score": (MUSIC21_BEATS, MUSIC21_BEATS),
    "when-in-rome": (MUSIC21_LONG_BEATS, QUARTERS),  # its 3/8 bars count eighths
}


def load_corrections(paths):
    """Read corrected chord annotations by track id from zips of JAMS files."""
    corrections = {}
    for path in paths:
        with zipfile.ZipFile(path) as archive:
            for name in archive.namelist():
                if name.endswith(".jams"):
                    item = json.loads(archive.read(name))
                    chords = next((a for a in item.get("annotations", [])
                                   if a.get("namespace") == "chord_harte"), None)
                    if chords is not None:
                        corrections[Path(name).stem] = chords
    return corrections


def corrected_chords(release, correction):
    """Use a corrected chord stream, keeping the release's annotation metadata.

    The correction must have the same number of chords at the same times;
    otherwise the release annotation is kept.
    """
    old, new = release.get("data", []), correction.get("data", [])
    if len(old) != len(new) or any(
            (a["time"], a.get("duration")) != (b["time"], b.get("duration")) for a, b in zip(old, new)):
        return release, False
    return {**release, "data": new}, True


def _events(annotation):
    """Turn a JAMS annotation into (onset, duration, value) events."""
    return [(event["time"], event.get("duration"), event["value"]) for event in annotation.get("data", [])]


def _bar_beats(meters, measure):
    """Beats in a bar from (measure, meter) changes in order; 4 before any change."""
    beats = 4
    for start, value in meters:
        if start <= measure:
            beats = parse_time_signature(value)[0]
    return beats


def choco_positions(events, meters=(), repair=False):
    """Turn ChoCo (measure.beat, duration, value) events into ((measure, beat), duration, value).

    With `repair` (chords), an event written where the event before it would roll over
    into the next bar (bar 8, beat 10 written 9.0) is put back on its beat, in bars of
    10 beats or more. `meters` are the song's (measure, meter) changes.
    """
    out, expected = [], None
    for position, duration, value in events:
        measure, beat = decode_measure_beat(position)
        if repair and expected is not None:
            bar, start = expected
            rolled = (bar + 1, round(start - 10, 6))
            if start >= 10 and start < _bar_beats(meters, bar) + 1 - 1e-6 and (measure, beat) == rolled:
                measure, beat = bar, start
        out.append(((measure, beat), duration, value))
        expected = (measure, round(beat + duration, 6)) if duration else None
    return out


def laid_end_to_end(chords, meters):
    """Place chords one after the other from bar 1, beat 1, each where the one before ends.

    For ChoCo conversions whose chord lengths are right but positions wrong (POSITIONS_FROM_LENGTHS).
    `chords` are ((measure, beat), length, value) in the meter's beats; `meters` (measure, meter).
    """
    out, measure, beat = [], 1, 1.0
    for _, length, value in chords:
        out.append(((measure, round(beat, 6)), length, value))
        beat += length or 0
        while beat >= _bar_beats(meters, measure) + 1 - 1e-6:
            beat -= _bar_beats(meters, measure)
            measure += 1
    return out


def in_three(chords):
    """Rescale chords laid out in four-beat bars to three beats a bar (Real Book waltzes).

    Positions and lengths shrink by 3/4 inside each bar: one chord a bar lasts 3 beats,
    two chords of 2 + 2 last 1.5 + 1.5. `chords` are ((measure, beat), length, value).
    """
    return [((measure, round(1 + (beat - 1) * 0.75, 6)), None if length is None else round(length * 0.75, 6), value)
            for (measure, beat), length, value in chords]


def _continuity(chords, grid, beats, lengths, first_beat):
    """Count the chords that start where the chord before them ends, read with a counting."""
    joined, end = 0, None
    for position, duration, _ in chords:
        measure, beat = decode_measure_beat(position)
        beat += FIRST_BEAT - first_beat
        onset = grid.quarters(measure, beat, beats)
        if end is not None and abs(onset - end) < 1e-3:
            joined += 1
        if not duration:
            end = None
        elif lengths == QUARTERS:
            end = onset + duration
        else:
            end = onset + grid.length_quarters(measure, beat, duration, lengths)
    return joined


def song_counting(chords, meters, beats, lengths, first_beat=1):
    """Choose how one song of a music21 collection counts beats in its compound meters.

    music21 counts a 3/8 bar as one beat or as three eighths depending on how the score was
    written (When in Rome has both), so each song is read the way that makes its chords
    follow each other: music21's beats, the same with 3/8 in eighths, or the meter's unit.
    `beats` and `lengths` are the collection's counting, kept on a tie.
    """
    grid = BarGrid(meters)
    if not any(is_compound(*grid.meter_at(measure)) for measure, _ in meters):
        return beats, lengths
    options = [beats] + [option for option in (MUSIC21_BEATS, MUSIC21_LONG_BEATS, METER_BEATS) if option != beats]

    def score(option):
        """The number of joined chords with this beat counting (lengths follow beats unless in quarters)."""
        return _continuity(chords, grid, option, lengths if lengths == QUARTERS else option, first_beat)

    best = max(options, key=score)  # the first of equal scores: the collection's own counting
    return best, (lengths if lengths == QUARTERS else best)


def song_title(title, track_id):
    """A track's title, or a name for an untitled one: the Jazz Corpus only numbers its sequences."""
    if (title or "").strip():
        return title
    collection, number = track_id.rsplit("_", 1)
    return f"Jazz Corpus sequence {number}" if collection == "jazz-corpus" else f"Untitled ({track_id})"


def superseded(chord, following):
    """Tell whether a chord has no length and the next chord (`following`, a list of 0 or 1) starts with it."""
    (measure, beat), length, _ = chord
    return length is not None and length <= 0 and bool(following) and following[0][0] == (measure, beat)


def release_tracks(source, counts, corrections_paths=(), skip=()):
    """Yield the tracks of the ChoCo release zip, counting what is left out and why."""
    corrections = load_corrections(corrections_paths)
    with zipfile.ZipFile(source) as archive:
        names = sorted(n for n in archive.namelist() if n.startswith(RELEASE_PREFIX) and n.endswith(".jams"))
        for name in names:
            track_id = Path(name).stem
            collection = track_id.rsplit("_", 1)[0]
            if collection in NONCOMMERCIAL or collection in skip:
                counts["excluded_noncommercial" if collection in NONCOMMERCIAL else f"skipped_{collection}"] += 1
                continue
            item = json.loads(archive.read(name))
            meta, sandbox = item["file_metadata"], item["sandbox"]
            if sandbox.get("type") != "score":
                counts["excluded_audio_or_unknown"] += 1
                continue
            annotations = {}
            for annotation in item.get("annotations", []):
                kind = ANNOTATIONS.get(annotation.get("namespace"))
                # Some files contain duplicate analyses. Keep one primary stream per kind.
                if kind and kind not in annotations:
                    annotations[kind] = annotation
            if "chord" not in annotations:
                counts["excluded_no_chords"] += 1
                continue
            if not annotations.get("key", {}).get("data"):
                counts["excluded_no_key"] += 1
                continue
            if track_id in corrections:
                annotations["chord"], applied = corrected_chords(annotations["chord"], corrections[track_id])
                counts["corrected_tracks" if applied else "corrections_not_aligned"] += 1
            beats, lengths = COUNTING.get(collection, (METER_BEATS, METER_BEATS))
            meters = [(decode_measure_beat(onset)[0], value) for onset, _, value in _events(annotations.get("timesig", {}))]
            if collection in COUNTING:
                beats, lengths = song_counting(_events(annotations["chord"]), meters, beats, lengths,
                                               0 if collection in BEAT_ZERO else 1)
            chords = choco_positions(_events(annotations["chord"]), meters, repair=beats == METER_BEATS)
            meter_events = choco_positions(_events(annotations.get("timesig", {})))
            numerator, denominator = parse_time_signature(meter_events[0][2]) if meter_events else (4, 4)
            if collection == "real-book":
                waltz = (meta.get("title") or "") in REAL_BOOK_WALTZES
                meter = "3/4" if waltz else "4/4"
                if waltz:
                    chords = in_three(chords)
                if not meter_events or canonical_meter(meter_events[0][2]) != meter:
                    counts["meter_corrected real-book"] += 1
                length = meter_events[0][1] if meter_events else None
                meter_events = [((1, 1.0), length, meter)]
                meters = [(1, meter)]
            if collection in POSITIONS_FROM_LENGTHS and POSITIONS_FROM_LENGTHS[collection](numerator, denominator):
                counts[f"positions_from_lengths {collection}"] += 1
                chords = laid_end_to_end(chords, meters)
                meter_events = [((1, 1.0), length, value) for _, length, value in meter_events[:1]]
            if collection == "jazz-corpus":
                # The corpus writes every song's chords in C (its readme: "transposed to the key of C"),
                # with the song's real key beside them; ChoCo kept both, so the chords go to the key
                tonic = str(annotations["key"]["data"][0]["value"]).split(":", 1)[0]
                chords = [(position, length, transpose_from_c(str(value), tonic)) for position, length, value in chords]
            # A chord of no length followed by another at the same place never sounds (Wikifonia grace chords)
            kept = [chord for i, chord in enumerate(chords) if not superseded(chord, chords[i + 1:i + 2])]
            counts["superseded_chords_dropped"] += len(chords) - len(kept)
            chords = kept
            if not any(value not in ("N", "X") for _, _, value in chords):
                counts["excluded_no_chords"] += 1  # nothing left to play once grace chords are dropped
                continue
            if collection in MAX_BARS and chords and max(m for (m, _), _, _ in chords) > MAX_BARS[collection]:
                counts[f"excluded_overexpanded {collection}"] += 1  # ChoCo wrote its repeats out without end
                continue
            artist = meta.get("artist") or "; ".join(sandbox.get("performers") or [])
            if isinstance(artist, list):
                artist = "; ".join(artist)
            yield Track(
                id=track_id, title=song_title(meta.get("title"), track_id), artist=artist,
                composers="; ".join(sandbox.get("composers") or []), genre=sandbox.get("genre") or "",
                corpus=annotations["chord"].get("annotation_metadata", {}).get("corpus") or collection,
                collection=collection, license="CC BY 4.0",
                # Beats 10 and above only exist where beats are the meter's unit (12/8 eighths)
                chords=chords,
                keys=choco_positions(_events(annotations["key"])),
                meters=meter_events,
                segments=choco_positions(_events(annotations.get("segment", {}))),
                duration=meta.get("duration"),
                metadata={"file_metadata": meta, "sandbox": sandbox},
                first_beat=0 if collection in BEAT_ZERO else 1, beats=beats, lengths=lengths,
            )
