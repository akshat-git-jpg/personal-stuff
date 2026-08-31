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

import attribute
import mailbox  # noqa: E402
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


class PartnerStackDates(unittest.TestCase):
    """PartnerStack's API date is a created-at, not a paid-at.

    Its five payouts read 2024-04-03 … 2026-07-01 while its own "payout is ready"
    mails put the SAME amounts months later. Matching on the API date made the
    engine spend a May payout on a March credit and strand two real credits as
    untraced, so the mail's date wins wherever the amounts agree.
    """

    def ev(self, date, amount):
        return mailbox.Event(date, "payout", None, amount, "USD",
                             "partnerstackmail.com", "Your PartnerStack Payout")

    def test_mail_date_overrides_the_api_date(self):
        ps = {"payouts": [{"key": "p1", "date": "2026-03-03",
                           "amount": 85.29, "currency": "USD"}]}
        got = attribute.partnerstack_dates(ps, [self.ev("2026-05-01", 85.29)])
        self.assertEqual(got[85.29], "2026-05-01")

    def test_an_api_payout_with_no_mail_keeps_its_own_date(self):
        """Silence must not blank a date — that would drop the payout entirely."""
        self.assertEqual(attribute.partnerstack_dates({"payouts": []}, []), {})

    def test_only_partnerstack_payout_mail_counts(self):
        """A Rewardful or impact payout mail must not redate a PartnerStack row."""
        evs = [mailbox.Event("2026-05-01", "payout", None, 85.29, "USD",
                             "app.impact.com", "x"),
               mailbox.Event("2026-05-01", "accrual", None, 85.29, "USD",
                             "partnerstackmail.com", "x")]
        self.assertEqual(attribute.partnerstack_dates({"payouts": []}, evs), {})

    def test_the_earliest_mail_wins_when_an_amount_repeats(self):
        """A credit can only follow the first release of that amount."""
        got = attribute.partnerstack_dates(
            {"payouts": []}, [self.ev("2026-07-01", 35.64), self.ev("2026-05-04", 35.64)])
        self.assertEqual(got[35.64], "2026-05-04")


    def test_the_override_is_actually_wired_into_the_match(self):
        """The map alone proves nothing — pass_partnerstack has to USE it.

        API date 2026-03-03 is 65 days before the credit, far outside the 10-day
        window, so without the override this payout finds no candidate at all.
        """
        credits = [credit("a", "07/05/2026", 7988.68, "airwallex")]
        ps = {"payouts": [{"key": "p1", "date": "2026-03-03", "amount": 85.29,
                           "currency": "USD"}],
              "rewards": [{"key": "r1", "date": "2026-04-20", "amount": 85.29,
                           "tool": "Eleven Labs Inc."}]}
        with with_credits(credits):
            claims, notes = attribute.pass_partnerstack(
                credits, ps, [self.ev("2026-05-01", 85.29)])
        self.assertTrue(claims, "mail date should bring the credit into range: %s" % notes)
        # Raw payer name here: canonical_tool runs later, in attribute().
        self.assertEqual(claims[0]["tool"], "Eleven Labs Inc.")
        self.assertAlmostEqual(claims[0]["amount"], 7988.68, places=2)


