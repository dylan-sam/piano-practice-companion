"""Check how keys without a reliable mode are settled from their chords."""

import unittest

from chord_notation import canonical_key as normalize_key
from track_store import _mode_is_trusted
from key_modes import PARALLEL, WITH_RELATIVE, chord_family, settle_key


class KeyModeTests(unittest.TestCase):
    """Keep the tonic-chord rule and the per-collection trust rules stable."""

    def test_minor_tonic_chords_give_a_minor_key(self):
        """Blue Bossa as BiaB marks it: tonic C without mode, mostly Cm7."""
        chords = [(0, "min7", 8), (5, "min7", 8), (2, "hdim7", 4), (7, "7", 4), (0, "min7", 8)]
        self.assertEqual(settle_key(chords, 0, PARALLEL), (0, "minor"))

    def test_relative_minor_is_found_from_a_key_signature(self):
        """Blue Bossa as Wikifonia marks it: Eb major, but the tune centres on Cm7."""
        chords = [(0, "min7", 8), (5, "min7", 8), (2, "hdim7", 4), (7, "7", 4), (0, "min7", 8),
                  (3, "min7", 4), (8, "7", 4), (1, "maj7", 8)]
        self.assertEqual(settle_key(chords, 3, WITH_RELATIVE), (0, "minor"))
        # Without the relative reading the one Ebm7 bar wrongly makes it Eb minor
        self.assertEqual(settle_key(chords, 3, PARALLEL), (3, "minor"))

    def test_balanced_tonic_chords_stay_undecided(self):
        """Equal major and minor time on the tonic leaves the mode unknown."""
        self.assertIsNone(settle_key([(0, "maj", 4), (0, "min", 4)], 0))
        self.assertIsNone(settle_key([(7, "7", 4)], 0))

    def test_chord_family_uses_the_matcher_rule(self):
        """Read major and minor families like the progression matcher."""
        self.assertEqual(chord_family("min7"), "min")
        self.assertEqual(chord_family("7(b9)"), "maj")
        self.assertIsNone(chord_family("hdim7"))

    def test_key_spelling_and_trust(self):
        """Repair ChoCo's Jazz Corpus mode words; doubt Wikifonia majors only."""
        self.assertEqual(normalize_key("C:majoror"), "C:major")
        self.assertEqual(normalize_key("A:minoror"), "A:minor")
        self.assertEqual(normalize_key("Bb"), "Bb")
        self.assertTrue(_mode_is_trusted("ireal-pro", "C:major"))
        self.assertTrue(_mode_is_trusted("wikifonia", "A:minor"))
        self.assertFalse(_mode_is_trusted("wikifonia", "Eb:major"))
        self.assertFalse(_mode_is_trusted("biab-internet-corpus", "C:minor"))


if __name__ == "__main__":
    unittest.main()
