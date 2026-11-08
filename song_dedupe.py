"""Remove duplicate and very similar songs from the catalog, whatever their titles.

Chords are compared by sound, ignoring sevenths: a chord becomes its root
pitch class, its intervals without the 7th degree, and its bass interval
(C:7, C:maj7 and C:maj are the same; C:7/b7 keeps its bass). N and X are
not chords.

- Duplicates: the same chords at the same positions, up to a change of key.
- Very similar: the sequences of chords (repeated neighbours merged) differ by
  at most MAX_EDITS insertions, deletions or replacements in some key, and the
  lengths differ by at most MAX_BAR_DIFFERENCE bars.

Both rules also need related titles (same_titles): the same song_key, or one
title being the other with words added before or after it ("Misty - Erroll
Garner", "When Lights Are Low 1", "P19 We Will Rock You"). Different songs on
the same changes (blues heads, rhythm-changes tunes, four-chord pop songs)
therefore stay.

Of a group, the song with the shortest title stays (then the preferred source,
then the track id); every removed track is logged with the track it repeats.
Similar candidates are found without comparing every pair: with at most
MAX_EDITS edits, one of MAX_EDITS + 1 consecutive parts of a sequence appears
unchanged, near its place, in the other one.
"""

import json
from collections import defaultdict

from chord_notation import NO_CHORD, parse_harte
from score_search import corpus_rank, song_key, title_words


MAX_EDITS = 2
MAX_BAR_DIFFERENCE = 2
MIN_TITLE_LETTERS = 5  # a shorter title (Blue) is not matched inside a longer one (Blue Monk)
PARTS = MAX_EDITS + 1
_SHAPES = {}


def same_titles(a, b):
    """Tell whether two titles name the same song: equal song keys, or one is the other with added words."""
    if song_key(a) == song_key(b):
        return True
    short, long_ = sorted((title_words(a), title_words(b)), key=len)
    if not short or len("".join(short)) < MIN_TITLE_LETTERS or len(short) == len(long_):
        return False
    return long_[:len(short)] == short or long_[-len(short):] == short


def chord_sound(value):
    """(root pitch class, shape) of a canonical Harte chord without its 7th, or None for N and X.

    The shape (intervals without the 7th degree, and the bass interval) is
    numbered so that sequences compare quickly.
    """
    if value in NO_CHORD:
        return None
    chord = parse_harte(value)
    shape = (tuple(sorted(t for t in chord.tokens if t[0] != 7)), chord.bass)
    return chord.root_pc, _SHAPES.setdefault(shape, len(_SHAPES))


def song_shape(chords):
    """Describe one song from its (onset, chord, measure) rows: its key-free timed chords,
    its chord sequence and its number of bars."""
    sounds = [(onset, chord_sound(value), measure) for onset, value, measure in chords]
    sounds = [(onset, sound, measure) for onset, sound, measure in sounds if sound]
    if not sounds:
        return None
    first = sounds[0][1][0]
    exact = tuple((round(onset, 4), (root - first) % 12, shape) for onset, (root, shape), _ in sounds)
    sequence = []
    for _, sound, _ in sounds:
        if not sequence or sequence[-1] != sound:
            sequence.append(sound)
    measures = [measure for _, _, measure in sounds]
    return exact, sequence, max(measures) - min(measures) + 1


def _relative(part):
    """A part of a sequence written from its own first root, so that it matches in any key."""
    first = part[0][0]
    return tuple(((root - first) % 12, shape) for root, shape in part)


def _bounds(length):
    """Start and end of each of the PARTS parts of a sequence of a given length."""
    cuts = [round(i * length / PARTS) for i in range(PARTS + 1)]
    return list(zip(cuts, cuts[1:]))


def within_edits(a, b, limit=MAX_EDITS):
    """Tell whether two sequences are at most `limit` edits apart (banded edit distance)."""
    if abs(len(a) - len(b)) > limit:
        return False
    previous = list(range(len(b) + 1))
    for i, item in enumerate(a, 1):
        low, high = max(1, i - limit), min(len(b), i + limit)
        current = [limit + 1] * (len(b) + 1)
        current[0] = i
        for j in range(low, high + 1):
            current[j] = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (item != b[j - 1]))
        if min(current[max(0, low - 1):high + 1]) > limit:
            return False
        previous = current
    return previous[len(b)] <= limit


