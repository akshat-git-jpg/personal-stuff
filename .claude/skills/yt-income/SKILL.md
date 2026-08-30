---
name: yt-income
description: "Refresh yt-income.agrolloo.com — the Revenue dashboard. Ingests a password-protected PNB passbook, pulls PayPal, impact.com and PartnerStack, ties every bank credit back to the tool that earned it, reports what it cannot trace, and redeploys. Trigger phrases: `yt-income`, `update my revenue`, `here's the passbook`, `new passbook`, `refresh the revenue dashboard`, `how much did I earn`, `revenue by tool`, `ingest passbook`."
author: "akshat-git-jpg"
license: "Apache-2.0"
argument-hint: "[path to passbook PDF] | status | reconcile"
allowed-tools: "Read Bash Edit Write Glob Grep"
---

# yt-income — refresh the Revenue dashboard

Turns a bank passbook plus three affiliate networks into the numbers behind
**yt-income.agrolloo.com**.

## The one idea everything follows

**The bank is the truth.** Network reports exist to *explain* bank credits, never
to add to them. So the output always satisfies:

    sum(tool amounts) + untraced == bank total, for every month

**Untraced money is normal, not a bug.** Roughly a fifth of income cannot
currently be tied to a tool. That gets reported loudly — in the terminal and on
the dashboard — and never hidden, rounded away, or guessed at. A wrong
attribution silently corrupts a source of truth; an honest gap does not.

## How money reaches the bank

```
Tool ──► PayPal ─────────────► Bank      HeyGen, Pictory, EverBee, TradingView…
Tool ──► PartnerStack ──► Airwallex ──► Bank   ElevenLabs, n8n, Jungle Scout
Tool ──► impact.com  ──► Airwallex ──► Bank   Base44, InVideo, Kittl
Tool ──► PayKickstart ──► ???              NOT CONNECTED — shows as untraced
```

Bank is always the last hop. That is why bank credits anchor everything.

## Where things live

| Thing | Path |
|---|---|
| Passbook parser + orchestrator | `pipelines/income-analysis/ingest.py` |
| Network fetchers | `pipelines/income-analysis/sources.py` |
| Attribution engine | `pipelines/income-analysis/attribute.py` |
| Tests | `pipelines/income-analysis/test_income.py` |
| Classification rules | `pipelines/income-analysis/rules.json` |
| Raw everything (**gitignored**) | `pipelines/income-analysis/data/` |
| Committed aggregates | `pipelines/income-analysis/summary.json` |
| Dashboard | `apps/yt-income/` → `yt-income.agrolloo.com` |

<EXTREMELY-IMPORTANT>
**This repo is PUBLIC** (`github.com/akshat-git-jpg/personal-stuff`).

The passbook carries the mother's account number, address, family names and UPI
handles. The PartnerStack payouts API additionally returns her **full street
address and account last-4** — `sources.strip_pii()` removes it before anything
is written, and `test_income.py` asserts that.

- `data/` is gitignored in full. Never `git add -f` anything under it.
- Never paste a transaction line into a commit message, PR body, or any
  committed file.
- Only `summary.json` is committed: month totals, tool names, routes. If you add
  a field to it, check it against that bar first. `apps/yt-income/scripts/sync-summary.mjs`
  refuses to bundle a summary matching any forbidden pattern.
</EXTREMELY-IMPORTANT>

## Before you start

```bash
cd "$(pp-work claim --kind code --slug yt-income)"
```

The main checkout refuses to record git history.

## The run

### 1. Get the passbook

If the owner named a file, use it. Otherwise:

```bash
ls -lat ~/Downloads/*.pdf | head -20
ls ~/Downloads | grep -iE "pnb|stmt|8619|passbook"
```

PNB exports look like `PNBONE_STMT_XX8619_30082026.pdf`. **Ask before ingesting
anything you are unsure about** — an SBI *password-reset form* has been mistaken
for a passbook before.

```bash
cp "<pdf>" pipelines/income-analysis/data/raw/
```

The PDF password is the account number, kept in the gitignored
`data/config.json`. If missing, ask the owner — never guess, never commit it.

### 2. Ingest, attribute and tally — one command

```bash
cd pipelines/income-analysis && python3 ingest.py
```

**This skill owns the whole chain. Do not invoke `pp-paypal-txns` or `pp-impact`
separately as part of a refresh** — `ingest.py` drives both CLIs itself, plus the
PartnerStack API, and tallies the results against the passbook. Reaching for them
by hand gets you three sets of numbers that do not reconcile, which is the exact
problem this pipeline exists to solve. (Those skills remain the right tool for a
standalone ad-hoc question like *"what did PayPal pay me in June"*.)

