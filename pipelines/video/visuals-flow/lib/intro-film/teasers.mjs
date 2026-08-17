// The moving half of the intro idea gate.
//
// 110 proposes 2-3 competing directions. Until 2026-08-17 the owner approved one
// of them as PROSE, and 130 then spent ~18k output tokens turning it into a 64 KB
// composition. Prose cannot show a look: three directions described in words all
// sound reasonable, and the owner was rejecting the finished film instead
// ("i dont like the entire intro. i need to do entire intro again from scratch").
//
// So every direction now ships a six-second teaser built in the REAL composition
// system — real DESIGN.md tokens, real logos, real renderer, real motion. It is
// the film in miniature, at roughly 2k output tokens against 18k, and it is what
// gate 120 actually judges.
//
// It compresses the ARC, not beat one. Three directions' opening beats can look
// nearly identical while their arcs differ completely, and the arc IS the
// direction — `idea.json` says so: "Its arc — how that object transforms across
// the intro's beats. This is the idea; everything else is decoration."
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolveWorkdir } from './workdir.mjs';
import { FILM_RENDERER } from '../renderer-constants.mjs';

// Six seconds, fixed. Not a knob: the whole value of this gate is that every
// direction is judged on identical terms, and a direction allowed more screen
// time than its rivals wins on runtime rather than on merit.
export const TEASER_SECONDS = 6;
export const TEASER_WIDTH = 1920;
export const TEASER_HEIGHT = 1080;

// Same tolerance and rationale as check-film-sync.mjs: timings are authored to
// 2dp, so half of the last place accepts "6.00" and rejects a real edit.
const EPSILON = 0.005;

export const teasersDir = (workdir) => path.join(workdir, 'intro-film', 'teasers');
export const teaserSrcDir = (workdir, id) => path.join(teasersDir(workdir), id);
export const teaserHtml = (workdir, id) => path.join(teaserSrcDir(workdir, id), 'index.html');
export const teaserMp4 = (workdir, id) => path.join(teasersDir(workdir), `${id}.mp4`);

// One banner per arc clause, in order — the same contract check-film-sync.mjs
// puts on the full film, for the same reason: it is the only thing tying the
// authored composition back to the JSON it was written from.
//
//   /* ---------- m1 : five blank cards snap into a row ---------- */
const MOMENT_RE = /\/\*\s*-*\s*m(\d+)\s*:/g;

