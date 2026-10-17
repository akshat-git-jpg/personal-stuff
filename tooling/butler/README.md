# butler

A daily assistant you talk to. It reads your email, calendar, lists, trips and month-end
jobs, then tells you only what needs you, with one line on why. It learns what matters to
you from the conversation and gets sharper over time. It only reads: it never sends mail,
edits a list, or runs a month-end skill.

`CLAUDE.md` in this folder is the session's script.

## Starting it

```
butler
```

`butler` is a zsh function, same shape as `chief` (maintainer). It is defined in
`~/.zshrc`, which is **not** tracked in this repo, so a fresh machine has to add it back:

```bash
butler-work() {
  local ws
  ws="$(pp-work claim --kind subject --slug butler)" || return
  cd "$ws/tooling/butler" || return
  CLAUDE_CONFIG_DIR="$CLAUDE_WORK_CONFIG_DIR" command claude --dangerously-skip-permissions --model opus "$@"
}
butler-personal() {
  local ws
  ws="$(pp-work claim --kind subject --slug butler)" || return
  cd "$ws/tooling/butler" || return
  CLAUDE_CONFIG_DIR="$CLAUDE_PERSONAL_CONFIG_DIR" command claude --dangerously-skip-permissions --model opus "$@"
}
butler() { butler-work "$@"; }
```

Bare `butler` uses the work account because work Gmail comes through that account's connector. It
starts inside the `subject/butler` workspace because butler writes its memory files every
session, and the main checkout refuses edits to tracked files.

## What it reads

| Source | Tool |
|---|---|
| Personal Gmail | `tooling/cli/gmail/pp-gmail` (`kushalbakliwal25@gmail.com`) |
| Work Gmail | the claude.ai Gmail connector |
| Calendar (one-off events only) | `tooling/cli/calendar/pp-cal agenda --no-routine` |
| Lists | `tooling/cli/lists/pp-lists` (lists.agrolloo.com) |
| Trips | `apps/trip-planner/trips/*.json` |
| Month-end jobs | `butler.py` + `monthly.json` |

Tools run from the main checkout, where the Google tokens and `infra/secrets/` live.

## Memory

`memory/` is tracked in git. butler writes it during the talk and commits it on its own.
You can edit it by hand too.

| File | Holds |
|---|---|
| `about-me.md` | facts about you: people, plans, routines, goals |
| `what-matters.md` | rules: always show, never show, rank higher when, learned from reactions |
| `journal.md` | one line per day: what was shown, what you acted on, what you waved away |

**The repo is public.** Memory never holds salary, health or money values, account
numbers, PNRs, passwords or email bodies. It records the kind of thing, not the value.

## Month-end tracker

From the 25th to the 5th, `yt-income`, `my-income` and `kushal-salary` are due for the
month that is ending (or just ended), each with the inputs you need to gather.

```bash
python3 tooling/butler/butler.py status            # what is due
python3 tooling/butler/butler.py done yt-income    # stop nagging for this month
python3 tooling/butler/butler.py undo yt-income
```

Done marks live in `state/done.json` (gitignored, in the main checkout). To add a monthly
job, add an entry to `monthly.json`.

## One-time setup

1. `cp infra/secrets/lists-app.env.example infra/secrets/lists-app.env` and fill in the
   lists app password.
2. Add the three `butler` functions above to `~/.zshrc`.

The Google token for `kushalbakliwal25@gmail.com` already exists in
`tooling/mcp/google-shared/tokens/`.

## Tests

`bash tooling/butler/test-butler.sh` (butler.py, pp-lists against a local stub, pp-cal formatter).
