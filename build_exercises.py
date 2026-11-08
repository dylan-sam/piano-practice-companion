"""Build the question bank for the Name the progression exercise.

Each catalog progression gets questions from distinct songs. A question is
one line of a real chart: the measure before the progression, the measures
the progression fills (marked hidden), and the measure after it. Only keys
with a known mode are used, so the key reference is never ambiguous. Rare
progressions (fewer than RELAXED_BELOW such questions) also use relaxed
lines of at most MAX_RELAXED_LINE_BARS bars (see line_bounds). Rebuild
with `python build_exercises.py` after `python find_progressions.py`.
"""

import json
import random
import sqlite3
from contextlib import closing
from pathlib import Path

from find_progressions import match_passages_in_key_part, observed_runs, pattern_runs
from score_search import corpus_rank
from chord_notation import roman_rows
from studio_bridge import key_fields, score_chart


PROJECT_ROOT = Path(__file__).resolve().parent
CATALOG = PROJECT_ROOT / "data" / "common_progressions.json"
DATABASE = PROJECT_ROOT / "data" / "progressions.sqlite"
OUTPUT = PROJECT_ROOT / "studio" / "public" / "exercises" / "name-progression.json"
QUESTIONS_PER_PROGRESSION = 150
# Eight-chord progressions too rare for the exercise (a handful of songs). They
# still count when checking that a gap fits only one catalog progression.
EXCLUDED_PROGRESSIONS = ("progression-14", "progression-15")
MAX_GAP_BARS = 4
# Progressions with fewer strict questions than this get more from relaxed lines
RELAXED_BELOW = 40
MAX_RELAXED_LINE_BARS = 6
SEED = 2026
EPSILON = 1e-6
def bar_index_at(bar_starts, quarter):
    """Return the index of the bar sounding at a quarter position."""
    index = None
    for position, start in enumerate(bar_starts):
        if start <= quarter + EPSILON:
            index = position
    return index


def meter_before(chart, bar_index):
    """Return the time signature in force at one chart bar."""
    time = chart["time"]
    for bar in chart["bars"][:bar_index + 1]:
        time = bar.get("time", time)
    return list(time)


def line_bounds(chart, first, last, relaxed):
    """Return the first and last bar of the line around gap bars first..last, or None.

    Strict lines need a whole bar before and after the gap and at most
    MAX_GAP_BARS gap bars. Relaxed lines take those neighbour bars only when
    they exist and are in the gap's key, and may hold up to
    MAX_RELAXED_LINE_BARS bars in all. A key change marks the bar it starts in.
    """
    bars = chart["bars"]
    if any("comment" in bars[index] for index in range(first + 1, last + 1)):
        return None  # A key change inside the gap.
    if not relaxed:
        if first < 1 or last + 1 >= len(bars) or last - first + 1 > MAX_GAP_BARS:
            return None
        if "comment" in bars[first] or "comment" in bars[last + 1]:
            return None
        return first - 1, last + 1
    low = first - 1 if first >= 1 and "comment" not in bars[first] else first
    high = last + 1 if last + 1 < len(bars) and "comment" not in bars[last + 1] else last
    return (low, high) if high - low + 1 <= MAX_RELAXED_LINE_BARS else None


def question_line(chart, bar_starts, passage, step_starts=(0.0,), relaxed=False):
    """Cut the bars around a passage and hide its chords, or return None.

    The line runs from the start of a bar to the end of a bar (see
    line_bounds), with chord boundaries at both passage edges and no unknown
    hidden chord. Each hidden chord records the progression step it belongs
    to: the index of the last entry of `step_starts` (quarter positions) at
    or before it.
    """
    start, end = passage["start_quarter"], passage["end_quarter"]
    first = bar_index_at(bar_starts, start)
    last = bar_index_at(bar_starts, end - 1e-3)  # The bar holding the last hidden beat.
    if first is None or last is None:
        return None
    bounds = line_bounds(chart, first, last, relaxed)
    if bounds is None:
        return None
    line = []
    for index in range(bounds[0], bounds[1] + 1):
        source = chart["bars"][index]
        position = bar_starts[index]
        chords = []
        for chord in source["chords"]:
            chord_end = position + chord["beats"]
            inside = start - EPSILON <= position and chord_end <= end + EPSILON
            overlaps = position < end - EPSILON and chord_end > start + EPSILON
            if overlaps and not inside:
                return None
            if inside and chord["symbol"] is None:
                return None
            if inside:
                step = max(i for i, step_start in enumerate(step_starts)
                           if step_start <= position + EPSILON or i == 0)
                chords.append({**chord, "hidden": True, "step": step})
            else:
                chords.append(dict(chord))
            position = chord_end
        bar = {"chords": chords}
        if index > bounds[0] and "time" in source:
            bar["time"] = source["time"]
        line.append(bar)
    if not any(chord.get("hidden") for bar in line for chord in bar["chords"]):
        return None
    return {"time": meter_before(chart, bounds[0]), "bars": line}


