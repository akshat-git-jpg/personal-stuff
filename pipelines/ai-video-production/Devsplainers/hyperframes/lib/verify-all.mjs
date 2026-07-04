#!/usr/bin/env node
/* ============================================================================
   verify-all.mjs — verify every scene in a video, in a controlled parallel pool.
   Run from the hyperframes/ project root:
     node lib/verify-all.mjs                       # defaults to videos/test/scenes
     node lib/verify-all.mjs videos/test/scenes    # explicit scenes dir
     node lib/verify-all.mjs videos/test/scenes --jobs 4

   Why: rendering is the slow part (headless Chrome), and the 31 scenes are
   independent — so the fast workflow is "author all HTML first, then batch
   verify". Concurrency is capped (default 3) so parallel renders don't thrash a
   16 GB machine. Scenes still carrying the scaffold TODO marker are reported as
   `todo` (not yet built) rather than falsely passing.
   ============================================================================ */
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const args = process.argv.slice(2);
const jobsFlag = args.indexOf('--jobs');
const JOBS = jobsFlag >= 0 ? Math.max(1, Number(args[jobsFlag + 1]) || 3) : 3;
const scenesRel = args.find((a) => !a.startsWith('--') && a !== String(JOBS)) || 'videos/test/scenes';
const scenesDir = resolve(ROOT, scenesRel);

if (!existsSync(scenesDir)) {
  console.error(`scenes dir not found: ${scenesRel}`);
  process.exit(2);
}

const scenes = readdirSync(scenesDir).sort()
  .filter((d) => existsSync(join(scenesDir, d, 'index.html')))
  .map((d) => {
    const rel = `${scenesRel}/${d}`;
    const html = readFileSync(join(scenesDir, d, 'index.html'), 'utf8');
    const todo = /TODO\(static\)|—\s*TODO/.test(html);
    return { name: d, rel, todo };
  });

if (!scenes.length) { console.error('no scenes found'); process.exit(2); }

function verifyOne(scene) {
  return new Promise((res) => {
    const p = spawn('node', ['lib/verify.mjs', scene.rel, '--json'], { cwd: ROOT });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.on('close', () => {
      let r = { pass: false, reasons: [{ code: 'no_output', msg: 'no json' }] };
      try { r = JSON.parse(out); } catch {}
      res({ ...scene, pass: r.pass, reasons: r.reasons || [] });
    });
  });
}

// simple concurrency pool
const queue = [...scenes];
const results = [];
let active = 0;
await new Promise((done) => {
  const pump = () => {
    if (!queue.length && active === 0) return done();
    while (active < JOBS && queue.length) {
      const s = queue.shift();
      active++;
      process.stdout.write(`  … ${s.name}\r`);
      verifyOne(s).then((r) => { results.push(r); active--; pump(); });
    }
  };
  pump();
});

results.sort((a, b) => a.name.localeCompare(b.name));
const built = results.filter((r) => !r.todo);
const passed = built.filter((r) => r.pass);
const failed = built.filter((r) => !r.pass);
const todo = results.filter((r) => r.todo);

console.log(`\nVerify — ${scenesRel}  (jobs=${JOBS})\n`);
for (const r of results) {
  const tag = r.todo ? '· todo ' : r.pass ? '✓ pass ' : '✗ FAIL ';
  console.log(`  ${tag} ${r.name}${!r.todo && !r.pass ? '  — ' + r.reasons.map((x) => x.code).join(', ') : ''}`);
}
console.log(`\n  built ${built.length}/${results.length} · pass ${passed.length} · fail ${failed.length} · todo ${todo.length}`);
if (failed.length) {
  console.log('\n  failures:');
  for (const r of failed) for (const x of r.reasons) console.log(`    ${r.name}: ${x.code} — ${x.msg}`);
}
process.exit(failed.length ? 1 : 0);
