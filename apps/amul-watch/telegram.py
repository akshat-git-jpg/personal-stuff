"""Thin Telegram Bot API client — no daemon, no webhook, no long-polling library.

Reads creds from infra/secrets/telegram.env (same file tooling/cli/notify uses),
never edits that CLI. AMUL_WATCH_TG_ENV_FILE overrides the creds file path and
AMUL_WATCH_TG_BASE overrides the API base URL — both exist so the test suite
can point this module at a stub without touching real secrets or the network.
"""

import json
import os
import subprocess
import time
from urllib.parse import urlencode

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

TG_BASE = os.environ.get("AMUL_WATCH_TG_BASE", "https://api.telegram.org")

# Production polls every 2s; the test suite shrinks this so a timeout assertion
# does not have to burn real wall-clock seconds per case.
DEFAULT_POLL_INTERVAL_S = float(os.environ.get("AMUL_WATCH_TG_POLL_INTERVAL", "2"))


class TelegramError(RuntimeError):
    pass


def _env_file():
    return os.environ.get(
        "AMUL_WATCH_TG_ENV_FILE",
        os.path.join(REPO_ROOT, "infra", "secrets", "telegram.env"),
    )


def _load_creds():
    token, chat_id = "", ""
    path = _env_file()
    if os.path.exists(path):
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip()
                if key == "TELEGRAM_BOT_TOKEN":
                    token = value
                elif key == "TELEGRAM_CHAT_ID":
                    chat_id = value
    if not token or not chat_id:
        raise TelegramError(f"TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set in {path}")
    return {"token": token, "chat_id": chat_id}


def _curl(url, method="GET", body=None):
    cmd = ["curl", "-s", "-S", "--connect-timeout", "10", "--max-time", "30", "-X", method]
    if body is not None:
        cmd.extend(["-H", "Content-Type: application/json", "-d", body])
    cmd.extend(["-w", "\n__STATUS__%{http_code}", url])

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        return 0, None

    parts = res.stdout.rsplit("\n__STATUS__", 1)
    if len(parts) == 2:
        out, status_str = parts
        try:
            status = int(status_str)
        except ValueError:
            status = 0
    else:
        out, status = res.stdout, 0

    try:
        data = json.loads(out)
    except Exception:
        data = None
    return status, data


def _post(token, method, body):
    return _curl(f"{TG_BASE}/bot{token}/{method}", method="POST", body=body)


def _get(token, method, params):
    qs = urlencode(params)
    return _curl(f"{TG_BASE}/bot{token}/{method}?{qs}", method="GET")


def _read_offset(offset_file):
    try:
        with open(offset_file) as f:
            return json.load(f).get("offset", 0)
    except Exception:
        return 0


def _write_offset(offset_file, offset):
    tmp = offset_file + ".tmp"
    with open(tmp, "w") as f:
        json.dump({"offset": offset}, f)
    os.replace(tmp, offset_file)


def send_photo_with_buttons(photo_url, caption, token, cart_label="🛒 Add to cart"):
    """sendPhoto with an inline keyboard; falls back to sendMessage if the photo fails.

    A broken image URL must not lose the alert — that fallback is load-bearing.
    Returns the sent message_id.
    """
    creds = _load_creds()
    keyboard = {
        "inline_keyboard": [[
            {"text": cart_label, "callback_data": f"add:{token}"},
            {"text": "✕ Ignore", "callback_data": f"skip:{token}"},
        ]]
    }

    if photo_url:
        body = json.dumps({
            "chat_id": creds["chat_id"],
            "photo": photo_url,
            "caption": caption,
            "reply_markup": keyboard,
        })
        status, data = _post(creds["token"], "sendPhoto", body)
        if status == 200 and data and data.get("ok"):
            return data["result"]["message_id"]

    body2 = json.dumps({
        "chat_id": creds["chat_id"],
        "text": caption,
        "reply_markup": keyboard,
    })
    status2, data2 = _post(creds["token"], "sendMessage", body2)
    if status2 == 200 and data2 and data2.get("ok"):
        return data2["result"]["message_id"]

    raise TelegramError("failed to send alert via sendPhoto and sendMessage")


