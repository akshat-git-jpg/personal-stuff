#!/usr/bin/env bash
# Cron wrapper for routine-ringer (VPS, Pattern B).
# Assumes personal-stuff is at /srv/projects/personal-stuff (read-only deploy
# key) and the venv lives at ./.venv next to this script.
set -euo pipefail

cd "$(dirname "$0")"

# Keep the checkout current so calendar-filter tweaks land without a manual
# redeploy. Silent on success; noisy on failure so cron mail flags it.
git -C /srv/projects/personal-stuff pull --quiet --ff-only origin main || true

exec .venv/bin/python ring.py