class NetworkPayoutPass(unittest.TestCase):
    """The shared matcher every per-tool CLI source plugs into.

    The owner is building one CLI per affiliate network, so this pass will carry
    all of them. Its job is not to match as much as possible -- it is to match
    only what is unambiguous, and to say so loudly when it cannot.
    """

    def payout(self, key, date, amount, tool="OpenArt"):
        return {"key": key, "date": date, "amount": amount,
                "currency": "USD", "tool": tool}

    def test_a_single_candidate_is_claimed(self):
        credits = [credit("a", "23/07/2026", 9242.06, "airwallex")]
        with with_credits(credits):
            claims, notes = attribute.pass_network_payouts(
                credits, [self.payout("p1", "2026-07-08", 96.30)],
                "Tolt", ["Tolt", "Airwallex"])
        self.assertEqual(len(claims), 1, notes)
        self.assertEqual(claims[0]["tool"], "OpenArt")
        self.assertAlmostEqual(claims[0]["amount"], 9242.06, places=2)
        self.assertEqual(claims[0]["route"], ["Tolt", "Airwallex"])
        self.assertEqual(claims[0]["confidence"], "matched")

    def test_two_candidates_refuse_rather_than_guess(self):
        """The rule the whole file exists for. A coin flip here becomes a
        confident wrong number on the dashboard."""
        credits = [credit("a", "20/07/2026", 9242.06, "airwallex"),
                   credit("b", "23/07/2026", 9242.06, "airwallex")]
        with with_credits(credits):
            claims, notes = attribute.pass_network_payouts(
                credits, [self.payout("p1", "2026-07-08", 96.30)],
                "Tolt", ["Tolt", "Airwallex"])
        self.assertEqual(claims, [])
        self.assertEqual(notes[0]["reason"], "ambiguous")
        self.assertEqual(notes[0]["candidates"], 2)

    def test_a_credit_before_the_payout_is_never_claimed(self):
        """Money cannot arrive before it was sent."""
        credits = [credit("a", "01/07/2026", 9242.06, "airwallex")]
        with with_credits(credits):
            claims, _ = attribute.pass_network_payouts(
                credits, [self.payout("p1", "2026-07-08", 96.30)],
                "Tolt", ["Tolt", "Airwallex"])
        self.assertEqual(claims, [])

    def test_tolt_gets_a_wider_window_than_partnerstack(self):
        """Tolt stamps the payout at generation and moves money at invoice, up
        to a fortnight later -- proven by the 8 Jul payout whose receipt is dated
        23 Jul, the day of the credit. PartnerStack keeps the tight window."""
        self.assertGreater(attribute.SETTLEMENT_WINDOW_DAYS["Tolt"],
                           attribute.PAYOUT_WINDOW_DAYS)
        credits = [credit("a", "23/07/2026", 9242.06, "airwallex")]
        with with_credits(credits):
            claims, _ = attribute.pass_network_payouts(
                credits, [self.payout("p1", "2026-07-08", 96.30)],
                "Tolt", ["Tolt", "Airwallex"])
        self.assertEqual(len(claims), 1, "15-day lag must be inside Tolt's window")
        # The same lag under the default window must NOT match.
        credits = [credit("a", "23/07/2026", 9242.06, "airwallex")]
        with with_credits(credits):
            claims, _ = attribute.pass_network_payouts(
                credits, [self.payout("p1", "2026-07-08", 96.30)],
                "SomeOtherNetwork", ["X", "Airwallex"])
        self.assertEqual(claims, [], "the wide window must be Tolt-only")

    def test_a_rate_outside_the_band_is_refused(self):
        """A credit that would imply an impossible exchange rate is not that
        payout, however close the dates are."""
        credits = [credit("a", "23/07/2026", 500000.00, "airwallex")]
        with with_credits(credits):
            claims, notes = attribute.pass_network_payouts(
                credits, [self.payout("p1", "2026-07-08", 96.30)],
                "Tolt", ["Tolt", "Airwallex"])
        self.assertEqual(claims, [])
        self.assertEqual(notes[0]["reason"], "no_candidate")

    def test_non_usd_and_zero_payouts_are_skipped(self):
        credits = [credit("a", "23/07/2026", 9242.06, "airwallex")]
        rows = [{"key": "p1", "date": "2026-07-08", "amount": 96.30,
                 "currency": "INR", "tool": "OpenArt"},
                self.payout("p2", "2026-07-08", 0)]
        with with_credits(credits):
            claims, _ = attribute.pass_network_payouts(
                credits, rows, "Tolt", ["Tolt", "Airwallex"])
        self.assertEqual(claims, [])

    def test_one_credit_is_claimed_once(self):
        """Two payouts must not both take the same credit."""
        credits = [credit("a", "23/07/2026", 9242.06, "airwallex")]
        rows = [self.payout("p1", "2026-07-08", 96.30),
                self.payout("p2", "2026-07-09", 96.30)]
        with with_credits(credits):
            claims, notes = attribute.pass_network_payouts(
                credits, rows, "Tolt", ["Tolt", "Airwallex"])
        self.assertEqual(len(claims), 1)
        self.assertEqual([n["reason"] for n in notes], ["no_candidate"])


