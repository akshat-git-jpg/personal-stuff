# yt-income: attribution rules

Contents
- Naming untraced money (manual_attribution)
- Do not widen the search
- Tool names: keep them human, merge duplicates
- Payers that are not tools
- What the mail may do

## Naming untraced money (manual_attribution)

The owner wants untraced money to shrink over time, so treat every run as a chance
to name one more credit. Untraced rows are never bare: each carries the **rail** it
arrived on, the **bank reference**, and any **leads** (network payouts near that
date that failed to match, and why).

When he says he has worked one out ("the 19 March one was Base44"), record it in
`rules.json` under `manual_attribution`:

```json
{ "date": "DD/MM/2026", "amount": 1234.56,
  "tool": "Base44", "route": ["impact.com", "Airwallex"],
  "note": "confirmed against the impact.com payout report, <date>" }
```

Match is on date + amount, which is unique in a passbook; copy both straight off
the Untraced card in the dashboard. This runs as **pass 0**, before every heuristic,
and its claims are marked `confirmed`, so nothing can later un-name them. Re-run
`ingest.py` and the credit moves out of Untraced permanently.

**If he tells you where money came from, write it down there.** Do not just report
it back in chat: that knowledge is lost the moment the session ends.

If the same sender turns up repeatedly, promote it: add a rail to `income_rails`
so future statements classify it automatically, instead of one manual entry per
credit.

## Do not widen the search

Widening the search to make untraced money go away is the obvious idea and it is
wrong. Tried on 2026-08-30: pulling five extra months of impact.com history produced
*twenty-four* subset sums landing within 2% of an untraced credit, several hitting
the same credit different ways. That is what a subset search does when given enough
numbers, and acting on it would have put a wrong tool name on real money. The window
starts **Jan 2026** by the owner's decision. Untraced money gets named from something
he confirmed, never from a looser guess. A wrong name is worse than an honest gap.

## Tool names: keep them human, merge duplicates

Payers identify themselves by legal entity, which is neither readable nor reliably
one-per-tool. `rules.json` → `tool_aliases` fixes both:

- **Readability.** Legal suffixes (Inc., LLC, Corp, GmbH, Limited, ООД) strip
  automatically, so most names need no entry. Add one only when stripping is not
  enough: "Heygen Technology Inc." should read **HeyGen**.
- **Merging, which changes the numbers.** A tool can pay from more than one
  profile. Book Bolt pays as **Book Bolt LLC** *and* as **Дигитал Маркетинг
  Солутионс 2011 ООД** (its Bulgarian entity on the digitalworks.net domain).
  Confirmed by the owner 2026-08-30 and settled against the Book Bolt ledger
  2026-08-31 (see `pp-bookbolt`). Left alone, the split understates the tool and
  drops it several places in the ranking. Do not re-split without new ledger
  evidence.

So when an unfamiliar payer appears, **identify it before accepting it as a new
tool**: it may be one already on the list under another name. The owner's tracking
links are the ground truth for what he promotes; query the `links` table of
`clicks-db` for `SELECT DISTINCT tool` and cross-check.

## Payers that are not tools

Some payers are affiliate agencies and processors that pay out on behalf of brands.
Those go in `unidentified_payers`, never `tool_aliases`. Writing an agency's name in
the Tool column claims the owner promotes it, which is false; he rejected exactly
that on 2026-08-30.

**They land in untraced, not in a bucket of their own.** There are exactly two
answers to "which tool earned this?" (we know, or we do not), so there are exactly
two buckets:

    tools + untraced == bank_total

An earlier build had a third bucket called *Unidentified*. The owner killed it the
same day: "unidentified" and "untraced" are synonyms in plain English, and both on a
source-of-truth dashboard invites a misread. **Do not reintroduce a third bucket**
under any name.

What the merge must never cost is the evidence. Every untraced row carries the most
useful thing we know about it, ordered by how short a walk that is to an answer:

| `kind` | What we already know | The next step |
|---|---|---|
| `payer` | who paid (an agency), the amount, the route | ask them which brand it is for |
| `credit` | date, rail, bank reference, nearby payouts | quote the ref to the bank |

When the owner names the brand behind an agency payer, move it from
`unidentified_payers` to `tool_aliases` and it becomes a normal tool row.

## What the mail may do

Mail only ever supplies *leads* on an untraced row, never an attribution. One
exception, and it has to earn it: a payout mail stating an exact rupee figure that
equals the bank credit to the paisa is marked *"exactly this credit"*. Everything
else is a place to look. impact.com is the only source that states rupees, which is
why it is the only one that can ever settle a row from mail alone.

Three kinds come out of `mailbox.py`, and the difference is load-bearing:

| kind | example | what it may become |
|---|---|---|
| `payout` | *"payment of Rs.X have been transferred"* | a lead; an answer if the rupees match exactly |
| `payout_undisclosed` | *"Your Lovable Affiliates payout is ready"* | a lead only; Rewardful never states a figure |
| `accrual` | *"Commission Amount: $X USD"* | **never** a lead. Earned is not received |

Hold on to the last row. Rewardful's Lovable and EverBee commissions accrued for
months behind a blocked Tipalti verification. Treating an accrual as income would
invent money that never arrived.
