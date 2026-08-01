#!/usr/bin/env bash
# 150 — deliver the approved full-resolution final back to the video's Drive
# folder (its Output/ subfolder). See README.md in this folder.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

slug="${1:?usage: run.sh <slug>}"
workdir="videos/$slug"
REPO_ROOT="$(cd ../../.. && pwd)"
PP_DRIVE="$REPO_ROOT/tooling/cli/drive/pp-drive"

# 1. The 120 gate is NEVER waived — delivery only ships an approved final.
approved=$(node -e "const p='./$workdir/final-cut.json';const fs=require('fs');console.log(fs.existsSync(p)&&require(p).approved===true?'yes':'no')")
if [[ "$approved" != "yes" ]]; then
  echo "refusing to deliver: final-cut.json approved=false — the owner approves the final cut (120) first, in every review mode" >&2
  exit 1
fi

# 2. The full-resolution final must exist (assemble without --draft, which
#    itself refuses without the 120 approval — so this file is approved output).
final="$HOME/kb-scratch/video/visuals-flow-2/$slug/final.mp4"
if [[ ! -f "$final" ]]; then
  echo "no full-resolution final at $final — run: node lib/assemble.mjs $slug   (no --draft)" >&2
  exit 1
fi

# 3. Destination comes from run-config.json (step 005): the video's own Drive
#    folder — the one holding its Input/Output subfolders.
drive_folder=$(node -e "const c=require('./$workdir/run-config.json');console.log(c.drive_folder||'')" 2>/dev/null || true)
drive_account=$(node -e "const c=require('./$workdir/run-config.json');console.log(c.drive_account||'')" 2>/dev/null || true)
if [[ -z "$drive_folder" ]]; then
  echo "no drive_folder in run-config.json — set it: bash run.sh $slug configure --drive-folder <id> [--drive-account <email>]" >&2
  exit 1
fi
if [[ -z "$drive_account" ]]; then
  echo "no drive_account in run-config.json — set it: bash run.sh $slug configure --drive-account <email>   ($PP_DRIVE accounts lists them)" >&2
  exit 1
fi

# 4. Find-or-create Output/ under the video folder, upload with --overwrite so
#    a re-delivery after a fix replaces the file instead of stacking copies.
out_id=$("$PP_DRIVE" ensure-folder "Output" --parent "$drive_folder" --account "$drive_account")
echo "Output folder: $out_id"
"$PP_DRIVE" upload "$final" --parent "$out_id" --name "$slug-final.mp4" --overwrite --account "$drive_account"
echo "delivered: $slug-final.mp4 → Drive folder $out_id"
