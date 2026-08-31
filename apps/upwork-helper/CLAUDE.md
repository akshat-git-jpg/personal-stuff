# upwork-helper — operate doc

Browser extension, loaded unpacked. **Not deployed anywhere** — no Worker, no VPS,
no entry in `my-hosted-sites.md`. Nothing to ship; the owner reloads it from
`chrome://extensions`.

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3. One content script, `world: "MAIN"`, `run_at: document_start`, zero permissions. Keep it that way — the moment a `permissions` key appears, re-check whether it is actually needed. |
| `helper.js` | Everything. Capture, index, DOM swap, side panel. |

## The two load-bearing facts

1. **MAIN world is the whole trick.** An isolated-world content script cannot see
   the page's `fetch`/`XHR`. `world: "MAIN"` (Chrome 111+) removes the need for a
   `<script>` injection dance and for any `permissions`.
2. **Upwork already sends the private description.** The work-history GraphQL
   response carries `description` alongside `isPrivate: true`. The extension does
   not defeat access control; it un-hides a field the server chose to send.

## When it stops working

Check in this order:

1. Open the **Jobs** panel. If N is 0, capture broke — Upwork moved off
   `fetch`/`XHR` (streaming? RSC?), or the response is not JSON.
2. If N is high but nothing swaps on screen, the copy changed. Update
   `PRIVATE_RE` in `helper.js`.
3. If a specific job misses, it is title matching. `norm()` handles dashes,
   smart quotes, whitespace and trailing punctuation; add to it rather than
   loosening the substring fallback, which can cross-match short titles.

## Conventions

- No build step, no dependencies, no bundler. Plain JS the browser loads directly.
  Do not add npm here.
- All DOM writes use `textContent` / `createElement`. Never `innerHTML` with
  captured strings — job descriptions are attacker-controllable text.
- Everything stays in memory. Do not add storage; there is no reason to persist
  another party's job descriptions to disk.
