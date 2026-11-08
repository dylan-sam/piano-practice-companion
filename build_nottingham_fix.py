"""Build corrected Nottingham chords: slash-chord basses with their accidentals.

The Nottingham Music Database writes slash chords in ABC style, with the bass in
lower case and "+" for sharp or "-" for flat: D/f+ is D/F#. ChoCo v1.0.0 drops
the accidental and stores D/F (D:maj/b3). This script re-reads the source
chords from a ChoCo repository checkout, keeps every other chord as released,
and writes the corrected streams as JAMS files in a zip that import_choco.py
applies like the iReal Pro corrections.

Usage: python build_nottingham_fix.py <choco repository> choco-v1.0.0.zip
"""

import argparse
import json
import re
import zipfile
from pathlib import Path


OUTPUT = Path(__file__).resolve().parent / "choco-nottingham-bass-5fe168f.zip"
SOURCE_DIR = "partitions/nottingham/choco/jams"
NOTES = {"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11}
ACCIDENTALS = {"+": 1, "-": -1}
# Harte bass degrees by semitones above the chord root
BASS_DEGREES = ("1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7")
SLASH_BASS = re.compile(r"/([a-gA-G])([+-])$")
HARTE_ROOT = re.compile(r"^([A-G])([b#]*):")


def pitch_class(letter, accidentals=""):
    """Pitch class of a note name with Harte accidentals (b, #) or ABC ones (-, +)."""
    shift = sum({"b": -1, "#": 1, "-": -1, "+": 1}[a] for a in accidentals)
    return (NOTES[letter.lower()] + shift) % 12


def corrected_value(source, released):
    """Return the released Harte chord with the bass the source spells, or None.

    Only slash chords whose bass carries an ABC accidental are changed, and only
    when the release has that bass without the accidental (the known error).
    """
    bass = SLASH_BASS.search(source)
    root = HARTE_ROOT.match(released)
    if not bass or not root or "/" not in released:
        return None
    root_pc = pitch_class(root.group(1), root.group(2))
    natural = BASS_DEGREES[(pitch_class(bass.group(1)) - root_pc) % 12]
    if released.rsplit("/", 1)[1] != natural:
        return None
    degree = BASS_DEGREES[(pitch_class(bass.group(1), bass.group(2)) - root_pc) % 12]
    return released.rsplit("/", 1)[0] + "/" + degree


def chord_stream(item, namespaces):
    """Return the first annotation of a JAMS document in one of the namespaces."""
    return next((a for a in item["annotations"] if a["namespace"] in namespaces), None)


def build(repository, release_path, output=OUTPUT):
    """Write the corrected Nottingham chord streams and return the number of fixed chords."""
    fixed_total = 0
    with zipfile.ZipFile(release_path) as release, \
            zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as out:
        for path in sorted((Path(repository) / SOURCE_DIR).glob("*.jams")):
            source = chord_stream(json.loads(path.read_text(encoding="utf-8")), ("chord_m21_abc",))
            item = json.loads(release.read(f"v1.0.0/jams/{path.name}"))
            chords = chord_stream(item, ("chord", "chord_harte"))
            if not source or not chords or len(source["data"]) != len(chords["data"]):
                continue
            data, fixed = [], 0
            for src, event in zip(source["data"], chords["data"]):
                value = corrected_value(str(src["value"]), str(event["value"]))
                data.append({**event, "value": value} if value else event)
                fixed += value is not None
            if fixed:
                stream = {"namespace": "chord_harte", "data": data}
                out.writestr(f"jams-converted/{path.name}", json.dumps({"annotations": [stream]}))
                fixed_total += fixed
        out.writestr("SOURCE.txt", "Nottingham slash-chord basses corrected from ChoCo commit 5fe168f "
                     f"({SOURCE_DIR}); built by build_nottingham_fix.py.\n")
    return fixed_total


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repository", type=Path)
    parser.add_argument("release", type=Path)
    args = parser.parse_args()
    print(f"Fixed {build(args.repository, args.release)} chords; wrote {OUTPUT}")
