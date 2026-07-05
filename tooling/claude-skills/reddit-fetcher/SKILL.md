---
name: reddit-fetcher
description: Fetch a Reddit post's full text and comments when a Reddit URL (reddit.com, www.reddit.com, or old.reddit.com) can't be read directly — WebFetch, the .json API, and generic scraping proxies all get blocked with a 403 / bot-detection page. Use when asked to fetch, read, or summarize a Reddit thread, post, or its comments, or after any Reddit fetch attempt has already failed with a 403 or "blocked by network security" error.
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# Reddit Fetcher

`www.reddit.com` (and its `.json` API) is behind bot detection that blocks WebFetch and plain
`curl` with a 403 "You've been blocked by network security" page — generic read-it-later proxies
(e.g. `r.jina.ai`) hit the same wall since they fetch the same host. The old-UI HTML page at
`old.reddit.com` is not behind that rule and returns real content when curled with a full
browser header set. Tested and confirmed: User-Agent alone was NOT enough to get through —
`Accept` and `Accept-Language` headers were also required.

## Usage

```bash
SKILL_DIR="/Users/kbtg/codebase/personal-stuff/tooling/claude-skills/reddit-fetcher"
"$SKILL_DIR/scripts/fetch.sh" "<reddit-url>" /tmp/reddit.html
python3 "$SKILL_DIR/scripts/parse.py" /tmp/reddit.html
```

- `fetch.sh` rewrites any `reddit.com` / `www.reddit.com` / `old.reddit.com` URL (and strips a
  trailing `.json`) to the old-UI HTML page, then curls it with the working header set. Prints
  the HTTP status to stderr.
- `parse.py` extracts the post title, author, score, and body, then every comment (author,
  score, body text, one level of indent for replies). Needs `beautifulsoup4` —
  `pip install bs4` if `import bs4` fails.

## Known limitations

- **Pagination:** old.reddit.com collapses long threads behind "load more comments" and deep
  reply chains behind "continue this thread" — those are separate page loads that `fetch.sh`
  does not follow. A ~2,400-upvote thread with ~186 comment nodes came back complete in
  testing; threads with 1,000+ comments will be truncated to what's on the initial page.
- **Still 403s?** Quarantined, private, or age-gated subreddits may need an authenticated
  session cookie, which this technique doesn't provide. Report the 403 to the user rather than
  retrying blindly with more header variations.
- This only sees what a logged-out browser sees — no locked/private content, no upvote/reply
  actions.

## Common mistakes

- Fetching `www.reddit.com/.../.json` directly — blocked exactly like the HTML page; rewrite to
  `old.reddit.com` and drop `.json` (fetch.sh does this automatically).
- Sending only a `User-Agent` header and assuming the rest doesn't matter — it does; use
  `fetch.sh` rather than a bare `curl -A`.
