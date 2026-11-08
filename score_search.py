"""Search ChoCo score titles and choose a default version per song."""

import json
import random
import re
import sqlite3
import unicodedata
from contextlib import closing
from functools import lru_cache
from pathlib import Path



# iReal Pro charts come first: ChoCo's curated playlists, then playlists added
# to data/ireal-playlists, then the user-contributed forum charts
IREAL_CORPORA = ("iReal Pro", "iReal Pro playlists", "iReal Pro forum")
CORPUS_PRIORITY = IREAL_CORPORA + (
    "Real Book", "A Corpus Study of Rock Music", "When in Rome",
    "Nottingham Music Database", "Wikifonia", "BiaB Internet Corpus",
)
GENRE_CORPUS = {
    "jazz": "Real Book", "rock": "A Corpus Study of Rock Music",
    "classical": "When in Rome", "folk": "Nottingham Music Database",
}


def _fold(text):
    """Keep lowercase letters and digits of any script, dropping accents and punctuation.

    Café is "cafe"; Hebrew, Cyrillic or Chinese titles keep their letters (a title with no
    Latin letter used to fold to nothing and match every other one).
    """
    decomposed = unicodedata.normalize("NFKD", text.lower())  # lower(), as JavaScript (catalog.ts)
    return "".join(ch for ch in decomposed if ch.isalnum() and not unicodedata.combining(ch))


def song_key(title):
    """Group versions of one song across corpora by a normalized title.

    Ignored: bracketed notes ("(Somewhere)", "[3/4]"), punctuation, case and
    accents, a leading or trailing article ("A Foggy Day", "Foggy Day, A"),
    and version suffixes ("v2", "-orig", "-new", "-old"). Trailing numbers are
    kept, since "Symphony No. 4" and "No. 5" differ. Different songs that
    share a title also share a key.
    """
    return "".join(title_words(title)) or _fold(title)


