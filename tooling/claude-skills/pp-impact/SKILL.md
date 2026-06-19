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
