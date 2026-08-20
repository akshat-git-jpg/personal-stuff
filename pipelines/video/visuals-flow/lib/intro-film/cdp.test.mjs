// Smoke test for the raw CDP client: launch -> goto -> eval -> close.
//
// Kept separate from check-clearance.test.mjs so a browser/protocol failure
// reads as "the driver is broken on this machine" rather than "the geometry is
// wrong". The STOP condition in plan 201 turns on exactly that distinction.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromePath, launch } from './cdp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Registered before any assert, and force-closes: a node:test file that opens a
// process and asserts before teardown hangs the runner forever with no output
// (LESSONS 2026-07-31).
let browser = null;
test.after(async () => {
  if (browser) { try { await browser.close(); } catch {} }
});

test('chromePath resolves the renderer-managed browser binary', { timeout: 240000 }, () => {
  const p = chromePath();
  assert.ok(typeof p === 'string' && p.length > 0);
  // Platform-agnostic: macOS/Linux give chrome-headless-shell, Windows the .exe.
  assert.match(p, /chrome/i);
});

test('launch, navigate to a composition, evaluate, and close', { timeout: 240000 }, async () => {
  browser = await launch();
  await browser.goto(path.join(HERE, 'fixtures', 'clearance-clean', 'index.html'));

  assert.equal(await browser.eval('1+1'), 2);

  // goto() must not return until the composition runtime is registered —
  // otherwise every caller races the inline script that defines it.
  assert.equal(await browser.eval("!!window.__timelines['clearance-clean']"), true);

  // The measured page is the real one, at the authored canvas size.
  assert.equal(await browser.eval("document.getElementById('root').getAttribute('data-width')"), '1920');
});

test('eval surfaces a page-side exception as a thrown error', { timeout: 240000 }, async () => {
  if (!browser) browser = await launch();
  await assert.rejects(() => browser.eval('throw new Error("boom")'), /boom/);
});
