# upwork-helper — operate doc

Browser extension, loaded unpacked. **Not deployed anywhere** — no Worker, no VPS,
no entry in `my-hosted-sites.md`. Nothing to ship; the owner reloads it from
`chrome://extensions`.

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3. Two content scripts (see below), `host_permissions` for upwork.com, `helper.js` also exposed as a web-accessible resource. |
| `helper.js` | Everything. Capture, index, DOM swap, side panel, diagnostics. |
| `loader.js` | Isolated-world shim that injects `helper.js` as a real page script. |

## The three load-bearing facts

1. **The capture hook must run in the page's world.** An isolated-world content
   script patches its *own* `window.fetch`, which the page never calls.
2. **`world: "MAIN"` alone is not enough.** Observed 2026-08-31 in Arc: the DOM
   half worked (panel rendered, private text found) while capture stayed at zero,
   because the manifest's MAIN-world request did not take effect. That failure is
   silent and looks exactly like "Upwork changed its API".
   So the extension ships **both** paths — the `world: "MAIN"` content script and
   `loader.js`, which injects `helper.js` via `chrome.runtime.getURL` as a page
   `<script>`. `helper.js` guards on `window.__uhelpLoaded`, so whichever lands
   first wins and the second is a no-op. **Do not delete either path.**
3. **Upwork already sends the private description.** The work-history GraphQL
   response carries `description` alongside `isPrivate: true`. The extension does
   not defeat access control; it un-hides a field the server chose to send.

## When it stops working

Run `__uhelp.hits()` in the page console first. It returns
`{fetch, xhr, json, skipped, captured}` and each shape points somewhere different:

| Reading | Meaning | Fix |
|---|---|---|
| `fetch: 0, xhr: 0` | The hook is not in the page's world. | Loader problem — check `web_accessible_resources`, and whether page CSP blocked the injected script (console will say). |
| hits > 0, `json: 0` | Bodies never parsed. | Responses are not plain JSON any more (streaming/RSC). `ingest` needs a new reader. |
| `json > 0, captured: 0` | Parsing works, shape changed. | `remember()` — Upwork renamed `title`/`description` or nested them deeper than `walk`'s depth cap. |
| `captured > 0`, nothing on screen | Copy or DOM changed. | `PRIVATE_RE`, then `HEADING_SEL` / `headingFor`. |

For a single job that misses while others work, it is title matching. `norm()`
handles dashes, smart quotes, whitespace and trailing punctuation; add to it
rather than loosening the substring fallback, which can cross-match short titles.

## Conventions

- No build step, no dependencies, no bundler. Plain JS the browser loads directly.
  Do not add npm here.
- All DOM writes use `textContent` / `createElement`. Never `innerHTML` with
  captured strings — job descriptions are attacker-controllable text.
- Everything stays in memory. Do not add storage; there is no reason to persist
  another party's job descriptions to disk.
