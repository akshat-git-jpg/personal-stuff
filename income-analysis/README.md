# Income Analysis

One place to track income across all my platforms, plus the tools that pull the numbers automatically so I (or Claude) can check earnings without logging into each dashboard.

The plan: every income source gets its own CLI or MCP that reads its data, and this folder is where I keep notes on what's wired up, what each tool can pull, and what's still manual.

## What's wired up

### impact.com (affiliate)

- Account: Agrollo (media-partner 4809503), currency INR.
- Tool: `impact-pp-cli` plus the `pp-impact` Claude skill. Built with Printing Press, lives in the personal-stuff repo.
- Reads: earnings by program/software, earnings by day or month, programs I've joined, per-conversion commissions, invoices (payouts), and contracts.
- How to query: in Claude, just ask ("my impact.com income by program last month") and the pp-impact skill handles it. By hand: source the creds and run the CLI.
- Notes: local-only. The account id is baked into the URL so it can't be published. The token sits in `personal-stuff/infra/secrets/impact.env` (gitignored) and I can revoke it from impact.com settings anytime. Read-only reporting.

## To add

More sources over time: other affiliate networks, payment platforms, marketplaces. Each one as a CLI or MCP so the whole picture is one quick query instead of a dashboard crawl. First candidates are Gumroad (already have a CLI) and Skool, then whatever else starts earning.

## Why this exists

So "how much did I make everywhere last month" is one question to Claude, not ten logins.
