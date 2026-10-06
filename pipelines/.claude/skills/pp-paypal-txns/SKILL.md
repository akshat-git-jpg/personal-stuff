---
name: pp-paypal-txns
description: "Read-only PayPal Business income reporting. Pulls money received grouped by month and then by program (payer), net of fees, with the INR that settled into the bank, handling PayPal's 31-day window limit and pagination. Trigger phrases: `paypal income`, `how much did I make on paypal`, `paypal income last N months`, `paypal monthly income`, `my paypal earnings`, `income by program`, `export my paypal transactions`, `paypal transaction history`, `use paypal-txns`, `run paypal-txns`."
author: "akshat-git-jpg"
license: "Apache-2.0"
argument-hint: "<command> [args] | install cli|mcp"
allowed-tools: "Read Bash"
metadata:
  openclaw:
    requires:
      bins:
        - paypal-txns-pp-cli
---

# PayPal Transaction Search — Printing Press CLI

Contents: Output contract (--table, month-wise shape, credentials) · Prerequisites · When to use · Anti-triggers · Unique capabilities · Command reference · Recipes · Auth setup · Agent mode · Exit codes · Direct use

## Output contract — READ THIS FIRST

Two rules override every example further down this file. Both exist because they have
silently regressed before.

### 1. Always pass `--table` for `income`

The month-by-program table only prints when stdout is a real terminal. An agent's stdout is a
pipe, so without `--table` the CLI returns raw JSON and the caller invents its own layout.
That is the exact drift this section prevents.

```bash
paypal-txns-pp-cli income --since 5mo --table
```

Do not pass `--json`, `--agent`, `--compact`, or `--select` on `income` when the answer is for a
human. `--json` wins over `--table` when both are given. Reach for `--json` only when a script
is going to parse the output.

### 2. Report it month-wise, then per-program inside each month

The required shape, in this order:

1. One row per calendar month, oldest first.
2. Inside each month, one row per program (payer), largest first.
3. Both columns on every row: `RECEIVED` (USD) and `TO BANK` (INR).
4. A grand total for the whole window.

Do not collapse the months into a single total. Do not drop the per-program breakdown. Do not
reorder into a payer-first view unless the user asks for it. A blank `TO BANK` means that money
is still sitting in PayPal, not that it is missing — say so rather than omitting the row.

State the window the CLI actually used. `--since 5mo` starts on today's day-of-month five months
back, so the earliest month is usually a partial month. Flag that.

### Credentials

Creds live outside any repo at `~/.config/paypal-txns-pp-cli/creds.env`. Source them before
running, or every call 403s:

```bash
set -a; . ~/.config/paypal-txns-pp-cli/creds.env; set +a
paypal-txns-pp-cli income --since 5mo --table
```

## Prerequisites: Install the CLI

This skill drives the `paypal-txns-pp-cli` binary. **You must verify the CLI is installed before invoking any command from this skill.** If it is missing, install it first:

1. Install via the Printing Press installer:
   ```bash
   npx -y @mvanhorn/printing-press-library install paypal-txns --cli-only
   ```
2. Verify: `paypal-txns-pp-cli --version`
3. Ensure `$GOPATH/bin` (or `$HOME/go/bin`) is on `$PATH`.

If the `npx` install fails before this CLI has a public-library category, install Node or use the category-specific Go fallback after publish.

If `--version` reports "command not found" after install, the install step did not put the binary on `$PATH`. Do not proceed with skill commands until verification succeeds.

Wraps PayPal's official Transaction Search and Balances reporting API for a Business account. The headline 'income' command auto-chunks any date range into the 31-day windows PayPal requires, paginates each, and rolls up real money received by month and then by program (payer), net of PayPal fees, alongside how much of it settled into the bank. Currency conversions and bank withdrawals are excluded from income - on a multi-currency account they are the same money moving, and counting them inflates the total. 'history' returns the full windowed transaction list. Read-only by design - no ban surface, just the sanctioned reporting path.

## When to Use This CLI

Reach for this CLI when the task is reading PayPal income for a Business account: how much came in over a period, a monthly breakdown, or a full transaction export. It is the right tool whenever a date range spans more than 31 days, because it handles PayPal's per-call window limit and pagination automatically.

## Anti-triggers

Do not use this CLI for:
- Do not use this CLI to send money, refund, create invoices, or any write operation - it is read-only reporting.
- Do not use it for transactions older than 3 years - PayPal does not expose them via Transaction Search.
- Do not use it for sub-second-fresh data - PayPal delays searchability by up to 3 hours.

## Unique Capabilities

These capabilities aren't available in any other tool for this API.

