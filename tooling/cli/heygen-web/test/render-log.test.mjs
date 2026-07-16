import test from "node:test";
import assert from "node:assert";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendRenderLog, heygenLink } from "../src/cli/render-log.mjs";

test("appendRenderLog appends a row with the HeyGen link built from the title", () => {
  const dir = mkdtempSync(join(tmpdir(), "hg-log-"));
  const log = join(dir, "renders-log.md");
  writeFileSync(log, "| a | b | c | d |\n");
  process.env.HEYGEN_RENDERS_LOG = log;
  appendRenderLog({ avatar: "girl-1", audio: "intro.mp3", video_id: "vid123", title: "My Test Render" });
  const text = readFileSync(log, "utf8");
  assert.match(text, /vid123/);
  assert.match(text, /\[heygen link\]\(https:\/\/app\.heygen\.com\/videos\/my-test-render--vid123\)/);
});

test("heygenLink slugifies the title and DOUBLE-dashes the video_id (verified real HeyGen URL)", () => {
  // Verified 2026-07-16 against a real render — a SINGLE dash 404s; the double dash is required.
  assert.equal(heygenLink("Dustin-11e82ae7df844be8a5695ee864e44f49", "e9c7314895eb4b31a591596b6efb33f7"),
    "https://app.heygen.com/videos/dustin-11e82ae7df844be8a5695ee864e44f49--e9c7314895eb4b31a591596b6efb33f7");
  assert.equal(heygenLink("submagic vs opusclip conclusion", "e0521165b4974ca1a734a3077352e33b"),
    "https://app.heygen.com/videos/submagic-vs-opusclip-conclusion--e0521165b4974ca1a734a3077352e33b");
  // no title → still a valid link, just id
  assert.equal(heygenLink(undefined, "abc"), "https://app.heygen.com/videos/untitled-video--abc");
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
