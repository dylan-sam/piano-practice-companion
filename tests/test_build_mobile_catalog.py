"""Check the progression masks of the mobile catalog."""

import json
import tempfile
import unittest
from pathlib import Path

from build_mobile_catalog import progression_masks


class MaskTests(unittest.TestCase):
    """Bit i of a version's mask means it contains the i-th catalog progression."""

    def test_masks_follow_catalog_order(self):
        """A song in the first and third progressions gets bits 0 and 2."""
        catalog = [{"id": "p1", "songs": [{"track_id": "a"}, {"track_id": "b"}]},
                   {"id": "p2", "songs": [{"track_id": "b"}]},
                   {"id": "p3", "songs": [{"track_id": "a"}]}]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "catalog.json"
            path.write_text(json.dumps(catalog), encoding="utf-8")
            self.assertEqual(progression_masks(path), {"a": 0b101, "b": 0b011})


if __name__ == "__main__":
    unittest.main()
