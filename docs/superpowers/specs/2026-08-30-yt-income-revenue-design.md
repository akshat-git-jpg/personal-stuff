# YT Income — Revenue tab

**Date:** 2026-08-30
**Status:** approved, ready for implementation plan

## Why this exists

The owner earns affiliate commissions from ~15 software tools. The money reaches
one place — his mother's PNB account — by two routes:

```
Tool ──► PayPal ─────────────► Bank
Tool ──► network ──► Airwallex ──► Bank
```

Today he cannot answer "how much did HeyGen make me in August" without opening
four dashboards. Worse, the numbers in those dashboards are *accrual* figures
that never reconcile against the bank.

**This dashboard is his source of truth.** That single requirement drives every
decision below: a number that cannot be traced must say so, loudly, rather than
be quietly rounded into a total.

## Scope

In scope: a new standalone app `yt-income` with one **Revenue** tab, fed by an
attribution engine that ties every bank credit back to a named tool.

Out of scope for now, but the app's shape must not preclude them: a **Cost** tab
and a **Profit** tab. This is why Revenue lives in its own app rather than as a
fourth tab inside `yt-analytics` — cost and profit have no business inside an
analytics tool.

Explicitly parked: **PayKickstart**. Its API is gated to vendor plans and the
owner is an affiliate. The UI must state it is not connected rather than let its
absence read as zero.

## Vocabulary

| Term | Meaning |
|---|---|
| **Rail** | How money entered the bank: `paypal` (NEFT from Citi) or `airwallex` (IMPS) |
| **Network** | Who the affiliate relationship is with: PayPal-direct, impact.com, PartnerStack |
| **Tool** | The software being promoted: HeyGen, ElevenLabs, Base44 |
| **Route** | The full path, e.g. `PartnerStack → Airwallex → Bank` |
| **Traced** | A bank credit we can attribute to a named tool |
| **Untraced** | A bank credit that genuinely arrived but has no tool against it |

## Principle: the bank is the truth

Every figure on the dashboard derives from bank credits. Network-reported
earnings are used **only** to explain those credits, never to add to them.

Consequences, all deliberate:

- The monthly total always equals the passbook. It can be checked by eye.
- A commission earned but not yet paid does not appear. That is correct — it is
  not income until it lands.
- The tool rows plus Untraced always sum to the bank total. Untraced is a
  permanent row, not an error path.

**When attribution is ambiguous, leave it untraced.** A wrong attribution is
worse than an honest gap, because it silently corrupts the source of truth.

## Data sources

| Source | Access | Gives us | Status |
|---|---|---|---|
| Bank passbook | Manual PDF export, parsed by `ingest.py` | Every credit, dated, with remarks | Working |
| PayPal | `paypal-txns-pp-cli` | Per-program received + INR settled to bank | Working, reconciles to ₹0.00 |
| impact.com | `impact-pp-cli` | Per-program earnings by month (`Action_Cost`) | Working. **Invoices endpoint returns 403**, so payout dates are unavailable |
| PartnerStack | Partner API, bearer token | `/v2/payouts` (dated, USD), `/v2/rewards` (per company) | Working, key in `infra/secrets/partnerstack.env` |
| PayKickstart | — | — | Not connected |

### Known data facts (verified 2026-08-30)

- PartnerStack pays into the same PNB account (`account_number_last_4: 8619`),
  confirming Airwallex is a shared payout rail.
- PartnerStack tools: ElevenLabs, n8n, Jungle Scout. impact.com tools: Base44,
  InVideo, Kittl. Neither set appears anywhere in PayPal.
- Airwallex credits Jan–Aug 2026 total ₹88,347 across 9 credits. PartnerStack
  paid 5 times in that period; only one (3 Mar, USD 85.29 → 6 Mar, ₹7,567.40)
  matches cleanly on date and rate.

## Privacy — non-negotiable

`personal-stuff` is a **public** GitHub repository.

- `pipelines/income-analysis/data/` is gitignored in full. Raw passbooks, parsed
  transactions and API responses never leave the machine.
- The PartnerStack payouts response embeds the mother's **full street address,
  city, postcode and account last-4**. The ingest must strip `provider.meta`
  before anything is written to a file that could be committed.
- Only aggregates reach `summary.json`: month, rail, tool name, amount, route.
  No counterparty names, no account numbers, no customer records.
- A leak check runs as part of ingest and fails the run if the account number,
  the mother's name, or a UPI handle appears in `summary.json`.

## The attribution engine

Lives in `pipelines/income-analysis/attribute.py`. Pure function over already-
ingested data; no network calls of its own.

**Input:** bank credits, PayPal program settlements, PartnerStack payouts +
rewards, impact.com monthly per-program earnings.
**Output:** per month, a list of `{tool, amount_inr, route, confidence}` plus an
untraced remainder.

