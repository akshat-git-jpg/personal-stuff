#!/usr/bin/env node
// The dispatcher: node lib/run.mjs <slug> <verb> [flags]. run.sh is a thin wrapper around it,
// so Windows can run this directly without bash.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { STEPS_DIR, workdirOf, mediaDirOf, readJson } from './paths.mjs';

// The step registry: steps/*/step.json. A verb belongs to exactly one step.
export function loadSteps(dir = STEPS_DIR) {
  return fs.readdirSync(dir).filter((d) => /^\d{3}-/.test(d)).sort()
    .map((d) => ({ folder: d, ...readJson(path.join(dir, d, 'step.json')) }));
}

function flags(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const k = a.slice(2);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) out[k] = true;
    else { out[k] = v; i++; }
  }
  return out;
}
const num = (v) => (v === undefined ? undefined : Number(v));
const list = (v) => (typeof v === 'string' ? v.split(',') : null);

// verb -> handler. lib/steps.test.mjs checks this table and the step.json files agree.
export const HANDLERS = {
  intake: async (slug, f) => {
    const { intake, parseCanvas } = await import('./intake.mjs');
    const r = intake({ name: slug, title: f.title, audio: f.audio, screen: f.screen ?? null, designSystem: f['design-system'] ?? 'default',
      canvas: parseCanvas(f.canvas), from: num(f.from), to: num(f.to) });
    console.log(`010 intake: ${r.key} (${r.total}s)\n  workdir ${r.workdir}\n  media   ${r.media}`);
  },
  transcribe: async (slug) => {
    const r = (await import('./transcribe.mjs')).transcribe(slug);
    console.log(`020 transcribe: ${r.words} words via ${r.engine}`);
  },
  'plan-moments': async (slug, f) => {
    const r = await (await import('./plan-moments.mjs')).planMoments(slug, { stageOnly: !!f['stage-only'] });
    if (r.moments) for (const m of r.moments) console.log(`  ${m.id}  ${m.start.toFixed(2)}-${m.end.toFixed(2)}s  ${m.idea}`);
    console.log(`030 plan-moments: ${r.moments ? `${r.moments.length} moments ($${r.cost.toFixed(2)})` : 'stage only'} | stage ${r.stage}`);
  },
  storyboard: async (slug, f) => {
    const r = await (await import('./storyboard.mjs')).storyboard(slug, { only: list(f.only), stageOnly: !!f['stage-only'] });
    if (!r.sheet) { console.log(`035 storyboard: stage only | ${r.stage}`); return; }
    for (const [id, p] of Object.entries(r.board.moments)) console.log(`  ${id}  @${p.at}s  ${p.status}  ${p.caption}`);
    console.log(`035 storyboard: sheet ${r.sheet} ($${r.cost.toFixed(2)})\n  approve: node lib/run.mjs ${slug} storyboard-review`);
  },
  'storyboard-review': async (slug, f) => {
    (await import('./storyboard-server.mjs')).serveStoryboard(slug, { port: num(f.port) });
    await new Promise(() => {});
  },
  'approve-storyboard': async (slug, f) => {
    const { decide, readBoard } = await import('./storyboard.mjs');
    if (list(f.ok)) decide(slug, list(f.ok), 'approved', typeof f.note === 'string' && !list(f.reject) ? f.note : undefined);
    if (list(f.reject)) {
      if (typeof f.note !== 'string') throw new Error('--reject needs --note "what to change"');
      decide(slug, list(f.reject), 'rejected', f.note);
    }
    for (const [id, p] of Object.entries(readBoard(slug).moments)) console.log(`  ${id}  ${p.status}${p.note ? `  "${p.note}"` : ''}`);
  },
  'author-moments': async (slug, f) => {
    const r = await (await import('./author-moments.mjs')).authorMoments(slug, { only: list(f.only), jobs: num(f.jobs) ?? 3, stageOnly: !!f['stage-only'], skipStoryboard: !!f['skip-storyboard'] });
    if (!r.results) { console.log(`040 author-moments: stage only\n  ${r.stages.join('\n  ')}`); return; }
    const failed = r.results.filter((x) => !x.ok);
    console.log(`040 author-moments: ${r.results.length - failed.length}/${r.results.length} authored ($${r.results.reduce((s, x) => s + x.cost, 0).toFixed(2)})`);
    if (failed.length) { for (const x of failed) console.error(`  ${x.id}: ${x.error}`); process.exitCode = 1; }
  },
  'review-frames': async (slug, f) => {
    const r = (await import('./review-frames.mjs')).reviewFrames(slug, { only: list(f.only), snapshots: !f['no-snapshots'], probe: !f['no-measure'], cut: !f['no-cut'] });
    console.log(`050 review-frames: ${r.errors} error(s) -> ${r.file}`);
    if (r.errors) process.exitCode = 1;
  },
  'render-moments': async (slug, f) => {
    const r = (await import('./render-moments.mjs')).renderMoments(slug, { only: list(f.only), force: !!f.force });
    const bad = Object.entries(r).filter(([, x]) => x.problems.length);
    console.log(`060 render-moments: ${Object.keys(r).length} clip(s), ${bad.length} with problems`);
    if (bad.length) process.exitCode = 1;
  },
  assemble: async (slug, f) => {
    const r = await (await import('./assemble.mjs')).assemble(slug, { final: !!f.final });
    for (const x of r.extra) console.log(`  ${x.format}: ${x.out}`);
    console.log(`070 assemble: ${r.out} (registered ${r.version})\n  cut checks: videos/${slug}/review/REVIEW.md\n  review: node lib/run.mjs ${slug} review`);
  },
  review: async (slug, f) => {
    (await import('./review-server.mjs')).serveReview(slug, { port: num(f.port) });
    await new Promise(() => {});
  },
  'feedback-status': async (slug) => {
    const { readFeedback, pendingItems } = await import('./feedback.mjs');
    const pending = pendingItems(readFeedback(workdirOf(slug)));
    for (const p of pending) console.log(`  ${p.key}  ${p.context ?? ''}${p.moment ? ` ${p.moment}` : ''}  ${p.text}`);
    console.log(`${pending.length} pending feedback item(s) for ${slug}`);
    if (pending.length) process.exitCode = 1;
  },
  status: async (slug) => {
    const wd = workdirOf(slug), media = mediaDirOf(slug);
    const has = (p) => (fs.existsSync(p) ? 'yes' : '-');
    console.log(`workdir ${wd}\nmedia   ${media}`);
    for (const [label, p] of [['run-config.json', path.join(wd, 'run-config.json')], ['transcript.json', path.join(wd, 'transcript.json')],
      ['moments.json', path.join(wd, 'moments.json')], ['storyboard.json', path.join(wd, 'storyboard.json')], ['review/REVIEW.md', path.join(wd, 'review', 'REVIEW.md')],
      ['final-draft.mp4', path.join(media, 'final-draft.mp4')], ['feedback.json', path.join(wd, 'feedback.json')]]) console.log(`  ${has(p).padEnd(4)}${label}`);
    const mp = path.join(wd, 'moments.json');
    if (fs.existsSync(mp)) for (const m of readJson(mp).moments) {
      console.log(`  ${m.id}  composition:${has(path.join(wd, 'moments', m.id, 'index.html'))}  render:${has(path.join(media, 'moments', `${m.id}.mp4`))}`);
    }
  },
};

function usage() {
  console.log('usage: node lib/run.mjs <slug> <verb> [flags]   (or: bash run.sh <slug> <verb> [flags])\n');
  for (const s of loadSteps()) console.log(`  ${s.number} ${s.title.padEnd(34)} ${s.verbs.length ? s.verbs.join(', ') : '(owner)'}`);
  console.log('\n  helpers: status');
}

export async function main(argv) {
  const [slug, verb, ...rest] = argv;
  if (!slug || !verb || slug === '-h' || slug === '--help') { usage(); return 2; }
  const handler = HANDLERS[verb];
  if (!handler) { console.error(`unknown verb: ${verb}`); usage(); return 2; }
  await handler(slug, flags(rest));
  return process.exitCode ?? 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((e) => { console.error(e.message); process.exit(1); });
}
