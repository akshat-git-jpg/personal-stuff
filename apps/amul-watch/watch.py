import argparse
import json
import os
import random
import secrets
import subprocess
import sys
import time

import amul_api
import amul_cart
import amul_login
import telegram

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

def acquire_lock(lock_path, stale_after_s=600):
    """O_CREAT|O_EXCL lock; a lock older than stale_after_s is treated as abandoned."""
    now = time.time()
    if os.path.exists(lock_path):
        try:
            mtime = os.path.getmtime(lock_path)
        except OSError:
            mtime = now
        if now - mtime >= stale_after_s:
            try:
                os.remove(lock_path)
            except OSError:
                pass
    try:
        fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        with os.fdopen(fd, "w") as f:
            f.write(str(os.getpid()))
        return True
    except FileExistsError:
        return False

def release_lock(lock_path):
    try:
        os.remove(lock_path)
    except OSError:
        pass

def restock_caption(product):
    return (
        f"🥛 IN STOCK — {product.get('name')}\n"
        f"₹{product.get('price')}  ·  qty {product.get('inventory_quantity') or 0}\n"
        f"https://shop.amul.com/en/product/{product.get('alias')}"
    )

def product_photo_url(product):
    images = product.get("images") or []
    if images and isinstance(images[0], dict) and images[0].get("image"):
        return amul_cart.image_url(images[0]["image"])
    return None

def handle_assist_restock(sku, product, assist_cfg, pincode, session_path, carts_log_path,
                           offset_file, cart_jar_path):
    """Send the rich alert, wait briefly for a tap, then run the approval gate.

    Session death must never cost the owner the alert itself — that check
    happens first, and the alert always goes out either way.
    """
    caption = restock_caption(product)
    photo = product_photo_url(product)
    token = os.environ.get("AMUL_WATCH_TEST_TOKEN") or secrets.token_hex(8)

    status, session = amul_cart.session_status(
        session_path, assist_cfg.get("relogin_after_days", 6)
    )

    if status == "dead":
        telegram.send_photo_with_buttons(photo, caption, token, cart_label="⚠️ Session expired")
        telegram.send_text(
            "Amul session is not ready — the cart button on that alert won't work.\n"
            "Run `python3 apps/amul-watch/amul_login.py`, or wait for the next quiet tick, to renew it."
        )
        return

    message_id = telegram.send_photo_with_buttons(photo, caption, token)
    decision = telegram.wait_for_callback(
        token, assist_cfg.get("approval_timeout_seconds", 240), offset_file
    )
    approved = decision == "add"

    client = amul_cart.CartClient(
        session, pincode, cart_jar_path, carts_log_path, assist_cfg.get("address_id", "")
    )

    try:
        result, why = amul_cart.prepare_cart(
            sku, product.get("price"), assist_cfg, approved,
            amul_cart.carts_today(carts_log_path), client,
        )
    except amul_cart.SessionDeadError as e:
        telegram.edit_message(message_id, caption + "\n\n⚠️ session expired")
        telegram.send_text(f"Amul session expired mid-request: {e}\nReply with a fresh OTP when ready.")
        return
    except amul_cart.SoldOutError as e:
        telegram.edit_message(message_id, caption + "\n\n⚠️ sold out before it could be added")
        telegram.send_text(str(e))
        return
    except amul_cart.AddressAmbiguousError as e:
        ids = ", ".join(str(i) for i in e.address_ids)
        telegram.edit_message(message_id, caption + "\n\n⚠️ multiple addresses, none configured")
        telegram.send_text(f"Multiple saved addresses and none configured in assist.json: {ids}")
        return
    except amul_cart.CartError as e:
        telegram.edit_message(message_id, caption + f"\n\n⚠️ {e}")
        return

    if not approved:
        telegram.edit_message(message_id, caption + "\n\n(no action taken)")
        return

    if result is None:
        telegram.edit_message(message_id, caption + f"\n\n⚠️ {why}")
        return

    telegram.edit_message(message_id, caption + "\n\n✅ added to cart")
    telegram.send_text(
        f"{result['name']} is in your cart: {result['checkout_url']}\n"
        f"Nothing has been billed — open the link and check out yourself."
    )

def maybe_proactive_relogin(assist_cfg, session_path, cart_jar_path, offset_file):
    """On a quiet tick with no restock edge, renew an aging session early.

    Never runs when a restock just fired — the owner should never be asked
    for an OTP while a product is draining.
    """
    if not assist_cfg.get("enabled", False):
        return
    status, _ = amul_cart.session_status(session_path, assist_cfg.get("relogin_after_days", 6))
    if status != "aging":
        return
    relogin_cfg = dict(assist_cfg)
    relogin_cfg["otp_source"] = "telegram"
    try:
        amul_login.login(relogin_cfg, session_path, cart_jar_path, offset_file)
    except amul_login.LoginError as e:
        print(f"WARN: proactive re-login failed: {e}", file=sys.stderr)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--pincode", type=str)
    parser.add_argument("--config", type=str, default="config.json")
    parser.add_argument("--state", type=str, default="state.json")
    parser.add_argument("--assist", action="store_true")
    parser.add_argument("--assist-config", type=str, default="assist.json")
    parser.add_argument("--session-file", type=str, default=None)
    parser.add_argument("--carts-log", type=str, default="carts.json")
    parser.add_argument("--lock-file", type=str, default=".lock")
    parser.add_argument("--tg-offset-file", type=str, default=".tg_offset.json")
    parser.add_argument("--cart-jar", type=str, default=".amul-session.jar")
    args = parser.parse_args()

    if not args.once:
        sys.exit(0)

    script_dir = os.path.dirname(os.path.abspath(__file__))

    def resolve(path, base=script_dir):
        return path if os.path.isabs(path) else os.path.join(base, path)

    config_path = resolve(args.config)
    state_path = resolve(args.state)
    jar_path = os.path.join(script_dir, "cookies.txt")

    with open(config_path, "r") as f:
        config = json.load(f)

    assist_cfg = {"enabled": False}
    lock_path = None
    session_path = args.session_file or os.path.join(REPO_ROOT, "infra", "secrets", "amul-session.json")
    carts_log_path = resolve(args.carts_log)
    offset_file = resolve(args.tg_offset_file)
    cart_jar_path = resolve(args.cart_jar)

    if args.assist:
        assist_cfg = amul_cart.load_assist_config(resolve(args.assist_config))
        lock_path = resolve(args.lock_file)
        if not acquire_lock(lock_path):
            print("INFO: another amul-watch --assist run holds the lock, exiting quietly", file=sys.stderr)
            sys.exit(0)

    try:
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
            if not p:
                continue

            assist_eligible = (
                args.assist
                and assist_cfg.get("enabled", False)
                and sku in assist_cfg.get("allowlist", [])
            )

            if not assist_eligible:
                message = restock_caption(p)
                res = subprocess.run([notify_bin, "send", message], capture_output=True, text=True)
                if res.returncode != 0:
                    print(f"WARN: notify failed for {sku}: exit {res.returncode}. {res.stderr}", file=sys.stderr)
                continue

            handle_assist_restock(
                sku, p, assist_cfg, pincode, session_path, carts_log_path,
                offset_file, cart_jar_path,
            )

        state[substore] = curr

        tmp_path = state_path + ".tmp"
        with open(tmp_path, "w") as f:
            json.dump(state, f)
        os.replace(tmp_path, state_path)

        if args.assist and not fired:
            maybe_proactive_relogin(assist_cfg, session_path, cart_jar_path, offset_file)
    finally:
        if lock_path:
            release_lock(lock_path)

if __name__ == "__main__":
    main()