def passage_events(connection, track_id, passage):
    """Return the (ordinal, onset, Roman chord) events of one passage, computed from its chords and keys."""
    keys = connection.execute(
        "SELECT onset,value FROM events WHERE track_id=? AND kind='key' ORDER BY onset,ordinal", (track_id,)).fetchall()
    chords = connection.execute("""
        SELECT ordinal,onset,duration,value FROM events
        WHERE track_id=? AND kind='chord' AND ordinal>=? AND ordinal<?
        ORDER BY ordinal
    """, (track_id, passage["start_ordinal"], passage["end_ordinal_exclusive"])).fetchall()
    return [(ordinal, onset, value) for ordinal, onset, _, value in roman_rows(chords, keys)]


def step_starts(connection, track_id, passage):
    """Return the quarter position where each progression step of a passage starts (onsets are quarters)."""
    return [run.start_onset for run in observed_runs(passage_events(connection, track_id, passage))]


def fills_another_progression(connection, track_id, passage, own_index, patterns):
    """Report whether the hidden chords also form another catalog progression exactly."""
    events = passage_events(connection, track_id, passage)
    return any(index != own_index and first == passage["start_ordinal"]
               and end == passage["end_ordinal_exclusive"]
               for index, first, _, end, _ in match_passages_in_key_part(events, patterns))


def song_groups(entry, rng):
    """Group score entries by song; songs with better-known sources come first."""
    groups = {}
    for song in entry["songs"]:
        groups.setdefault(song["song_key"], []).append(song)
    ordered = list(groups.values())
    rng.shuffle(ordered)
    for versions in ordered:
        versions.sort(key=lambda song: (corpus_rank(song["corpus"]), song["track_id"]))
    ordered.sort(key=lambda versions: corpus_rank(versions[0]["corpus"]))
    return ordered


def song_question(connection, versions, own_index, patterns, charts, relaxed):
    """Return the first valid question among the versions of one song, or None.

    Strict questions need a known mode, so "Hear the key" plays the song's
    cadence; relaxed ones may have none (the exercise then offers both).
    """
    for song in versions:
        track_id = song["track_id"]
        if track_id not in charts:
            try:
                charts[track_id] = score_chart(connection, track_id)
            except ValueError:
                charts[track_id] = None
        if charts[track_id] is None:
            continue
        chart, bar_starts = charts[track_id]
        for passage in song["passages"]:
            key_pc, minor = key_fields(passage["key"])
            if minor is None and not relaxed:
                continue
            if question_line(chart, bar_starts, passage, relaxed=relaxed) is None:
                continue
            if fills_another_progression(connection, track_id, passage, own_index, patterns):
                continue
            starts = step_starts(connection, track_id, passage)
            if len(starts) != len(patterns[own_index]):
                continue
            return {"track_id": track_id, "title": song["title"],
                    "artist": song["artist"] or song["composers"] or "",
                    "corpus": song["corpus"], "style": chart["style"],
                    "key": key_pc, "minor": minor, "relaxed": relaxed,
                    **question_line(chart, bar_starts, passage, starts, relaxed)}
    return None


def build_questions(connection, entry, own_index, patterns, rng, charts):
    """Pick one question from each of up to QUESTIONS_PER_PROGRESSION songs.

    Songs are first tried with the strict line rules. A progression left with
    fewer than RELAXED_BELOW questions then tries its remaining songs with
    the relaxed rules (see line_bounds).
    """
    groups = song_groups(entry, rng)
    questions, used = [], set()
    for relaxed in (False, True):
        if relaxed and len(questions) >= RELAXED_BELOW:
            break
        for index, versions in enumerate(groups):
            if index in used or len(questions) == QUESTIONS_PER_PROGRESSION:
                continue
            question = song_question(connection, versions, own_index, patterns, charts, relaxed)
            if question:
                questions.append(question)
                used.add(index)
    return questions


def build_bank(database=DATABASE, catalog_path=CATALOG):
    """Return progressions in descending distinct-song order with their questions."""
    catalog = json.loads(Path(catalog_path).read_text(encoding="utf-8"))
    catalog.sort(key=lambda entry: (-entry["unique_song_count"], entry["id"]))
    patterns = [pattern_runs(entry["chords"]) for entry in catalog]
    charts = {}
    progressions = []
    with closing(sqlite3.connect(database)) as connection:
        for index, entry in enumerate(catalog):
            if entry["id"] in EXCLUDED_PROGRESSIONS:
                continue
            rng = random.Random(f"{SEED}:{entry['id']}")
            progressions.append({
                "id": entry["id"], "label": entry["label"],
                "chords": entry["chords"],
                "unique_song_count": entry["unique_song_count"],
                "questions": build_questions(connection, entry, index, patterns, rng, charts),
            })
    return {"version": 1,
            "source": "ChoCo v1.0.0 (CC BY 4.0), https://github.com/smashub/choco",
            "progressions": progressions}


def main():
    """Write the exercise bank served with the web app."""
    bank = build_bank()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(bank, ensure_ascii=False, separators=(",", ":")) + "\n",
                      encoding="utf-8")
    for entry in bank["progressions"]:
        print(f'{entry["id"]:16} {entry["unique_song_count"]:5} songs '
              f'{len(entry["questions"]):4} questions  {entry["label"]}')
    print(f"Wrote {OUTPUT} ({OUTPUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
