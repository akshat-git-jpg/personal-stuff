#!/usr/bin/env python3
"""Tests for the income attribution engine and the privacy guarantees.

Runs standalone — no pytest needed:

    python3 test_income.py

The invariant under test everywhere is the one the dashboard's honesty rests on:
tools + untraced == the bank total, for every month.
"""

import datetime as dt
import json
import pathlib
import sys
import tempfile
import unittest
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import attribute  # noqa: E402
import sources    # noqa: E402


def credit(cid, date, amount, rail):
    return {"id": cid, "date": attribute.parse_day(date), "amount": amount, "rail": rail}


def with_credits(credits):
    """Patch the bank loader so a test supplies its own ledger."""
    return mock.patch.object(attribute, "load_bank_credits", lambda rails: list(credits))


def paypal_month(month, programs):
    return {"month": month,
            "programs": [{"program": t, "bank_amount": f"{a:.2f}"} for t, a in programs]}


class Invariant(unittest.TestCase):
    """tools + untraced must always equal the bank total."""

    def assert_tallies(self, months):
        for m, d in months.items():
            traced = sum(t["amount"] for t in d["tools"])
            total = traced + d["untraced"]["amount"]
            self.assertAlmostEqual(
                total, d["bank_total"], delta=1.0,
                msg=f"{m}: tools+untraced={total:.2f} but bank={d['bank_total']:.2f}")

    def test_paypal_exact_one_to_one(self):
        credits = [credit("a", "03/08/2026", 9165.59, "paypal")]
        with with_credits(credits):
            months, _ = attribute.attribute(
                ["paypal"], [paypal_month("2026-08", [("Дигитал", 9165.59)])])
        self.assert_tallies(months)
        aug = months["2026-08"]
        self.assertEqual(aug["untraced"]["amount"], 0.0)
        self.assertEqual(aug["tools"][0]["tool"], "Дигитал")
        self.assertEqual(aug["tools"][0]["confidence"], "exact")

    def test_paypal_one_program_split_across_credits(self):
        """HeyGen's Aug payout really did arrive as two separate NEFT credits."""
        credits = [credit("a", "06/08/2026", 7014.74, "paypal"),
                   credit("b", "21/08/2026", 5257.54, "paypal")]
        with with_credits(credits):
            months, _ = attribute.attribute(
                ["paypal"], [paypal_month("2026-08", [("HeyGen", 12272.28)])])
        self.assert_tallies(months)
        self.assertEqual(months["2026-08"]["untraced"]["amount"], 0.0)
        self.assertEqual(months["2026-08"]["tools"][0]["amount"], 12272.28)

    def test_paypal_grouped_batch(self):
        """Two credits settling four programs — the June 2026 shape."""
        credits = [credit("a", "02/06/2026", 17464.93, "paypal"),
                   credit("b", "15/06/2026", 7902.21, "paypal")]
        progs = [("Book Bolt", 15763.57), ("EverBee", 5769.37),
                 ("Creatify", 2132.84), ("HeyGen", 1701.36)]
        with with_credits(credits):
            months, _ = attribute.attribute(["paypal"], [paypal_month("2026-06", progs)])
        self.assert_tallies(months)
        jun = months["2026-06"]
        self.assertEqual(jun["untraced"]["amount"], 0.0)
        self.assertEqual({t["tool"] for t in jun["tools"]},
                         {"Book Bolt", "EverBee", "Creatify", "HeyGen"})
        # Weaker than exact: we know the month, not which credit paid which program.
        self.assertTrue(all(t["confidence"] == "grouped" for t in jun["tools"]))

    def test_unmatched_paypal_credit_stays_untraced(self):
        credits = [credit("a", "03/08/2026", 5000.00, "paypal")]
        with with_credits(credits):
            months, _ = attribute.attribute(
                ["paypal"], [paypal_month("2026-08", [("HeyGen", 9999.99)])])
        self.assert_tallies(months)
        self.assertEqual(months["2026-08"]["untraced"]["amount"], 5000.00)
        self.assertEqual(months["2026-08"]["tools"], [])


