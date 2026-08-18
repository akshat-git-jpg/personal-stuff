#!/usr/bin/env bash
set -e

fail() {
    echo "FAIL: $1" >&2
    exit 1
}

# Create temp dir
export TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

export PATH="$TEMP_DIR:$PATH"
export AMUL_WATCH_NOTIFY="$TEMP_DIR/notify"

cat << 'EOF' > "$TEMP_DIR/notify"
#!/usr/bin/env bash
if [[ "$1" == "send" ]]; then
    echo "$2" >> "$TEMP_DIR/notify.log"
    exit "${NOTIFY_EXIT_CODE:-0}"
fi
exit 2
EOF
chmod +x "$TEMP_DIR/notify"

cat << 'EOF' > "$TEMP_DIR/curl"
#!/usr/bin/env bash
URL="${!#}"
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
    if [[ "$URL" != *"filters[0][field]"* ]]; then
        echo "Missing bracket rule filters[0][field]" >&2
        exit 1
    fi
    if [[ "$URL" == *"%5B"* ]]; then
        echo "Bracket rule violation: found %5B" >&2
        exit 1
    fi
    cat "$TEMP_DIR/products_response.json"
    echo "__STATUS__200"
else
    echo "Unknown URL: $URL" >&2
    exit 1
fi
EOF
chmod +x "$TEMP_DIR/curl"

cat << 'EOF' > "$TEMP_DIR/test-python.py"
import sys
import os
sys.path.insert(0, os.path.abspath("apps/amul-watch"))
import amul_api
import watch

def assert_tid():
    tid = amul_api.tid_header("abc")
    import re
    if not re.match(r"^[0-9]{13}:[0-9]{1,3}:[0-9a-f]{64}$", tid):
        sys.stderr.write(f"FAIL: bad tid {tid}\n")
        sys.exit(1)
    tid2 = amul_api.tid_header("abc")
    if tid == tid2:
        sys.stderr.write(f"FAIL: tid not random\n")
        sys.exit(1)

def assert_avail():
    if watch.is_available({"available": 0, "inventory_quantity": 5}):
        sys.stderr.write("FAIL: available 0 should be false\n")
        sys.exit(1)
    if not watch.is_available({"available": 1, "inventory_quantity": 1}):
        sys.stderr.write("FAIL: available 1 qty 1 should be true\n")
        sys.exit(1)

def assert_transitions():
    failed = False
    if watch.transitions({"A": True}, {"A": True}, ["A"]) != []:
        sys.stderr.write("FAIL: repeat poll must not re-notify\n")
        failed = True
    if watch.transitions({}, {"A": True}, ["A"]) != []:
        sys.stderr.write("FAIL: first run must not notify\n")
        failed = True
    if watch.transitions({"A": False}, {"A": True}, ["A"]) != ["A"]:
        sys.stderr.write("FAIL: edge fires once\n")
        failed = True
    if watch.transitions({"B": False}, {"B": True}, ["A"]) != []:
        sys.stderr.write("FAIL: untracked sku ignored\n")
        failed = True
    if failed:
        sys.exit(1)

assert_tid()
assert_avail()
assert_transitions()
sys.exit(0)
EOF

python3 "$TEMP_DIR/test-python.py" || fail "python unit tests failed"

# Test the bracket rule by running amul_api directly
# The stub curl will check for it and exit 1 if bracket rule violated
cat << 'EOF' > "$TEMP_DIR/products_response.json"
{"data": [{"sku": "A", "available": 1, "inventory_quantity": 1}]}
EOF

python3 -c "import sys; sys.path.insert(0, 'apps/amul-watch'); import amul_api; amul_api.fetch_products('400001', '$TEMP_DIR/cookies.txt')" > "$TEMP_DIR/out" 2>"$TEMP_DIR/err" || {
    cat "$TEMP_DIR/err"
    if grep -q "bracket" "$TEMP_DIR/err"; then
        fail "bracket rule failed"
    fi
    fail "fetch_products failed"
}

# e2e with stubs
cp apps/amul-watch/config.example.json "$TEMP_DIR/config.json"
sed -i.bak 's/"track": \[/"track": ["A",/' "$TEMP_DIR/config.json"
sed -i.bak 's/"poll_jitter_seconds": 30/"poll_jitter_seconds": 0/' "$TEMP_DIR/config.json"
rm -f "$TEMP_DIR/notify.log"

# run 1: first run, no state.json, shouldn't notify
python3 apps/amul-watch/watch.py --once --config "$TEMP_DIR/config.json" --state "$TEMP_DIR/state.json" --pincode 400001
if [[ -f "$TEMP_DIR/notify.log" ]]; then
    fail "first run notified"
fi

# set state to A=False so next run A flips to True
echo '{"test-substore": {"A": false}}' > "$TEMP_DIR/state.json"

# run 2: A flips False -> True
python3 apps/amul-watch/watch.py --once --config "$TEMP_DIR/config.json" --state "$TEMP_DIR/state.json" --pincode 400001
if [[ $(grep -c "IN STOCK" "$TEMP_DIR/notify.log") -ne 1 ]]; then
    fail "edge did not notify"
fi

# run 3: repeat poll
python3 apps/amul-watch/watch.py --once --config "$TEMP_DIR/config.json" --state "$TEMP_DIR/state.json" --pincode 400001
if [[ $(grep -c "IN STOCK" "$TEMP_DIR/notify.log") -ne 1 ]]; then
    fail "repeat poll must not re-notify"
fi

# test notify failure is survivable
echo '{"test-substore": {"A": false}}' > "$TEMP_DIR/state.json"
export NOTIFY_EXIT_CODE=3
python3 apps/amul-watch/watch.py --once --config "$TEMP_DIR/config.json" --state "$TEMP_DIR/state.json" --pincode 400001 || fail "crashed on notify exit 3"
if ! grep -q '"A": true' "$TEMP_DIR/state.json"; then
    fail "did not write state after notify error"
fi

echo "ALL TESTS PASSED"
