// Checks on the assembled cut (the composite, so motion in the recording counts as change):
// dead beats and the phone sheet. Run by 070 after every cut and by 050 when a cut exists.
import fs from 'node:fs';
import path from 'node:path';
import { workdirOf, mediaDirOf, readJson, writeJson } from './paths.mjs';
import { readRunConfig, reviewOf, formatsOf } from './run-config.mjs';
import { deadBeats, phoneSheet } from './kit.mjs';
import { MAIN_FORMAT, FORMATS } from './formats.mjs';

export const cutFileName = (format, final) => `${final ? 'final' : 'final-draft'}${FORMATS[format].suffix.replace('--', '-')}.mp4`;

// The newest cut of a format, draft or final.
export function latestCut(media, format = MAIN_FORMAT) {
  const c = [cutFileName(format, false), cutFileName(format, true)].map((f) => path.join(media, f)).filter((f) => fs.existsSync(f));
  return c.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ?? null;
}

// Seconds of each dead run that fall in each moment; the rest is the recording's.
export function attributeDead(runs, moments) {
  const byMoment = {};
  const out = runs.map((r) => {
    const where = [];
    let inMoments = 0;
    for (const m of moments) {
      const s = Math.max(0, Math.min(r.to, m.end) - Math.max(r.from, m.start));
      if (s > 0.01) { byMoment[m.id] = +((byMoment[m.id] ?? 0) + s).toFixed(2); where.push(m.id); inMoments += s; }
    }
    if (r.seconds - inMoments > 0.25) where.push('recording');
    return { ...r, where };
  });
  return { runs: out, byMoment };
}

export function reviewCut(slug) {
  const workdir = workdirOf(slug);
  const cfg = readRunConfig(workdir);
  const media = mediaDirOf(slug);
  const cut = latestCut(media);
  if (!cut) return null;
  const moments = readJson(path.join(workdir, 'moments.json')).moments;
  const { deadMax } = reviewOf(cfg);
  const d = deadBeats(cut, { maxStill: deadMax });
  const dead = { maxStill: deadMax, median: d.median, threshold: d.threshold, ...attributeDead(d.runs, moments) };
  const phone = phoneSheet(cut, path.join(media, 'review', 'phone.jpg')).out;
  const extra = formatsOf(cfg).filter((f) => f !== MAIN_FORMAT).flatMap((format) => {
    const c = latestCut(media, format);
    if (!c) return [];
    const dd = deadBeats(c, { maxStill: deadMax });
    return [{ format, cut: c, phone: phoneSheet(c, path.join(media, 'review', `phone${FORMATS[format].suffix.replace('--', '-')}.jpg`)).out, dead: attributeDead(dd.runs, moments) }];
  });
  const out = { cut, checked: new Date().toISOString(), dead, phone, extra };
  writeJson(path.join(workdir, 'review', 'cut.json'), out);
  return out;
}

export function readCutReport(slug) {
  const p = path.join(workdirOf(slug), 'review', 'cut.json');
  return fs.existsSync(p) ? readJson(p) : null;
}
