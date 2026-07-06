#!/usr/bin/env python3
"""yt-claude relay.

Tiny localhost HTTP server. The Tampermonkey userscript POSTs a batch of
YouTube watch URLs to /queue; for each URL the relay fetches the transcript
(via pp-yt-transcript, which must run on a residential IP) and opens a live
`claude` session in its own window of a dedicated tmux session named `yt`.

No external deps — stdlib only. Run via `yt-claude serve` (see the wrapper).
"""
from __future__ import annotations

import json
import os
import re
import secrets
import subprocess
import sys
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(os.environ.get("YT_CLAUDE_PORT", "7777"))
RELAY_TOKEN = secrets.token_urlsafe(32)
BASE_DIR = Path(os.environ.get("YT_CLAUDE_DIR", str(Path.home() / "yt-claude")))
# Where each video opens:
#   "terminal" -> a new macOS Terminal window (open -a Terminal)
#   an IDE name -> a new integrated terminal tab inside a VS Code-family editor
#                  (via the yt-claude extension that watches BASE_DIR/pending/).
#                  "antigravity" is the current default IDE; "cursor"/"editor"/
#                  "ide"/"vscode"/"code" all resolve to the same job-file drop,
#                  since every fork runs the same extension.
TARGET = os.environ.get("YT_CLAUDE_TARGET", "terminal")
IDE_TARGETS = {"antigravity", "cursor", "editor", "ide", "vscode", "code"}
PENDING_DIR = BASE_DIR / "pending"
# macOS terminal app to open each video in (one new window per video).
TERMINAL_APP = os.environ.get("YT_CLAUDE_TERMINAL", "Terminal")
# The command run per video window. Override for testing (e.g. YT_CLAUDE_CMD=echo)
# so plumbing can be verified without a real TUI.
LAUNCH_CMD = os.environ.get("YT_CLAUDE_CMD", "claude")
# Flags appended to LAUNCH_CMD. Default starts each session in bypass-permissions
# mode (no per-action approval prompts) so the summary runs hands-free. These are
# throwaway per-video summary dirs, so the usual caution is low-stakes here. Set
# YT_CLAUDE_FLAGS="" to get the normal prompting session back.
LAUNCH_FLAGS = os.environ.get("YT_CLAUDE_FLAGS", "--dangerously-skip-permissions")
MANIFEST = "index.log"  # appended per opened video, under BASE_DIR

# pp-yt-transcript lives alongside this repo; resolve it relative to this file.
REPO_ROOT = Path(__file__).resolve().parents[2]
TRANSCRIPT_PY = REPO_ROOT / "cli" / "youtube" / "pp_yt_transcript.py"


def detect_python() -> str:
    """Find a python3 that can import youtube_transcript_api.

    Ambient `python3` is unreliable under launchd (Homebrew's python lacks the
    module; it lives in the Framework python). Probe candidates and pick the
    first that actually has the dependency.
    """
    import glob as _glob
    candidates = []
    venv = REPO_ROOT / "mcp" / ".venv" / "bin" / "python3"
    if venv.exists():
        candidates.append(str(venv))
    candidates += ["python3", "/usr/bin/python3"]
    candidates += sorted(
        _glob.glob("/Library/Frameworks/Python.framework/Versions/*/bin/python3"),
        reverse=True,
    )
    for c in candidates:
        try:
            r = subprocess.run([c, "-c", "import youtube_transcript_api"],
                               capture_output=True, timeout=10)
            if r.returncode == 0:
                return c
        except Exception:
            pass
    return "python3"


PYTHON = detect_python()


def log(*a):
    print("[yt-claude]", *a, file=sys.stderr, flush=True)


def video_id(url: str) -> str | None:
    m = re.search(r"(?:v=|youtu\.be/|/shorts/|/embed/)([0-9A-Za-z_-]{11})", url)
    if m:
        return m.group(1)
    if re.fullmatch(r"[0-9A-Za-z_-]{11}", url.strip()):
        return url.strip()
    return None


def fetch_title(url: str) -> str:
    """Keyless title via YouTube's oembed endpoint."""
    try:
        oe = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(url, safe="")
        with urllib.request.urlopen(oe, timeout=10) as r:
            return json.load(r).get("title", "video")
    except Exception as e:
        log("oembed failed:", e)
        return "video"


def fetch_transcript(url: str, dest: Path) -> bool:
    try:
        out = subprocess.run(
            [PYTHON, str(TRANSCRIPT_PY), "get", url],
            capture_output=True, text=True, timeout=120,
        )
        if out.returncode == 0 and out.stdout.strip():
            dest.write_text(out.stdout)
            return True
        log("transcript empty/failed:", out.stderr.strip()[:200])
    except Exception as e:
        log("transcript error:", e)
    return False


