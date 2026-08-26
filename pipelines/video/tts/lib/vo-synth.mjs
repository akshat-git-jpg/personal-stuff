import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";
import { parseArgs } from "node:util";
import { loadEnv } from "./env.mjs";
import { scanFlags } from "./flags.mjs";
import { deriveSpoken } from "./spoken.mjs";

// Section id -> wav name. Keeps the take identifiable without a DB.
export function takeName(section) {
  const n = (section.tts?.regens_used ?? 0) + 1;
  return `${section.id}-v${section.version}-t${n}.wav`;
}

// Throws naming the failed precondition; returns the spoken text to synthesize.
export function spokenFor(section, respellMap = {}) {
  if (section.flags && section.flags.length > 0) {
    throw new Error(`${section.id}: unresolved flags — polish the script first`);
  }
  const text = section.spoken_text
    ? section.spoken_text
    : deriveSpoken(section.display_text, respellMap);
  if (!text.trim()) {
    throw new Error(`${section.id}: spoken text is empty`);
  }
  if (scanFlags(text).length > 0) {
    throw new Error(`${section.id}: spoken text still contains flag markers`);
  }
  return text;
}

// One POST to the Modal `synth_section` endpoint. Returns the wav bytes.
export async function synthOne(section, text, opts, fetchImpl) {
  const base = (opts.url || "").replace(/\/+$/, "");
  if (!base) throw new Error("MODAL_TTS_URL is not set");
  if (!opts.token) throw new Error("MODAL_TTS_TOKEN is not set");

  const body = { id: section.id, text };
  if (opts.emo_text) body.emo_text = opts.emo_text;
  if (opts.interval_silence !== undefined) body.interval_silence = opts.interval_silence;

  const res = await fetchImpl(base, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`synth ${section.id} failed: ${res.status} ${txt}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// Which sections this run will touch. Locked ones are skipped unless force.
export function selectSections(script, { only, force } = {}) {
  return script.sections.filter((sec) => {
    if (only && sec.id !== only) return false;
    if (sec.tts?.locked && !force) return false;
    return true;
  });
}

// Synthesizes into <root>/videos/<slug>/audio and returns the updated script.
export async function synthScript(script, opts, fetchImpl = fetch, io = fs) {
  const audioDir = path.join(opts.root, "videos", opts.slug, "audio");
  await io.mkdir(audioDir, { recursive: true });

  const targets = selectSections(script, opts);
  if (targets.length === 0) {
    return { script, written: [], skipped: script.sections.map((s) => s.id) };
  }

  const byId = new Map();
  const written = [];
  for (const sec of targets) {
    const text = spokenFor(sec, opts.respell);
    const bytes = await synthOne(sec, text, opts, fetchImpl);
    await io.writeFile(path.join(audioDir, `${sec.id}.wav`), bytes);
    byId.set(sec.id, {
      ...sec,
      spoken_text: text,
      tts: {
        ...sec.tts,
        regens_used: (sec.tts?.regens_used ?? 0) + 1,
        locked: false,
        take: takeName(sec),
      },
    });
    written.push(sec.id);
  }

  const sections = script.sections.map((sec) => byId.get(sec.id) || sec);
  const skipped = script.sections.filter((s) => !byId.has(s.id)).map((s) => s.id);
  return { script: { ...script, sections }, written, skipped };
}

const isMain =
  typeof process !== "undefined" &&
  import.meta.url.startsWith("file:") &&
  url.fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      root: { type: "string", default: "." },
      only: { type: "string" },
      "emo-text": { type: "string" },
      "interval-silence": { type: "string" },
      force: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const slug = positionals[0];
  if (!slug) {
    console.error(
      "Usage: node lib/vo-synth.mjs <slug> [--root d] [--only s02] [--emo-text t] [--interval-silence ms] [--force]"
    );
    process.exit(1);
  }

  const root = values.root;
  loadEnv(path.resolve(root));

  const scriptPath = path.join(root, "videos", slug, "script.json");
  const script = JSON.parse(await fs.readFile(scriptPath, "utf8"));

  if (script.stage !== "tts" && script.stage !== "polished") {
    console.error(`stage must be polished or tts (got ${script.stage})`);
    process.exit(1);
  }

  const respellPath = path.join(root, "videos", slug, "respell.json");
  let respell = {};
  try {
    respell = JSON.parse(await fs.readFile(respellPath, "utf8"));
  } catch {
    /* optional */
  }

  try {
    const { script: next, written, skipped } = await synthScript(
      script,
      {
        root,
        slug,
        only: values.only,
        force: values.force,
        respell,
        url: process.env.MODAL_TTS_URL,
        token: process.env.MODAL_TTS_TOKEN,
        emo_text: values["emo-text"],
        interval_silence: values["interval-silence"]
          ? Number(values["interval-silence"])
          : undefined,
      },
      fetch
    );
    await fs.writeFile(scriptPath, JSON.stringify(next, null, 2) + "\n");
    console.log(`synthesized: ${written.join(", ") || "(none)"}`);

    // Only call it "locked" when it actually is — --only skips for a different reason.
    const notWritten = new Set(skipped);
    const lockedSkips = next.sections
      .filter((s) => notWritten.has(s.id) && s.tts?.locked)
      .map((s) => s.id);
    if (lockedSkips.length) {
      console.log(`skipped (locked, use --force to re-roll): ${lockedSkips.join(", ")}`);
    }
    if (values.only) {
      const missing = next.sections.filter((s) => s.id === values.only).length === 0;
      if (missing) console.log(`warning: no section ${values.only} in this script`);
    }
    console.log(`wavs in videos/${slug}/audio/ — listen, then: bash run.sh ${slug} vo-lock`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
