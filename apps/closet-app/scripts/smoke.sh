#!/usr/bin/env bash
#
# smoke.sh — boot a real `wrangler dev` against a throwaway local D1 + R2 and
# exercise every route. This is closet-app's merge gate: unit tests cannot see
# routing, D1 or R2 (LESSONS 2026-07-23).
#
# Safe to run while the owner has their own dev server going:
#   - secrets come from --var, so the dev vars file is never read or written
#   - state lives in a mktemp dir, so .wrangler/state is never deleted
#   - SMOKE_PORT overrides the port if 8799 is taken
#
# Usage: bash scripts/smoke.sh
set -uo pipefail

cd "$(dirname "$0")/.."

PORT="${SMOKE_PORT:-8799}"
BASE="http://127.0.0.1:${PORT}"
PW="smoke-password"
SECRET="smoke-secret-at-least-32-characters-long"

STATE="$(mktemp -d)"
LOG="$(mktemp)"
JAR="$(mktemp)"
IMG="$(mktemp)"
PID=""

cleanup() {
  if [ -n "$PID" ]; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
  rm -f "$LOG" "$JAR" "$IMG" 2>/dev/null || true
}
trap cleanup EXIT

fail() {
  echo "SMOKE FAIL: $*"
  echo "--- last 40 lines of wrangler output ---"
  tail -40 "$LOG" 2>/dev/null
  exit 1
}

# Read a top-level JSON field from stdin without needing jq.
jget() {
  node -e '
    let s = ""
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try {
        const o = JSON.parse(s)
        const v = process.argv[1].split(".").reduce((a, k) => (a == null ? a : a[k]), o)
        process.stdout.write(v === undefined || v === null ? "" : String(v))
      } catch {
        process.stdout.write("")
      }
    })
  ' "$1"
}

# ── Fresh local database ────────────────────────────────────────────────────
npx wrangler d1 execute closet-db --local --persist-to "$STATE" --file=./schema.sql >"$LOG" 2>&1 \
  || fail "could not apply schema.sql to the local D1"

# ── Boot the Worker ────────────────────────────────────────────────────────
npx wrangler dev --port "$PORT" --persist-to "$STATE" \
  --var "APP_PASSWORD:${PW}" --var "SESSION_SECRET:${SECRET}" >"$LOG" 2>&1 &
PID=$!

UP=0
for _ in $(seq 1 90); do
  if curl -fsS "${BASE}/api/me" >/dev/null 2>&1; then UP=1; break; fi
  kill -0 "$PID" 2>/dev/null || fail "wrangler dev exited during startup"
  sleep 1
done
[ "$UP" = 1 ] || fail "server never came up on port ${PORT}"

# ── Auth gate ──────────────────────────────────────────────────────────────
[ "$(curl -sS "${BASE}/api/me" | jget authenticated)" = "false" ] \
  || fail "/api/me should report false before login"

CODE="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${BASE}/auth/login" \
  -H 'Content-Type: application/json' -d '{"password":"definitely-wrong"}')"
[ "$CODE" = "401" ] || fail "bad password was not rejected (got ${CODE})"

CODE="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE}/api/state")"
[ "$CODE" = "401" ] || fail "unauthenticated /api/state was not 401 (got ${CODE})"

curl -fsS -c "$JAR" -X POST "${BASE}/auth/login" \
  -H 'Content-Type: application/json' -d "{\"password\":\"${PW}\"}" >/dev/null \
  || fail "login with the correct password failed"

AUTH=(-b "$JAR")

# ── Photo upload + serve (R2) ──────────────────────────────────────────────
# 1x1 pixel JPEG, base64-decoded to a real file so curl sends real bytes.
printf '%s' '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICAkKDA8MCgsOCQgIDRENDg8QEBEQCgwSExIQEBD/wAALCAABAAEBAREA/8QAFAABAQAAAAAAAAAAAAAAAAAAAAv/2gAIAQEAAD8AS//Z' \
  | base64 --decode > "$IMG" 2>/dev/null || fail "could not build the test JPEG"

KEY="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/photos" \
  -H 'Content-Type: image/jpeg' --data-binary "@${IMG}" | jget key)"
[ -n "$KEY" ] || fail "photo upload returned no key"

CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' "${BASE}/api/photos/${KEY}")"
[ "$CODE" = "200" ] || fail "photo serve did not return 200 (got ${CODE})"

CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' "${BASE}/api/photos/nope.jpg")"
[ "$CODE" = "404" ] || fail "missing photo did not 404 (got ${CODE})"

CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/photos" \
  -H 'Content-Type: application/json' -d '{}')"
[ "$CODE" = "415" ] || fail "non-image photo upload was not rejected (got ${CODE})"

# A second key, so the cloth and the look never share one R2 object. Sharing a
# key would make the "delete removed the photo" assertion below ambiguous.
KEY2="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/photos" \
  -H 'Content-Type: image/jpeg' --data-binary "@${IMG}" | jget key)"
[ -n "$KEY2" ] || fail "second photo upload returned no key"
[ "$KEY2" != "$KEY" ] || fail "two uploads returned the same key — keys must be unique"

# ── Cloth CRUD ─────────────────────────────────────────────────────────────
CLOTH="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/clothes" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Blue jeans\",\"tags\":[\"Jeans\",\" casual \"],\"photo_key\":\"${KEY}\"}")"
CID="$(printf '%s' "$CLOTH" | jget id)"
[ -n "$CID" ] || fail "cloth create returned no id"
[ "$(printf '%s' "$CLOTH" | jget wears)" = "0" ] || fail "a new cloth should start at 0 wears"

CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/clothes" \
  -H 'Content-Type: application/json' -d '{"name":"   "}')"
[ "$CODE" = "400" ] || fail "a blank cloth name was accepted (got ${CODE})"

# ── Wear, then undo the wear ───────────────────────────────────────────────
W1="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/clothes/${CID}/wear")"
[ "$(printf '%s' "$W1" | jget cloth.wears)" = "1" ] || fail "wear did not increment to 1"
EV1="$(printf '%s' "$W1" | jget event_id)"
[ -n "$EV1" ] || fail "wear returned no event_id, so Undo is impossible"

W2="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/clothes/${CID}/wear")"
[ "$(printf '%s' "$W2" | jget cloth.wears)" = "2" ] || fail "second wear did not increment to 2"
EV2="$(printf '%s' "$W2" | jget event_id)"

U1="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/events/${EV2}/undo")"
[ "$(printf '%s' "$U1" | jget cloth.wears)" = "1" ] \
  || fail "wear-undo did not restore wears (wanted 1, got $(printf '%s' "$U1" | jget cloth.wears))"

U2="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/events/${EV1}/undo")"
[ "$(printf '%s' "$U2" | jget cloth.wears)" = "0" ] \
  || fail "wear-undo did not restore wears (wanted 0, got $(printf '%s' "$U2" | jget cloth.wears))"
[ -z "$(printf '%s' "$U2" | jget cloth.last_worn_at)" ] \
  || fail "undoing the only wear left a stale last_worn_at"

CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/events/${EV1}/undo")"
[ "$CODE" = "404" ] || fail "undoing an already-undone event was not 404 (got ${CODE})"

# ── Wash, then undo the wash ───────────────────────────────────────────────
curl -fsS "${AUTH[@]}" -X POST "${BASE}/api/clothes/${CID}/wear" >/dev/null
curl -fsS "${AUTH[@]}" -X POST "${BASE}/api/clothes/${CID}/wear" >/dev/null
curl -fsS "${AUTH[@]}" -X POST "${BASE}/api/clothes/${CID}/wear" >/dev/null

WASH="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/clothes/${CID}/wash")"
[ "$(printf '%s' "$WASH" | jget cloth.wears)" = "0" ] || fail "wash did not reset wears to 0"
EVW="$(printf '%s' "$WASH" | jget event_id)"

UW="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/events/${EVW}/undo")"
[ "$(printf '%s' "$UW" | jget cloth.wears)" = "3" ] \
  || fail "wash-undo did not restore the exact count (wanted 3, got $(printf '%s' "$UW" | jget cloth.wears))"

# ── Looks + the shared tag vocabulary ──────────────────────────────────────
LOOK="$(curl -sS "${AUTH[@]}" -X POST "${BASE}/api/looks" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Friday office\",\"tags\":[\"Office\",\"CASUAL\",\"winter\"],\"photo_key\":\"${KEY2}\"}")"
LID="$(printf '%s' "$LOOK" | jget id)"
[ -n "$LID" ] || fail "look create returned no id"

CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/looks" \
  -H 'Content-Type: application/json' -d '{"name":"no photo"}')"
[ "$CODE" = "400" ] || fail "a look without photo_key was accepted (got ${CODE})"

STATE_JSON="$(curl -sS "${AUTH[@]}" "${BASE}/api/state")"

