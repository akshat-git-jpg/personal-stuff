"""Ledger tests on synthetic text. No real statement data lives in the repo.

    cd pipelines/personal-finance && python3 -m unittest discover -s ledger/tests -t .
"""

import unittest

from ledger import alerts, build, cards, savings
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


class Masking(unittest.TestCase):
    def test_sbi_remark_hides_vpa_ref_and_account(self):
        payee, text, ident = build.sbi_view(
            "WDL TFR UPI/DR/645723315933/REDBUS/H DFC/redbus32.r/redbus 0097692162094 AT 18231 HOPE FARM CIRCLE")
        self.assertEqual(payee, "REDBUS")
        self.assertNotIn("645723315933", text)
        self.assertNotIn("redbus32.r", text)
        self.assertNotIn("0097692162094", text)

    def test_guard_refuses_a_phone_number(self):
        ledger = {"rows": [{"id": "x", "source": "sbi", "date": "2026-01-01", "text": "call 9876543210"}],
                  "statements": [], "sources": []}
        with self.assertRaises(ParseError):
            build.assert_clean(ledger)

    def test_guard_ignores_hex_ids(self):
        ledger = {"rows": [{"id": "sbi-9876543210ab", "payee_key": "9876543210", "text": "ok"}],
                  "statements": [], "sources": []}
        build.assert_clean(ledger)


if __name__ == "__main__":
    unittest.main()
