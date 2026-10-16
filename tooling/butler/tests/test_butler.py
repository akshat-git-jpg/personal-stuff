import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

BUTLER = Path(__file__).resolve().parent.parent / "butler.py"


class ButlerTest(unittest.TestCase):
    def setUp(self):
        self.env = {**os.environ, "BUTLER_STATE_DIR": tempfile.mkdtemp()}

    def run_b(self, *args):
        return subprocess.run([sys.executable, str(BUTLER), *args], env=self.env,
                              capture_output=True, text=True)

    def test_due_after_month_end(self):
        out = self.run_b("status", "--today", "2026-10-02").stdout
        self.assertEqual(out.count("DUE"), 3)
        self.assertEqual(out.count("(for 2026-09)"), 3)

    def test_window_opens_for_current_month(self):
        self.assertIn("(for 2026-10)", self.run_b("status", "--today", "2026-10-28").stdout)

    def test_january_rolls_back_a_year(self):
        self.assertIn("(for 2025-12)", self.run_b("status", "--today", "2026-01-03").stdout)

    def test_outside_window(self):
        self.assertIn("No month-end jobs due.", self.run_b("status", "--today", "2026-10-15").stdout)

    def test_done_then_next_period(self):
        self.run_b("done", "yt-income", "--today", "2026-10-02")
        out = self.run_b("status", "--today", "2026-10-03").stdout
        self.assertIn("DONE  yt-income  (for 2026-09)", out)
        self.assertEqual(out.count("DUE"), 2)
        out = self.run_b("status", "--today", "2026-10-27").stdout
        self.assertIn("DUE   yt-income  (for 2026-10)", out)

    def test_unknown_job(self):
        self.assertEqual(self.run_b("done", "nope").returncode, 2)

    def test_undo(self):
        self.run_b("done", "yt-income", "--today", "2026-10-02")
        self.run_b("undo", "yt-income", "--today", "2026-10-02")
        self.assertEqual(self.run_b("status", "--today", "2026-10-02").stdout.count("DUE"), 3)


if __name__ == "__main__":
    unittest.main()
