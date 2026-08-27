# MAC-LAUNCHD.md — background jobs on the MacBook

Every `launchd` agent this repo owns, what it does, and how to reinstall it on a fresh
machine. The Mac counterpart to [`VPS-CRONS.md`](VPS-CRONS.md), which covers the VPS.

**launchd** is macOS's own scheduler and process babysitter — cron plus "keep this alive".
A job is one `.plist` file in `~/Library/LaunchAgents/`; macOS reads only that folder, so
the copies there are *installs*. **The originals live in this repo, next to the tool they
run.** Edit here, then reinstall.

Created 2026-08-24, after an audit found three jobs whose only copy was on the laptop —
one of them, `bt-audio-guard`, with its script unbacked-up anywhere.

---

## The jobs

| Job | What it does | Schedule | Source |
|---|---|---|---|
| `com.kushal.yt-claude-relay` | Localhost HTTP server on :7777. The browser posts a YouTube URL; it fetches the title and transcript, then opens a Claude session already fed the transcript. | always on (`KeepAlive`) | `tooling/cli/yt-claude/` |
| `com.kushal.yt-claude-prune` | Deletes `~/yt-claude/<videoid>/` folders older than `YT_PRUNE_DAYS` (default 30). Nothing else ever removed them; 142 had accumulated by 2026-08-24. | Sunday 03:00 | `tooling/cli/yt-claude/` |
| `com.kbtg.pp-work-snapshot` | Records every `pp-work` workspace's file tree **without committing it**. A commit inside a workspace fires `pp-land`, which rebases, verifies and pushes to `main` — so there is no such thing as a private "just in case" commit here. This is the safety net instead. | every 30 min | `tooling/cli/pp-work/` |
| `com.kbtg.bt-audio-guard` | On earbud reconnect, switches the audio **input** back to the MacBook microphone. macOS otherwise grabs the earbud mic, which forces the link into HFP call mode — mono 16 kHz, and music sounds broken. | polls every 3s (`KeepAlive`) | `tooling/cli/bt-audio-guard/` |
| `com.kushal.skills-sync` | Copies the five person-level skills (`claude-router`, `github-router`, `humanizer`, `i-have-adhd`, `session-handoff`) from `.claude/skills/` into the **private** `work-skills` plugin, then commits and pushes it. Backstop: the repo hygiene gate already warns at commit time. Skips a dirty checkout. | daily 04:10 | `scripts/` |

`mega.mac.megaupdater` also sits in `~/Library/LaunchAgents/`. It belongs to the MEGA
desktop app, not to this repo. Leave it alone.

**Retired 2026-08-27: `com.kbtg.pp-claude-tags`.** It re-applied a byte patch to the
Claude Code binary every 10 minutes to unlock the built-in session tags. Claude Code
2.1.246 ships compiled bytecode, so the patch still applied cleanly and still changed
nothing — the same watcher, reporting success, while the tags stayed gone. The
replacement is `kbc` (`tooling/cli/pp-agents/`), which patches nothing and needs no
background job. The plist is deleted from the repo; on this machine the installed copy
was unloaded and renamed `com.kbtg.pp-claude-tags.plist.retired`. Do not re-add it.

## Logs

| Job | Log |
|---|---|
| yt-claude-relay | `/tmp/yt-claude-relay.log` |
| yt-claude-prune | `~/Library/Logs/yt-claude-prune.log` |
| pp-work-snapshot | `~/.local/state/pp-work/snapshot-timer.log` |
| bt-audio-guard | `~/Library/Logs/bt-audio-guard.log` (and `/tmp/bt-audio-guard.err`) |
| skills-sync | `~/Library/Logs/skills-sync.log` |

`logger` and `log show` do **not** work for retrieving bt-audio-guard's output on this
machine — that is why it writes a plain file.

---

## Install on a fresh machine

Run these from the repo root. Each is idempotent.

```sh
# 1. bt-audio-guard — the script is symlinked, NOT copied.
#    Three things point at ~/.local/bin/bt-audio-guard.sh: this plist, and the
#    `btguard` and `fixaudio` functions in ~/.zshrc. A symlink keeps all three
#    working while the real file lives in git.
mkdir -p ~/.local/bin
ln -sfn "$PWD/tooling/cli/bt-audio-guard/bt-audio-guard.sh" ~/.local/bin/bt-audio-guard.sh

# 2. Install every plist.
cp tooling/cli/yt-claude/com.kushal.yt-claude-relay.plist   ~/Library/LaunchAgents/
cp tooling/cli/yt-claude/com.kushal.yt-claude-prune.plist   ~/Library/LaunchAgents/
cp tooling/cli/pp-work/com.kbtg.pp-work-snapshot.plist      ~/Library/LaunchAgents/
cp tooling/cli/bt-audio-guard/com.kbtg.bt-audio-guard.plist ~/Library/LaunchAgents/

# 3. Load them.
for j in com.kushal.yt-claude-relay com.kushal.yt-claude-prune \
         com.kbtg.pp-work-snapshot com.kbtg.bt-audio-guard; do
  launchctl load ~/Library/LaunchAgents/$j.plist 2>/dev/null
done

# 4. Verify — four lines, no "not registered".
launchctl list | grep -E 'yt-claude|pp-work-snapshot|bt-audio-guard'
```

**Every plist hardcodes `/Users/kbtg/codebase/personal-stuff`.** If the repo ever moves,
edit the paths in all five and reinstall. There is no indirection here on purpose — launchd
runs with a bare environment and cannot resolve anything clever.

## Everyday commands

```sh
launchctl list | grep <name>              # is it registered? (a PID means running)
launchctl unload ~/Library/LaunchAgents/<label>.plist
launchctl load   ~/Library/LaunchAgents/<label>.plist
launchctl start  <label>                  # run a scheduled job right now
```

After editing a plist you must `unload` then `load` — launchd does not re-read it on its own.

`bt-audio-guard` also has shell wrappers in `~/.zshrc`: `btguard` (status),
`btguard on|off|log|restart|uninstall`, and `fixaudio` to force a correction now.
`btguard off` pauses the guard when you actually want the earbud mic.

## Adding a job

1. Put the script with its tool under `tooling/cli/<tool>/`.
2. Put the `.plist` beside it, named `com.<owner>.<job>.plist`.
3. Add a row to both tables above, and an install line to the block above.
4. Write tests if it deletes anything — see `tooling/cli/yt-claude/test-prune.sh`, whose
   point is the refusal cases, not the happy path.
