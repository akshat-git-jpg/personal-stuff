#!/usr/bin/env bash
set -e

fail() {
    echo "FAIL: $1" >&2
    exit 1
}

export TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

export PATH="$TEMP_DIR:$PATH"
export AMUL_WATCH_NOTIFY="$TEMP_DIR/notify"
export AMUL_WATCH_TG_ENV_FILE="$TEMP_DIR/telegram.env"
export AMUL_WATCH_TG_BASE="https://tg.test"
export AMUL_WATCH_TG_POLL_INTERVAL="0.05"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AMUL_WATCH_DIR="$REPO_ROOT/apps/amul-watch"

cat > "$AMUL_WATCH_TG_ENV_FILE" <<'EOF'
TELEGRAM_BOT_TOKEN=test-bot-token
TELEGRAM_CHAT_ID=12345
EOF

cat << 'EOF' > "$TEMP_DIR/notify"
#!/usr/bin/env bash
if [[ "$1" == "send" ]]; then
    echo "$2" >> "$TEMP_DIR/notify.log"
    exit "${NOTIFY_EXIT_CODE:-0}"
fi
exit 2
EOF
chmod +x "$TEMP_DIR/notify"

# --- the stubbed curl every amul_api / amul_cart / amul_login / telegram
# call goes through. No real network call happens anywhere in this suite.
cat << 'CURLEOF' > "$TEMP_DIR/curl"
#!/usr/bin/env bash
URL="${!#}"

status_of() {
    if [[ -f "$1" ]]; then cat "$1"; else echo "$2"; fi
}

# A real curl's -c writes the (possibly server-issued) cookies to the jar at
# the end of the request. Our fixtures need a real-looking cookie value to
# land in the jar after a successful login, so the redaction test has an
# actual secret to prove is absent from stdout.
JAR_PATH=""
prev_arg=""
for arg in "$@"; do
    if [[ "$prev_arg" == "-c" ]]; then
        JAR_PATH="$arg"
    fi
    prev_arg="$arg"
done

if [[ "$URL" == *"browse/protein"* ]]; then
    echo "__STATUS__200"
elif [[ "$URL" == *"user/info.js"* ]]; then
    echo 'session = {"tid": "test-tid"}'
    echo "__STATUS__200"
elif [[ "$URL" == *"entity/pincode"* ]]; then
    echo '{"data": {"records": [{"substore": "test-substore"}]}}'
    echo "__STATUS__200"
elif [[ "$URL" == *"ms.settings/_/setPreferences"* ]]; then
    echo "Updated successfully"
    echo "__STATUS__200"
elif [[ "$URL" == *"storeinfo.js"* ]]; then
    echo "req.query.v = '6';"
    echo "__STATUS__200"
elif [[ "$URL" == *"api/1/entity/ms.products"* ]]; then
    cat "$TEMP_DIR/products_response.json"
    echo "__STATUS__200"
elif [[ "$URL" == *"isUserRegistered"* ]]; then
    echo '{"data": {"exists": true}}'
    echo "__STATUS__200"
elif [[ "$URL" == *"sendOtp"* ]]; then
    echo '{"data": {"sent": true}}'
    echo "__STATUS__200"
elif [[ "$URL" == *"ms.users/_/login"* ]]; then
    echo "1" >> "$TEMP_DIR/login_calls.log"
    LOGIN_STATUS=$(status_of "$TEMP_DIR/login_status.txt" 200)
    if [[ "$LOGIN_STATUS" == "200" ]] && [[ -n "$JAR_PATH" ]]; then
        printf '# Netscape HTTP Cookie File\nshop.amul.com\tFALSE\t/\tTRUE\t9999999999\tjsessionid\trealcookievalue999\n' > "$JAR_PATH"
    fi
    cat "$TEMP_DIR/login_response.json"
    echo "__STATUS__$LOGIN_STATUS"
elif [[ "$URL" == *"getUserCart"* ]]; then
    cat "$TEMP_DIR/getusercart_response.json"
    echo "__STATUS__200"