### Pass 1 — PayPal (exact)

`paypal-txns-pp-cli income` already attributes each USD receipt to a program and
reports the INR that settled. Trust it wholesale.

- Route: `PayPal → Bank`, confidence `exact`.
- **Guard:** the sum of PayPal-attributed INR must equal the sum of bank credits
  on the `paypal` rail. Today this is exactly ₹0.00 apart. If it ever diverges,
  the run reports the difference and the excess becomes untraced rather than
  being forced.

### Pass 2 — PartnerStack (matched)

For each PartnerStack payout `(date D, amount A USD)` not yet consumed:

1. Candidate bank credits: rail `airwallex`, unconsumed, dated `D … D+10 days`.
2. Keep candidates whose implied rate `credit_inr / A` lands in **78–96 INR/USD**.
3. **Exactly one candidate → match.** Zero or more than one → leave both sides
   alone and record the reason.
4. Split the matched credit across PartnerStack rewards attributable to that
   payout (status paid, created before `D`, not already assigned), pro-rata by
   reward amount, grouped by `company.name` → tool.

- Route: `PartnerStack → Airwallex → Bank`, confidence `matched`.
- The implied FX rate is recorded per match so drift is visible over time.

### Pass 3 — impact.com (inferred)

impact.com will not expose payout dates (403), so this pass is weaker and is
labelled as such.

For each remaining unconsumed `airwallex` credit, look for a month whose
impact.com earnings, converted at the band above, are within **2%** of the
credit. Require uniqueness exactly as in pass 2. On a match, split across that
month's impact programs pro-rata by `Action_Cost`.

- Route: `impact.com → Airwallex → Bank`, confidence `inferred`.
- The UI marks inferred rows so they are never mistaken for proven ones.

### Pass 4 — untraced

Whatever bank credit value remains. Recorded with the credit dates and rails so
the owner can check the statement by hand, and with a machine-readable reason:
`no_candidate`, `ambiguous`, `rate_out_of_band`, or `source_not_connected`.

### Ordering and idempotency

Passes run in confidence order (exact → matched → inferred) so a strong claim
always wins a contested credit. The engine is deterministic: same inputs, same
output, no reliance on dict ordering or wall-clock time.

## Data shape

`pipelines/income-analysis/summary.json` (committed, aggregates only):

```jsonc
{
  "generated_at": "2026-08-30T16:57:51",
  "coverage": { "from": "2026-01", "to": "2026-08" },   // caps the date picker
  "sources": [
    { "id": "paypal",       "label": "PayPal",        "state": "connected", "as_of": "..." },
    { "id": "bank",         "label": "Bank passbook", "state": "manual",    "as_of": "..." },
    { "id": "impact",       "label": "impact.com",    "state": "connected", "as_of": "..." },
    { "id": "partnerstack", "label": "PartnerStack",  "state": "connected", "as_of": "..." },
    { "id": "paykickstart", "label": "PayKickstart",  "state": "absent",
      "note": "No credentials — affiliate accounts have no API access." }
  ],
  "months": {
    "2026-03": {
      "bank_total": 41061.57,
      "rails": { "paypal": 11409.81, "airwallex": 29651.76 },
      "tools": [
        { "tool": "HeyGen", "amount": 5587.69,
          "route": ["PayPal"], "confidence": "exact" },
        { "tool": "ElevenLabs", "amount": 7567.40,
          "route": ["PartnerStack", "Airwallex"], "confidence": "matched",
          "implied_fx": 88.72 }
      ],
      "untraced": {
        "amount": 22084.36,
        "reasons": ["no_candidate"],
        "credits": [ { "date": "19/03/2026", "amount": 22084.36, "rail": "airwallex" } ]
      }
    }
  },
  "paypal_pending": { "as_of": "...", "holdings": [ ... ], "total_any_currency": 0.0 }
}
```

`route` omits the trailing `Bank` — the UI appends it, since every route ends
there by definition.

## The app

New Cloudflare Worker at `apps/yt-income/`, custom domain
**`yt-income.agrolloo.com`**. React + Vite + Hono, matching `analytics-app` so
the two are maintained the same way. Single-password gate reusing the house
`auth.ts` pattern (`APP_PASSWORD` + `SESSION_SECRET`).

`scripts/sync-summary.mjs` copies `summary.json` into the Worker bundle during
`npm run build`, so a deploy cannot ship stale figures. The page never calls
PayPal, impact.com or PartnerStack — the Worker holds no such credentials.

### Layout, top to bottom

1. **Tabs** — Revenue (active), Cost and Profit rendered but disabled, marked
   "soon", so the intended shape is visible from day one.
