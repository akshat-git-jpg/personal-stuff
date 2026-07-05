#!/usr/bin/env bash
# probe-sites.sh — parses my-hosted-sites.md and curls every public URL; exit 1 + DOWN_SITES: line if any site is unreachable/5xx.
set -uo pipefail

SITES_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/my-hosted-sites.md"
INCLUDE_LOCALHOST=0
if [[ "${1:-}" == "--include-localhost" ]]; then
  INCLUDE_LOCALHOST=1
fi

if [[ ! -f "$SITES_FILE" ]]; then
  echo "FATAL: SITES_FILE not found at $SITES_FILE" >&2
  exit 1
fi

URLS=$(grep '^- ' "$SITES_FILE" | grep -oE 'https?://[^ )]*' || true)

DOWN_LIST=()
COUNT=0

for url in $URLS; do
  if [[ "$url" == *"localhost"* && $INCLUDE_LOCALHOST -eq 0 ]]; then
    continue
  fi
  COUNT=$((COUNT + 1))
  
  # Probe
  CODE=$(curl -sS -o /dev/null -m 15 -L -w '%{http_code}' --retry 1 "$url" || echo "CURL_FAIL")
  
  if [[ "$CODE" == *"CURL_FAIL"* || "$CODE" == "000" || "$CODE" =~ ^5 ]]; then
    echo "DOWN ${CODE} $url"
    DOWN_LIST+=("$url")
  else
    echo "OK   ${CODE} $url"
  fi
done

if [[ ${#DOWN_LIST[@]} -gt 0 ]]; then
  echo "DOWN_SITES: ${DOWN_LIST[*]}"
  exit 1
else
  echo "all $COUNT sites up"
  exit 0
fi
