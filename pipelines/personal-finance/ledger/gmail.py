"""Download statements and card alerts from Gmail into data/inbox/.

Idempotent: a message already on disk is skipped, so a re-run only fetches what
is new. Nothing here parses; `build.py` reads the inbox.

    data/inbox/statements/<source>/<message-id>.pdf
    data/inbox/alerts/<message-id>.json   {id, source, ts, text}
"""

from __future__ import annotations

import base64
import html
import json
import os
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
# A workspace checkout has no OAuth tokens; point this at the main checkout's folder.
sys.path.insert(0, os.environ.get("PP_GOOGLE_SHARED") or str(REPO / "tooling" / "mcp" / "google-shared"))

ACCOUNT = "kushalbakliwal25@gmail.com"
SINCE = "2025/09/01"

STATEMENTS = {
    "sbi": 'from:(cbssbi.cas@alerts.sbi.bank.in OR yonobysbi@alerts.sbi.bank.in) has:attachment',
    "sbic": 'from:sbicard.com has:attachment subject:"Monthly Statement"',
    "neu": 'from:hdfcbank has:attachment subject:"Tata Neu Infinity" subject:Statement',
    "icici": 'from:(icici.bank.in OR icicibank.com) has:attachment subject:"Credit Card Statement"',
}
ALERTS = {
    "sbic": 'from:sbicard.com (subject:"Transaction Alert" OR subject:"E-mandate")',
    "neu": 'from:hdfcbank.bank.in subject:"UPI txn"',
    "icici": 'from:(icici.bank.in OR icicibank.com) subject:"Transaction alert"',
}


def _service():
    from google_auth import get_credentials
    from googleapiclient.discovery import build
    return build("gmail", "v1", credentials=get_credentials(ACCOUNT), cache_discovery=False)


def _ids(svc, q):
    out, tok = [], None
    while True:
        r = svc.users().messages().list(userId="me", q=q, pageToken=tok, maxResults=100).execute()
        out += [m["id"] for m in r.get("messages", [])]
        tok = r.get("nextPageToken")
        if not tok:
            return out


def _walk(p):
    yield p
    for c in p.get("parts", []) or []:
        yield from _walk(c)


def _text(payload):
    plain = htm = ""
    for p in _walk(payload):
        data = p.get("body", {}).get("data")
        if not data:
            continue
        t = base64.urlsafe_b64decode(data).decode("utf-8", "ignore")
        if p.get("mimeType") == "text/plain" and not plain:
            plain = t
        elif p.get("mimeType") == "text/html" and not htm:
            htm = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(htm or plain)).strip()


def fetch(inbox, log=print):
    svc = _service()
    new = 0
    for src, q in STATEMENTS.items():
        folder = inbox / "statements" / src
        folder.mkdir(parents=True, exist_ok=True)
        for mid in _ids(svc, "%s after:%s" % (q, SINCE)):
            if (folder / (mid + ".pdf")).exists():
                continue
            msg = svc.users().messages().get(userId="me", id=mid).execute()
            for p in _walk(msg["payload"]):
                if p.get("filename", "").lower().endswith(".pdf"):
                    a = svc.users().messages().attachments().get(
                        userId="me", messageId=mid, id=p["body"]["attachmentId"]).execute()
                    (folder / (mid + ".pdf")).write_bytes(base64.urlsafe_b64decode(a["data"]))
                    new += 1
                    break
    # Rapido receipts, emailed when the owner requests them in the app.
    folder = inbox / "rapido"
    folder.mkdir(parents=True, exist_ok=True)
    for mid in _ids(svc, "from:partner@rapido.bike has:attachment"):
        if any(folder.glob(mid + "_*")):
            continue
        msg = svc.users().messages().get(userId="me", id=mid).execute()
        for p in _walk(msg["payload"]):
            if p.get("filename", "").lower().endswith(".pdf"):
                a = svc.users().messages().attachments().get(
                    userId="me", messageId=mid, id=p["body"]["attachmentId"]).execute()
                (folder / ("%s_%s" % (mid, p["filename"].replace("/", "_")))).write_bytes(base64.urlsafe_b64decode(a["data"]))
                new += 1

    # Uber receipts: fare, payment method, times, both addresses.
    folder = inbox / "uber"
    folder.mkdir(parents=True, exist_ok=True)
    for mid in _ids(svc, 'from:uber.com subject:"trip with Uber" after:%s' % SINCE):
        path = folder / (mid + ".json")
        if path.exists():
            continue
        msg = svc.users().messages().get(userId="me", id=mid).execute()
        path.write_text(json.dumps({"id": mid, "ts": int(msg["internalDate"]), "text": _text(msg["payload"])}))
        new += 1

    folder = inbox / "alerts"
    folder.mkdir(parents=True, exist_ok=True)
    for src, q in ALERTS.items():
        for mid in _ids(svc, "%s after:%s" % (q, SINCE)):
            path = folder / (mid + ".json")
            if path.exists():
                continue
            msg = svc.users().messages().get(userId="me", id=mid).execute()
            path.write_text(json.dumps({"id": mid, "source": src, "ts": int(msg["internalDate"]),
                                        "text": _text(msg["payload"])}))
            new += 1
    log("gmail: %d new file(s)" % new)
    return new
