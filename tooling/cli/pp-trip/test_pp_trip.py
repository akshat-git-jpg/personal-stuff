#!/usr/bin/env python3
"""Tests for pp-trip's pure helpers.

Stdlib unittest only, no third-party deps and no network, so this runs the same
on the owner's Mac and on the Windows clone:

    python3 tooling/cli/pp-trip/test_pp_trip.py

These cover the five functions where a silent bug turns into a wrong pin on a
map: viewbox parsing (the axis order is genuinely confusing), the containment
check, distance, the address/hint match, and cache-key normalisation.
"""

import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))

import pp_trip as pt  # noqa: E402


# Varkala's real box, as it appears in trips/varkala-sep-2026.json.
VB = "76.65,8.80,76.85,8.60"


class TestParseViewbox(unittest.TestCase):
    def test_nominatim_order_is_w_n_e_s(self):
        # Second field is NORTH (the larger latitude) even though it comes
        # before south. Getting this backwards silently inverts the box.
        self.assertEqual(pt.parse_viewbox(VB), (76.65, 8.80, 76.85, 8.60))

    def test_tolerates_spaces(self):
        self.assertEqual(pt.parse_viewbox(" 76.65 , 8.80 ,76.85, 8.60 "), (76.65, 8.80, 76.85, 8.60))

    def test_rejects_wrong_arity(self):
        self.assertIsNone(pt.parse_viewbox("76.65,8.80,76.85"))
        self.assertIsNone(pt.parse_viewbox(""))

    def test_rejects_non_numeric(self):
        self.assertIsNone(pt.parse_viewbox("76.65,north,76.85,8.60"))


class TestInViewbox(unittest.TestCase):
    def test_inside(self):
        self.assertTrue(pt.in_viewbox(8.7307, 76.7105, VB))  # Gouri's Homestay

    def test_outside_far(self):
        # "Kappil Beach" in Kasaragod, ~500 km north. The original bug.
        self.assertFalse(pt.in_viewbox(12.4996, 74.9869, VB))

    def test_outside_just_barely(self):
        self.assertFalse(pt.in_viewbox(8.5999, 76.70, VB))

    def test_on_the_boundary_counts_as_inside(self):
        self.assertTrue(pt.in_viewbox(8.60, 76.65, VB))

    def test_no_box_means_no_opinion(self):
        self.assertTrue(pt.in_viewbox(0.0, 0.0, None))
        self.assertTrue(pt.in_viewbox(0.0, 0.0, ""))

    def test_malformed_box_does_not_reject_everything(self):
        # A typo in the trip file must not silently drop every pin.
        self.assertTrue(pt.in_viewbox(8.73, 76.71, "garbage"))


class TestHaversine(unittest.TestCase):
    def test_zero(self):
        self.assertAlmostEqual(pt.haversine_m(8.73, 76.71, 8.73, 76.71), 0.0, places=6)

    def test_known_short_gap(self):
        # Zostel Varkala: Google 8.744874,76.698591 vs Overture 8.744835,76.698517.
        d = pt.haversine_m(8.744874, 76.698591, 8.744835, 76.698517)
        self.assertLess(d, 20)
        self.assertGreater(d, 1)

    def test_known_long_gap(self):
        # The Sivagiri Mutt error: pinned 8.7275,76.7275 vs real 8.738879,76.732411.
        d = pt.haversine_m(8.7275, 76.7275, 8.738879, 76.732411)
        self.assertGreater(d, 1200)
        self.assertLess(d, 1600)

    def test_symmetric(self):
        a = pt.haversine_m(8.73, 76.71, 8.74, 76.72)
        b = pt.haversine_m(8.74, 76.72, 8.73, 76.71)
        self.assertAlmostEqual(a, b, places=6)


