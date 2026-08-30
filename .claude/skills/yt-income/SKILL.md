---
name: yt-income
description: "Refresh the Income tab on yt-analytics.agrolloo.com from a bank passbook plus the PayPal CLI. Ingests a password-protected PNB statement, sorts every credit into income rails vs personal money, reconciles PayPal against the bank, then rebuilds and redeploys. Trigger phrases: `yt-income`, `update my income`, `here's the passbook`, `new passbook`, `refresh the income dashboard`, `how much did I earn`, `ingest passbook`."
author: "akshat-git-jpg"
license: "Apache-2.0"
argument-hint: "[path to passbook PDF] | status | reconcile"
allowed-tools: "Read Bash Edit Write Glob Grep"
---

# yt-income — refresh the income dashboard

Turns a bank passbook plus PayPal into the numbers behind the **Income** tab of
`yt-analytics.agrolloo.com`.

The owner has two income paths and only one of them can be automated:

| Path | How money arrives | Automatable? |
|---|---|---|
| PayPal | Affiliate pays PayPal → PayPal settles INR to the bank by NEFT | Yes — `paypal-txns-pp-cli` |
| Direct to bank | Affiliate (via Airwallex, etc.) pays the bank directly | **No** — only visible in a passbook |

So this skill is **manually triggered**. It runs when the owner exports a fresh
passbook, not on a schedule.

## Where everything lives

| Thing | Path |
|---|---|
| Ingest script | `pipelines/income-analysis/ingest.py` |
| Classification rules | `pipelines/income-analysis/rules.json` |
| Raw passbooks (**gitignored**) | `pipelines/income-analysis/data/raw/` |
| Per-statement transactions (**gitignored**) | `pipelines/income-analysis/data/parsed/` |
| Committed aggregates | `pipelines/income-analysis/summary.json` |
| Dashboard tab | `apps/analytics-app/src/client/IncomeView.tsx` |
| Build-time copy into the Worker | `apps/analytics-app/scripts/sync-income.mjs` |

<EXTREMELY-IMPORTANT>
**This repo is PUBLIC** (`github.com/akshat-git-jpg/personal-stuff`).

A passbook carries the mother's account number, her address, family names and UPI
handles. `data/` is gitignored and must stay that way. Never `git add -f` anything
under `data/`. Never paste a raw transaction line into a commit message, a PR body,
a decisions.md entry, or any committed file.

Only `summary.json` is committed, and only because it holds month totals per rail
plus PayPal program names — no counterparties, no account numbers. If you ever add
a field to `summary.json`, check it against that bar first.
</EXTREMELY-IMPORTANT>

## Before you start

Claim a workspace — the main checkout refuses to record git history:

```bash
cd "$(pp-work claim --kind code --slug yt-income)"
```

## The run

### 1. Get the passbook

If the owner named a file, use it. Otherwise look in `~/Downloads` for a recent
PNB statement:

```bash
ls -lat ~/Downloads/*.pdf | head -20
ls ~/Downloads | grep -iE "pnb|stmt|8619|passbook"
```

PNB exports are named like `PNBONE_STMT_XX8619_30082026.pdf`. Ask before ingesting
anything you are not sure about — an SBI *password-reset form* has been mistaken
for a passbook before.

