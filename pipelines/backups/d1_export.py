#!/usr/bin/env python3
"""Export every personal-stuff D1 database to local .sql dumps via the Cloudflare
D1 export API. A cron wrapper (vps-crons) uploads the dumps to MinIO — see
pipelines/backups/README.md.

Why: clicks-db (money attribution) and tracker-db (team work) have no owned backup;
Cloudflare time-travel only reaches ~30 days. This is the owned, offsite-able copy.

Auth: CF_API_TOKEN + CF_ACCOUNT_ID from pipelines/.env (same creds common/cloudflare.py
uses). No coupling to common/ so it runs identically on the Mac and the VPS.

Usage:
    python3 d1_export.py [OUTPUT_DIR]      # default: ./d1-dumps
Exit code: 0 only if ALL databases exported; non-zero if any failed (so the cron
wrapper's alert trap fires).
"""
from __future__ import annotations

import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

# Resolve pipelines/.env relative to this file, not CWD — runs from anywhere.
PIPELINES_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PIPELINES_ROOT / ".env")

CF_API_BASE = "https://api.cloudflare.com/client/v4"
POLL_TIMEOUT_S = 180
POLL_INTERVAL_S = 3

# Verified against the account 2026-07-06. Add a row here when a new D1 is created.
DATABASES = {
    "clicks-db": "3415a408-ccc9-49e2-8fe1-60009dfd83ce",     # money attribution
    "tracker-db": "1562469d-ffd1-4cc2-b9f7-7095b84128ad",    # team work
    "lists-db": "cab71291-9aa6-4e10-9946-fca15bf860cd",
    "founders-db": "ccd722c2-4911-4337-aaa7-60c1e5cd273b",
    "yt-rankings": "e44e2c68-937c-4915-bf7e-7490213ed3cf",
}


def _require(name: str) -> str:
    v = os.getenv(name)
    if not v:
        sys.exit(f"d1_export: {name} not set in pipelines/.env")
    return v


def export_one(account: str, token: str, db_id: str) -> str:
    """Run the polling export flow; return the signed download URL when complete."""
    url = f"{CF_API_BASE}/accounts/{account}/d1/database/{db_id}/export"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    r = requests.post(url, headers=headers, timeout=30, json={
        "output_format": "polling",
        "dump_options": {"no_schema": False, "no_data": False},
    })
    r.raise_for_status()
    result = r.json()["result"]
    bookmark = result["at_bookmark"]

    deadline = time.time() + POLL_TIMEOUT_S
    while time.time() < deadline:
        if result.get("status") == "complete":
            # On completion the signed URL is nested one level deeper.
            return result["result"]["signed_url"]
        time.sleep(POLL_INTERVAL_S)
        r = requests.post(url, headers=headers, timeout=30, json={
            "output_format": "polling", "current_bookmark": bookmark,
        })
        r.raise_for_status()
        result = r.json()["result"]
    raise TimeoutError(f"export did not complete within {POLL_TIMEOUT_S}s")


def main() -> int:
    account = _require("CF_ACCOUNT_ID")
    token = _require("CF_API_TOKEN")
    out_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd() / "d1-dumps"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")

    failures = []
    manifest = []
    for name, db_id in DATABASES.items():
        dest = out_dir / f"{name}-{stamp}.sql"
        try:
            signed = export_one(account, token, db_id)
            with requests.get(signed, timeout=120, stream=True) as resp:
                resp.raise_for_status()
                with open(dest, "wb") as fh:
                    for chunk in resp.iter_content(chunk_size=1 << 16):
                        fh.write(chunk)
            size = dest.stat().st_size
            if size == 0:
                raise ValueError("downloaded 0 bytes")
            manifest.append(f"{name}\t{size}\t{dest.name}")
            print(f"d1_export: OK   {name:12} {size:>10} bytes -> {dest.name}")
        except Exception as e:  # noqa: BLE001 — one DB failing must not abort the rest
            failures.append(name)
            print(f"d1_export: FAIL {name:12} {e}", file=sys.stderr)

    (out_dir / f"MANIFEST-{stamp}.txt").write_text(
        f"# personal-stuff D1 export {stamp}\n"
        f"# created {datetime.now(timezone.utc).isoformat()}\n"
        "# name\tbytes\tfile\n" + "\n".join(manifest) + "\n"
    )
    if failures:
        print(f"d1_export: {len(failures)} FAILED: {', '.join(failures)}", file=sys.stderr)
        return 1
    print(f"d1_export: all {len(DATABASES)} databases exported to {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
