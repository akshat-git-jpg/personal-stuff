import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';

export function auditGate({ audit, resolved }) {
  const errors = [];
  const warnings = [];

  if (!audit) {
    errors.push("run the 035 audit first");
    return { errors, warnings };
  }

  if (!resolved) {
    errors.push("missing resolved.json");
    return { errors, warnings };
  }

  // resolve.mjs writes { video, offset, resolved: [...] }. This read the
  // never-populated `.cues` key instead, so resolvedMap was always empty,
  // every lookup missed, and the gate returned clean for ANY input — it has
  // never once blocked a labelled fullframe (found 2026-07-25, test-03).
  // Both shapes and a bare array are accepted so the gate cannot silently
  // go quiet again if the file shape moves.
  const cues = Array.isArray(resolved) ? resolved
    : Array.isArray(resolved.resolved) ? resolved.resolved
    : Array.isArray(resolved.cues) ? resolved.cues
    : null;
  if (!cues) {
    errors.push('resolved.json has no cue array (expected `resolved`, `cues`, or a bare array)');
    return { errors, warnings };
  }
  const resolvedMap = new Map();
  for (const cue of cues) {
    resolvedMap.set(cue.id, cue);
  }

  if (audit && Array.isArray(audit.items)) {
    for (const item of audit.items) {
      const cue = resolvedMap.get(item.id);
      if (!cue) continue;

      if (item.verdict === 'labelled') {
        if (item.accepted === true) {
          continue;
        }

        if (cue.placement === 'fullframe') {
          errors.push(`${item.id}: labelled fullframe — re-author with an enacted device, propose a new card, or mark accepted:true in audit.json`);
        } else if (cue.placement === 'overlay') {
          warnings.push(`${item.id}: labelled overlay`);
        }
      }
    }
  }

  return { errors, warnings };
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: node audit-gate.mjs <slug-or-path>");
    process.exit(1);
  }

  const workdir = resolveWorkdir(arg);
  const auditPath = path.join(workdir, 'audit.json');
  const resolvedPath = path.join(workdir, 'resolved.json');

  let audit = null;
  let resolved = null;

  try {
    if (fs.existsSync(auditPath)) {
      audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    }
  } catch (err) {}

  try {
    if (fs.existsSync(resolvedPath)) {
      resolved = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    }
  } catch (err) {}

  const { errors, warnings } = auditGate({ audit, resolved });

  for (const w of warnings) {
    console.log(w);
  }

  if (errors.length > 0) {
    for (const e of errors) {
      console.error(e);
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
