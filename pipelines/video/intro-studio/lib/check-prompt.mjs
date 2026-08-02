import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from './workdir.mjs';
import { INTENTS, REGISTERS, FACE_MODES, TRANSITIONS } from './screenplay-schema.mjs';

const PROMPT = path.join(rootDir(), 'steps/020-write-screenplay-llm/screenplay-prompt.md');
const REQUIRED_HEADINGS = [
  '## Your job',
  '## What makes an intro good',
  '## The default arc',
  '## The schema',
  '## Continuity is the requirement',
  '## The face',
  '## Rules you will be linted against',
  '## Output',
];
const REQUIRED_CODES = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'W1', 'W2', 'W3', 'W4'];
const REQUIRED_PLACEHOLDERS = ['{{TRANSCRIPT}}', '{{INTRO_DURATION}}', '{{SLUG}}'];

const text = fs.readFileSync(PROMPT, 'utf8');
const missing = [];
for (const h of REQUIRED_HEADINGS) if (!text.includes(h)) missing.push(`heading ${h}`);
for (const c of REQUIRED_CODES) if (!text.includes(c)) missing.push(`lint code ${c}`);
for (const p of REQUIRED_PLACEHOLDERS) if (!text.includes(p)) missing.push(`placeholder ${p}`);
// Every enum value the model must emit has to be named in the prompt, or it
// will invent one and fail E5 at lint time.
for (const v of [...INTENTS, ...REGISTERS, ...FACE_MODES, ...TRANSITIONS]) {
  if (!text.includes(`\`${v}\``)) missing.push(`enum value \`${v}\``);
}
if (missing.length) {
  console.error(`screenplay-prompt.md is missing:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log('prompt OK');
