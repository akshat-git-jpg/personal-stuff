#!/usr/bin/env bash
# Re-verify the facts documented in personal-stuff-config-and-secrets/SKILL.md.
# NAMES ONLY — never echoes a secret value. Offline (no network, no wrangler).
# Exit 0 = every documented fact still holds; exit 1 = first failing check named.
# The one check that needs network/auth stays manual:
#   cd apps/<app> && npx wrangler secret list
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
FAIL=0

fail() { echo "FAIL [$1]: $2"; FAIL=1; }
pass() { echo "PASS [$1]"; }

# --- 1. pipelines/.env key names match the documented 21-key list -----------
DOCUMENTED_KEYS="AFFILIATE_PROGRAMS_SHEET_URL
ANALYSIS_INCOME_SHEET_URL
CF_ACCOUNT_ID
CF_API_EMAIL
CF_API_TOKEN
CF_D1_DATABASE_ID
CF_GLOBAL_API_KEY
CF_KV_NAMESPACE_ID
CREDENTIALS_FILE
GEMINI_API_KEY
GOOGLE_SHEET_URL
INCOME_ANALYSIS
KEYWORD_RESEARCH_SHEET_URL
LINK_DOMAIN
MISC_CHANNELS_SHEET_URL
PROBLEMS_AUTOMATIONS_SHEET_URL
RANDOM_NOTES_SHEET_URL
WORKFLOW_DEADLINES_SHEET_URL
YT_API_KEY
YT_MAIN_SHEET_URL
YT_TRACKER_SHEET_URL"

if [ -f "$REPO/pipelines/.env" ]; then
  ACTUAL_KEYS="$(grep -o '^[A-Z_0-9]*' "$REPO/pipelines/.env" | grep -v '^$' | sort -u)"
  DIFF="$(diff <(echo "$DOCUMENTED_KEYS") <(echo "$ACTUAL_KEYS") || true)"
  if [ -n "$DIFF" ]; then
    fail "pipelines-env-keys" "key NAMES differ from SKILL.md list (update the skill):"
    echo "$DIFF" | grep '^[<>]' | sed 's/^</  skill-only:/; s/^>/  env-only: /'
  else
    pass "pipelines-env-keys (21 names match)"
  fi
else
  fail "pipelines-env-keys" "$REPO/pipelines/.env missing (machine not set up?)"
fi

# --- 2. .env.example is the documented incomplete subset (TRAP still true) --
if [ -f "$REPO/pipelines/.env.example" ]; then
  EX_COUNT="$(grep -c '^[A-Z_0-9]*=' "$REPO/pipelines/.env.example")"
  if [ "$EX_COUNT" -eq 10 ]; then
    pass "env-example-count (10, TRAP wording still accurate)"
  else
    fail "env-example-count" "example now has $EX_COUNT keys, skill says 10 — update the TRAP line"
  fi
else
  fail "env-example-count" "pipelines/.env.example missing"
fi

# --- 3. Google OAuth tokens: 5 documented accounts present ------------------
TOK="$REPO/tooling/mcp/google-shared/tokens"
TOK_OK=1
for acct in kushalbakliwal25 seankerman25 jessicap123k akshatpatidar17 seemabakliwal19; do
  if [ ! -f "$TOK/${acct}@gmail.com.json" ]; then
    fail "google-tokens" "missing token for ${acct}@gmail.com"; TOK_OK=0
  fi
done
[ "$TOK_OK" -eq 1 ] && pass "google-tokens (5 documented accounts)"

# --- 4. infra/secrets inventory contains every documented file --------------
SEC_OK=1
for f in heygen-web-curls.txt heygen-usage-last.json hostinger-vps.env impact.env minio.env fal.env telegram.env; do
  if [ ! -f "$REPO/infra/secrets/$f" ]; then
    fail "infra-secrets" "documented file missing: infra/secrets/$f"; SEC_OK=0
  fi
done
UNDOC="$(ls "$REPO/infra/secrets" | grep -v -E '^(heygen-web-curls\.txt|heygen-usage-last\.json|hostinger-vps\.env|impact\.env|minio\.env|minio-access\.md|fal\.env|telegram\.env|telegram\.env\.example)$' || true)"
if [ -n "$UNDOC" ]; then
  fail "infra-secrets" "files not in SKILL.md axis-5 row (add them): $UNDOC"; SEC_OK=0
fi
[ "$SEC_OK" -eq 1 ] && pass "infra-secrets inventory"

# --- 5. Hostinger token location (mcp/hostinger, NOT cli/hostinger) ---------
if grep -q '^API_TOKEN=' "$REPO/tooling/mcp/hostinger/.env" 2>/dev/null; then
  pass "hostinger-token-location (tooling/mcp/hostinger/.env, API_TOKEN)"
else
  fail "hostinger-token-location" "tooling/mcp/hostinger/.env missing or has no API_TOKEN name"
fi

# --- 6. Service account file present ----------------------------------------
if [ -f "$REPO/pipelines/credentials.json" ]; then
  pass "pipelines-credentials.json present"
else
  fail "pipelines-credentials" "pipelines/credentials.json missing"
fi

# --- 7. env.py / cloudflare.py loading claims --------------------------------
grep -q '__file__' "$REPO/pipelines/common/env.py" 2>/dev/null \
  && pass "env.py loads .env keyed off its own location" \
  || fail "env-py-claim" "pipelines/common/env.py no longer resolves .env via __file__"
grep -q 'not set in .env' "$REPO/pipelines/common/cloudflare.py" 2>/dev/null \
  && pass "cloudflare.py raises 'not set in .env'" \
  || fail "cloudflare-py-claim" "pipelines/common/cloudflare.py error message changed"

# --- 8. nothing secret staged in git -----------------------------------------
STAGED="$(cd "$REPO" && git diff --cached --name-only | grep -E '(^|/)\.env$|\.dev\.vars$|credentials\.json$|tokens/.*\.json$|infra/secrets/' | grep -v '\.example$' || true)"
if [ -n "$STAGED" ]; then
  fail "git-staged-secrets" "secret-looking files staged: $STAGED"
else
  pass "git-staged-secrets (none)"
fi

echo
if [ "$FAIL" -eq 0 ]; then echo "ALL CHECKS PASSED"; exit 0; else echo "CHECKS FAILED — see FAIL lines above"; exit 1; fi