2. **Snapshot bar** — `Snapshot — not live. Data as of <date>`, plus the
   statement coverage. This is load-bearing: without it a zero is ambiguous
   between "earned nothing" and "nobody has run the ingest".
3. **Period picker** — year arrows (any year) plus a 12-month grid. Defaults to
   the current month. Months past `coverage.to` are **disabled**, so a period we
   cannot answer cannot be selected. Months with data carry a dot.
4. **Source strip** — one chip per source with its state. PayKickstart renders
   dashed and reads "not connected".
5. **The tally** — the month's bank total as the headline, a traced/untraced
   proportion bar, and a verdict chip: `✓ Every rupee traced to a tool` or
   `⚠ ₹X could not be traced to a tool`.
6. **Revenue by tool** — one row per tool: colour swatch, name, route as chips,
   amount, share. Inferred rows carry a marker. The untraced row is always last
   and always present when non-zero. The footer totals to the bank figure.
7. **Untraced explainer** — shown only when untraced is non-zero. Names the
   likely causes, PayKickstart's absence first.
8. **Month-by-month chart** — stacked bars, one segment per tool.

### Colour rules

Taken from the `dataviz` skill and validated against the card surface
`#181310` with `scripts/validate_palette.js`:

- Seven tool hues, `#3987e5 #d95926 #199e70 #c98500 #d55181 #9085e9 #008300`,
  assigned in fixed order by each tool's total across the whole window.
  **Colour follows the tool, never its rank in a month.**
- Tools beyond seven fold into a neutral "Other tools". Folding is display-only:
  hovering names every folded tool with its amount and route.
- Untraced is dark red `#c62828` **with a diagonal hatch**. The hatch is not
  decoration — dark red sits ΔE 9.6 from the orange tool hue, under the safe
  floor of 15, so texture is what keeps them distinguishable.
- The chart is deliberately tall. One outsized month (Feb 2026, a single ₹1.28L
  TradingView payout) otherwise flattens every other month's split.

### States that must be explicit

| State | Behaviour |
|---|---|
| Month with data | Normal render |
| Month with no data | "No data imported for X. This is **not** zero revenue." Names the fix. |
| Month past the snapshot | Disabled in the picker; if reached, explains the snapshot boundary |
| Untraced money present | Red hatched row, warning verdict, explainer |
| A source not connected | Dashed chip; named in the untraced explainer |

## Terminal output

The `yt-income` skill prints the same tally it publishes. A discrepancy is
reported in both places or in neither.

```
Revenue — Aug 2026
  Bank received            INR  33,001.07
  Traced to tools          INR  33,001.07   (100%)
  Untraced                 INR       0.00
  ✓ tallies

PayPal reconciliation
  bank NEFT from PayPal    INR 304,532.36
  PayPal says settled      INR 304,532.36
  difference               INR       0.00
```

**Exit non-zero only when the PayPal reconciliation breaks.** That is a genuine
bug signal: PayPal claims it sent money the bank never received, or vice versa.

Untraced money is **not** a failure. It is the expected state today — 28% of
Jan–Aug 2026 is untraced — and a gate that fails on the normal case gets
disabled within a week. Instead it is reported loudly every run, with the
per-month share and the offending credit dates, so the number stays uncomfortable
without blocking the pipeline.

The failure mode this design exists to prevent is a silent publish of numbers the
engine cannot defend. Loud and shipped beats silent and blocked.

## Migration

The Revenue work currently lives as an **Income** tab inside `analytics-app`,
deployed at `yt-analytics.agrolloo.com`. Sequence, so there is never a gap:

1. Build and deploy `yt-income`, verify against the passbook.
2. Remove the Income tab, `/api/income`, `IncomeView.tsx`, `sync-income.mjs` and
   the income CSS from `analytics-app`; redeploy.
3. Point the `yt-income` skill at the new app.

## Testing

- **Attribution engine** — unit tests over fixtures: exact PayPal case, a clean
  PartnerStack match, an ambiguous credit that must stay untraced, a rate outside
  the band, an empty month. Assert tools + untraced == bank total for every case.
- **Reconciliation** — assert PayPal bank NEFT total equals PayPal settled total
  on real data (currently ₹0.00).
- **Leak check** — assert `summary.json` contains no account number, no
  mother's name, no UPI handle, no street address.
- **UI** — `scripts/shoot.mjs` renders each state headless, asserts the rendered
  totals match the fixture and that the page logs no errors.

## Open questions

- **Which network is behind the remaining ₹80k of Airwallex credits?**
  PartnerStack accounts for roughly ₹25k lifetime. impact.com earned ₹29k in the
  window. Pass 3 may close the gap; whatever remains stays untraced and visible.
- **impact.com payout dates.** The invoices endpoint 403s. If the owner can
  widen the API key's permissions, pass 3 upgrades from `inferred` to `matched`.
