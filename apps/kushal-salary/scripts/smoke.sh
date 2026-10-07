#!/usr/bin/env bash
#
# smoke.sh: boot a real `wrangler dev` against a throwaway local D1 + R2 and
# exercise every route through the real push scripts. This is the merge gate:
# unit tests cannot see routing, D1 or R2.
#
# Safe next to a running dev server: secrets come from --var, state lives in a
# mktemp dir, SMOKE_PORT overrides the port (default 8798).
#
# Usage: bash scripts/smoke.sh   (after `npm run build`, which makes dist/)
set -uo pipefail

cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
. ../../scripts/node22-path.sh

PORT="${SMOKE_PORT:-8798}"
BASE="http://127.0.0.1:${PORT}"
PIN="1111"
TOKEN="smoke-token"

STATE="$(mktemp -d)"
LOG="$(mktemp)"
JAR="$(mktemp)"
PDF="$(mktemp)"
OUT="$(mktemp)"
WORK="$(mktemp -d)"
PID=""

cleanup() {
  if [ -n "$PID" ]; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  rm -rf "$STATE" "$LOG" "$JAR" "$PDF" "$OUT" "$WORK" 2>/dev/null || true
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
  KUSHAL_SALARY_URL="$BASE" KUSHAL_SALARY_INGEST_TOKEN="$1" node "scripts/$2" "${@:3}"
}
# count '<js expression over o = the /api/salary JSON>'
count() {
  curl -sS -b "$JAR" "${BASE}/api/salary" | node -e '
    let s = ""
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const o = JSON.parse(s)
      process.stdout.write(String(new Function("o", "return " + process.argv[1])(o)))
    })
  ' "$1"
}

[ -f dist/index.html ] || fail "dist/index.html missing; run npm run build first"
printf '%%PDF-1.4\n%%smoke\n' >"$PDF"

# Month JSON from the synthetic payslip text, through the real parser.
node --input-type=module -e '
  import { readFileSync, writeFileSync } from "node:fs"
  import { parseSlipText } from "./scripts/parse-slip.mjs"
  const dir = process.argv[1]
  const m = { ...parseSlipText(readFileSync("test/fixtures/slip-simple.txt", "utf8")), source_file: "slip.pdf" }
  writeFileSync(dir + "/month.json", JSON.stringify(m))
  writeFileSync(dir + "/bad.json", JSON.stringify({ ...m, items: [{ ...m.items[0], category: "bonus" }] }))
  writeFileSync(dir + "/note.json", JSON.stringify({ id: "2025-05-02-letter", date: "2025-05-02", title: "Appraisal letter", source_url: "https://mail.google.com/x" }))
' "$WORK" || fail "could not build smoke JSON"

# Fresh local database
npx wrangler d1 migrations apply DB --local --persist-to "$STATE" >"$LOG" 2>&1 \
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
curl -fsS "${BASE}/" | grep -q "Kushal Salary" && pass "1 GET / serves the app" || fail "1 GET / has no Kushal Salary title"

# 2. data is gated
CODE="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE}/api/salary")"
[ "$CODE" = "401" ] && pass "2 /api/salary needs auth" || fail "2 /api/salary without cookie gave ${CODE}"

# 3. login
CODE="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/login" -H 'Content-Type: application/json' -d '{"password":"0000"}')"
[ "$CODE" = "401" ] || fail "3 wrong PIN gave ${CODE}"
CODE="$(curl -sS -c "$JAR" -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/login" \
  -H 'Content-Type: application/json' -d "{\"password\":\"${PIN}\"}")"
[ "$CODE" = "200" ] && grep -q ksalary_auth "$JAR" && pass "3 login with PIN" || fail "3 login gave ${CODE}"

# 4. push month + PDF through the real script
push "$TOKEN" push-month.mjs "$WORK/month.json" "$PDF" >"$OUT" 2>&1 && grep -q "pushed 2025-05" "$OUT" \
  && pass "4 push-month.mjs pushed month + PDF" || { cat "$OUT"; fail "4 push-month.mjs failed"; }

# 5. bad category is refused with the field name
push "$TOKEN" push-month.mjs "$WORK/bad.json" >"$OUT" 2>&1
RC=$?
[ "$RC" -eq 1 ] && grep -q 'bad items\[0\].category' "$OUT" && pass "5 bad category refused" || { cat "$OUT"; fail "5 bad category not refused (exit ${RC})"; }

# 6. wrong token is refused
push wrong push-month.mjs "$WORK/month.json" >"$OUT" 2>&1
[ $? -eq 1 ] && pass "6 wrong ingest token refused" || fail "6 wrong ingest token was not refused"

# 7. data comes back
N="$(count 'o.months.length + "/" + o.months[0].has_pdf + "/" + o.months[0].items.length + "/" + o.months[0].items[6].category')"
[ "$N" = "1/true/7/variable" ] && pass "7 /api/salary returns the month" || fail "7 expected 1/true/7/variable, got ${N}"

# 8. PDF with cookie, not with the bearer
CT="$(curl -sS -b "$JAR" -o "$OUT" -w '%{http_code} %{content_type}' "${BASE}/api/months/2025-05/pdf")"
[ "$CT" = "200 application/pdf" ] && head -c 4 "$OUT" | grep -q '%PDF' || fail "8 PDF download gave '${CT}'"
CODE="$(curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer ${TOKEN}" "${BASE}/api/months/2025-05/pdf")"
[ "$CODE" = "401" ] && pass "8 PDF is cookie-only" || fail "8 PDF with bearer gave ${CODE}"

# 9. note + letter
push "$TOKEN" push-note.mjs "$WORK/note.json" "$PDF" >"$OUT" 2>&1 && grep -q "pushed note 2025-05-02-letter" "$OUT" \
  || { cat "$OUT"; fail "9 push-note.mjs failed"; }
CODE="$(curl -sS -b "$JAR" -o /dev/null -w '%{http_code}' "${BASE}/api/notes/2025-05-02-letter/pdf")"
N="$(count 'o.notes.length + "/" + o.notes[0].has_pdf')"
[ "$CODE" = "200" ] && [ "$N" = "1/true" ] && pass "9 note + letter stored" || fail "9 note gave ${CODE} ${N}"

# 10. re-push keeps one month and its PDF
push "$TOKEN" push-month.mjs "$WORK/month.json" >"$OUT" 2>&1 || fail "10 re-push failed"
N="$(count 'o.months.length + "/" + o.months[0].has_pdf + "/" + o.months[0].items.length')"
[ "$N" = "1/true/7" ] && pass "10 re-push replaces, keeps the PDF" || fail "10 after re-push expected 1/true/7, got ${N}"

# 11. unknown api path
CODE="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE}/api/nope")"
[ "$CODE" = "404" ] && pass "11 unknown api is 404" || fail "11 /api/nope gave ${CODE}"

echo "SMOKE OK"