Copy it in (do not move it — leave the owner's download alone):

```bash
cp "<pdf>" pipelines/income-analysis/data/raw/
```

**The PDF password is the account number**, stored in the gitignored
`data/config.json`. If that file is missing, recreate it:

```bash
printf '{\n  "pdf_password": "<account number>"\n}\n' > pipelines/income-analysis/data/config.json
```

The owner has the number. Do not guess it, and never commit it.

### 2. Ingest

```bash
cd pipelines/income-analysis && python3 ingest.py --with-paypal
```

This re-reads **every** PDF in `data/raw/`, so overlapping statements are fine —
later ones simply restate the same months. It prints the transaction count per
file and the income total.

`--with-paypal` also pulls `paypal-txns-pp-cli income` for the earned-side and
per-program numbers, **and the live PayPal balance** — money received but not yet
withdrawn to the bank. That balance becomes the "Still in PayPal" strip at the top
of the Income tab.

The dashboard never calls PayPal itself: the Worker holds no PayPal credentials,
so the strip is a snapshot taken here and labelled with its as-of time. A stale
zero and a real zero look identical without that timestamp, which is why the strip
always prints it. Drop the flag to skip PayPal entirely (useful when the API is
down; the bundled PayPal block is then left as-is, and the strip keeps its old
as-of date).

### 3. Reconcile — this is the check that matters

PayPal reports what it sent to the bank. The passbook shows what arrived. They
must agree:

```bash
cd pipelines/income-analysis && python3 - <<'EOF'
import json
d = json.load(open("summary.json"))
bank = sum(m.get("paypal", 0) for m in d["bank_by_month"].values())
pp = sum(float(m["bank_amount"] or 0) for m in d.get("paypal", {}).get("months", []))
print(f"bank NEFT from PayPal : INR {bank:,.2f}")
print(f"PayPal says settled   : INR {pp:,.2f}")
print(f"difference            : INR {bank - pp:,.2f}")
EOF
```

A difference of **0.00** means the parse is trustworthy. Report the number either
way — never claim reconciliation without printing it.

If it is not zero, the usual causes, in order:
- The statement window and the PayPal window differ (PayPal defaults to
  1 Jan 2026 → today). A payout near an edge lands in one and not the other.
- A payout is still in transit — sent by PayPal, not yet credited.
- The remarks wrapped in a way the parser mis-joined. Check
  `data/parsed/<name>.json` for a transaction whose `remarks` looks glued to its
  neighbour.

### 4. Sanity-check the classification

Anything the rules do not recognise falls into `personal` and is **excluded from
income**. That is the safe default, but it silently hides a new payout rail. Look
at what got excluded:

```bash
cd pipelines/income-analysis && python3 - <<'EOF'
import json, glob
rows = [t for f in glob.glob("data/parsed/*.json") for t in json.load(open(f))
        if t["type"] == "CR" and t["rail"] == "personal" and t["amount"] >= 3000]
for t in sorted(rows, key=lambda t: -t["amount"]):
    print(f"{t['date']}  {t['amount']:>12,.2f}  {t['remarks'][:80]}")
print(f"\n{len(rows)} unclassified credits >= INR 3,000, "
      f"totalling INR {sum(t['amount'] for t in rows):,.2f}")
EOF
```

Scan for anything that looks like a company rather than a person. If you find a
new network, add a rail to `rules.json` and re-run step 2:

```json
{ "id": "partnerstack", "label": "PartnerStack", "match": ["PARTNERSTAC"] }
```

Match on a substring that is stable across statements — the payer name fragment,
not a transaction id.

**Known open question:** the `airwallex` rail is a real payout rail, but *which*
network pays through it is unconfirmed. impact.com earnings for Jan–Aug 2026 were
only ~INR 29,017 against ~INR 88,347 of Airwallex credits, so it is not (only)
impact.com. Ask the owner if it comes up; do not guess a label.

### 5. Publish

```bash
cd apps/analytics-app && npm run build   # runs sync:income, tsc, vite
npm run deploy
```

`npm run build` copies `summary.json` into `src/worker/income-summary.json`, so a
deploy can never ship stale figures. The tab is at
`yt-analytics.agrolloo.com` → **Income**, behind the same password as the rest of
the app.

To eyeball it before deploying:

```bash
cd apps/analytics-app
npx wrangler dev --port 8792 --local     # needs .dev.vars
node scripts/shoot.mjs http://127.0.0.1:8792 .shots/income.png --tab=Income
```

`shoot.mjs` prints what actually rendered (headline, bar count, table rows) and
exits non-zero on a page error, so a blank chart cannot pass as a pass.

First local run only: the local D1 is empty and `/api/videos` 500s, which bounces
you back to the login screen. Seed it once:

```bash
for f in ../redirector/migrations/*.sql; do npx wrangler d1 execute clicks-db --local --file="$f"; done
npx wrangler d1 migrations apply yt-rankings --local
```

### 6. Commit

Only these may be staged:

- `pipelines/income-analysis/summary.json`
- `apps/analytics-app/src/worker/income-summary.json`
- any `rules.json` change

Then run the repo's commit gate — `commit-now`. One-line conventional subject, no
body, no AI attribution.

```bash
git status --short   # confirm NOTHING under data/ is staged
```

## Reporting back

Give the owner, in this order:

1. **Total real income** for the window, and the month-by-month split by rail.
2. **The reconciliation number** — say "difference INR 0.00", not "it reconciles".
3. **Anything still in PayPal** — the balance and its as-of time. Zero is the good
   answer; say it explicitly rather than staying silent.
4. **What was excluded** as personal, with the total, so a missing rail is visible.
5. **Anything new** — a payer that did not match a rule, a month with no income.

Keep it short. The owner reads this tired.

## Two views of the same money — do not conflate them

- **Landed** — bank credit dates. Complete: includes rails that never touch PayPal.
- **Earned** — PayPal's own month attribution.

The PayPal totals match; the per-month split does not. The dashboard toggles
between them and labels which is on screen. When quoting a single monthly figure,
use **landed** unless asked otherwise — it is the one the passbook can prove.

## Related

- `pp-paypal-txns` — the PayPal CLI this skill drives.
- `pipelines/income-analysis/README.md` — the wider income-source inventory.
- A future `personal-dashboard` will reuse `data/parsed/`, including debits and
  the `self_transfer` rail (owner topping up his mother's account). Keep the
  parsed output transaction-complete; do not filter it down to income only.
