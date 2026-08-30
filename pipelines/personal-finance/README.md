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
