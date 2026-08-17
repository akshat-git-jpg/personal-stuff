// Adapter: hands this pipeline's look-preview prompts to the generic
// flow-queue relay (tooling/cli/flow-queue), which the ZAPI FLOW browser
// extension polls and loads into its Google Flow queue with no click.
//
// One gate in this pipeline approves a LOOK from generated frames:
//
//   240  build the new cards — owner rule 2026-07-31: before ANY code is
//        written for a new card, 1-2 prompts (one per key moment) go to the
//        owner and the flow WAITS for a verdict. The approved frames are the
//        visual contract the card is built to match.
//        (card-library/DESIGN.md, "New-card checklist" item 0.)
//
// 110 (propose the intro idea) used to have a row here too — an AI-generated
// still "so the owner can SEE each direction" (owner ask, 2026-08-13). It was
// removed 2026-08-17: a still is neither the brand nor the renderer nor the
// motion, so approving one still told the owner very little about the film
// they'd get. 110 now ships a real 6-second Hyperframes teaser per direction
// (lib/intro-film/teasers.mjs) — the film in miniature, not a picture of it.
// 240 keeps this path on purpose: approving a still IS the right artifact
// there, because the frames themselves become the visual contract the card is
// built to match, not a preview of motion the card doesn't have.
//
// Nothing about the prompt FORMAT lives here — the `---` separator, the `##`
// label heading and the flattening are the relay's contract, shared by every
// producer. This file only knows WHERE this pipeline keeps its preview files
// and what to call each group.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveWorkdir } from './workdir.mjs';
import { pathToFileURL } from 'node:url';

export const SOURCE = 'visuals-flow';

// Where each gate's prompts are authored. Plain markdown so the same file is
// the human surface and the machine input: the owner can read and edit a prompt
// before a single generation is spent on it.
export const SOURCES = [
  { kind: 'card', dir: 'card-previews', label: 'new-card look (240)' },
];

const CLI = path.resolve(
  import.meta.dirname,
  '../../../../tooling/cli/flow-queue/pp-flow-queue',
);

// Newest first, so whatever the session just wrote is what the owner sees at
// the top of the extension's queue.
export function findPreviewFiles(workdir) {
  const out = [];
  for (const source of SOURCES) {
    const dir = path.join(workdir, source.dir);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const abs = path.join(dir, file);
      out.push({
        ...source,
        abs,
        name: path.basename(file, '.md'),
        // The group id is what the relay turns into the download filename
        // (<group>_m1, _m2 …), so it carries the kind: intro ideas and card
        // looks land in the same downloads folder.
        group: `${source.kind}-${path.basename(file, '.md')}`,
        mtime: fs.statSync(abs).mtimeMs,
      });
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

// Replaces this pipeline's whole share of the queue with THIS video's previews.
//
// The relay only de-dupes per (source, group), so without the clear a previous
// video's groups survive — different card slugs, different group ids, nothing to
// collide with. The extension auto-loads whatever is queued, so last week's
// already-approved frames would silently ride along and spend generations on
// them. Scoped to --source, so a non-visuals-flow producer's queue is untouched.
export function pushAll(workdir, { cli = CLI, run = spawnSync } = {}) {
  const files = findPreviewFiles(workdir);
  const pushed = [];
  // Only when there IS something to replace it with: a bare `previews` run on a
  // video with no preview files should report that, not silently wipe a queue
  // the owner is part-way through.
  if (files.length) {
    const c = run(cli, ['clear', '--source', SOURCE], { encoding: 'utf8' });
    if (c.status !== 0) throw new Error(`flow-queue clear failed\n${c.stderr ?? ''}`);
  }
  for (const f of files) {
    const r = run(cli, ['push', f.abs, '--source', SOURCE, '--group', f.group, '--label', f.label], {
      encoding: 'utf8',
    });
    if (r.status !== 0) {
      throw new Error(`flow-queue push failed for ${f.abs}\n${r.stderr ?? ''}`);
    }
    pushed.push({ ...f, out: (r.stdout ?? '').trim() });
  }
  return pushed;
}

const HINT = `No preview prompts yet.

Write one markdown file per thing the owner should SEE before approving it:

  240 new cards     videos/<slug>/card-previews/<card-slug>.md

Separate each key moment with a --- rule on its own line and give it a ##
heading as a label (the heading is for you; it is not sent to the generator).
Build the prompt body from the template in card-library/DESIGN.md
("New-card checklist", item 0), filling the [BRACKETS]:

  ## m1 — the shelf at rest

  Flat 2D motion-graphics still frame, 16:9, 1920x1080, from a premium dark
  tech explainer video.

  TEXT RULE: the ONLY text anywhere in the image is: [EXACT TEXT LIST].
  ...

  ---

  ## m2 — one plinth lit
  ...

Then re-run this verb. The ZAPI FLOW extension picks them up by itself.`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [slugArg] = process.argv.slice(2);
  if (!slugArg) {
    console.error('usage: node lib/flow-previews.mjs <slug>');
    process.exit(1);
  }
  const workdir = resolveWorkdir(slugArg);
  if (!fs.existsSync(workdir)) {
    console.error(`no workdir: ${workdir}`);
    process.exit(1);
  }
  try {
    const pushed = pushAll(workdir);
    if (!pushed.length) {
      console.log(HINT);
      process.exit(0);
    }
    for (const p of pushed) console.log(`${p.label.padEnd(20)} ${p.name}  →  ${p.out}`);
    console.log();
    console.log('Open the ZAPI FLOW panel next to Google Flow — it loads these by itself.');
    console.log('Nothing to paste; just hit Run queue.');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
