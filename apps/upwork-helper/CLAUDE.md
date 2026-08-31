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
| `test-helper.mjs` | jsdom regression test. `npm install --no-save jsdom@24 && node test-helper.mjs`. Run it before shipping any change to `helper.js` — it has already caught two bugs that a manual reload-and-squint pass missed. |

## The four load-bearing facts

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
3. **`JSON.parse` is the capture path that actually survives.** Hooking
   `fetch`/`XHR` only works if we land before the app bundle copies them into a
   local (`const f = window.fetch`), and the injected page script arrives
   asynchronously, so we cannot guarantee that. `JSON.parse` is looked up on the
   `JSON` namespace at every call site, by every delivery route. The fetch and
   XHR hooks are kept for diagnostics — `hits()` uses them to prove the hook is
   in the page's world at all.
4. **Upwork already sends the private description.** The work-history GraphQL
   response carries `description` alongside `isPrivate: true`. The modal's own
   `jobAuthDetails` query is genuinely refused (`error.job.is.private` in the
   console) — do not chase that response, it never had the text. The list query
   is the source.

## The two bugs that were not obvious

Both looked like "Upwork changed something". Neither was.

1. **`world: "MAIN"` silently ignored** (Arc, 2026-08-31). DOM half worked,
   capture read zero. Fixed by shipping `loader.js` as well. This is why
   `hits()` separates `fetch`/`xhr` (proves world) from `parse` (proves capture).
2. **The nearest heading is the wrong heading.** The modal renders a
   `Job description` label immediately above the private notice, so a
   first-heading-wins lookup always resolved to that label and gave up.
   `headingCandidates()` now collects *every* heading up the tree and the caller
   matches all of them against the store. Do not "simplify" it back to
   returning one heading.

## When it stops working

Run `__uhelp.hits()` in the page console first. It returns
`{fetch, xhr, json, skipped, captured}` and each shape points somewhere different:

The same numbers are printed live in the **Jobs** panel header, so a screenshot
is enough — nobody has to type in a console.

| Reading | Meaning | Fix |
|---|---|---|
| `fetch: 0, xhr: 0, parse: 0` | Nothing is hooked; we are not in the page's world. | Loader problem — check `web_accessible_resources`, and whether page CSP blocked the injected script. |
| `parse > 0, captured: 0` | Parsing works, shape changed. | `remember()` — Upwork renamed `title`/`description` or nested them deeper than `walk`'s depth cap of 14. |
| `parse: 0` but `fetch > 0` | Data no longer arrives as JSON strings. | Streaming/RSC. `sweepInlineScripts` and its `PAIR_RE` are the fallback; widen them. |
| `captured > 0`, nothing on screen | Copy or DOM changed. | `PRIVATE_RE`, then `HEADING_SEL` / `headingCandidates`. |

For a single job that misses while others work, it is title matching. `norm()`
handles dashes, smart quotes, whitespace and trailing punctuation; add to it
rather than loosening the substring fallback, which can cross-match short titles.

## Conventions

- No build step, no bundler, and **zero runtime dependencies** — plain JS the
  browser loads directly. `jsdom` for `test-helper.mjs` is the one exception and
  is installed with `--no-save`; `node_modules/` is gitignored here.
- All DOM writes use `textContent` / `createElement`. Never `innerHTML` with
  captured strings — job descriptions are attacker-controllable text.
- Everything stays in memory. Do not add storage; there is no reason to persist
  another party's job descriptions to disk.
