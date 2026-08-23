# PayPal Transaction Search CLI

**Read-only PayPal income reporting that handles the 31-day window limit for you - pull months of transactions and a monthly income summary in one command.**

Wraps PayPal's official Transaction Search and Balances reporting API for a Business account. The headline 'income' command auto-chunks any date range into the 31-day windows PayPal requires, paginates each, and rolls up real money received by month and then by program (payer), net of PayPal fees, alongside how much of it settled into the bank. Currency conversions and bank withdrawals are excluded from income - on a multi-currency account they are the same money moving, and counting them inflates the total. 'history' returns the full windowed transaction list. Read-only by design - no ban surface, just the sanctioned reporting path.

Learn more at [PayPal Transaction Search](https://developer.paypal.com/docs/api/reporting/v1/).

Created by [@akshat-git-jpg](https://github.com/akshat-git-jpg) (akshat-git-jpg).

## Install

The recommended path installs both the `paypal-txns-pp-cli` binary and the `pp-paypal-txns` agent skill (Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, and other agents supported by the upstream [`skills`](https://github.com/vercel-labs/skills) CLI) in one shot:

```bash
npx -y @mvanhorn/printing-press-library install paypal-txns
```

For CLI only (no skill):

```bash
npx -y @mvanhorn/printing-press-library install paypal-txns --cli-only
```

For skill only — installs the skill into the same agents as the default command above, but skips the CLI binary (use this to update or reinstall just the skill):

```bash
npx -y @mvanhorn/printing-press-library install paypal-txns --skill-only
```

To constrain the skill install to one or more specific agents (repeatable — agent names match the [`skills`](https://github.com/vercel-labs/skills) CLI):

```bash
npx -y @mvanhorn/printing-press-library install paypal-txns --agent claude-code
npx -y @mvanhorn/printing-press-library install paypal-txns --agent claude-code --agent codex
```

### Without Node

The generated install path is category-agnostic until this CLI is published. If `npx` is not available before publish, install Node or use the category-specific Go fallback from the public-library entry after publish.

### Pre-built binary

Download a pre-built binary for your platform from the [latest release](https://github.com/mvanhorn/printing-press-library/releases/tag/paypal-txns-current). On macOS, clear the Gatekeeper quarantine: `xattr -d com.apple.quarantine <binary>`. On Unix, mark it executable: `chmod +x <binary>`.

<!-- pp-hermes-install-anchor -->
## Install for Hermes

From the Hermes CLI:

```bash
hermes skills install mvanhorn/printing-press-library/cli-skills/pp-paypal-txns --force
```

Inside a Hermes chat session:

```bash
/skills install mvanhorn/printing-press-library/cli-skills/pp-paypal-txns --force
```

## Install for OpenClaw

Tell your OpenClaw agent (copy this):

```
Install the pp-paypal-txns skill from https://github.com/mvanhorn/printing-press-library/tree/main/cli-skills/pp-paypal-txns. The skill defines how its required CLI can be installed.
```

## Use with Claude Desktop

This CLI ships an [MCPB](https://github.com/modelcontextprotocol/mcpb) bundle — Claude Desktop's standard format for one-click MCP extension installs (no JSON config required).

To install:

1. Download the `.mcpb` for your platform from the [latest release](https://github.com/mvanhorn/printing-press-library/releases/tag/paypal-txns-current).
2. Double-click the `.mcpb` file. Claude Desktop opens and walks you through the install.
3. Fill in `PAYPAL_CLIENT_ID` when Claude Desktop prompts you.

Requires Claude Desktop 1.0.0 or later. Pre-built bundles ship for macOS Apple Silicon (`darwin-arm64`) and Windows (`amd64`, `arm64`); for other platforms, use the manual config below.

<details>
<summary>Manual JSON config (advanced)</summary>

If you can't use the MCPB bundle (older Claude Desktop, unsupported platform), install the MCP binary and configure it manually.


Install the MCP binary from this CLI's published public-library entry or pre-built release.

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "paypal-txns": {
      "command": "paypal-txns-pp-mcp",
      "env": {
        "PAYPAL_CLIENT_ID": "<your-key>"
      }
    }
  }
}
```

</details>

## Authentication

Uses OAuth2 client-credentials against your PayPal Business account. Create a Live REST app at developer.paypal.com, enable the Transaction Search feature on it (grants the reporting/search/read scope), then set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET. The CLI exchanges them for a Bearer token automatically. Defaults to the live api-m.paypal.com host.

## Quick Start

```bash
# Confirm the binary and config resolve before hitting the API.
paypal-txns-pp-cli doctor --dry-run

# Money received by month over the last five months.
paypal-txns-pp-cli income --since 5mo

# Full transaction list for the last month as JSON.
paypal-txns-pp-cli history --since 1mo --json

```

## Unique Features

These capabilities aren't available in any other tool for this API.

### Income reporting
- **`income`** — Money received grouped by month, then by program (payer), with the amount that reached the bank.

  _Pick this when an agent or user asks how much came in over a multi-month period - a single raw API call cannot answer it._

  ```bash
  paypal-txns-pp-cli income --since 5mo --json
  ```
- **`history`** — Fetch every transaction across an arbitrary date range, transparently handling PayPal's 31-day-per-call limit and pagination.

  _Use this to export a full transaction list for a period without writing windowing or pagination loops by hand._

  ```bash
  paypal-txns-pp-cli history --since 4mo --status S --json
  ```

## Recipes


### Monthly income by program, last 5 months

```bash
paypal-txns-pp-cli income --since 5mo
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

## Usage

Run `paypal-txns-pp-cli --help` for the full command reference and flag list.

## Commands

### reporting

Manage reporting

- **`paypal-txns-pp-cli reporting balances-get`** - List all balances. Specify date time to list balances for that time that appear in the response.<blockquote><strong>Notes:</strong> <ul><li>It takes a maximum of three hours for balances to appear in the list balances call.</li><li>This call lists balances upto the previous three years.</li></ul></blockquote>
- **`paypal-txns-pp-cli reporting search-get`** - Lists transactions. Specify one or more query parameters to filter the transaction that appear in the response.<blockquote><strong>Notes:</strong> <ul><li>If you specify one or more optional query parameters, the <code>ending_balance</code> response field is empty.</li><li>It takes a maximum of three hours for executed transactions to appear in the list transactions call.</li><li>This call lists transaction for the previous three years.</li></ul></blockquote>


## Output Formats

```bash
# Human-readable table (default in terminal, JSON when piped)
paypal-txns-pp-cli reporting balances-get

# JSON for scripting and agents
paypal-txns-pp-cli reporting balances-get --json

# Filter to specific fields
paypal-txns-pp-cli reporting balances-get --json --select id,name,status

# Dry run — show the request without sending
paypal-txns-pp-cli reporting balances-get --dry-run

# Agent mode — JSON + compact + no prompts in one flag
paypal-txns-pp-cli reporting balances-get --agent
```

## Agent Usage

This CLI is designed for AI agent consumption:

- **Non-interactive** - never prompts, every input is a flag
- **Pipeable** - `--json` output to stdout, errors to stderr
- **Filterable** - `--select id,name` returns only fields you need
- **Previewable** - `--dry-run` shows the request without sending
- **Read-only by default** - this CLI does not create, update, delete, publish, send, or mutate remote resources
- **Offline-friendly** - sync/search commands can use the local SQLite store when available
- **Agent-safe by default** - no colors or formatting unless `--human-friendly` is set

Exit codes: `0` success, `2` usage error, `3` not found, `4` auth error, `5` API error, `7` rate limited, `10` config error.

## Health Check

```bash
paypal-txns-pp-cli doctor
```

Verifies configuration, credentials, and connectivity to the API.

## Configuration

Config file: `~/.config/transaction-search-pp-cli/config.toml`

Static request headers can be configured under `headers`; per-command header overrides take precedence.

Environment variables:

| Name | Kind | Required | Description |
| --- | --- | --- | --- |
| `PAYPAL_CLIENT_ID` | per_call | Yes | Set to your API credential. |
| `PAYPAL_CLIENT_SECRET` | per_call | Yes | Set to your API credential. |

### agentcookie (optional)

If you use agentcookie to sync secrets across machines, this CLI auto-adopts agentcookie-managed credentials with no extra setup. When the daemon writes to this CLI's config, `paypal-txns-pp-cli doctor` reports `agentcookie: detected` and `auth-status` labels the source as `agentcookie`. Skip this section if you don't use agentcookie - the CLI works the same as any other.

## Troubleshooting
**Authentication errors (exit code 4)**
- Run `paypal-txns-pp-cli doctor` to check credentials
- Verify the environment variable is set: `echo $PAYPAL_CLIENT_ID`
**Not found errors (exit code 3)**
- Check the resource ID is correct
- Run the `list` command to see available items

### API-specific
- **PERMISSION_DENIED or scope error** — Enable the Transaction Search feature on your PayPal app at developer.paypal.com -> Apps & Credentials -> your app -> Features.
- **Empty results for a recent transaction** — PayPal takes up to 3 hours to make a transaction searchable; wait and retry.
- **Date range rejected** — Transaction Search only covers the last 3 years; pick a start date within that window.