class NonToolPayers(unittest.TestCase):
    """An agency is not a tool, and must never be written as one.

    It is not a third bucket either. There are two answers to "which tool earned
    this?" — we know, or we do not — so an agency payment lands in untraced with
    its payer attached as evidence.
    """

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
        self.assertAlmostEqual(aug["untraced"]["amount"], 9165.59, places=2)

    def test_there_is_no_third_bucket(self):
        """One word for "we do not know", not two. A second bucket reads as a
        second kind of money and invites a misread of the tally."""
        credits = [credit("a", "03/08/2026", 9165.59, "paypal")]
        pp = [paypal_month("2026-08",
                           [("Дигитал Маркетинг Солутионс 2011 ООД", 9165.59)])]
        with with_credits(credits):
            months, _ = attribute.attribute(["paypal"], pp, unidentified=self.UNKNOWN)
        self.assertNotIn("unidentified", months["2026-08"])

    def test_untraced_agency_row_keeps_its_evidence(self):
        """Untraced is never a bare "unknown" — whatever we know rides along."""
        credits = [credit("a", "03/08/2026", 9165.59, "paypal")]
        pp = [paypal_month("2026-08",
                           [("Дигитал Маркетинг Солутионс 2011 ООД", 9165.59)])]
        with with_credits(credits):
            months, _ = attribute.attribute(["paypal"], pp, unidentified=self.UNKNOWN)
        row = months["2026-08"]["untraced"]["credits"][0]
        self.assertEqual(row["kind"], "payer")
        self.assertEqual(row["via"], "DigitalWorks")
        self.assertIn("Дигитал", row["payer"])
        self.assertEqual(row["route"], ["PayPal"])
        self.assertIn("paid via DigitalWorks", months["2026-08"]["untraced"]["reasons"])

    def test_invariant_holds_with_two_buckets(self):
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
        total = sum(t["amount"] for t in aug["tools"]) + aug["untraced"]["amount"]
        self.assertAlmostEqual(total, aug["bank_total"], delta=1.0)
        # The agency money and the unclaimed Airwallex credit share one bucket,
        # each carrying its own evidence.
        kinds = [c["kind"] for c in aug["untraced"]["credits"]]
        self.assertEqual(sorted(kinds), ["credit", "payer"])

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


class MailboxParsing(unittest.TestCase):
    """The mail parsers must be strict. A parser that guesses feeds a wrong tool
    name into the one number the owner treats as truth."""

    def test_impact_payout_is_read_in_rupees(self):
        """impact.com pays INR straight to the bank -- the only source whose mail
        states the exact figure the bank will show."""
        body = ("Commission Payment Processed Hi Khushi, The funds for Agrollo's "
                "most recent payment of Rs.20,185.19 have been transferred")
        got = mailbox._p_impact("notifications@app.impact.com",
                                "Commission Payment Processed", body)
        self.assertEqual(got, ("payout", None, 20185.19, "INR"))

    def test_impact_marketing_mail_is_ignored(self):
        """Same domain, no payment. Must stay silent rather than invent a payout."""
        self.assertIsNone(mailbox._p_impact(
            "notifications@outreach.impact.com",
            "We're Increasing Your Affiliate Commission",
            "Earn up to $150 per sale and Rs.5,000 in bonuses"))

    def test_partnerstack_payout_amount_comes_from_the_subject(self):
        got = mailbox._p_partnerstack("hello@partnerstackmail.com",
                                      "Your PartnerStack Payout of $32.66 USD is ready", "")
        self.assertEqual(got, ("payout", None, 32.66, "USD"))

    def test_bookbolt_accrual_names_its_tool(self):
        got = mailbox._p_bookbolt("affiliates@bookbolt.io",
                                  "New Commission Notification",
                                  "Commission Amount: $4.80 USDSincerely,")
        self.assertEqual(got, ("accrual", "Book Bolt", 4.80, "USD"))

    def test_rewardful_payout_keeps_the_program_not_the_wrapper(self):
        """The program is the tool. "Friends of EverBee" is EverBee."""
        self.assertEqual(
            mailbox._p_rewardful_payout(
                "hello@getrewardful.com",
                "Your Friends of EverBee payout is ready to withdraw", ""),
            ("payout_undisclosed", "EverBee", None, None))
        self.assertEqual(
            mailbox._p_rewardful_payout(
                "hello@getrewardful.com",
                "Your Lovable Affiliates payout is ready to withdraw", "")[1],
            "Lovable")

    def test_rewardful_payout_carries_no_amount(self):
        """Rewardful never states a figure. Claiming one would be a fabrication."""
        kind, _, amount, currency = mailbox._p_rewardful_payout(
            "hello@getrewardful.com", "Your Lovable Affiliates payout is ready", "")
        self.assertEqual(kind, "payout_undisclosed")
        self.assertIsNone(amount)
        self.assertIsNone(currency)

    def test_load_secrets_handles_the_export_prefix(self):
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".env", delete=False) as fh:
            fh.write("# comment\nexport IMAP_PASS_A=secret1\nIMAP_PASS_B='secret2'\n")
            path = fh.name
        got = mailbox.load_secrets(path)
        self.assertEqual(got, {"IMAP_PASS_A": "secret1", "IMAP_PASS_B": "secret2"})

    def test_missing_secrets_is_a_note_not_a_crash(self):
        """No passwords must degrade the tally, never break it."""
        events, notes = mailbox.fetch_events(secrets_path="/nonexistent/x.env")
        self.assertEqual(events, [])
        self.assertTrue(notes)


    def test_no_committed_file_carries_an_email_address(self):
        """summary.json and rules.json are committed to a public repo. A payer's
        identity is a useful fact; a named person's address at that payer is not,
        and it was leaking through a rules.json note until 2026-08-30."""
        import re
        pat = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
        here = pathlib.Path(__file__).resolve().parent
        for name in ("summary.json", "rules.json"):
            p = here / name
            if not p.exists():
                continue
            hit = pat.search(p.read_text())
            self.assertIsNone(hit, "%s leaks %s" % (name, hit.group(0) if hit else ""))


