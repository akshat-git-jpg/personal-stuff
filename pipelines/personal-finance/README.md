# personal-finance

The owner's **personal** SBI account — salary in, rent and living costs out. Read-only:
parse a statement, categorise it, print a summary.

Not to be confused with two neighbours:

| Folder | Whose money | What for |
|---|---|---|
| `pipelines/personal-finance` (here) | the owner's own SBI account | personal spending |
| `pipelines/income-analysis` | his mother's PNB account | YouTube affiliate income |
| `pipelines/tools/bank-statement-parser` | anyone's | a product sold on RapidAPI, LLM-backed |

They share no code. This one is stdlib + `pypdf` only, so it runs on Windows too.

## Run it

```bash
cd pipelines/personal-finance
python3 summarise.py ~/Downloads/AccountStatement_*.pdf   # store a new one and summarise
python3 summarise.py                                      # re-run on the newest stored
```

The first form copies the PDF into `data/raw/` so it accumulates over time.

## The password

Every SBI export from this account uses the **same** password. It lives once in
`data/config.json`:

```json
{ "password": "..." }
```

`data/` is gitignored in full — statements name the account holder, every
counterparty and the running balance. Never move any of it outside `data/`.

## Why the parser refuses rather than guesses

A row is `date · value date · description · ref · debit · credit · balance`, and
**`ref`, `debit` and `credit` all print as `-` when empty**. So a row ends in four
tokens, not three. Read three and the balance lands in the credit column: every debit
becomes income, and nothing looks wrong — the statement still "parses", the totals are
just fiction.

Two guards, because that failure is invisible:

1. **Any unparsed row aborts the whole run.** A partial statement summarised is
   indistinguishable from a complete one.
2. **The balance chain is walked.** Each row states the balance after it, so
   `previous + credit − debit` must equal it. One mis-read column breaks the chain at
   the first row and names the date.

The statement's own closing balance is printed beside the computed one. If those two
ever disagree, do not trust anything above them.

## Categories

`rules.json` maps a counterparty to a category, matching on the UPI remark. Match on
the **VPA or the account number**, not the short name — the bank truncates names to
eight characters and two people collide easily.

**An unmatched payee stays `unknown`, carrying its remark.** Never invent a category
to tidy the output. The owner acts on these numbers, so a wrong label is worse than a
visible gap — the same rule the income tally follows for untraced money.

Note that `credit_card` is a *bill*, not spending: it settles purchases already made.
Summing it alongside the other expense rows double-counts.

## The ledger (Kushal Money)

`ledger/` builds every payment from all four sources into one list for
kushal-income.agrolloo.com: SBI savings, SBI Card, Tata Neu Infinity (HDFC) and
Amazon Pay ICICI. It runs **on demand only**, never on a schedule:

```bash
cd pipelines/personal-finance
python3 -m ledger.run              # fetch new mail, build, publish to the app
python3 -m ledger.run --no-fetch   # rebuild from files already in data/inbox
python3 -m ledger.run --no-push    # build data/ledger.json only
python3 -m unittest discover -s ledger/tests -t .
```

- **Where the data comes from.** Card statement PDFs and purchase alert emails in
  Gmail; SBI's monthly e-statement and YONO "email statement" PDFs, plus any PDF in
  `data/raw/`. Everything lands in `data/inbox/` (gitignored) and is never re-fetched.
- **Statements are the truth, emails fill the gap.** Rows after a card's last
  statement come from alerts and show "not final"; the next statement replaces them.
- **Every statement must add up** (previous + purchases + fees − payments = due) or
  it is skipped and listed on the Overview. Card bills are matched to the SBI CRED
  payment that paid them, including one payment for two cards.
- **Nothing is guessed.** Tags come from `ledger/rules.json`, the bank's row type, or
  the owner in the app. Anything else is "Needs you".
- **Nothing sensitive is published.** Phone numbers, UPI IDs and account numbers are
  masked, and `assert_clean` refuses the whole ledger if one slips through.
- `data/config.json` also holds the card PDF passwords (`passwords`) and the app's
  `ingest` url and token. Running from a workspace: set `PF_DATA` to the main
  checkout's `data/` and `PP_GOOGLE_SHARED` to its `tooling/mcp/google-shared`.
- **Rides and payment times** (`ledger/evidence.py`). A Google Pay Takeout unzipped
  into `data/raw/gpay/` gives each UPI payment its exact time. Rapido receipts
  (requested in the app, emailed from partner@rapido.bike, fetched on sync) prove a
  payment was a ride and give its route. Place labels (home, office, gym) are the
  owner's, in `data/config.json` `places`; unlabelled places show only their area.
- **Rides with no receipt** (owner decision 2026-09-27). Route patterns learned from
  the receipts tag a payment when exactly one route fits its day, hour and fare; a
  small QR payment (₹40–100) to a one-off payee is tagged "ride, route unknown".
  Both carry the `pattern` tag, so they can be filtered and checked.
- **Uber receipts** are fetched on sync. A "Cash" fare matches the UPI paid to the
  driver (fare to fare + ₹15, up to an hour after the ride); other fares match the
  Uber row itself. Three receipt layouts are handled.
- **Trips** live in `data/config.json` `trips` (`name`, `from`, `to`, `book_from`).
  Spending in the window gets `trip` plus `<name>-stay/food/bus/auto/metro`; anything
  unknown stays in Needs you, where the app offers those buttons.

## Parked (owner said later)

- **Flipkart order items** (parked 2026-09-27). Flipkart sends no order emails, so item
  lists exist only in the account. Plan: a `pp-flipkart` CLI that logs in once in real
  Chrome (Playwright persistent profile at `~/.pp-flipkart/profile`, OTP by the owner),
  then reads order history read-only. First check that Flipkart Minutes orders appear on
  flipkart.com/account/orders at all; stop if they are app-only.
- **Same-day SBI payments.** SBI UPI rows arrive only via statements. Options: YONO email
  statement on demand, or SBI alert emails if they carry UPI debits (not checked yet).
- **How to trigger a sync** (a command or a button in the app). Sync stays on demand.
- **Needs you left over:** 14 June to September payees, and the ₹2,728.95 Redbus booking
  on 15 Sep (Varkala or not).
- **kushal-tools hub card:** rename it to "Kushal Money".
