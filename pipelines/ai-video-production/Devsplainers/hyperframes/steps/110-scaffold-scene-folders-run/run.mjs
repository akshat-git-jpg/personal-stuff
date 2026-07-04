#!/usr/bin/env node
// 110 · scaffold-scene-folders · [RUN]
// Scaffolds the per-scene folders, then prints the two things this step is
// responsible for handing off: the preview SERVER command and the Antigravity
// HANDOFF command for the static build (120). Run from the project root:
//   node steps/110-scaffold-scene-folders-run/run.mjs --video <slug>
import { spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const slug = argv[argv.indexOf('--video') + 1] || '<slug>';

const r = spawnSync('node', ['lib/scaffold-scenes.mjs', ...argv], { stdio: 'inherit' });
if ((r.status ?? 0) !== 0) process.exit(r.status ?? 1);

console.log(`
── next (this step hands off two things) ─────────────────────────────
  🖥  SERVER   — preview gallery (leave running through step 170):
        node lib/serve.mjs
        → http://localhost:4321   (watch scenes fill in live)

  ⌨  HANDOFF  — copy the STATIC-build prompt into Antigravity (starts 120):
        node lib/handoff.mjs 120 --video ${slug}
        → then click Antigravity's chat and press ⌘V + Enter
──────────────────────────────────────────────────────────────────────`);
