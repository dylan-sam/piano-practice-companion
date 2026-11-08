"""Turn solos of the Weimar Jazz Database into a Studio playlist, to test lead sheets.

The Weimar Jazz Database (Jazzomat Research Project, Hochschule fuer Musik
Franz Liszt Weimar; Pfleiderer et al. 2017, "Inside the Jazzomat") holds 456
transcribed jazz solos with their beats and chord changes. This tool is for
testing the Studio's lead-sheet reader against real, metrically annotated
melodies: neither the database nor the playlists made from it are shipped with
the project (data/weimar* is ignored by git). The database file, wjazzd.db, is
in ChoCo's repository (partitions/weimar/raw/) or on the Jazzomat site.

Free-time solos (transcribed without bars) are left out. Each solo becomes one chart of the Studio's export format
(ear-training-studio-playlists, version 1), which the Studio imports with
Import > Studio export:

* the bars from the solo's first note to its last, laid out four to a row;
* the chords from the beat track, converted from Weimar's syntax (Bbj7, C-7,
  Am7b5, D79b, G7alt) to chart symbols and checked with chord_notation;
* the melody, one note per transcribed event, at its bar and position in
  quarter notes: (beat - 1) + (tatum - 1) / division, rounded to a twelfth of
  a beat, so straight sixteenths and triplets both stay exact. A note lasts
  its transcribed length, or until the next note when the gap is shorter than
  a sixteenth (a lead sheet does not write every breath);
* the key, tempo, style (from the rhythm feel) and the soloist's instrument as
  the melody's General MIDI program.

Usage: python weimar_playlist.py wjazzd.db out.json [--limit N] [--melid ID ...]
"""

import argparse
import json
import re
import sqlite3
from fractions import Fraction

from chord_notation import NotationError, parse_chart, write_chart

FORMAT = "ear-training-studio-playlists"
GRID = 12  # positions are rounded to a twelfth of a beat
MIN_GAP = Fraction(1, 4)  # a shorter silence before the next note is not written as a rest

PITCH_CLASSES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
# The soloist's instrument as a General MIDI program of the Studio's soundfont
PROGRAMS = {"as": 65, "ts": 66, "ss": 66, "bs": 66, "cl": 66, "bcl": 66, "tp": 56, "cor": 56,
            "tb": 56, "vib": 11, "p": 0, "g": 26}
# The rhythm feel as a Studio style
STYLES = {"SWING": "swing", "TWOBEAT": "swing", "LATIN": "latin", "BALLAD": "ballad",
          "FUNK": "straight pop/rock", "MIX": "swing"}
# Weimar chord qualities as chart suffixes, longest first
QUALITIES = (("m7b5", "h7"), ("+j7", "^7#5"), ("-j7", "-^7"), ("sus7", "7sus"), ("7alt", "7alt"), ("+7", "7#5"),
             ("j7", "^7"), ("-7", "-7"), ("-6", "-6"), ("o7", "o7"), ("sus", "sus"),
             ("-", "-"), ("o", "o"), ("+", "+"), ("j", "^7"), ("7", "7"), ("6", "6"))
CHORD = re.compile(r"([A-G][b#]?)([^/]*)(?:/([A-G][b#]?))?$")


def note_pc(name):
    """Pitch class of a note name (C, F#, Bb)."""
    return (PITCH_CLASSES[name[0]] + name[1:].count("#") - name[1:].count("b")) % 12