class MailboxLeads(unittest.TestCase):
    """Mail becomes a lead on an untraced row, never an attribution."""

    def ev(self, date, kind, tool=None, amount=None, currency=None, source="x.com"):
        return mailbox.Event(date, kind, tool, amount, currency, source, "subj")

    def test_an_exact_rupee_payout_outranks_a_nearer_vague_one(self):
        """Strength beats recency. A payout matching to the paisa is an answer;
        a payout with no amount is only a place to look."""
        events = [
            self.ev("2026-03-18", "payout_undisclosed", tool="Lovable",
                    source="getrewardful.com"),
            self.ev("2026-03-01", "payout", amount=22084.36, currency="INR",
                    source="app.impact.com"),
        ]
        leads = mailbox.leads_for_credit("19/03/2026", 22084.36, events)
        self.assertEqual(leads[0]["source"], "impact.com")
        self.assertIn("exactly this credit", leads[0]["what"])

    def test_a_non_matching_rupee_payout_does_not_claim_the_credit(self):
        events = [self.ev("2026-03-16", "payout", amount=623.00, currency="INR",
                          source="app.impact.com")]
        leads = mailbox.leads_for_credit("19/03/2026", 22084.36, events)
        self.assertNotIn("exactly this credit", leads[0]["what"])

    def test_accruals_never_become_leads(self):
        """Earned is not received. Rewardful commissions accrued all year behind a
        blocked Tipalti verification and never reached a bank."""
        events = [self.ev("2026-03-15", "accrual", tool="Book Bolt",
                          amount=4.80, currency="USD", source="bookbolt.io")]
        self.assertEqual(mailbox.leads_for_credit("19/03/2026", 22084.36, events), [])

    def test_mail_after_the_credit_is_not_a_lead(self):
        """Money cannot be explained by a payout announced after it landed."""
        events = [self.ev("2026-03-25", "payout", amount=100.0, currency="USD")]
        self.assertEqual(mailbox.leads_for_credit("19/03/2026", 22084.36, events), [])

    def test_source_labels_are_human(self):
        """A raw sender domain in the Source column reads as plumbing."""
        self.assertEqual(mailbox.label("app.impact.com"), "impact.com")
        self.assertEqual(mailbox.label("partnerstackmail.com"), "PartnerStack")
        self.assertEqual(mailbox.label("unknown-sender.io"), "unknown-sender.io")


class MailboxPrivacy(unittest.TestCase):
    """summary.json is committed to a public repo."""

    def test_events_carry_a_domain_never_an_address(self):
        import email as _email
        raw = (b"From: Someone <a.person@bookbolt.io>\r\n"
               b"Subject: New Commission Notification\r\n"
               b"Date: Tue, 17 Mar 2026 10:00:00 +0000\r\n"
               b"Content-Type: text/plain\r\n\r\n"
               b"Commission Amount: $4.80 USD")
        ev = mailbox._parse(_email.message_from_bytes(raw))
        self.assertEqual(ev.source, "bookbolt.io")
        self.assertNotIn("@", ev.source)

    def test_no_lead_text_carries_an_address(self):
        events = [mailbox.Event("2026-03-01", "payout", None, 22084.36, "INR",
                                "app.impact.com", "Commission Payment Processed")]
        for lead in mailbox.leads_for_credit("19/03/2026", 22084.36, events):
            self.assertNotIn("@", lead["what"] + lead["source"])


class Preflight(unittest.TestCase):
    """One trigger drives PayPal, impact.com and PartnerStack — and says so."""

    def test_reports_every_source(self):
        ids = {c["id"] for c in sources.preflight()}
        # Every source must be named here. A new one that forgets to register
        # is a source whose outage would look like zero income.
        self.assertEqual(ids, {"paypal", "impact", "partnerstack", "paykickstart",
                               "tolt"})

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
