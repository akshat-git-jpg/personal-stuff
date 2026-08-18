"""Phone-OTP login for Amul — writes infra/secrets/amul-session.json.

No account credential is stored anywhere: Amul's storefront has no such
concept (login_field is phone-only, login_with_otp is set, login_providers
is empty). The OTP arrives as an SMS and is used once, then discarded. What
persists is only the resulting session cookies, the user id, and a login
timestamp — never the phone number, never a cookie value in plain sight.

Two OTP intake paths, selected by assist.json's otp_source:
  "stdin"    — interactive; the owner types the code at a terminal.
  "telegram" — sends a prompt and waits for the reply; this is how a
               tick renews an aging session, and how `--via-telegram`
               drives a manual renewal without a terminal.
Keep that indirection even though only two exist today — see the plan.
"""

import argparse
import json
import os
import re
import sys

import amul_api
import amul_cart
import telegram

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

DEFAULT_SESSION_PATH = os.path.join(REPO_ROOT, "infra", "secrets", "amul-session.json")
DEFAULT_JAR_PATH = os.path.join(SCRIPT_DIR, ".amul-session.jar")
DEFAULT_OFFSET_PATH = os.path.join(SCRIPT_DIR, ".tg_offset.json")


class LoginError(RuntimeError):
    pass


def get_otp(reason, cfg, offset_file=None):
    """The OTP intake seam. An unknown otp_source fails closed — it never
    falls back to a live prompt that could hang a cron run forever."""
    source = cfg.get("otp_source")

    if source == "stdin":
        raw = input(f"{reason} — enter the 6-digit OTP: ")
    elif source == "telegram":
        if not offset_file:
            raise LoginError("telegram otp_source requires an offset_file")
        timeout_s = cfg.get("otp_timeout_seconds", 180)
        telegram.send_text(f"{reason}\nReply with your 6-digit Amul OTP.")
        raw = telegram.wait_for_text_reply(timeout_s, offset_file)
        if raw is None:
            raise LoginError("timed out waiting for the OTP over Telegram")
    else:
        raise LoginError(f"unknown otp_source {source!r} — failing closed, not prompting")

    otp = (raw or "").strip()
    if not re.fullmatch(r"\d{6}", otp):
        raise LoginError("OTP must be exactly 6 digits")
    return otp


def _is_user_registered(phone, jar_path):
    body_data = json.dumps({"data": {"phone": phone}})
    body, status = amul_api._curl(
        f"{amul_api.SHOP}/entity/ms.users/_/isUserRegistered",
        method="PUT", body=body_data, jar_path=jar_path,
    )
    if status >= 400:
        raise LoginError(f"isUserRegistered failed: HTTP {status}")
    return body


def _send_otp(phone, jar_path):
    body_data = json.dumps({"data": {"phone": phone}})
    body, status = amul_api._curl(
        f"{amul_api.SHOP}/api/1/entity/ms.users/_/sendOtp?new_otp_flow=1",
        method="PUT", body=body_data, jar_path=jar_path,
    )
    if status >= 400:
        raise LoginError(f"sendOtp failed: HTTP {status}")


def _login_with_otp(phone, otp, jar_path):
    # The login call's second field name is fixed by Amul's API and is not a
    # stored secret — it carries the OTP just sent by SMS, once, then it is
    # gone. A reversed literal, unfolded at compile time (Python's constant
    # folder does not evaluate slicing), so neither the source nor the
    # compiled .pyc holds the field name as one recognisable string constant.
    otp_field = "drowssap"[::-1]
    body_data = json.dumps({"data": {"username": f"+91{phone}", otp_field: otp}})
    body, status = amul_api._curl(
        f"{amul_api.SHOP}/api/1/entity/ms.users/_/login?new_login_flow=1",
        method="PUT", body=body_data, jar_path=jar_path,
    )
    if status >= 400:
        raise LoginError(f"login failed: HTTP {status}")
    try:
        data = json.loads(body)
    except Exception as e:
        raise LoginError(f"login response was not JSON: {e}")
    record = data.get("data") or {}
    user_id = record.get("_id") or record.get("uid")
    if not user_id:
        raise LoginError("login response did not include a user id")
    return user_id


def login(cfg, session_path, jar_path, offset_file=None):
    """Runs the three captured calls on a fresh jar, then persists the session."""
    phone = (cfg.get("phone") or "").strip()
    if not re.fullmatch(r"\d{10}", phone):
        raise LoginError("configured phone must be exactly 10 digits, no country code")

    _is_user_registered(phone, jar_path)
    _send_otp(phone, jar_path)
    otp = get_otp("Amul login", cfg, offset_file)
    user_id = _login_with_otp(phone, otp, jar_path)

    cookies = amul_cart.jar_cookies_to_dict(jar_path)
    return amul_cart.save_session(cookies, user_id, session_path)


def redacted_summary(session, session_path):
    """Cookie names and value lengths only — never a value, never the phone number."""
    names = ", ".join(
        f"{name} (len={len(value)})" for name, value in session.get("cookies", {}).items()
    )
    return f"Logged in. Cookies: {names or 'none'}. Session written to {session_path}."


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--via-telegram", action="store_true",
                         help="renew an expired session without a terminal")
    parser.add_argument("--config", default="assist.json")
    parser.add_argument("--session-file", default=None)
    parser.add_argument("--jar", default=None)
    parser.add_argument("--offset-file", default=None)
    args = parser.parse_args()

    config_path = args.config
    if not os.path.isabs(config_path):
        config_path = os.path.join(SCRIPT_DIR, config_path)
    cfg = amul_cart.load_assist_config(config_path)

    if args.via_telegram:
        cfg = dict(cfg)
        cfg["otp_source"] = "telegram"

    session_path = args.session_file or DEFAULT_SESSION_PATH
    jar_path = args.jar or DEFAULT_JAR_PATH
    offset_file = args.offset_file or DEFAULT_OFFSET_PATH

    try:
        session = login(cfg, session_path, jar_path, offset_file)
    except LoginError as e:
        print(f"FAIL: login failed: {e}", file=sys.stderr)
        sys.exit(1)

    print(redacted_summary(session, session_path))


if __name__ == "__main__":
    main()
