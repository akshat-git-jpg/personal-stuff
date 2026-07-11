import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseMdTables, scanSource, manifestFor, safeResolve, parseRange } from "../serve.mjs";

test("parseMdTables", () => {
  const md = `
## Videos generated

| Output file | Avatar / template | Audio | video_id |
|---|---|---|---|
| \`girl-1/a.mp4\` | Avatar | aud | \`123\` |
| b.mp4 | Template |   | 456 |
`;
  const rows = parseMdTables(md);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0]["output file"], "girl-1/a.mp4");
  assert.strictEqual(rows[0]["avatar / template"], "Avatar");
  assert.strictEqual(rows[0]["audio"], "aud");
  assert.strictEqual(rows[0]["video_id"], "123");
  
  assert.strictEqual(rows[1]["output file"], "b.mp4");
  assert.strictEqual(rows[1]["audio"], "");
});

test("parseMdTables - header only", () => {
  const md = `
| Date | Output file (under ~/kb-scratch/video/tts/) | Pipeline | Engine | Ref voice (slug) | Source / notes |
|---|---|---|---|---|---|
`;
  const rows = parseMdTables(md);
  assert.deepStrictEqual(rows, []);
});

test("scanner - fixture tree", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mb-"));
  fs.mkdirSync(path.join(root, "heygen/_test/girl-1"), { recursive: true });
  fs.mkdirSync(path.join(root, "heygen/.hidden"), { recursive: true });
  
  fs.writeFileSync(path.join(root, "heygen/_test/girl-1/a.mp4"), "x");
  fs.writeFileSync(path.join(root, "heygen/_test/audio.wav"), "x");
  fs.writeFileSync(path.join(root, "heygen/.hidden/x.mp4"), "x");
  fs.writeFileSync(path.join(root, "heygen/notes.txt"), "x");
  
  const files = scanSource({ root: path.join(root, "heygen") });
  assert.strictEqual(files.length, 2);
  
  const a = files.find(f => f.name === "a.mp4");
  assert.ok(a);
  assert.strictEqual(a.type, "video");
  assert.strictEqual(a.group, "_test");
  
  const aud = files.find(f => f.name === "audio.wav");
  assert.ok(aud);
  assert.strictEqual(aud.type, "audio");
  assert.strictEqual(aud.group, "_test");
  
  const empty = scanSource({ root: path.join(root, "missing") });
  assert.deepStrictEqual(empty, []);
});

test("manifest join", () => {
  const files = [{ name: "a.mp4" }];
  const rows = [
    { "output file": "girl-1/a.mp4", "video_id": "123" },
    { "output file": "(pending download)", "video_id": "456" }
  ];
  
  const unmatched = manifestFor(files, rows);
  assert.strictEqual(files[0].manifest.video_id, "123");
  assert.strictEqual(unmatched.length, 1);
  assert.strictEqual(unmatched[0]["output file"], "(pending download)");
});

test("safeResolve", () => {
  const root = "/tmp/root";
  assert.ok(safeResolve(root, "ok/f.mp4"));
  assert.strictEqual(safeResolve(root, "../etc/passwd"), null);
});

test("parseRange", () => {
  assert.deepStrictEqual(parseRange("bytes=0-99", 1000), { start: 0, end: 99 });
  assert.deepStrictEqual(parseRange("bytes=500-", 1000), { start: 500, end: 999 });
  assert.deepStrictEqual(parseRange("bytes=-100", 1000), { start: 900, end: 999 });
  assert.strictEqual(parseRange("bytes=2000-", 1000), null);
  assert.strictEqual(parseRange(undefined, 1000), null);
});
