#!/usr/bin/env python3
"""Pull the PDF attachments out of a Gmail message fetched with get_message(messageFormat=RAW).

The Gmail MCP saves a large RAW result to a JSON file ({"raw": "<base64url MIME>", ...}).
Run with python3 -I:

  raw-to-pdf.py <saved-result.json> <out-dir>            payslip: saves <out-dir>/YYYY-MM.pdf
  raw-to-pdf.py <saved-result.json> <out-dir> --keep-name letter: saves under its own file name

A payslip's month comes from its "Payslip: Mon YYYY" line (pdftotext), never from the mail date.
Prints one saved path per line. Exit 1 if the message has no PDF attachment.
"""
import base64
import email
import json
import re
import subprocess
import sys
from email import policy
from pathlib import Path

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def payslip_month(pdf: Path) -> str | None:
    text = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True).stdout
    m = re.search(r"Payslip:\s*([A-Z][a-z]{2})\s+(\d{4})", text)
    return f"{m.group(2)}-{MONTHS.index(m.group(1)) + 1:02d}" if m else None


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    keep = "--keep-name" in sys.argv[3:]
    raw = json.loads(src.read_text())["raw"]
    msg = email.message_from_bytes(base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)), policy=policy.default)
    out.mkdir(parents=True, exist_ok=True)
    saved = 0
    for part in msg.iter_attachments():
        name = part.get_filename() or ""
        if not name.lower().endswith(".pdf"):
            continue
        tmp = out / ("." + Path(name).name)
        tmp.write_bytes(part.get_content())
        if keep:
            dest = out / Path(name).name
        else:
            month = payslip_month(tmp)
            if not month:
                print(f"not a payslip: {name}", file=sys.stderr)
                tmp.unlink()
                continue
            dest = out / f"{month}.pdf"
        tmp.replace(dest)
        print(dest)
        saved += 1
    return 0 if saved else 1


if __name__ == "__main__":
    sys.exit(main())
