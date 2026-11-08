"""Positions of score events: bars and beats, and quarter notes from the start of bar 1.

The catalog stores every event (chord, key, meter, segment) with

- `measure`: its bar number, 1 for the first full bar (0 for a pickup bar);
- `beat`: its beat in that bar, counted from FIRST_BEAT in the meter's own
  unit (1 is the downbeat; 6/8 has beats 1 to 6, 12/8 beats 1 to 12);
- `onset`: its position in quarter notes from the start of bar 1 (negative
  in a pickup), which orders and times events across meter changes;
- `duration`: its length in quarter notes.

Sources give bars and beats; track_store.add_track turns them into these
fields with a BarGrid built from the song's meters. ChoCo writes a position
as one number, measure + beat / 10 (decode_measure_beat), which cannot write
beats 10 and above: import_choco repairs the few charts where that happened.
"""

import ast
import math
from bisect import bisect_right


FIRST_BEAT = 1  # the number of the downbeat of a bar
# How a source counts beats and lengths (BarGrid.beat_quarters)
METER_BEATS = "meter"  # the meter's unit: eighths in 6/8
MUSIC21_BEATS = "music21"  # music21's beats: dotted quarters in 6/8 and 3/8
MUSIC21_LONG_BEATS = "music21-long"  # the same, but bars of three units (3/8) in units
QUARTERS = "quarters"  # quarter notes


def is_compound(numerator, denominator):
    """Tell whether music21 groups a meter's units by three (6/8, 9/8, 12/8, 6/4, 3/8)."""
    return numerator % 3 == 0 and (numerator > 3 or denominator >= 8)


def parse_time_signature(value):
    """Read a ChoCo time-signature value, accepting its Python-dict encoding."""
    if isinstance(value, tuple):
        numerator, denominator = value
    elif isinstance(value, str) and "/" in value and not value.startswith("{"):
        numerator, denominator = value.split("/", 1)
    else:
        parsed = ast.literal_eval(value) if isinstance(value, str) else value
        numerator = parsed["numerator"]
        denominator = parsed.get("denominator") or 4
    numerator, denominator = int(numerator), int(denominator)
    if numerator <= 0 or denominator <= 0 or denominator & (denominator - 1):
        raise ValueError(f"Invalid time signature: {value!r}")
    return numerator, denominator


def decode_measure_beat(position):
    """Split a ChoCo measure.beat number into (measure, beat): 8.2333 is measure 8, beat 2.333."""
    measure = math.floor(position + 1e-8)
    return measure, round((position - measure) * 10, 6)


class BarGrid:
    """Where the bars of a song start and how long they are, from its meter changes."""

    def __init__(self, meters=(), default=(4, 4)):
        """Index (measure, time signature) changes; bars before the first change use its meter."""
        changes = {}
        for measure, value in sorted(meters, key=lambda item: item[0]):
            changes[measure] = parse_time_signature(value)
        if not changes:
            changes[1] = parse_time_signature(default)
        self._measures = sorted(changes)
        self._meters = [changes[measure] for measure in self._measures]
        self._forward = [0.0]  # starts of bars 1, 2, 3...
        self._backward = {}  # starts of bars 0, -1... (pickups)

    def meter_at(self, measure):
        """Return the time signature of a bar."""
        index = max(0, bisect_right(self._measures, measure) - 1)
        return self._meters[index]

    def beat_quarters(self, measure, counting=METER_BEATS):
        """Return how many quarter notes one beat of a bar lasts.

        With METER_BEATS a beat is the meter's unit (0.5 in 6/8). With MUSIC21_BEATS a
        beat is music21's: in compound meters (6/8, 9/8, 12/8, 6/4, 3/8...) a group of
        three units (1.5 in 6/8), otherwise the meter's unit. QUARTERS is a quarter note.
        """
        numerator, denominator = self.meter_at(measure)
        if counting == QUARTERS:
            return 1.0
        if counting == MUSIC21_BEATS and is_compound(numerator, denominator):
            return 12 / denominator
        if counting == MUSIC21_LONG_BEATS and is_compound(numerator, denominator) and numerator > 3:
            return 12 / denominator
        return 4 / denominator

    def measure_length(self, measure):
        """Return the length of a bar in quarter notes."""
        numerator, denominator = self.meter_at(measure)
        return numerator * 4 / denominator

    def _extend_to(self, measure):
        """Compute the starts of bars 1 to `measure`."""
        while len(self._forward) < measure:
            last = len(self._forward)  # number of the last bar whose start is known
            self._forward.append(self._forward[-1] + self.measure_length(last))

    def measure_start(self, measure):
        """Return where a bar starts, in quarter notes from the start of bar 1."""
        if measure >= 1:
            self._extend_to(measure)
            return self._forward[measure - 1]
        if measure not in self._backward:
            self._backward[measure] = self.measure_start(measure + 1) - self.measure_length(measure)
        return self._backward[measure]

    def quarters(self, measure, beat, counting=METER_BEATS):
        """Return the quarter position of a bar and beat (beats counted from FIRST_BEAT)."""
        return self.measure_start(measure) + (beat - FIRST_BEAT) * self.beat_quarters(measure, counting)

    def length_quarters(self, measure, beat, length, counting=METER_BEATS):
        """Return in quarter notes a length given in beats from a bar and beat, across bar lines.

        Beats are counted in each bar's own meter, so a length crossing a meter change
        (6/8 to 2/4) is the sum of its parts, not its beats times the first bar's beat.
        """
        start = self.quarters(measure, beat, counting)
        left = length
        while True:
            bar_beats = self.measure_length(measure) / self.beat_quarters(measure, counting)
            room = bar_beats - (beat - FIRST_BEAT)
            if left <= room + 1e-9 or room <= 0:
                return self.quarters(measure, beat, counting) + left * self.beat_quarters(measure, counting) - start
            left -= room
            measure, beat = measure + 1, FIRST_BEAT

    def locate(self, quarter):
        """Return the (measure, beat) of a quarter position, the inverse of quarters."""
        measure = 1
        if quarter < -1e-7:
            while quarter < self.measure_start(measure) - 1e-7:
                measure -= 1
        else:
            while self._forward[-1] <= quarter + 1e-7:
                self._extend_to(len(self._forward) + 1)
            measure = bisect_right(self._forward, quarter + 1e-7)
        beat = FIRST_BEAT + (quarter - self.measure_start(measure)) / self.beat_quarters(measure)
        return measure, round(beat, 6)
