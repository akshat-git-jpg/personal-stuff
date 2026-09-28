import test from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chunkText, respellHits, sayText } from "./vo-say.mjs";

test("chunkText splits on blank lines and caps long paragraphs at sentence ends", () => {
  const long = "One two three. ".repeat(40).trim();
  const chunks = chunkText(`Short intro.\n\n${long}`, 100);
  assert.strictEqual(chunks[0], "Short intro.");
  assert.ok(chunks.length > 2);
  assert.ok(chunks.slice(1).every((c) => c.length <= 100 && c.endsWith(".")));
});

test("respellHits names only the keys present in the text", () => {
  assert.deepStrictEqual(respellHits("Next is D-ID.", { "D-ID": "dee eye dee", HeyGen: "hay-jen" }), ["D-ID"]);
});

test("sayText sends the respelled text, one request per chunk", async () => {
  const sent = [];
  const fakeFetch = async (_url, init) => {
    sent.push(JSON.parse(init.body));
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
  };
  const partsDir = await fs.mkdtemp(path.join(os.tmpdir(), "vo-say-"));
  const wavs = await sayText(
    "Next is D-ID.\n\nThen HeyGen.",
    { partsDir, respell: { "D-ID": "dee eye dee" }, url: "https://modal.test", token: "t" },
    fakeFetch
  );
  assert.deepStrictEqual(sent.map((b) => b.text), ["Next is dee eye dee.", "Then HeyGen."]);
  assert.deepStrictEqual(sent.map((b) => b.id), ["s01", "s02"]);
  assert.deepStrictEqual(wavs.map((w) => path.basename(w)), ["c001.wav", "c002.wav"]);
});

test("sayText retries a failed chunk before giving up", async () => {
  let calls = 0;
  const flaky = async () => (++calls < 3 ? { ok: false, status: 500, text: async () => "boom" } : { ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
  const partsDir = await fs.mkdtemp(path.join(os.tmpdir(), "vo-say-"));
  await sayText("Hi.", { partsDir, url: "https://modal.test", token: "t" }, flaky);
  assert.strictEqual(calls, 3);
});
