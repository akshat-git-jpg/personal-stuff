// The whole reason this step moved into vf2. intro-studio transcribed the
// intro itself and put four of five product names wrong on screen; 010's
// quality pass already has them right, and 015 already measured where the
// intro ends. Deriving either one again here would re-open both bugs.
import fs from 'node:fs';
import path from 'node:path';

export function introSpan(workdir) {
  const segs = JSON.parse(fs.readFileSync(path.join(workdir, 'segments.json'), 'utf8'));
  const intro = (segs.structure ?? []).find((p) => p.part === 'intro');
  if (!intro) throw new Error('segments.json has no "intro" part — run `run.sh <slug> segments` first');
  if (!(intro.end > intro.start)) throw new Error(`segments.json intro span is not positive: ${intro.start}..${intro.end}`);
  return { start: intro.start, end: intro.end, duration: intro.end - intro.start };
}

// transcript.json is a flat ARRAY of {text,start,end} words, not an object.
export function introWords(workdir) {
  const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
  if (!Array.isArray(words)) throw new Error('transcript.json must be an array of words');
  const { start, end } = introSpan(workdir);
  return words.filter((w) => w.start >= start && w.end <= end);
}
