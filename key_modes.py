"""Settle the tonic and mode of keys whose annotation cannot be trusted.

Several ChoCo sources give no mode (BiaB, Rock Corpus) or default to major
(Real Book, Wikifonia). Wikifonia takes its key from the key signature, so a
minor tune is often labelled with its relative major (C minor as Eb major).
The chords on the tonic tell the key in most songs: settle_key compares the
time spent on the readings a collection allows and keeps the clear winner.
Thresholds were measured against trusted versions of the same songs.
"""

from find_progressions import chord_signature

PARALLEL = ("major", "minor")  # the annotated tonic is right; only the mode is unknown
WITH_RELATIVE = ("major", "minor", "relative minor")  # the tonic may be the relative major
THRESHOLD = 0.75
# Keys use these spellings when the tonic moves to the relative minor
MINOR_TONICS = ("C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B")


def chord_family(quality):
    """Return "maj" or "min" for a Harte quality such as min7 or 7(b9), else None.

    The progression matcher's rule (find_progressions.chord_signature) decides;
    any degree works, since only the quality is read.
    """
    signature = chord_signature(f"I:{quality}")
    return signature[1] if signature else None


def reading_times(chords, tonic_pc):
    """Time spent on each key reading: major I, minor I, minor VI (the relative minor).

    `chords` holds (root pitch class, Harte quality, duration) triples.
    """
    times = dict.fromkeys(WITH_RELATIVE, 0.0)
    for root_pc, quality, duration in chords:
        family = chord_family(quality)
        weight = duration if duration and duration > 0 else 1.0
        interval = (root_pc - tonic_pc) % 12
        if interval == 0 and family:
            times["major" if family == "maj" else "minor"] += weight
        elif interval == 9 and family == "min":
            times["relative minor"] += weight
    return times


def settle_key(chords, tonic_pc, readings=PARALLEL, threshold=THRESHOLD):
    """Return (tonic pitch class, "major" or "minor"), or None when the chords do not decide.

    Only `readings` are considered; the winner needs `threshold` of their time.
    """
    times = reading_times(chords, tonic_pc)
    total = sum(times[reading] for reading in readings)
    if not total:
        return None
    best = max(readings, key=lambda reading: times[reading])
    if times[best] / total < threshold:
        return None
    if best == "relative minor":
        return (tonic_pc + 9) % 12, "minor"
    return tonic_pc, best