def wait_for_callback(token, timeout_s, offset_file, poll_interval_s=None):
    """Poll getUpdates for a callback_query matching `token`.

    Returns "add", "skip", or None on timeout. A callback_data whose token
    does not match the current one is ignored — this is what stops a stale
    message from carting something days later. The offset always advances
    past every update seen, matched or not, so nothing replays on the next run.
    """
    if poll_interval_s is None:
        poll_interval_s = DEFAULT_POLL_INTERVAL_S
    creds = _load_creds()
    offset = _read_offset(offset_file)
    start = time.time()

    while True:
        status, data = _get(creds["token"], "getUpdates", {"timeout": 0, "offset": offset})
        if status == 200 and data and data.get("ok"):
            for update in data.get("result", []):
                offset = update["update_id"] + 1
                cq = update.get("callback_query")
                if not cq:
                    continue
                cq_data = cq.get("data", "")
                if ":" not in cq_data:
                    continue
                action, cq_token = cq_data.split(":", 1)
                if cq_token != token or action not in ("add", "skip"):
                    continue
                _write_offset(offset_file, offset)
                answer_callback(cq.get("id"), "Got it!" if action == "add" else "Ignored")
                return action
            _write_offset(offset_file, offset)

        if time.time() - start >= timeout_s:
            return None
        time.sleep(poll_interval_s)


def wait_for_text_reply(timeout_s, offset_file, poll_interval_s=None):
    """Poll getUpdates for a plain text reply — used for OTP intake, never for cart approval."""
    if poll_interval_s is None:
        poll_interval_s = DEFAULT_POLL_INTERVAL_S
    creds = _load_creds()
    offset = _read_offset(offset_file)
    start = time.time()

    while True:
        status, data = _get(creds["token"], "getUpdates", {"timeout": 0, "offset": offset})
        if status == 200 and data and data.get("ok"):
            for update in data.get("result", []):
                offset = update["update_id"] + 1
                msg = update.get("message")
                if msg and "text" in msg:
                    _write_offset(offset_file, offset)
                    return msg["text"].strip()
            _write_offset(offset_file, offset)

        if time.time() - start >= timeout_s:
            return None
        time.sleep(poll_interval_s)


def answer_callback(callback_query_id, text):
    """Acknowledge a callback so Telegram stops the tap spinner. Best-effort."""
    if not callback_query_id:
        return
    creds = _load_creds()
    body = json.dumps({"callback_query_id": callback_query_id, "text": text})
    _post(creds["token"], "answerCallbackQuery", body)


def edit_message(message_id, caption):
    """Strike the buttons after a decision or a timeout so a stale message can't be tapped later."""
    creds = _load_creds()
    stripped = {"inline_keyboard": []}

    body = json.dumps({
        "chat_id": creds["chat_id"],
        "message_id": message_id,
        "caption": caption,
        "reply_markup": stripped,
    })
    status, data = _post(creds["token"], "editMessageCaption", body)
    if status == 200 and data and data.get("ok"):
        return

    body2 = json.dumps({
        "chat_id": creds["chat_id"],
        "message_id": message_id,
        "text": caption,
        "reply_markup": stripped,
    })
    _post(creds["token"], "editMessageText", body2)


def send_text(text):
    """Plain sendMessage, no keyboard — used for the OTP prompt and the re-login nudge."""
    creds = _load_creds()
    body = json.dumps({"chat_id": creds["chat_id"], "text": text})
    status, data = _post(creds["token"], "sendMessage", body)
    if not (status == 200 and data and data.get("ok")):
        raise TelegramError(f"sendMessage failed: status={status}")
