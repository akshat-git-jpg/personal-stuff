#!/usr/bin/env bash
# PLATFORM: macOS only. launchd does not exist elsewhere; on Linux or WSL2 the same
# rescue-snapshot cadence is a cron entry or a systemd timer calling
# `pp-work snapshot --all`. Guarded here so a non-Mac run says that instead of
# emitting `launchctl: command not found` three times and half-installing a plist.
if [ "$(uname -s)" != "Darwin" ]; then
  echo "install-snapshot-timer.sh: macOS only (needs launchd)." >&2
  echo "  On Linux/WSL2, get the same cadence with a crontab entry, e.g. every 15 min:" >&2
  echo "    */15 * * * * $HOME/codebase/personal-stuff/tooling/cli/pp-work/pp-work snapshot --all >/dev/null 2>&1" >&2
  echo "  (WSL2: cron needs starting per boot, e.g. 'sudo service cron start'.)" >&2
  exit 1
fi
# Install (or remove) the launchd timer that takes rescue snapshots of dirty pp-work
# workspaces.
#
# Why a timer at all. Three things can leave a workspace's work off main:
#
#   1. the model skips the auto-commit rule   -> caught by the Stop hook
#   2. a subagent edits files and skips it    -> caught by the SubagentStop hook
#   3. the session DIES mid-turn              -> caught by nothing in-process
#
# Case 3 is why this exists. `SessionEnd` fires on /clear, logout and prompt-exit, not on a
# SIGKILL or a closed terminal window, and both `boss-session-start` and `pp-land`'s
# post-land sweep are event-driven off other work — so if the owner simply stops, nothing
# runs. Only a clock outside Claude Code closes that.
#
# What it does NOT do: commit. A commit inside a workspace is a TRIGGER here (post-commit ->
# pp-land -> rebase, verify, push to main), and the VPS pulls this repo every 15 minutes. So
# a "just in case" commit would ship half-finished work to production. `pp-work snapshot`
# records the tree as a ref under refs/pp-work/snap/ instead: recoverable, invisible to
# every hook, and it never reaches main.
#
# Usage:
#   bash scripts/install-snapshot-timer.sh              # install + load (idempotent)
#   bash scripts/install-snapshot-timer.sh --uninstall   # unload + remove
#   bash scripts/install-snapshot-timer.sh --status      # is it loaded?
set -euo pipefail

LABEL="com.kbtg.pp-work-snapshot"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PPWORK="$REPO/tooling/cli/pp-work/pp-work"
LOG="$HOME/.local/state/pp-work/snapshot-timer.log"
INTERVAL="${SNAPSHOT_INTERVAL_SECS:-1800}"   # 30 min

case "${1:-install}" in
  --status)
    if launchctl list "$LABEL" >/dev/null 2>&1; then
      echo "loaded: $LABEL (every ${INTERVAL}s)"
      echo "plist:  $PLIST"
      echo "log:    $LOG"
    else
      echo "not loaded: $LABEL"
    fi
    exit 0
    ;;
  --uninstall)
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "removed: $LABEL"
    exit 0
    ;;
  install|"") ;;
  *) echo "usage: $0 [install|--uninstall|--status]" >&2; exit 2 ;;
esac

[ -x "$PPWORK" ] || { echo "ERROR: $PPWORK is missing or not executable" >&2; exit 1; }
mkdir -p "$HOME/Library/LaunchAgents" "$(dirname "$LOG")"

# `snapshot --all` skips clean workspaces, so a quiet machine costs one `git status` per
# workspace per interval and writes nothing.
cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$PPWORK</string>
    <string>snapshot</string>
    <string>--all</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>StartInterval</key><integer>$INTERVAL</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
  <key>ProcessType</key><string>Background</string>
</dict>
</plist>
PLIST_EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "installed: $LABEL — snapshots every ${INTERVAL}s"
echo "  plist:  $PLIST"
echo "  log:    $LOG"
echo "  remove: bash scripts/install-snapshot-timer.sh --uninstall"
echo "  see:    pp-work list        (the snaps: column)"
echo "  recover: git -C <workspace> stash apply <ref>   # refs under refs/pp-work/snap/"
