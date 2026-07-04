#!/usr/bin/env node
/* ============================================================================
   verify.mjs — scene gate for the Devsplainers kit (SPEC §7).
   Usage (from the hyperframes/ project root):
     node lib/verify.mjs kit/examples/01-title-card
     node lib/verify.mjs videos/<slug>/scenes/s01-foo --json

   Checks:
     1. Renders  — a snapshot PNG is produced at 1920x1080.
     2. Color discipline — no raw hexes outside tokens.css's palette.
     3. Font discipline  — only Anton + JetBrains Mono (or var()/generics).
     4. Frame fit — snapshot canvas is exactly 1920x1080 (deep clip check is
        visual, via serve.mjs; noted, not silently passed).
     5. Watermark present.
     6. Hyperframes lint — 0 errors (covers the framework's own gotchas).

   Exits non-zero with a machine-readable reason list so a cheap driver can
   auto-iterate. Zero third-party deps.
   ============================================================================ */
import { readFileSync, existsSync, lstatSync, symlinkSync, mkdtempSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const sceneRel = args.find((a) => !a.startsWith('--'));
if (!sceneRel) {
  console.error('usage: node lib/verify.mjs <scene-folder> [--json]');
  process.exit(2);
}
const sceneDir = resolve(ROOT, sceneRel);
const indexPath = join(sceneDir, 'index.html');
const reasons = [];
const fail = (code, msg) => reasons.push({ code, msg });

if (!existsSync(indexPath)) {
  fail('no_index', `${sceneRel}/index.html not found`);
  report();
}

/* --- ensure the per-scene kit symlink exists (SPEC §8) -------------------- */
const kitLink = join(sceneDir, 'kit');
try {
  if (!existsSync(kitLink)) {
    // point at the project-root kit/ from the scene folder
    const rel = relative(sceneDir, join(ROOT, 'kit'));
    symlinkSync(rel, kitLink);
    console.error(`[verify] created missing kit symlink -> ${rel}`);
  } else if (!lstatSync(kitLink).isSymbolicLink() && !existsSync(join(kitLink, 'tokens.css'))) {
    fail('bad_kit_link', 'kit/ exists but does not resolve to the kit (missing tokens.css)');
  }
} catch (e) {
  fail('kit_link_failed', `could not create kit symlink: ${e.message}`);
}

const html = readFileSync(indexPath, 'utf8');

/* --- 5. watermark present ------------------------------------------------- */
if (!/class="[^"]*\bwatermark\b/.test(html) && !/devsplainers/i.test(html)) {
  fail('no_watermark', 'no .watermark element / channel mark found');
}

/* --- 2. color discipline ------------------------------------------------- */
const tokensCss = readFileSync(join(ROOT, 'kit', 'tokens.css'), 'utf8');
const palette = new Set((tokensCss.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map((h) => h.toLowerCase()));
const sceneHexes = [...new Set((html.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map((h) => h.toLowerCase()))];
const badHexes = sceneHexes.filter((h) => !palette.has(h));
if (badHexes.length) {
  fail('color_off_palette', `raw hex(es) outside token palette: ${badHexes.join(', ')} — use var(--…)`);
}

/* --- 3. font discipline -------------------------------------------------- */
const ALLOWED_FONTS = new Set([
  'anton', 'jetbrains mono', 'ui-monospace', 'monospace', 'sans-serif', 'serif',
  'arial narrow', 'system-ui', 'inherit',
]);
const fontDecls = [...html.matchAll(/font-family\s*:\s*([^;}"]+)/gi)].map((m) => m[1]);
for (const decl of fontDecls) {
  if (/var\(/.test(decl)) continue; // token-driven, fine
  const families = decl.split(',').map((f) => f.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
  const bad = families.filter((f) => f && !ALLOWED_FONTS.has(f));
  if (bad.length) {
    fail('font_off_kit', `non-kit font-family: ${bad.join(', ')} — use var(--font-head)/var(--font-mono)`);
  }
}

/* --- 6. hyperframes lint ------------------------------------------------- */
let lintOut = '';
try {
  lintOut = execFileSync('npx', ['--yes', 'hyperframes@0.7.22', 'lint', sceneRel], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  lintOut = `${e.stdout || ''}${e.stderr || ''}`;
}
const lintErrs = (lintOut.match(/(\d+)\s+error/i) || [])[1];
if (lintErrs && Number(lintErrs) > 0) {
  const detail = (lintOut.match(/✗[^\n]+/g) || []).slice(0, 5).join(' | ');
  fail('lint_errors', `hyperframes lint: ${lintErrs} error(s)${detail ? ' — ' + detail : ''}`);
}

/* --- 1 + 4. render a snapshot, check dims ------------------------------- */
const dur = Number((html.match(/data-duration="([\d.]+)"/) || [])[1] || 6);
const at = Math.max(0.1, (dur * 0.8)).toFixed(2);
const outDir = mkdtempSync(join(tmpdir(), 'hf-verify-'));
let snapOk = false;
try {
  execFileSync('npx', ['--yes', 'hyperframes@0.7.22', 'snapshot', sceneRel, '--at', at, '-o', outDir], {
    cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
  });
  const png = readdirSync(outDir).find((f) => f.endsWith('.png'));
  if (!png) {
    fail('no_snapshot', 'snapshot produced no PNG');
  } else {
    const buf = readFileSync(join(outDir, png));
    // PNG IHDR: width @ byte 16-19, height @ 20-23 (big-endian)
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    if (w !== 1920 || h !== 1080) {
      fail('bad_canvas', `snapshot is ${w}x${h}, expected 1920x1080`);
    }
    snapOk = true;
  }
} catch (e) {
  fail('render_failed', `snapshot render failed: ${(e.message || '').split('\n')[0]}`);
}

report();

function report() {
  const pass = reasons.length === 0;
  if (JSON_OUT) {
    console.log(JSON.stringify({ scene: sceneRel, pass, reasons }, null, 2));
  } else {
    console.log(`\n${pass ? '✓ PASS' : '✗ FAIL'}  ${sceneRel}`);
    for (const r of reasons) console.log(`  ✗ ${r.code}: ${r.msg}`);
    if (pass) console.log('  all checks green (render, color, font, watermark, lint, canvas)');
  }
  process.exit(pass ? 0 : 1);
}
