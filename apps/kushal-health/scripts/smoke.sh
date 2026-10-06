#!/usr/bin/env bash
#
# smoke.sh: boot a real `wrangler dev` against a throwaway local D1 + R2 and
# exercise every route through the real push script. This is the merge gate:
# unit tests cannot see routing, D1 or R2.
#
# Safe next to a running dev server: secrets come from --var, state lives in a
# mktemp dir, SMOKE_PORT overrides the port (default 8799).
#
# Usage: bash scripts/smoke.sh   (after `npm run build`, which makes dist/)
set -uo pipefail

cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
. ../../scripts/node22-path.sh

PORT="${SMOKE_PORT:-8799}"
BASE="http://127.0.0.1:${PORT}"
PIN="1111"
TOKEN="smoke-token"
ID="2025-01-15-test-lab-b"

STATE="$(mktemp -d)"
LOG="$(mktemp)"
JAR="$(mktemp)"
PDF="$(mktemp)"
OUT="$(mktemp)"
PID=""

cleanup() {
  if [ -n "$PID" ]; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  rm -rf "$STATE" "$LOG" "$JAR" "$PDF" "$OUT" 2>/dev/null || true
}
trap cleanup EXIT

fail() {
  echo "FAIL $*"
  echo "--- last 40 lines of wrangler output ---"
  tail -40 "$LOG" 2>/dev/null
  exit 1
}
pass() { echo "PASS $*"; }

push() {
  KUSHAL_HEALTH_URL="$BASE" KUSHAL_HEALTH_INGEST_TOKEN="$1" node scripts/push-report.mjs "${@:2}"
}

[ -f dist/index.html ] || fail "dist/index.html missing; run npm run build first"
printf '%%PDF-1.4\n%%smoke\n' >"$PDF"

# Fresh local database
npx wrangler d1 migrations apply kushal-health --local --persist-to "$STATE" >"$LOG" 2>&1 \
  || fail "could not apply migrations to the local D1"

# Boot the Worker
npx wrangler dev --local --port "$PORT" --persist-to "$STATE" \
  --var "APP_PASSWORD:${PIN}" --var "SESSION_SECRET:smoke-secret-at-least-32-characters-long" \
  --var "INGEST_TOKEN:${TOKEN}" >"$LOG" 2>&1 &
PID=$!

UP=0
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "${BASE}/" 2>/dev/null; then UP=1; break; fi
  kill -0 "$PID" 2>/dev/null || fail "wrangler dev exited during startup"
  sleep 1
done
[ "$UP" = 1 ] || fail "server never came up on port ${PORT}"

# 1. SPA shell
curl -fsS "${BASE}/" | grep -q "Kushal Health" && pass "GET / serves the app" || fail "GET / has no Kushal Health title"

# 2. data is gated
CODE="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE}/api/blood")"
[ "$CODE" = "401" ] && pass "/api/blood needs auth" || fail "/api/blood without cookie gave ${CODE}"

# 3. push report + PDF through the real script
push "$TOKEN" test/fixtures/report.json "$PDF" >"$OUT" 2>&1 && pass "push-report.mjs pushed report + PDF" \
  || { cat "$OUT"; fail "push-report.mjs failed"; }

# 4. wrong token is refused
push wrong test/fixtures/report.json >"$OUT" 2>&1
[ $? -eq 1 ] && pass "wrong ingest token is refused" || fail "wrong ingest token was not refused"

# 5. login
CODE="$(curl -sS -c "$JAR" -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/login" \
  -H 'Content-Type: application/json' -d "{\"password\":\"${PIN}\"}")"
[ "$CODE" = "200" ] && pass "login with PIN" || fail "login gave ${CODE}"

# 6. data comes back
BODY="$(curl -sS -b "$JAR" "${BASE}/api/blood")"
printf '%s' "$BODY" | grep -q '"key":"ldl"' && printf '%s' "$BODY" | grep -q '"has_pdf":true' \
  && pass "/api/blood returns markers and has_pdf" || fail "/api/blood body wrong: ${BODY:0:300}"

# 7. PDF with cookie
CT="$(curl -sS -b "$JAR" -o "$OUT" -w '%{http_code} %{content_type}' "${BASE}/api/reports/${ID}/pdf")"
[ "$CT" = "200 application/pdf" ] && head -c 4 "$OUT" | grep -q '%PDF' \
  && pass "PDF served to a logged-in session" || fail "PDF download gave '${CT}'"

# 8. PDF without cookie
CODE="$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${TOKEN}" "${BASE}/api/reports/${ID}/pdf")"
[ "$CODE" = "401" ] && pass "PDF is cookie-only" || fail "PDF without cookie gave ${CODE}"

# 9. re-push is idempotent
push "$TOKEN" test/fixtures/report.json >"$OUT" 2>&1 || fail "re-push failed"
N="$(curl -sS -b "$JAR" "${BASE}/api/blood" | node -e '
  let s = ""
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const o = JSON.parse(s)
    const r = o.reports.filter((x) => x.id === process.argv[1])
    process.stdout.write(`${r.length}/${r[0]?.has_pdf}/${o.markers.length}`)
  })
' "$ID")"
[ "$N" = "1/true/6" ] && pass "re-push replaces, keeps the PDF" || fail "after re-push expected 1/true/6, got ${N}"

echo "SMOKE OK"
