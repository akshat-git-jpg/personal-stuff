import test from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendRenderLog } from "../src/cli/render-log.mjs";

test("appendRenderLog appends a table row to the log", () => {
  const dir = mkdtempSync(join(tmpdir(), "hg-log-"));
  const log = join(dir, "renders-log.md");
  writeFileSync(log, "| a | b | c | d |\n");
  process.env.HEYGEN_RENDERS_LOG = log;
  appendRenderLog({ avatar: "girl-1", audio: "intro.mp3", video_id: "vid123" });
  const text = readFileSync(log, "utf8");
  assert.match(text, /vid123/);
  assert.match(text, /\(pending download\)/);
});

test("appendRenderLog never throws when the log is missing", () => {
  process.env.HEYGEN_RENDERS_LOG = join(tmpdir(), "no-such-dir", "renders-log.md");
  appendRenderLog({ avatar: "x", audio: "y", video_id: "z" });
});

test("appendRenderLog skips rows without a video_id", () => {
  const dir = mkdtempSync(join(tmpdir(), "hg-log-"));
  const log = join(dir, "renders-log.md");
  writeFileSync(log, "");
  process.env.HEYGEN_RENDERS_LOG = log;
  appendRenderLog({ avatar: "x", audio: "y", video_id: undefined });
  assert.equal(readFileSync(log, "utf8"), "");
});