class PartnerStack(unittest.TestCase):

    def ps(self, payouts, rewards):
        return {"payouts": payouts, "rewards": rewards, "tools": []}

    def test_matched_payout_splits_across_tools(self):
        credits = [credit("a", "06/03/2026", 7567.40, "airwallex")]
        ps = self.ps(
            [{"key": "p1", "date": "2026-03-03", "amount": 85.29,
              "currency": "USD", "status": "successful"}],
            [{"key": "r1", "date": "2026-02-01", "amount": 60.0,
              "tool": "Eleven Labs Inc.", "currency": "USD"},
             {"key": "r2", "date": "2026-02-10", "amount": 25.29,
              "tool": "n8n GmbH", "currency": "USD"}],
        )
        with with_credits(credits):
            months, notes = attribute.attribute(["airwallex"], [], ps=ps)
        self.assert_tallies = Invariant.assert_tallies.__get__(self)
        self.assert_tallies(months)
        mar = months["2026-03"]
        self.assertEqual(mar["untraced"]["amount"], 0.0)
        # Legal suffixes are stripped even with no alias configured.
        self.assertEqual({t["tool"] for t in mar["tools"]},
                         {"Eleven Labs", "n8n"})
        self.assertTrue(all(t["confidence"] == "matched" for t in mar["tools"]))
        self.assertAlmostEqual(mar["tools"][0]["implied_fx"], 88.72, places=1)

    def test_rate_outside_band_is_refused(self):
        """A credit that happens to sit in the window but implies an absurd rate."""
        credits = [credit("a", "07/05/2026", 7988.68, "airwallex")]
        ps = self.ps(
            [{"key": "p1", "date": "2026-05-04", "amount": 35.64,
              "currency": "USD", "status": "successful"}],
            [{"key": "r1", "date": "2026-04-01", "amount": 35.64, "tool": "n8n GmbH"}],
        )
        with with_credits(credits):
            months, notes = attribute.attribute(["airwallex"], [], ps=ps)
        self.assertEqual(months["2026-05"]["untraced"]["amount"], 7988.68)
        self.assertEqual(months["2026-05"]["tools"], [])
        self.assertEqual(notes["partnerstack"][0]["reason"], "no_candidate")

    def test_ambiguous_match_is_refused(self):
        """Two credits both fit — guessing would corrupt the source of truth."""
        credits = [credit("a", "05/03/2026", 7567.40, "airwallex"),
                   credit("b", "06/03/2026", 7500.00, "airwallex")]
        ps = self.ps(
            [{"key": "p1", "date": "2026-03-03", "amount": 85.29,
              "currency": "USD", "status": "successful"}],
            [{"key": "r1", "date": "2026-02-01", "amount": 85.29, "tool": "Eleven Labs Inc."}],
        )
        with with_credits(credits):
            months, notes = attribute.attribute(["airwallex"], [], ps=ps)
        self.assertEqual(months["2026-03"]["tools"], [])
        self.assertAlmostEqual(months["2026-03"]["untraced"]["amount"], 15067.40, places=2)
        self.assertEqual(notes["partnerstack"][0]["reason"], "ambiguous")


