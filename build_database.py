"""Build data/progressions.sqlite from the sources listed in data/sources.json.

Usage: python build_database.py [data/sources.json]

Sources are read in the listed order (earlier iReal charts win when the same
chart appears again) and written by track_store, so every chord ends up in the
same canonical notation whatever its origin. Source types:

- choco-release: the ChoCo JAMS release (import_choco.py), with optional
  correction zips and collections to skip.
- ireal: irealb:// playlists, forum dumps, folders or zips of them
  (ireal_playlist.py); each writes a log to the logs folder.

A source marked "optional" is skipped when its path does not exist or holds
no playlist file. A track with the same bars and chords as one already
written (from any source) is skipped as a duplicate. Once every source is read,
song_dedupe.py removes duplicate and very similar versions of a song (set
"remove_similar_songs": false in sources.json to keep them). Paths are relative to the folder of sources.json's parent.
"""

import argparse
import json
from collections import Counter
from datetime import datetime
from pathlib import Path

from import_choco import release_tracks
from ireal_playlist import IrealImport, new_log, source_documents
from song_dedupe import remove_similar_songs
from track_store import add_track, canonical_chord, finish_catalog, open_catalog, position_key


ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG = ROOT / "data" / "sources.json"


def _present(source, path):
    """Tell whether a source has something to read."""
    if not path.exists():
        return False
    return path.is_file() or next(iter(source_documents(path)), None) is not None


def build(config_path=DEFAULT_CONFIG, root=ROOT):
    """Build the catalog described by a sources file; return counts and the logs written."""
    config = json.loads(Path(config_path).read_text(encoding="utf-8"))
    db = open_catalog(root / config["database"])
    counts, logs, used, seen = Counter(), [], [], set()
    ireal = IrealImport()
    try:
        for source in config["sources"]:
            path = root / source["path"]
            if not _present(source, path):
                if source.get("optional"):
                    counts[f"skipped_source {source['name']}"] += 1
                    continue
                raise FileNotFoundError(f"Source {source['name']!r} not found: {path}")
            if source["type"] == "choco-release":
                fixes = [root / name for name in source.get("corrections", [])]
                tracks = release_tracks(path, counts, fixes, set(source.get("skip", [])))
            elif source["type"] == "ireal":
                log = new_log(root / config["logs"], source["name"])
                tracks = ireal.tracks({**source, "path": path}, log)
            else:
                raise ValueError(f"Unknown source type {source['type']!r}")
            for track in tracks:
                # A track with the same bars and chords as one already in the catalog is a duplicate
                identity = tuple((position_key((measure, beat + 1 - track.first_beat)), canonical_chord(value, Counter()))
                                 for (measure, beat), _, value in track.chords)
                if identity in seen:
                    counts[f"duplicates_skipped {source['name']}"] += 1
                    continue
                seen.add(identity)
                add_track(db, track, counts)
                ireal.note_song(track.title)
            if source["type"] == "ireal":
                header = f"iReal import of {source['name']} ({source['path']}) on {datetime.now():%Y-%m-%d %H:%M}"
                logs.append(str(log.write(header)))
                counts[f"ireal {source['name']}: {log.summary()}"] += 1
            used.append(f"{source['name']} ({source.get('url') or source['path']}; {source['license']})")
        if config.get("remove_similar_songs", True):
            # Duplicate and very similar versions of a song, from any sources (song_dedupe.py)
            similar_log = root / config["logs"] / f"similar-songs-{datetime.now():%Y%m%d-%H%M%S}.log"
            remove_similar_songs(db, counts, similar_log)
            logs.append(str(similar_log))
        finish_catalog(db, {"sources": "; ".join(used)}, counts)
    finally:
        db.close()
    return counts, logs


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("config", nargs="?", type=Path, default=DEFAULT_CONFIG)
    args = parser.parse_args()
    result, written = build(args.config, args.config.resolve().parent.parent)
    print(json.dumps(result, indent=2))
    print("Import logs:", *written, sep="\n  ")
