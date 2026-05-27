# Gmail Digest

Daily Claude-Code-driven summary of recent Gmail activity for a given account. Produces a two-part output: (1) Claude's own judgment of what matters in the last N hours/days, and (2) a per-preference summary driven by the account's `email-preferences-<email>.md`.

## Status

Local-only for now. Runs from your Mac with `./run.sh <email>` and prints to stdout. The cron wrapper at `vps-crons/gmail-digest/` will be built **after** this script is finalized — that's the Pattern B convention (build project first, wrap with a cron later).

## Multi-account design

This tool is account-agnostic. Drop a new `email-preferences-<other-email>.md` into `../` and you can run:

```bash
./run.sh other-email@example.com
```

The script will:
1. Look up `../email-preferences-<email>.md` (errors out if missing)
2. Call the shared `mcp/gmail-mcp-server/` with `account=<email>`
3. Use whatever OAuth token is at `mcp/google-shared/tokens/<email>.json`

To add a new account: do the one-time Google OAuth consent via `mcp/google-shared/setup_auth.py`, then write a preferences file. That's it.

## Usage

```bash
# default window: last 48 hours
./run.sh kushalbakliwal25@gmail.com

# custom window via WINDOW env var (any Gmail query string)
WINDOW="newer_than:1d" ./run.sh kushalbakliwal25@gmail.com
WINDOW="newer_than:12h is:unread" ./run.sh kushalbakliwal25@gmail.com
WINDOW="after:2026/05/26 -from:newsletter" ./run.sh kushalbakliwal25@gmail.com
```

## What the digest looks like

```
═══ 📬 Email digest — kushalbakliwal25@gmail.com ═══
Last 48h • 23 emails

▶ Part 1: Overall summary

• Manager replied on Project X — needs review by Friday
• Two flight booking confirmations from MakeMyTrip
• ICICI bank — credit card statement available
• Three emails from <Person> about the upcoming trip
• Pending OAuth consent screen from Google Cloud

▶ Part 2: Per your preferences

📌 Anything from family
  • Brother — about weekend plans

📌 Bank / financial
  • ICICI Bank — credit card statement
  • HDFC — UPI mandate setup

📌 Travel
  • MakeMyTrip — flight to BLR confirmed
  • Hotel Atlas — booking confirmation

═══ end ═══
```

## Files

| File | Purpose |
|---|---|
| `prompt.md` | The Claude prompt — defines the two-part structure and rules |
| `run.sh` | Wrapper script — takes `<email>` arg, builds the inline MCP config, calls `claude -p` |
| `README.md` | This file |

## How preferences work

Each account has its own `../email-preferences-<email>.md`. That file is shared between this digest tool and the interactive reply assistant (`../CLAUDE.md`).

For the digest specifically: Claude looks for an "**Digest focus areas**" section (or similar) in the prefs file. If the section doesn't exist yet, Part 2 will report that — populate it by adding lines under that heading.

Example section to add to the prefs file:

```markdown
## Digest focus areas

What to always surface in the daily digest.

- Anything from family (brother, sister, parents) — by name or known email
- Bank / financial — ICICI, HDFC, credit card statements, UPI
- Travel — flight bookings, hotel confirmations, IRCTC
- Anything mentioning "invoice", "payment due", or "deadline"
- Anything from <work-related person/org> outside of normal Zluri channels
```

## Requirements

- `claude` CLI installed and authenticated (Pro or Team plan — both work)
- Gmail MCP at `mcp/gmail-mcp-server/server.py` (already in this repo)
- OAuth token at `mcp/google-shared/tokens/<email>.json` (already in place for `kushalbakliwal25@gmail.com`; for other accounts, run `mcp/google-shared/setup_auth.py`)
- Python 3 + the Gmail MCP's deps installed (`mcp`, `google-api-python-client`, `google-auth-oauthlib`)

## Iteration plan

1. Run it locally a few times. Tweak the prompt for output style.
2. Add a "Digest focus areas" section to the preferences file based on what you actually want surfaced.
3. Once the digest output feels right, scaffold the cron wrapper at `vps-crons/gmail-digest/` (the wrapper will just call this `run.sh` with the appropriate `<email>` arg).

## Why not run all accounts at once?

One account per `run.sh` invocation keeps the prompt focused and avoids context bloat. To digest multiple accounts daily, the eventual cron wrapper will loop through a list and send a Telegram message per account (or one combined — your call when we get there).
