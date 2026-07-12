#!/usr/bin/env bash
# Re-verify the facts documented in personal-stuff-build-and-env/SKILL.md.
# Offline by default; set VERIFY_VPS=1 to also probe the VPS over SSH.
# Exit 0 = every documented fact still holds; exit 1 = first failing check named.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
FAIL=0

fail() { echo "FAIL [$1]: $2"; FAIL=1; }
pass() { echo "PASS [$1]"; }

# --- 1. The four env scripts exist and are executable ------------------------
for s in relink.sh link-clis.sh regen-mcp-json.sh skills-status.sh deploy-apps.sh; do
  if [ ! -x "$REPO/scripts/$s" ]; then
    fail "scripts-present" "scripts/$s missing or not executable"
  fi
done
[ "$FAIL" -eq 0 ] && pass "scripts-present (relink, link-clis, regen-mcp-json, skills-status, deploy-apps)"

# --- 2. skills-status.sh runs clean (membership + symlink health) ------------
if "$REPO/scripts/skills-status.sh" >/dev/null 2>&1; then
  pass "skills-status (symlink health, exit 0)"
else
  fail "skills-status" "scripts/skills-status.sh exited non-zero — run it to see the broken row"
fi

# --- 3. Manifests exist (work + personal) ------------------------------------
MAN="$REPO/tooling/claude-skills/manifest"
if [ -f "$MAN/work.txt" ] && [ -f "$MAN/personal.txt" ]; then
  pass "manifests ($(grep -c . "$MAN/work.txt") work / $(grep -c . "$MAN/personal.txt") personal entries)"
else
  fail "manifests" "tooling/claude-skills/manifest/{work,personal}.txt missing"
fi

# --- 4. regen-mcp-json.sh still wires only google-drive + cloudflare ---------
WIRED="$(grep -oE '"(google-drive|cloudflare)"' "$REPO/scripts/regen-mcp-json.sh" | sort -u | wc -l | tr -d ' ')"
if [ "$WIRED" -eq 2 ]; then
  pass "mcp-wiring (google-drive + cloudflare only)"
else
  fail "mcp-wiring" "regen-mcp-json.sh no longer matches the documented two-server wiring"
fi

# --- 5. Runtime homes ---------------------------------------------------------
command -v rtk >/dev/null 2>&1 && pass "rtk on PATH" || fail "rtk" "rtk not on PATH"
ls "$HOME/go/bin" 2>/dev/null | grep -q 'pp-cli' && pass "go pp-cli binaries in ~/go/bin" || fail "go-pp-cli" "no *-pp-cli in ~/go/bin"
[ -d "$HOME/.agents/skills" ] && pass "~/.agents/skills store present" || fail "agents-skills" "~/.agents/skills missing"

# --- 6. Single-venv convention still stated in pipelines/CLAUDE.md -----------
if grep -q 'python3 -m venv venv' "$REPO/pipelines/CLAUDE.md" 2>/dev/null; then
  pass "pipelines single-venv convention documented"
else
  fail "pipelines-venv" "pipelines/CLAUDE.md no longer documents the root venv convention"
fi
[ -d "$REPO/pipelines/venv" ] || echo "NOTE: pipelines/venv not built on this machine (rebuild: cd pipelines && python3 -m venv venv && venv/bin/pip install -r requirements.txt)"

# --- 7. Wrangler stays per-app (no root install) ------------------------------
if [ -d "$REPO/node_modules/wrangler" ]; then
  fail "wrangler-per-app" "a root-level wrangler install appeared — versions are per-app on purpose"
else
  pass "wrangler-per-app (no root install)"
fi

# --- 8. VPS layout (opt-in, needs network) ------------------------------------
if [ "${VERIFY_VPS:-0}" = "1" ]; then
  if ssh -o ConnectTimeout=8 -o BatchMode=yes root@72.61.241.170 'ls /srv/crons /srv/projects' >/dev/null 2>&1; then
    pass "vps-layout (/srv/crons + /srv/projects reachable)"
  else
    fail "vps-layout" "SSH to 72.61.241.170 failed (network? key?)"
  fi
else
  echo "SKIP [vps-layout]: set VERIFY_VPS=1 to probe the VPS over SSH"
fi

echo
if [ "$FAIL" -eq 0 ]; then echo "ALL CHECKS PASSED"; exit 0; else echo "CHECKS FAILED — see FAIL lines above"; exit 1; fi
