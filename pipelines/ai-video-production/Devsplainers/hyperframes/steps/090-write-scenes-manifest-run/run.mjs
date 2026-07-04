#!/usr/bin/env node
// 090 · write-scenes-manifest · [RUN] — thin wrapper over lib/scenes-manifest.mjs
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HF = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
process.exit(spawnSync(process.execPath, [join(HF, 'lib', 'scenes-manifest.mjs'), ...process.argv.slice(2)], { stdio: 'inherit' }).status ?? 1);
