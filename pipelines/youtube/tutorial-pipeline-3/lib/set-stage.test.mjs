import test from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

test("set-stage - happy path", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "set-stage-"));
  const slug = "test-video";
  const videoDir = path.join(tmpDir, "videos", slug);
  fs.mkdirSync(videoDir, { recursive: true });

  const script = {
    video: slug,
    version: 1,
    stage: "generated",
    sections: [
      {
        id: "s01",
        demo: false,
        display_text: "Hello",
        spoken_text: "",
        flags: [],
        notes: "",
        version: 1,
        tts: { regens_used: 0, locked: false, take: null },
        recording: { status: "none" }
      }
    ]
  };
  fs.writeFileSync(path.join(videoDir, "script.json"), JSON.stringify(script));

  execFileSync(process.execPath, [
    "lib/set-stage.mjs",
    slug,
    "verified",
    "--root",
    tmpDir
  ]);

  const updated = JSON.parse(fs.readFileSync(path.join(videoDir, "script.json"), "utf8"));
  assert.equal(updated.stage, "verified");
});

test("set-stage - tts gate failure", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "set-stage-"));
  const slug = "test-video";
  const videoDir = path.join(tmpDir, "videos", slug);
  fs.mkdirSync(videoDir, { recursive: true });

  const script = {
    video: slug,
    channel: "test",
    version: 1,
    stage: "polished",
    sections: [
      {
        id: "s01",
        demo: true,
        display_text: "Hello there everyone",
        spoken_text: "", // polished stage requires non-empty spoken_text
        flags: [],
        notes: "",
        version: 1,
        tts: { regens_used: 0, locked: false, take: null },
        recording: { status: "pending" }
      }
    ]
  };
  fs.writeFileSync(path.join(videoDir, "script.json"), JSON.stringify(script));

  assert.throws(() => {
    execFileSync(process.execPath, [
      "lib/set-stage.mjs",
      slug,
      "tts",
      "--root",
      tmpDir
    ]);
  }, /Command failed/);

  const unmodified = JSON.parse(fs.readFileSync(path.join(videoDir, "script.json"), "utf8"));
  assert.equal(unmodified.stage, "polished");
});

test("set-stage - invalid transition", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "set-stage-"));
  const slug = "test-video";
  const videoDir = path.join(tmpDir, "videos", slug);
  fs.mkdirSync(videoDir, { recursive: true });

  const script = { stage: "generated" };
  fs.writeFileSync(path.join(videoDir, "script.json"), JSON.stringify(script));

  assert.throws(() => {
    execFileSync(process.execPath, [
      "lib/set-stage.mjs",
      slug,
      "polished",
      "--root",
      tmpDir
    ]);
  }, /Command failed/);
});
