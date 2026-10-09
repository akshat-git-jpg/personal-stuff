import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";
import { parseArgs } from "node:util";
import { scanFlags } from "./flags.mjs";
import { deriveSpoken } from "./spoken.mjs";
import { loadRespell } from "./respell.mjs";
import { wordGate } from "./word-check.mjs";

// What the engine must never see. Checked on the text AFTER the respell map runs.
const RULES = [
  { kind: "dash", re: /[—–]/g, fix: "full stop, comma or paragraph break" },
  { kind: "semicolon", re: /;/g, fix: "full stop or comma" },
  { kind: "ellipsis", re: /\.{3}|…/g, fix: "full stop" },
  { kind: "symbol", re: /[&%#+\/@*=<>|\\~^_]/g, fix: "spell it out in words" },
  { kind: "bracket", re: /[()[\]{}]/g, fix: "rewrite without brackets" },
  { kind: "digit", re: /\d+(?:[.,]\d+)*[A-Za-z]*/g, fix: "write the number as words, or add a respell key" },
  // Two-letter caps (AI, UI) already read as letters; three or more get spelled or shouted.
  { kind: "caps", re: /\b[A-Z]{3,}\b/g, fix: "lower-case it, or add a respell key (API -> A-P-I)" },
];

// Problems in one VO text, as the engine would receive it.
export function lintSpoken(text, respellMap = {}) {
  const problems = [];
  if (!String(text).trim()) return [{ kind: "empty", match: "", fix: "run prep: fill the VO text" }];
  for (const f of scanFlags(text)) problems.push({ kind: "flag", match: f.raw, fix: "resolve it in the script" });
  if (problems.length) return problems;
  const final = deriveSpoken(text, respellMap);
  for (const rule of RULES) {
    for (const m of final.matchAll(rule.re)) problems.push({ kind: rule.kind, match: m[0], fix: rule.fix });
  }
  return problems;
}

// Per section: the caption text, the VO text, and what is still wrong with it.
export function checkScript(script, respellMap = {}) {
  const sections = script.sections.map((sec) => ({
    id: sec.id,
    display: sec.display_text,
    spoken: sec.spoken_text || "",
    problems: lintSpoken(sec.spoken_text || "", respellMap),
  }));
  return { ok: sections.every((s) => s.problems.length === 0), sections };
}

// The word-check job id for a doc: its file name without .vo.txt / .txt.
export function fileJob(file) {
  return path.basename(file).replace(/(\.vo)?\.txt$/, "");
}

// Copies display_text into every empty spoken_text, so prep starts from the final script.
export function seedScript(script) {
  return {
    ...script,
    sections: script.sections.map((sec) =>
      sec.spoken_text ? sec : { ...sec, spoken_text: sec.display_text }
    ),
  };
}

// One line per distinct problem, with a count.
function printProblems(label, problems) {
  const seen = new Map();
  for (const p of problems) {
    const key = `${p.kind}\0${p.match}`;
    seen.set(key, { ...p, n: (seen.get(key)?.n ?? 0) + 1 });
  }
  for (const p of seen.values()) {
    console.log(`  ${label} ${p.kind}: "${p.match}"${p.n > 1 ? ` x${p.n}` : ""} -> ${p.fix}`);
  }
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
      file: { type: "string" },
      respell: { type: "string" },
      seed: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  const slug = positionals[0];
  if (!slug && !values.file) {
    console.error(
      "Usage: node lib/vo-prep.mjs <slug> [--root d] [--seed]\n       node lib/vo-prep.mjs --file x.vo.txt [--respell extra.json]"
    );
    process.exit(1);
  }

  if (values.file) {
    const text = await fs.readFile(values.file, "utf8");
    const respell = { ...loadRespell(null), ...(values.respell ? JSON.parse(await fs.readFile(values.respell, "utf8")) : {}) };
    const problems = lintSpoken(text, respell);
    printProblems("", problems);
    const gate = wordGate(fileJob(values.file));
    console.log(`word check: ${gate.reason}`);
    const ready = !problems.length && gate.ok;
    console.log(ready ? `${values.file}: ready for say` : `${values.file}: ${problems.length} text problem(s), word check ${gate.ok ? "done" : "not done"}`);
    process.exit(ready ? 0 : 1);
  }

  const scriptPath = path.join(values.root, "videos", slug, "script.json");
  let script = JSON.parse(await fs.readFile(scriptPath, "utf8"));
  if (values.seed) {
    script = seedScript(script);
    await fs.writeFile(scriptPath, JSON.stringify(script, null, 2) + "\n");
    console.log("seeded: every empty spoken_text now holds its display_text");
  }

  const respell = loadRespell(path.join(values.root, "videos", slug, "respell.json"));
  const { ok, sections } = checkScript(script, respell);
  for (const s of sections) {
    if (s.spoken !== s.display) {
      console.log(`${s.id} changed`);
      console.log(`  script: ${s.display.replace(/\s+/g, " ")}`);
      console.log(`  vo:     ${s.spoken.replace(/\s+/g, " ")}`);
    }
    printProblems(s.id, s.problems);
  }
  const bad = sections.filter((s) => s.problems.length).length;
  const gate = wordGate(slug);
  console.log(`word check: ${gate.reason}`);
  console.log(ok ? `all ${sections.length} sections have clean VO text` : `${bad} of ${sections.length} sections still need prep`);
  console.log(ok && gate.ok ? "ready for synth" : "not ready for synth");
  process.exit(ok && gate.ok ? 0 : 1);
}
