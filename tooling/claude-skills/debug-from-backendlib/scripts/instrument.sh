#!/usr/bin/env bash
# instrument.sh add|list|revert — manage local-only debug instrumentation.
#
#   add <file>   register a file BEFORE editing it with debug lines.
#                node_modules files -> full snapshot (restored byte-identical on revert)
#                repo files         -> marker mode (revert deletes every line containing BLDBG)
#   list         show registered files and whether they currently carry changes
#   revert       restore/strip everything, verify no marker survives, archive the manifest
#
# Contract for injected lines (marker mode): ONE line per injection, containing
# the marker, guarded by BL_DEBUG. Template:
#   /*BLDBG*/ if (process.env.BL_DEBUG) require('fs').appendFileSync(process.env.BL_DEBUG_LOG || '/tmp/bl-debug.log', '[bl] LABEL ' + JSON.stringify({ data }) + '\n');
source "$(dirname "$0")/common.sh"
CMD="${1:-}"

case "$CMD" in
add)
	FILE="$(cd "$(dirname "${2:?usage: instrument.sh add <file>}")" && pwd)/$(basename "$2")"
	[ -f "$FILE" ] || { bad "no such file: $FILE"; exit 1; }
	if [ -f "$MANIFEST" ] && grep -qF "	$FILE	" "$MANIFEST"; then
		ok "already registered: $FILE"
		exit 0
	fi
	if [[ "$FILE" == */node_modules/* ]]; then
		SNAP="$ORIGINALS/$(printf '%s' "$FILE" | shasum -a 256 | awk '{print $1}').orig"
		cp "$FILE" "$SNAP"
		printf 'snapshot\t%s\t%s\t%s\n' "$FILE" "$(sha "$FILE")" "$SNAP" >> "$MANIFEST"
		ok "registered (snapshot): $FILE"
		echo "  edit freely — revert restores the original byte-identical."
		echo "  NOTE: nodemon does NOT watch node_modules — restart (down.sh && up.sh) to load these edits."
	else
		printf 'marker\t%s\t%s\t-\n' "$FILE" "$(sha "$FILE")" >> "$MANIFEST"
		ok "registered (marker): $FILE"
		echo "  every injected line MUST be a single line containing /*$MARKER*/ and guarded by process.env.BL_DEBUG."
		echo "  revert deletes marker lines only — never mix real fix edits into the same line."
	fi
	;;

list)
	if [ ! -s "${MANIFEST:-/nonexistent}" ]; then
		ok "manifest empty — nothing instrumented"
		exit 0
	fi
	while IFS=$'\t' read -r TYPE FILE SHA_AT_ADD SNAP; do
		if [ ! -f "$FILE" ]; then
			warn "$TYPE  $FILE  (file GONE)"
		elif [ "$TYPE" = "snapshot" ]; then
			[ "$(sha "$FILE")" = "$SHA_AT_ADD" ] && echo "  snapshot  $FILE  (unmodified)" \
				|| echo "  snapshot  $FILE  (MODIFIED)"
		else
			N="$(grep -c "$MARKER" "$FILE" || true)"
			echo "  marker    $FILE  ($N marker line(s))"
		fi
	done < "$MANIFEST"
	;;

revert)
	if [ ! -s "${MANIFEST:-/nonexistent}" ]; then
		ok "manifest empty — nothing to revert"
		exit 0
	fi
	while IFS=$'\t' read -r TYPE FILE SHA_AT_ADD SNAP; do
		[ -f "$FILE" ] || { warn "skipping missing file: $FILE"; continue; }
		if [ "$TYPE" = "snapshot" ]; then
			cp "$SNAP" "$FILE"
			ok "restored: $FILE"
		else
			# delete every line containing the marker (BSD sed)
			sed -i '' "/$MARKER/d" "$FILE"
			if [ "$(sha "$FILE")" = "$SHA_AT_ADD" ]; then
				ok "stripped markers: $FILE (byte-identical to registration)"
			else
				warn "stripped markers: $FILE — file still differs from registration."
				warn "if the residual diff below is NOT your intended fix, a debug line leaked (multi-line injection?) — clean it by hand:"
				git -C "$(dirname "$FILE")" --no-pager diff -- "$FILE" 2>/dev/null | tail -20 | sed 's/^/    /' || true
			fi
		fi
	done < "$MANIFEST"
	LEFT="$(grep -rln "$MARKER" "$DASH/src" 2>/dev/null || true)"
	[ -n "$LEFT" ] && { bad "marker still present after revert in: $LEFT"; exit 1; }
	mv "$MANIFEST" "$MANIFEST.last"
	ok "all instrumentation reverted (manifest archived as $(basename "$MANIFEST").last)"
	;;

*)
	echo "usage: instrument.sh add <file> | list | revert"
	exit 1
	;;
esac