class Impact(unittest.TestCase):

    def test_inferred_match_is_labelled(self):
        # Earned in Jan, paid 20 days after month end — inside the lag window.
        credits = [credit("a", "20/02/2026", 1383.00, "airwallex")]
        impact = {"2026-01": [{"tool": "InVideo", "amount": 1383.00}]}
        with with_credits(credits):
            months, _ = attribute.attribute(["airwallex"], [], impact=impact)
        feb = months["2026-02"]
        self.assertEqual(feb["untraced"]["amount"], 0.0)
        self.assertEqual(feb["tools"][0]["tool"], "InVideo")
        self.assertEqual(feb["tools"][0]["confidence"], "inferred")

    def test_outside_lag_window_is_refused(self):
        credits = [credit("a", "02/02/2026", 1383.00, "airwallex")]  # only 2 days later
        impact = {"2026-01": [{"tool": "InVideo", "amount": 1383.00}]}
        with with_credits(credits):
            months, notes = attribute.attribute(["airwallex"], [], impact=impact)
        self.assertEqual(months["2026-02"]["untraced"]["amount"], 1383.00)
        self.assertEqual(notes["impact"][0]["reason"], "no_candidate")


class EdgeCases(unittest.TestCase):

    def test_no_credits_at_all(self):
        with with_credits([]):
            months, _ = attribute.attribute(["paypal"], [])
        self.assertEqual(months, {})

    def test_confidence_order_paypal_wins_a_contested_credit(self):
        """PayPal runs first, so a credit it can name is never re-claimed."""
        credits = [credit("a", "06/03/2026", 7567.40, "paypal")]
        ps = {"payouts": [{"key": "p1", "date": "2026-03-03", "amount": 85.29,
                           "currency": "USD", "status": "successful"}],
              "rewards": [{"key": "r1", "date": "2026-02-01", "amount": 85.29,
                           "tool": "Eleven Labs Inc."}]}
        with with_credits(credits):
            months, _ = attribute.attribute(
                ["paypal", "airwallex"],
                [paypal_month("2026-03", [("HeyGen", 7567.40)])], ps=ps)
        mar = months["2026-03"]
        self.assertEqual(len(mar["tools"]), 1)
        self.assertEqual(mar["tools"][0]["tool"], "HeyGen")
        self.assertEqual(mar["tools"][0]["confidence"], "exact")


class ManualAttribution(unittest.TestCase):
    """The exit route for untraced money: what the owner establishes by hand."""

    def test_manual_entry_names_an_otherwise_untraced_credit(self):
        credits = [credit("a", "19/03/2026", 22084.36, "airwallex")]
        manual = [{"date": "19/03/2026", "amount": 22084.36, "tool": "Base44",
                   "route": ["impact.com", "Airwallex"],
                   "note": "confirmed in the dashboard"}]
        with with_credits(credits):
            months, _ = attribute.attribute(["airwallex"], [], manual=manual)
        mar = months["2026-03"]
        self.assertEqual(mar["untraced"]["amount"], 0.0)
        self.assertEqual(mar["tools"][0]["tool"], "Base44")
        self.assertEqual(mar["tools"][0]["confidence"], "confirmed")
        self.assertEqual(mar["tools"][0]["route"], ["impact.com", "Airwallex"])

    def test_manual_outranks_every_heuristic(self):
        """A hand-confirmed claim must survive a competing automatic match."""
        credits = [credit("a", "06/03/2026", 7567.40, "airwallex")]
        ps = {"payouts": [{"key": "p1", "date": "2026-03-03", "amount": 85.29,
                           "currency": "USD", "status": "successful"}],
              "rewards": [{"key": "r1", "date": "2026-02-01", "amount": 85.29,
                           "tool": "Eleven Labs Inc."}]}
        manual = [{"date": "06/03/2026", "amount": 7567.40, "tool": "Jungle Scout",
                   "route": ["PartnerStack", "Airwallex"]}]
        with with_credits(credits):
            months, _ = attribute.attribute(["airwallex"], [], ps=ps, manual=manual)
        tools = months["2026-03"]["tools"]
        self.assertEqual(len(tools), 1)
        self.assertEqual(tools[0]["tool"], "Jungle Scout")
        self.assertEqual(tools[0]["confidence"], "confirmed")

    def test_manual_entry_that_matches_nothing_is_ignored(self):
        credits = [credit("a", "19/03/2026", 22084.36, "airwallex")]
        manual = [{"date": "01/01/2026", "amount": 999.0, "tool": "Ghost", "route": []}]
        with with_credits(credits):
            months, _ = attribute.attribute(["airwallex"], [], manual=manual)
        self.assertEqual(months["2026-03"]["untraced"]["amount"], 22084.36)
        self.assertEqual(months["2026-03"]["tools"], [])


