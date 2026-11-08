"""Check how exercise questions are cut from chart lines."""

import unittest

from build_exercises import question_line


def chart_of(bars, time=(4, 4)):
    """Build a minimal Studio chart with four-beat bars."""
    return {"time": list(time), "bars": [
        {"chords": [{"symbol": symbol, "beats": 4 / len(row)} for symbol in row], "cells": 4}
        for row in bars]}, [4.0 * index for index in range(len(bars))]


class BuildExercisesTests(unittest.TestCase):
    """Keep questions to one readable line with only the progression hidden."""

    def test_line_has_one_visible_bar_on_each_side(self):
        """Hide exactly the passage chords, including one that starts mid-bar."""
        chart, starts = chart_of([["C"], ["A-", "D-7"], ["G7"], ["C^7"], ["F"], ["E7"]])
        line = question_line(chart, starts, {"start_quarter": 6.0, "end_quarter": 16.0})
        self.assertEqual(line["time"], [4, 4])
        self.assertEqual([[chord["symbol"] for chord in bar["chords"]] for bar in line["bars"]],
                         [["C"], ["A-", "D-7"], ["G7"], ["C^7"], ["F"]])
        hidden = [chord["symbol"] for bar in line["bars"] for chord in bar["chords"]
                  if chord.get("hidden")]
        self.assertEqual(hidden, ["D-7", "G7", "C^7"])
        stepped = question_line(chart, starts, {"start_quarter": 6.0, "end_quarter": 16.0},
                                (6.0, 8.0, 12.0))
        self.assertEqual([chord["step"] for bar in stepped["bars"] for chord in bar["chords"]
                          if chord.get("hidden")], [0, 1, 2])

    def test_lines_need_context_and_a_short_gap(self):
        """Skip passages at the chart edges, across a key change, or longer than four bars."""
        chart, starts = chart_of([["D-7"], ["G7"], ["C"], ["C"]])
        self.assertIsNone(question_line(chart, starts, {"start_quarter": 0.0, "end_quarter": 12.0}))
        chart, starts = chart_of([["C"], ["D-7"], ["G7"], ["C"], ["C"], ["C"], ["F"]])
        self.assertIsNone(question_line(chart, starts, {"start_quarter": 4.0, "end_quarter": 24.0}))
        chart, starts = chart_of([["C"], ["D-7"], ["G7"], ["C"], ["F"]])
        chart["bars"][3]["comment"] = "Key: G:major"
        self.assertIsNone(question_line(chart, starts, {"start_quarter": 4.0, "end_quarter": 16.0}))


    def test_relaxed_lines_accept_edges_and_long_gaps(self):
        """Relaxed lines may start the song, end mid-bar, and hold a long gap."""
        chart, starts = chart_of([["D-7"], ["G7"], ["C"], ["C"], ["F"]])
        # A ii-V-I that opens the song: no bar before, the bar after is kept
        line = question_line(chart, starts, {"start_quarter": 0.0, "end_quarter": 16.0}, relaxed=True)
        self.assertEqual([[c["symbol"] for c in bar["chords"]] for bar in line["bars"]],
                         [["D-7"], ["G7"], ["C"], ["C"], ["F"]])
        self.assertIsNone(question_line(chart, starts, {"start_quarter": 0.0, "end_quarter": 16.0}))

    def test_relaxed_lines_stay_within_six_bars_and_one_key(self):
        """Drop a neighbour bar in another key; refuse lines over six bars."""
        chart, starts = chart_of([["C"], ["D-7"], ["G7"], ["C"], ["F"]])
        chart["bars"][4]["comment"] = "Key: F:major"
        line = question_line(chart, starts, {"start_quarter": 4.0, "end_quarter": 16.0}, relaxed=True)
        self.assertEqual(len(line["bars"]), 4)  # C | gap x3, without the F bar
        long_chart, long_starts = chart_of([["C"]] + [["D-7"]] * 6 + [["G7"], ["C"]])
        self.assertIsNone(question_line(long_chart, long_starts,
                                        {"start_quarter": 4.0, "end_quarter": 36.0}, relaxed=True))

if __name__ == "__main__":
    unittest.main()