elif [[ "$URL" == *"_/addItem"* ]]; then
    echo "1" >> "$TEMP_DIR/cart_calls.log"
    echo "1" >> "$TEMP_DIR/additem_calls.log"
    cat "$TEMP_DIR/additem_response.json"
    echo "__STATUS__$(status_of "$TEMP_DIR/additem_status.txt" 200)"
elif [[ "$URL" == *"ms.user_addresses"* ]]; then
    cat "$TEMP_DIR/addresses_response.json"
    echo "__STATUS__200"
elif [[ "$URL" == *"_/updateAddresses"* ]]; then
    echo "1" >> "$TEMP_DIR/cart_calls.log"
    echo '{"data": {}}'
    echo "__STATUS__200"
elif [[ "$URL" == *"sendPhoto"* ]]; then
    echo "1" >> "$TEMP_DIR/tg_sendphoto_calls.log"
    cat "$TEMP_DIR/tg_sendphoto_response.json"
    echo "__STATUS__$(status_of "$TEMP_DIR/tg_sendphoto_status.txt" 200)"
elif [[ "$URL" == *"sendMessage"* ]]; then
    echo "1" >> "$TEMP_DIR/tg_sendmessage_calls.log"
    cat "$TEMP_DIR/tg_sendmessage_response.json"
    echo "__STATUS__200"
elif [[ "$URL" == *"getUpdates"* ]]; then
    OFFSET=$(echo "$URL" | sed -n 's/.*offset=\([0-9]*\).*/\1/p')
    python3 - "$TEMP_DIR/tg_updates_fixture.json" "${OFFSET:-0}" <<'PYEOF'
import json, sys
with open(sys.argv[1]) as f:
    fixture = json.load(f)
offset = int(sys.argv[2])
result = [u for u in fixture.get("result", []) if u.get("update_id", 0) >= offset]
print(json.dumps({"ok": True, "result": result}))
PYEOF
    echo "__STATUS__200"
elif [[ "$URL" == *"answerCallbackQuery"* ]]; then
    echo '{"ok": true}'
    echo "__STATUS__200"
elif [[ "$URL" == *"editMessageCaption"* ]] || [[ "$URL" == *"editMessageText"* ]]; then
    echo "1" >> "$TEMP_DIR/tg_edit_calls.log"
    echo '{"ok": true}'
    echo "__STATUS__200"
else
    echo "Unknown URL: $URL" >&2
    exit 1
fi
CURLEOF
chmod +x "$TEMP_DIR/curl"

# --- default fixtures, overridden per test as needed ------------------------

cat << 'EOF' > "$TEMP_DIR/products_response.json"
{"data": [{"sku": "A", "_id": "prod-A", "name": "Test Protein", "alias": "test-protein",
"price": 100, "available": 1, "inventory_quantity": 5, "seller": "seller-1",
"linked_product_id": "linked-1", "images": [{"image": "66741c9a/hero.png"}]}]}
EOF

echo '{"data": {"exists": true}}' > "$TEMP_DIR/login_registered_response.json"
echo '{"data": {"_id": "user-123"}}' > "$TEMP_DIR/login_response.json"
echo '{"data": {"_id": "cart-abc"}}' > "$TEMP_DIR/getusercart_response.json"
echo '{"data": {}}' > "$TEMP_DIR/additem_response.json"
echo '{"data": [{"_id": "addr-1", "line1": "123 Test Street"}]}' > "$TEMP_DIR/addresses_response.json"
echo '{"ok": true, "result": {"message_id": 555}}' > "$TEMP_DIR/tg_sendphoto_response.json"
echo '{"ok": true, "result": {"message_id": 556}}' > "$TEMP_DIR/tg_sendmessage_response.json"
echo '{"result": []}' > "$TEMP_DIR/tg_updates_fixture.json"