One run does all of it:

| Step | What it uses |
|---|---|
| Preflight | checks all three CLIs and credentials, names anything missing |
| Passbook | `data/raw/*.pdf`, parsed with pypdf |
| PayPal | `paypal-txns-pp-cli income` + `reporting balances-get` |
| impact.com | `impact-pp-cli reports run partner_performance_by_program` |
| PartnerStack | Partner API — payouts, rewards, partnerships |
| Attribute | five passes, then writes `summary.json` |
| Tally | prints the reconciliation and every untraced credit |

**The preflight is the important part.** A missing CLI or an unset credential is
otherwise invisible: the source returns nothing, its money lands in Untraced, and
the dashboard understates what it knows. So the run names it up front:

```
  Sources
    ok  PayPal         ready
    --  impact.com     CLI missing
    ok  PartnerStack   ready
    --  PayKickstart   parked — affiliate accounts have no API access

  !! impact.com unavailable — money from it will show as UNTRACED, not as zero.
```

If you see that, fix the source before trusting the split — the totals stay
correct either way, but the attribution will be worse than it should be.

`--offline` reuses the last fetched data from `data/networks/` and skips every
network call. Totals come out identical; use it when an API is down or you are
only re-parsing a passbook. (`--with-paypal` is still accepted and does nothing —
fetching is now the default.)

### 3. Read the tally — this is the point

The run prints, per month, bank total vs traced vs untraced, and lists **every
untraced credit with its date** so the owner can check the passbook by hand.

It exits non-zero **only** when PayPal and the bank disagree. That is a real bug
signal — PayPal claims it sent money the bank never received, or vice versa.
Untraced money never blocks: it is the normal state, and a gate that fails on
the normal case gets switched off within a week.

Baseline as of 30 Aug 2026 — if a run comes back much worse, something regressed:

| | |
|---|---|
| Bank received, Jan–Aug 2026 | ₹392,878.90 |
| Traced to a tool | ₹312,099.76 (79.4%) |
| Untraced | ₹80,779.14 |
| PayPal reconciliation | ₹0.00 difference |

Every rupee on the PayPal rail is traced. The untraced remainder is all
Airwallex — and it shrinks as entries land in `manual_attribution` (see 4b).

### 4. If something looks wrong

- **PayPal reconciliation non-zero** — the windows differ (PayPal defaults to
  1 Jan 2026 → today), or a payout is genuinely in transit. Check before
  assuming a parser bug.
- **A whole month drops to near-zero traced** — the PayPal batch matcher failed.
  Look at `attribute.py`'s `_paypal_grouped`; a batch of more than six programs
  exceeds its search bound.
- **A new payer appears in the untraced credits** — add a rail to `rules.json`
  and re-run. Match on a stable payer-name fragment, never a transaction id.
- **PartnerStack returns 403** — most likely the User-Agent, not the key. Their
  WAF rejects the default `Python-urllib/3.x`; `sources.py` sets a real one.
- **`CERTIFICATE_VERIFY_FAILED`** — a python.org install without its CA bundle.
  `sources.ssl_context()` falls back to certifi; verification is never disabled.

### 4b. Chasing untraced money — the standing job

The owner wants untraced money to shrink over time, so treat every run as a chance
to name one more credit. Untraced rows are never bare: each carries the **rail** it
arrived on, the **bank reference**, and any **leads** — network payouts near that
date that failed to match, and why.

When he says he has worked one out ("the 19 March one was Base44"), record it in
`rules.json` under `manual_attribution`:

```json
{ "date": "19/03/2026", "amount": 22084.36,
  "tool": "Base44", "route": ["impact.com", "Airwallex"],
  "note": "confirmed against the impact.com payout report, 2026-09-02" }
```

Match is on date + amount, which is unique in a passbook — copy both straight off
the Untraced card in the dashboard. This runs as **pass 0**, before every heuristic,
and its claims are marked `confirmed`, so nothing can later un-name them. Re-run
`ingest.py` and the credit moves out of Untraced permanently.

**If he tells you where money came from, write it down there.** Do not just report
it back in chat — that knowledge is lost the moment the session ends, and he will
have to work it out again.

If the same sender turns up repeatedly, promote it: add a rail to `income_rails`
so future statements classify it automatically, instead of one manual entry per
credit.

