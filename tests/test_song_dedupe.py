"""Check how duplicate and very similar songs are recognized."""

import unittest

from song_dedupe import SimilarIndex, same_titles, song_shape, within_edits


def song(chords, start=0.0):
    """(onset, chord, measure) rows, one 4/4 bar per chord, from canonical Harte symbols."""
    return [(start + 4 * index, value, index + 1) for index, value in enumerate(chords)]


class TitleTests(unittest.TestCase):
    """Only versions of the same song are compared."""

    def test_related_titles(self):
        """Added composer, copy number or prefix words still name the same song."""
        self.assertTrue(same_titles("Misty - Erroll Garner", "Misty"))
        self.assertTrue(same_titles("P19 We Will Rock You", "We Will Rock You"))
        self.assertTrue(same_titles("Foggy Day, A", "A Foggy Day"))
        self.assertFalse(same_titles("Anthropology", "Dexterity"))
        self.assertFalse(same_titles("Blue", "Blue Monk"))


class ChordTests(unittest.TestCase):
    """Chords are compared up to a change of key and without sevenths."""

    def test_duplicates_up_to_key_and_sevenths(self):
        """ii-7 V7 I^7 in C equals ii V I in F."""
        a = song_shape(song(["D:min7", "G:7", "C:maj7"]))
        b = song_shape(song(["G:min", "C:maj", "F:maj"]))
        self.assertEqual(a[0], b[0])
        self.assertNotEqual(a[0], song_shape(song(["D:min", "G:min", "C:maj"]))[0])

    def test_very_similar(self):
        """Two changed chords and a bar more are still very similar; three changes are not."""
        base = ["C:maj", "A:min", "D:min", "G:7"] * 4
        index = SimilarIndex()
        _, sequence, bars = song_shape(song(base))
        index.add("kept", sequence, bars, "Night Song")
        changed = list(base)
        changed[5], changed[9] = "A:7", "D:7"
        _, sequence, bars = song_shape(song(changed + ["G:7"]))  # one bar more, same chord
        self.assertEqual(index.match(sequence, bars, "Night Song - Composer"), "kept")
        self.assertIsNone(index.match(sequence, bars, "Other Song"))
        self.assertFalse(within_edits([1, 2, 3, 4], [1, 9, 9, 9]))
        self.assertTrue(within_edits([1, 2, 3, 4], [1, 2, 4]))


if __name__ == "__main__":
    unittest.main()
