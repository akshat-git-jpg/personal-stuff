#!/usr/bin/env node
/* ============================================================================
   scaffold-scenes.mjs — create the per-scene folders for a video from its
   scene manifest. Run from the hyperframes/ project root:
     node lib/scaffold-scenes.mjs --video test

   Reads  videos/<slug>/scenes.json  — an array from the storyboard step (010):
     [ { "n": 1, "slug": "hook-sees-hears", "dur": 8 }, ... ]
   Writes videos/<slug>/scenes/sNN-<slug>/ each with:
     - a `kit` symlink -> the shared kit (root-relative asset paths resolve through it)
     - meta.json
     - a static starter index.html (chrome + watermark + empty timeline + TODO body)
   Idempotent: never overwrites an index.html that already exists (won't clobber
   scenes the driver has already built). Zero third-party deps.
   ============================================================================ */
import { readFileSync, existsSync, mkdirSync, writeFileSync, symlinkSync, lstatSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const vi = args.indexOf('--video');
const VIDEO = vi >= 0 ? args[vi + 1] : 'test';
const manifest = join(ROOT, 'videos', VIDEO, 'scenes.json');
if (!existsSync(manifest)) {
  console.error(`no manifest: videos/${VIDEO}/scenes.json (step 010 emits it)`);
  process.exit(2);
}
const scenes = JSON.parse(readFileSync(manifest, 'utf8'));
let made = 0, skipped = 0;

for (const s of scenes) {
  const nn = String(s.n).padStart(2, '0');
  const dir = join(ROOT, 'videos', VIDEO, 'scenes', `s${nn}-${s.slug}`);
  mkdirSync(dir, { recursive: true });

  // kit symlink -> hyperframes/kit  (dir is 4 levels deep: videos/<v>/scenes/sNN)
  const link = join(dir, 'kit');
  try {
    if (lstatSync(link)) { /* exists */ }
  } catch { symlinkSync('../../../../kit', link); }

  writeFileSync(join(dir, 'meta.json'), `{\n  "id": "main",\n  "name": "s${nn}-${s.slug}"\n}\n`);

  const idx = join(dir, 'index.html');
  if (existsSync(idx)) { skipped++; continue; } // don't clobber built scenes
  writeFileSync(idx, starter(nn, s.slug, s.dur));
  made++;
}
console.log(`scaffolded videos/${VIDEO}/scenes: ${made} created, ${skipped} already existed`);

function starter(nn, slug, dur) {
  return `<!doctype html>
<!-- ============================================================================
  STATIC PASS · scene ${nn} · ${slug}
  Build the FINAL-FRAME look for row ${Number(nn)} of ../../storyboard.md.
  Rules: compose ONLY from kit atoms (kit/atoms.md) + tokens; NO motion this pass
  (leave the timeline empty — the motion step adds it). Assets are root-relative
  "kit/..." and resolve through the ./kit symlink. Keep the watermark. Verify:
    node lib/verify.mjs videos/<slug>/scenes/s${nn}-${slug}
============================================================================ -->
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <link rel="stylesheet" href="kit/tokens.css" />
    <link rel="stylesheet" href="kit/atoms.css" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script src="kit/recipes.js"></script>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${dur}" data-width="1920" data-height="1080">
      <div id="clip-watermark" class="clip" data-start="0" data-duration="${dur}" data-track-index="0">
        <div class="watermark">&lt;devsplainers&gt;</div>
      </div>
      <!-- TODO(static): build scene ${nn} body from storyboard row ${Number(nn)}. -->
      <div id="clip-body" class="clip" data-start="0" data-duration="${dur}" data-track-index="1">
        <div id="body" class="stage-center">
          <h1 class="headline">SCENE ${nn} — TODO</h1>
        </div>
      </div>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      window.__timelines['main'] = tl;
    </script>
  </body>
</html>
`;
}
