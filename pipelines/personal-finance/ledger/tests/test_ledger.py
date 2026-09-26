"""Ledger tests on synthetic text. No real statement data lives in the repo.

    cd pipelines/personal-finance && python3 -m unittest discover -s ledger/tests -t .
"""

import unittest

import datetime as dt

from ledger import alerts, build, cards, evidence, savings
from ledger.pdfs import ParseError

SBIC = """for Statement Period: 14 Aug 26 to 13 Sep 26
CKYC No.
:
123
1,210.00
100.00
50,000.00
5,000.00
48,000.00
5,000.00
500.00
1,700.00
10.00
13 Sep 2026
03 Oct 2026
1,210.00
0.00
31 Aug 26 PAYMENT RECEIVED 000DPABC 500.00 C
IGST DB @ 18.00% 10.00 D
TRANSACTIONS FOR TEST USER
01 Sep 26 SWIGGY FOOD BENGALURU IN 200.00 D
02 Sep 26 HIGGSFIELD INC. WWW.HIGGSFIEL CA     12.00  USD (Pay in
EMIs) 1,000.00 D
03 Sep 26 ZEPTO MARKETPLACE Bangalore IN 500.00 D
"""

HDFC = """TOTAL AMOUNT DUE
C1,300.00
DUE DATE
21 Sep, 2026
02/08/2026| 10:00 UPI-Zepto  C 800.00 l
03/08/2026| 11:00 BPPY CC PAYMENT DP1 (Ref#
ST99) +  C 500.00 l
04/08/2026| 12:00 UPI-EatClub  C 1,000.00 l
PREVIOUS STATEMENT DUES PAYMENTS/CREDITS
FINANCE CHARGES
C0.00 C500.00 C1,800.00 C0.00
Billing Period
02 Aug, 2026 - 01 Sep, 2026
"""

ICICI = """Á0.00
Á900.00
SPENDS OVERVIEW
September 3, 2026
September 21, 2026
Statement period : August 4, 2026 to September 3, 2026
Previous Balance Purchases / Charges Cash Advances Payments / Credits
Á0.00 Á1,100.00 Á0.00 Á200.00
04/08/2026 13916506848 Flipkart Minutes Bangalore IN 6 300.00
22/08/2026 12384816970 HEYGEN TECHNOLOGY INC. HEYGEN.COM
US*
0 9.00
USD
800.00
25/08/2026 14048986809 AMAZON PAY IN E COMMERC BANGALORE
IN
-9 200.00 CR
Credit Limit
"""

ESTMT = """Date Transaction Reference Ref.No./Chq.No. Credit Debit Balance
01-08-26 UPI/DR/111/SWIGGY/HDFC/swiggy.st/UPI - 0 100.00 900.00
02-08-26 NEFT SALARY - 5000.00 0 5900.00
TRANSACTION OVERVIEW Your Opening Balance on 01-08-26: 1000.00
TRANSACTION DETAILS DL/TL ACCOUNT XXXXXXX0000
Date Transaction Reference Ref.No./Chq.No. Credit Debit Balance
13-08-26 O.S. DEPOSIT TRANSFER - 24208.00 0 99999.00
"""


