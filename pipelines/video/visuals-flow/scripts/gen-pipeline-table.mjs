#!/usr/bin/env node
// Generates PIPELINE.md's step table from the registry (steps/*/step.json).
//
// The table used to be typed by hand, and PIPELINE.md itself records what that
// costs: "The previous old→new mapping table lived here and was destroyed by
// two rounds of automated renaming rewriting both of its columns." A rename
// sweep ate a table once. Now the columns come from the same declarations the
// driver dispatches on, so a rename cannot desync them — and `--check` fails
// the gate when someone edits a step.json without regenerating.
//
//   node scripts/gen-pipeline-table.mjs           rewrite the table region
//   node scripts/gen-pipeline-table.mjs --check   exit 1 if the file is stale

import fs from 'node:fs';
import path from 'node:path';
import { loadSteps } from '../lib/steps.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOC = path.join(ROOT, 'PIPELINE.md');

export const BEGIN =
  '<!-- BEGIN GENERATED STEP TABLE — edit steps/*/step.json, then run: node scripts/gen-pipeline-table.mjs -->';
export const END = '<!-- END GENERATED STEP TABLE -->';

export function renderStepTable(steps = loadSteps()) {
  const rows = steps.map((s) => {
    const actor = s.actorLabel ?? `[${s.actor.toUpperCase()}]`;
    const summary = s.summary ?? `${s.consumes.join(', ') || '—'} → ${s.produces.join(', ') || '—'}`;
    return `| \`${s.slug}\` | ${actor} | ${summary} |`;
  });
  return ['| Step | Actor | In → Out |', '|---|---|---|', ...rows].join('\n');
}

export function renderDoc(current, steps = loadSteps()) {
  const begin = current.indexOf(BEGIN);
  const end = current.indexOf(END);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(
      `E-REG PIPELINE.md is missing the generated step-table markers — restore:\n${BEGIN}\n${END}`,
    );
  }
  const head = current.slice(0, begin + BEGIN.length);
  const tail = current.slice(end);
  return `${head}\n${renderStepTable(steps)}\n${tail}`;
}

const check = process.argv.includes('--check');
try {
  const current = fs.readFileSync(DOC, 'utf8');
  const next = renderDoc(current);
  if (current === next) {
    console.log(check ? 'PIPELINE.md step table up to date' : 'PIPELINE.md unchanged');
    process.exit(0);
  }
  if (check) {
    console.error(
      'PIPELINE.md step table is stale — a step.json changed without regenerating.\n' +
        'Fix: node scripts/gen-pipeline-table.mjs',
    );
    process.exit(1);
  }
  fs.writeFileSync(DOC, next);
  console.log('PIPELINE.md step table regenerated');
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
