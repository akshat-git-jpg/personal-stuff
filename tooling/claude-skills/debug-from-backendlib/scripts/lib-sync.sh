#!/usr/bin/env bash
# lib-sync.sh push|pop|status — the backend-libs fix round-trip via yalc.
#
#   push    build backend-libs and yalc-publish it into dashboard-api's
#           node_modules (replaces hand-swapping builds + .bak dirs).
#   pop     remove the yalc link, restore the git-HEAD version pin, npm i.
#   status  show pin vs installed vs yalc state.
#
# NOTE: 'yalc publish' is run with --no-scripts because backend-libs' prepare
# script runs co:login (CodeArtifact auth) which needs live AWS SSO.
# NOTE: 'yalc remove --all' restores whatever pin yalc.lock recorded, which can
# be stale — pop therefore re-pins from git HEAD's package.json explicitly.
source "$(dirname "$0")/common.sh"
CMD="${1:-status}"

head_pin() {
	# package.json path relative to the repo root (postgres/package.json)
	git -C "$DASH" show "HEAD:$(git -C "$DASH" rev-parse --show-prefix)package.json" \
		| python3 -c "import json,sys;print(json.load(sys.stdin)['dependencies']['$PKG'])"
}

case "$CMD" in
push)
	echo "== building backend-libs ($(git -C "$LIBS" branch --show-current) @ $(git -C "$LIBS" rev-parse --short HEAD)) =="
	(cd "$LIBS" && npm run build:tsc && npm run build:copy-assets)
	echo "== yalc publish + link =="
	(cd "$LIBS" && npx yalc publish --no-scripts --push)
	if ! grep -qF "\"$PKG\"" "$DASH/yalc.lock" 2>/dev/null; then
		(cd "$DASH" && npx yalc add "$PKG")
	fi
	INSTALLED="$(python3 -c "import json;print(json.load(open('$DASH/node_modules/$PKG/package.json'))['version'])")"
	ok "linked: $PKG@$INSTALLED (local build) into dashboard-api"
	warn "restart the server to load it: down.sh && up.sh"
	;;

pop)
	PIN="$(head_pin)"
	echo "== removing yalc link, restoring pin $PIN =="
	(cd "$DASH" && npx yalc remove --all 2>/dev/null || true)
	(cd "$DASH" && npm pkg set "dependencies.$PKG=$PIN")
	if aws sts get-caller-identity >/dev/null 2>&1; then
		(cd "$DASH" && npm i "$PKG@$PIN") && ok "reinstalled $PKG@$PIN from registry"
	else
		bad "AWS SSO expired — package.json pin restored, but node_modules still has the yalc build."
		echo "  run: aws sso login && (cd $DASH && npm run co:login && npm i $PKG@$PIN)"
		exit 1
	fi
	;;

status)
	PIN="$(python3 -c "import json;print(json.load(open('$DASH/package.json'))['dependencies']['$PKG'])")"
	HEAD_PIN="$(head_pin)"
	INSTALLED="$(python3 -c "import json;print(json.load(open('$DASH/node_modules/$PKG/package.json'))['version'])" 2>/dev/null || echo '<not installed>')"
	echo "  package.json pin : $PIN"
	echo "  git HEAD pin     : $HEAD_PIN"
	echo "  installed        : $INSTALLED"
	if [ -f "$DASH/yalc.lock" ]; then
		warn "yalc link ACTIVE: $(grep -o '"replaced": "[^"]*"' "$DASH/yalc.lock" || true)"
	else
		ok "no yalc link"
	fi
	ls -d "$DASH/node_modules/@zluri/"*.bak* 2>/dev/null | while read -r b; do warn "hand-swap residue: $b"; done || true
	;;

*)
	echo "usage: lib-sync.sh push | pop | status"
	exit 1
	;;
esac
