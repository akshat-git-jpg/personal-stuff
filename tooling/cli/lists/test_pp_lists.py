import json
import os
import subprocess
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import pp_lists  # noqa: E402

STATE = {
    "categories": [{"id": "c1", "name": "To buy", "position": 0, "created_at": 0},
                   {"id": "c2", "name": "Ideas", "position": 1, "created_at": 0}],
    "items": [{"id": "i1", "category_id": "c1", "text": "Charger", "position": 0, "created_at": 0},
              {"id": "i2", "category_id": "c1", "text": "Sunscreen", "position": 1, "created_at": 0}],
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _json(self, code, body, cookie=None):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if self.path == "/auth/login" and body.get("password") == "pw":
            self._json(200, {"ok": True}, "lists_session=abc.123; HttpOnly; Path=/")
        else:
            self._json(401, {"error": "Wrong password"})

    def do_GET(self):
        if self.path == "/api/state" and "lists_session=abc.123" in (self.headers.get("Cookie") or ""):
            self._json(200, STATE)
        else:
            self._json(401, {"error": "Unauthorized"})


class PpListsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.srv.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def run_cli(self, **env):
        e = {k: v for k, v in os.environ.items() if k != "LISTS_APP_PASSWORD"}
        e.update({"LISTS_URL": self.base, **env})
        return subprocess.run([sys.executable, str(HERE / "pp_lists.py"), "show"],
                              env=e, capture_output=True, text=True)

    def test_fetch_state(self):
        self.assertEqual(pp_lists.fetch_state(self.base, "pw"), STATE)

    def test_render_text(self):
        out = pp_lists.render_text(STATE)
        self.assertEqual(out, "## To buy\n- Charger\n- Sunscreen\n\n## Ideas\n(empty)")

    def test_cli_ok(self):
        r = self.run_cli(LISTS_APP_PASSWORD="pw")
        self.assertEqual(r.returncode, 0)
        self.assertIn("- Charger", r.stdout)

    def test_wrong_password(self):
        self.assertEqual(self.run_cli(LISTS_APP_PASSWORD="bad").returncode, 3)

    def test_no_password(self):
        self.assertEqual(self.run_cli(LISTS_SECRETS_FILE="/nonexistent/x.env").returncode, 2)


if __name__ == "__main__":
    unittest.main()
