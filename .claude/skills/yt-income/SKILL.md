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
cd pipelines/income-analysis && python3 ingest.py --with-paypal
```

That single run: parses every PDF in `data/raw/`, pulls PayPal (income +
balance), PartnerStack and impact.com, runs the four attribution passes, writes
`summary.json`, and prints the tally.

Drop `--with-paypal` to parse the passbook only — useful when an API is down.
The previously fetched network data is then reused.

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
Airwallex.

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

### 5. Test, then publish

```bash
python3 pipelines/income-analysis/test_income.py    # 15 tests, must be green
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
