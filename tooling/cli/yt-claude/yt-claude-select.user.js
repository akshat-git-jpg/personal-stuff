// ==UserScript==
// @name         YT → Claude (multi-select)
// @namespace    kushal.yt-claude
// @version      1.6
// @description  Tick video thumbnails on YouTube, then send the batch to the local yt-claude relay (one live claude session per video).
// @match        https://www.youtube.com/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const RELAY = "http://127.0.0.1:7777/queue";
  const selected = new Map(); // videoId -> watchUrl

  // ---- styles ----
  const css = `
    .ytc-box{position:absolute;top:6px;left:6px;z-index:99999;width:22px;height:22px;
      border-radius:6px;border:2px solid #fff;background:rgba(0,0,0,.55);
      display:flex;align-items:center;justify-content:center;cursor:pointer;
      box-shadow:0 1px 4px rgba(0,0,0,.4);transition:background .12s;}
    .ytc-box:hover{background:rgba(0,0,0,.8);}
    .ytc-box.on{background:#3ea6ff;border-color:#3ea6ff;}
    .ytc-check{font:700 15px/1 Arial,sans-serif;color:#05111f;display:none;}
    .ytc-box.on .ytc-check{display:block;}
    .ytc-pill{position:fixed;right:22px;bottom:22px;z-index:9999;
      background:#3ea6ff;color:#05111f;font:600 14px/1 Roboto,Arial,sans-serif;
      padding:12px 18px;border-radius:24px;cursor:pointer;border:none;
      box-shadow:0 4px 14px rgba(0,0,0,.4);display:none;}
    .ytc-pill:hover{filter:brightness(1.06);}
    .ytc-pill.flash{background:#2ecc71;}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ---- floating send button ----
  const pill = document.createElement("button");
  pill.className = "ytc-pill";
  document.body.appendChild(pill);
  // The currently-playing video, if we're on a /watch page (has no thumbnail
  // to tick, so the pill sends it directly).
  function currentWatchUrl() {
    try {
      const u = new URL(location.href);
      if (u.pathname === "/watch") {
        const v = u.searchParams.get("v");
        if (v) return "https://www.youtube.com/watch?v=" + v;
      }
    } catch (e) {}
    return null;
  }

  function refreshPill(extra) {
    if (extra) { pill.textContent = extra; return; }
    const cur = currentWatchUrl();
    const sel = [...selected.values()];
    const includeCur = cur && !sel.includes(cur);
    const total = sel.length + (includeCur ? 1 : 0);
    pill.style.display = total ? "block" : "none";
    if (!total) return;
    pill.textContent =
      sel.length === 0 && includeCur ? "→ Claude (this video)" : `→ Claude (${total})`;
  }
  pill.addEventListener("click", send);

  function send() {
    const urls = [...selected.values()];
    const cur = currentWatchUrl();
    if (cur && !urls.includes(cur)) urls.push(cur); // the video you're watching
    if (!urls.length) return;
    pill.classList.add("flash");
    refreshPill("sending…");

    const tokenUrl = RELAY.replace(/\/queue\/?$/, "/token");
    GM_xmlhttpRequest({
      method: "GET",
      url: tokenUrl,
      onload: (tRes) => {
        let token = "";
        try {
          token = JSON.parse(tRes.responseText).token;
        } catch (e) {}
        if (!token) {
          refreshPill("token failed ✗");
          setTimeout(() => { pill.classList.remove("flash"); refreshPill(); }, 1800);
          return;
        }

        GM_xmlhttpRequest({
          method: "POST",
          url: RELAY,
          headers: {
            "Content-Type": "application/json",
            "X-Relay-Token": token
          },
          data: JSON.stringify({ urls }),
          onload: (r) => {
            let opened = urls.length;
            try { opened = JSON.parse(r.responseText).opened ?? opened; } catch (e) {}
            refreshPill(`sent ${opened} ✓`);
            clearAll();
            setTimeout(() => { pill.classList.remove("flash"); refreshPill(); }, 1400);
          },
          onerror: () => {
            refreshPill("relay offline ✗");
            setTimeout(() => { pill.classList.remove("flash"); refreshPill(); }, 1800);
          },
        });
      },
      onerror: () => {
        refreshPill("relay offline ✗");
        setTimeout(() => { pill.classList.remove("flash"); refreshPill(); }, 1800);
      },
    });
  }

  function clearAll() {
    selected.clear();
    document.querySelectorAll(".ytc-box.on").forEach((b) => b.classList.remove("on"));
  }

  function idFromHref(href) {
    try {
      const u = new URL(href, location.origin);
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/\/shorts\/([0-9A-Za-z_-]{11})/);
      if (m) return m[1];
    } catch (e) {}
    return null;
  }

  // Layout-agnostic: decorate any link to a video that wraps a thumbnail
  // image. A `/watch?v=` (or `/shorts/`) anchor containing an <img> is the
  // thumbnail link in every YouTube layout, so we don't depend on the
  // ever-changing custom-element tag names.

  // Video "card" wrappers across layouts. We anchor the checkbox to the card
  // (which sits ABOVE YouTube's click overlay) rather than inside the thumbnail
  // link — on channel pages that link is aria-hidden and gets covered.
  const CARD_SEL =
    "yt-lockup-view-model, ytd-rich-item-renderer, ytd-rich-grid-media, " +
    "ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, " +
    "ytd-playlist-video-renderer, ytd-reel-item-renderer";

  function isThumbnailLink(a) {
    // The thumbnail anchor contains an image; the title anchor does not.
    return !!a.querySelector("img, yt-image, .yt-core-image, ytd-thumbnail");
  }

  function decorate(a) {
    if (a.dataset.ytcDone) return;
    if (!idFromHref(a.getAttribute("href"))) return;
    if (!isThumbnailLink(a)) return; // skip title/other links; retry later if img not loaded yet
    a.dataset.ytcDone = "1";

    // Host the box on the card wrapper (top-left = thumbnail's top-left), so it
    // renders above the clickable overlay. Fall back to the anchor itself.
    const host = a.closest(CARD_SEL) || a;
    // Dedupe per card (NOT by a global id set — that breaks when YouTube
    // recycles/re-renders cards, leaving some videos without a checkbox).
    if (host.dataset.ytcHosted) return;
    host.dataset.ytcHosted = "1";
    if (getComputedStyle(host).position === "static") host.style.position = "relative";

    const box = document.createElement("div");
    box.className = "ytc-box";
    box.title = "Select for Claude summary";
    const check = document.createElement("span");
    check.className = "ytc-check";
    check.textContent = "✓"; // ✓
    box.appendChild(check);
    const toggle = (e) => {
      e.preventDefault(); e.stopPropagation();
      // Read the video id NOW from the card's current link — cards get recycled
      // on scroll/navigation, so a value captured at decorate time can go stale.
      const link = host.querySelector('a[href*="/watch?v="], a[href*="/shorts/"]');
      const id = link && idFromHref(link.getAttribute("href"));
      if (!id) return;
      const url = "https://www.youtube.com/watch?v=" + id;
      if (selected.has(id)) { selected.delete(id); box.classList.remove("on"); }
      else { selected.set(id, url); box.classList.add("on"); }
      refreshPill();
    };
    box.addEventListener("click", toggle);
    box.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); });
    host.appendChild(box);
  }

  function scan() {
    document
      .querySelectorAll('a[href*="/watch?v="], a[href*="/shorts/"]')
      .forEach(decorate);
  }

  // YouTube is an SPA — re-scan as content streams in (debounced).
  let pending = false;
  function scheduleScan() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      scan();
      refreshPill(); // show/hide the pill as you navigate (e.g. onto a watch page)
      const n = document.querySelectorAll(".ytc-box").length;
      if (n !== scheduleScan._last) {
        scheduleScan._last = n;
        console.log("[yt-claude] checkboxes on page:", n);
      }
    });
  }
  const obs = new MutationObserver(scheduleScan);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  scheduleScan();
})();
