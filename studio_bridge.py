"""Convert keyed catalog score events into editable Studio charts."""

import sqlite3
from contextlib import closing

from chord_notation import harte_to_chart, note_pc
from score_timing import BarGrid


STYLE_BY_GENRE = {
    "bossa": "bossa-nova", "latin": "latin", "samba": "latin",
    "blues": "blues", "jazz": "swing", "swing": "swing",
    "rock": "straight pop/rock", "pop": "straight pop/rock",
}


def studio_style(genre):
    """Choose one of this project's presets from a ChoCo genre label."""
    label = (genre or "").casefold()
    return next((style for word, style in STYLE_BY_GENRE.items() if word in label),
                "ballad")


def studio_chord(symbol):
    """Translate a catalog (canonical Harte) chord to the chart notation of Studio's player."""
    return harte_to_chart(symbol)


SNAP = 1e-3  # quarter notes: boundaries closer than this are the same point


def _bar_chords(start, end, intervals):
    """Split a measure at chord attacks and releases, including no-chord gaps."""
    boundaries = {start, end}
    for onset, release, _ in intervals:
        if start < onset < end:
            boundaries.add(onset)
        if start < release < end:
            boundaries.add(release)
    positions = []
    for position in sorted(boundaries):
        # Boundaries closer than SNAP come from rounding (thirds of a beat): they are one boundary
        if positions and position - positions[-1] < SNAP:
            positions[-1] = end if position == end else positions[-1]
            continue
        positions.append(position)
    segments = []
    for left, right in zip(positions, positions[1:]):
        middle = (left + right) / 2  # the chord sounding in the middle of the segment owns it
        active = next((symbol for onset, release, symbol in reversed(intervals)
                       if onset <= middle < release), None)
        if segments and segments[-1]["symbol"] == active:
            segments[-1]["beats"] += right - left
        else:
            segments.append({"symbol": active, "beats": right - left})
    for segment in segments:
        segment["beats"] = round(segment["beats"], 6)  # Drop float noise from quarter arithmetic.
    return segments


def key_fields(key):
    """Convert a key such as Bb:minor to (tonic pitch class, is minor).

    The mode is None for a key without mode ("C"), which the import leaves
    when it cannot tell major from minor.
    """
    tonic, _, mode = key.partition(":")
    minor = {"minor": True, "major": False}.get(mode.casefold())
    return note_pc(tonic), minor


def score_chart(connection, track_id):
    """Convert one keyed score to a Studio chart and the quarter start of each bar.

    The bar starts are quarter positions from the start of bar 1, as the catalog's
    onsets and the `start_quarter` and `end_quarter` of catalog passages.
    """
    track = connection.execute(
        "SELECT title,composers,artist,genre FROM tracks WHERE id=? AND media_type='score'",
        (track_id,),
    ).fetchone()
    if track is None:
        raise ValueError(f"Unknown score track: {track_id!r}")
    keys = connection.execute(
        "SELECT measure,value,onset FROM events WHERE track_id=? AND kind='key' ORDER BY onset,ordinal",
        (track_id,),
    ).fetchall()
    meters = connection.execute(
        "SELECT measure,value FROM events WHERE track_id=? AND kind='timesig' ORDER BY onset,ordinal",
        (track_id,),
    ).fetchall()
    rows = connection.execute(
        "SELECT onset,duration,value,measure FROM events WHERE track_id=? AND kind='chord' ORDER BY onset,ordinal",
        (track_id,),
    ).fetchall()
    if not keys or not rows:
        raise ValueError("Studio requires a score with key and chord annotations")
    grid = BarGrid(meters)
    intervals = []
    for index, (onset, length, symbol, _) in enumerate(rows):
        if not length and index + 1 < len(rows):
            length = rows[index + 1][0] - onset  # a chord without length lasts until the next one
        if length and length > 0:
            intervals.append((onset, onset + length, studio_chord(symbol)))
    if not intervals:
        raise ValueError("The selected score has no positive chord durations")
    intervals.sort(key=lambda item: item[0])
    first_measure = min(row[3] for row in rows)
    last_quarter = max(release for _, release, _ in intervals)
    bars = []
    bar_starts = []
    measure = first_measure
    while grid.measure_start(measure) < last_quarter - 1e-7:
        start = grid.measure_start(measure)
        meter = grid.meter_at(measure)
        end = min(grid.measure_start(measure + 1), last_quarter)
        bar = {"chords": _bar_chords(start, end, intervals), "cells": 4}
        if measure > first_measure and meter != grid.meter_at(measure - 1):
            bar["time"] = list(meter)
        # Key changes after the song's first key, where they happen in the bar (Roman numerals follow them)
        changes = [(value, onset) for index, (key_measure, value, onset) in enumerate(keys)
                   if index > 0 and key_measure == measure]
        if changes:
            bar["comment"] = f"Key: {changes[-1][0]}"
            bar["keys"] = [{"beats": round(max(0.0, onset - start), 6), "key": key_fields(value)[0],
                            "minor": key_fields(value)[1]} for value, onset in changes]
        if len(bars) % 4 == 0:
            bar["rowStart"] = True
        bars.append(bar)
        bar_starts.append(start)
        measure += 1
    bars[-1]["barline"] = "final"
    key_pc, minor = key_fields(keys[0][1])
    chart = {"format": "openstand-chart", "version": 1,
             "title": track[0], "composer": track[1] or track[2] or "",
             "style": studio_style(track[3]), "sourceStyle": track[3] or "",
             "key": key_pc, "minor": bool(minor),
             "bpm": 120, "time": list(grid.meter_at(first_measure)), "bars": bars}
    return chart, bar_starts


def choco_chart(database, track_id):
    """Read one keyed score and preserve chord timing and meter in Studio format."""
    with closing(sqlite3.connect(database)) as connection:
        return score_chart(connection, track_id)[0]
