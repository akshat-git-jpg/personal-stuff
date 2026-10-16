import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp_cal import format_agenda  # noqa: E402

EVENTS = [
    {"summary": "Standup", "start": {"dateTime": "2026-10-16T10:00:00+05:30"},
     "end": {"dateTime": "2026-10-16T11:00:00+05:30"}},
    {"summary": "Late call", "start": {"dateTime": "2026-10-16T20:00:00Z"},
     "end": {"dateTime": "2026-10-16T21:00:00Z"}},
    {"summary": "Festival", "start": {"date": "2026-10-16"}, "end": {"date": "2026-10-18"}},
    {"summary": "Dropped", "status": "cancelled", "start": {"dateTime": "2026-10-16T12:00:00+05:30"},
     "end": {"dateTime": "2026-10-16T13:00:00+05:30"}},
    {"start": {"date": "2026-10-17"}, "end": {"date": "2026-10-18"}},
    {"summary": "Gym", "recurringEventId": "r1", "start": {"dateTime": "2026-10-16T06:30:00+05:30"},
     "end": {"dateTime": "2026-10-16T08:30:00+05:30"}},
]


class FormatAgendaTest(unittest.TestCase):
    def setUp(self):
        self.out = format_agenda(EVENTS, date(2026, 10, 16), 3)
        self.days = self.out.split("\n")

    def section(self, header):
        i = self.days.index(header)
        rest = self.days[i + 1:]
        end = next((j for j, l in enumerate(rest) if not l.startswith("  ")), len(rest))
        return rest[:end]

    def test_headers(self):
        for h in ("Fri 16 Oct", "Sat 17 Oct", "Sun 18 Oct"):
            self.assertIn(h, self.days)

    def test_timed_event(self):
        self.assertIn("  10:00-11:00  Standup", self.section("Fri 16 Oct"))

    def test_utc_event_lands_on_ist_day(self):
        self.assertIn("  01:30-02:30  Late call", self.section("Sat 17 Oct"))

    def test_all_day_spans_days_end_exclusive(self):
        self.assertIn("  all day      Festival", self.section("Fri 16 Oct"))
        self.assertIn("  all day      Festival", self.section("Sat 17 Oct"))
        self.assertEqual(self.section("Sun 18 Oct"), ["  (nothing)"])

    def test_cancelled_skipped_and_untitled(self):
        self.assertNotIn("Dropped", self.out)
        self.assertIn("  all day      (no title)", self.section("Sat 17 Oct"))

    def test_no_routine_hides_repeating(self):
        self.assertIn("Gym", self.out)
        quiet = format_agenda(EVENTS, date(2026, 10, 16), 3, no_routine=True)
        self.assertNotIn("Gym", quiet)
        self.assertIn("Standup", quiet)


if __name__ == "__main__":
    unittest.main()
