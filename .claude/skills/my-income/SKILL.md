---
name: my-income
description: "Sync Kushal Money (kushal-income.agrolloo.com) - the owner's PERSONAL money: SBI savings, SBI Card, HDFC Tata Neu Infinity and Amazon Pay ICICI in one ledger. Fetches statements, alerts, receipts, Flipkart orders and trips, builds, publishes. Not YouTube income (that is `yt-income`). Trigger phrases: `my-income`, `sync my income`, `sync Kushal Money`, `sync my money`, `month-end sync`, `update kushal income`, `here's my SBI statement`, `needs you`, `retag`, `personal finance`, `ledger`."
argument-hint: "[path to SBI statement PDF] | status"
allowed-tools: "Read Bash Edit Write Glob Grep"
---

# my-income - sync the personal ledger

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
ls -t ~/Downloads/AccountStatement_*.pdf | head; ls -t "$PF_DATA/raw/" | head   # ALWAYS, even if he gave no path
cp ~/Downloads/AccountStatement_<new>.pdf "$PF_DATA/raw/"   # each Downloads PDF not yet in raw/
python3 -m ledger.run                                    # fetch + build + publish
python3 -m unittest discover -s ledger/tests -t .
```

Check Downloads every time, before the first run. A YONO download lands there and the
owner often forgets to mention it; a missed PDF means a second full sync.

`ledger.run` fetches by itself: all 3 card statement PDFs (Gmail, the truth - the owner
never downloads these), card alerts (fill days after the last statement, "not final"),
SBI e-statements, Rapido + Uber receipts (Gmail), Flipkart orders (`pp-flipkart`), trips
(trips.agrolloo.com -> `data/inbox/trips.json`).

## After the sync: count from the app, then find proof yourself

**The real Needs-you list lives in the app's D1, not in `data/ledger.json`.** The local
file is the sync's view only; the owner's tags (`overrides`, per row) and payee rules
(`rules`) live in D1 database `kushal-money` (id `1e875676-43a7-47f1-8fd3-5e9c28edb465`)
and win on read. Counting from the local file reported 24 when the app said 14, and asked
about rows he had already tagged (2026-10-01). Query D1 with `mcp__cloudflare__d1_query`:

```sql
SELECT id, date, json_extract(data,'$.amount') amt, json_extract(data,'$.payee') payee
FROM rows WHERE json_extract(data,'$.status')='needs' AND json_extract(data,'$.kind')!='payment'
  AND id NOT IN (SELECT row_id FROM overrides) AND payee_key NOT IN (SELECT payee_key FROM rules)
ORDER BY date DESC
```

The app's badge counts rows; "All time (N)" on Needs you counts payees. They differ when
one payee has two rows. "This month" there means the newest month with any row, so on the
1st of a month it can hide the month just synced: point him at "All time".

**Before handing him the list, dig for proof on every new row.** He should never have to
ask "did you check X?". For each row, in this order:
1. `data/inbox/alerts/*.json`: the card alert has the exact payee VPA and send time.
2. Gmail (`pp-gmail --account kushalbakliwal25@gmail.com search 'after:<epoch> before:<epoch>'`)
   in a window around that time: recharge mails (Jio, Vi), booking mails (Cleartrip,
   IRCTC, airlines), shop receipts.
3. Rapido receipts (`data/inbox/rapido/*.pdf`, `pdftotext -layout`): same fare, same day.
   Also use the day's rides to say where he was ("between home→office 11:39 and office→home 19:05").
4. The trip planner, `data/inbox/trips.json` (fetched from trips.agrolloo.com every sync).
   Read it for ANY travel-looking row (flight, train, bus, stay, Cleartrip, IRCTC, airline),
   whatever the date: each booking carries PNR / refs, times and a `Paid` amount. A booking
   made weeks before a trip is still that trip's money. Use the planner's trip name for the
   sub-tag: `["trip","<trip>-flight|train|bus|stay|food|auto|metro"]`, never a bare
   `<trip>` sub and never `travel` for a planned trip (2026-10-01: the 30 Oct flight was
   tagged by hand without reading the planner, and its train + return flight stayed
   `travel`).
5. Flipkart orders, already joined by the sync.

Tag only what a document proves, then show him one table (row, proof, tag) and ask about
the rest with every detail you found (day, time, card, VPA, UPI ref, where he was).

**Saving tags.** Write to D1 `overrides` with the MCP (local `wrangler` needs Node 22 and
fails on the default Node 20). Shape: `tags` = JSON `["<main>","<sub>"]`, main from
`MAINS`; the Worker's `/api/tag` now rejects anything else. Re-select after the write to
confirm. Row ids are `src + date + amount + occurrence`, so a tag on a "not final" alert
row survives when the statement replaces it.

```sql
INSERT OR REPLACE INTO overrides (row_id, tags, descr, updated_at)
VALUES ('<row id>', '["bills","jio"]', 'Jio recharge', '<ISO now>')
```

Then report: rows, any statement that did not add up, what you tagged and why, what is
left (from D1), any card bill due soon, and anything the log says "skipped".

## When something breaks

| Log says | Do |
|---|---|
| `flipkart: skipped (Not logged in...)` | run `tooling/cli/flipkart/pp-flipkart login` yourself, in the background. Tell him first: it opens a SEPARATE Playwright browser (his Chrome login does not count), he logs in there with phone + OTP or, if it already shows logged in, opens My Orders; he must NOT close it, it closes itself once orders load and the login is saved. "Something's not right" on the orders page = half-dead session: My Account → Logout, log in again. Re-run the sync after `Logged in.` |
| `no saved password opens X.pdf` for a NEW statement | ask the owner for the new password -> `data/config.json` `passwords` |
| 8 old SBI copies locked | known, harmless: old email copies, no month gap |
| a statement does not add up | it is skipped and shown on Overview; do not force it |
| `trips: skipped` | last saved `data/inbox/trips.json` is used |

## Where rules live

- Payee rules: `pipelines/personal-finance/ledger/rules.json` (match on VPA/account, not name).
- Main/sub tag mapping: `ledger/build.py` `MAIN_OF`, `MAINS`, `SUBS`; client `src/client/lib.ts` `MAINS`.
- Trips: `ledger/trips.py`. Window = first Departs/Check in -> last Arrives/Check out
  booking field. Timed payments must be inside it; stay/ticket bookings up to 30 days before
  count. A planner booking with a `Paid` field proves the payment of that amount (within
  ₹50) up to 120 days before the trip (`build.py` `match_bookings`), so ask the owner to
  fill `Paid` on every booking. Quick-delivery apps (Zepto, Blinkit, Instamart, Flipkart
  Minutes) are never trip.
- Flipkart matching: `ledger/evidence.py` `match_flipkart`.
- App changes: `cd apps/kushal-income && npm run typecheck && npm run build && npm run deploy`.
  Lint is broken (typescript-eslint missing). Verify UI by rendering `dist/` with Playwright
  and routing `/api/ledger` to `data/ledger.json` (no app password needed).

## Parked (owner said later)

In `pipelines/personal-finance/README.md` "Parked": same-day SBI payments, a sync button,
leftover Needs-you payees + the 15 Sep Redbus ₹2,728.95, renaming the kushal-tools hub card
to "Kushal Money", and whether to keep or merge the health and travel tags.
