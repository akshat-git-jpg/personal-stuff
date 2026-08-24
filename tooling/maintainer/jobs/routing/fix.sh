#!/bin/bash
# routing fix — applies safe auto-fixes.
# Refuses to touch decisions.md.

set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

ROOT="${ROUTING_ROOT:-$REPO_ROOT}"
cd "$ROOT" || die "cannot reach $ROOT"

# This script only accepts exactly formatted fix commands from the session's propose step.
# For this job, we implement specific handlers for checks 2 and 3.

CMD="${1:-}"
shift || true

if [ "$CMD" = "scaffold-readme" ]; then
  # Usage: fix.sh scaffold-readme <folder>
  FOLDER="$1"
  [ -z "$FOLDER" ] && die "scaffold-readme requires a folder"
  [ -d "$FOLDER" ] || die "folder does not exist: $FOLDER"
  [ -f "$FOLDER/README.md" ] && die "README.md already exists in $FOLDER"
  
  # Check against touching decisions.md, just in case (though it's a file, not folder)
  [[ "$FOLDER" == *"decisions.md"* ]] && die "refusing to touch decisions.md"

  NAME="$(basename "${FOLDER%/}")"
  cat > "$FOLDER/README.md" <<EOF
# $NAME

> Stub scaffolded by the \`routing\` maintainer job — flesh out as needed.
EOF
  echo "scaffolded $FOLDER/README.md"
  exit 0
fi

if [ "$CMD" = "repoint-link" ]; then
  # Usage: fix.sh repoint-link <file-to-edit> <old-target> <new-target>
  FILE="$1"
  OLD="$2"
  NEW="$3"
  [ -z "$NEW" ] && die "repoint-link requires file, old-target, new-target"
  [ -f "$FILE" ] || die "file does not exist: $FILE"
  
  [[ "$FILE" == *"decisions.md"* ]] && die "refusing to touch decisions.md"

  # Use perl or sed to replace. old-target might have slashes.
  # We do a basic replacement of ](old) to ](new)
  # Actually just replace the old string with the new string if it's uniquely found
  
  if ! grep -q "$OLD" "$FILE"; then
    die "target $OLD not found in $FILE"
  fi
  
  # Escape for sed
  O_ESC=$(echo "$OLD" | sed 's/[.[\*^$]/\\&/g')
  N_ESC=$(echo "$NEW" | sed 's/[.[\*^$]/\\&/g')
  
  # We use a perl one liner for safety with slashes
  perl -pi -e "s|\Q$OLD\E|$NEW|g" "$FILE"
  echo "repointed $OLD to $NEW in $FILE"
  exit 0
fi

die "unknown fix command: $CMD"
