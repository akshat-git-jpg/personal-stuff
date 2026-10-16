"""pp-lists - read-only reader for lists.agrolloo.com (apps/lists-app).

Logs in with the app password the same way the browser does, then prints every list.

  show [--format text|json]

Exit codes: 2 no password, 3 login failed, 4 fetch failed.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]  # tooling/cli/lists -> repo root
COOKIE = "lists_session"


def die(msg: str, code: int) -> None:
    print(msg, file=sys.stderr)
    sys.exit(code)


def read_password() -> str:
    pw = os.environ.get("LISTS_APP_PASSWORD")
    if pw is None:
        f = Path(os.environ.get("LISTS_SECRETS_FILE") or REPO_ROOT / "infra/secrets/lists-app.env")
        if f.exists():
            for line in f.read_text().splitlines():
                if line.startswith("LISTS_APP_PASSWORD="):
                    pw = line.split("=", 1)[1]
    pw = (pw or "").strip()
    if not pw:
        die("no lists password: copy infra/secrets/lists-app.env.example to "
            "infra/secrets/lists-app.env and fill it", 2)
    return pw


def fetch_state(base: str, password: str) -> dict:
    req = urllib.request.Request(
        f"{base}/auth/login", data=json.dumps({"password": password}).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            cookies = resp.headers.get_all("Set-Cookie") or []
    except urllib.error.HTTPError as e:
        die("lists login failed: wrong password" if e.code == 401 else f"lists login failed: HTTP {e.code}", 3)
    except urllib.error.URLError as e:
        die(f"lists login failed: {e.reason}", 3)
    session = next((c.split(";", 1)[0] for c in cookies if c.startswith(f"{COOKIE}=")), None)
    if not session:
        die("lists login failed: no session cookie in response", 3)

    req = urllib.request.Request(f"{base}/api/state", headers={"Cookie": session})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read())
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        die(f"lists fetch failed: {e}", 4)
    return {}


def render_text(state: dict) -> str:
    cats = state.get("categories", [])
    if not cats:
        return "No lists."
    blocks = []
    for cat in cats:
        items = [i["text"] for i in state.get("items", []) if i["category_id"] == cat["id"]]
        lines = [f"## {cat['name']}"] + ([f"- {t}" for t in items] or ["(empty)"])
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def main() -> None:
    p = argparse.ArgumentParser(prog="pp-lists", description="Read lists.agrolloo.com (read-only)")
    sub = p.add_subparsers(dest="cmd", required=True)
    show = sub.add_parser("show", help="print every list")
    show.add_argument("--format", choices=["text", "json"], default="text")
    a = p.parse_args()

    base = os.environ.get("LISTS_URL", "https://lists.agrolloo.com").rstrip("/")
    state = fetch_state(base, read_password())
    print(json.dumps(state, indent=2) if a.format == "json" else render_text(state))


if __name__ == "__main__":
    main()
