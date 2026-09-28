import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadRespell, GLOBAL_RESPELL_PATH } from "./respell.mjs";
import { deriveSpoken } from "./spoken.mjs";

function tmpJson(obj) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "respell-"));
  const file = path.join(dir, "respell.json");
  fs.writeFileSync(file, JSON.stringify(obj));
  return file;
}

test("loadRespell merges global under the per-video map", () => {
  const global = tmpJson({ "D-ID": "dee eye dee", HeyGen: "hay-jen" });
  const video = tmpJson({ HeyGen: "hey gen" });
  assert.deepStrictEqual(loadRespell(video, global), { "D-ID": "dee eye dee", HeyGen: "hey gen" });
});

test("loadRespell tolerates a missing per-video file", () => {
  const global = tmpJson({ "D-ID": "dee eye dee" });
  assert.deepStrictEqual(loadRespell("/nope/respell.json", global), { "D-ID": "dee eye dee" });
});

test("the shipped global map says D-ID letter by letter", () => {
  const map = loadRespell(null, GLOBAL_RESPELL_PATH);
  assert.strictEqual(deriveSpoken("Next is D-ID. D-ID's pricing.", map), "Next is D-I-D. D-I-D's pricing.");
});
