#!/usr/bin/env bash
# personal-stuff secrets escrow — bundle every gitignored secret, encrypt with gpg
# (AES256 symmetric), and push the ciphertext offsite to Google Drive.
#
# Purpose: the Mac is the only copy of these files. One encrypted archive on Drive
# survives both a Mac loss and a VPS loss (Drive is offsite), and collapses the
# laptop-migration secrets step to "restore one archive".
#
# Runbook + restore: infra/escrow/README.md   Decision: decisions.md (2026-07-06)
#
# Usage:
#   ./escrow-backup.sh --dry-run     # list what WOULD be bundled, touch nothing
#   ./escrow-backup.sh               # bundle + encrypt (prompts for passphrase) + upload
#
# Passphrase: typed interactively and stored by YOU in the password manager. For an
# unattended cron, set GPG_PASSPHRASE (batch mode) — but read the README's note on the
# asymmetric-key upgrade first; a symmetric passphrase in a cron env is a weaker design.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ACCOUNT="${ESCROW_DRIVE_ACCOUNT:-kushalbakliwal25@gmail.com}"
DRIVE_FOLDER="${ESCROW_DRIVE_FOLDER:-secrets-escrow}"
STAMP="$(date +%Y%m%d)"
ARCHIVE="personal-stuff-secrets-escrow-${STAMP}.tar.gz.gpg"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

# Candidate secret paths. Repo-relative unless absolute. Directories are bundled whole.
# Only paths that actually exist are included — a missing entry is skipped, not an error.
CANDIDATES=(
  "$REPO/pipelines/.env"
  "$REPO/pipelines/credentials.json"
  "$REPO/tooling/mcp/google-shared/credentials.json"
  "$REPO/tooling/mcp/google-shared/tokens"
  "$REPO/tooling/cli/hostinger/.env"
  "$REPO/infra/secrets"
  "$HOME/.config/paypal-txns-pp-cli"
)
# Every app's local dev vars (apps/*/.dev.vars), discovered dynamically.
while IFS= read -r f; do CANDIDATES+=("$f"); done \
  < <(find "$REPO/apps" -maxdepth 2 -name ".dev.vars" 2>/dev/null)

# Resolve to the set that exists; record each as a staging-relative destination so the
# archive restores to a clear repo/ vs home/ tree.
present=()   # "src|dest"
for src in "${CANDIDATES[@]}"; do
  [ -e "$src" ] || continue
  case "$src" in
    "$REPO"/*) dest="repo/${src#"$REPO"/}" ;;
    "$HOME"/*) dest="home/${src#"$HOME"/}" ;;
    *)         dest="abs${src}" ;;
  esac
  present+=("$src|$dest")
done

echo "escrow: $((${#present[@]})) secret paths present on this machine"
for pair in "${present[@]}"; do echo "  + ${pair#*|}"; done

if [ "$DRY_RUN" = 1 ]; then
  echo "escrow: dry-run — nothing encrypted or uploaded."
  echo "escrow: NOTE — GUMROAD_ACCESS_TOKEN (shell env) and ~/.ssh keys are NOT in this list;"
  echo "        see infra/escrow/README.md to add them."
  exit 0
fi

command -v gpg >/dev/null || { echo "escrow: gpg not found" >&2; exit 1; }

# Stage into a private temp tree, tar, encrypt, upload, then wipe plaintext.
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/escrow.XXXXXX")"
chmod 700 "$STAGE"
trap 'rm -rf "$STAGE"' EXIT

for pair in "${present[@]}"; do
  src="${pair%%|*}"; dest="${pair#*|}"
  mkdir -p "$STAGE/$(dirname "$dest")"
  cp -R "$src" "$STAGE/$dest"
done

# Plaintext manifest inside the archive: what, when, from where.
{
  echo "personal-stuff secrets escrow"
  echo "created: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "host:    $(hostname)"
  echo "repo:    $REPO"
  echo "restore: see infra/escrow/README.md"
  echo "contents:"
  for pair in "${present[@]}"; do echo "  ${pair#*|}"; done
} > "$STAGE/MANIFEST.txt"

TARBALL="$STAGE.tar.gz"
tar -czf "$TARBALL" -C "$STAGE" .

OUT="${TMPDIR:-/tmp}/$ARCHIVE"
if [ -n "${GPG_PASSPHRASE:-}" ]; then
  printf '%s' "$GPG_PASSPHRASE" | \
    gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 \
        --cipher-algo AES256 -c -o "$OUT" "$TARBALL"
else
  echo "escrow: enter a passphrase to encrypt the archive (store it in your password manager)"
  gpg --cipher-algo AES256 -c -o "$OUT" "$TARBALL"
fi
rm -f "$TARBALL"
echo "escrow: encrypted -> $OUT ($(wc -c <"$OUT" | tr -d ' ') bytes)"

# Upload ciphertext to Drive (idempotent folder, overwrite same-named archive).
DRIVE="$REPO/tooling/cli/drive/pp-drive"
FID="$("$DRIVE" ensure-folder "$DRIVE_FOLDER" --account "$ACCOUNT")"
"$DRIVE" upload "$OUT" --parent "$FID" --overwrite --account "$ACCOUNT"

rm -f "$OUT"
echo "escrow: done — ciphertext uploaded to Drive folder '$DRIVE_FOLDER' ($ACCOUNT). Local plaintext wiped."
