import json
import subprocess
import time
import random
import sys
import hashlib
from urllib.parse import urlencode

SHOP = "https://shop.amul.com"
STORE_ID = "62fa94df8c13af2e242eba16"

BASE_HEADERS = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "en-US,en;q=0.9",
    "base_url": "https://shop.amul.com/en/browse/protein",
    "frontend": "1",
    "referer": "https://shop.amul.com/en/browse/protein",
    "user-agent": ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"),
}

class AmulError(RuntimeError):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status

def tid_header(session_tid: str) -> str:
    """Amul's anti-scrape header: ts:rand:sha256(store:ts:rand:session)."""
    ts = str(int(time.time() * 1000))
    rnd = str(int(1000 * random.random()))
    digest = hashlib.sha256(f"{STORE_ID}:{ts}:{rnd}:{session_tid}".encode()).hexdigest()
    return f"{ts}:{rnd}:{digest}"

def _curl(url, method="GET", extra_headers=None, body=None, jar_path=None):
    cmd = ["curl", "-s", "-S", "-L", "--globoff", "--compressed", "--connect-timeout", "10", "--max-time", "30"]
    if jar_path:
        cmd.extend(["-c", jar_path, "-b", jar_path])
    cmd.extend(["-X", method])
    
    headers = dict(BASE_HEADERS)
    if extra_headers:
        headers.update(extra_headers)
        
    for k, v in headers.items():
        cmd.extend(["-H", f"{k}: {v}"])
        
    if body:
        cmd.extend(["-d", body])
        if "content-type" not in [k.lower() for k in headers.keys()]:
            cmd.extend(["-H", "Content-Type: application/json"])
            
    cmd.extend(["-w", "\n__STATUS__%{http_code}", url])
    
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise AmulError(f"curl failed: {res.stderr}")
        
    parts = res.stdout.rsplit("\n__STATUS__", 1)
    if len(parts) == 2:
        out_body, status_str = parts
        status_int = int(status_str)
    else:
        out_body = res.stdout
        status_int = 0
        
    return out_body, status_int

def _session_tid(jar_path):
    # Step 1
    _curl(f"{SHOP}/en/browse/protein", jar_path=jar_path)
    # Step 2
    epoch_ms = int(time.time() * 1000)
    body, status = _curl(f"{SHOP}/user/info.js?_v={epoch_ms}", jar_path=jar_path)
    if status >= 400:
        raise AmulError(f"Step 2 failed", status)
    
    body = body.strip()
    prefix = "session = "
    if body.startswith(prefix):
        body = body[len(prefix):]
    
    try:
        data = json.loads(body)
    except Exception as e:
        raise AmulError(f"JSON parse error in session info: {e}")
        
    tid = data.get("tid")
    if not tid:
        raise AmulError("no tid in session info")
    return tid

def _resolve_substore(pincode, tid, jar_path):
    import urllib.parse
    qs = urllib.parse.urlencode({
        "limit": "50",
        "filters[0][field]": "pincode",
        "filters[0][value]": pincode,
        "filters[0][operator]": "regex",
        "cf_cache": "1h"
    })
    qs = qs.replace("%5B", "[").replace("%5D", "]")
    url = f"{SHOP}/entity/pincode?{qs}"
    
    headers = {"tid": tid_header(tid)}
    body, status = _curl(url, extra_headers=headers, jar_path=jar_path)
    if status >= 400:
        raise AmulError(f"Step 3 failed", status)
        
    try:
        data = json.loads(body)
    except Exception as e:
        raise AmulError(f"JSON parse error in pincode res: {e}")
        
    records = []
    if isinstance(data, dict):
        if isinstance(data.get("data"), dict) and "records" in data["data"]:
            records = data["data"]["records"]
        elif isinstance(data.get("data"), list):
            records = data["data"]
        elif "records" in data:
            records = data["records"]
        elif isinstance(data, list):
            records = data
            
    if not records or not isinstance(records, list):
        print(f"DEBUG: pincode response data: {data}", file=sys.stderr)
        raise AmulError(f"no pincode record for {pincode}")
        
    if not isinstance(records[0], dict) or "substore" not in records[0]:
        raise AmulError(f"no pincode record for {pincode}")
        
    return records[0]["substore"]

def _set_store(substore, tid, jar_path):
    headers = {"tid": tid_header(tid)}
    body_data = json.dumps({"data": {"store": substore}})
    body, status = _curl(f"{SHOP}/entity/ms.settings/_/setPreferences", method="PUT", extra_headers=headers, body=body_data, jar_path=jar_path)
    if status >= 400:
        raise AmulError(f"Step 4 failed", status)

def _store_version(jar_path):
    body, status = _curl(f"{SHOP}/ms/store/amul/auto/EN/storeinfo.js", jar_path=jar_path)
    if status >= 400:
        raise AmulError(f"Step 5 failed", status)
        
    import re
    m = re.search(r"req\.query\.v\s*=\s*['\"]?([^'\";\s]+)", body)
    if m:
        return m.group(1)
    
    import sys
    print("Warning: no regex match for store version, falling back to '6'", file=sys.stderr)
    return "6"

def fetch_products(pincode: str, jar_path: str) -> tuple[str, list[dict]]:
    """Run the 6-step bootstrap and return (substore, products).

    Each product dict carries at least: sku, name, price, available,
    inventory_quantity.
    Raises AmulError on any non-2xx or unparseable response.
    """
    tid = _session_tid(jar_path)
    substore = _resolve_substore(pincode, tid, jar_path)
    _set_store(substore, tid, jar_path)
    store_version = _store_version(jar_path)
    
    params = [
        ("fields[name]", "1"), ("fields[sku]", "1"), ("fields[alias]", "1"),
        ("fields[price]", "1"), ("fields[available]", "1"),
        ("fields[inventory_quantity]", "1"), ("fields[categories]", "1"),
        ("filters[0][field]", "categories"),
        ("filters[0][value][0]", "protein"),
        ("filters[0][operator]", "in"),
        ("filters[0][original]", "1"),
        ("limit", "100"), ("total", "1"), ("start", "0"),
        ("v", store_version), ("device_type", "other"),
    ]
    query = urlencode(params).replace("%5B", "[").replace("%5D", "]")
    
    url = f"{SHOP}/api/1/entity/ms.products?{query}"
    headers = {"tid": tid_header(tid)}
    
    body, status = _curl(url, extra_headers=headers, jar_path=jar_path)
    if status >= 400:
        raise AmulError(f"Step 6 failed", status)
        
    try:
        data = json.loads(body)
    except Exception as e:
        raise AmulError(f"JSON parse error in products res: {e}")
        
    if "data" not in data or not isinstance(data["data"], list):
        raise AmulError("data is not a list in products response")
        
    return substore, data["data"]