**Do not widen the search to make untraced money go away.** It is the obvious
idea and it is wrong. Tried on 2026-08-30: pulling five extra months of
impact.com history produced *twenty-four* subset sums landing within 2% of an
untraced credit, several hitting the same credit different ways. That is not
evidence, it is what a subset search does when given enough numbers — and acting
on it would have put a wrong tool name on real money. The window starts **Jan
2026** by the owner's decision. Untraced money gets named from something he
confirmed, never from a looser guess.

### 4c. Tool names — keep them human, and merge duplicates

Payers identify themselves by legal entity, which is neither readable nor
reliably one-per-tool. `rules.json` → `tool_aliases` fixes both:

- **Readability.** Legal suffixes (Inc., LLC, Corp, GmbH, Limited, ООД) strip
  automatically, so most names need no entry. Add one only when stripping is not
  enough — "Heygen Technology Inc." should read **HeyGen**, not "Heygen
  Technology".
- **Merging, which actually changes the numbers.** A tool can pay from more than
  one profile. Book Bolt pays as **Book Bolt LLC** *and* as **Дигитал Маркетинг
  Солутионс 2011 ООД**, its Bulgarian entity (same founder, Todor Karlikov —
  confirmed 2026-08-30). Left alone that splits one tool across two rows and
  understates it: ₹15,764 + ₹9,166 shown separately instead of ₹24,929, which
  moved Book Bolt from 8th to 5th biggest earner.

So when an unfamiliar payer appears, **identify it before accepting it as a new
tool** — it may be one already on the list under another name. The owner's
tracking links are the ground truth for what he actually promotes; query the
`links` table of `clicks-db` for `SELECT DISTINCT tool` and cross-check.

**Some payers are not tools at all** — affiliate agencies and processors that pay
out on behalf of brands. Those go in `unidentified_payers`, never `tool_aliases`.
Writing an agency's name in the Tool column claims the owner promotes it, which
is false; he rejected exactly that on 2026-08-30. They render as **Unidentified**,
keeping the payer as evidence the way untraced money keeps its bank reference,
and the invariant becomes:

    tools + unidentified + untraced == bank_total

**Currently unidentified: DigitalWorks** (Дигитал Маркетинг Солутионс 2011 ООД,
`a.todorova@digitalworks.net`) — ₹9,165.59 in Aug 2026. An affiliate-management
agency, so the brand behind it is unknown. Ask the owner; when he knows, move it
from `unidentified_payers` to `tool_aliases` and it becomes a normal tool row.

### 5. Test, then publish

```bash
python3 pipelines/income-analysis/test_income.py    # 34 tests, must be green
cd apps/yt-income && npm run deploy                 # sync + typecheck + build + deploy
```

`npm run build` copies `summary.json` into the Worker bundle, so a deploy cannot
ship stale figures. The page never calls PayPal, impact.com or PartnerStack —
the Worker holds no such credential, by design.

To look before deploying:

```bash
cd apps/yt-income
npx wrangler dev --port 8793 --local          # needs .dev.vars
node scripts/shoot.mjs http://127.0.0.1:8793 .shots/rev.png --month=2026-03
```

`shoot.mjs` prints what actually rendered and exits non-zero on a page error, so
a blank chart cannot pass as a pass.

### 6. Commit

Stageable: `summary.json`, `apps/yt-income/src/worker/summary.json`, any
`rules.json` change, and code. Then run `commit-now`.

```bash
git status --short   # confirm NOTHING under data/ is staged
```

## Reporting back

In this order, kept short — the owner reads this tired:

1. **Total revenue** for the window, month by month.
2. **The reconciliation number** — say "difference INR 0.00", never "it reconciles".
3. **What could not be traced**, with the share and the credit dates.
4. **Anything still in PayPal**, with its as-of time. Zero is good news; say it.
5. **Anything new** — an unmatched payer, a month with no income.

## Known open questions

- **~₹80k of Airwallex credits are unattributed.** PartnerStack explains one
  payout; impact.com's payout dates are unavailable (its invoices endpoint 403s
  for this key). Widening that key's permissions would upgrade pass 3 from
  `inferred` to `matched`.
- **PayKickstart is parked.** Its API is gated to vendor plans and the owner is
  an affiliate. The dashboard names it as not connected rather than letting its
  absence read as zero.

## Related

- `pp-paypal-txns` — the PayPal CLI this skill drives.
- `docs/superpowers/specs/2026-08-30-yt-income-revenue-design.md` — why it is
  built this way.
- `pipelines/income-analysis/README.md` — the wider income-source inventory.
- Cost and Profit tabs are planned for `apps/yt-income`. A future
  `personal-dashboard` will reuse `data/parsed/`, including debits and the
  `self_transfer` rail — keep the parsed output transaction-complete.
