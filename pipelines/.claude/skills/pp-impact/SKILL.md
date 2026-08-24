---
name: pp-impact
description: "impact.com Partner API CLI for your affiliate income. Read earnings by program/software and by day/month, list joined programs, conversions, invoices (payouts), and contracts for the Agrollo media-partner account. Trigger phrases: my impact.com income, affiliate earnings, earnings by program, earnings by month, impact.com conversions, affiliate payouts, which affiliate program earns most, impact.com invoices, use impact, run impact."
author: "akshat-git-jpg"
user-invocable: true
argument-hint: "<command> [args]"
allowed-tools: "Read Bash"
metadata:
  version: 1.0.0
---

# impact.com — Partner income CLI (`impact-pp-cli`)

## Output contract — READ THIS FIRST

This section overrides every recipe further down the file. It exists because the reported
shape kept drifting between sessions.

### Report it month-wise, then per-program inside each month

The required shape, in this order:

1. One row per calendar month, oldest first.
2. Inside each month, one row per program (the `Campaign` field), largest earnings first.
3. A monthly subtotal on each month.
4. A grand total for the whole window.
5. Currency is INR. Say so — the account settles in INR, not USD.

Do not answer with a single total. Do not answer with a flat program list that has lost the
months. Do not switch to a program-first view unless the user asks for it.

### The API cannot do this in one call — you must loop

impact.com has **no month × program cross report**. Checked against the live report list
(2026-08-23): `partner_performance_by_month` gives months with no program breakdown,
`partner_performance_by_program` gives programs with no months, and nothing crosses the two.

So build the shape yourself: call `partner_performance_by_program` **once per calendar month**,
with the date range bounded to that month.

```bash
set -a; . /Users/kbtg/codebase/personal-stuff/infra/secrets/impact.env; set +a
for m in 2026-04 2026-05 2026-06 2026-07; do
  impact-pp-cli reports run partner_performance_by_program \
    --start-date "$m-01" --end-date "$m-31" --json 2>/dev/null
done
```

`--end-date` may overshoot the real month length; the API clamps it. Read
`results.Records[]` from each response and take:

- `Campaign` — the program name
- `Total_Cost` — **your earnings** for that program in that month

Ignore `Sale_Amount` (that is revenue you drove for the brand, not your money). Drop rows
where `Total_Cost` is zero unless the user asked for click/action activity too — a zero-earning
program with clicks is noise in an income answer.

`partner_performance_by_month` is still the right call for a months-only total, and it is a
useful cross-check: your per-month subtotals should match its `Earnings` column. If they do not,
say so rather than silently picking one.

### Known gap — a real `income` command does not exist yet

`paypal-txns-pp-cli` has an `income` subcommand that does this rollup inside the CLI and prints
the table with `--table`. `impact-pp-cli` has no equivalent, so the loop and the rendering are
the caller's job every time — which is exactly how the format drifted before. The durable fix is
an `income` subcommand on `impact-pp-cli` mirroring the PayPal one. Until that exists, this
section is the contract.

Also note: the `impact-pp-cli` source in `~/printing-press/library/impact/` is **not** mirrored
into this repo and not in any git repo. Adding that subcommand should start by mirroring the
source, the way `tooling/press-clis/paypal-txns/` was.

### Scope

This skill is repo-scoped on purpose: source in `pipelines/.claude/skills/pp-impact/`, symlinked
into `.claude/skills/`. It is deliberately **not** in `tooling/claude-skills/manifest/*.txt`,
because those scope by Claude account, not by repo — a manifest entry loads a personal-finance
skill into every ZluriHQ work session.

Reads your impact.com affiliate/publisher data: earnings by program and by time period, joined programs, per-conversion commissions, invoices (money paid out), and contracts. Account: **Agrollo** (media-partner `4809503`, currency **INR**).

## Prerequisites

This skill drives the local `impact-pp-cli` binary and needs the account credentials.

1. **Always source the credentials first** (HTTP Basic — Account SID + Auth Token):
   ```bash
   set -a; . /Users/kbtg/codebase/personal-stuff/infra/secrets/impact.env; set +a
   ```
