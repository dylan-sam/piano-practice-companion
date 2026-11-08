"""Check that every chord notation is read and written one way (docs/CHORD_NOTATION.md)."""

import unittest

from chord_notation import (canonical_harte, canonical_key, chart_key, chart_to_harte, harte_to_chart,
                            parse_harte, roman_chord, roman_root_pc, roman_rows, transpose_from_c)


class CanonicalHarteTests(unittest.TestCase):
    """One chord has one canonical spelling, whatever corpus wrote it."""

    def test_source_spellings_of_one_chord_agree(self):
        """BiaB, Real Book and iReal spellings of the same chord give the same symbol."""
        for written in ("C:(3,5,b7)", "C:maj(b7)", "C:7"):
            self.assertEqual(canonical_harte(written), "C:7")
        self.assertEqual(canonical_harte("C:min(b7)"), "C:min7")
        self.assertEqual(canonical_harte("C:maj(b7,9,11,13)"), "C:13")
        self.assertEqual(canonical_harte("C:hdim"), "C:hdim7")
        self.assertEqual(canonical_harte("C:6(9)"), "C:maj6(9)")

    def test_alterations_replace_the_natural_degree(self):
        """7(b5) and strict 7(b5,*5) are the same chord; aug(b7) is preferred to 7(#5,*5)."""
        self.assertEqual(canonical_harte("C:7(b5)"), "C:7(b5,*5)")
        self.assertEqual(canonical_harte("C:7(b5,*5)"), "C:7(b5,*5)")
        self.assertEqual(canonical_harte("C:7(#5,*5)"), "C:aug(b7)")
        self.assertEqual(canonical_harte("C:(3,5,b5,b7)"), "C:7(b5,5)")

    def test_canonical_form_is_stable(self):
        """Writing a canonical symbol again changes nothing."""
        for symbol in ("C:aug(b5,b7,b9,#9)", "Eb:min7/b7", "F#:1(bb3,b5,bb7)/bb3", "G:sus4(b7,9)"):
            self.assertEqual(canonical_harte(canonical_harte(symbol)), canonical_harte(symbol))

    def test_bass_and_no_chord(self):
        """The bass is an interval within the octave; N and X stay as they are."""
        chord = parse_harte("C:7(b9)/3")
        self.assertEqual((chord.root_pc, chord.bass_pc, chord.semitones(9)), (0, 4, 13))
        self.assertEqual(parse_harte("Eb:min/3").bass_pc, 7)
        self.assertEqual(canonical_harte("C:maj/1"), "C:maj")
        self.assertEqual(canonical_harte("N"), "N")
        self.assertIsNone(parse_harte("X"))


class ChartNotationTests(unittest.TestCase):
    """iReal Pro chart symbols convert to Harte and back without change."""

    def test_ireal_symbols_are_read_literally(self):
        """Read what the chart writes: 7#11 has no ninth, Ab#11 is Ab with a sharp eleventh."""
        cases = {"Bh7": "B:hdim7", "Bh": "B:hdim7", "C7#11": "C:7(#11)", "C7b13": "C:7(b13)",
                 "C13b9": "C:7(b9,11,13)", "C2": "C:sus2", "C5": "C:5", "Ebo": "Eb:dim",
                 "C7b9#9": "C:7(b9,#9)", "C-/Bb": "C:min/b7", "C-7/Bb": "C:min7/b7",
                 "Ab#11": "Ab:maj(#11)", "Gmaj": "G:maj", "Gmaj7": "G:maj7", "Dbmin7": "Db:min7"}
        for chart, harte in cases.items():
            self.assertEqual(chart_to_harte(chart), harte, chart)

    def test_round_trip(self):
        """Harte -> chart -> Harte gives back the same chord."""
        for harte in ("C:7(b9,11,13)", "C:aug(b7)", "C:min(#5,*5)", "F:maj(b6)/b6", "Bbb:maj(b5,*5)",
                      "C:7(*5)", "D:maj/3", "C:1", "C:sus4(b7,9,11,13)"):
            back = chart_to_harte(harte_to_chart(harte))
            self.assertEqual(parse_harte(back).tokens, parse_harte(canonical_harte(harte)).tokens, harte)
        self.assertEqual(harte_to_chart("C:7(b9,11,13)"), "C13b9")
        self.assertEqual(harte_to_chart("C:aug(b7)"), "C7#5")
        self.assertEqual(harte_to_chart("D:maj/3"), "D/F#")
        self.assertIsNone(harte_to_chart("N"))


class KeyAndRomanTests(unittest.TestCase):
    """Keys and Roman numerals have one spelling too."""

    def test_keys(self):
        """Mode words are normalized; iReal's C- is C minor."""
        self.assertEqual(canonical_key("C:majoror"), "C:major")
        self.assertEqual(canonical_key("Bb"), "Bb")
        self.assertEqual(chart_key("C-"), "C:minor")
        self.assertEqual(chart_key("Eb"), "Eb:major")

    def test_roman_numerals(self):
        """Degrees follow the tonic's major scale whatever the mode."""
        self.assertEqual(roman_chord("G:maj7", "F:minor"), "II:maj7")
        self.assertEqual(roman_chord("Gb:min", "F:minor"), "IIb:min")
        self.assertEqual(roman_root_pc("IIb", "F:minor"), 6)

    def test_roman_rows_follow_key_changes(self):
        """Each chord is read in the key in force at its onset; pickups take the first key."""
        rows = [(0, 0.3, 1, "G:7"), (1, 1.0, 4, "C:maj"), (2, 5.0, 4, "D:7")]
        keys = [(1.0, "C:major"), (5.0, "G:major")]
        self.assertEqual([r[3] for r in roman_rows(rows, keys)], ["V:7", "I:maj", "V:7"])


class TransposeTests(unittest.TestCase):
    """Jazz Corpus chords are written in C and moved to the song's key."""

    def test_transpose_from_c(self):
        """The root moves by its degree above C; the bass interval and quality stay."""
        self.assertEqual(transpose_from_c("Eb:7", "F"), "Ab:7")
        self.assertEqual(transpose_from_c("B:hdim7/b3", "Bb"), "A:hdim7/b3")
        self.assertEqual(transpose_from_c("F#:min", "Eb"), "A:min")
        self.assertEqual(transpose_from_c("N", "F"), "N")


if __name__ == "__main__":
    unittest.main()
