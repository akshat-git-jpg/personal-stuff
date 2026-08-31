# upwork-helper

A Chrome/Edge extension that shows the job description Upwork's own API already
sent to your browser, in the places where the UI prints **"This job is private"**.

Nothing is fetched, guessed, or scraped from a third party. The GraphQL response
that renders a freelancer's work history already contains `description` for every
contract, including the ones flagged `isPrivate: true`. The extension reads that
response and puts the text back on screen.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Pick this folder: `apps/upwork-helper/`.
5. Reload the Upwork tab.

Same steps work in Edge (`edge://extensions`) and Brave.

## Use

- Open a freelancer's **Work history** (proposal view or full profile).
- Where the modal said "This job is private", it now shows the real description
  with a green `revealed` badge.
- Bottom-right there is a **Jobs N** button. N is how many job descriptions have
  been captured on this page. Click it for a searchable list of all of them —
  the fallback for when the on-page swap cannot match a title.

Descriptions are only captured after the API call that carries them fires. If the
panel says 0, reload the page with the tab in the foreground.

## How it works

`helper.js` has to run in the page's own JavaScript world to patch the page's
`fetch` and `XMLHttpRequest`. Two paths get it there — the manifest's
`world: "MAIN"` content script, and `loader.js`, which injects `helper.js` as a
page `<script>`. Whichever lands first wins; the other is a no-op. Both are kept
because `world: "MAIN"` was observed silently not taking effect in Arc.

From there:

1. Every JSON response is walked for objects that have both `title` and
   `description`. Those get indexed by normalised title and by
   `openingUid` / `id` / `ciphertext`.
2. A `MutationObserver` (debounced 250 ms) looks for text nodes matching
   `/this job is private/i`.
3. For each hit it resolves the owning job — first by an id found on a nearby
   attribute or link, then by the nearest heading text — and replaces just that
   text node with the stored description.

The only permission is `host_permissions` for `upwork.com`. There is no background
service worker. Data lives in memory for the life of the tab and is never sent
anywhere.

## Debugging

In the page console:

```js
__uhelp.hits()          // {fetch, xhr, json, skipped, captured}
__uhelp.titles()        // every job title captured
__uhelp.find('faceless')
__uhelp.retry()         // clear the "already handled" marks and re-scan the DOM
```

`hits()` is the one that matters. `fetch: 0, xhr: 0` means the hook never got
into the page — everything else means it did. `apps/upwork-helper/CLAUDE.md` has
the full reading-to-fix table.

## Limits

- Title matching is fuzzy (dash/quote/whitespace normalised, substring fallback).
  If a swap misses, the **Jobs** panel still has the text.
- A truly empty description (e.g. the "Videos for Apps" contract, whose
  description literally *is* `"Videos for Apps"`) has nothing to reveal.
- Upwork changing its GraphQL shape or its "This job is private" copy breaks the
  matching. Both are one-line fixes in `helper.js` (`PRIVATE_RE`, `remember`).

## Note

This reads data already delivered to your own browser session. It is a personal
convenience tool. Don't republish what it surfaces.