class UntracedDetail(unittest.TestCase):
    """Untraced must never be a bare 'unknown' — it carries what we do know."""

    def test_carries_rail_label_and_bank_reference(self):
        with mock.patch.object(attribute, "load_bank_credits", lambda rails: [
            {"id": "a", "date": attribute.parse_day("19/03/2026"), "amount": 22084.36,
             "rail": "airwallex", "ref": "607882704572"}]):
            months, _ = attribute.attribute(
                ["airwallex"], [], rail_labels={"airwallex": "Airwallex"})
        c = months["2026-03"]["untraced"]["credits"][0]
        self.assertEqual(c["rail_label"], "Airwallex")
        self.assertEqual(c["ref"], "607882704572")
        self.assertIn("Airwallex", months["2026-03"]["untraced"]["reasons"])

    def test_extracts_reference_from_real_remark_shapes(self):
        cases = [
            ("IMPS-IN/607882704572/7259033210/AIRWALLE", "607882704572"),
            ("IMPS- IN/620464855840/917259033210/AIRWALLE", "620464855840"),
            ("NEFT_IN:34CITIN26717459833CITI0100000//CITIN26717459833/PAYPAL PAYMENTS",
             "CITIN26717459833"),
        ]
        for remark, want in cases:
            self.assertEqual(attribute.extract_ref(remark), want, remark)
        self.assertIsNone(attribute.extract_ref("BY CASH"))

    def test_leads_point_at_nearby_unmatched_payouts(self):
        credits = [credit("a", "19/03/2026", 22084.36, "airwallex")]
        impact = {"2026-02": [{"tool": "Base44", "amount": 8911.96}]}
        with with_credits(credits):
            months, _ = attribute.attribute(
                ["airwallex"], [], impact=impact, rail_labels={"airwallex": "Airwallex"})
        leads = months["2026-03"]["untraced"]["credits"][0]["leads"]
        self.assertTrue(leads, "a nearby unmatched impact month should surface as a lead")
        self.assertEqual(leads[0]["source"], "impact.com")