def open_window(url: str):
    vid = video_id(url)
    if not vid:
        log("skip, no video id:", url)
        return False
    title = fetch_title(url)
    vdir = BASE_DIR / vid
    vdir.mkdir(parents=True, exist_ok=True)

    transcript_path = vdir / "transcript.txt"
    have_transcript = fetch_transcript(url, transcript_path)

    if have_transcript:
        prompt = (
            f"You are summarizing a YouTube video.\n"
            f"Title: {title}\nURL: {url}\n\n"
            f"The full transcript is at {transcript_path}. "
            f"Read it, then give me: a 2-3 sentence TL;DR, the key points as "
            f"bullets, and any notable timestamps. Then wait for my follow-ups."
        )
    else:
        prompt = (
            f"You are summarizing a YouTube video.\n"
            f"Title: {title}\nURL: {url}\n\n"
            f"No transcript file was saved (captions may be unavailable). "
            f"Try the get_video_transcript MCP tool for this URL; if that also "
            f"fails, tell me so. Otherwise give a TL;DR + key points, then wait."
        )
    prompt_path = vdir / "prompt.txt"
    prompt_path.write_text(prompt)

    # IMPORTANT: run every session from the SAME fixed dir (BASE_DIR) so Claude
    # Code's "trust this folder" gate only appears once, not per video. The
    # per-video transcript/prompt live in subdirs, referenced by absolute path.
    win_title = "yt: " + title
    launch = f"{LAUNCH_CMD} {LAUNCH_FLAGS}".strip()
    run_cmd = f'{launch} "$(cat {shquote(str(prompt_path))})"'

    # .command script for the Terminal-window target. `zsh -il` (interactive
    # login) so the user's `claude` (claude-work) alias + env resolve. `open`
    # avoids the macOS automation-permission prompt AppleScript would trigger.
    script = (
        "#!/bin/zsh -il\n"
        f"printf '\\033]0;%s\\007' {shquote(win_title)}\n"
        f"cd {shquote(str(BASE_DIR))}\n"
        f"{run_cmd}\n"
        "exec zsh -il\n"
    )
    cmd_path = vdir / "run.command"
    cmd_path.write_text(script)
    cmd_path.chmod(0o755)

    if TARGET in IDE_TARGETS:
        # Drop a job file for the IDE extension to open as an integrated tab.
        PENDING_DIR.mkdir(parents=True, exist_ok=True)
        job = {
            "id": vid,
            "name": win_title,
            "cwd": str(BASE_DIR),
            "cmd": run_cmd,
        }
        # Write atomically: the extension polls this dir, so it must never see
        # a half-written file. Temp name (not *.json) then rename into place.
        tmp = PENDING_DIR / f".{vid}.json.tmp"
        tmp.write_text(json.dumps(job))
        tmp.rename(PENDING_DIR / f"{vid}.json")
        dest = f"{TARGET} tab"
    else:
        subprocess.run(["open", "-a", TERMINAL_APP, str(cmd_path)], check=True)
        dest = f"{TERMINAL_APP} window"

    with (BASE_DIR / MANIFEST).open("a") as f:
        f.write(f"{vid}\t{title}\t{url}\n")

    log(f"opened {dest} for {vid} ({'transcript' if have_transcript else 'no transcript'}): {title}")
    return True


def shquote(s: str) -> str:
    return "'" + s.replace("'", "'\\''") + "'"


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/token":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"token": RELAY_TOKEN}).encode())
            return

        # health check
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"ok":true,"service":"yt-claude"}')

    def do_POST(self):
        if self.path.rstrip("/") != "/queue":
            self.send_response(404); self._cors(); self.end_headers(); return

        token = self.headers.get("X-Relay-Token")
        if not token or token != RELAY_TOKEN:
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b'{"error":"forbidden"}')
            return

        length = int(self.headers.get("Content-Length", 0))
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
            urls = body.get("urls", [])
            assert isinstance(urls, list)
        except Exception:
            self.send_response(400); self._cors(); self.end_headers()
            self.wfile.write(b'{"error":"bad body"}'); return

        opened = 0
        for u in urls:
            try:
                if open_window(u):
                    opened += 1
            except Exception as e:
                log("open_window failed:", e)

        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"opened": opened, "requested": len(urls)}).encode())

    def log_message(self, *a):  # silence default access logging
        pass


def main():
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    log(f"listening on http://127.0.0.1:{PORT}  (target: {TARGET}, dir: {BASE_DIR})")
    log(f"transcript python: {PYTHON}")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
