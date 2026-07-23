import fs from 'node:fs';
import { validateScript } from './schema.mjs';

const args = process.argv.slice(2);
let stage = 'generated';
let file = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--stage') {
    stage = args[++i];
  } else if (!file) {
    file = args[i];
  }
}

if (!file) {
  console.error("usage: node lib/lint-script.mjs <path/to/script.json> [--stage generated|polished]");
  process.exit(1);
}

const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
const result = validateScript(obj, { stage });

for (const w of result.warnings) {
  console.log(`WARN: ${w}`);
}
for (const e of result.errors) {
  console.error(`ERROR: ${e}`);
}

if (!result.ok) {
  process.exit(1);
}
