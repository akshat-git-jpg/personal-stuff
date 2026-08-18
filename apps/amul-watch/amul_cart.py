"""Approve-to-cart: add an SKU to a real Amul cart, apply the saved address, hand
back a checkout link. Nothing here may reach a checkout-finalizing endpoint —
that boundary is the entire reason this plan exists, not an afterthought.
"""

import json
import os
import time
from datetime import datetime
from urllib.parse import quote, urlencode
from zoneinfo import ZoneInfo

import amul_api

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
KOLKATA = ZoneInfo("Asia/Kolkata")

STORE_ID = amul_api.STORE_ID


class CartError(RuntimeError):
    pass


class SessionDeadError(CartError):
    """The stored session is missing, malformed, or the server rejected it."""


class SoldOutError(CartError):
    pass


class AddressAmbiguousError(CartError):
    def __init__(self, message, address_ids):
        super().__init__(message)
        self.address_ids = address_ids


def image_url(image_path):
    """Amul returns some image paths already prefixed with s/<store>/ and some bare."""
    p = image_path.lstrip("/")
    if p.startswith("s/"):
        return f"{amul_api.SHOP}/{p}"
    return f"{amul_api.SHOP}/s/{STORE_ID}/{p}"


# --- session file: cookies + user_id + login timestamp, nothing else -------

def load_session(session_path):
    """A missing or malformed session is treated as dead, never as an error to crash on."""
    if not os.path.exists(session_path):
        return None
    try:
        with open(session_path) as f:
            data = json.load(f)
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    if "cookies" not in data or "user_id" not in data or "logged_in_at" not in data:
        return None
    if not isinstance(data.get("cookies"), dict):
        return None
    return data


def save_session(cookies, user_id, session_path):
    data = {"cookies": cookies, "user_id": user_id, "logged_in_at": time.time()}
    tmp = session_path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f)
    os.replace(tmp, session_path)
    return data


def session_age_days(session):
    return (time.time() - session["logged_in_at"]) / 86400.0


def session_status(session_path, relogin_after_days):
    """('dead', None) | ('aging', session) | ('ok', session).

    'dead' only means "unusable without a fresh login" (missing/malformed) —
    it is not a live check against Amul. A live 401 is handled separately by
    SessionDeadError at request time.
    """
    session = load_session(session_path)
    if session is None:
        return "dead", None
    if session_age_days(session) >= relogin_after_days:
        return "aging", session
    return "ok", session


# --- cookie jar <-> session file --------------------------------------------

def jar_cookies_to_dict(jar_path):
    """Parse a Netscape cookie jar (as written by curl -c) into {name: value}."""
    cookies = {}
    if not os.path.exists(jar_path):
        return cookies
    with open(jar_path) as f:
        for raw in f:
            line = raw.rstrip("\n")
            if not line:
                continue
            if line.startswith("#"):
                if line.startswith("#HttpOnly_"):
                    line = line[len("#HttpOnly_"):]
                else:
                    continue
            parts = line.split("\t")
            if len(parts) != 7:
                continue
            cookies[parts[5]] = parts[6]
    return cookies


def write_jar_from_session(session, jar_path):
    """Load the saved cookies into the curl cookie jar amul_api.py already reads."""
    far_future = int(time.time()) + 30 * 86400
    lines = ["# Netscape HTTP Cookie File\n"]
    for name, value in session.get("cookies", {}).items():
        lines.append(f"shop.amul.com\tFALSE\t/\tTRUE\t{far_future}\t{name}\t{value}\n")
    with open(jar_path, "w") as f:
        f.writelines(lines)


# --- the captured, authenticated cart flow ----------------------------------

def _dead_if_unauthenticated(body, status, step):
    if status == 401 or "AMUL_SESSION_UNAUTHENTICATED" in body:
        raise SessionDeadError(f"{step} rejected — session expired, reply with a fresh OTP")
    if status >= 400:
        raise CartError(f"{step} failed: HTTP {status}")