class TestAddressMatchesHint(unittest.TestCase):
    HINT = "Varkala, Kerala, India"

    def test_full_match(self):
        self.assertTrue(pt.address_matches_hint(
            "Cliff Beach Hospitality, North Cliff, Varkala, Kerala 695141, India", self.HINT))

    def test_partial_match_is_enough(self):
        # Google often drops the town and gives only the state. Requiring every
        # token would reject good answers, which is the failure we are avoiding.
        self.assertTrue(pt.address_matches_hint("Kappil Beach, Kerala 695311, India", self.HINT))

    def test_case_insensitive(self):
        self.assertTrue(pt.address_matches_hint("VARKALA, KERALA", self.HINT))

    def test_rejects_another_state(self):
        self.assertFalse(pt.address_matches_hint("Kappil, Kasaragod, Karnataka", self.HINT))

    def test_no_hint_accepts_anything(self):
        self.assertTrue(pt.address_matches_hint("anywhere at all", None))
        self.assertTrue(pt.address_matches_hint("anywhere at all", ""))

    def test_empty_address_with_a_hint_is_rejected(self):
        self.assertFalse(pt.address_matches_hint("", self.HINT))


class TestHintTokens(unittest.TestCase):
    def test_splits_and_lowercases(self):
        self.assertEqual(pt.hint_tokens("Varkala, Kerala, India"), ["varkala", "kerala", "india"])

    def test_drops_empties(self):
        self.assertEqual(pt.hint_tokens("Varkala,, ,Kerala"), ["varkala", "kerala"])

    def test_empty(self):
        self.assertEqual(pt.hint_tokens(""), [])


class TestNormQuery(unittest.TestCase):
    def test_case_and_spacing_collapse(self):
        self.assertEqual(pt.norm_query("  Cafe   Sarwaa  "), "cafe sarwaa")
        self.assertEqual(pt.norm_query("CAFE SARWAA"), "cafe sarwaa")

    def test_distinct_names_stay_distinct(self):
        self.assertNotEqual(pt.norm_query("Hope Hostels Helipad"),
                            pt.norm_query("Hope Hostels North Cliff"))

    def test_newlines_and_tabs_collapse(self):
        self.assertEqual(pt.norm_query("cafe\n\tsarwaa"), "cafe sarwaa")

    def test_empty(self):
        self.assertEqual(pt.norm_query(""), "")
        self.assertEqual(pt.norm_query(None), "")


class TestMakePinId(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(pt.make_pin_id("Cafe Sarwaa", "food", set()), "food-cafe-sarwaa")

    def test_dedupes(self):
        existing = {"food-cafe-sarwaa"}
        self.assertEqual(pt.make_pin_id("Cafe Sarwaa", "food", existing), "food-cafe-sarwaa-2")

    def test_strips_punctuation(self):
        self.assertEqual(pt.make_pin_id("Molly's Hostel!", "stay", set()), "stay-molly-s-hostel")

    def test_unnameable_falls_back(self):
        self.assertEqual(pt.make_pin_id("!!!", "sight", set()), "sight-pin")


class TestReadEnvFile(unittest.TestCase):
    def _write(self, text: str) -> Path:
        import tempfile
        fh = tempfile.NamedTemporaryFile("w", suffix=".env", delete=False, encoding="utf-8", newline="")
        fh.write(text)
        fh.close()
        self.addCleanup(lambda: Path(fh.name).unlink(missing_ok=True))
        return Path(fh.name)

    def test_reads_value(self):
        p = self._write("GOOGLE_PLACES_KEY=abc123\n")
        self.assertEqual(pt._read_env_file(p, "GOOGLE_PLACES_KEY"), "abc123")

    def test_strips_windows_line_ending(self):
        # A CRLF-saved file leaves \r on the value, which becomes an invisible
        # carriage return inside an HTTP header and yields an unexplainable 403.
        p = self._write("GOOGLE_PLACES_KEY=abc123\r\n")
        self.assertEqual(pt._read_env_file(p, "GOOGLE_PLACES_KEY"), "abc123")

    def test_skips_comments_and_blanks(self):
        p = self._write("# a comment\n\nGOOGLE_PLACES_KEY=xyz\n")
        self.assertEqual(pt._read_env_file(p, "GOOGLE_PLACES_KEY"), "xyz")

    def test_strips_quotes(self):
        p = self._write('GOOGLE_PLACES_KEY="quoted"\n')
        self.assertEqual(pt._read_env_file(p, "GOOGLE_PLACES_KEY"), "quoted")

    def test_missing_key_returns_none(self):
        p = self._write("OTHER=1\n")
        self.assertIsNone(pt._read_env_file(p, "GOOGLE_PLACES_KEY"))

    def test_missing_file_returns_none(self):
        self.assertIsNone(pt._read_env_file(Path("/nonexistent/nope.env"), "GOOGLE_PLACES_KEY"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