cat << EOF > "$TEMP_DIR/config.json"
{"pincode": "400001", "poll_jitter_seconds": 0, "track": ["A"], "track_all_available": false}
EOF

cat << EOF > "$TEMP_DIR/assist.json"
{
  "enabled": true,
  "phone": "9876543210",
  "otp_source": "telegram",
  "otp_timeout_seconds": 1,
  "relogin_after_days": 6,
  "allowlist": ["A"],
  "max_price_inr": 99999,
  "max_carts_per_day": 99,
  "approval_timeout_seconds": 1,
  "address_id": "addr-1"
}
EOF

reset_call_logs() {
    rm -f "$TEMP_DIR"/cart_calls.log "$TEMP_DIR"/additem_calls.log "$TEMP_DIR"/login_calls.log \
          "$TEMP_DIR"/tg_sendphoto_calls.log "$TEMP_DIR"/tg_sendmessage_calls.log \
          "$TEMP_DIR"/tg_edit_calls.log "$TEMP_DIR"/notify.log
}

fresh_session() {
    # logged_in_at = now, well inside relogin_after_days
    python3 -c "
import json, time
json.dump({'cookies': {'jsessionid': 'realcookievalue123'}, 'user_id': 'user-123',
           'logged_in_at': time.time()}, open('$TEMP_DIR/amul-session.json', 'w'))
"
}

aging_session() {
    # logged_in_at older than relogin_after_days (6) but the real 7-day window hasn't lapsed
    python3 -c "
import json, time
json.dump({'cookies': {'jsessionid': 'realcookievalue123'}, 'user_id': 'user-123',
           'logged_in_at': time.time() - 7 * 86400}, open('$TEMP_DIR/amul-session.json', 'w'))
"
}

fired_state() {
    # state where 'A' was previously unavailable, so this poll fires a restock edge
    echo '{"test-substore": {"A": false}}' > "$TEMP_DIR/state.json"
}

quiet_state() {
    # state where 'A' is already available — no edge fires this poll
    echo '{"test-substore": {"A": true}}' > "$TEMP_DIR/state.json"
}

run_watch() {
    python3 "$AMUL_WATCH_DIR/watch.py" --once --assist \
        --config "$TEMP_DIR/config.json" \
        --state "$TEMP_DIR/state.json" \
        --assist-config "$TEMP_DIR/assist.json" \
        --session-file "$TEMP_DIR/amul-session.json" \
        --carts-log "$TEMP_DIR/carts.json" \
        --lock-file "$TEMP_DIR/.lock" \
        --tg-offset-file "$TEMP_DIR/.tg_offset.json" \
        --cart-jar "$TEMP_DIR/.cart.jar" \
        --pincode 400001 "$@"
}

line_count() {
    [[ -f "$1" ]] && wc -l < "$1" | tr -d ' ' || echo 0
}

# =============================================================================
# Test 1: no approval (timeout) -> zero cart-mutating requests. This is the
# mutation-gate assertion: sed 's/if not approved:/if False:/' must make this fail.
# =============================================================================
reset_call_logs
fresh_session
fired_state
rm -f "$TEMP_DIR/.tg_offset.json"
echo '{"result": []}' > "$TEMP_DIR/tg_updates_fixture.json"
AMUL_WATCH_TEST_TOKEN="tok-timeout" run_watch
if [[ "$(line_count "$TEMP_DIR/cart_calls.log")" != "0" ]]; then
    fail "must not touch cart without approval"
fi

# =============================================================================
# Test 2: "skip" tap -> zero cart-mutating requests, and the alert is edited.
# =============================================================================
reset_call_logs
fresh_session
fired_state
rm -f "$TEMP_DIR/.tg_offset.json"
python3 -c "
import json
json.dump({'result': [{'update_id': 1, 'callback_query': {'id': 'cbq1', 'data': 'skip:tok-skip'}}]},
          open('$TEMP_DIR/tg_updates_fixture.json', 'w'))