def title_words(title):
    """The words of a title as song_key compares them (cleaned, lowercase ASCII)."""
    text = re.sub(r"\([^)]*\)|\[[^\]]*\]", " ", title)
    text = re.sub(r"^\W+", "", text.strip())
    text = re.sub(r",\s*(the|an|a)\s*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"[\s_-]+(v\d+|orig|original|new|old)\s*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^(the|an|a)\s+", "", text, flags=re.IGNORECASE)
    return [word for word in (_fold(part) for part in re.split(r"[\s_\-/]+", text)) if word]


def _genre_family(genre, corpus):
    """Classify a score using its genre tag or a genre-specific corpus."""
    label = genre.casefold()
    if corpus in ("Real Book", "JazzCorpus") or any(
            word in label for word in ("jazz", "swing", "bossa", "blues")):
        return "jazz"
    if corpus == "A Corpus Study of Rock Music" or any(
            word in label for word in ("rock", "pop")):
        return "rock"
    if corpus in ("When in Rome", "Schubert Winterreise Dataset") or "classical" in label:
        return "classical"
    if corpus == "Nottingham Music Database" or "folk" in label:
        return "folk"
    return None


def _missing_metadata(row):
    """Count absent descriptive and timing fields for a score version."""
    return (sum(not row[field] for field in ("artist", "composers", "genre", "duration"))
            + (not row["has_timesig"]))


def corpus_rank(corpus):
    """Return the fixed source priority after genre and metadata ties."""
    try:
        return CORPUS_PRIORITY.index(corpus)
    except ValueError:
        return len(CORPUS_PRIORITY)


def _order_versions(rows):
    """Put iReal first, then apply genre, completeness, and source rules."""
    ireal = [row for row in rows if row["corpus"] in IREAL_CORPORA]
    if ireal:
        winner = min(ireal, key=lambda row: (corpus_rank(row["corpus"]), _missing_metadata(row), row["id"]))
    else:
        preferred = [row for row in rows
                     if GENRE_CORPUS.get(_genre_family(row["genre"], row["corpus"]))
                     == row["corpus"]]
        if preferred:
            winner = min(preferred, key=lambda row: (_missing_metadata(row),
                                                      corpus_rank(row["corpus"]), row["id"]))
        else:
            winner = min(rows, key=lambda row: (corpus_rank(row["corpus"]),
                                                _missing_metadata(row), row["id"]))
    return [winner] + sorted((row for row in rows if row is not winner),
                             key=lambda row: (corpus_rank(row["corpus"]),
                                              _missing_metadata(row), row["id"]))


@lru_cache(maxsize=4)
def _score_rows(database_path, modified_ns):
    """Cache keyed score metadata until the database file changes."""
    with closing(sqlite3.connect(database_path)) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute("""
            SELECT t.id,t.title,t.artist,t.composers,t.genre,t.corpus,t.duration,
                   EXISTS(SELECT 1 FROM events e WHERE e.track_id=t.id
                          AND e.kind='timesig') AS has_timesig
            FROM tracks t WHERE t.media_type='score' AND TRIM(t.title)<>''
              AND EXISTS(SELECT 1 FROM events e WHERE e.track_id=t.id AND e.kind='key')
              AND EXISTS(SELECT 1 FROM events e WHERE e.track_id=t.id AND e.kind='chord')
        """).fetchall()
    return tuple(dict(row) for row in rows)


@lru_cache(maxsize=2)
def _catalog(catalog_path, modified_ns):
    """Read the progression catalog once until the file changes."""
    return tuple(json.loads(Path(catalog_path).read_text(encoding="utf-8")))


def catalog_progressions(catalog_path):
    """List catalog progressions (id, label, distinct songs), most common first."""
    path = Path(catalog_path)
    return [{"id": entry["id"], "label": entry["label"],
             "unique_song_count": entry["unique_song_count"]}
            for entry in _catalog(str(path), path.stat().st_mtime_ns)]


def tracks_with_progressions(catalog_path, progression_ids, match_all=True):
    """Return the score entries containing all (or any) of the given progressions."""
    path = Path(catalog_path)
    entries = {entry["id"]: entry for entry in _catalog(str(path), path.stat().st_mtime_ns)}
    unknown = [pid for pid in progression_ids if pid not in entries]
    if unknown:
        raise ValueError(f"Unknown progression: {', '.join(unknown)}")
    sets = [{song["track_id"] for song in entries[pid]["songs"]} for pid in progression_ids]
    if not sets:
        return frozenset()
    return frozenset(set.intersection(*sets) if match_all else set.union(*sets))


def search_score_groups(database, text="", limit=100, track_ids=None):
    """Find keyed ChoCo scores grouped into songs by normalized title.

    With `track_ids`, only those score entries are kept, so each song lists
    only its versions that pass the filter (and opens one of them).
    """
    if limit < 1:
        raise ValueError("Search limit must be positive")
    path = Path(database)
    query = text.strip().casefold()
    folded_query = _fold(query)
    groups = {}
    for row in _score_rows(str(path), path.stat().st_mtime_ns):
        if track_ids is not None and row["id"] not in track_ids:
            continue
        if query and not (folded_query in _fold(row["title"])
                          or query in row["artist"].casefold()
                          or query in row["id"].casefold()):
            continue
        groups.setdefault(song_key(row["title"]), []).append(row)
    result = []
    for versions in groups.values():
        ordered = _order_versions(versions)
        chosen = ordered[0]
        result.append({"id": chosen["id"], "title": chosen["title"],
                       "artist": chosen["artist"], "corpus": chosen["corpus"],
                       "versions": [{"id": row["id"], "title": row["title"],
                                     "artist": row["artist"], "corpus": row["corpus"],
                                     "genre": row["genre"]} for row in ordered]})
    result.sort(key=lambda group: (group["title"].casefold(), group["id"]))
    return result[:limit]


def search_scores(database, text="", limit=100):
    """Return each grouped score's default version for legacy callers."""
    return [(group["id"], group["title"], group["artist"], group["corpus"])
            for group in search_score_groups(database, text, limit)]


def random_score_group(database, catalog_path, progression_id="", chooser=random.choice):
    """Pick one distinct keyed song, optionally from a catalog progression."""
    track_ids = (tracks_with_progressions(catalog_path, [progression_id])
                 if progression_id else None)
    groups = search_score_groups(database, limit=100000, track_ids=track_ids)
    return chooser(groups) if groups else None
