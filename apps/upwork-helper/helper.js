/*
 * Upwork Helper
 *
 * Upwork's GraphQL responses carry the full `description` for every job in a
 * freelancer's work history, including the ones the UI renders as
 * "This job is private". This script captures those responses in the page
 * context, indexes them by job title / opening id, and puts the description
 * back on screen.
 *
 * Runs in the MAIN world, so it needs no chrome.* APIs and no permissions.
 */
(() => {
  'use strict';
  if (window.__uhelpLoaded) return;
  window.__uhelpLoaded = true;

  const MAX_BODY = 8 * 1024 * 1024;
  const MAX_ENTRIES = 800;
  const PRIVATE_RE = /this job is private/i;

  /** title-key -> {title, description, id, uid, seen} */
  const byTitle = new Map();
  /** opening/contract id -> same record */
  const byId = new Map();
  /** element -> how many times we failed to match it, so we can retry then stop */
  const attempts = new WeakMap();
  /** diagnostics: did our hook actually see traffic, and did bodies parse? */
  const stats = { fetch: 0, xhr: 0, parse: 0, inline: 0, json: 0, skipped: 0 };
  const VERSION = '1.2.0';

  const norm = (s) =>
    String(s)
      .toLowerCase()
      .replace(/[‐-―−]/g, '-') // en/em dash -> hyphen
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/\s+/g, ' ')
      .replace(/[.,:;!?]+$/, '')
      .trim();

  function remember(node) {
    const title = node.title;
    const description = node.description;
    if (typeof title !== 'string' || typeof description !== 'string') return;
    if (!title.trim() || !description.trim()) return;
    if (PRIVATE_RE.test(description)) return;

    const key = norm(title);
    const rec = byTitle.get(key) || { title, description, ids: [], seen: Date.now() };
    // keep the longest description we have seen for this title
    if (description.length >= rec.description.length) rec.description = description;
    rec.title = title;
    rec.seen = Date.now();
    byTitle.set(key, rec);

    for (const f of ['openingUid', 'id', 'ciphertext', 'clientTeamUid']) {
      const v = node[f];
      if (typeof v === 'string' && v) {
        byId.set(v, rec);
        if (!rec.ids.includes(v)) rec.ids.push(v);
      }
    }

    if (byTitle.size > MAX_ENTRIES) {
      const oldest = [...byTitle.entries()].sort((a, b) => a[1].seen - b[1].seen)[0];
      if (oldest) byTitle.delete(oldest[0]);
    }
  }

  function walk(value, depth) {
    if (depth > 14 || value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const v of value) walk(v, depth + 1);
      return;
    }
    remember(value);
    for (const k in value) {
      const v = value[k];
      if (v !== null && typeof v === 'object') walk(v, depth + 1);
    }
  }

  function ingest(text) {
    if (!text || text.length > MAX_BODY) {
      stats.skipped++;
      return;
    }
    const t = text.trimStart();
    if (t[0] !== '{' && t[0] !== '[') {
      stats.skipped++;
      return;
    }
    let data;
    try {
      data = JSON.parse(t);
    } catch {
      stats.skipped++;
      return;
    }
    stats.json++;
    const before = byTitle.size;
    walk(data, 0);
    if (byTitle.size !== before) {
      console.info('[upwork-helper] captured', byTitle.size, 'job descriptions');
      schedule();
    }
    updateBadge();
  }

  // ---------------------------------------------------------------- capture

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = function (...args) {
      stats.fetch++;
      const p = nativeFetch.apply(this, args);
      p.then((res) => {
        try {
          res.clone().text().then(ingest, () => {});
        } catch {
          /* opaque / already consumed */
        }
      }).catch(() => {});
      return p;
    };
  }

  const nativeSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    stats.xhr++;
    this.addEventListener('load', () => {
      try {
        const rt = this.responseType;
        if (rt === '' || rt === 'text') ingest(this.responseText);
        else if (rt === 'json' && this.response) {
          walk(this.response, 0);
          schedule();
          updateBadge();
        }
      } catch {
        /* cross-origin or binary */
      }
    });
    return nativeSend.apply(this, args);
  };

  /*
   * The catch-all. Hooking fetch/XHR only works if we land before the app
   * bundle captures them into a local (`const f = window.fetch`), which we
   * cannot guarantee — the injected page script arrives asynchronously.
   *
   * `JSON.parse` has no such problem: it is called as a property lookup on the
   * JSON namespace every single time, by every route the data can take (fetch,
   * XHR, a streamed RSC payload, an inline SSR blob). Whatever reaches the app
   * as an object passed through here first.
   */
  const nativeParse = JSON.parse;
  JSON.parse = function (text, reviver) {
    const out = nativeParse.call(this, text, reviver);
    try {
      if (
        typeof text === 'string' &&
        text.length < MAX_BODY &&
        text.includes('"description"') &&
        text.includes('"title"')
      ) {
        stats.parse++;
        const before = byTitle.size;
        walk(out, 0);
        if (byTitle.size !== before) {
          console.info('[upwork-helper] captured', byTitle.size, 'job descriptions');
          schedule();
        }
        updateBadge();
      }
    } catch {
      /* never let our bookkeeping break the page's own parse */
    }
    return out;
  };

  // Adjacent "title" / "description" string fields, in either order. Upwork's
  // assignment nodes put them side by side, which is enough to pair them up
  // without parsing a partial RSC stream as JSON.
  const STR = '((?:[^"\\\\]|\\\\.)*)';
  const PAIR_RE = new RegExp(`"title":"${STR}"\\s*,\\s*"description":"${STR}"`, 'g');
  const PAIR_RE_REVERSED = new RegExp(`"description":"${STR}"\\s*,\\s*"title":"${STR}"`, 'g');

  // Inline SSR / streamed payloads that were already in the HTML before we ran.
  const swept = new WeakSet();
  function sweepInlineScripts() {
    for (const s of document.querySelectorAll('script')) {
      if (swept.has(s)) continue;
      swept.add(s);
      const t = s.textContent;
      if (!t || t.length > MAX_BODY) continue;
      if (!t.includes('"description"') || !t.includes('"title"')) continue;
      stats.inline++;
      for (const re of [PAIR_RE, PAIR_RE_REVERSED]) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(t))) {
          const [a, b] = re === PAIR_RE ? [m[1], m[2]] : [m[2], m[1]];
          try {
            remember({ title: nativeParse(`"${a}"`), description: nativeParse(`"${b}"`) });
          } catch {
            /* not a clean JSON string literal */
          }
        }
      }
    }
    updateBadge();
  }

  // ------------------------------------------------------------------- DOM

  const CSS = `
  .uhelp-reveal{white-space:pre-wrap;font:inherit;color:inherit;margin:0}
  .uhelp-tag{display:inline-block;margin:0 0 8px;padding:2px 8px;border-radius:999px;
    background:#14a800;color:#fff;font:600 11px/1.6 system-ui,sans-serif;letter-spacing:.02em}
  .uhelp-fab{position:fixed;right:16px;bottom:16px;z-index:2147483000;
    padding:8px 12px;border-radius:999px;border:0;cursor:pointer;
    background:#14a800;color:#fff;font:600 12px/1 system-ui,sans-serif;
    box-shadow:0 4px 14px rgba(0,0,0,.25)}
  .uhelp-panel{position:fixed;right:16px;bottom:60px;z-index:2147483000;width:420px;
    max-width:calc(100vw - 32px);max-height:70vh;overflow:auto;background:#fff;color:#111;
    border:1px solid #d5d5d5;border-radius:12px;padding:12px;
    box-shadow:0 12px 40px rgba(0,0,0,.28);font:13px/1.5 system-ui,sans-serif}
  .uhelp-panel[hidden]{display:none}
  .uhelp-diag{font:11px/1.5 ui-monospace,monospace;opacity:.65;margin-bottom:8px;
    word-break:break-word}
  .uhelp-panel input{width:100%;box-sizing:border-box;padding:6px 8px;margin-bottom:10px;
    border:1px solid #ccc;border-radius:8px;font:13px system-ui,sans-serif}
  .uhelp-item{border-top:1px solid #eee;padding:8px 0}
  .uhelp-item summary{cursor:pointer;font-weight:600}
  .uhelp-item pre{white-space:pre-wrap;margin:8px 0 0;font:12px/1.5 ui-monospace,monospace}
  @media (prefers-color-scheme: dark){
    .uhelp-panel{background:#1c1c1c;color:#eee;border-color:#3a3a3a}
    .uhelp-panel input{background:#2a2a2a;color:#eee;border-color:#444}
    .uhelp-item{border-top-color:#333}
  }`;

  function injectCss() {
    if (document.getElementById('uhelp-css')) return;
    const s = document.createElement('style');
    s.id = 'uhelp-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  const HEADING_SEL = [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    '[role="heading"]',
    '[aria-level]',
    '[data-test*="title" i]',
    '[data-qa*="title" i]',
    '[class*="title" i]',
    '[class*="Title"]',
  ].join(',');

  /*
   * Every heading text between the private notice and the top of the document,
   * nearest first. This must NOT stop at the first heading it finds: the modal
   * puts a "Job description" label directly above the notice, so the first hit
   * is almost always a section label rather than the job title. The caller
   * matches the whole list against the store instead.
   */
  function headingCandidates(el) {
    const out = [];
    const seen = new Set();
    const add = (txt) => {
      if (!txt) return;
      const t = txt.trim();
      if (t.length < 7 || t.length > 400) return;
      if (PRIVATE_RE.test(t) || seen.has(t)) return;
      seen.add(t);
      out.push(t);
    };
    let node = el;
    for (let i = 0; i < 16 && node; i++) {
      if (node.matches && node.matches(HEADING_SEL)) add(node.textContent);
      if (node.querySelectorAll) for (const h of node.querySelectorAll(HEADING_SEL)) add(h.textContent);
      node = node.parentElement;
    }
    return out;
  }

  function lookup(el) {
    // 1. by an opening/contract id carried on a nearby link or data attribute
    let node = el;
    for (let i = 0; i < 8 && node; i++) {
      for (const attr of node.attributes || []) {
        const rec = byId.get(attr.value);
        if (rec) return rec;
      }
      const a = node.querySelector && node.querySelector('a[href]');
      if (a) {
        for (const part of a.getAttribute('href').split(/[/?&=#]/)) {
          const rec = byId.get(part) || byId.get(part.replace(/^~0/, ''));
          if (rec) return rec;
        }
      }
      node = node.parentElement;
    }
    // 2. by heading text — exact match over every candidate first
    const candidates = headingCandidates(el);
    for (const txt of candidates) {
      const rec = byTitle.get(norm(txt));
      if (rec) return rec;
    }
    // 3. fuzzy, longest candidate first (a job title is long; "Job description"
    //    and other section labels are short and match nothing anyway)
    for (const txt of [...candidates].sort((a, b) => b.length - a.length)) {
      const key = norm(txt);
      if (key.length < 12) continue;
      for (const [k, rec] of byTitle) {
        if (k.length >= 12 && (k.includes(key) || key.includes(k))) return rec;
      }
    }
    return null;
  }

  function reveal() {
    injectCss();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        PRIVATE_RE.test(n.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    const targets = [];
    let n;
    while ((n = walker.nextNode())) {
      const el = n.parentElement;
      if (el && !el.dataset.uhelpDone) targets.push(n);
    }
    for (const node of targets) {
      const el = node.parentElement;
      if (!el) continue;
      const rec = lookup(el);
      if (!rec) {
        // The modal often renders its body before its title, and the capture
        // may not have landed yet. Retry on later mutations instead of burning
        // the element on the first miss.
        const tries = (attempts.get(el) || 0) + 1;
        attempts.set(el, tries);
        if (tries > 40) el.dataset.uhelpDone = 'gave-up';
        continue;
      }
      el.dataset.uhelpDone = '1';
      const frag = document.createDocumentFragment();
      const tag = document.createElement('span');
      tag.className = 'uhelp-tag';
      tag.textContent = 'revealed';
      const body = document.createElement('p');
      body.className = 'uhelp-reveal';
      body.textContent = rec.description;
      frag.appendChild(tag);
      frag.appendChild(body);
      node.replaceWith(frag); // swap only the "This job is private" text node
    }
  }

  // ------------------------------------------------------------- side panel

  let fab, panel, list, search, diag;

  function buildPanel() {
    if (fab || !document.body) return;
    injectCss();
    fab = document.createElement('button');
    fab.className = 'uhelp-fab';
    fab.textContent = 'Jobs 0';
    fab.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) renderList();
    });

    panel = document.createElement('div');
    panel.className = 'uhelp-panel';
    panel.hidden = true;
    diag = document.createElement('div');
    diag.className = 'uhelp-diag';
    search = document.createElement('input');
    search.placeholder = 'Filter captured jobs…';
    search.addEventListener('input', renderList);
    list = document.createElement('div');
    panel.appendChild(diag);
    panel.appendChild(search);
    panel.appendChild(list);

    document.body.appendChild(fab);
    document.body.appendChild(panel);
  }

  function renderList() {
    if (!list) return;
    const q = norm(search.value);
    list.textContent = '';
    const recs = [...byTitle.values()]
      .filter((r) => !q || norm(r.title).includes(q) || norm(r.description).includes(q))
      .sort((a, b) => b.seen - a.seen);
    if (!recs.length) {
      const p = document.createElement('p');
      p.textContent = 'Nothing captured yet. Reload the page with the panel open.';
      list.appendChild(p);
      return;
    }
    for (const r of recs) {
      const d = document.createElement('details');
      d.className = 'uhelp-item';
      const s = document.createElement('summary');
      s.textContent = r.title;
      const pre = document.createElement('pre');
      pre.textContent = r.description;
      d.appendChild(s);
      d.appendChild(pre);
      list.appendChild(d);
    }
  }

  function updateBadge() {
    if (fab) fab.textContent = `Jobs ${byTitle.size}`;
    if (diag) {
      diag.textContent =
        `v${VERSION}  ·  fetch ${stats.fetch}  ·  xhr ${stats.xhr}  ·  ` +
        `parse ${stats.parse}  ·  inline ${stats.inline}  ·  captured ${byTitle.size}`;
    }
  }

  // ----------------------------------------------------------------- runner

  let timer = null;
  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (!document.body) return;
      buildPanel();
      try {
        sweepInlineScripts();
      } catch {
        /* keep going; the network hooks are the primary path */
      }
      updateBadge();
      try {
        reveal();
      } catch (e) {
        console.warn('[upwork-helper]', e);
      }
    }, 250);
  }

  function start() {
    console.info(
      `[upwork-helper] v${VERSION} armed — fetch + XHR + JSON.parse. Run __uhelp.hits() to check.`
    );
    buildPanel();
    try {
      sweepInlineScripts();
    } catch (e) {
      console.warn('[upwork-helper] inline sweep failed', e);
    }
    updateBadge();
    schedule();
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Debug handle. MAIN world, so this is reachable from the page console:
  //   __uhelp.count()  __uhelp.titles()  __uhelp.find('faceless')  __uhelp.retry()
  window.__uhelp = {
    byTitle,
    byId,
    stats,
    // fetch/xhr both 0 => the hook is not in the page's world (loader problem).
    // hits > 0 but json 0 => bodies are not JSON. json > 0 but count 0 => shape changed.
    hits: () => ({ ...stats, captured: byTitle.size }),
    count: () => byTitle.size,
    titles: () => [...byTitle.values()].map((r) => r.title),
    find: (q) =>
      [...byTitle.values()].filter(
        (r) => norm(r.title).includes(norm(q)) || norm(r.description).includes(norm(q))
      ),
    retry: () => {
      for (const el of document.querySelectorAll('[data-uhelp-done]')) delete el.dataset.uhelpDone;
      reveal();
      return byTitle.size;
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