class Parsers(unittest.TestCase):
    def test_sbicard_wrapped_row_fx_and_fee(self):
        s = cards.parse_sbicard(SBIC)
        self.assertEqual((s["period_from"], s["period_to"], s["due"]), ("2026-08-14", "2026-09-13", 1210.0))
        wrapped = [r for r in s["rows"] if "HIGGSFIELD" in r["text"]][0]
        self.assertEqual((wrapped["amount"], wrapped["fx"]), (1000.0, "USD 12.00"))
        self.assertEqual(sum(1 for r in s["rows"] if r["fee"]), 1)

    def test_sbicard_refuses_rows_that_do_not_add_up(self):
        with self.assertRaises(ParseError):
            cards.parse_sbicard(SBIC.replace("500.00 D", "501.00 D"))

    def test_hdfc_wrapped_payment_is_a_credit(self):
        s = cards.parse_hdfc(HDFC)
        pay = [r for r in s["rows"] if r["dc"] == "C"]
        self.assertEqual([r["amount"] for r in pay], [500.0])
        self.assertEqual(s["due"], 1300.0)

    def test_icici_uses_rupees_not_the_foreign_amount(self):
        s = cards.parse_icici(ICICI)
        heygen = [r for r in s["rows"] if "HEYGEN" in r["text"]][0]
        self.assertEqual((heygen["amount"], heygen["fx"]), (800.0, "USD 9.00"))
        self.assertEqual([r["dc"] for r in s["rows"]], ["D", "D", "C"])

    def test_estatement_reads_credit_before_debit_and_stops_at_loan(self):
        rows = savings.parse_estatement(ESTMT)
        self.assertEqual([(r["debit"], r["credit"]) for r in rows], [(100.0, 0.0), (0.0, 5000.0)])


class Alerts(unittest.TestCase):
    def test_mandate_twin_dropped_and_repeat_flagged(self):
        msgs = [
            {"id": "a", "source": "sbic", "ts": 1, "text": "Rs.3,298.31 done on your credit card ending 1111 without x at HEYGENTECHNOLOGYINC on 10 Sep 26 ."},
            {"id": "b", "source": "sbic", "ts": 2, "text": "Rs.3,298.31 at HEYGEN TECHNOLOGY INC. against E-mandate (SiHub ID - X) registered by you at merchant has been debited to your SBI Credit Card ending 1111 on 10-09-26."},
            {"id": "c", "source": "sbic", "ts": 3, "text": "Rs.60.00 spent on your SBI Credit Card ending 1111 at englishbmrc on 13/07/26. x"},
            {"id": "d", "source": "sbic", "ts": 4, "text": "Rs.60.00 spent on your SBI Credit Card ending 1111 at englishbmrc on 13/07/26. x"},
            {"id": "e", "source": "sbic", "ts": 5, "text": "Transaction of USD23.60 at ANTHROPIC* CLAUDE SUB against E-mandate (SiHub ID - Y) registered on 13-09-26"},
        ]
        rows = alerts.rows_from(msgs)["sbic"]
        self.assertEqual(sum(1 for r in rows if "HEYGEN" in r["text"].upper()), 1)
        bmrc = [r for r in rows if "bmrc" in r["text"]]
        self.assertEqual([r["maybe_dup"] for r in bmrc], [False, True])
        usd = [r for r in rows if r["fx"]][0]
        self.assertIsNone(usd["amount"])


class Remarks(unittest.TestCase):
    def test_sbi_remark_keeps_everything_and_lists_details(self):
        payee, text, ident, details = build.sbi_view(
            "WDL TFR UPI/DR/645723315933/SAGARIKA /FDRL/7091362239/asha 0097692162094 AT 18231 HOPE FARM CIRCLE")
        self.assertEqual(payee, "SAGARIKA")
        self.assertIn("7091362239", text)          # owner asked for nothing masked
        self.assertIn("Note: asha", details)
        self.assertIn("UPI ref: 645723315933", details)
        self.assertEqual(ident, "name:SAGARIKA|FDRL")  # a phone-number UPI ID keys on name + bank


