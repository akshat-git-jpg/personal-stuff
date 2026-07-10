#!/usr/bin/env python3
"""Verify every Google OAuth refresh token still refreshes.

Silent token death is this repo's #1 automation killer (a vendored token
failed daily for 5+ weeks, decisions.md 2026-07-06). This probe POSTs a
refresh_token grant for each token file and reports OK / DEAD / ERROR.
It never writes anything: refreshing does not rotate the refresh token.

Usage:
  cred_probe.py                       # probe default dir (repo tokens/)
  cred_probe.py --extra /path/t.json  # also probe an extra token file
  cred_probe.py --self-test           # offline logic check, no network
Exit: 0 all OK, 1 any DEAD/ERROR, 2 usage/self-test failure.
"""

import argparse
import json
import pathlib
import sys
import urllib.request
import urllib.parse
import urllib.error

def find_tokens(dirs: list[pathlib.Path], extras: list[pathlib.Path]) -> list[pathlib.Path]:
    results = []
    for d in dirs:
        if d.is_dir():
            for p in d.glob('*.json'):
                results.append(p)
    results.extend(extras)
    
    valid_tokens = []
    for p in results:
        try:
            with open(p, 'r') as f:
                data = json.load(f)
            if 'refresh_token' in data:
                valid_tokens.append(p)
            else:
                print(f"SKIP {p.stem}")
        except Exception:
            print(f"SKIP {p.stem}")
    return valid_tokens

def build_refresh_body(tok: dict) -> bytes:
    data = {
        'client_id': tok.get('client_id', ''),
        'client_secret': tok.get('client_secret', ''),
        'refresh_token': tok.get('refresh_token', ''),
        'grant_type': 'refresh_token'
    }
    return urllib.parse.urlencode(data).encode('utf-8')

def classify(status: int, body: str) -> str:
    if status == 200 and "access_token" in body:
        return "OK"
    if 400 <= status < 500 and "invalid_grant" in body:
        return "DEAD"
    return "ERROR"

def probe(path: pathlib.Path) -> tuple[str, str]:
    try:
        with open(path, 'r') as f:
            tok = json.load(f)
    except Exception as e:
        return "ERROR", str(e)
    
    body = build_refresh_body(tok)
    req = urllib.request.Request('https://oauth2.googleapis.com/token', data=body, method='POST')
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            resp_body = response.read().decode('utf-8')
            status = response.status
            return classify(status, resp_body), ""
    except urllib.error.HTTPError as e:
        try:
            resp_body = e.read().decode('utf-8')
        except Exception:
            resp_body = ""
        return classify(e.code, resp_body), resp_body
    except Exception as e:
        return "ERROR", str(e)

def self_test():
    assert classify(200, '{"access_token":"x"}') == "OK"
    assert classify(400, '{"error":"invalid_grant"}') == "DEAD"
    assert classify(500, '') == "ERROR"
    assert classify(200, '{}') == "ERROR"
    
    body_bytes = build_refresh_body({"client_id":"a","client_secret":"b","refresh_token":"c"})
    body_str = body_bytes.decode('utf-8')
    assert 'grant_type=refresh_token' in body_str
    assert 'client_id=a' in body_str
    assert 'client_secret=b' in body_str
    assert 'refresh_token=c' in body_str
    
    # Check that a dict without refresh_token is skipped by the qualify check.
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        tp = pathlib.Path(td)
        with open(tp / "good.json", "w") as f:
            json.dump({"refresh_token": "foo"}, f)
        with open(tp / "bad.json", "w") as f:
            json.dump({"other": "foo"}, f)
        found = find_tokens([tp], [])
        assert len(found) == 1
        assert found[0].name == "good.json"
        
    print("self-test ok")
    sys.exit(0)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--extra', action='append', default=[])
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()

    if args.self_test:
        self_test()

    repo_root = pathlib.Path(__file__).resolve().parents[2]
    default_dir = repo_root / "tooling" / "mcp" / "google-shared" / "tokens"
    
    dirs = [default_dir] if default_dir.is_dir() else []
    extras = [pathlib.Path(e) for e in args.extra]
    
    tokens = find_tokens(dirs, extras)
    
    has_error_or_dead = False
    
    for t in tokens:
        status, detail = probe(t)
        if status == "OK":
            print(f"OK {t.stem}")
        elif status == "DEAD":
            print(f"DEAD {t.stem} {detail[:100]}")
            has_error_or_dead = True
        else:
            print(f"ERROR {t.stem} {detail[:100]}")
            has_error_or_dead = True
            
    if has_error_or_dead:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == '__main__':
    main()
