---
name: pp-tolt
description: Read the Tolt affiliate partner dashboard (OpenArt Creators) via tolt-pp-cli — payouts, totals earned/paid/pending, and the next payout date. Use when asked about OpenArt income, Tolt payouts, "did OpenArt pay me", or when the yt-income tally needs OpenArt figures. Also read this before adding another per-tool affiliate CLI: it is the template.
---

# pp-tolt — the OpenArt / Tolt partner dashboard

`tolt-pp-cli` reads **openartinfluencers.tolt.io**, the partner-side portal for the
OpenArt Creators affiliate program. Read-only.

This is the **first per-tool CLI source**, and the pattern the next one copies. The
point of building these is to stop inferring income from a bank statement and start
reading the dashboards that actually know.

## The two commands that matter

```bash
set -a; . ~/.config/tolt-pp-cli/session.env; set +a
export TOLT_SESSION_COOKIE="$TOLT_SESSION_TOKEN"

tolt-pp-cli data get-payout-stats --json --no-cache   # earned / paid / pending / next
tolt-pp-cli data list-payouts     --json --no-cache   # every payout, newest first
```

**Always pass `--no-cache`.** The CLI caches responses, and a cached body predates
any later change to the redaction filter — a stale cache is how the account number
leaked once already.

**Amounts are in CENTS, as STRINGS.** `"17536"` is $175.36. The wire type is a
string even though the shape looks numeric; coerce, do not trust. This is the most
likely 100x bug in any consumer.

## Auth: a browser session, and it expires

Better Auth session cookie, stored at `~/.config/tolt-pp-cli/session.env` (0600,
outside every repo). It lasts about two weeks.

**When any command returns 401, the session lapsed.** Renew it:

1. Log in at `https://openartinfluencers.tolt.io/payouts`
2. DevTools → Network → refresh → click any `/api/data/` request
3. Right-click → Copy → Copy as cURL
4. Take the value of `__Secure-tolt-affiliates-auth.session_token` out of the
   `Cookie:` header and replace `TOLT_SESSION_TOKEN=` in the env file

Check how long is left without guessing:

```bash
tolt-pp-cli tolt-partner-portal-auth get-session --json --no-cache   # session.expiresAt
```

## ⚠️ It returns the bank account number

Tolt puts `payout_details` on **every** payout row and on the partner profile: full
account number, IFSC, street address, city, postcode.

The account number is also **the password on the PNB passbook PDFs** this repo
parses. One careless `> out.json` would put the key and the lock in the same place,
in a public repo.

So the CLI **redacts by default**, in the HTTP client, before the cache, before
SQLite, before any print path. Reveal deliberately and never into a file:

```bash
TOLT_REVEAL_BANK_DETAILS=1 tolt-pp-cli data get-partner --no-cache
```

The first version of that filter sat in the output helper and `--json` walked
straight past it. If you touch the filter, re-test **both** `--json` and the table
path, and check the cache afterwards.

## How it feeds the income tally

`pipelines/income-analysis/sources.py::fetch_tolt()` shells out to the CLI on every
online `yt-income` run and caches to `data/networks/tolt.json`.
`attribute.py::pass_network_payouts()` then matches those payouts to Airwallex bank
credits.

**Tolt gets a 20-day settlement window** (`SETTLEMENT_WINDOW_DAYS`), where every
other network gets 10. Not a fudge: the payout row is stamped when Tolt *generates*
the payout, and the money moves when the *invoice* is issued — the receipt for the
8 Jul 2026 payout is dated 2026-07-23, the same day as the bank credit. Observed
lags: 7, 9, 11, 15, 15, 15 days.

**Validation that matters:** the six payouts had already been named by hand from a
screenshot. The CLI reproduces all six to the paisa, independently. If a future
change breaks that agreement, the change is wrong.

## Adding the next per-tool CLI

Copy the shape, not just the code:

1. **Build the CLI with `/printing-press`.** Discover endpoints from the site's own
   JS bundles — a Next.js app ships its fetch targets in the client chunks, so you
   can map the whole API before you have any credential.
2. **Check what the API returns that you did not ask for.** Tolt hands back a bank
   account number on a payouts call. Assume the next one does something similar, and
   look before shipping.
3. **`fetch_<name>()` in `sources.py`** — shell out to the CLI, normalise minor units
   to major once at the boundary, return `None` (never `{}`, never raise) when
   unconfigured, and register it in `preflight()` so an outage reads as *down* rather
   than as *zero income*.
4. **Reuse `pass_network_payouts()`.** Do not write a new matcher. It already has the
   FX band, the window, and the refusal to guess between two candidate credits. Only
   add a `SETTLEMENT_WINDOW_DAYS` entry, with the measurement that justifies it.
5. **Never widen a window or a band to make untraced money disappear.** Widen only
   with evidence, only for that source, and check the result against something you
   knew independently beforehand.
