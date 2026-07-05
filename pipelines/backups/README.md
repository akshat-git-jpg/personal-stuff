# backups

Owned backups of Cloudflare D1 — the data that can't be recreated.

## d1_export.py

Exports every personal-stuff D1 database to local `.sql` dumps via the Cloudflare D1
export API (polling flow: initiate → poll `at_bookmark` until `complete` → download the
nested `result.result.signed_url`).

```bash
# from anywhere; writes <db>-<UTCdate>.sql + MANIFEST into OUTPUT_DIR (default ./d1-dumps)
python3 pipelines/backups/d1_export.py /tmp/d1-dumps
```

- **Auth:** `CF_API_TOKEN` + `CF_ACCOUNT_ID`. Read from `pipelines/.env` on the Mac, or
  straight from the process env on the VPS (its `load_dotenv` no-ops when the file is
  absent), so the VPS cron carries only those two keys — see the deploy note below.
- **Databases:** the 5 live D1s are pinned by UUID in `DATABASES` (verified 2026-07-06:
  clicks-db, tracker-db, lists-db, founders-db, yt-rankings). Add a row when a new D1 is
  created — the [inventory-drift check] backlog item is meant to catch a missed one.
- **Exit code:** 0 only if all databases export; non-zero if any fail (one bad DB doesn't
  abort the others — they're all attempted, then it reports).
- **Deps:** `requests` + `python-dotenv` (both already in `pipelines/requirements.txt`).

## Deployed as a nightly cron

This script is the project code behind the **`d1-backup`** Pattern B cron in the
`vps-crons` repo (`vps-crons/d1-backup/`). The wrapper runs it into a temp dir and pushes
the dumps to MinIO at `d1-backups/<YYYYMMDD>/`, 30-day retention. Full VPS setup +
restore steps live in `vps-crons/d1-backup/README.md`.

Decision: `decisions.md` (2026-07-06).
