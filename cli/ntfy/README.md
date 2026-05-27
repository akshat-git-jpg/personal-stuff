# pp-ntfy

Push-notification CLI on top of [ntfy](https://ntfy.sh). Designed for
bash crons: an `if` block fires either a one-shot notification or a
**rings-until-acknowledged** alarm to your phone.

Defaults to the **self-hosted ntfy** running on the Hostinger VPS at
`http://srv1377177.hstgr.cloud:8888` (see [docker/ntfy/](../../docker/ntfy/README.md)
for server-side config). Override with `NTFY_SERVER` env var if you ever
want to point at the hosted ntfy.sh or a different instance.

Uses only the Python stdlib (urllib) — no new pip deps to install.

## Why this exists

A normal cron that detects "thing X happened, alert me" usually pushes a
Telegram message and hopes you check your phone. That's fine for "FYI"
crons, but not for "wake me up / interrupt me" events. ntfy.sh priority 5
notifications bypass silent mode and ring loudly — and this CLI re-sends
them on an interval until you tap **Acknowledge** on the phone, so you
can't snooze through them.

## Architecture (10-second version)

```
┌──────────────────────┐   POST priority=5    ┌─────────────┐
│ cron's if-block runs │ ───── + Actions ───► │  ntfy.sh    │ ──► your phone rings
│ pp-ntfy alarm "..."  │                      │ alerts topic│
└──────────────────────┘                      └─────────────┘
            ▲                                         │
            │                                         │ tap "Acknowledge"
            │   GET .../ack-topic/json?poll=1         ▼
            │                                  ┌─────────────┐
            └─────── polls every N sec ─────── │ ack topic   │
                                               └─────────────┘
```

Each `pp-ntfy alarm` invocation:

1. Mints a unique `ack-topic` (e.g. `mytopic-ack-aB3xQ...`).
2. POSTs a max-priority notification with an HTTP action button. Tapping
   it publishes a single message to the ack-topic.
3. Loops: send → sleep `--interval` → check ack-topic → repeat. Bounded
   by `--max-tries`. Exits 0 on ack, 3 on timeout.

No Flask/webhook server needed — ntfy itself is the ack channel.

## One-time setup

### 1. Install the ntfy app on your phone

- Android: F-Droid or Play Store → search "ntfy".
- iOS: App Store → "ntfy".

### 2. Pick a hard-to-guess topic name

Self-hosted ntfy here uses **topic-name-as-secret** auth (same model as
hosted ntfy.sh) — anyone who knows the topic name can read/write to it.
So treat the topic name like a password:

```bash
openssl rand -hex 12      # e.g. 9c1f4a... — copy this
```

Use something like `kb-alerts-<random>`.

### 3. Subscribe on the phone

In the ntfy app: **+ → Add subscription** → set:

- **Server (Use another server)**: `http://srv1377177.hstgr.cloud:8888`
- **Topic**: your secret string from step 2

Allow Notifications. On Android, long-press the subscription →
**Notification settings** → channel "ntfy" → set **Importance: Urgent**
and toggle **Override Do Not Disturb** so priority-5 still rings when
the phone is silenced.

> Note: the server is HTTP, not HTTPS. The ntfy Android app allows HTTP
> servers out of the box. iOS may warn — you can accept. We'll move to
> HTTPS once the Hostinger shared LE quota clears (see
> [docker/ntfy/README.md](../../docker/ntfy/README.md)).

### 4. Configure on Mac / VPS

The CLI defaults to the self-hosted server, so you only need to set the
topic:

```bash
export NTFY_TOPIC=kb-alerts-9c1f4a...
```

For cron use, drop it into the wrapper's `.env`:

```
NTFY_TOPIC=kb-alerts-9c1f4a...
# NTFY_SERVER=http://srv1377177.hstgr.cloud:8888  # default; override only if needed
```

## Usage

### Quick connectivity check

```bash
./pp-ntfy test
# expected: phone gets a normal-priority "pp-ntfy is alive ✅"
```

### One-shot notification (no ack loop)

```bash
./pp-ntfy send "disk usage 92% on VPS" --priority 4 --tags warning
```

### Ring-until-acknowledged alarm

```bash
./pp-ntfy alarm "MARKET CHECK: SPY dropped >2% pre-open"
# phone rings now, again 30s later, again 30s later …
# you tap Acknowledge → script exits 0
# you ignore it 20 times (~10 min) → script exits 3
```

Flags:

| Flag | Default | Meaning |
|------|---------|---------|
| `--interval N` | 30 | Seconds between re-sends |
| `--max-tries N` | 20 | Stop after this many sends if no ack (20 × 30s = 10 min) |
| `--title "..."` | `ALARM` | Notification title |
| `--tags "..."` | `rotating_light` | Comma-separated ntfy [tags](https://docs.ntfy.sh/emojis/) (emoji icon) |

### Wiring into a cron's if-block

```bash
#!/usr/bin/env bash
set -euo pipefail

# … your check logic …
if [[ "$something_bad" == "true" ]]; then
    /srv/projects/personal-stuff/cli/ntfy/pp-ntfy alarm \
        "Backup job failed at $(date -Iseconds)" \
        --interval 30 --max-tries 30
fi
```

For a Pattern B cron wrapper (`vps-crons/<job>/run.sh`), source the
`.env` first so `NTFY_TOPIC` is in scope, then call `pp-ntfy alarm`.

## Self-hosted server

Already running on the Hostinger VPS — see
[../../docker/ntfy/README.md](../../docker/ntfy/README.md) for the
compose file, common ops (restart/logs/status), and the HTTPS upgrade
path once Let's Encrypt's shared-domain quota clears.

## Files

| File | Purpose |
|------|---------|
| `pp-ntfy` | Bash wrapper — resolves Python interpreter (matches `cli/gmail/`) |
| `pp_ntfy.py` | The CLI itself (stdlib-only) |
| `README.md` | This file |

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success (send delivered, or alarm acknowledged) |
| 1 | Generic error |
| 2 | Config / HTTP error (bad topic, network) |
| 3 | Alarm hit `--max-tries` without an ack |
| 130 | Interrupted (Ctrl-C) |