class ToolNames(unittest.TestCase):
    """Payer names become names the owner recognises, and duplicates merge."""

    ALIASES = {
        "Nine Thirty Five LLC": "Fliki",
        "Book Bolt LLC": "Book Bolt",
        "Heygen Technology Inc.": "HeyGen",
    }

    def test_strips_legal_suffixes_without_an_alias(self):
        for raw, want in [
            ("Pictory, Corp", "Pictory"),
            ("TradingView, Inc.", "TradingView"),
            ("Synthesia Limited", "Synthesia"),
            ("n8n GmbH", "n8n"),
            ("Nine Thirty Five LLC", "Nine Thirty Five"),
        ]:
            self.assertEqual(attribute.canonical_tool(raw), want, raw)

    def test_alias_beats_suffix_stripping(self):
        self.assertEqual(
            attribute.canonical_tool("Heygen Technology Inc.", self.ALIASES), "HeyGen")

    def test_payer_note_beats_a_plausible_guess(self):
        """'Nine Thirty Five LLC' looks anonymous; its PayPal note says Fliki."""
        self.assertEqual(
            attribute.canonical_tool("Nine Thirty Five LLC", self.ALIASES), "Fliki")

    def test_unaliased_cyrillic_entity_is_not_silently_merged(self):
        """Without an alias it keeps its own identity — never folded into a guess."""
        out = attribute.canonical_tool("Дигитал Маркетинг Солутионс 2011 ООД", self.ALIASES)
        self.assertNotEqual(out, "Book Bolt")
        self.assertTrue(out.startswith("Дигитал"))

    def test_leaves_a_clean_name_alone(self):
        for name in ("EverBee", "Jungle Scout", "Base44", "Kittl"):
            self.assertEqual(attribute.canonical_tool(name, self.ALIASES), name)

    def test_two_profiles_of_the_SAME_tool_merge_into_one_row(self):
        """An alias may deliberately merge two payer profiles onto one tool."""
        aliases = {"Book Bolt LLC": "Book Bolt", "Book Bolt EU": "Book Bolt"}
        credits = [credit("a", "10/06/2026", 15763.57, "paypal"),
                   credit("b", "03/08/2026", 9165.59, "paypal")]
        pp = [paypal_month("2026-06", [("Book Bolt LLC", 15763.57)]),
              paypal_month("2026-08", [("Book Bolt EU", 9165.59)])]
        with with_credits(credits):
            months, _ = attribute.attribute(["paypal"], pp, aliases=aliases)
        names = {t["tool"] for m in months.values() for t in m["tools"]}
        self.assertEqual(names, {"Book Bolt"})
        total = sum(t["amount"] for m in months.values() for t in m["tools"])
        self.assertAlmostEqual(total, 24929.16, places=2)

    def test_distinct_payers_stay_distinct(self):
        """Two unrelated payers must never collapse just because both are aliased."""
        credits = [credit("a", "10/06/2026", 15763.57, "paypal"),
                   credit("b", "03/08/2026", 9165.59, "paypal")]
        pp = [paypal_month("2026-06", [("Book Bolt LLC", 15763.57)]),
              paypal_month("2026-08", [("Дигитал Маркетинг Солутионс 2011 ООД", 9165.59)])]
        with with_credits(credits):
            months, _ = attribute.attribute(
                ["paypal"], pp,
                aliases={"Book Bolt LLC": "Book Bolt",
                         "Дигитал Маркетинг Солутионс 2011 ООД": "DigitalWorks"})
        names = {t["tool"] for m in months.values() for t in m["tools"]}
        self.assertEqual(names, {"Book Bolt", "DigitalWorks"})


class UnidentifiedPayers(unittest.TestCase):
    """An agency is not a tool, and must never be written as one."""

    UNKNOWN = {"Дигитал Маркетинг Солутионс 2011 ООД":
               {"via": "DigitalWorks", "note": "affiliate agency"}}

    def test_agency_is_kept_out_of_the_tool_list(self):
        credits = [credit("a", "03/08/2026", 9165.59, "paypal")]
        pp = [paypal_month("2026-08",
                           [("Дигитал Маркетинг Солутионс 2011 ООД", 9165.59)])]
        with with_credits(credits):
            months, _ = attribute.attribute(["paypal"], pp, unidentified=self.UNKNOWN)
        aug = months["2026-08"]
        self.assertEqual(aug["tools"], [], "an agency must not appear as a tool")
        self.assertAlmostEqual(aug["unidentified"]["amount"], 9165.59, places=2)
        payer = aug["unidentified"]["payers"][0]
        self.assertEqual(payer["via"], "DigitalWorks")
        self.assertIn("Дигитал", payer["payer"])

    def test_invariant_holds_with_three_buckets(self):
        credits = [credit("a", "03/08/2026", 9165.59, "paypal"),
                   credit("b", "06/08/2026", 7014.74, "paypal"),
                   credit("c", "21/08/2026", 5000.00, "airwallex")]
        pp = [paypal_month("2026-08",
                           [("Дигитал Маркетинг Солутионс 2011 ООД", 9165.59),
                            ("HeyGen", 7014.74)])]
        with with_credits(credits):
            months, _ = attribute.attribute(
                ["paypal", "airwallex"], pp, unidentified=self.UNKNOWN)
        aug = months["2026-08"]
        total = (sum(t["amount"] for t in aug["tools"])
                 + aug["unidentified"]["amount"] + aug["untraced"]["amount"])
        self.assertAlmostEqual(total, aug["bank_total"], delta=1.0)

    def test_matching_survives_suffix_stripping(self):
        """The lookup keys on the canonical name, not the raw payer string."""
        credits = [credit("a", "03/08/2026", 9165.59, "paypal")]
        pp = [paypal_month("2026-08",
                           [("Дигитал Маркетинг Солутионс 2011 ООД", 9165.59)])]
        with with_credits(credits):
            months, _ = attribute.attribute(["paypal"], pp, unidentified=self.UNKNOWN)
        # " ООД" is stripped before the check; if the lookup used the raw name it
        # would silently miss and the agency would show up as a tool.
        self.assertEqual(months["2026-08"]["tools"], [])


