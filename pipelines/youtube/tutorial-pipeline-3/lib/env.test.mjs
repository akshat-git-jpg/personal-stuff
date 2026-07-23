import test from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import os from "os";
import { loadEnv } from "./env.mjs";

test("loadEnv parses .env", () => {
  const pipeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pipeline-"));
  const projRoot = path.join(pipeRoot, "youtube/tutorial-pipeline-3");
  fs.mkdirSync(projRoot, { recursive: true });
  fs.writeFileSync(path.join(pipeRoot, ".env"), "TEST_KEY=123\n#comment\n\nTEST_KEY2=456");
  
  loadEnv(projRoot);
  assert.strictEqual(process.env.TEST_KEY, "123");
  assert.strictEqual(process.env.TEST_KEY2, "456");
});
