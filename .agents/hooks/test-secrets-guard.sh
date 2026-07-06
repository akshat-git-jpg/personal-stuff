#!/usr/bin/env bash
# Tests for secrets-guard.py — the agy PreToolUse deny hook.
# Feeds crafted payloads on stdin and asserts the decision. Exits non-zero if
# any case fails. Regression guard for the unbounded .example lookahead bypass
# (a .example anywhere in the payload used to exempt a real secret path).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GUARD="$HERE/secrets-guard.py"

fails=0

# assert <name> <expected: allow|deny> <payload-json>
assert() {
  local name="$1" want="$2" payload="$3"
  local out got
  out="$(printf '%s' "$payload" | python3 "$GUARD")"
  got="$(printf '%s' "$out" | python3 -c 'import json,sys; print(json.load(sys.stdin)["decision"])')"
  if [ "$got" = "$want" ]; then
    echo "PASS  $name -> $got"
  else
    echo "FAIL  $name -> got=$got want=$want  ($out)"
    fails=$((fails + 1))
  fi
}

# 1. Real secret path with a stray .example elsewhere in the payload -> deny.
assert "secret-with-stray-.example" deny \
  '{"toolCall":{"path":"infra/secrets/prod-db-password.json","note":"see config.example"}}'

# 2. Genuine .example file -> allow (the intended exemption).
assert "genuine-.example-file" allow \
  '{"toolCall":{"path":"infra/secrets/telegram.env.example"}}'

# 3. credentials.json -> deny (regression guard for the other DENY patterns).
assert "credentials.json" deny \
  '{"toolCall":{"path":"config/credentials.json"}}'

# 4. No secret reference -> allow.
assert "no-secret-reference" allow \
  '{"toolCall":{"path":"apps/redirector/src/index.ts"}}'

# Extra: nested secret path (no .example) -> deny; command reading an example -> allow.
assert "nested-secret-path" deny \
  '{"toolCall":{"path":"infra/secrets/sub/dir/db-password.json"}}'
assert "cmd-reads-.example" allow \
  '{"toolCall":{"cmd":"cat infra/secrets/hostinger-vps.env.example"}}'

if [ "$fails" -ne 0 ]; then
  echo "FAILED: $fails case(s)"
  exit 1
fi
echo "OK: all cases passed"
