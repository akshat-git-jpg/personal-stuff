#!/usr/bin/env node
// Thin wrapper → lib/measure-durations.mjs. Run from the project root:
//   node steps/060-measure-durations-run/run.mjs --video <slug>
import { spawnSync } from 'node:child_process';
const r = spawnSync('node', ['lib/measure-durations.mjs', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 0);
