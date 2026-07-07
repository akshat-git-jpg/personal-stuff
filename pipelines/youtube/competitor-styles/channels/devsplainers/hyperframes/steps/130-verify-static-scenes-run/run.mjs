#!/usr/bin/env node
// Thin wrapper → lib/verify-all.mjs for a video's scenes. Run from project root:
//   node steps/<this>/run.mjs --video <slug> [--jobs N]
import { spawnSync } from 'node:child_process';
const a = process.argv.slice(2);
const vi = a.indexOf('--video');
const video = vi >= 0 ? a[vi + 1] : 'test';
const rest = a.filter((_, i) => i !== vi && i !== vi + 1);
const r = spawnSync('node', ['lib/verify-all.mjs', `videos/${video}/scenes`, ...rest], { stdio: 'inherit' });
process.exit(r.status ?? 0);
