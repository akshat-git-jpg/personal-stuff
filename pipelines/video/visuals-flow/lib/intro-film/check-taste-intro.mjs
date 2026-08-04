import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export function checkTasteIntro({ taste, authoring }) {
  const errors = [];
  if (!authoring.includes('TASTE-INTRO.md')) {
    errors.push('AUTHORING.md is missing reference to TASTE-INTRO.md');
  }

  const rules = [];
  const lines = taste.split('\n');
  let currentRule = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^## T(\d+)\s*—/);
    if (match) {
      if (currentRule) {
        rules.push(currentRule);
      }
      currentRule = {
        number: parseInt(match[1], 10),
        hasFrom: false,
        hasEnforcedBy: false
      };
    } else if (currentRule) {
      if (line.startsWith('**From:**')) {
        currentRule.hasFrom = true;
      }
      if (line.startsWith('**Enforced by:**')) {
        currentRule.hasEnforcedBy = true;
      }
    }
  }
  if (currentRule) {
    rules.push(currentRule);
  }

  const seen = new Set();
  let lastNum = -1;

  for (const r of rules) {
    if (!r.hasFrom) {
      errors.push(`Rule T${r.number} is missing a **From:** provenance line`);
    }
    if (!r.hasEnforcedBy) {
      errors.push(`Rule T${r.number} is missing an **Enforced by:** line`);
    }
    if (seen.has(r.number)) {
      errors.push(`Rule T${r.number} is a duplicate`);
    }
    if (r.number <= lastNum) {
      errors.push(`Rule T${r.number} is out of order`);
    }
    seen.add(r.number);
    lastNum = r.number;
  }

  return { ok: errors.length === 0, errors };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(fileURLToPath(import.meta.url), '../../..');
  const tastePath = path.join(root, 'TASTE-INTRO.md');
  const authoringPath = path.join(root, 'steps/025-author-intro-film-llm/AUTHORING.md');
  
  const taste = fs.readFileSync(tastePath, 'utf8');
  const authoring = fs.readFileSync(authoringPath, 'utf8');
  
  const result = checkTasteIntro({ taste, authoring });
  if (!result.ok) {
    for (const err of result.errors) {
      console.error(err);
    }
    process.exit(1);
  }
  
  const match = taste.match(/^## T\d+\s*—/gm);
  const count = match ? match.length : 0;
  console.log(`intro taste ok — ${count} rules`);
  process.exit(0);
}