def chart_chord(symbol):
    """Convert a Weimar chord (Bbj7, D79b, Am7b5/G, NC) to a chart symbol; None for no chord.

    Tensions follow the quality as a number with its accidental after it
    (79b is a seventh with a flat ninth): altered ones are written as chart
    alterations (b9), natural ones as added notes, and the result is
    rewritten in the chart's simplest spelling (7add9 is 9). Raises
    NotationError for a chord the chart notation cannot read.
    """
    if symbol in ("NC", "N.C."):
        return None
    match = CHORD.match(symbol)
    if not match:
        raise NotationError(f"unreadable Weimar chord {symbol!r}")
    root, rest, bass = match.groups()
    suffix = ""
    for weimar, chart in QUALITIES:
        if rest.startswith(weimar):
            suffix, rest = chart, rest[len(weimar):]
            break
    for number, accidental in re.findall(r"(13|11|9)([b#]?)", rest):
        suffix += accidental + number if accidental else "add" + number
    if re.sub(r"(13|11|9)[b#]?", "", rest):
        raise NotationError(f"unreadable Weimar chord {symbol!r}")
    text = root + suffix + (f"/{bass}" if bass else "")
    return write_chart(parse_chart(text))


def safe_chord(symbol):
    """A chart symbol for a Weimar chord, without its tensions when they can't be written."""
    try:
        return chart_chord(symbol)
    except NotationError:
        plain = re.sub(r"(13|11|9)[b#]?", "", symbol)
        return chart_chord(plain)


def read_key(value):
    """The tonic pitch class and minor flag of a Weimar key (Bb-maj, C-min, F-dor); C major if unknown."""
    tonic, _, mode = (value or "").partition("-")
    if not tonic or tonic[0] not in PITCH_CLASSES:
        return 0, False
    return note_pc(tonic), mode in ("min", "dor", "phry", "aeol")


def quantize(value):
    """Round a length in beats to the grid (a twelfth of a beat)."""
    return Fraction(round(value * GRID), GRID)


def solo_bars(beats):
    """Group a solo's beat rows (bar, beat, chord, form) by bar, in order."""
    bars = {}
    for bar, beat, chord, form in beats:
        bars.setdefault(bar, []).append((beat, chord, form))
    return bars


def chart_bars(bars, first, last):
    """The chart bars from `first` to `last`, with their chords, rehearsal marks and rows."""
    out = []
    current = None  # the chord playing, carried into bars that start without a change
    numbers = list(range(first, last + 1))
    lengths = [max((beat for beat, _, _ in bars.get(bar, [])), default=4) for bar in numbers]
    # The first and last bars are often cut short (a pickup, the solo's last note): they get
    # the meter of the bar next to them
    if len(lengths) > 1:
        lengths[0] = max(lengths[0], lengths[1])
        lengths[-1] = max(lengths[-1], lengths[-2])
    for index, bar in enumerate(numbers):
        rows = bars.get(bar, [])
        length = lengths[index]
        changes = [(beat - 1, safe_chord(chord)) for beat, chord, _ in rows if chord]
        if changes and changes[0][0] > 0:
            changes.insert(0, (0, current))  # the chord before the change goes on sounding
        if not changes and index == 0:
            changes = [(0, current)]
        ends = [start for start, _ in changes[1:]] + [length]
        chords = [{"symbol": symbol, "beats": end - start} for (start, symbol), end in zip(changes, ends)]
        if changes:
            current = changes[-1][1]
        entry = {"chords": chords, "cells": 4}
        if index % 4 == 0:
            entry["rowStart"] = True
        form = next((f for beat, _, f in rows if beat == 1 and f), "")
        if form and form[0].isalpha():
            entry["section"] = "i" if form[0] == "I" else form[0]
        out.append((length, entry))
    return out


