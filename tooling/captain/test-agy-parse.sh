#!/usr/bin/env bash
set -euo pipefail

# Tests for the status-parse block in tooling/captain/lanes.d/agy-headless.sh.
# Simulates the parse logic with different input files and checks the output.

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

parse() {
  local file="$1"
  python3 - "$file" <<'PYEOF'
import json, sys
raw = open(sys.argv[1]).read().strip()
try:
    d = json.loads(raw)
except json.JSONDecodeError:
    try:
        d = json.loads(raw.splitlines()[-1])
    except Exception:
        print("dead unparseable output||"); raise SystemExit
status = d.get("status", "")
cid = d.get("conversation_id", "")
tok = (d.get("usage") or {}).get("total_tokens", "")
if status == "SUCCESS":
    print(f"done run completed (tokens={tok})|{cid}|{tok}")
elif status == "ERROR":
    err = (d.get("error") or "").replace("|", " ")[:120]
    print(f"blocked agy error: {err}|{cid}|{tok}")
else:
    print("dead no status in envelope||")
PYEOF
}

# Case 1: Unparseable out file
file1="$TEMP_DIR/out1.out"
echo "Some random garbage output from a crashed process" > "$file1"
res1=$(parse "$file1")
if [ "$res1" = "dead unparseable output||" ]; then
  echo "PASS  unparseable file -> $res1"
else
  echo "FAIL  unparseable file -> got: $res1"
  exit 1
fi

# Case 2: status:ERROR with a pipe in error message
file2="$TEMP_DIR/out2.out"
echo '{"status": "ERROR", "error": "Traceback | File not found | err = 12", "conversation_id": "c123", "usage": {"total_tokens": 456}}' > "$file2"
res2=$(parse "$file2")
if [ "$res2" = "blocked agy error: Traceback   File not found   err = 12|c123|456" ]; then
  echo "PASS  status:ERROR with pipe -> $res2"
else
  echo "FAIL  status:ERROR with pipe -> got: $res2"
  exit 1
fi

# Case 3: SUCCESS envelope
file3="$TEMP_DIR/out3.out"
echo '{"status": "SUCCESS", "conversation_id": "c123", "usage": {"total_tokens": 456}}' > "$file3"
res3=$(parse "$file3")
if [ "$res3" = "done run completed (tokens=456)|c123|456" ]; then
  echo "PASS  SUCCESS envelope -> $res3"
else
  echo "FAIL  SUCCESS envelope -> got: $res3"
  exit 1
fi

# Case 4: No status envelope
file4="$TEMP_DIR/out4.out"
echo '{"conversation_id": "c123", "usage": {"total_tokens": 456}}' > "$file4"
res4=$(parse "$file4")
if [ "$res4" = "dead no status in envelope||" ]; then
  echo "PASS  no status envelope -> $res4"
else
  echo "FAIL  no status envelope -> got: $res4"
  exit 1
fi

echo "OK: all parser simulation tests passed"
