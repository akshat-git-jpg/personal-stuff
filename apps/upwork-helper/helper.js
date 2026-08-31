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
    if (!text || text.length > MAX_BODY) return;
    const t = text.trimStart();
    if (t[0] !== '{' && t[0] !== '[') return;
    let data;
    try {
      data = JSON.parse(t);
    } catch {
      return;
    }
    const before = byTitle.size;
    walk(data, 0);
    if (byTitle.size !== before) schedule();
    updateBadge();
  }

  // ---------------------------------------------------------------- capture

  const nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = function (...args) {
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

  function headingFor(el) {
    let node = el;
    for (let i = 0; i < 14 && node; i++) {
      const h = node.querySelector && node.querySelector('h1,h2,h3,h4,[role="heading"]');
      if (h) {
        const txt = h.textContent.trim();
        if (txt && !PRIVATE_RE.test(txt)) return txt;
      }
      node = node.parentElement;
    }
    return null;
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
    // 2. by heading text
    const title = headingFor(el);
    if (!title) return null;
    const key = norm(title);
    if (byTitle.has(key)) return byTitle.get(key);
    for (const [k, rec] of byTitle) {
      if (k.includes(key) || key.includes(k)) return rec;
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
      el.dataset.uhelpDone = '1';
      const rec = lookup(el);
      if (!rec) continue;
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

  let fab, panel, list, search;

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
    search = document.createElement('input');
    search.placeholder = 'Filter captured jobs…';
    search.addEventListener('input', renderList);
    list = document.createElement('div');
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
  }

  // ----------------------------------------------------------------- runner

  let timer = null;
  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (!document.body) return;
      buildPanel();
      updateBadge();
      try {
        reveal();
      } catch (e) {
        console.warn('[upwork-helper]', e);
      }
    }, 250);
  }

  function start() {
    buildPanel();
    updateBadge();
    schedule();
    new MutationObserver(schedule).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
