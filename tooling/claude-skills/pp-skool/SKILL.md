---
name: pp-skool
description: "Skool community CLI: read feeds, members, classroom, and leaderboard across all your Skool communities, create posts/comments, and run cross-community digests, search, unread, events, leaderboard trends, and member analytics. Trigger phrases: what's new on skool, my skool communities, search skool posts, skool feed, skool leaderboard, skool leaderboard trends, pending skool members, skool member analytics, use skool, run skool."
author: "akshat-git-jpg"
user-invocable: true
argument-hint: "<command> [args]"
allowed-tools: "Read Bash"
metadata:
  version: 1.0.0
  openclaw:
    requires:
      bins:
        - skool-pp-cli
    install:
      - kind: go
        bins: [skool-pp-cli]
        module: github.com/mvanhorn/printing-press-library/library/social-and-messaging/skool/cmd/skool-pp-cli
---

# Skool — Printing Press CLI

## Prerequisites: Install the CLI

This skill drives the `skool-pp-cli` binary. **You must verify the CLI is installed before invoking any command from this skill.** If it is missing, install it first:

1. Install via the Printing Press installer:
   ```bash
   npx -y @mvanhorn/printing-press-library install skool --cli-only
   ```
2. Verify: `skool-pp-cli --version`
3. Ensure `$GOPATH/bin` (or `$HOME/go/bin`) is on `$PATH`.

If the `npx` install fails (no Node, offline, etc.), fall back to a direct Go install (requires Go 1.26.3 or newer):

```bash
go install github.com/mvanhorn/printing-press-library/library/social-and-messaging/skool/cmd/skool-pp-cli@latest
```

If `--version` reports "command not found" after install, the install step did not put the binary on `$PATH`. Do not proceed with skill commands until verification succeeds.

Skool has no public API. This CLI reverse-engineers the same internal endpoints the web app uses (Next.js data reads + api2 writes), authenticates with your session cookie, and mirrors feed, members, and classroom data into local SQLite. That unlocks cross-community commands like `since`, `search`, `unread`, and `events`, plus owner analytics like `leaderboard trends` and `members analytics`.

## When to Use This CLI

Use for scripting Skool community operations an AI agent or cron would do: pulling feeds and members, posting, triaging pending members, and especially cross-community digests and historical analytics that the Skool UI does not provide.

## Anti-triggers

Do not use this CLI for:
- Do not use for non-Skool community platforms (Circle, Discord, Mighty Networks).
- Do not use to bulk-scrape communities you are not a member of — reads require your membership.
- Do not use for payment/billing changes; Skool billing is not exposed here beyond read-only tier counts.

## Unique Capabilities

These capabilities aren't available in any other tool for this API.

### Cross-community intelligence
- **`since`** — One digest of new posts across every community you belong to.

  _Reach for this instead of opening each community's feed separately to catch up._

  ```bash
  skool-pp-cli since 6h --agent
  ```
- **`search`** — Search every synced post and comment across all your communities, offline.

  _Find where something was discussed without remembering which community it was in._

  ```bash
  skool-pp-cli search "pricing" --agent
  ```
- **`unread`** — Posts with new comments since your last sync, across all communities.

  _Triage where conversation moved without scanning each community._

  ```bash
  skool-pp-cli unread --agent
  ```
- **`events`** — Merged upcoming-events calendar across all your communities.

  _One view of what's scheduled everywhere you're a member._

  ```bash
  skool-pp-cli events --days 7 --agent
  ```

### Local history that compounds
- **`leaderboard trends`** — Points and rank movement over time from local snapshots.

  _See who is rising or stalling in engagement, which the UI cannot show._

  ```bash
  skool-pp-cli leaderboard trends andynocode --weeks 4 --agent
  ```
- **`members analytics`** — Trial-to-paid conversion, churn, and member-count deltas from local billing-tier history.

  _Owner reporting on growth and conversion the dashboard does not expose._

  ```bash
  skool-pp-cli members analytics andynocode --agent
  ```

## Command Reference

**comments** — Comment on posts (api2; requires comment permission in the group)

- `skool-pp-cli comments` — Add a comment to a post. post_id and group_id are UUIDs.

**groups** — Group (community) admin data from api2 (labels, courses; owner/admin only)

