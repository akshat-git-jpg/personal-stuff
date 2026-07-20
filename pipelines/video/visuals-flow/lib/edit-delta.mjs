import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';


export function editDelta(llmCues, approvedCues) {
  const llm = llmCues.cues || [];
  const app = approvedCues.cues || [];

  const byIdLlm = new Map(llm.map(c => [c.id, c]));
  const byIdApp = new Map(app.map(c => [c.id, c]));

  const summary = {
    edited: [],
    added: [],
    removed: [],
    totals: {
      llmCues: llm.length,
      approvedCues: app.length,
      edited: 0,
      added: 0,
      removed: 0,
      revealTextsChanged: 0
    }
  };

  for (const c of llm) {
    if (!byIdApp.has(c.id)) {
      summary.removed.push({ id: c.id, card: c.card });
      summary.totals.removed++;
    }
  }

  for (const c of app) {
    if (!byIdLlm.has(c.id)) {
      summary.added.push({ id: c.id, card: c.card });
      summary.totals.added++;
    } else {
      const orig = byIdLlm.get(c.id);
      const changes = [];
      let revealChanges = 0;

      for (const field of ['anchor', 'hold', 'lead', 'card', 'flagged']) {
        if (orig[field] !== c[field]) {
          changes.push({ field, from: orig[field], to: c[field] });
        }
      }

      const origVars = orig.variables || {};
      const newVars = c.variables || {};
      for (const key of new Set([...Object.keys(origVars), ...Object.keys(newVars)])) {
        if (JSON.stringify(origVars[key]) !== JSON.stringify(newVars[key])) {
          changes.push({ field: `variables.${key}`, from: origVars[key], to: newVars[key] });
        }
      }

      const origBeats = orig.beats || [];
      const newBeats = c.beats || [];
      for (let i = 0; i < Math.max(origBeats.length, newBeats.length); i++) {
        const ob = origBeats[i];
        const nb = newBeats[i];
        if (ob && nb) {
          if (ob.anchor !== nb.anchor) {
            changes.push({ field: `beats[${i}].anchor`, from: ob.anchor, to: nb.anchor });
          }
          if (JSON.stringify(ob.reveal) !== JSON.stringify(nb.reveal)) {
             // look for text changes specifically if kind/other stuff hasn't changed or just dump it all
             if (ob.reveal?.text !== nb.reveal?.text) {
               changes.push({ field: `beats[${i}].reveal.text`, from: ob.reveal?.text, to: nb.reveal?.text });
               revealChanges++;
             } else {
               changes.push({ field: `beats[${i}].reveal`, from: ob.reveal, to: nb.reveal });
             }
          }
        } else if (!ob && nb) {
          changes.push({ field: `beats[${i}]`, from: undefined, to: nb });
        } else if (ob && !nb) {
          changes.push({ field: `beats[${i}]`, from: ob, to: undefined });
        }
      }

      if (changes.length > 0) {
        summary.edited.push({ id: c.id, card: c.card, changes });
        summary.totals.edited++;
        summary.totals.revealTextsChanged += revealChanges;
      }
    }
  }

  return summary;
}

export function formatDelta(summary) {
  let out = '';
  if (summary.added.length > 0) {
    out += `**Added cues:**\n`;
    for (const a of summary.added) out += `- ${a.id} (${a.card})\n`;
    out += '\n';
  }
  if (summary.removed.length > 0) {
    out += `**Removed cues:**\n`;
    for (const r of summary.removed) out += `- ${r.id} (${r.card})\n`;
    out += '\n';
  }
  if (summary.edited.length > 0) {
    out += `**Edited cues:**\n`;
    for (const e of summary.edited) {
      out += `- ${e.id} (${e.card}):\n`;
      for (const c of e.changes) {
        if (c.field.endsWith('.text')) {
          out += `  - ${c.field}: "${c.from}" -> "${c.to}"\n`;
        } else {
          out += `  - ${c.field} changed\n`;
        }
      }
    }
    out += '\n';
  }

  const t = summary.totals;
  out += `${t.llmCues} cues from LLM, ${t.approvedCues} approved, ${t.edited} edited, ${t.added} added, ${t.removed} removed, ${t.revealTextsChanged} reveal texts changed`;
  return out.trim();
}

