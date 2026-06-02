---
name: tweet-lookup
description: Look up a single PUBLIC tweet / X post by its link or ID and return the text, author, date, like/reply counts, and any media URLs. Free, no login, no account risk — uses Twitter's public embed endpoint. Triggers when the user pastes an x.com or twitter.com /status/ link, or says "look up this tweet", "what does this tweet say", "get the tweet text", "read this tweet", "read this X post", "fetch this tweet". Public tweets only — it cannot search, read timelines, or read whole accounts.
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# Tweet Lookup

Fetch a single **public** tweet's contents by link or ID. No login, no auth, no
account risk — it uses Twitter's public syndication/embed endpoint (the same
data a website gets when it embeds a tweet).

## When to use

- The user pastes an `x.com/<user>/status/<id>` or `twitter.com/.../status/<id>` link and wants what it says.
- The user asks: "what does this tweet say", "look up this tweet", "get the tweet text", "read this X post", "fetch this tweet".

## How to run

Run the bundled script with the tweet URL or numeric ID. Use the absolute path
to **this skill's** `scripts/x-tweet-lookup.py` (the skill's base directory is
given to you when the skill loads):

```bash
python3 "<this-skill-dir>/scripts/x-tweet-lookup.py" "<tweet-url-or-id>"
```

Examples:

```bash
python3 "<this-skill-dir>/scripts/x-tweet-lookup.py" https://x.com/jack/status/20
python3 "<this-skill-dir>/scripts/x-tweet-lookup.py" 20            # bare numeric ID
python3 "<this-skill-dir>/scripts/x-tweet-lookup.py" <url> --json  # full raw JSON
```

Default output is formatted — author/handle, date, text, like + reply counts,
and media URLs. Pass `--json` when the user wants every field or you need to
extract structured data programmatically.

Example formatted output:

```
@jack (jack) — 2006-03-21T20:50:14.000Z
------------------------------------------------------------
just setting up my twttr
------------------------------------------------------------
❤ 311191   💬 17876
```

## Requirements

- `python3` (standard library only; uses `certifi` for TLS verification if
  installed — already present on this machine).

## Limitations — state these plainly if asked to do more

- **Public tweets only.** Private/protected, deleted, or wrong-ID tweets return
  "Not found — tweet is private, deleted, or the ID is wrong."
- **One tweet at a time.** No search, no timelines, no reading entire accounts.
  Those require either the paid X API (Basic+ tier) or a logged-in session
  (account-suspension risk) — this skill deliberately uses neither.