class Rides(unittest.TestCase):
    def _row(self, rid, date, amount, ts=None):
        r = {"id": rid, "source": "sbi", "date": date, "amount": amount, "status": "needs", "tags": [], "desc": None}
        if ts:
            r["_ts"] = ts
        return r

    def test_timed_match_needs_fare_and_window(self):
        ride = {"id": "RD1", "mode": "auto", "price": 70.0, "ts": dt.datetime(2026, 9, 23, 11, 12),
                "from": "home", "to": "office"}
        early = self._row("a", "2026-09-23", -70.0, dt.datetime(2026, 9, 23, 10, 0))   # before the ride
        right = self._row("b", "2026-09-23", -70.0, dt.datetime(2026, 9, 23, 11, 20))
        wrong_fare = self._row("c", "2026-09-23", -80.0, dt.datetime(2026, 9, 23, 11, 20))
        self.assertEqual(evidence.match_rides([early, right, wrong_fare], [ride]), 1)
        self.assertEqual(right["status"], "proven")
        self.assertIn("home → office", right["tags"])
        self.assertEqual((early["status"], wrong_fare["status"]), ("needs", "needs"))

    def test_untimed_match_only_when_unique(self):
        ride = {"id": "RD2", "mode": "auto", "price": 60.0, "ts": dt.datetime(2026, 7, 2, 10, 43),
                "from": "home", "to": "office"}
        a, b = self._row("a", "2026-07-02", -60.0), self._row("b", "2026-07-02", -60.0)
        self.assertEqual(evidence.match_rides([a, b], [ride]), 0)
        self.assertEqual(evidence.match_rides([a], [ride]), 1)


class Flipkart(unittest.TestCase):
    @staticmethod
    def row(i, date, amount, text="Flipkart Bangalore IN"):
        return {"id": i, "date": date, "amount": amount, "desc": "Flipkart Minutes", "_hay": text,
                "tags": ["grocery"], "status": "confirmed", "details": []}

    @staticmethod
    def order(oid, time, amount, pay=("Credit Card",), kind="minutes"):
        return {"id": oid, "time": time, "amount": amount, "kind": kind, "pay": list(pay),
                "items": [{"title": "Milk", "size": "1 L", "qty": 2, "price": amount, "status": "Delivered",
                           "pay": [{"mode": "Credit Card", "amount": amount}]}]}

    def test_exact_amount_within_days_gets_items(self):
        r = self.row("a", "2026-09-27", -348.0)
        self.assertEqual(evidence.match_flipkart([r], [self.order("OD1", "2026-09-26 21:06", 348)]), 1)
        self.assertEqual(r["status"], "proven")
        self.assertTrue(r["desc"].startswith("Flipkart Minutes: Milk"))
        self.assertIn("2 × Milk (1 L) · ₹348", r["details"])

    def test_wrong_amount_or_too_late_is_left_alone(self):
        rows = [self.row("a", "2026-09-26", -300.0), self.row("b", "2026-10-05", -348.0)]
        self.assertEqual(evidence.match_flipkart(rows, [self.order("OD1", "2026-09-26 21:06", 348)]), 0)
        self.assertEqual(rows[0]["status"], "confirmed")

    def test_wallet_order_takes_the_one_smaller_charge_that_day(self):
        o = self.order("OD2", "2026-07-01 16:12", 692, pay=("Flipkart Wallet", "Credit Card"))
        one = [self.row("a", "2026-07-01", -432.0)]
        self.assertEqual(evidence.match_flipkart(one, [o]), 1)
        two = [self.row("a", "2026-07-01", -432.0), self.row("b", "2026-07-01", -300.0)]
        self.assertEqual(evidence.match_flipkart(two, [o]), 0)

    def test_normal_order_is_shopping(self):
        r = self.row("a", "2026-04-21", -32391.0)
        evidence.match_flipkart([r], [self.order("OD3", "2026-04-20 10:00", 32391, kind="flipkart")])
        self.assertEqual(r["tags"], ["shopping"])


class AlertClock(unittest.TestCase):
    def test_twelve_hour_time_resolved_from_email_time(self):
        ist = lambda y, mo, d, h, mi: int((dt.datetime(y, mo, d, h, mi) - dt.timedelta(hours=5, minutes=30)).replace(tzinfo=dt.timezone.utc).timestamp() * 1000)
        self.assertEqual(alerts._clock("2026-09-26", "09:06", ist(2026, 9, 26, 21, 7)), "21:06")
        self.assertEqual(alerts._clock("2026-06-07", "01:30", ist(2026, 6, 7, 1, 31)), "01:30")
        self.assertEqual(alerts._clock("2026-06-07", "12:10", ist(2026, 6, 7, 12, 11)), "12:10")


if __name__ == "__main__":
    unittest.main()