def fetch_authenticated_product(sku, pincode, jar_path):
    """Re-run 208's bootstrap on the logged-in jar, with seller/linked_product_id added.

    Never reuse the watcher's anonymous product dict for cart calls — the same
    SKU carries different seller/linked_product_id values per session (see the
    plan's "seller_id trap"). Returns (product_dict, session_tid).
    """
    tid = amul_api._session_tid(jar_path)
    substore = amul_api._resolve_substore(pincode, tid, jar_path)
    amul_api._set_store(substore, tid, jar_path)
    store_version = amul_api._store_version(jar_path)

    params = [
        ("fields[name]", "1"), ("fields[sku]", "1"), ("fields[alias]", "1"),
        ("fields[price]", "1"), ("fields[available]", "1"),
        ("fields[inventory_quantity]", "1"), ("fields[categories]", "1"),
        ("fields[images]", "1"),
        ("fields[seller]", "1"), ("fields[linked_product_id]", "1"),
        ("filters[0][field]", "categories"),
        ("filters[0][value][0]", "protein"),
        ("filters[0][operator]", "in"),
        ("filters[0][original]", "1"),
        ("limit", "100"), ("total", "1"), ("start", "0"),
        ("v", store_version), ("device_type", "other"),
    ]
    query = urlencode(params).replace("%5B", "[").replace("%5D", "]")
    url = f"{amul_api.SHOP}/api/1/entity/ms.products?{query}"
    headers = {"tid": amul_api.tid_header(tid)}

    body, status = amul_api._curl(url, extra_headers=headers, jar_path=jar_path)
    _dead_if_unauthenticated(body, status, "authenticated product fetch")

    data = json.loads(body)
    for p in data.get("data", []):
        if p.get("sku") == sku:
            return p, tid
    raise SoldOutError(f"{sku} sold out before it could be added")


def qparam(obj):
    """Reproduce the browser's q= encoding: percent-encode braces/quotes, keep ':' literal."""
    return quote(json.dumps(obj, separators=(",", ":")), safe=":")


def get_user_cart(user_id, jar_path, tid):
    body_data = json.dumps({"data": {"_id": None, "user_id": user_id}})
    headers = {"tid": amul_api.tid_header(tid)}
    body, status = amul_api._curl(
        f"{amul_api.SHOP}/entity/ms.carts/_/getUserCart",
        method="PUT", extra_headers=headers, body=body_data, jar_path=jar_path,
    )
    _dead_if_unauthenticated(body, status, "getUserCart")

    data = json.loads(body)
    cart = data.get("data")
    if not cart or not cart.get("_id"):
        raise CartError("getUserCart returned no cart — the cart may not be server-side")
    return cart["_id"]


def add_item(cart_id, product, sku, jar_path, tid):
    q = qparam({"_id": cart_id})
    body_data = json.dumps({"data": {
        "product_id": product.get("_id"),
        "seller_id": product.get("seller"),
        "selected_options": {},
        "variant_id": None,
        "quantity": 1,
        "linked_product_id": product.get("linked_product_id"),
        "sku": sku,
    }})
    headers = {"tid": amul_api.tid_header(tid)}
    body, status = amul_api._curl(
        f"{amul_api.SHOP}/entity/ms.carts/{cart_id}/_/addItem?q={q}",
        method="PUT", extra_headers=headers, body=body_data, jar_path=jar_path,
    )
    _dead_if_unauthenticated(body, status, "addItem")


def fetch_addresses(user_id, jar_path, tid):
    q = qparam({"user_id": user_id})
    headers = {"tid": amul_api.tid_header(tid)}
    body, status = amul_api._curl(
        f"{amul_api.SHOP}/api/1/entity/ms.user_addresses?q={q}",
        method="GET", extra_headers=headers, jar_path=jar_path,
    )
    _dead_if_unauthenticated(body, status, "address fetch")

    data = json.loads(body)
    return data.get("data", [])


def select_address(addresses, address_id):
    """Never guess an address: an unset address_id only auto-selects a single match."""
    if address_id:
        for a in addresses:
            if a.get("_id") == address_id:
                return a
        raise CartError(f"configured address_id {address_id} not found in saved addresses")
    if len(addresses) == 1:
        return addresses[0]
    ids = [a.get("_id") for a in addresses]
    raise AddressAmbiguousError("multiple saved addresses and none configured", ids)


