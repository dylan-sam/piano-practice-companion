"""Check bar, beat and quarter-note positions of score events."""

import unittest

from score_timing import MUSIC21_BEATS, QUARTERS, BarGrid, decode_measure_beat, is_compound, parse_time_signature


class ScoreTimingTests(unittest.TestCase):
    """Protect measure, beat, and meter-change timing rules."""

    def test_choco_numbers_are_measure_and_beat(self):
        """8.2333 is measure 8, beat 2 1/3, not a decimal time."""
        self.assertEqual(decode_measure_beat(8.1), (8, 1.0))
        self.assertEqual(decode_measure_beat(8.2333333), (8, 2.333333))

    def test_bar_one_beat_one_is_quarter_zero(self):
        """Beats count from 1 and bar 1 starts at quarter 0; a pickup bar is negative."""
        grid = BarGrid([(1, "4/4")])
        self.assertEqual(grid.quarters(1, 1), 0)
        self.assertEqual(grid.quarters(2, 3), 6)
        self.assertEqual(grid.quarters(0, 4), -1)
        self.assertEqual(grid.locate(6), (2, 3.0))
        self.assertEqual(grid.locate(-1), (0, 4.0))

    def test_meter_change_and_eighth_note_meter(self):
        """Bars after a change take the new length; beats are in the meter's unit."""
        grid = BarGrid([(1, "6/8"), (3, "3/4")])
        self.assertEqual(grid.measure_start(2), 3)
        self.assertEqual(grid.measure_start(4), 9)
        self.assertEqual(grid.beat_quarters(1), 0.5)
        self.assertEqual(grid.quarters(2, 4), 4.5)
        self.assertEqual(parse_time_signature("{'numerator': '4', 'denominator': None}"), (4, 4))

    def test_long_bars(self):
        """Beats 10 to 12 of a 12/8 bar are positions like any other."""
        grid = BarGrid([(1, "12/8")])
        self.assertEqual(grid.quarters(8, 10), 7 * 6 + 4.5)
        self.assertEqual(grid.locate(7 * 6 + 5.5), (8, 12.0))


    def test_music21_beats(self):
        """music21 counts compound meters by groups of three units; QUARTERS are quarter notes."""
        grid = BarGrid([(1, "6/8"), (2, "3/4")])
        self.assertEqual(grid.beat_quarters(1, MUSIC21_BEATS), 1.5)
        self.assertEqual(grid.beat_quarters(2, MUSIC21_BEATS), 1)
        self.assertEqual(grid.beat_quarters(1, QUARTERS), 1)
        self.assertEqual([is_compound(*m) for m in ((6, 8), (12, 8), (3, 8), (6, 4), (3, 4), (2, 2))],
                         [True, True, True, True, False, False])


    def test_length_across_a_meter_change(self):
        """Six music21 beats from a 6/8 bar over a 2/4 bar into 6/8: 3 + 2 + 3 quarters."""
        grid = BarGrid([(1, "6/8"), (2, "2/4"), (3, "6/8")])
        self.assertEqual(grid.length_quarters(1, 1, 6, MUSIC21_BEATS), 8)
        self.assertEqual(grid.length_quarters(1, 1, 2, MUSIC21_BEATS), 3)


if __name__ == "__main__":
    unittest.main()
