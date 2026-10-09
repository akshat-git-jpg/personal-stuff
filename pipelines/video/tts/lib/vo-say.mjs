import fs from "node:fs/promises";
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { loadEnv } from "./env.mjs";
import { deriveSpoken } from "./spoken.mjs";
import { loadRespell } from "./respell.mjs";
import { synthOne } from "./vo-synth.mjs";
import { lintSpoken, fileJob } from "./vo-prep.mjs";
import { wordGate } from "./word-check.mjs";

// ~22s of speech; longer requests drift in pacing (see SKILL batch notes).
const MAX_CHARS = 350;

// Paragraphs on blank lines, long ones split at sentence ends.
export function chunkText(text, max = MAX_CHARS) {
  const chunks = [];
  for (const para of text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean)) {
    let cur = "";
    for (const sentence of para.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [para]) {
      const s = sentence.trim();
      if (cur && (cur + " " + s).length > max) {
        chunks.push(cur);
        cur = s;
      } else {
        cur = cur ? `${cur} ${s}` : s;
      }
    }
    if (cur) chunks.push(cur);
  }
  return chunks;
}

export function respellHits(text, map) {
  return Object.keys(map).filter((k) => deriveSpoken(text, { [k]: map[k] }) !== text);
}

// Synthesizes every chunk into partsDir; returns the wav paths in order.
export async function sayText(text, opts, fetchImpl = fetch, io = fs) {
  const chunks = chunkText(text);
  if (chunks.length === 0) throw new Error("no text to speak");
  await io.mkdir(opts.partsDir, { recursive: true });
  const wavs = [];
  for (const [i, chunk] of chunks.entries()) {
    const name = `c${String(i + 1).padStart(3, "0")}`;
    // Endpoint only accepts sNN ids; the id is a label, so cycle it.
    const id = `s${String((i % 99) + 1).padStart(2, "0")}`;
    const spoken = deriveSpoken(chunk, opts.respell || {});
    let bytes;
    for (let attempt = 1; ; attempt++) {
      try {
        bytes = await synthOne({ id }, spoken, opts, fetchImpl);
        break;
      } catch (err) {
        if (attempt >= 3) throw err;
      }
    }
    const file = path.join(opts.partsDir, `${name}.wav`);
    await io.writeFile(file, bytes);
    wavs.push(file);
    opts.onChunk?.(i + 1, chunks.length);
  }
  return wavs;
}

function concat(wavs, out, gapSec = 0.35) {
  const dir = path.dirname(wavs[0]);
  const rate = execFileSync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=sample_rate", "-of", "csv=p=0", wavs[0]]).toString().trim();
  const sil = path.join(dir, "gap.wav");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `anullsrc=r=${rate}:cl=mono`, "-t", String(gapSec), "-c:a", "pcm_s16le", sil]);
  const listFile = path.join(dir, "concat.txt");
  writeFileSync(listFile, wavs.flatMap((w, i) => (i ? [sil, w] : [w])).map((f) => `file '${f}'`).join("\n"));
  const codec = out.endsWith(".mp3") ? ["-c:a", "libmp3lame", "-q:a", "3"] : [];
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile, ...codec, out]);
}

const isMain =
  typeof process !== "undefined" &&
  import.meta.url.startsWith("file:") &&
  url.fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      text: { type: "string" },
      file: { type: "string" },
      out: { type: "string" },
      respell: { type: "string" },
      "emo-text": { type: "string" },
    },
  });
  if (!values.text && !values.file) {
    console.error('Usage: node lib/vo-say.mjs (--text "..." | --file script.txt) [--out x.mp3] [--respell extra.json] [--emo-text t]');
    process.exit(1);
  }

  const here = path.dirname(url.fileURLToPath(import.meta.url));
  // env.mjs reads <root>/../../.env, i.e. pipelines/.env from pipelines/video/tts.
  loadEnv(path.join(here, ".."));

  const text = values.text ?? (await fs.readFile(values.file, "utf8"));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const out = path.resolve(values.out ?? path.join(os.homedir(), "kb-scratch/video/tts/_adhoc", `vo-${stamp}.mp3`));
  const partsDir = await fs.mkdtemp(path.join(os.tmpdir(), "vo-say-"));
  const respell = loadRespell(values.respell);

  const hits = respellHits(text, respell);
  if (hits.length) console.log(`respelled: ${hits.map((k) => `${k} -> ${respell[k]}`).join(", ")}`);
  // Warn, not refuse: a one-line test should still speak.
  const problems = lintSpoken(text, respell);
  if (problems.length) {
    console.log(`warning: not prepped (${problems.map((p) => `${p.kind} "${p.match}"`).join(", ")}). Run yt-vo prep for a clean read.`);
  }
  if (values.file) {
    const gate = wordGate(fileJob(values.file));
    if (!gate.ok) console.log(`warning: word check: ${gate.reason}`);
  }

  try {
    await fs.mkdir(path.dirname(out), { recursive: true });
    const wavs = await sayText(text, {
      partsDir,
      respell,
      url: process.env.MODAL_TTS_URL,
      token: process.env.MODAL_TTS_TOKEN,
      emo_text: values["emo-text"],
      onChunk: (n, total) => console.log(`chunk ${n}/${total}`),
    });
    if (wavs.length === 1 && out.endsWith(".wav")) await fs.copyFile(wavs[0], out);
    else concat(wavs, out);
    await fs.rm(partsDir, { recursive: true, force: true });
    console.log(`wrote ${out}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
