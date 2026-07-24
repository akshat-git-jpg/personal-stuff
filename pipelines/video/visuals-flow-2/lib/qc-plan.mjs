import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';

export function parseMmss(s) {
  const m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(s.trim());
  if (!m) throw new Error(`bad mmss: ${s}`);
  return parseInt(m[1], 10) * 60 + parseFloat(m[2]);
}

const mmssDigits = (t) =>
  `${String(Math.floor(t / 60)).padStart(2, '0')}${String(Math.floor(t % 60)).padStart(2, '0')}`;

function tableRows(md, title) {
  const re = new RegExp(`## ${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=\\n## |$)`);
  const block = (md.match(re) || [''])[0];
  return block.split('\n').filter((l) => /^\|/.test(l)).slice(2); // drop header + divider
}

export function parseAssembly(md) {
  const segments = tableRows(md, 'Base track').map((l) => {
    const [, from, to, source, id] = l.split('|').map((x) => x.trim());
    return { start: parseMmss(from), end: parseMmss(to), kind: source, id };
  });
  const overlays = tableRows(md, 'Overlays (composited on top)').map((l) => {
    const [, at, until, file] = l.split('|').map((x) => x.trim());
    return { start: parseMmss(at), end: parseMmss(until), file };
  });
  const transitions = tableRows(md, 'Transitions').map((l) => {
    const [, at, direction, from, to] = l.split('|').map((x) => x.trim());
    return { at: parseMmss(at), direction, from, to };
  });
  return { segments, overlays, transitions };
}

export function expectedForCut(a, b, whip) {
  const into = {
    graphic: `card ${b.id} fully drawn within 6 frames — no half-rendered text, no black or solid-color frame`,
    avatar: `HARD cut to host (no transition frames), host visible immediately, no zoom-in on the host`,
    screen: `screen recording resumes cleanly; captions visible if speech is running; Ken Burns drift subtle (no jump)`,
  }[b.kind] || 'next segment starts cleanly';
  const at = whip
    ? 'whip transition (motion-blur streak, ~7 frames; orange flash-wipe if into a graphic — never pink/white-out)'
    : 'clean hard cut, zero gap or repeated frames';
  return `${at}; ${into}`;
}

export function planQcEvents({ segments, overlays, transitions }, effects = { instances: [] }) {
  const events = [];
  for (let i = 1; i < segments.length; i++) {
    const a = segments[i - 1];
    const b = segments[i];
    const whip = transitions.some((t) => Math.abs(t.at - b.start) < 0.15);
    events.push({ t: b.start, tag: `cut-${mmssDigits(b.start)}-${a.id}-to-${b.id}`, expected: expectedForCut(a, b, whip) });
  }
  for (const o of overlays) {
    const name = path.basename(o.file, path.extname(o.file));
    events.push({
      t: o.start, tag: `ovl-up-${mmssDigits(o.start)}-${name}`,
      expected: `overlay ${o.file} pops in within 6 frames, base content still visible behind it, no full-frame black box`,
    });
    events.push({
      t: o.end, tag: `ovl-down-${mmssDigits(o.end)}-${name}`,
      expected: `overlay ${o.file} fully gone within 6 frames — no ghost, no lingering box`,
    });
  }
  for (const inst of (effects.instances || [])) {
    if (inst.type === 'beat' && inst.enabled !== false && typeof inst.at === 'number') {
      events.push({
        t: inst.at, tag: `beat-${mmssDigits(inst.at)}-${inst.id}`,
        expected: 'orange flash + slight punch-in refresh (never pink/washed-out); host readable again within 5 frames',
      });
    }
  }
  events.sort((x, y) => x.t - y.t);
  return events.map((e, i) => ({
    ...e,
    sheet: `event-${String(i + 1).padStart(3, '0')}-${e.tag.replace(/[^a-zA-Z0-9._-]/g, '_')}.jpg`,
  }));
}

export function checklistMd(video, events, variant) {
  const rows = events.map((e, i) =>
    `| ${i + 1} | ${e.t.toFixed(1)}s | ${e.sheet} | ${e.expected} |`);
  return [
    `# ${video} — filmstrip QC checklist (${variant})`,
    '',
    'One contact sheet per expected event (30fps, event at ~frame 21 of the',
    'sheet, window starts 0.7s before). Read every sheet against its expected',
    'column; verdicts go to videos/<slug>/qc-report.md.',
    '',
    '| # | time | sheet | expected |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

function main() {
  const [slugOrPath, ...rest] = process.argv.slice(2);
  if (!slugOrPath) {
    console.error('usage: node lib/qc-plan.mjs <slug-or-path> --out <events.json> --checklist <checklist.md> [--variant final|final-draft]');
    process.exit(1);
  }
  let out = null; let checklist = null; let variant = 'final-draft';
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--out') out = rest[++i];
    else if (rest[i] === '--checklist') checklist = rest[++i];
    else if (rest[i] === '--variant') variant = rest[++i];
    else { console.error(`unknown argument: ${rest[i]}`); process.exit(1); }
  }
  const workdir = resolveWorkdir(slugOrPath);
  const mdPath = path.join(workdir, 'assembly.md');
  if (!fs.existsSync(mdPath)) { console.error(`missing ${mdPath} — assemble first`); process.exit(1); }
  const parsed = parseAssembly(fs.readFileSync(mdPath, 'utf8'));
  const effectsPath = path.join(workdir, 'effects.json');
  const effects = fs.existsSync(effectsPath) ? JSON.parse(fs.readFileSync(effectsPath, 'utf8')) : { instances: [] };
  const events = planQcEvents(parsed, effects);
  if (events.length === 0) { console.error('no events parsed from assembly.md'); process.exit(1); }
  const video = path.basename(workdir);
  if (out) fs.writeFileSync(out, JSON.stringify(events, null, 2));
  if (checklist) fs.writeFileSync(checklist, checklistMd(video, events, variant));
  console.log(`events: ${events.length} (${parsed.segments.length} segments, ${parsed.overlays.length} overlays, ${parsed.transitions.length} transitions)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
