#!/usr/bin/env python3
# Minimal static server WITH HTTP Range support (needed for video scrubbing)
# + a POST /feedback endpoint so the reviewer can write notes to disk for Claude to read.
import http.server, socketserver, os, re, functools, json

class RangeHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        # reviewer syncs notes here -> Claude reads feedback_latest.txt when Luuk says "feedback done"
        if self.path.rstrip('/') != '/feedback':
            self.send_response(404); self.end_headers(); return
        try:
            n = int(self.headers.get('Content-Length') or 0)
            data = json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            self.send_response(400); self.end_headers(); return
        label = re.sub(r'[^A-Za-z0-9._-]', '_', str(data.get('label') or 'latest'))
        text = str(data.get('text') or '')
        for base in (f'feedback_{label}', 'feedback_latest'):   # per-version + a stable "newest" pointer
            try:
                open(base + '.txt', 'w', encoding="utf-8").write(text)
                json.dump(data, open(base + '.json', 'w', encoding="utf-8"), indent=1)
            except Exception:
                pass
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers()
        self.wfile.write(b'{"ok":true}')

    def do_GET(self):
        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().do_GET()
        rng = self.headers.get('Range')
        size = os.path.getsize(path)
        ctype = self.guess_type(path)
        if not rng:
            self.send_response(200)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(size))
            self.send_header('Accept-Ranges', 'bytes')
            self.end_headers()
            with open(path, 'rb') as f:
                self.copyfile(f, self.wfile)
            return
        m = re.match(r'bytes=(\d*)-(\d*)', rng)
        start = int(m.group(1)) if m.group(1) else 0
        end = int(m.group(2)) if m.group(2) else size - 1
        end = min(end, size - 1)
        length = end - start + 1
        self.send_response(206)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(length))
        self.end_headers()
        with open(path, 'rb') as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(65536, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return
                remaining -= len(chunk)

    def log_message(self, *a):
        pass  # quiet

if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    class TCP(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
    with TCP(('127.0.0.1', __PORT__), RangeHandler) as httpd:
        print('serving video-review on http://127.0.0.1:__PORT__')
        httpd.serve_forever()
