/*
 * Isolated-world loader.
 *
 * `world: "MAIN"` in the manifest is the clean way to patch the page's own
 * fetch/XHR, but not every Chromium build honours it — and when it silently
 * falls back to the isolated world the DOM half of the extension still works
 * while capture sees nothing (symptom: the panel says "Jobs 0" forever).
 *
 * So we also inject helper.js as a real page script. helper.js guards on
 * `window.__uhelpLoaded`, so whichever path lands first wins and the other is
 * a no-op.
 */
(() => {
  'use strict';
  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('helper.js');
    s.async = false; // run as soon as it arrives, keep document order
    s.dataset.uhelpLoader = '1';
    s.addEventListener('load', () => s.remove());
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.warn('[upwork-helper] loader failed', e);
  }
})();
