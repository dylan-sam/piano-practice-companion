"""Check the Nottingham slash-chord bass correction."""

import unittest

from build_nottingham_fix import corrected_value


class NottinghamBassTests(unittest.TestCase):
    """Restore ABC bass accidentals that ChoCo v1.0.0 dropped."""

    def test_sharp_bass_is_restored(self):
        """D/f+ is D/F#: the major third, not the minor third ChoCo stored."""
        self.assertEqual(corrected_value("D/f+", "D:maj/b3"), "D:maj/3")
        self.assertEqual(corrected_value("B7/f+", "B:7/b5"), "B:7/5")

    def test_correct_and_plain_chords_are_left_alone(self):
        """Keep chords that were converted correctly or have no accidental."""
        self.assertIsNone(corrected_value("Gm/b-", "G:min/b3"))  # already B-flat
        self.assertIsNone(corrected_value("G/b", "G:maj/3"))
        self.assertIsNone(corrected_value("D", "D:maj"))


if __name__ == "__main__":
    unittest.main()
