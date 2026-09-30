"""Offline tests for pp-flights: no network. Run: python3 test_pp_flights.py"""
import datetime as dt
import os
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pp_flights as p  # noqa: E402


def row(price, dep, stops=0):
    return {"price": price, "price_formatted": f"₹{price:,}", "tags": [],
            "legs": [{"from": "IDR", "to": "BLR", "depart": f"2026-11-09T{dep}:00",
                      "arrive": f"2026-11-09T{dep}:00", "duration_min": 125, "stops": stops,
                      "via": [], "airlines": ["IndiGo"], "flights": [], "day_offset": 0}]}


class Routes(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.mkdtemp()
        p.SKY_BLOCKED = os.path.join(tmp, "blocked")
        p.SKY_LAST = os.path.join(tmp, "last")
        os.environ.pop("PP_FLIGHTS_VPS", None)

    def test_each_route_has_its_own_files(self):
        self.assertEqual(p.route_file("/c/x", "local"), "/c/x")
        self.assertEqual(p.route_file("/c/x", "vps"), "/c/x-vps")

    def test_empty_env_disables_vps(self):
        os.environ["PP_FLIGHTS_VPS"] = ""
        self.assertEqual(p.sky_routes(), ["local"])
        del os.environ["PP_FLIGHTS_VPS"]

    def test_blocked_route_is_skipped_for_the_other(self):
        p.write_num(p.route_file(p.SKY_BLOCKED, "local"), time.time() + 600)
        self.assertEqual(p.pick_route(), "vps")

    def test_all_blocked_raises(self):
        for r in ("local", "vps"):
            p.write_num(p.route_file(p.SKY_BLOCKED, r), time.time() + 600)
        with self.assertRaises(p.SourceError):
            p.pick_route()


class AirScraper(unittest.TestCase):
    # trimmed from a real 2026-11-18 IDR->BLR answer
    ITIN = {"price": {"raw": 7262, "formatted": "₹7,262"}, "legs": [{
        "origin": {"displayCode": "IDR"}, "destination": {"displayCode": "BLR"},
        "durationInMinutes": 285, "stopCount": 1, "departure": "2026-11-18T17:05:00",
        "arrival": "2026-11-18T21:50:00", "timeDeltaInDays": 0,
        "carriers": {"marketing": [{"alternateId": "49", "name": "IndiGo"}]},
        "segments": [
            {"destination": {"displayCode": "HYD"}, "flightNumber": "6916",
             "marketingCarrier": {"alternateId": "49", "name": "IndiGo"}},
            {"destination": {"displayCode": "BLR"}, "flightNumber": "6505",
             "marketingCarrier": {"alternateId": "49", "name": "IndiGo"}}]}]}

    def test_reads_air_scraper_itineraries(self):
        [r] = p.sky_summarize({"itineraries": {"results": [self.ITIN]}}, "INR")
        self.assertEqual(r["price"], 7262)
        self.assertEqual(r["legs"][0]["flights"], ["6E6916", "6E6505"])
        self.assertEqual(r["legs"][0]["via"], ["HYD"])

    def test_quota_gate(self):
        p.AIR_QUOTA = os.path.join(tempfile.mkdtemp(), "q.json")
        self.assertTrue(p.air_quota_ok())
        with open(p.AIR_QUOTA, "w") as f:
            f.write('{"remaining": 1, "reset_at": %d}' % (time.time() + 600))
        self.assertFalse(p.air_quota_ok())
        with open(p.AIR_QUOTA, "w") as f:
            f.write('{"remaining": 0, "reset_at": %d}' % (time.time() - 1))
        self.assertTrue(p.air_quota_ok())


class Filters(unittest.TestCase):
    def test_direct_is_a_filter_after_the_search(self):
        rows = [row(9, "10:00"), row(5, "11:00", stops=1), row(7, "12:00")]
        self.assertEqual([r["price"] for r in p.shape(rows, True, "cheapest", 0)], [7, 9])
        self.assertEqual([r["price"] for r in p.shape(rows, False, "cheapest", 0)], [5, 7, 9])

    def test_time_window(self):
        self.assertTrue(p.in_window(row(1, "17:05"), "17:00", None))
        self.assertFalse(p.in_window(row(1, "09:05"), "17:00", None))


class Dates(unittest.TestCase):
    def test_formats(self):
        self.assertEqual(p.parse_date("2026-11-09"), dt.date(2026, 11, 9))
        self.assertEqual(p.parse_date("09-11-2026"), dt.date(2026, 11, 9))


if __name__ == "__main__":
    unittest.main()
