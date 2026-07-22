#!/usr/bin/env bash
# verify-clean.sh — end-of-session gate. Passes only when nothing debug-related
# can leak into a commit. Run BEFORE any commit and at session end.
#   --allow-yalc   don't fail on an active yalc link (mid-session use)
source "$(dirname "$0")/common.sh"
ALLOW_YALC=0
[ "${1:-}" = "--allow-yalc" ] && ALLOW_YALC=1
FAILED=0

echo "== verify-clean =="

# 1. instrumentation manifest fully reverted
if [ -s "${MANIFEST:-/nonexistent}" ]; then
	bad "instrumentation manifest non-empty — run instrument.sh revert"
	FAILED=1
else
	ok "no live instrumentation manifest"
fi

# 2. no marker lines anywhere in either repo's source
for tree in "$DASH/src" "$LIBS/src"; do
	LEFT="$(grep -rln "$MARKER" "$tree" 2>/dev/null || true)"
	if [ -n "$LEFT" ]; then
		bad "debug marker ($MARKER) still present in: $LEFT"
		FAILED=1
	else
		ok "no $MARKER markers under $tree"
	fi
done

# 3. yalc state
if [ -f "$DASH/yalc.lock" ]; then
	if [ "$ALLOW_YALC" -eq 1 ]; then
		warn "yalc link active (allowed by --allow-yalc)"
	else
		bad "yalc link still active — run lib-sync.sh pop (or pass --allow-yalc mid-session)"
		FAILED=1
	fi
else
	ok "no yalc link"
fi

# 4. hand-swap residue
BAKS="$(ls -d "$DASH/node_modules/@zluri/"*.bak* 2>/dev/null || true)"
if [ -n "$BAKS" ]; then
	bad "hand-swap residue: $BAKS"
	FAILED=1
else
	ok "no .bak residue in node_modules/@zluri"
fi

# 5. working trees — display for eyeball review (only the real fix should show)
for repo in "$DASH/.." "$LIBS"; do
	NAME="$(basename "$(cd "$repo" && git rev-parse --show-toplevel)")"
	echo "-- git status: $NAME --"
	git -C "$repo" status --porcelain | sed 's/^/  /' || true
done
echo "  ^ review: ONLY your intended fix (and tests) should appear above."

# 6. server stopped
if lsof -ti "tcp:$SERVER_PORT" >/dev/null 2>&1; then
	warn "something is still listening on :$SERVER_PORT (down.sh to stop the debug server)"
fi

echo
if [ "$FAILED" -eq 0 ]; then
	echo "verify-clean PASSED"
else
	echo "verify-clean FAILED — fix the FAIL lines before committing"
fi
exit "$FAILED"
