#!/usr/bin/env python3
"""Self-test for inbox: runs the CLI against a stub Bot API server. No network."""
import http.server
import json
import os
import subprocess
import sys
import tempfile
import threading
import urllib.parse

HERE = os.path.dirname(os.path.realpath(__file__))
CLI = os.path.join(HERE, "inbox")
CHAT = 42
BIG = 21 * 1024 * 1024

UPDATES = [
    {"update_id": 10, "message": {"chat": {"id": CHAT, "type": "private"}, "date": 1760000000, "text": "hello mac"}},
    {"update_id": 11, "message": {"chat": {"id": CHAT, "type": "private"}, "date": 1760000001,
                                  "document": {"file_id": "doc1", "file_size": 5, "file_name": "report.pdf"}}},
    {"update_id": 12, "message": {"chat": {"id": CHAT, "type": "private"}, "date": 1760000002, "caption": "pic note",
                                  "photo": [{"file_id": "small", "file_size": 1}, {"file_id": "big", "file_size": 3}]}},
    {"update_id": 13, "message": {"chat": {"id": 999, "type": "private"}, "date": 1760000003, "text": "stranger"}},
    {"update_id": 14, "message": {"chat": {"id": CHAT, "type": "private"}, "date": 1760000004,
                                  "video": {"file_id": "huge", "file_size": BIG}}},
]
FILES = {"doc1": b"%PDF!", "big": b"JPG"}
sent = []


class Stub(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def reply(self, obj):
        body = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = dict(urllib.parse.parse_qsl(u.query))
        if u.path.startswith("/file/"):
            data = FILES[u.path.rsplit("/", 1)[1]]
            self.send_response(200)
            self.end_headers()
            self.wfile.write(data)
        elif u.path.endswith("/getUpdates"):
            off = int(q.get("offset", 0))
            self.reply({"ok": True, "result": [x for x in UPDATES if x["update_id"] >= off]})
        elif u.path.endswith("/getFile"):
            self.reply({"ok": True, "result": {"file_path": f"x/{q['file_id']}"}})
        else:
            self.reply({"ok": False, "description": "unknown"})

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(n)
        sent.append((self.path.rsplit("/", 1)[1], body))
        self.reply({"ok": True, "result": {}})


def run(env, *args):
    return subprocess.run([sys.executable, CLI, *args], env=env, capture_output=True, text=True)


def main():
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Stub)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    tmp = tempfile.mkdtemp()
    envf = os.path.join(tmp, "telegram.env")
    with open(envf, "w") as f:
        f.write("TELEGRAM_BOT_TOKEN=main\nTELEGRAM_INBOX_BOT_TOKEN=t\n")
    env = dict(os.environ, INBOX_ENV_FILE=envf, INBOX_STATE_DIR=os.path.join(tmp, "state"),
               INBOX_DIR=os.path.join(tmp, "out"), INBOX_NOTIFY="0", INBOX_API_BASE=f"http://127.0.0.1:{srv.server_port}")
    fails = []

    def check(cond, name):
        print(("PASS " if cond else "FAIL ") + name)
        if not cond:
            fails.append(name)

    r = run(env, "pull")
    check(r.returncode == 1 and "inbox setup" in r.stderr, "pull without chat id asks for setup")

    r = run(env, "setup")
    check(r.returncode == 0 and "TELEGRAM_INBOX_CHAT_ID=42" in open(envf).read(), "setup saves chat id")
    check("TELEGRAM_BOT_TOKEN=main" in open(envf).read(), "setup keeps other keys")

    r = run(env, "pull")
    out = os.path.join(tmp, "out")
    names = sorted(os.listdir(out))
    check(r.returncode == 0, "pull exits 0")
    check(open(os.path.join(out, "report.pdf"), "rb").read() == b"%PDF!", "document saved with its name")
    photos = [n for n in names if n.endswith("_photo.jpg")]
    check(len(photos) == 1 and open(os.path.join(out, photos[0]), "rb").read() == b"JPG", "largest photo saved")
    notes = [open(os.path.join(out, n)).read() for n in names if n.endswith("_note.txt")]
    check(sorted(notes) == ["hello mac\n", "pic note\n"], "text and caption saved as notes")
    check(not any("stranger" in n for n in notes), "other chats ignored")
    check("SKIP" in r.stdout and "1 skipped" in r.stderr, "over-20MB file reported, not downloaded")
    check(json.load(open(os.path.join(tmp, "state", "offset.json")))["offset"] == 15, "offset advanced")

    r = run(env, "pull")
    check(r.returncode == 0 and len(os.listdir(out)) == len(names), "second pull saves nothing new")

    f = os.path.join(tmp, "a.txt")
    open(f, "w").write("payload")
    r = run(env, "send", f, "a message")
    check(r.returncode == 0, "send exits 0")
    check(sent[0][0] == "sendDocument" and b"payload" in sent[0][1] and b'filename="a.txt"' in sent[0][1], "file sent as document")
    check(sent[1][0] == "sendMessage" and b"a+message" in sent[1][1], "text sent as message")

    r = run(env, "send", tmp)
    check(r.returncode == 1 and "Zip it" in r.stderr, "folder refused")

    r = run(env, "bogus")
    check(r.returncode == 2, "bad command exits 2")

    srv.shutdown()
    print(f"\n{len(fails)} failed" if fails else "\nall passed")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
