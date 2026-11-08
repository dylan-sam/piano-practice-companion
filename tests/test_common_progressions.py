import unittest

from common_progressions import roman_label, build_catalog, convert_progression


class CommonProgressionTests(unittest.TestCase):
    """Check conversion of written progressions to catalog chords."""

    def test_conversion(self):
        """Convert shorthand and explicit chord qualities consistently."""
        self.assertEqual(convert_progression("ii–IIb7–I"), ["II:min", "IIb:7", "I:maj"])
        self.assertEqual(convert_progression("i—VIIb—VIb—V"), ["I:min", "VIIb:maj", "VIb:maj", "V:maj"])
        self.assertEqual(convert_progression("i-VIIb-VIb-VIIb"), ["I:min", "VIIb:maj", "VIb:maj", "VIIb:maj"])
        self.assertEqual(convert_progression("VIb VIIb I"), ["VIb:maj", "VIIb:maj", "I:maj"])
        self.assertEqual(convert_progression("V–iv–I"), ["V:maj", "IV:min", "I:maj"])
        self.assertEqual(convert_progression("I:maj – VIIb:maj – IV:maj – I:maj"),
                         ["I:maj", "VIIb:maj", "IV:maj", "I:maj"])
        self.assertEqual(convert_progression("II:maj – V:maj – I:maj"),
                         ["II:maj", "V:maj", "I:maj"])
        self.assertEqual(convert_progression("IV:min – V:maj – I:min"),
                         ["IV:min", "V:maj", "I:min"])

    def test_no_repeated_progressions(self):
        """Keep one catalog entry per unique Roman chord sequence."""
        entries = build_catalog()
        self.assertEqual(len(entries), 20)
        self.assertEqual(len({tuple(entry["chords"]) for entry in entries}), 20)

    def test_roman_labels(self):
        """Use lowercase minor numerals and place accidentals first."""
        self.assertEqual(roman_label(["II:min", "V:maj", "I:maj"]), "ii \u2013 V \u2013 I")
        self.assertEqual(roman_label(["II:min", "IIb:7", "I:maj"]), "ii \u2013 \u266dII7 \u2013 I")
        self.assertEqual(roman_label(["I:min", "VIIb:maj", "VIb:maj", "V:maj"]),
                         "i \u2013 \u266dVII \u2013 \u266dVI \u2013 V")


if __name__ == "__main__":
    unittest.main()
