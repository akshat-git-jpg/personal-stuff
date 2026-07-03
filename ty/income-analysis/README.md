# Income Analysis

One place to track income across all my platforms, plus the tools that pull the numbers automatically so I (or Claude) can check earnings without logging into each dashboard.

The plan: every income source gets its own CLI or MCP that reads its data, and this folder is where I keep notes on what's wired up, what each tool can pull, and what's still manual. Actual numbers from each pull go under `snapshots/`.

## What's wired up

### PayPal (Business)

- Account: PayPal Business, multi-currency (I get paid in both INR and USD).
- Tool: `paypal-txns-pp-cli`. Built with Printing Press from PayPal's official Transaction Search spec. The CLI lives in `~/printing-press/library/paypal-txns/` and the binary is on PATH at `~/go/bin/paypal-txns-pp-cli`. No Claude skill yet.
- Reads: money received by month and currency (`income`), the full transaction list (`history`), and account balances. It handles PayPal's 31-day-per-call limit and pagination on its own, so a range like `--since 5mo` just works.
- How to query: source the creds and run, e.g. `paypal-txns-pp-cli income --since 5mo`. Or just ask Claude.
- Notes: read-only reporting. OAuth2 client credentials, so it needs a Live app at developer.paypal.com with the Transaction Search feature switched on, otherwise the token comes back without the reporting scope and every call 403s. Creds sit in `~/.config/paypal-txns-pp-cli/creds.env` (chmod 600, outside any repo); I can rotate the secret from the PayPal dashboard anytime. Only the last 3 years are searchable, and a new transaction takes up to 3 hours to show up.

### impact.com (affiliate)

- Account: Agrollo (media-partner 4809503), currency INR.
- Tool: `impact-pp-cli` plus the `pp-impact` Claude skill. Built with Printing Press. The CLI lives in `~/printing-press/library/impact/` (binary at `~/go/bin/impact-pp-cli`); the skill is in `personal-stuff/tooling/claude-skills/pp-impact/`.
- Reads: earnings by program/software, earnings by day or month, programs I've joined, per-conversion commissions, invoices (payouts), and contracts.
- How to query: in Claude, just ask ("my impact.com income by program last month") and the pp-impact skill handles it. By hand: source the creds and run the CLI.
- Notes: local-only. The account id is baked into the URL so it can't be published. The token sits in `personal-stuff/infra/secrets/impact.env` (gitignored) and I can revoke it from impact.com settings anytime. Read-only reporting.

## Snapshots

Dated pulls live in `snapshots/`. Most recent: [2026-06-20](snapshots/2026-06-20.md).

## To add

More sources over time: other affiliate networks, payment platforms, marketplaces. Each one as a CLI or MCP so the whole picture is one quick query instead of a dashboard crawl. Gumroad and Skool already have CLIs (`gumroad-pp-cli`, `skool-pp-cli`); wire them in here when they're worth tracking.

## Why this exists

So "how much did I make everywhere last month" is one question to Claude, not ten logins.
