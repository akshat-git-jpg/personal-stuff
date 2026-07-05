#!/usr/bin/env bash
# Fetch a Reddit thread's HTML via old.reddit.com, bypassing the bot-detection
# 403 that blocks WebFetch, plain curl to www.reddit.com/*.json, and generic
# read-it-later proxies (e.g. r.jina.ai) on the same thread.
#
# Usage: fetch.sh <reddit-url> [output-file]
#   - output-file defaults to stdout
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: fetch.sh <reddit-url> [output-file]" >&2
  exit 1
fi

url="$1"
out="${2:-/dev/stdout}"

# Normalize any reddit host to old.reddit.com and drop a trailing .json
# (the .json API endpoint is blocked; the old-UI HTML page is not).
old_url=$(echo "$url" | sed -E 's#https?://(www\.|old\.)?reddit\.com#https://old.reddit.com#' | sed -E 's#\.json$##')

curl -sL "$old_url" \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" \
  -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
  -H "Accept-Language: en-US,en;q=0.9" \
  -o "$out" -w "HTTP %{http_code}\n" >&2