def update_addresses(cart_id, address, jar_path, tid):
    q = qparam({"_id": cart_id})
    body_data = json.dumps({"data": {
        "shipping_address": address,
        "billing_address": address,
    }})
    headers = {"tid": amul_api.tid_header(tid)}
    body, status = amul_api._curl(
        f"{amul_api.SHOP}/entity/ms.carts/{cart_id}/_/updateAddresses?q={q}",
        method="PUT", extra_headers=headers, body=body_data, jar_path=jar_path,
    )
    _dead_if_unauthenticated(body, status, "updateAddresses")


# --- daily cart cap log ------------------------------------------------------

def _today_kolkata():
    return datetime.now(KOLKATA).strftime("%Y-%m-%d")


def carts_today(carts_log_path):
    if not os.path.exists(carts_log_path):
        return 0
    try:
        with open(carts_log_path) as f:
            entries = json.load(f)
    except Exception:
        return 0
    if not isinstance(entries, list):
        return 0
    today = _today_kolkata()
    return sum(1 for e in entries if isinstance(e, dict) and e.get("date") == today)


def record_cart(carts_log_path, sku):
    """Append before the checkout link is sent — a crash mid-send must not lose the count."""
    entries = []
    if os.path.exists(carts_log_path):
        try:
            with open(carts_log_path) as f:
                loaded = json.load(f)
            if isinstance(loaded, list):
                entries = loaded
        except Exception:
            entries = []
    entries.append({"date": _today_kolkata(), "sku": sku})
    tmp = carts_log_path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(entries, f)
    os.replace(tmp, carts_log_path)


# --- config: a missing/malformed assist.json fails closed -------------------

def load_assist_config(path):
    if not os.path.exists(path):
        return {"enabled": False}
    try:
        with open(path) as f:
            data = json.load(f)
    except Exception:
        return {"enabled": False}
    if not isinstance(data, dict):
        return {"enabled": False}
    return data


# --- the client prepare_cart drives ------------------------------------------

class CartClient:
    """Wires a logged-in session into the cart+address+handoff flow.

    Every method here reaches the cart. Nothing outside prepare_cart may call
    add_and_address — that is the safety property this whole plan rests on.
    """

    def __init__(self, session, pincode, jar_path, carts_log_path, address_id):
        self.session = session
        self.pincode = pincode
        self.jar_path = jar_path
        self.carts_log_path = carts_log_path
        self.address_id = address_id
        write_jar_from_session(session, jar_path)

    def add_and_address(self, sku):
        product, tid = fetch_authenticated_product(sku, self.pincode, self.jar_path)
        user_id = self.session["user_id"]

        cart_id = get_user_cart(user_id, self.jar_path, tid)
        add_item(cart_id, product, sku, self.jar_path, tid)

        addresses = fetch_addresses(user_id, self.jar_path, tid)
        address = select_address(addresses, self.address_id)
        update_addresses(cart_id, address, self.jar_path, tid)

        record_cart(self.carts_log_path, sku)

        return {
            "sku": sku,
            "name": product.get("name"),
            "price": product.get("price"),
            "checkout_url": f"{amul_api.SHOP}/en/checkout",
        }


def prepare_cart(sku, price, cfg, approved, carts_today, client):
    """Nothing may touch the cart without a recorded approval. This is the safety property."""
    if not approved:
        return None, "not approved"
    if not cfg.get("enabled", False):
        return None, "assist disabled"
    if sku not in cfg.get("allowlist", []):
        return None, f"{sku} not in allowlist"
    if price > cfg.get("max_price_inr", 0):
        return None, f"price {price} over cap {cfg.get('max_price_inr')}"
    cap = cfg.get("max_carts_per_day", 0)
    if carts_today >= cap:
        return None, f"daily cart cap {cap} reached"
    return client.add_and_address(sku), "ok"