### Income reporting
- **`income`** — Money received grouped by month, then by program (payer), with the amount that reached the bank.

  _Pick this when an agent or user asks how much came in over a multi-month period - a single raw API call cannot answer it._

  ```bash
  paypal-txns-pp-cli income --since 5mo --table
  ```
- **`history`** — Fetch every transaction across an arbitrary date range, transparently handling PayPal's 31-day-per-call limit and pagination.

  _Use this to export a full transaction list for a period without writing windowing or pagination loops by hand._

  ```bash
  paypal-txns-pp-cli history --since 4mo --status S --json
  ```

## Command Reference

**reporting** — Manage reporting

- `paypal-txns-pp-cli reporting balances-get` — List all balances. Specify date time to list balances for that time that appear in the response.
- `paypal-txns-pp-cli reporting search-get` — Lists transactions. Specify one or more query parameters to filter the transaction that appear in the response.


### Finding the right command

When you know what you want to do but not which command does it, ask the CLI directly:

```bash
paypal-txns-pp-cli which "<capability in your own words>"
```

`which` resolves a natural-language capability query to the best matching command from this CLI's curated feature index. Exit code `0` means at least one match; exit code `2` means no confident match — fall back to `--help` or use a narrower query.

## Recipes

### Monthly income by program, last 5 months

```bash
paypal-txns-pp-cli income --since 5mo --table
```

Auto-windows the range, keeps only genuine incoming payments (net of PayPal fees), groups them by month
and then by the program that paid, and shows how much of each program's money reached the bank. A blank
`TO BANK` means that money has not been withdrawn yet.

### Export a quarter of transactions as JSON, narrowed fields

```bash
paypal-txns-pp-cli history --start 2026-01-01 --end 2026-03-31 --json --select transactions.transaction_info.transaction_id,transactions.transaction_info.transaction_amount
```

Pulls a 3-month range across multiple 31-day windows and keeps only the id and amount fields.

### Current balances

```bash
paypal-txns-pp-cli reporting balances-get --json
```

Point-in-time account balances by currency from the Balances endpoint.

## Auth Setup

Uses OAuth2 client-credentials against your PayPal Business account. Create a Live REST app at developer.paypal.com, enable the Transaction Search feature on it (grants the reporting/search/read scope), then set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET. The CLI exchanges them for a Bearer token automatically. Defaults to the live api-m.paypal.com host.

Run `paypal-txns-pp-cli doctor` to verify setup.

## Agent Mode

Add `--agent` to any command. Expands to: `--json --compact --no-input --no-color --yes`.

**Exception: do not use `--agent` on `income` when reporting to a human.** It implies `--json`, which suppresses the month-by-program table. See the Output contract at the top of this file.

- **Pipeable** — JSON on stdout, errors on stderr
- **Filterable** — `--select` keeps a subset of fields. Dotted paths descend into nested structures; arrays traverse element-wise. Critical for keeping context small on verbose APIs:

  ```bash
  paypal-txns-pp-cli reporting balances-get --agent --select id,name,status
  ```
- **Previewable** — `--dry-run` shows the request without sending
- **Offline-friendly** — sync/search commands can use the local SQLite store when available
- **Non-interactive** — never prompts, every input is a flag
- **Read-only** — do not use this CLI for create, update, delete, publish, comment, upvote, invite, order, send, or other mutating requests

### Response envelope

Commands that read from the local store or the API wrap output in a provenance envelope:

```json
{
  "meta": {"source": "live" | "local", "synced_at": "...", "reason": "..."},
  "results": <data>
}
```

Parse `.results` for data and `.meta.source` to know whether it's live or local. A human-readable `N results (live)` summary is printed to stderr only when stdout is a terminal AND no machine-format flag (`--json`, `--csv`, `--compact`, `--quiet`, `--plain`, `--select`) is set — piped/agent consumers and explicit-format runs get pure JSON on stdout.

## Exit codes

`0` success · `2` usage error · `3` not found · `4` auth required (source the creds) ·
`5` PayPal API error · `7` rate limited (wait, retry) · `10` config error.

## Direct use

Parse `$ARGUMENTS`: empty or `help` → show `paypal-txns-pp-cli --help`; `install` →
see Prerequisites; anything else → run it as below.

1. Check it is installed: `which paypal-txns-pp-cli`. If not, see Prerequisites.
2. Source the creds (see Credentials above).
3. Match the ask to a command from Unique Capabilities or the Command Reference, and
   run it with `--agent`, **except `income`: use `--table`** (see the Output contract):
   ```bash
   paypal-txns-pp-cli <command> [subcommand] [args] --agent
   paypal-txns-pp-cli income --since 5mo --table
   ```
4. If ambiguous, drill into `paypal-txns-pp-cli <command> --help`.

Something surprising about the CLI? Record one line with
`paypal-txns-pp-cli feedback "<what surprised you>"` (stored locally only).