export function parseTeaserRoot(html) {
  const rootTag = html.match(/<[^>]*\bdata-composition-id\s*=\s*"[^"]*"[^>]*>/);
  if (!rootTag) return null;
  const attr = (name) => {
    const m = rootTag[0].match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`));
    return m ? m[1] : null;
  };
  const num = (name) => (attr(name) == null ? null : Number(attr(name)));
  return {
    compositionId: attr('data-composition-id'),
    duration: num('data-duration'),
    start: num('data-start'),
    width: num('data-width'),
    height: num('data-height'),
  };
}

export function parseMomentBanners(html) {
  const out = [];
  MOMENT_RE.lastIndex = 0;
  let m;
  while ((m = MOMENT_RE.exec(html)) !== null) out.push(Number(m[1]));
  return out;
}

// `read` is injected so the whole lint is pure and testable against an in-memory
// tree; runLintTeasers supplies the real filesystem. Returning `null` means "no
// such file", which is a finding rather than a crash.
export function lintTeasers({ idea, read }) {
  const errors = [];
  const directions = idea?.directions ?? [];
  if (!directions.length) {
    errors.push({ code: 'IDEA-PREVIEW-MISSING', message: 'idea.json declares no directions' });
    return { errors };
  }

  for (const d of directions) {
    const html = read(d.id);
    if (html == null) {
      errors.push({
        code: 'IDEA-PREVIEW-MISSING',
        id: d.id,
        message: `direction '${d.id}' has no teaser at intro-film/teasers/${d.id}/index.html — `
          + 'every proposed direction must ship one, or the owner is back to judging prose',
      });
      continue;
    }

    const root = parseTeaserRoot(html);
    if (!root) {
      errors.push({ code: 'IDEA-PREVIEW-ROOT', id: d.id, message: `direction '${d.id}' teaser has no data-composition-id root` });
      continue;
    }
    if (root.duration == null || Math.abs(root.duration - TEASER_SECONDS) > EPSILON) {
      errors.push({
        code: 'IDEA-PREVIEW-LENGTH',
        id: d.id,
        message: `direction '${d.id}' teaser is ${root.duration}s, must be exactly ${TEASER_SECONDS}s — `
          + 'a longer teaser wins on runtime rather than on merit',
      });
    }
    if (root.width !== TEASER_WIDTH || root.height !== TEASER_HEIGHT) {
      errors.push({
        code: 'IDEA-PREVIEW-CANVAS',
        id: d.id,
        message: `direction '${d.id}' teaser canvas is ${root.width}x${root.height}, must be ${TEASER_WIDTH}x${TEASER_HEIGHT} `
          + '(Hyperframes reads the canvas from data-width/data-height, never from CSS)',
      });
    }

    // The arc is the idea, so the teaser has to visit every clause of it. A
    // teaser covering 2 of 4 clauses shows a different, smaller direction than
    // the one the owner would be approving.
    const arc = d.arc ?? [];
    const moments = parseMomentBanners(html);
    if (arc.length && moments.length !== arc.length) {
      errors.push({
        code: 'IDEA-PREVIEW-ARC',
        id: d.id,
        message: `direction '${d.id}' has ${arc.length} arc clause(s) but ${moments.length} moment banner(s) — `
          + 'the teaser must visit every clause, one /* --- mN : <clause> --- */ each, in order',
      });
    }
  }

  return { errors };
}

export function runLintTeasers(slug) {
  const workdir = resolveWorkdir(slug);
  const ideaFile = path.join(workdir, 'intro-film', 'idea.json');
  if (!fs.existsSync(ideaFile)) throw new Error(`missing ${ideaFile} — run the idea pass first (110)`);
  const idea = JSON.parse(fs.readFileSync(ideaFile, 'utf8'));
  const read = (id) => {
    const f = teaserHtml(workdir, id);
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  };
  return lintTeasers({ idea, read });
}

// `-o` MUST carry an extension (render-film.mjs learned this: an extensionless
// -o is read as an output FILE and the run dies at the audio mux), and the
// positional argument is the composition DIRECTORY relative to cwd.
export function renderArgs(id) {
  return ['-y', FILM_RENDERER, 'render', id,
    '--fps', '30', '--format', 'mp4', '--quality', 'high',
    '-o', `${id}.mp4`];
}

export function renderTeasers(slug) {
  const workdir = resolveWorkdir(slug);
  const { errors } = runLintTeasers(slug);
  // Lint BEFORE spending any encode. A teaser at the wrong length or missing
  // half its arc renders perfectly and misleads the gate, which is worse than
  // not rendering at all.
  if (errors.length) return { rendered: [], errors };

  const idea = JSON.parse(fs.readFileSync(path.join(workdir, 'intro-film', 'idea.json'), 'utf8'));
  const dir = teasersDir(workdir);
  const rendered = [];
  for (const d of idea.directions) {
    const out = teaserMp4(workdir, d.id);
    fs.rmSync(out, { force: true });
    const r = spawnSync('npx', renderArgs(d.id), { cwd: dir, stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`hyperframes render failed for direction '${d.id}' (exit ${r.status})`);
    if (!fs.existsSync(out)) throw new Error(`render reported success but ${out} does not exist`);
    rendered.push(out);
  }
  return { rendered, errors: [] };
}

// Which directions the owner can actually WATCH. The gate reads this: approving
// a direction whose teaser was never rendered is approving prose again.
export function playableIds(workdir, idea) {
  return (idea?.directions ?? [])
    .map((d) => d.id)
    .filter((id) => fs.existsSync(teaserMp4(workdir, id)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: node lib/intro-film/teasers.mjs <slug-or-path> [--lint-only]');
    process.exit(1);
  }
  try {
    const lintOnly = process.argv.includes('--lint-only');
    const { errors, rendered } = lintOnly ? { ...runLintTeasers(slug), rendered: [] } : renderTeasers(slug);
    for (const e of errors) console.error(`${e.code} ${e.message}`);
    if (errors.length) process.exit(1);
    console.log(lintOnly ? 'teasers: lint ok' : `teasers: rendered ${rendered.length}`);
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
