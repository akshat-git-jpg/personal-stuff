import argparse
import json
import os
import random
import subprocess
import sys
import time

import amul_api

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

def is_available(product: dict) -> bool:
    """Amul's own flag is authoritative; quantity alone is not enough."""
    return bool(product.get("available") == 1 and (product.get("inventory_quantity") or 0) > 0)

def transitions(prev: dict, curr: dict, tracked: list) -> list:
    """SKUs that flipped unavailable -> available since the previous poll.

    An SKU absent from `prev` defaults to True (treated as already-available), so a
    first run, a newly added SKU, and a wiped state file all stay silent instead of
    firing a backlog of alerts.
    """
    fired = []
    for sku in tracked:
        was = prev.get(sku, True)
        now = curr.get(sku, False)
        if now and not was:
            fired.append(sku)
    return fired

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--pincode", type=str)
    parser.add_argument("--config", type=str, default="config.json")
    parser.add_argument("--state", type=str, default="state.json")
    args = parser.parse_args()
    
    if not args.once:
        sys.exit(0)
        
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    config_path = args.config
    if not os.path.isabs(config_path):
        config_path = os.path.join(script_dir, config_path)
        
    state_path = args.state
    if not os.path.isabs(state_path):
        state_path = os.path.join(script_dir, state_path)
        
    jar_path = os.path.join(script_dir, "cookies.txt")
        
    with open(config_path, "r") as f:
        config = json.load(f)
        
    pincode = args.pincode or config["pincode"]
    
    jitter = config.get("poll_jitter_seconds", 0)
    if jitter > 0 and not args.dry_run:
        time.sleep(random.uniform(0, jitter))
        
    substore, products = amul_api.fetch_products(pincode, jar_path)
    
    curr = {p["sku"]: is_available(p) for p in products}
    
    if config.get("track_all_available"):
        tracked = list(curr.keys())
    else:
        tracked = config.get("track", [])
        
    if os.path.exists(state_path):
        with open(state_path, "r") as f:
            state = json.load(f)
    else:
        state = {}
        
    prev = state.get(substore, {})
    
    fired = transitions(prev, curr, tracked)
    
    if args.dry_run:
        for p in products:
            sku = p["sku"]
            avail = 1 if is_available(p) else 0
            qty = p.get("inventory_quantity") or 0
            name = p.get("name", "")
            print(f"avail={avail} qty={qty}  {sku}  {name}")
        print(f"would notify: {fired}")
        sys.exit(0)
        
    notify_bin = os.environ.get("AMUL_WATCH_NOTIFY", os.path.join(REPO_ROOT, "tooling", "cli", "notify", "notify"))
    
    for sku in fired:
        p = next((prod for prod in products if prod["sku"] == sku), None)
        if not p: continue
        
        message = (
            f"🥛 IN STOCK — {p.get('name')}\n"
            f"₹{p.get('price')}  ·  qty {p.get('inventory_quantity') or 0}\n"
            f"https://shop.amul.com/en/product/{p.get('alias')}"
        )
        
        res = subprocess.run([notify_bin, "send", message], capture_output=True, text=True)
        if res.returncode != 0:
            print(f"WARN: notify failed for {sku}: exit {res.returncode}. {res.stderr}", file=sys.stderr)
            
    state[substore] = curr
    
    tmp_path = state_path + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(state, f)
    os.replace(tmp_path, state_path)

if __name__ == "__main__":
    main()
