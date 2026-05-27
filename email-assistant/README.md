# email-assistant

Everything related to Gmail in this repo, in one folder. Two distinct things live here:

1. **Interactive Gmail assistant** — when you talk to Claude Code about email ("draft a reply to John"), Claude reads `CLAUDE.md` and follows it.
2. **Daily digest tool** — a standalone script (`digest.sh`) that summarizes recent email into a two-part report.

Both share `email-preferences-<email>.md` (one file per Gmail account).

## Files

| File | Purpose |
|---|---|
| `CLAUDE.md` | Instructions for Claude when you ask it to do something with email interactively (draft, reply, send, search). Anthropic-specific filename — Claude Code auto-loads it. |
| `digest.sh` | **Project script** — runs the daily digest for one Gmail account. Pure logic, no cron knowledge. |
| `digest-prompt.md` | The Claude prompt that defines the two-part digest output (Part 1 = Claude's judgment, Part 2 = preference-driven). |
| `email-preferences-<email>.md` | Per-account preferences. Reply tone + signature (for the interactive assistant) + "Digest focus areas" (for `digest.sh`). One file per email. |
| `README.md` | This file. |

## Cron lives elsewhere

`digest.sh` is **not cron-specific**. It just produces the digest text and prints it. You can run it locally:

```bash
./digest.sh kushalbakliwal25@gmail.com
```

When we want it to run on a schedule and post to Telegram, that'll be a *separate* wrapper at `vps-crons/gmail-digest/run.sh` — which will source secrets, do `git pull`, call `digest.sh`, and pipe the output to Telegram. Cron-specific concerns (schedule, Telegram token, etc.) belong there, not here.

## Running the digest

```bash
# Default — last 48 hours
./digest.sh kushalbakliwal25@gmail.com

# Custom window via WINDOW env var (any Gmail query string)
WINDOW="newer_than:1d" ./digest.sh kushalbakliwal25@gmail.com
WINDOW="newer_than:12h is:unread" ./digest.sh kushalbakliwal25@gmail.com
WINDOW="after:2026/05/26 -from:newsletter" ./digest.sh kushalbakliwal25@gmail.com
```

Output is printed to stdout. Pipe wherever (file, Telegram, etc.).

## Output format

```
═══ 📬 Email digest — kushalbakliwal25@gmail.com ═══
Last 48h • 50 emails

▶ Part 1: Overall summary

• ⚠️ WazirX wants ReKYC done by May 31 (4 days out)
• HDFC UPI debit of ₹826 to Zepto on credit card 9286
• LinkedIn connection request from Tushar Chauhan
• ...

▶ Part 2: Per your preferences

📌 Bank / financial — ICICI, HDFC, credit card statements, UPI mandates
  • HDFC InstaAlerts — ₹826 UPI debit to Zepto on card 9286
  • SBI Card — recurring e-mandate debit ₹1050 to Google Play

📌 Travel — flight bookings, hotel confirmations, IRCTC, MakeMyTrip
  • (none in this window)

═══ end ═══
```

Part 1 is Claude's own judgment. Part 2 is driven by the "Digest focus areas" section in `email-preferences-<email>.md`.

## Multi-account support

`digest.sh` takes the email as an argument. To add a new Gmail account later:

1. **Authenticate the new account** with the shared OAuth client:
   ```bash
   python3 mcp/google-shared/setup_auth.py
   ```
   This writes `mcp/google-shared/tokens/<new-email>.json`.

2. **Create a preferences file** for the new account:
   ```bash
   cp email-preferences-kushalbakliwal25@gmail.com.md \
      email-preferences-<new-email>.md
   ```
   Edit the new file — change the reply preferences and especially the "Digest focus areas" section to fit that account.

3. **Run the digest**:
   ```bash
   ./digest.sh <new-email>
   ```

## Tuning the digest

There are two knobs:

1. **Part 1 output (Claude's judgment)** — controlled by `digest-prompt.md`. Edit if you want more/fewer bullets, different sections, different tone.
2. **Part 2 output (preference-driven)** — controlled by the "Digest focus areas" section in `email-preferences-<email>.md`. Add a line, get a new 📌 section. Remove a line, that section disappears.

The preferences file is intentionally just markdown — no schema, no structure. Claude reads it whole. You can write the focus areas as freely as you'd write a note to yourself.

## Requirements

- `claude` CLI installed and authenticated (Pro or Team plan)
- Gmail MCP at `../mcp/gmail-mcp-server/server.py` (already in this repo)
- OAuth token at `../mcp/google-shared/tokens/<email>.json` (already in place for `kushalbakliwal25@gmail.com`)
- Python 3 + the MCP's deps: `pip install mcp google-api-python-client google-auth-oauthlib`

## When you're ready to schedule it

Tell me. I'll scaffold `vps-crons/gmail-digest/` — that's the only place cron-specific things (schedule, Telegram secrets, log rotation) will live. `digest.sh` here doesn't change.
