import { test } from "node:test";
import assert from "node:assert";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { meterSpent, appendMapping, testInputs } from "../src/workflows/avatar-test.mjs";

test("meterSpent: identical meters mean nothing was used", () => {
  const m = { credits: 200, seconds_consumed: 303, ai_image_credits: 199, ai_video_credits: 26, ai_concept_credits: 132, priority_count: 4 };
  assert.deepStrictEqual(meterSpent(m, { ...m, priority_count: 5 }), []);
});

test("meterSpent: any credit or second moving is reported", () => {
  const a = { credits: 200, seconds_consumed: 303 };
  assert.deepStrictEqual(meterSpent(a, { credits: 200, seconds_consumed: 330 }), ["seconds_consumed 303 → 330"]);
});

test("appendMapping: creates the file, then appends", () => {
  const f = join(mkdtempSync(join(tmpdir(), "avt-")), "m.json");
  appendMapping({ avatar_name: "a" }, f);
  appendMapping({ avatar_name: "b" }, f);
  assert.deepStrictEqual(JSON.parse(readFileSync(f, "utf8")).tests.map((t) => t.avatar_name), ["a", "b"]);
});

test("testInputs: a new photo OR a saved avatar, never both or neither", () => {
  assert.strictEqual(testInputs(["--image", "p.png", "--audio", "a.mp3", "--name", "n"]).reuse, undefined);
  assert.strictEqual(testInputs(["--avatar-id", "abc", "--audio", "a.mp3", "--name", "n"]).reuse, "abc");
  assert.ok(testInputs(["--audio", "a.mp3", "--name", "n"]).error);
  assert.ok(testInputs(["--image", "p.png", "--avatar-id", "abc", "--audio", "a.mp3", "--name", "n"]).error);
  assert.ok(testInputs(["--image", "p.png", "--name", "n"]).error);
});