class SimilarIndex:
    """The kept songs' sequence parts, to find songs within MAX_EDITS edits of a new one."""

    def __init__(self):
        """Start with no song."""
        self.parts = defaultdict(list)  # (length, part index, relative part) -> [(track id, first root)]
        self.songs = {}  # track id -> (sequence, bars)

    def add(self, track_id, sequence, bars, title):
        """Index a kept song."""
        self.songs[track_id] = (sequence, bars, title)
        for index, (start, end) in enumerate(_bounds(len(sequence))):
            if end > start:
                part = sequence[start:end]
                self.parts[(len(sequence), index, _relative(part))].append((track_id, part[0][0]))

    def match(self, sequence, bars, title):
        """Return a kept song with a related title that is very similar to this one, or None."""
        tried = set()
        for length in range(max(1, len(sequence) - MAX_EDITS), len(sequence) + MAX_EDITS + 1):
            for index, (start, end) in enumerate(_bounds(length)):
                size = end - start
                if size == 0:
                    continue
                for shift in range(-MAX_EDITS, MAX_EDITS + 1):
                    begin = start + shift
                    part = sequence[begin:begin + size]
                    if begin < 0 or len(part) < size:
                        continue
                    for track_id, root in self.parts.get((length, index, _relative(part)), ()):
                        transpose = (root - part[0][0]) % 12
                        if (track_id, transpose) in tried:
                            continue
                        tried.add((track_id, transpose))
                        kept, kept_bars, kept_title = self.songs[track_id]
                        if abs(kept_bars - bars) <= MAX_BAR_DIFFERENCE and same_titles(title, kept_title) and within_edits(
                                [((r + transpose) % 12, s) for r, s in sequence], kept):
                            return track_id
        return None


def remove_similar_songs(db, counts, log_path):
    """Delete duplicate and very similar tracks from the catalog and log each removal."""
    tracks = {tid: (title, corpus) for tid, title, corpus in db.execute("SELECT id,title,corpus FROM tracks")}
    chords = defaultdict(list)
    for tid, onset, value, measure in db.execute(
            "SELECT track_id,onset,value,measure FROM events WHERE kind='chord' ORDER BY track_id,ordinal"):
        chords[tid].append((onset, value, measure))
    order = sorted(tracks, key=lambda tid: (len(tracks[tid][0].strip()), corpus_rank(tracks[tid][1]), tid))
    exact_seen, index, removed = defaultdict(list), SimilarIndex(), []
    for tid in order:
        shape = song_shape(chords.get(tid, []))
        if shape is None:
            continue
        exact, sequence, bars = shape
        title = tracks[tid][0]
        same = next((kept for kept in exact_seen[exact] if same_titles(title, tracks[kept][0])), None)
        if same:
            removed.append((tid, same, "duplicate"))
            continue
        kept = index.match(sequence, bars, title)
        if kept:
            removed.append((tid, kept, "very similar"))
            continue
        exact_seen[exact].append(tid)
        index.add(tid, sequence, bars, title)
    db.executemany("DELETE FROM events WHERE track_id=?", [(tid,) for tid, _, _ in removed])
    db.executemany("DELETE FROM tracks WHERE id=?", [(tid,) for tid, _, _ in removed])
    for _, _, why in removed:
        counts[f"songs_removed_{why.replace(' ', '_')}"] += 1
    log_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"{why.upper():12} {tid} | {tracks[tid][0]} ({tracks[tid][1]}) | kept {kept} | {tracks[kept][0]} ({tracks[kept][1]})"
             for tid, kept, why in removed]
    summary = f"Summary: {sum(w == 'duplicate' for *_, w in removed)} duplicates and " \
              f"{sum(w == 'very similar' for *_, w in removed)} very similar songs removed"
    log_path.write_text("\n".join([summary, ""] + lines + ["", summary, ""]), encoding="utf-8")
    return removed
