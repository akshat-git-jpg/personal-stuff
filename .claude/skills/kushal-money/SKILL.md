---
name: kushal-money
description: "Sync Kushal Money (kushal-income.agrolloo.com) - the owner's PERSONAL money: SBI savings, SBI Card, HDFC Tata Neu Infinity and Amazon Pay ICICI in one ledger. Fetches statements, alerts, receipts, Flipkart orders and trips, builds, publishes. Not YouTube income (that is `yt-income`). Trigger phrases: `sync Kushal Money`, `sync my money`, `month-end sync`, `update kushal income`, `here's my SBI statement`, `needs you`, `retag`, `personal finance`, `ledger`."
argument-hint: "[path to SBI statement PDF] | status"
allowed-tools: "Read Bash Edit Write Glob Grep"
---

# kushal-money - sync the personal ledger

Full detail: `pipelines/personal-finance/README.md` (section "The ledger (Kushal Money)"
and "Month-end routine"). Read it before changing code. App code: `apps/kushal-income`.

**Not this skill:** YouTube / affiliate income (mother's PNB passbook, PayPal, impact.com)
is `yt-income` -> yt-income.agrolloo.com.

## Standing rules (owner, 2026-09-27)

- **Sync is on demand only.** No cron, no VPS job, no launchd.
- **Confirm before big or bulk actions** (a full-history fetch, bulk retags, deletes).
  "no, what are you doing, pls confirm first".
- **No masking.** Data stays in gitignored `pipelines/personal-finance/data/` and the
  password-gated app.
- **Tags:** one main tag plus at most one sub-tag. Nothing is guessed; unknown stays
  "Needs you".
- Commits: one line, from a `pp-work` workspace, never in main.
- Don't ask about scraping Rapido's private API again.

## The month-end sync

What the owner does first (also shown on the app's Overview, "Where the data comes from"):
1. YONO: email himself the month's SBI statement (or hand you the PDF path).
2. Rapido app: request receipts for the month's rides.
3. Trip bookings (bus + stay, with times) on trips.agrolloo.com.

Then you run, from a workspace:

```bash
cd pipelines/personal-finance
export PF_DATA=/Users/kbtg/codebase/personal-stuff/pipelines/personal-finance/data
export PP_GOOGLE_SHARED=/Users/kbtg/codebase/personal-stuff/tooling/mcp/google-shared
cp ~/Downloads/AccountStatement_*.pdf "$PF_DATA/raw/"   # only if he gave a downloaded SBI PDF
python3 -m ledger.run                                    # fetch + build + publish
python3 -m unittest discover -s ledger/tests -t .
```

`ledger.run` fetches by itself: all 3 card statement PDFs (Gmail, the truth - the owner
never downloads these), card alerts (fill days after the last statement, "not final"),
SBI e-statements, Rapido + Uber receipts (Gmail), Flipkart orders (`pp-flipkart`), trips
(trips.agrolloo.com -> `data/inbox/trips.json`).

Then report to the owner: rows, any statement that did not add up, the Needs-you count,
and anything the log says "skipped". Ask him to tag Needs you in the app.

## When something breaks

| Log says | Do |
|---|---|
| `flipkart: skipped (Not logged in...)` | owner runs `tooling/cli/flipkart/pp-flipkart login` (OTP) |
| `no saved password opens X.pdf` for a NEW statement | ask the owner for the new password -> `data/config.json` `passwords` |
| 8 old SBI copies locked | known, harmless: old email copies, no month gap |
| a statement does not add up | it is skipped and shown on Overview; do not force it |
| `trips: skipped` | last saved `data/inbox/trips.json` is used |

## Where rules live

- Payee rules: `pipelines/personal-finance/ledger/rules.json` (match on VPA/account, not name).
- Main/sub tag mapping: `ledger/build.py` `MAIN_OF`, `MAINS`, `SUBS`; client `src/client/lib.ts` `MAINS`.
- Trips: `ledger/trips.py`. Window = first Departs/Check in -> last Arrives/Check out
  booking field. Timed payments must be inside it; stay/ticket bookings up to 30 days before
  count. Quick-delivery apps (Zepto, Blinkit, Instamart, Flipkart Minutes) are never trip.
- Flipkart matching: `ledger/evidence.py` `match_flipkart`.
- App changes: `cd apps/kushal-income && npm run typecheck && npm run build && npm run deploy`.
  Lint is broken (typescript-eslint missing). Verify UI by rendering `dist/` with Playwright
  and routing `/api/ledger` to `data/ledger.json` (no app password needed).

## Parked (owner said later)

In `pipelines/personal-finance/README.md` "Parked": same-day SBI payments, a sync button,
leftover Needs-you payees + the 15 Sep Redbus ₹2,728.95, renaming the kushal-tools hub card
to "Kushal Money", and whether to keep or merge the health and travel tags.