- `skool-pp-cli groups approve-member` — Approve a pending member (admin)
- `skool-pp-cli groups courses` — List courses for a group via api2 (admin; richer than classroom read)
- `skool-pp-cli groups labels` — List category labels for a group (admin)
- `skool-pp-cli groups reject-member` — Reject a pending member (admin)

**posts** — Create posts in a community feed (api2; requires post permission in the group)

- `skool-pp-cli posts` — Create a post in a community. group_id is the group UUID (see `communities list`).


### Finding the right command

When you know what you want to do but not which command does it, ask the CLI directly:

```bash
skool-pp-cli which "<capability in your own words>"
```

`which` resolves a natural-language capability query to the best matching command from this CLI's curated feature index. Exit code `0` means at least one match; exit code `2` means no confident match — fall back to `--help` or use a narrower query.

## Recipes

### Morning catch-up across all communities

```bash
skool-pp-cli since 12h --agent --select community,title,upvotes
```

Narrow the cross-community digest to just community, title and upvotes for a terse agent-friendly summary.

### Find a discussion you half-remember

```bash
skool-pp-cli search "affiliate" --agent
```

Scans recent posts across every community you belong to, regardless of which one it was in.

### Read a community's top posts

```bash
skool-pp-cli communities feed andynocode --sort top --json
```

Pull the most-upvoted posts for a community as JSON.

## Auth Setup

Auth is your Skool session cookie. Copy the `auth_token` cookie value from a logged-in browser (DevTools > Application > Cookies > www.skool.com > auth_token) and set it: `export SKOOL_AUTH_TOKEN=<value>`. A Chrome User-Agent is sent automatically (Skool's CloudFront 403s bare requests). The token expires (no refresh) — re-copy it when commands start returning auth errors.

Run `skool-pp-cli doctor` to verify setup.

## Agent Mode

Add `--agent` to any command. Expands to: `--json --compact --no-input --no-color --yes`.

- **Pipeable** — JSON on stdout, errors on stderr
- **Filterable** — `--select` keeps a subset of fields. Dotted paths descend into nested structures; arrays traverse element-wise. Critical for keeping context small on verbose APIs:

  ```bash
  skool-pp-cli comments --post-id 550e8400-e29b-41d4-a716-446655440000 --agent --select id,name,status
  ```
- **Previewable** — `--dry-run` shows the request without sending
- **Offline-friendly** — sync/search commands can use the local SQLite store when available
- **Non-interactive** — never prompts, every input is a flag
- **Explicit retries** — use `--idempotent` only when an already-existing create should count as success

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
skool-pp-cli feedback "the --since flag is inclusive but docs say exclusive"
skool-pp-cli feedback --stdin < notes.txt
skool-pp-cli feedback list --json --limit 10
```

Entries are stored locally at `~/.local/share/skool-pp-cli/feedback.jsonl`. They are never POSTed unless `SKOOL_FEEDBACK_ENDPOINT` is set AND either `--send` is passed or `SKOOL_FEEDBACK_AUTO_SEND=true`. Default behavior is local-only.

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
skool-pp-cli profile save briefing --json
skool-pp-cli --profile briefing comments --post-id 550e8400-e29b-41d4-a716-446655440000
skool-pp-cli profile list --json
skool-pp-cli profile show briefing
skool-pp-cli profile delete briefing --yes
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

1. **Empty, `help`, or `--help`** → show `skool-pp-cli --help` output
2. **Starts with `install`** → ends with `mcp` → MCP installation; otherwise → see Prerequisites above
3. **Anything else** → Direct Use (execute as CLI command with `--agent`)

## MCP Server Installation

1. Install the MCP server:
   ```bash
   go install github.com/mvanhorn/printing-press-library/library/social-and-messaging/skool/cmd/skool-pp-mcp@latest
   ```
2. Register with Claude Code:
   ```bash
   claude mcp add skool-pp-mcp -- skool-pp-mcp
   ```
3. Verify: `claude mcp list`

## Direct Use

1. Check if installed: `which skool-pp-cli`
   If not found, offer to install (see Prerequisites at the top of this skill).
2. Match the user query to the best command from the Unique Capabilities and Command Reference above.
3. Execute with the `--agent` flag:
   ```bash
   skool-pp-cli <command> [subcommand] [args] --agent
   ```
4. If ambiguous, drill into subcommand help: `skool-pp-cli <command> --help`.
