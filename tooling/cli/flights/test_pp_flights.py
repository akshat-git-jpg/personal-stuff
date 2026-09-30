"""Offline tests for pp-flights: no network. Run: python3 test_pp_flights.py"""
import base64
import datetime as dt
import os
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pp_flights as p  # noqa: E402


def row(src, price, dep, arr, stops=0, flights=()):
    return {"price": price, "price_formatted": f"₹{price:,}", "currency": "INR", "tags": [],
            "source": src, "legs": [{"from": "IDR", "to": "BLR", "depart": f"2026-11-09T{dep}:00",
                                     "arrive": f"2026-11-09T{arr}:00", "duration_min": 125,
                                     "stops": stops, "via": [], "airlines": ["IndiGo"],
                                     "flights": list(flights), "day_offset": 0}]}


class Tfs(unittest.TestCase):
    def test_matches_known_google_url(self):
        # Built by fast-flights for IDR->BLR 2026-11-09, economy, 1 adult, one-way.
        leg = (p.pb_len(2, b"2026-11-09") + p.pb_len(13, p.pb_len(2, b"IDR"))
               + p.pb_len(14, p.pb_len(2, b"BLR")))
        tfs = p.pb_len(3, leg) + p.pb_len(8, b"\x01") + p.pb_int(9, 1) + p.pb_int(19, 2)
        self.assertEqual(base64.urlsafe_b64encode(tfs).decode().rstrip("="),
                         "GhoSCjIwMjYtMTEtMDlqBRIDSURScgUSA0JMUkIBAUgBmAEC")


class Merge(unittest.TestCase):
    def test_same_flight_keeps_both_prices_and_the_lower_one(self):
        g = [row("google", 9190, "21:45", "23:50", flights=["6E6744"])]
        s = [row("skyscanner", 9018, "21:45", "23:50")]
        [m] = p.merge(g, s)
        self.assertEqual(m["prices"], {"google": 9190, "skyscanner": 9018})
        self.assertEqual(m["price"], 9018)
        self.assertEqual(m["legs"][0]["flights"], ["6E6744"])
        self.assertEqual(m["source"], "google+skyscanner")

    def test_different_times_stay_separate(self):
        out = p.merge([row("google", 1, "09:40", "11:45")], [row("skyscanner", 2, "21:45", "23:50")])
        self.assertEqual(len(out), 2)


class SkyscannerGate(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        p.SKY_BLOCKED = os.path.join(self.tmp, "blocked")
        p.SKY_LAST = os.path.join(self.tmp, "last")

    def test_refuses_while_blocked(self):
        p.write_num(p.SKY_BLOCKED, time.time() + 600)
        with self.assertRaises(p.SourceError):
            p.sky_gate("local")

    def test_passes_when_idle(self):
        p.sky_gate("local")
        self.assertGreater(p.read_num(p.SKY_LAST), 0)


class Routes(unittest.TestCase):
    def test_vps_route_has_its_own_state_files(self):
        self.assertEqual(p.route_file("/c/skyscanner-blocked", "local"), "/c/skyscanner-blocked")
        self.assertEqual(p.route_file("/c/skyscanner-blocked", "vps"), "/c/skyscanner-blocked-vps")

    def test_empty_env_disables_vps(self):
        os.environ["PP_FLIGHTS_VPS"] = ""
        try:
            self.assertEqual(p.sky_routes(), ["local"])
        finally:
            del os.environ["PP_FLIGHTS_VPS"]


class Shape(unittest.TestCase):
    def test_direct_and_cheapest(self):
        rows = [row("google", 9, "1", "2"), row("google", 5, "3", "4", stops=1), row("google", 7, "5", "6")]
        out = p.shape(rows, True, "cheapest", 0)
        self.assertEqual([r["price"] for r in out], [7, 9])


class Dates(unittest.TestCase):
    def test_formats(self):
        self.assertEqual(p.parse_date("2026-11-09"), dt.date(2026, 11, 9))
        self.assertEqual(p.parse_date("09-11-2026"), dt.date(2026, 11, 9))


if __name__ == "__main__":
    unittest.main()
