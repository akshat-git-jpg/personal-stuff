#!/usr/bin/env bash
# Re-vendor the OAuth token from the shared store and deploy this tool to
# the Hostinger VPS that runs the daily 06:00 IST cron.
#
# Usage:
#   ./deploy.sh                # vendor + deploy (no auto-run)
#   ./deploy.sh --run-now      # also runs notifier.py on the VPS (sends a digest now)
#
# Re-run any time the token gets revoked or when you want to push code changes.

set -euo pipefail

# --- config ----------------------------------------------------------------
TOOL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# repo root is 4 levels up: apps/telegram-my-planner/tools/daily-digest/ -> ... -> repo root
SHARED_DIR="$(cd "$TOOL_DIR/../../../../tooling/mcp/google-shared" && pwd)"
ACCOUNT="${ACCOUNT:-akshatpatidar17@gmail.com}"
SHARED_TOKEN="$SHARED_DIR/tokens/$ACCOUNT.json"

VPS_HOST="${VPS_HOST:-root@72.61.241.170}"
# Pattern-B layout (since 2026-06-13): the cron runs code straight out of the
# git-cloned repo, not a separately scp'd /opt/kb-daily-planner tree. token.json
# is gitignored, so this scp is still the only way to get a fresh one onto the box.
VPS_DIR="${VPS_DIR:-/srv/projects/personal-stuff/apps/telegram-my-planner/tools/daily-digest}"
VPS_KEY="${VPS_KEY:-$HOME/.ssh/hostinger_vps}"
VPS_LOG="${VPS_LOG:-/srv/crons/my-planner/logs/cron.log}"
VPS_RUN_WRAPPER="${VPS_RUN_WRAPPER:-/srv/crons/my-planner/run.sh}"

RUN_NOW=0
[[ "${1:-}" == "--run-now" ]] && RUN_NOW=1

# --- 1. regenerate exercise-routine.json from the markdown source ----------
echo "[1/5] regenerating exercise-routine.json from exercise-routine.md"
python3 "$TOOL_DIR/build_routine.py"

# --- 2. vendor the latest shared token -------------------------------------
if [[ ! -f "$SHARED_TOKEN" ]]; then
    echo "ERROR: shared token not found at $SHARED_TOKEN" >&2
    echo "Run: python3 $SHARED_DIR/setup_auth.py $ACCOUNT" >&2
    exit 1
fi
echo "[2/5] vendoring token from $SHARED_TOKEN"
cp "$SHARED_TOKEN" "$TOOL_DIR/token.json"

# --- 2. scp tool files to VPS ----------------------------------------------
echo "[3/5] uploading auth.py + token.json + config.py + notifier.py + renderer.py + workout_renderer.py + exercise-routine.json to $VPS_HOST:$VPS_DIR"
scp -i "$VPS_KEY" \
    "$TOOL_DIR/auth.py" \
    "$TOOL_DIR/token.json" \
    "$TOOL_DIR/config.py" \
    "$TOOL_DIR/notifier.py" \
    "$TOOL_DIR/renderer.py" \
    "$TOOL_DIR/workout_renderer.py" \
    "$TOOL_DIR/exercise-routine.json" \
    "$VPS_HOST:$VPS_DIR/"

# --- 3. fix perms + drop obsolete credentials.json on VPS ------------------
echo "[4/5] tightening perms and removing obsolete credentials.json on VPS"
ssh -i "$VPS_KEY" "$VPS_HOST" "chmod 600 $VPS_DIR/token.json && rm -f $VPS_DIR/credentials.json && ls -la $VPS_DIR/ | head -20"

# --- 4. optional smoke run --------------------------------------------------
if [[ "$RUN_NOW" -eq 1 ]]; then
    echo "[5/5] running digest on VPS (--run-now)"
    ssh -i "$VPS_KEY" "$VPS_HOST" "$VPS_RUN_WRAPPER" || true
    echo ""
    echo "--- last 15 lines of $VPS_LOG ---"
    ssh -i "$VPS_KEY" "$VPS_HOST" "tail -15 $VPS_LOG"
else
    echo "[5/5] skipping run (use --run-now to send a digest immediately)"
fi

echo ""
echo "Done. Next scheduled digest: 06:00 IST (cron 30 0 * * * UTC)."
