// intro-kit content gate. Every failure prints a grep-able "E-KIT-*" code.
// Renders each card headless via puppeteer-core, seeks its own registered
// GSAP timeline, and asserts on the RENDERED PIXELS and the RUNTIME DOM —
// never on source text. That is the whole point of this file: a card that
// renders its heading and an empty stage must fail here (LESSONS 2026-07-31).
//
// Cards are loaded directly via file:// from their own cards/<slug>/ folder
// (no temp-dir copy) so the per-card `logos`/`shots` symlinks resolve —
// fs.cpSync would copy those symlinks verbatim and break them one level
// deeper in a temp dir. Modelled on
// ../card-library/scripts/overflow-probe.mjs, which does the same
// evaluateOnNewDocument + window.__timelines seek trick in this repo.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const ROOT = process.cwd();
const CARDS_DIR = path.join(ROOT, 'cards');
const kit = JSON.parse(fs.readFileSync(path.join(ROOT, 'kit.json'), 'utf8'));

const failures = [];
function fail(code, msg) {
  failures.push(`${code}: ${msg}`);
}

/* =====================================================================
   Static-source checks — one pass per card file. Cheap, run before any
   browser launches so a source-level defect fails fast.
   ===================================================================== */

const APPROVED_HEX = new Set(['#3a1f08', '#0a0805', '#ffffff', '#fb923c', '#34d399', '#ef4444', '#facc15', '#000']);
const BANNED_MOVES = ['elastic', 'bounce', 'rotationY', 'rotationX', 'perspective'];

