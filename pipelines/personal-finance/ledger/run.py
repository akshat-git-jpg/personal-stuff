"""Sync the ledger on demand: Gmail -> parse -> check -> publish.

    cd pipelines/personal-finance
    python3 -m ledger.run              # fetch new mail, build, publish to the app
    python3 -m ledger.run --no-fetch   # rebuild from what is already on disk
    python3 -m ledger.run --no-push    # build and write data/ledger.json only

data/config.json (gitignored) holds everything private:

    {"password": "<SBI savings>",
     "passwords": {"sbic": ["..."], "neu": ["..."], "icici": ["..."]},
     "ingest": {"url": "https://kushal-income.agrolloo.com", "token": "..."}}

PF_DATA overrides the data folder (a workspace checkout has an empty one).
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import urllib.request
from pathlib import Path

from . import build as build_mod

DATA = Path(os.environ.get("PF_DATA") or Path(__file__).resolve().parent.parent / "data")


def push(ledger, ingest, log=print):
    req = urllib.request.Request(
        ingest["url"].rstrip("/") + "/api/ingest",
        data=json.dumps(ledger).encode(), method="POST",
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + ingest["token"],
                 "User-Agent": "kushal-money-sync"})
    with urllib.request.urlopen(req, timeout=60) as r:
        log("published: %s" % r.read().decode()[:200])


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-fetch", action="store_true")
    ap.add_argument("--no-push", action="store_true")
    a = ap.parse_args(argv)
    logging.getLogger("pypdf").setLevel(logging.ERROR)  # bank PDFs trip harmless /Perms warnings
    config = json.loads((DATA / "config.json").read_text())
    if not a.no_fetch:
        from . import gmail
        gmail.fetch(DATA / "inbox")
    ledger = build_mod.build(DATA, config)
    (DATA / "ledger.json").write_text(json.dumps(ledger, ensure_ascii=False, indent=1))
    if not a.no_push:
        if not config.get("ingest"):
            sys.exit("no ingest url/token in data/config.json; use --no-push")
        push(ledger, config["ingest"])


if __name__ == "__main__":
    main()