# "casual" was typed as " casual " on the cloth and "CASUAL" on the look.
# One shared, normalised vocabulary means that is ONE tag row used twice.
printf '%s' "$STATE_JSON" | node -e '
  let s = ""
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const st = JSON.parse(s)
    const names = st.tags.map((t) => t.name).sort()
    const casual = st.tags.filter((t) => t.name === "casual")
    if (casual.length !== 1) {
      console.error(`expected exactly one "casual" tag, got ${casual.length}: ${JSON.stringify(names)}`)
      process.exit(1)
    }
    const id = casual[0].id
    const types = st.item_tags.filter((r) => r.tag_id === id).map((r) => r.item_type).sort()
    if (JSON.stringify(types) !== JSON.stringify(["cloth", "look"])) {
      console.error(`"casual" should be attached to one cloth and one look, got ${JSON.stringify(types)}`)
      process.exit(1)
    }
    const upper = st.tags.filter((t) => t.name !== t.name.trim().toLowerCase())
    if (upper.length > 0) {
      console.error(`tags are not normalised: ${JSON.stringify(upper)}`)
      process.exit(1)
    }
  })
' || fail "tag vocabulary is not shared and normalised across both tabs"

# Multi-tag: the look carries three tags at once.
COUNT="$(printf '%s' "$STATE_JSON" | node -e '
  let s = ""
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const st = JSON.parse(s)
    const look = st.looks[0]
    process.stdout.write(String(st.item_tags.filter((r) => r.item_type === "look" && r.item_id === look.id).length))
  })
')"
[ "$COUNT" = "3" ] || fail "look should carry 3 tags, carries ${COUNT}"

# Clothes come back highest-count-first — that ordering IS the wash cue.
curl -sS "${AUTH[@]}" -X POST "${BASE}/api/clothes" -H 'Content-Type: application/json' \
  -d '{"name":"Grey hoodie","tags":["hoodie"]}' >/dev/null
ORDER="$(curl -sS "${AUTH[@]}" "${BASE}/api/state" | node -e '
  let s = ""
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const st = JSON.parse(s)
    process.stdout.write(st.clothes.map((c) => `${c.name}:${c.wears}`).join(","))
  })
')"
[ "$ORDER" = "Blue jeans:3,Grey hoodie:0" ] \
  || fail "clothes are not ordered highest-wears-first (got ${ORDER})"

# ── Tag pruning ────────────────────────────────────────────────────────────
curl -fsS "${AUTH[@]}" -X PATCH "${BASE}/api/looks/${LID}" -H 'Content-Type: application/json' \
  -d '{"tags":["office"]}' >/dev/null
LEFT="$(curl -sS "${AUTH[@]}" "${BASE}/api/state" | node -e '
  let s = ""
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const st = JSON.parse(s)
    process.stdout.write(st.tags.map((t) => t.name).sort().join(","))
  })
')"
# "winter" was only ever on that look, so it is gone. "casual" survives on the cloth.
[ "$LEFT" = "casual,hoodie,jeans,office" ] || fail "orphan tag was not pruned (tags left: ${LEFT})"

# ── Delete cascades, including the R2 object ───────────────────────────────
curl -fsS "${AUTH[@]}" -X DELETE "${BASE}/api/clothes/${CID}" >/dev/null
CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' -X POST "${BASE}/api/clothes/${CID}/wear")"
[ "$CODE" = "404" ] || fail "a deleted cloth still accepts a wear (got ${CODE})"

CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' "${BASE}/api/photos/${KEY}")"
[ "$CODE" = "404" ] || fail "deleting a cloth left its R2 photo behind (got ${CODE})"

curl -fsS "${AUTH[@]}" -X DELETE "${BASE}/api/looks/${LID}" >/dev/null
CODE="$(curl -sS "${AUTH[@]}" -o /dev/null -w '%{http_code}' "${BASE}/api/photos/${KEY2}")"
[ "$CODE" = "404" ] || fail "deleting a look left its R2 photo behind (got ${CODE})"

FINAL="$(curl -sS "${AUTH[@]}" "${BASE}/api/state" | node -e '
  let s = ""
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const st = JSON.parse(s)
    process.stdout.write(`${st.clothes.length}/${st.looks.length}/${st.tags.length}`)
  })
')"
[ "$FINAL" = "1/0/1" ] || fail "final state should be 1 cloth, 0 looks, 1 tag; got ${FINAL}"

echo "SMOKE OK"