export function shotsDelta(llmShots, approvedShots) {
  const llm = llmShots.spans || [];
  const app = approvedShots.spans || [];

  const byIdLlm = new Map(llm.map(s => [s.id, s]));
  const byIdApp = new Map(app.map(s => [s.id, s]));

  const summary = {
    edited: [],
    added: [],
    removed: [],
    totals: {
      llmSpans: llm.length,
      approvedSpans: app.length,
      edited: 0,
      added: 0,
      removed: 0
    }
  };

  for (const s of llm) {
    if (!byIdApp.has(s.id)) {
      summary.removed.push({ id: s.id });
      summary.totals.removed++;
    }
  }

  for (const s of app) {
    if (!byIdLlm.has(s.id)) {
      summary.added.push({ id: s.id });
      summary.totals.added++;
    } else {
      const orig = byIdLlm.get(s.id);
      const changes = [];

      for (const field of ['kind', 'from_anchor', 'to_anchor', 'note', 'flagged']) {
        if (orig[field] !== s[field]) {
          changes.push({ field, from: orig[field], to: s[field] });
        }
      }

      if (changes.length > 0) {
        summary.edited.push({ id: s.id, changes });
        summary.totals.edited++;
      }
    }
  }

  return summary;
}

export function formatShotsDelta(summary) {
  let out = '';
  if (summary.added.length > 0) {
    out += `**Added spans:**\n`;
    for (const a of summary.added) out += `- ${a.id}\n`;
    out += '\n';
  }
  if (summary.removed.length > 0) {
    out += `**Removed spans:**\n`;
    for (const r of summary.removed) out += `- ${r.id}\n`;
    out += '\n';
  }
  if (summary.edited.length > 0) {
    out += `**Edited spans:**\n`;
    for (const e of summary.edited) {
      out += `- ${e.id}:\n`;
      for (const c of e.changes) {
        if (['from_anchor', 'to_anchor', 'note'].includes(c.field)) {
          out += `  - ${c.field}: "${c.from}" -> "${c.to}"\n`;
        } else {
          out += `  - ${c.field} changed\n`;
        }
      }
    }
    out += '\n';
  }

  const t = summary.totals;
  out += `${t.llmSpans} spans from LLM, ${t.approvedSpans} approved, ${t.edited} edited, ${t.added} added, ${t.removed} removed`;
  return out.trim();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.length > 2) {
    console.error('usage: node lib/edit-delta.mjs <slug-or-path>');
    console.error('   or: node lib/edit-delta.mjs <llm.json> <cues.json>');
    process.exit(1);
  }

  let llmPath, appPath;
  let workdir = null;
  if (args.length === 1) {
    workdir = resolveWorkdir(args[0]);
    llmPath = path.join(workdir, 'cues.llm.json');
    appPath = path.join(workdir, 'cues.json');
    if (!fs.existsSync(llmPath)) {
      console.error(`error: cues.llm.json missing in ${workdir}`);
      process.exit(2);
    }
  } else {
    llmPath = args[0];
    appPath = args[1];
  }

  const llmCues = JSON.parse(fs.readFileSync(llmPath, 'utf8'));
  const appCues = JSON.parse(fs.readFileSync(appPath, 'utf8'));
  const summary = editDelta(llmCues, appCues);
  console.log(formatDelta(summary));

  if (workdir) {
    const llmShotsPath = path.join(workdir, 'shots.llm.json');
    const appShotsPath = path.join(workdir, 'shots.json');
    if (fs.existsSync(llmShotsPath) && fs.existsSync(appShotsPath)) {
      const llmShots = JSON.parse(fs.readFileSync(llmShotsPath, 'utf8'));
      const appShots = JSON.parse(fs.readFileSync(appShotsPath, 'utf8'));
      const shotsSum = shotsDelta(llmShots, appShots);
      console.log('\n## Shots\n');
      console.log(formatShotsDelta(shotsSum));
    }
  }
}
