#!/usr/bin/env python3
"""
Look up a single public tweet by link (or ID) — free, no login, no account risk.

Uses Twitter's public syndication/embed endpoint (cdn.syndication.twimg.com),
the same source websites use to render embedded tweets. Works only for public
tweets. No auth, so nothing touches your account.

Usage:
    python3 x-tweet-lookup.py https://x.com/jack/status/20
    python3 x-tweet-lookup.py 20
    python3 x-tweet-lookup.py <url> --json     # raw JSON
"""
import argparse
import json
import math
import re
import ssl
import sys
import urllib.parse
import urllib.request

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CTX = ssl.create_default_context()

DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz"


def js_float_to_base36(num: float) -> str:
    """Mimic JavaScript Number.prototype.toString(36) for a float."""
    int_part = int(num)
    frac = num - int_part
    if int_part == 0:
        int_str = "0"
    else:
        int_str, n = "", int_part
        while n > 0:
            int_str = DIGITS[n % 36] + int_str
            n //= 36
    frac_str = ""
    if frac > 0:
        frac_str = "."
        count = 0
        while frac > 0 and count < 20:
            frac *= 36
            d = int(frac)
            frac_str += DIGITS[d]
            frac -= d
            count += 1
    return int_str + frac_str


def make_token(tweet_id: str) -> str:
    # react-tweet algorithm: ((id / 1e15) * PI).toString(36) with 0s and dots stripped
    val = (int(tweet_id) / 1e15) * math.pi
    return re.sub(r"(0+|\.)", "", js_float_to_base36(val))


def extract_id(arg: str) -> str:
    if arg.isdigit():
        return arg
    m = re.search(r"/status(?:es)?/(\d+)", arg)
    if not m:
        sys.exit(f"Could not find a tweet ID in: {arg}")
    return m.group(1)


def fetch(tweet_id: str) -> dict:
    params = urllib.parse.urlencode({
        "id": tweet_id,
        "lang": "en",
        "token": make_token(tweet_id),
    })
    url = f"https://cdn.syndication.twimg.com/tweet-result?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, context=SSL_CTX) as resp:
        return json.load(resp)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tweet", help="tweet URL or numeric ID")
    ap.add_argument("--json", action="store_true", help="print raw JSON")
    args = ap.parse_args()

    tweet_id = extract_id(args.tweet)
    try:
        data = fetch(tweet_id)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            sys.exit("Not found — tweet is private, deleted, or the ID is wrong.")
        sys.exit(f"HTTP {e.code}: {e.read().decode()[:300]}")

    if args.json:
        print(json.dumps(data, indent=2, ensure_ascii=False))
        return

    user = data.get("user", {})
    name = user.get("name", "?")
    handle = user.get("screen_name", "?")
    text = data.get("text", "")
    created = data.get("created_at", "")
    likes = data.get("favorite_count", 0)
    replies = data.get("conversation_count", 0)

    print(f"@{handle} ({name}) — {created}")
    print("-" * 60)
    print(text)
    print("-" * 60)
    print(f"❤ {likes}   💬 {replies}")

    media = data.get("mediaDetails") or []
    if media:
        print("\nMedia:")
        for m in media:
            u = m.get("media_url_https") or m.get("video_info", {}).get("variants", [{}])[-1].get("url", "")
            print(f"  - {m.get('type', 'media')}: {u}")

    photos = data.get("photos") or []
    for p in photos:
        if p.get("url"):
            print(f"  - photo: {p['url']}")


if __name__ == "__main__":
    main()