class Preflight(unittest.TestCase):
    """One trigger drives PayPal, impact.com and PartnerStack — and says so."""

    def test_reports_every_source(self):
        ids = {c["id"] for c in sources.preflight()}
        self.assertEqual(ids, {"paypal", "impact", "partnerstack", "paykickstart"})

    def test_missing_cli_is_reported_not_swallowed(self):
        with mock.patch.object(sources.shutil, "which",
                               lambda n: None if n == "impact-pp-cli" else "/usr/bin/" + n):
            checks = {c["id"]: c for c in sources.preflight()}
        self.assertFalse(checks["impact"]["ok"])
        self.assertIn("CLI missing", checks["impact"]["detail"])

    def test_paykickstart_is_reported_as_parked_not_broken(self):
        pk = next(c for c in sources.preflight() if c["id"] == "paykickstart")
        self.assertFalse(pk["ok"])
        self.assertIn("parked", pk["detail"])


class Privacy(unittest.TestCase):
    """The repo is public. These are the guarantees that keep it safe."""

    def test_strip_pii_removes_every_sensitive_key(self):
        payload = [{
            "key": "pay_1", "amount": 7204,
            "provider": {"meta": {
                "account_number_last_4": "8619",
                "beneficiary_address": {"street_address": "23, Moti Mansion",
                                        "postcode": "456771"},
            }},
            "customer": {"email": "someone@email.com"},
        }]
        clean = sources.strip_pii(payload)
        blob = json.dumps(clean)
        for secret in ("8619", "Moti Mansion", "456771", "@email.com",
                       "beneficiary", "account_number"):
            self.assertNotIn(secret, blob, f"{secret} survived redaction")
        # ...while keeping what the engine needs.
        self.assertEqual(clean[0]["key"], "pay_1")
        self.assertEqual(clean[0]["amount"], 7204)

    def test_strip_pii_handles_nesting_and_lists(self):
        deep = {"a": [{"b": {"meta": {"x": 1}, "keep": 2}}]}
        self.assertEqual(sources.strip_pii(deep), {"a": [{"b": {"keep": 2}}]})

    def test_committed_summary_carries_no_pii(self):
        """The real summary.json, if one has been generated on this machine."""
        p = HERE / "summary.json"
        if not p.exists():
            self.skipTest("no summary.json yet")
        blob = p.read_text()
        for secret in ("3235000100068619", "SEEMA", "BAKLIWAL", "Moti Mansion",
                       "456771", "UPI/", "@oksbi", "9111681541"):
            self.assertNotIn(secret, blob, f"{secret} leaked into summary.json")

    def test_load_env_handles_export_prefix(self):
        """infra/secrets files are shell-sourced, so some lines start with export."""
        with tempfile.NamedTemporaryFile("w", suffix=".env", delete=False) as f:
            f.write("# comment\nexport FOO=bar\nBAZ=\"qux\"\n")
            path = f.name
        try:
            env = sources.load_env(path)
            self.assertEqual(env["FOO"], "bar")
            self.assertEqual(env["BAZ"], "qux")
        finally:
            pathlib.Path(path).unlink()


if __name__ == "__main__":
    unittest.main(verbosity=2)
