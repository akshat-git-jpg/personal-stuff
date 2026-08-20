/* check-film-timing.mjs — the intro's graphics must be timed by the voice.
 *
 * Why this exists: every reveal in the intro film used to carry a hand-typed
 * second, estimated by ear. Measured against the transcript on 2026-08-20 the
 * estimates were out by 1.4 to 3.1 seconds — the n8n mark landed 1.7s before he
 * says "n8n", and "anyone" landed 3.1s after. The owner had reported it three
 * separate times ("this is not the first time this happened many times") and
 * nothing in the pipeline could see it, because a typed number is not wrong in
 * any way a machine could detect.
 *
 * The fix was to make reveals name their WORD — `on('flowise')` — and read the
 * time from transcript.json. This gate is what keeps that true:
 *
 *   1. The baked WORDS table in the composition still matches transcript.json.
 *      (If someone re-transcribes, or edits the voiceover, the table goes stale
 *      and every reveal silently drifts. That is the failure this catches.)
 *   2. Every word named by an at()/on() call is actually spoken in the intro.
 *      A typo would otherwise throw at render time, deep in a worker.
 *   3. Each named word falls inside the beat that reveals it, so a reveal can't
 *      be pinned to a word from a different sentence.
 *
 * What it deliberately does NOT do: judge whether the right things were given a
 * reveal at all. A beat can be perfectly synced and still say nothing about half
 * its clause — that is T29, and it stays author judgement.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node lib/intro-film/check-film-timing.mjs <slug>');
  process.exit(1);
}

const videoDir = path.join(ROOT, 'videos', slug);
const filmPath = path.join(videoDir, 'intro-film', 'film', 'index.html');
const screenplayPath = path.join(videoDir, 'intro-film', 'screenplay.json');
const transcriptPath = path.join(videoDir, 'transcript.json');

for (const p of [filmPath, screenplayPath, transcriptPath]) {
  if (!fs.existsSync(p)) {
    console.error(`Error: missing ${path.relative(ROOT, p)}`);
    process.exit(1);
  }
}

const film = fs.readFileSync(filmPath, 'utf8');
const screenplay = JSON.parse(fs.readFileSync(screenplayPath, 'utf8'));
const beats = screenplay.beats || screenplay;
const filmEnd = Math.max(...beats.map((b) => b.t_end));

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9']/g, '');

let bad = false;
const err = (m) => { console.error(`Error: ${m}`); bad = true; };

/* ---- 1. the baked table still matches the transcript --------------------- */
const m = film.match(/const WORDS = (\[[\s\S]*?\]);\n/);
if (!m) {
  err('the composition has no baked WORDS table — reveals cannot be word-timed. '
    + 'See T27 in TASTE-INTRO.md.');
  process.exit(1);
}

let baked;
try {
  baked = JSON.parse(m[1]);
} catch (e) {
  err(`the baked WORDS table is not valid JSON: ${e.message}`);
  process.exit(1);
}

const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
const live = transcript
  .filter((w) => typeof w.start === 'number' && w.start < filmEnd)
  .map((w) => [String(w.text ?? '').trim(), Math.round(w.start * 1000) / 1000]);

if (baked.length !== live.length) {
  err(`the baked WORDS table has ${baked.length} words but the transcript has `
    + `${live.length} under ${filmEnd.toFixed(2)}s. The voiceover changed and the table `
    + `did not — every reveal is now pinned to the wrong moment. Re-bake it.`);
} else {
  for (let i = 0; i < baked.length; i++) {
    if (norm(baked[i][0]) !== norm(live[i][0]) || Math.abs(baked[i][1] - live[i][1]) > 0.002) {
      err(`baked word ${i} is "${baked[i][0]}"@${baked[i][1]} but the transcript says `
        + `"${live[i][0]}"@${live[i][1]}. The table is stale — re-bake it.`);
      break;
    }
  }
}

/* ---- 2 + 3. every named word exists, and sits in the beat that reveals it - */
const lookup = (needle, nth) => {
  const n = norm(needle);
  let k = 0;
  for (const [text, start] of baked) {
    if (norm(text) === n && ++k === nth) return start;
  }
  return null;
};

