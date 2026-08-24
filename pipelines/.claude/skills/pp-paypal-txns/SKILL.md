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

## Agent Feedback

When you (or the agent) notice something off about this CLI, record it:

```
paypal-txns-pp-cli feedback "the --since flag is inclusive but docs say exclusive"
paypal-txns-pp-cli feedback --stdin < notes.txt
paypal-txns-pp-cli feedback list --json --limit 10
```

Entries are stored locally at `~/.local/share/paypal-txns-pp-cli/feedback.jsonl`. They are never POSTed unless `PAYPAL_TXNS_FEEDBACK_ENDPOINT` is set AND either `--send` is passed or `PAYPAL_TXNS_FEEDBACK_AUTO_SEND=true`. Default behavior is local-only.

Write what *surprised* you, not a bug report. Short, specific, one line: that is the part that compounds.

## Output Delivery

Every command accepts `--deliver <sink>`. The output goes to the named sink in addition to (or instead of) stdout, so agents can route command results without hand-piping. Three sinks are supported:

| Sink | Effect |
|------|--------|
| `stdout` | Default; write to stdout only |
| `file:<path>` | Atomically write output to `<path>` (tmp + rename) |
| `webhook:<url>` | POST the output body to the URL (`application/json` or `application/x-ndjson` when `--compact`) |

Unknown schemes are refused with a structured error naming the supported set. Webhook failures return non-zero and log the URL + HTTP status on stderr.

## Named Profiles

A profile is a saved set of flag values, reused across invocations. Use it when a scheduled agent calls the same command every run with the same configuration - HeyGen's "Beacon" pattern.

```
paypal-txns-pp-cli profile save briefing --json
paypal-txns-pp-cli --profile briefing reporting balances-get
paypal-txns-pp-cli profile list --json
paypal-txns-pp-cli profile show briefing
paypal-txns-pp-cli profile delete briefing --yes
```

Explicit flags always win over profile values; profile values win over defaults. `agent-context` lists all available profiles under `available_profiles` so introspecting agents discover them at runtime.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 2 | Usage error (wrong arguments) |
| 3 | Resource not found |
| 4 | Authentication required |
| 5 | API error (upstream issue) |
| 7 | Rate limited (wait and retry) |
| 10 | Config error |

## Argument Parsing

Parse `$ARGUMENTS`:

1. **Empty, `help`, or `--help`** → show `paypal-txns-pp-cli --help` output
2. **Starts with `install`** → ends with `mcp` → MCP installation; otherwise → see Prerequisites above
3. **Anything else** → Direct Use (execute as CLI command with `--agent`)

## MCP Server Installation

Install the MCP binary from this CLI's published public-library entry or pre-built release, then register it:

```bash
claude mcp add paypal-txns-pp-mcp -- paypal-txns-pp-mcp
```

Verify: `claude mcp list`

## Direct Use

1. Check if installed: `which paypal-txns-pp-cli`
   If not found, offer to install (see Prerequisites at the top of this skill).
2. Match the user query to the best command from the Unique Capabilities and Command Reference above.
3. Execute with the `--agent` flag:
   ```bash
   paypal-txns-pp-cli <command> [subcommand] [args] --agent
   ```
4. If ambiguous, drill into subcommand help: `paypal-txns-pp-cli <command> --help`.