// Comments (HTML and JS) are prose, not code — "no spin, no bounce" in a
// comment must not trip the banned-move check. Strip them before any
// pattern-based content scan; structural attribute checks stay on the raw
// source since comments can't match those anyway.
function stripComments(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

if (kit.cards.length !== 7) fail('E-KIT-REG', `kit.json lists ${kit.cards.length} cards, want 7`);

const knownSlugs = new Set(kit.cards.map((c) => c.slug));
const dirEntries = fs.existsSync(CARDS_DIR)
  ? fs.readdirSync(CARDS_DIR).filter((d) => fs.statSync(path.join(CARDS_DIR, d)).isDirectory())
  : [];
for (const c of kit.cards) {
  if (!fs.existsSync(path.join(CARDS_DIR, c.slug, 'index.html'))) {
    fail('E-KIT-REG', `kit.json lists "${c.slug}" but cards/${c.slug}/index.html is missing`);
  }
}
for (const d of dirEntries) {
  if (!knownSlugs.has(d)) fail('E-KIT-REG', `cards/${d}/ exists but is not listed in kit.json`);
}

const overlaySlugs = kit.cards.filter((c) => c.overlay).map((c) => c.slug);
if (overlaySlugs.length !== 1 || overlaySlugs[0] !== 'lower-third') {
  fail('E-KIT-REG', `expected only "lower-third" to be overlay:true, got [${overlaySlugs.join(', ')}]`);
}

const sources = {};
for (const c of kit.cards) {
  const file = path.join(CARDS_DIR, c.slug, 'index.html');
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  sources[c.slug] = src;
  const code = stripComments(src);
  const id = c.slug.replace(/-/g, '');

  // E-KIT-CANVAS
  if (!/data-width="1920"/.test(src)) fail('E-KIT-CANVAS', `${c.slug}: missing data-width="1920"`);
  if (!/data-height="1080"/.test(src)) fail('E-KIT-CANVAS', `${c.slug}: missing data-height="1080"`);
  if (!/data-start="0"/.test(src)) fail('E-KIT-CANVAS', `${c.slug}: missing data-start="0"`);

  // E-KIT-TIMELINE
  const timelineRe = new RegExp(`__timelines\\[['"]${id}['"]\\]\\s*=`);
  if (!timelineRe.test(src)) fail('E-KIT-TIMELINE', `${c.slug}: no window.__timelines['${id}'] registration`);

  // E-KIT-DURATION
  if (!/VARS\.duration/.test(src)) fail('E-KIT-DURATION', `${c.slug}: missing VARS.duration in the DURATION block`);
  const durAttrs = [...src.matchAll(/data-duration="([^"]*)"/g)].map((m) => m[1]);
  for (const d of durAttrs) {
    if (d !== '0') fail('E-KIT-DURATION', `${c.slug}: hard-coded data-duration="${d}" (must be "0" — the DURATION block overwrites it at runtime)`);
  }

  // E-KIT-TOKEN
  for (const tok of ['--bg-to', '--text', '--accent']) {
    if (!code.includes(tok)) fail('E-KIT-TOKEN', `${c.slug}: :root missing ${tok}`);
  }
  const hexHits = [...code.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
  for (const h of hexHits) {
    if (!APPROVED_HEX.has(h)) fail('E-KIT-TOKEN', `${c.slug}: unapproved hex colour ${h}`);
  }

  // E-KIT-MOVE
  for (const b of BANNED_MOVES) {
    if (code.includes(b)) fail('E-KIT-MOVE', `${c.slug}: banned move/property "${b}"`);
  }
  if (/blur\(/.test(code) && c.slug !== 'logo-grid') {
    fail('E-KIT-MOVE', `${c.slug}: blur() used outside logo-grid's documented exception`);
  }

  // E-KIT-ACCENT — a card that colours a word (uses .word / beats) must resolve
  // the accent via getComputedStyle at build time, and must never colour a word
  // span through a static CSS rule or a GSAP `color:` tween (both render white
  // in the real pipeline — see the exemplar's ACCENT comment).
  const coloursWords = /class="word"|\.word\b/.test(code) && /beats/.test(code);
  if (coloursWords) {
    const hasComputedStyleLiteral = /getComputedStyle\(document\.documentElement\)\.getPropertyValue\(['"]--accent['"]\)/.test(code);
    if (!hasComputedStyleLiteral) fail('E-KIT-ACCENT', `${c.slug}: colours words but has no getComputedStyle ACCENT literal`);
    if (/\.word[^{}]*\{[^{}]*color:\s*var\(--accent\)/.test(code)) {
      fail('E-KIT-ACCENT', `${c.slug}: a static CSS rule colours .word with var(--accent) directly`);
    }
    if (/color:\s*['"]var\(--accent\)['"]/.test(code)) {
      fail('E-KIT-ACCENT', `${c.slug}: a GSAP/inline tween sets color to the literal string var(--accent)`);
    }
  }
}

/* =====================================================================
   E-KIT-DEVICE — render every card, seek its timeline, assert on pixels
   and runtime DOM.
   ===================================================================== */

function resolveChrome() {
  const out = execSync('npx --yes hyperframes@latest browser path', { encoding: 'utf8' });
  const lines = out.trim().split('\n');
  const exe = lines[lines.length - 1].trim();
  if (!fs.existsSync(exe)) {
    throw new Error(`Chrome not found at ${exe}. Run: npx hyperframes@latest browser ensure`);
  }
  return exe;
}

const GRID_COLS = 192, GRID_ROWS = 108;

async function captureLumGrid(page) {
  const b64 = await page.screenshot({ encoding: 'base64', type: 'png' });
  return page.evaluate(
    (b64png, cols, rows) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = cols;
          c.height = rows;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, cols, rows);
          const data = ctx.getImageData(0, 0, cols, rows).data;
          const lum = new Array(cols * rows);
          for (let p = 0, i = 0; p < data.length; p += 4, i++) {
            lum[i] = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
          }
          resolve(lum);
        };
        img.src = 'data:image/png;base64,' + b64png;
      }),
    b64,
    GRID_COLS,
    GRID_ROWS,
  );
}

function brightPct(grid, threshold = 40) {
  return grid.filter((v) => v > threshold).length / grid.length;
}
function diffPct(a, b, threshold = 15) {
  let changed = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > threshold) changed++;
  return changed / a.length;
}

async function seekAndCapture(page, fracTimes, dur) {
  const grids = [];
  for (const frac of fracTimes) {
    const t = +(dur * frac).toFixed(3);
    await page.evaluate((time) => {
      const tl = Object.values(window.__timelines || {})[0];
      tl.pause();
      tl.time(Math.min(time, tl.duration()));
    }, t);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    grids.push(await captureLumGrid(page));
  }
  return grids;
}

async function domSnapshot(page, slug) {
  return page.evaluate((slug) => {
    if (slug === 'checklist') {
      const rows = document.querySelectorAll('#rows > *');
      return { rowsCount: rows.length, rowsText: [...rows].map((r) => r.textContent.trim()) };
    }
    if (slug === 'logo-grid') {
      const tiles = document.querySelectorAll('.tile');
      const opac = [...tiles].map((t) => parseFloat(getComputedStyle(t).opacity) || 0);
      return { tileCount: tiles.length, meanOpacity: opac.length ? opac.reduce((a, b) => a + b, 0) / opac.length : 0 };
    }
    if (slug === 'shot-float') {
      const shots = document.querySelectorAll('.shot');
      return { shotCount: shots.length, transforms: [...shots].map((s) => getComputedStyle(s).transform) };
    }
    if (slug === 'chain') {
      const paths = document.querySelectorAll('#lines path');
      return {
        itemCount: document.querySelectorAll('.item').length,
        dashoffsets: [...paths].map((p) => parseFloat(getComputedStyle(p).strokeDashoffset) || 0),
      };
    }
    if (slug === 'ui-mock') {
      const win = document.getElementById('window');
      return { borderColor: getComputedStyle(win).borderColor };
    }
    return {};
  }, slug);
}

function rgbToHexIfPossible(rgb) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || '');
  if (!m) return null;
  const [, r, g, b] = m.map(Number);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

const FRACS = [0.15, 0.35, 0.55, 0.75, 0.95];

async function checkCard(browser, cardCfg) {
  const slug = cardCfg.slug;
  const file = pathToFileURL(path.join(CARDS_DIR, slug, 'index.html')).href;
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  try {
    await page.goto(file);
    try {
      await page.waitForFunction('!!window.__timelines && Object.values(window.__timelines).length > 0', { timeout: 10000 });
    } catch {
      fail('E-KIT-DEVICE', `${slug}: timelines never registered (render would hang)`);
      return;
    }
    const dur = await page.evaluate(() => Object.values(window.__timelines)[0].duration());
    const grids = await seekAndCapture(page, FRACS, dur);
    const [g15, , , g75, g95] = grids;

    const b15 = brightPct(g15);
    const b95 = brightPct(g95);
    const delta = diffPct(g15, g95);

    if (b95 <= 0.025) fail('E-KIT-DEVICE', `${slug}: 95% frame is only ${(b95 * 100).toFixed(2)}% bright (blank final frame)`);
    if (delta <= 0.015) fail('E-KIT-DEVICE', `${slug}: 95% frame differs from 15% by only ${(delta * 100).toFixed(2)}% of pixels (nothing moved)`);

    if (slug === 'statement' || slug === 'lower-third') {
      if (!(b95 >= b15 * 1.6)) {
        fail('E-KIT-DEVICE', `${slug}: bright-pixel growth ${b15.toFixed(4)} -> ${b95.toFixed(4)} is below the 1.6x floor (words did not accumulate)`);
      }
    }

    if (slug === 'checklist') {
      // Re-seek to 95% for the DOM snapshot — the last capture already left
      // the timeline there, but be explicit rather than relying on it.
      const dom = await domSnapshot(page, slug);
      if (dom.rowsCount < 2) fail('E-KIT-DEVICE', `${slug}: #rows has ${dom.rowsCount} children at 95%, want >= 2`);
      if (dom.rowsText.some((t) => !t)) fail('E-KIT-DEVICE', `${slug}: a row has empty text at 95%`);
    }

    if (slug === 'logo-grid') {
      const dom = await domSnapshot(page, slug);
      if (dom.tileCount < 6) fail('E-KIT-DEVICE', `${slug}: only ${dom.tileCount} tile elements, want >= 6`);
      if (!(dom.meanOpacity < 0.5)) fail('E-KIT-DEVICE', `${slug}: mean tile opacity at 95% is ${dom.meanOpacity.toFixed(3)}, want < 0.5 (tiles never dimmed)`);
    }

    if (slug === 'shot-float') {
      // Compare the DOM transform at an early time vs 95% to prove drift.
      await page.evaluate((t) => {
        const tl = Object.values(window.__timelines)[0];
        tl.time(t);
      }, +(dur * 0.35).toFixed(3));
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
      const early = await domSnapshot(page, slug);
      await page.evaluate((t) => {
        const tl = Object.values(window.__timelines)[0];
        tl.time(t);
      }, +(dur * 0.95).toFixed(3));
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
      const late = await domSnapshot(page, slug);
      if (late.shotCount < 3) fail('E-KIT-DEVICE', `${slug}: only ${late.shotCount} shot elements, want >= 3`);
      const anyDrifted = late.transforms.some((t, i) => t !== early.transforms[i]);
      if (!anyDrifted) fail('E-KIT-DEVICE', `${slug}: no shot's transform changed between 35% and 95% (nothing drifted)`);
    }

    if (slug === 'chain') {
      const dom = await domSnapshot(page, slug);
      if (dom.itemCount < 2) fail('E-KIT-DEVICE', `${slug}: only ${dom.itemCount} items, want >= 2`);
      for (const off of dom.dashoffsets) {
        if (Math.abs(off) > 1) fail('E-KIT-DEVICE', `${slug}: a connector's stroke-dashoffset is ${off} at 95%, want within 1 of 0`);
      }
    }

    if (slug === 'ui-mock') {
      const dom = await domSnapshot(page, slug);
      const hex = rgbToHexIfPossible(dom.borderColor);
      if (hex !== '#fb923c') fail('E-KIT-DEVICE', `${slug}: "ok" state border resolved to ${dom.borderColor}, want the accent`);

      // Second pass: state:"fail".
      const page2 = await browser.newPage();
      await page2.setViewport({ width: 1920, height: 1080 });
      try {
        await page2.evaluateOnNewDocument((vars) => {
          window.__hyperframes = { getVariables: () => vars };
        }, { state: 'fail', duration: 3.5 });
        await page2.goto(file);
        await page2.waitForFunction('!!window.__timelines && Object.values(window.__timelines).length > 0', { timeout: 10000 });
        const dur2 = await page2.evaluate(() => Object.values(window.__timelines)[0].duration());
        const grids2 = await seekAndCapture(page2, FRACS, dur2);
        const failDom = await domSnapshot(page2, slug);
        const failHex = rgbToHexIfPossible(failDom.borderColor);
        if (failHex !== '#ef4444') fail('E-KIT-DEVICE', `${slug}: "fail" state border resolved to ${failDom.borderColor}, want #ef4444`);
        // Sample at 95%, NOT 75%, and gate at 0.05% — both deliberate, both
        // measured (2026-08-22). This check used to read grids[3] (75%) against
        // a 0.5% threshold and was FLAKY: it passed 3 runs in 4.
        //
        // Why. `fail` fires a one-off horizontal shake (x: ±6) at T(0.55). At
        // 75% that shake has sometimes settled and sometimes not. Unsettled, the
        // whole window sits ~6px off — at GRID_COLS=192 that is ~0.6 of a cell,
        // so every edge cell in the frame changes and the diff jumps well past
        // 0.5%. Settled, the ONLY difference between the two states is the
        // recoloured stroke/button/title, which measures 0.140%. So the old gate
        // was really asserting "the shake happened to still be running", and it
        // failed whenever the animation was on time.
        //
        // 95% is after the shake in both states, so the diff is purely the
        // recolour and is deterministic. Both sides of the threshold were then
        // measured (2026-08-22), which is what makes 0.05% a calibration rather
        // than a guess:
        //
        //   working card, state honoured .......... 0.140%   (passes)
        //   ---- gate at 0.05% ----
        //   mutated card, state ignored ........... 0.019%   (fails)
        //
        // So 0.05% sits with ~2.8x margin under the working value and ~2.6x over
        // the broken one. The mutation used to measure the lower bound sets
        // STATE_STROKE.fail = ACCENT and disables the shake branch, i.e. it makes
        // `fail` render identically to `ok` — the exact defect this asserts on.
        //
        // Note diffPct compares LUMINANCE. #fb923c (luma ~168) vs #ef4444
        // (luma ~119) differ by ~49, comfortably over diffPct's own threshold of
        // 15, which is why a hue swap registers here at all. Do not re-tighten
        // this number without re-measuring; the exact border colours are already
        // asserted above, and those are the precise state-token test.
        const crossDiff = diffPct(grids[4], grids2[4]); // index 4 == 95%, after the shake
        if (crossDiff <= 0.0005) {
          fail('E-KIT-DEVICE', `${slug}: ok vs fail 95% frames differ by only ${(crossDiff * 100).toFixed(3)}% of pixels, want > 0.05% — the state token did not reach the pixels`);
        }
      } finally {
        await page2.close();
      }
    }
  } finally {
    await page.close();
  }
}

let browserRef = null;
// A thrown error mid-run, or a Ctrl-C, must not leave a headless Chrome
// process running at 0% CPU forever (LESSONS 2026-07-31) — this is a
// synchronous backstop; the normal path closes the browser in main()'s
// finally block below.
process.on('exit', () => {
  const proc = browserRef && browserRef.process && browserRef.process();
  if (proc && !proc.killed) proc.kill('SIGKILL');
});

async function main() {
  // Optional slug filter for local iteration: `node lib/check-kit.mjs <slug>`.
  // scripts/check.sh (the real gate) always calls this with no args, which
  // checks every card.
  const only = process.argv[2];
  const executablePath = resolveChrome();
  const browser = await puppeteer.launch({ executablePath, defaultViewport: { width: 1920, height: 1080 } });
  browserRef = browser;
  try {
    for (const c of kit.cards) {
      if (only && c.slug !== only) continue;
      if (!sources[c.slug]) continue; // already reported missing above
      await checkCard(browser, c);
    }
  } finally {
    await browser.close();
  }
}

// A puppeteer handle left open hangs the gate forever at 0% CPU with no
// output (LESSONS 2026-07-31). Always tear down, even on a thrown error,
// and force-close as a backstop if something above still leaks a handle.
main()
  .then(() => {
    if (failures.length) {
      for (const f of failures) console.error(f);
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