def melody_notes(events, first, lengths):
    """Melody notes by chart bar and quarter-note position, sorted, overlaps trimmed."""
    notes = []
    for pitch, duration, bar, beat, tatum, division, beatdur in events:
        if bar < first or bar - first >= len(lengths) or not division or not beatdur:
            continue
        at = quantize(Fraction(beat - 1) + Fraction(tatum - 1, division))
        notes.append({"bar": bar - first, "at": at, "beats": quantize(duration / beatdur), "pitch": int(round(pitch))})
    notes.sort(key=lambda n: (n["bar"], n["at"]))
    # Absolute start of every note in beats from the first bar, to compare across bar lines
    offsets = [0]
    for length in lengths:
        offsets.append(offsets[-1] + length)
    kept = []
    for note in notes:
        start = offsets[note["bar"]] + note["at"]
        if kept and kept[-1][0] == start:
            kept.pop()  # two notes on one grid point: the later one is heard
        kept.append((start, note))
    for (start, note), following in zip(kept, kept[1:] + [None]):
        note["beats"] = max(note["beats"], Fraction(1, GRID))
        if following:
            gap = following[0] - start - note["beats"]
            if gap < MIN_GAP:
                note["beats"] = max(following[0] - start, Fraction(1, GRID))
    return [{**n, "at": float(n["at"]), "beats": float(n["beats"])} for _, n in kept]


def solo_chart(db, melid):
    """One solo as a Studio chart with its melody."""
    info = db.execute("select performer, title, instrument, key, avgtempo, rhythmfeel from solo_info where melid = ?",
                      (melid,)).fetchone()
    performer, title, instrument, key, tempo, feel = info
    events = db.execute("select pitch, duration, bar, beat, tatum, division, beatdur from melody "
                        "where melid = ? order by onset", (melid,)).fetchall()
    beats = db.execute("select bar, beat, chord, form from beats where melid = ? order by onset", (melid,)).fetchall()
    bars = solo_bars(beats)
    first = max(min(e[2] for e in events), min(bars))
    last = min(max(e[2] for e in events), max(bars))
    laid_out = chart_bars(bars, first, last)
    lengths = [length for length, _ in laid_out]
    time = [lengths[0], 4]
    if max(lengths) == 1:
        raise ValueError("free time: the transcription has no bars")  # one beat per 'bar'
    chart_rows = []
    previous = lengths[0]
    for length, entry in laid_out:
        if length != previous:
            entry["time"] = [length, 4]
        previous = length
        chart_rows.append(entry)
    pc, minor = read_key(key)
    chart = {
        "format": "openstand-chart", "version": 1,
        "title": title, "composer": f"{performer} solo",
        "style": STYLES.get(feel, "swing"), "key": pc, "bpm": max(40, min(300, round(tempo or 120))),
        "time": time, "bars": chart_rows,
        "melody": {"notes": melody_notes(events, first, lengths), "program": PROGRAMS.get(instrument, 65),
                   "source": f"Weimar Jazz Database, melid {melid}"},
    }
    if minor:
        chart["minor"] = True
    return chart


def build_playlist(db_path, limit=None, melids=None):
    """A Studio export with one chart per solo (the first `limit`, or the listed melids)."""
    db = sqlite3.connect(db_path)
    ids = melids or [row[0] for row in db.execute("select melid from solo_info order by melid")]
    charts, skipped = [], []
    for melid in ids[:limit] if limit else ids:
        try:
            charts.append(solo_chart(db, melid))
        except (NotationError, ValueError, TypeError) as error:
            skipped.append((melid, str(error)))
    return {"format": FORMAT, "version": 1, "playlists": [{"name": "Weimar Jazz Database solos", "charts": charts}]}, skipped


def main():
    """Command line: write the playlist and report skipped solos."""
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("database", help="wjazzd.db (SQLite)")
    parser.add_argument("output", help="Studio export JSON to write")
    parser.add_argument("--limit", type=int, help="only the first N solos")
    parser.add_argument("--melid", type=int, nargs="*", help="only these solos")
    args = parser.parse_args()
    playlist, skipped = build_playlist(args.database, args.limit, args.melid)
    with open(args.output, "w", encoding="utf-8") as file:
        json.dump(playlist, file, ensure_ascii=False)
    print(f"{len(playlist['playlists'][0]['charts'])} solos written to {args.output}")
    for melid, reason in skipped:
        print(f"SKIPPED melid {melid}: {reason}")


if __name__ == "__main__":
    main()
