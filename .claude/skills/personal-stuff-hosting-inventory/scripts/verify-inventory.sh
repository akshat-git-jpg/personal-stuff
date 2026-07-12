#!/usr/bin/env bash
# verify-inventory.sh — mechanically re-derive the "Known INFRA.md drift" table
# in ../SKILL.md (personal-stuff-hosting-inventory skill).
#
# Compares repo ground truth (apps/*/wrangler.*, apps/kushal-tools/src/hub.ts,
# VPS-CRONS.md) against INFRA.md. Read-only; no network calls.
#
# Checks:
#   1. workers-in-INFRA   — every routed Worker domain found in a wrangler file
#                           appears in INFRA.md's "### Workers" section.
#   2. hub-card-timeblock — timeblock has a card in hub.ts's APPS array.
#   3. d1-names           — every distinct database_name in wrangler files
#                           appears in INFRA.md's "### D1 databases" section.
#   4. d1-count           — INFRA.md's "D1 databases (N)" header matches the
#                           real distinct-name count.
#   5. cron-list          — every cron under VPS-CRONS.md "## Active crons"
#                           appears in INFRA.md's "### Cron jobs" section.
#
# Output: one "OK    <check>" or "DRIFT <check> — <detail>" line per check.
# Exit:   0 if all OK, 1 if any DRIFT.
#
# If this ever prints all OK, INFRA.md has been repaired: delete the drift
# table in ../SKILL.md and log the repair in decisions.md.

set -u

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
INFRA="$ROOT/INFRA.md"
HUB="$ROOT/apps/kushal-tools/src/hub.ts"
CRONS_DOC="$ROOT/VPS-CRONS.md"
fail=0

for f in "$INFRA" "$HUB" "$CRONS_DOC"; do
  if [ ! -f "$f" ]; then
    echo "ERROR missing expected file: $f" >&2
    exit 2
  fi
done

report() { # $1 = OK|DRIFT, $2 = check name, $3 = detail (optional)
  printf '%-5s %s%s\n' "$1" "$2" "${3:+ — $3}"
  if [ "$1" = "DRIFT" ]; then fail=1; fi
  return 0
}

# Wrangler configs for deployed app Workers (pinterest landing pages sit one
# level deeper than the apps/* glob).
wrangler_files() {
  ls "$ROOT"/apps/*/wrangler.toml "$ROOT"/apps/*/wrangler.jsonc \
     "$ROOT"/apps/pinterest-landing-pages/*/wrangler.toml \
     "$ROOT"/apps/pinterest-landing-pages/*/wrangler.jsonc 2>/dev/null
}

infra_section() { # $1 = "### "-heading prefix to extract until the next "### "
  awk -v h="$1" 'index($0, h) == 1 {f=1; next} /^### / {f=0} f' "$INFRA"
}

# --- Check 1: routed Worker domains vs INFRA.md "### Workers" ---------------
workers_section="$(infra_section '### Workers')"
domains="$(wrangler_files | xargs grep -hE '"pattern"|^pattern' 2>/dev/null \
  | grep -oE '([a-z0-9-]+\.)*(agrolloo|bridebestie)\.com' \
  | sed 's/^www\.//' | sort -u)"
missing=""
for d in $domains; do
  printf '%s\n' "$workers_section" | grep -qF "$d" || missing="$missing $d"
done
if [ -n "$missing" ]; then
  report DRIFT "workers-in-INFRA" "routed in wrangler but absent from INFRA.md '### Workers':$missing"
else
  report OK "workers-in-INFRA" "all routed domains listed"
fi

# --- Check 2: timeblock card in the kushal-tools hub ------------------------
if grep -q "timeblock" "$HUB"; then
  report OK "hub-card-timeblock" "APPS array has a timeblock entry"
else
  report DRIFT "hub-card-timeblock" "no timeblock entry in APPS ($HUB)"
fi

# --- Checks 3+4: D1 names + count vs INFRA.md "### D1 databases" ------------
d1_section="$(infra_section '### D1 databases')"
d1_names="$(wrangler_files | xargs grep -h 'database_name' 2>/dev/null \
  | sed -E 's/.*database_name"?[[:space:]]*[:=][[:space:]]*"([^"]+)".*/\1/' | sort -u)"
d1_actual=$(printf '%s\n' "$d1_names" | grep -c .)
missing=""
for n in $d1_names; do
  printf '%s\n' "$d1_section" | grep -qF "$n" || missing="$missing $n"
done
if [ -n "$missing" ]; then
  report DRIFT "d1-names" "in wrangler but absent from INFRA.md '### D1 databases':$missing"
else
  report OK "d1-names" "all $d1_actual database names listed"
fi
d1_claimed="$(grep -oE 'D1 databases \([0-9]+\)' "$INFRA" | grep -oE '\([0-9]+\)' | tr -d '()' | head -1)"
if [ "${d1_claimed:-0}" -eq "$d1_actual" ]; then
  report OK "d1-count" "INFRA.md claims $d1_claimed, wrangler files show $d1_actual"
else
  report DRIFT "d1-count" "INFRA.md claims ${d1_claimed:-none}, wrangler files show $d1_actual ($(printf '%s' "$d1_names" | tr '\n' ' '))"
fi

# --- Check 5: active crons vs INFRA.md "### Cron jobs" ----------------------
cron_section="$(infra_section '### Cron jobs')"
active_crons="$(awk '/^## Active crons/{f=1; next} /^## /{f=0} f && /^### /{print $2}' "$CRONS_DOC")"
missing=""
for c in $active_crons; do
  printf '%s\n' "$cron_section" | grep -qF "$c" || missing="$missing $c"
done
if [ -n "$missing" ]; then
  report DRIFT "cron-list" "active per VPS-CRONS.md but absent from INFRA.md cron section:$missing"
else
  report OK "cron-list" "all active crons listed"
fi

# ----------------------------------------------------------------------------
if [ "$fail" -eq 1 ]; then
  echo "RESULT: DRIFT — INFRA.md lags reality; trust wrangler files / VPS-CRONS.md / my-hosted-sites.md (see the drift table in this skill's SKILL.md)"
  exit 1
fi
echo "RESULT: OK — INFRA.md matches ground truth; the drift table in SKILL.md can be retired"
