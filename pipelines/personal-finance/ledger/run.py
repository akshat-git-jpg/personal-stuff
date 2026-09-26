"""Sync the ledger on demand: Gmail -> parse -> check -> publish.

    cd pipelines/personal-finance
    python3 -m ledger.run              # fetch new mail and Flipkart orders, build, publish
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
import datetime as dt
import json
import logging
import os
import ssl
import subprocess
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
    try:  # python.org builds ship without CA certs; certifi comes with the Google libs
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
        log("published: %s" % r.read().decode()[:200])


def fetch_flipkart(inbox, log=print):
    """Add new Flipkart orders to inbox/flipkart/orders.json. A lapsed login only skips this step."""
    cli = Path(__file__).resolve().parents[3] / "tooling" / "cli" / "flipkart" / "pp-flipkart"
    store = inbox / "flipkart" / "orders.json"
    old = json.loads(store.read_text())["orders"] if store.exists() else []
    since = min((o["time"][:10] for o in old[:1]), default="2025-04-01")
    since = (dt.date.fromisoformat(since) - dt.timedelta(days=7)).isoformat()
    tmp = store.with_suffix(".new.json")
    store.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run([str(cli), "orders", "--since", since, "--out", str(tmp)], capture_output=True, text=True, timeout=600)
    if r.returncode != 0:
        log("flipkart: skipped (%s)" % (r.stderr.strip().splitlines() or ["no output"])[-1])
        return
    new = json.loads(tmp.read_text())["orders"]
    tmp.unlink()
    by = {o["id"]: o for o in old}
    by.update({o["id"]: o for o in new})
    orders = sorted(by.values(), key=lambda o: o["time"], reverse=True)
    store.write_text(json.dumps({"fetched_at": dt.datetime.now().isoformat(timespec="seconds"), "orders": orders}, indent=1))
    log("flipkart: %d orders since %s, %d saved" % (len(new), since, len(orders)))


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
        fetch_flipkart(DATA / "inbox")
    ledger = build_mod.build(DATA, config)
    (DATA / "ledger.json").write_text(json.dumps(ledger, ensure_ascii=False, indent=1))
    if not a.no_push:
        if not config.get("ingest"):
            sys.exit("no ingest url/token in data/config.json; use --no-push")
        push(ledger, config["ingest"])


if __name__ == "__main__":
    main()
