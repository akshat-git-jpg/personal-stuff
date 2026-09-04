---
name: pp-bookbolt
description: Read the Book Bolt affiliate portal via bookbolt-pp-cli — payouts, paid and pending commissions, earnings to date and progress to the next payout. Use when asked about Book Bolt income, "has Book Bolt paid me", the KDP/Book Bolt affiliate program, or when the yt-income tally needs Book Bolt figures. Read it before storing a PASSWORD for any other CLI: this is the first one that holds one.
---

# pp-bookbolt — the Book Bolt affiliate portal

`bookbolt-pp-cli` reads **affiliate.bookbolt.io**, the partner portal for the
Book Bolt affiliate program. Read-only.

The **second** per-tool CLI source, built to the template in
[`pp-tolt`](../pp-tolt/SKILL.md). Read that one first for the pattern; this one
documents where Book Bolt differs, and every difference below has bitten once.

## The commands

```bash
bookbolt-pp-cli payouts --json        # every real transfer. The money path.
bookbolt-pp-cli commissions --json    # individual lines; --paid / --pending
bookbolt-pp-cli stats --json          # earned, unpaid, threshold, progress
bookbolt-pp-cli payout-method --json  # which rail, handle redacted
```

No `--no-cache` needed: the money commands bypass the response cache already.

## Auth: a PASSWORD, and that changes the rules

Every other CLI here stores a pasted browser cookie. This one stores a
**username and password**, at `~/.config/bookbolt-pp-cli/session.env`, mode
0600, outside every repo.

That is not a shortcut, it is forced: the portal's Laravel session lives
**7200 seconds — two hours**. A pasted cookie would be stale before most runs.

Three consequences, all enforced in code:

1. **Five bad logins lock the account.** So the CLI attempts login **once per
   process** and a rejected credential is a **terminal** error that is never
   retried. If you are tempted to add a retry, don't.
2. **The password only ever goes to `affiliate.bookbolt.io`.** `NewSession`
   refuses to load credentials for any other host, so a test server, a mock, or
   a mistyped `BOOKBOLT_BASE_URL` can never receive it.
3. **The login field is `username`, not `email`.** One attempt was spent
   proving that.

## Money shape — the 100x trap

**Book Bolt sends DOLLARS as decimal strings: `"105.60"`, `"4.80"`.**

The sibling `tolt-pp-cli` sends **CENTS** as decimal strings: `"17536"`. The two
are indistinguishable by eye and differ by 100x, and a wrong choice still renders
as a plausible bar on a chart. `test_amounts_stay_in_dollars` in
`pipelines/income-analysis/test_income.py` guards it; it has been mutation-tested.

Dates are **MM/DD/YYYY**, confirmed rather than assumed: the two payouts read
`06/01/2026` and `08/01/2026`, and their PayPal credits land in `2026-06` and
`2026-08`.

**Never add commissions to payouts.** Commission lines aggregate *into* payouts;
adding both counts the same money twice. And `current_unpaid` is **not income** —
Book Bolt holds it until it crosses the threshold.

## ⚠️ Two sensitive surfaces

`/payment-settings` carries the payout handle (a PayPal address).
`/traffic-log` carries **visitor IP addresses** — other people, not the owner.

Both are redacted **in the HTTP client**, immediately after the body is read:
before the cache, before SQLite, before any formatter. That placement is the
whole lesson from `tolt-pp-cli`, whose first filter sat in the output helper and
was walked straight past by `--json`, putting a bank account number on disk.

Reveal deliberately, never into a file:

```bash
BOOKBOLT_REVEAL_PII=1 bookbolt-pp-cli payment-settings
```

## Chrome impersonation is OFF here, on purpose

The generator builds a `--spec-source sniffed` client with surf's
`Impersonate().Chrome()`. That stamps a browser header set at RoundTrip time —
**after** per-request headers — so an explicit `Accept: application/json` never
survives. Laravel picks HTML vs JSON from `Accept` and `X-Requested-With`, so
with impersonation on, **every money command silently receives Blade markup**.

The portal answers a plain client fine, so it is off. `BOOKBOLT_IMPERSONATE_CHROME=1`
restores it if Cloudflare ever starts challenging — but the JSON path stops
working while it is on.

## How it feeds the income tally

`sources.py::fetch_bookbolt()` runs on every online `yt-income` run and caches to
`data/networks/bookbolt.json`.

Book Bolt settles over **PayPal**, and PayPal already names its payers — so
unlike Tolt this source finds **no new money**. It is a **check**: the only
independent statement of what Book Bolt believes it paid. `ingest.py` prints a
*Book Bolt ledger check* next to the PayPal reconciliation. A mismatch is a
**warning, never a gate** — usually timing.

**Why that check exists.** For a month, `$105.60` of Book Bolt money sat in
Untraced. It arrives from a Bulgarian entity on the `digitalworks.net` domain,
which looked like a separate advertiser; a merge attempted on 2026-08-30 from a
LinkedIn page was correctly reverted for want of evidence. The merchant ledger
settled it on 2026-08-31: Book Bolt lists exactly two payouts ever, `$182.34`
(06/01) and `$105.60` (08/01), pays by PayPal, and the `$105.60` PayPal credit
landed `2026-08-01` — same day, same cent. See `_alias_notes["Book Bolt"]` in
`rules.json`. **Do not re-split them without new evidence from the ledger itself.**

## Adding the next per-tool CLI

`pp-tolt` holds the five rules. Add these two, learned here:

6. **Check what the generated transport does to your headers.** A "sniffed" spec
   yields browser impersonation that overrides them at send time. Assert the
   header reaches the server with an `httptest` server before trusting it.
7. **If the CLI must hold a password rather than a token, gate it to one host
   and cap the attempts.** A token that leaks is revocable; a password that
   triggers a lockout is not.
