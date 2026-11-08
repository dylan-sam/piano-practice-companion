"""Export the catalog for the mobile app: a song index and the Studio charts, gzipped.

Usage: python build_mobile_catalog.py [output folder, default studio/public/catalog]

The native app has no server, so it reads these files instead of /api/*:

- index.bin: gzipped JSON {"progressions": [...], "songs": [...]}, the same
  songs and version order as the server's search (score_search.search_score_groups),
  each version with its folded title and a bit mask of the catalog
  progressions it contains (bit i = progressions[i]).
- charts-<n>.bin: gzipped JSON {track id: Studio chart} for SHARD_SIZE
  versions, written by studio_bridge.score_chart like /api/studio/chart.

The files are named .bin so that no web server decodes them on the way; the app
decompresses them itself (studio/src/library/catalog.ts).
"""

import gzip
import json
import sqlite3
import sys
from concurrent.futures import ProcessPoolExecutor
from contextlib import closing
from pathlib import Path

from score_search import _fold, catalog_progressions, search_score_groups
from studio_bridge import score_chart


ROOT = Path(__file__).resolve().parent
DATABASE = ROOT / "data" / "progressions.sqlite"
CATALOG = ROOT / "data" / "common_progressions.json"
OUTPUT = ROOT / "studio" / "public" / "catalog"
SHARD_SIZE = 200
FORMAT_VERSION = 1


def _write(path, value):
    """Write a value as gzipped compact JSON."""
    path.write_bytes(gzip.compress(json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode(), 9))


def _write_shard(job):
    """Convert one shard of track ids to Studio charts and write it; return the ids that failed."""
    database, path, ids = job
    charts, failed = {}, []
    with closing(sqlite3.connect(database)) as connection:
        for track_id in ids:
            try:
                charts[track_id] = score_chart(connection, track_id)[0]
            except ValueError:
                failed.append(track_id)
    _write(Path(path), charts)
    return failed


def progression_masks(catalog_path):
    """Map each track id to the bit mask of the catalog progressions it contains."""
    entries = json.loads(Path(catalog_path).read_text(encoding="utf-8"))
    masks = {}
    for bit, entry in enumerate(entries):
        for song in entry["songs"]:
            masks[song["track_id"]] = masks.get(song["track_id"], 0) | (1 << bit)
    return masks


def build(database=DATABASE, catalog=CATALOG, output=OUTPUT, workers=4):
    """Write the index and chart shards; return (songs, versions, charts that could not be built)."""
    output.mkdir(parents=True, exist_ok=True)
    for old in output.glob("*.bin"):
        old.unlink()
    progressions = catalog_progressions(catalog)
    if len(progressions) > 31:
        raise ValueError("Progression masks hold at most 31 progressions")
    masks = progression_masks(catalog)
    groups = search_score_groups(database, limit=10 ** 9)
    ids = [version["id"] for group in groups for version in group["versions"]]
    shard_of = {track_id: index // SHARD_SIZE for index, track_id in enumerate(ids)}
    jobs = [(str(database), str(output / f"charts-{n}.bin"), ids[n * SHARD_SIZE:(n + 1) * SHARD_SIZE])
            for n in range((len(ids) + SHARD_SIZE - 1) // SHARD_SIZE)]
    with ProcessPoolExecutor(workers) as pool:
        failed = {track_id for result in pool.map(_write_shard, jobs) for track_id in result}
    songs = []
    for group in groups:
        versions = [[v["id"], v["title"], v["artist"], v["corpus"], v["genre"], _fold(v["title"]),
                     masks.get(v["id"], 0), shard_of[v["id"]]]
                    for v in group["versions"] if v["id"] not in failed]
        if versions:
            songs.append(versions)
    _write(output / "index.bin", {"format": FORMAT_VERSION, "progressions": progressions, "songs": songs,
                                  "version_fields": ["id", "title", "artist", "corpus", "genre",
                                                     "folded_title", "progressions", "shard"]})
    return len(songs), len(ids), len(failed)


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else OUTPUT
    songs, versions, failed = build(output=target)
    print(f"Wrote {songs} songs, {versions} versions ({failed} without a chart) to {target}")
