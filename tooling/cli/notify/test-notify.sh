#!/bin/bash
set -e

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

NOTIFY_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/notify"

STUB_DIR=$(mktemp -d)
FAKE_REPO=$(mktemp -d)
trap 'rm -rf "$STUB_DIR" "$FAKE_REPO"' EXIT

# Build a fake repo layout so notify's REPO_ROOT-relative env lookup
# (infra/secrets/telegram.env) resolves inside our sandbox, not the real repo.
mkdir -p "$FAKE_REPO/tooling/cli/notify" "$FAKE_REPO/infra/secrets"
cp "$NOTIFY_BIN" "$FAKE_REPO/tooling/cli/notify/notify"
chmod +x "$FAKE_REPO/tooling/cli/notify/notify"
NOTIFY="$FAKE_REPO/tooling/cli/notify/notify"
ENV_FILE="$FAKE_REPO/infra/secrets/telegram.env"

export PATH="$STUB_DIR:$PATH"

CURL_LOG="$STUB_DIR/curl.log"

# --- (a) with creds set, curl is invoked with the right URL and exits 0 ---
cat > "$STUB_DIR/curl" << EOF
#!/bin/bash
echo "\$@" >> "$CURL_LOG"
exit 0
EOF
chmod +x "$STUB_DIR/curl"

cat > "$ENV_FILE" << 'EOF'
TELEGRAM_BOT_TOKEN=test-token-123
TELEGRAM_CHAT_ID=999999
EOF

rm -f "$CURL_LOG"
"$NOTIFY" send "hello world" || fail "(a) expected exit 0, got $?"
grep -q "https://api.telegram.org/bottest-token-123/sendMessage" "$CURL_LOG" \
  || fail "(a) curl not called with expected telegram URL"
grep -q "chat_id=999999" "$CURL_LOG" || fail "(a) chat_id not passed to curl"
grep -q "text=hello world" "$CURL_LOG" || fail "(a) text not passed to curl"

# --- (b) without creds, with stub pp-ntfy + NTFY_TOPIC, falls back to ntfy ---
NTFY_LOG="$STUB_DIR/ntfy.log"
cat > "$STUB_DIR/pp-ntfy" << EOF
#!/bin/bash
echo "\$@" >> "$NTFY_LOG"
exit 0
EOF
chmod +x "$STUB_DIR/pp-ntfy"

: > "$ENV_FILE"  # empty creds
rm -f "$NTFY_LOG"
NTFY_TOPIC="test-topic" "$NOTIFY" send "fallback message" \
  || fail "(b) expected exit 0 via ntfy fallback, got $?"
grep -q "fallback message" "$NTFY_LOG" || fail "(b) pp-ntfy stub not called"

# --- (c) with neither telegram creds nor ntfy topic, exits 3 and warns ---
: > "$ENV_FILE"
STDERR_OUT=$(mktemp)
set +e
NTFY_TOPIC="" "$NOTIFY" send "undeliverable message" 2>"$STDERR_OUT"
code=$?
set -e
[ "$code" -eq 3 ] || fail "(c) expected exit 3, got $code"
grep -q "WARN" "$STDERR_OUT" || fail "(c) expected WARN on stderr"
rm -f "$STDERR_OUT"

# --- (d) setup refuses to overwrite an existing non-empty chat id ---
cat > "$ENV_FILE" << 'EOF'
TELEGRAM_BOT_TOKEN=test-token-123
TELEGRAM_CHAT_ID=existing-chat-id
EOF
"$NOTIFY" setup || fail "(d) setup should exit 0 when chat id already set"
grep -q "^TELEGRAM_CHAT_ID=existing-chat-id$" "$ENV_FILE" \
  || fail "(d) existing TELEGRAM_CHAT_ID was overwritten"

# --- (d2) setup fills in chat id via getUpdates when empty ---
cat > "$STUB_DIR/curl" << 'EOF'
#!/bin/bash
# Only getUpdates is called in this scenario (no sendMessage in setup flow)
echo '{"ok": true, "result": [{"update_id": 1, "message": {"chat": {"id": 424242}}}]}'
exit 0
EOF
chmod +x "$STUB_DIR/curl"

cat > "$ENV_FILE" << 'EOF'
TELEGRAM_BOT_TOKEN=test-token-123
TELEGRAM_CHAT_ID=
EOF
"$NOTIFY" setup || fail "(d2) setup should exit 0 on successful chat-id discovery"
grep -q "^TELEGRAM_CHAT_ID=424242$" "$ENV_FILE" \
  || fail "(d2) expected TELEGRAM_CHAT_ID=424242 written to env file"

# --- (e) greenlight/overnight self-tests still pass after the notify wiring ---
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
bash "$REPO_ROOT/tooling/cli/greenlight/test-greenlight.sh" > /tmp/notify-test-greenlight.out 2>&1 \
  || { cat /tmp/notify-test-greenlight.out >&2; fail "(e) greenlight self-test failed"; }
grep -q "ALL TESTS PASSED" /tmp/notify-test-greenlight.out || fail "(e) greenlight self-test did not report ALL TESTS PASSED"

bash "$REPO_ROOT/tooling/cli/overnight/test-overnight.sh" > /tmp/notify-test-overnight.out 2>&1 \
  || { cat /tmp/notify-test-overnight.out >&2; fail "(e) overnight self-test failed"; }
grep -q "ALL TESTS PASSED" /tmp/notify-test-overnight.out || fail "(e) overnight self-test did not report ALL TESTS PASSED"
rm -f /tmp/notify-test-greenlight.out /tmp/notify-test-overnight.out

echo "ALL TESTS PASSED"