/* Find every at()/on() call and the beat it is written under. Beats are marked
   by the banner comments check-film-sync.mjs already enforces, so the mapping
   is exact rather than guessed from line proximity.
 *
 * Two shapes must be collected, and the second matters more than it looks. A
 * reveal can name its word directly — on('avoid') — or drive a list through a
 * map: ['creators','developers',…].map((w) => on(w)). The first version of this
 * gate matched only the direct form and cheerfully reported "2 reveals timed"
 * while sixteen more flowed through arrays it could not see. A gate with a
 * blind spot is precisely how the hand-typed times survived three rounds of
 * owner feedback, so both shapes are collected and the count is printed —
 * a number far below the number of reveals in the film is the tell. */
const lines = film.split('\n');
const banner = /^\/\* (b\d\d) \S+ ([\d.]+) -> ([\d.]+)/;

/* Which beat is line N inside? Built once so both scans can ask. */
const beatAtLine = [];
{
  let current = null;
  lines.forEach((line, ix) => {
    const b = line.match(banner);
    if (b) current = { id: b[1], start: Number(b[2]), end: Number(b[3]) };
    beatAtLine[ix] = current;
  });
}

let calls = 0;
const checkWord = (word, nth, ix, windowOverride) => {
  calls++;
  const t = lookup(word, nth);
  if (t === null) {
    err(`line ${ix + 1}: on('${word}'${nth > 1 ? `, ${nth}` : ''}) — that word is not `
      + `spoken in the intro. Check the spelling against transcript.json.`);
    return;
  }
  const beat = windowOverride || beatAtLine[ix];
  if (beat && (t < beat.start - 0.5 || t > beat.end + 0.5)) {
    err(`line ${ix + 1}: ${beat.id} runs ${beat.start}-${beat.end}s but `
      + `"${word}"#${nth} is spoken at ${t.toFixed(2)}s — the reveal is pinned to a word `
      + `from a different sentence. Pass the occurrence number, e.g. on('${word}', 2).`);
  }
};

/* shape 1 — the word named at the call site */
lines.forEach((line, ix) => {
  if (banner.test(line)) return;
  const re = /\b(?:at|on)\('([^']+)'(?:\s*,\s*(\d+))?\)/g;
  let c;
  while ((c = re.exec(line)) !== null) checkWord(c[1], c[2] ? Number(c[2]) : 1, ix);
});

/* shape 2 — an array of words feeding an at()/on() call in the same statement.
 *
 * Two pieces of syntax the array form needs, both of which the gate itself
 * forced into existence on first run:
 *
 *   'flexibility#2'  — an occurrence number. "flexibility" and "pricing" are
 *   each said once in b06 and again later, so #1 silently resolved to a word
 *   twenty seconds earlier. The direct form has always had on(word, nth); the
 *   array form needs the same, spelled inline.
 *
 *   /* spans: b14-b15 *​/  — some devices deliberately run across two beats.
 *   The agenda is one card under one hero covering b14 and b15, so its words
 *   legitimately fall outside the beat its declaration sits under. The marker
 *   is explicit and rare on purpose: without it the beat window stays strict,
 *   and widening it is a decision someone has to write down.
 */
{
  const re = /\[((?:\s*'[^']*'\s*,?\s*)+)\]\s*\.\s*(?:forEach|map)\(([\s\S]{0,400}?)\b(?:at|on)\(/g;
  let a;
  while ((a = re.exec(film)) !== null) {
    const ix = film.slice(0, a.index).split('\n').length - 1;
    const before = film.slice(Math.max(0, a.index - 600), a.index);
    const span = before.match(/spans:\s*(b\d\d)\s*-\s*(b\d\d)/);
    let window = beatAtLine[ix];
    if (span) {
      const first = beats.find((b) => b.id === span[1]);
      const last = beats.find((b) => b.id === span[2]);
      if (!first || !last) {
        err(`line ${ix + 1}: spans: ${span[1]}-${span[2]} names a beat that is not in the screenplay`);
      } else {
        window = { id: `${span[1]}-${span[2]}`, start: first.t_start, end: last.t_end };
      }
    }
    for (const m2 of a[1].matchAll(/'([^']*)'/g)) {
      const [word, nth] = m2[1].split('#');
      checkWord(word, nth ? Number(nth) : 1, ix, window);
    }
  }
}

if (calls === 0) {
  err('no at()/on() calls in the composition — reveal times are still typed by hand, '
    + 'which is exactly what T27 forbids.');
}

if (bad) process.exit(1);
console.log(`film timing ok — ${calls} reveals timed off ${baked.length} spoken words`);