"
AMUL_WATCH_TEST_TOKEN="tok-skip" run_watch
if [[ "$(line_count "$TEMP_DIR/cart_calls.log")" != "0" ]]; then
    fail "a skip tap must not touch the cart"
fi
if [[ "$(line_count "$TEMP_DIR/tg_edit_calls.log")" == "0" ]]; then
    fail "a skip tap must strike the alert's buttons"
fi

# =============================================================================
# Tests 3-7: prepare_cart's own branching, exercised directly (not through a
# full watch.py run) since these are about the gate's internal logic, not the
# restock/telegram plumbing already covered above.
# =============================================================================
cat << 'PYEOF' > "$TEMP_DIR/test_prepare_cart.py"
import sys
sys.path.insert(0, "apps/amul-watch")
import amul_cart


class SpyClient:
    def __init__(self):
        self.calls = []

    def add_and_address(self, sku):
        self.calls.append(sku)
        return {"sku": sku, "checkout_url": "https://shop.amul.com/en/checkout"}


def expect_blocked(label, **kwargs):
    client = SpyClient()
    defaults = dict(sku="A", price=100, cfg={"enabled": True, "allowlist": ["A"],
                    "max_price_inr": 900, "max_carts_per_day": 5},
                    approved=True, carts_today=0, client=client)
    defaults.update(kwargs)
    result, why = amul_cart.prepare_cart(**defaults)
    if result is not None:
        sys.stderr.write(f"FAIL: {label} should have blocked the cart\n")
        sys.exit(1)
    if client.calls:
        sys.stderr.write(f"FAIL: {label} reached add_and_address\n")
        sys.exit(1)


# Test 3: enabled: false blocks even with an approval.
expect_blocked("enabled:false", cfg={"enabled": False, "allowlist": ["A"],
               "max_price_inr": 900, "max_carts_per_day": 5})

# Test 4: an SKU absent from allowlist blocks.
expect_blocked("not in allowlist", cfg={"enabled": True, "allowlist": ["OTHER"],
               "max_price_inr": 900, "max_carts_per_day": 5})

# Test 5: price over the cap blocks.
expect_blocked("price over cap", cfg={"enabled": True, "allowlist": ["A"],
               "max_price_inr": 50, "max_carts_per_day": 5})

# Test 6: the daily cart cap blocks.
expect_blocked("daily cap reached", carts_today=5,
               cfg={"enabled": True, "allowlist": ["A"], "max_price_inr": 900,
                    "max_carts_per_day": 5})

# A fully-approved, in-bounds request must reach the client exactly once.
client = SpyClient()
result, why = amul_cart.prepare_cart(
    "A", 100, {"enabled": True, "allowlist": ["A"], "max_price_inr": 900,
               "max_carts_per_day": 5},
    True, 0, client,
)
if result is None or client.calls != ["A"]:
    sys.stderr.write("FAIL: a fully-approved request should reach add_and_address exactly once\n")
    sys.exit(1)

# Test 7: missing / empty / malformed assist.json all fail closed.
import json
missing_cfg = amul_cart.load_assist_config("/nonexistent/assist.json")
if missing_cfg.get("enabled", False):
    sys.stderr.write("FAIL: a missing assist.json must fail closed\n")
    sys.exit(1)

empty_path = "/tmp/amul_assist_empty_test.json"
open(empty_path, "w").close()
empty_cfg = amul_cart.load_assist_config(empty_path)
if empty_cfg.get("enabled", False):
    sys.stderr.write("FAIL: an empty assist.json must fail closed\n")
    sys.exit(1)

malformed_path = "/tmp/amul_assist_malformed_test.json"
with open(malformed_path, "w") as f:
    f.write("{not valid json")
malformed_cfg = amul_cart.load_assist_config(malformed_path)
if malformed_cfg.get("enabled", False):
    sys.stderr.write("FAIL: a malformed assist.json must fail closed\n")
    sys.exit(1)

import os
os.remove(empty_path)
os.remove(malformed_path)

