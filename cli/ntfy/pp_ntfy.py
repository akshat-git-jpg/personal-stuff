"""pp-ntfy — agent-native CLI for ntfy.sh push notifications.

Designed to be called from bash crons so an `if` block can fire a
persistent, "rings until you acknowledge it" alarm to your phone.

How the alarm works:
  1. We POST a max-priority notification to your alerts topic on
     ntfy.sh. The notification carries an "Acknowledge" action button.
  2. The button's HTTP action publishes a single message to a unique
     ack-topic (generated per alarm invocation).
  3. This script polls that ack-topic. When any message appears
     (because you tapped Acknowledge), the loop exits 0.
  4. Until then, we re-send the notification every --interval seconds
     so the phone rings again. Bounded by --max-tries.

Uses only the Python stdlib (urllib) — no new deps.

Subcommands:
  send "msg"          one-shot notification (no loop, no ack)
  alarm "msg"         keep ringing until phone-side Acknowledge tap
  test                send a quick "pp-ntfy is alive" notification

Env vars (override --flags):
  NTFY_SERVER         ntfy base URL (default: https://ntfy.sh)
  NTFY_TOPIC          alerts topic name (required for send/alarm)
"""
from __future__ import annotations

import argparse
import json
import os
import secrets
import ssl
import sys
import time
import urllib.error
import urllib.request
from typing import Optional


DEFAULT_SERVER = "http://srv1377177.hstgr.cloud:8888"


def _ssl_context() -> Optional[ssl.SSLContext]:
    """Build an SSL context. On Mac/Framework Python the default trust
    store is often empty; if certifi is installed, point at its bundle.
    On Linux/VPS the system trust store works, so return None to let
    urllib use its default."""
    try:
        import certifi  # type: ignore
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return None


def _server() -> str:
    return (os.environ.get("NTFY_SERVER") or DEFAULT_SERVER).rstrip("/")


def _topic(arg_topic: Optional[str]) -> str:
    topic = arg_topic or os.environ.get("NTFY_TOPIC")
    if not topic:
        print(
            "ERROR: no topic. Pass --topic or set NTFY_TOPIC env var.",
            file=sys.stderr,
        )
        sys.exit(2)
    return topic


def _publish(
    topic: str,
    message: str,
    *,
    title: Optional[str] = None,
    priority: int = 3,
    tags: Optional[str] = None,
    actions: Optional[str] = None,
    timeout: float = 10.0,
) -> dict:
    """POST a message to ntfy. Returns the parsed JSON response."""
    url = f"{_server()}/{topic}"
    headers = {
        "Content-Type": "text/plain; charset=utf-8",
        "Priority": str(priority),
    }
    if title:
        headers["Title"] = title
    if tags:
        headers["Tags"] = tags
    if actions:
        headers["Actions"] = actions

    req = urllib.request.Request(
        url,
        data=message.encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout, context=_ssl_context()) as resp:
        body = resp.read().decode("utf-8", errors="replace")
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return {"raw": body}


def _poll_for_ack(ack_topic: str, since: int, timeout: float = 8.0) -> bool:
    """Check the ack-topic for any messages since `since` (unix seconds).
    Returns True if at least one message exists."""
    url = f"{_server()}/{ack_topic}/json?poll=1&since={since}"
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_ssl_context()) as resp:
            for raw in resp:
                line = raw.decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                # ntfy emits an "open" event line first; ignore non-message events.
                if obj.get("event") == "message":
                    return True
    except urllib.error.URLError as e:
        print(f"WARN: ack poll failed: {e}", file=sys.stderr)
    return False


def cmd_send(args: argparse.Namespace) -> int:
    topic = _topic(args.topic)
    resp = _publish(
        topic,
        args.message,
        title=args.title,
        priority=args.priority,
        tags=args.tags,
    )
    if args.format == "json":
        json.dump(resp, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        msg_id = resp.get("id", "?")
        print(f"sent to {topic} (id={msg_id})")
    return 0


def cmd_alarm(args: argparse.Namespace) -> int:
    topic = _topic(args.topic)
    ack_topic = f"{topic}-ack-{secrets.token_urlsafe(8)}"
    ack_url = f"{_server()}/{ack_topic}"
    actions = (
        f"http, Acknowledge, {ack_url}, "
        f"method=POST, body=ack, clear=true"
    )

    started = int(time.time())
    print(f"alarm: topic={topic} ack_topic={ack_topic} interval={args.interval}s")

    for attempt in range(1, args.max_tries + 1):
        # Send the (re-)notification. Each POST is a fresh message → phone rings again.
        resp = _publish(
            topic,
            args.message,
            title=args.title or "ALARM",
            priority=5,
            tags=args.tags or "rotating_light",
            actions=actions,
        )
        print(f"  [{attempt}/{args.max_tries}] sent id={resp.get('id','?')}")

        # Wait, then poll for ack.
        time.sleep(args.interval)
        if _poll_for_ack(ack_topic, since=started):
            print(f"alarm: acknowledged after {attempt} attempt(s)")
            return 0

    print(
        f"alarm: max-tries ({args.max_tries}) reached without ack",
        file=sys.stderr,
    )
    return 3


def cmd_test(args: argparse.Namespace) -> int:
    topic = _topic(args.topic)
    resp = _publish(
        topic,
        "pp-ntfy is alive ✅",
        title="ntfy smoke test",
        priority=3,
        tags="white_check_mark",
    )
    print(f"sent test to {topic} (id={resp.get('id','?')})")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="pp-ntfy",
        description="ntfy.sh push CLI (one-shot + ring-until-ack alarm).",
    )
    p.add_argument(
        "--topic",
        help="ntfy topic name. Defaults to $NTFY_TOPIC.",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("send", help="One-shot notification, no ack loop.")
    s.add_argument("message")
    s.add_argument("--title", default=None)
    s.add_argument("--priority", type=int, default=3, choices=[1, 2, 3, 4, 5])
    s.add_argument("--tags", default=None, help="Comma-separated ntfy tags.")
    s.add_argument("--format", choices=["short", "json"], default="short")
    s.set_defaults(func=cmd_send)

    a = sub.add_parser(
        "alarm",
        help="Send priority-5 notification, re-send every --interval seconds until phone-side Acknowledge.",
    )
    a.add_argument("message")
    a.add_argument("--title", default=None, help="Default: ALARM.")
    a.add_argument("--tags", default=None, help="Default: rotating_light.")
    a.add_argument(
        "--interval",
        type=int,
        default=30,
        help="Seconds between re-sends (default 30).",
    )
    a.add_argument(
        "--max-tries",
        type=int,
        default=20,
        help="Stop after this many sends if no ack (default 20 = ~10 min at 30s).",
    )
    a.set_defaults(func=cmd_alarm)

    t = sub.add_parser("test", help="Send a normal-priority 'is alive' notification.")
    t.set_defaults(func=cmd_test)

    return p


def main(argv: Optional[list[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except urllib.error.HTTPError as e:
        print(f"ERROR: ntfy http {e.code}: {e.reason}", file=sys.stderr)
        return 2
    except urllib.error.URLError as e:
        print(f"ERROR: ntfy unreachable: {e.reason}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("\nalarm: interrupted", file=sys.stderr)
        return 130
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