2. Verify the binary: `impact-pp-cli --version`. If missing, rebuild from the local library (this CLI is **local-only**, not published, because the account id is baked into the base URL):
   ```bash
   (cd ~/printing-press/library/impact && go build -o ~/go/bin/impact-pp-cli ./cmd/impact-pp-cli)
   ```
3. Confirm auth: `impact-pp-cli doctor`.

Run every command in a shell where step 1 has been sourced, e.g.:
```bash
set -a; . /Users/kbtg/codebase/personal-stuff/infra/secrets/impact.env; set +a; impact-pp-cli reports run partner_performance_by_program --start-date 2026-01-01 --end-date 2026-06-19 --json
```

## When to use

Use for any question about the user's affiliate income on impact.com: how much each program/software earned, income over a date range, which programs convert best, recent conversions, and payouts received. JSON output (`--json`) parses cleanly once stderr warnings are dropped (`2>/dev/null`).

## Anti-triggers

- Not for impact.com *brand/advertiser*-side data — this is the media-partner (publisher) side only.
- Not for other affiliate networks (CJ, ShareASale, Amazon Associates).
- Not for changing payout/withdrawal settings — treat as read-only reporting.
- Do not publish this CLI or its spec anywhere — the base URL contains the account id.

## Income recipes (the main use cases)

Reports are the workhorse. Each report template uses its own column names, so the two income reports differ:

### Earnings by program / software
Report `partner_performance_by_program`. Columns: `Campaign` (the software), `Total_Cost` / `Action_Cost` (**your earnings**), `Sale_Amount` (revenue you drove), `Actions`, `Clicks`, `EPA` (earnings/action), `EPC` (earnings/click), `CR` (conversion rate).
```bash
impact-pp-cli reports run partner_performance_by_program --start-date 2026-01-01 --end-date 2026-06-19 --json 2>/dev/null
```
To rank software by income, sort rows by `Total_Cost` descending.

### Earnings by month / day
Reports `partner_performance_by_month` and `partner_performance_by_day`. Columns: `Month`/`Day`, `Earnings` (**your earnings**), `Sale_Amount`, `Actions`, `Clicks`.
```bash
impact-pp-cli reports run partner_performance_by_month --start-date 2026-01-01 --end-date 2026-06-19 --json 2>/dev/null
```

### Scope a report to one program
Add `--program <CampaignId>` (the SUBAID filter).

### Discover all available reports
```bash
impact-pp-cli reports list --json 2>/dev/null   # read each .Id, then `reports run <Id> ...`
impact-pp-cli reports metadata <report_id>       # accepted filters + returned columns
```

## Other commands

- `account info` — account name, currency, timezone.
- `programs list [--status Active|Expired]` — every program/software joined (23 active). `programs get <CampaignId>`.
- `actions list [--start-date --end-date --event-start --event-end --program --state PENDING|APPROVED|REVERSED]` — individual conversions with `Payout`, `Amount`, `EventDate`, `State`. **The date window is max 45 days and defaults to the last 7 days** — always pass a ≤45-day range for historical pulls. `actions get <ActionId>`.
- `invoices list [--start-date --end-date]` — invoices/payouts: `TotalAmount`, `CreatedDate`, plus line-item `Status` (PENDING/PAID/OVERDUE) and `PaidDate`. This is the *money-actually-paid* record. `invoices get <InvoiceId>`.
- `contracts list` / `contracts get <ContractId>` — payout terms per program.

## Output notes

- Live responses are wrapped as `{ "meta": {...}, "results": { ...impact envelope... } }`; report rows are under `results.Records`, list rows under `results.<ResourceName>` (e.g. `results.Campaigns`, `results.Actions`).
- A stderr warning `items returned but not cached locally (no extractable ID field)` is harmless for live queries — pipe stderr to `/dev/null`.
- Rate limits: performance-detail endpoints ~500/hr, aggregate reports ~250/hr; a 429 carries `Retry-After`.