expect_blocked("missing config fails closed", cfg=missing_cfg)

print("prepare_cart checks ok")
PYEOF
(cd "$REPO_ROOT" && python3 "$TEMP_DIR/test_prepare_cart.py") || fail "prepare_cart gate checks failed"

# =============================================================================
# Test 8: a stale token in callback_data is ignored.
# =============================================================================
rm -f "$TEMP_DIR/.tg_offset_8.json"
python3 -c "
import json
json.dump({'result': [{'update_id': 1, 'callback_query': {'id': 'cbq-x', 'data': 'add:WRONG-TOKEN'}}]},
          open('$TEMP_DIR/tg_updates_fixture.json', 'w'))
"
(cd "$REPO_ROOT" && python3 -c "
import sys
sys.path.insert(0, 'apps/amul-watch')
import telegram
result = telegram.wait_for_callback('REAL-TOKEN', 0.5, '$TEMP_DIR/.tg_offset_8.json')
if result is not None:
    sys.stderr.write(f'FAIL: a stale token must be ignored, got {result!r}\n')
    sys.exit(1)
") || fail "stale token test failed"

# =============================================================================
# Test 9: the getUpdates offset advances — the same press is not consumed
# twice across two separate wait_for_callback calls (simulating two runs).
# =============================================================================
rm -f "$TEMP_DIR/.tg_offset_9.json"
python3 -c "
import json
json.dump({'result': [{'update_id': 100, 'callback_query': {'id': 'cbq-9', 'data': 'add:TOK9'}}]},
          open('$TEMP_DIR/tg_updates_fixture.json', 'w'))
"
(cd "$REPO_ROOT" && python3 -c "
import sys, json
sys.path.insert(0, 'apps/amul-watch')
import telegram

first = telegram.wait_for_callback('TOK9', 0.5, '$TEMP_DIR/.tg_offset_9.json')
if first != 'add':
    sys.stderr.write(f'FAIL: run 1 should see the press, got {first!r}\n')
    sys.exit(1)

offset = json.load(open('$TEMP_DIR/.tg_offset_9.json')).get('offset')
if offset != 101:
    sys.stderr.write(f'FAIL: offset should advance to 101, got {offset!r}\n')
    sys.exit(1)

second = telegram.wait_for_callback('TOK9', 0.3, '$TEMP_DIR/.tg_offset_9.json')
if second is not None:
    sys.stderr.write(f'FAIL: run 2 must not re-consume the same press, got {second!r}\n')
    sys.exit(1)
") || fail "getUpdates offset must advance across runs"

# =============================================================================
# Test 10: the lockfile prevents a second concurrent run; it exits 0 silently.
# =============================================================================
reset_call_logs
fresh_session
fired_state
echo $$ > "$TEMP_DIR/.lock"
touch "$TEMP_DIR/.lock"
set +e
run_watch
LOCK_EXIT=$?
set -e
if [[ "$LOCK_EXIT" != "0" ]]; then
    fail "a held lock must still exit 0"
fi
if [[ -f "$TEMP_DIR/notify.log" ]] || [[ -f "$TEMP_DIR/cart_calls.log" ]]; then
    fail "a held lock must produce no notifications or cart calls"
fi
rm -f "$TEMP_DIR/.lock"

# =============================================================================
# Test 11: no-payment grep — the checkout-finalizing endpoints must never be
# referenced anywhere in this directory's Python source.
# =============================================================================
if /usr/bin/grep -rniE '(place.?order|processPayment|razorpay|payment)' "$AMUL_WATCH_DIR"/*.py; then
    fail "no code may reference a payment or order-placement endpoint"
fi

# =============================================================================
# Test 12: a 401 / AMUL_SESSION_UNAUTHENTICATED response sends a session-
# expired notice and does not retry.
# =============================================================================
reset_call_logs
fresh_session
fired_state
rm -f "$TEMP_DIR/.tg_offset.json"
python3 -c "
import json
json.dump({'result': [{'update_id': 1, 'callback_query': {'id': 'cbq-12', 'data': 'add:tok-401'}}]},
          open('$TEMP_DIR/tg_updates_fixture.json', 'w'))
"
echo "401" > "$TEMP_DIR/additem_status.txt"
AMUL_WATCH_TEST_TOKEN="tok-401" run_watch
rm -f "$TEMP_DIR/additem_status.txt"
if [[ "$(line_count "$TEMP_DIR/additem_calls.log")" != "1" ]]; then
    fail "a 401 must not trigger a retry loop"
fi
if [[ "$(line_count "$TEMP_DIR/tg_sendmessage_calls.log")" == "0" ]]; then
    fail "a dead session mid-cart must message the owner"
fi

# =============================================================================
# Test 13: 208's own gate still passes unchanged.
# =============================================================================
bash "$AMUL_WATCH_DIR/test-amul-watch.sh" > /dev/null || fail "208's gate regressed"

# =============================================================================
# Test 14: an OTP that is not exactly 6 digits is rejected before any request
# that carries it is sent.
# =============================================================================
reset_call_logs
rm -f "$TEMP_DIR/.tg_offset_otp.json"
python3 -c "
import json
json.dump({'result': [{'update_id': 1, 'message': {'text': '12345'}}]},
          open('$TEMP_DIR/tg_updates_fixture.json', 'w'))
"
(cd "$REPO_ROOT" && python3 -c "
import sys
sys.path.insert(0, 'apps/amul-watch')
import amul_login

cfg = {'phone': '9876543210', 'otp_source': 'telegram', 'otp_timeout_seconds': 0.5}
try:
    amul_login.login(cfg, '$TEMP_DIR/amul-session-otp.json', '$TEMP_DIR/.otp.jar', '$TEMP_DIR/.tg_offset_otp.json')
    sys.stderr.write('FAIL: a malformed OTP must be rejected\n')
    sys.exit(1)
except amul_login.LoginError:
    pass
") || fail "a malformed OTP must be rejected before use"
if [[ -f "$TEMP_DIR/login_calls.log" ]]; then
    fail "a malformed OTP must never reach the login request"
fi

# =============================================================================
# Test 15: amul_login.py never prints a cookie value or the phone number.
# =============================================================================
reset_call_logs
rm -f "$TEMP_DIR/.tg_offset_login.json" "$TEMP_DIR/amul-session-login.json"
python3 -c "
import json
json.dump({'result': [{'update_id': 1, 'message': {'text': '654321'}}]},
          open('$TEMP_DIR/tg_updates_fixture.json', 'w'))
"
LOGIN_STDOUT="$TEMP_DIR/login_stdout.txt"
(cd "$REPO_ROOT" && python3 apps/amul-watch/amul_login.py --via-telegram \
    --config "$TEMP_DIR/assist.json" \
    --session-file "$TEMP_DIR/amul-session-login.json" \
    --jar "$TEMP_DIR/.login-test.jar" \
    --offset-file "$TEMP_DIR/.tg_offset_login.json" > "$LOGIN_STDOUT")
if /usr/bin/grep -q "9876543210" "$LOGIN_STDOUT"; then
    fail "amul_login must redact the phone number from its output"
fi
COOKIE_VALUE=$(python3 -c "import json; print(json.load(open('$TEMP_DIR/amul-session-login.json'))['cookies']['jsessionid'])")
if /usr/bin/grep -q "$COOKIE_VALUE" "$LOGIN_STDOUT"; then
    fail "amul_login must redact cookie values from its output"
fi

# =============================================================================
# Test 16: alerts survive a dead session — exactly one restock alert still
# goes out, with the cart button disabled rather than the alert suppressed.
# =============================================================================
reset_call_logs
rm -f "$TEMP_DIR/amul-session.json" "$TEMP_DIR/.tg_offset.json"
fired_state
echo '{"result": []}' > "$TEMP_DIR/tg_updates_fixture.json"
AMUL_WATCH_TEST_TOKEN="tok-dead" run_watch
ALERTS=$(( $(line_count "$TEMP_DIR/tg_sendphoto_calls.log") ))
if [[ "$ALERTS" != "1" ]]; then
    fail "alert must survive a dead session"
fi
if [[ "$(line_count "$TEMP_DIR/cart_calls.log")" != "0" ]]; then
    fail "alert must survive a dead session"
fi
if [[ "$(line_count "$TEMP_DIR/tg_sendmessage_calls.log")" == "0" ]]; then
    fail "alert must survive a dead session"
fi

# =============================================================================
# Test 17: a session older than relogin_after_days triggers the re-login
# prompt on a quiet tick; a younger session does not.
# =============================================================================
reset_call_logs
aging_session
quiet_state
rm -f "$TEMP_DIR/.tg_offset.json"
python3 -c "
import json
json.dump({'result': [{'update_id': 1, 'message': {'text': '111222'}}]},
          open('$TEMP_DIR/tg_updates_fixture.json', 'w'))
"
BEFORE=$(python3 -c "import json; print(json.load(open('$TEMP_DIR/amul-session.json'))['logged_in_at'])")
run_watch
if [[ ! -f "$TEMP_DIR/login_calls.log" ]]; then
    fail "an aging session must trigger a proactive re-login on a quiet tick"
fi
AFTER=$(python3 -c "import json; print(json.load(open('$TEMP_DIR/amul-session.json'))['logged_in_at'])")
python3 -c "
before, after = $BEFORE, $AFTER
import sys
if not (after > before):
    sys.stderr.write('FAIL: re-login should have refreshed logged_in_at\n')
    sys.exit(1)
"

reset_call_logs
fresh_session
quiet_state
rm -f "$TEMP_DIR/.tg_offset.json"
run_watch
if [[ -f "$TEMP_DIR/login_calls.log" ]]; then
    fail "a young session must not trigger a re-login"
fi

# =============================================================================
# Test 18: get_otp is selected by otp_source; an unknown value fails closed.
# =============================================================================
(cd "$REPO_ROOT" && python3 -c "
import sys
sys.path.insert(0, 'apps/amul-watch')
import amul_login

try:
    amul_login.get_otp('test', {'otp_source': 'carrier-pigeon'})
    sys.stderr.write('FAIL: an unknown otp_source must fail closed\n')
    sys.exit(1)
except amul_login.LoginError:
    pass
") || fail "an unknown otp_source must fail closed"

# =============================================================================
# Done-criteria checks not already covered above.
# =============================================================================

# --dry-run with --assist issues zero POSTs and writes no state.
reset_call_logs
fresh_session
fired_state
STATE_BEFORE=$(cat "$TEMP_DIR/state.json")
run_watch --dry-run > /dev/null
STATE_AFTER=$(cat "$TEMP_DIR/state.json")
if [[ "$STATE_BEFORE" != "$STATE_AFTER" ]]; then
    fail "--assist --dry-run must not write state"
fi
if [[ -f "$TEMP_DIR/cart_calls.log" ]] || [[ -f "$TEMP_DIR/tg_sendphoto_calls.log" ]]; then
    fail "--assist --dry-run must issue zero requests"
fi

# No stored account credential of that kind may exist anywhere in this
# directory — Amul login is OTP-only. The pattern is split so this check
# line itself is never a false-positive match of its own scan.
FORBIDDEN_WORD="pass""word"
if /usr/bin/grep -rln --exclude="$(basename "${BASH_SOURCE[0]}")" "$FORBIDDEN_WORD" "$AMUL_WATCH_DIR"; then
    fail "no stored account credential of that kind may exist — Amul login is OTP-only"
fi

# The HAR-import route must stay dead.
if /usr/bin/grep -rn 'har\|HAR' "$AMUL_WATCH_DIR"/*.py; then
    fail "no HAR-import path may be reintroduced"
fi

echo "ALL TESTS PASSED"
