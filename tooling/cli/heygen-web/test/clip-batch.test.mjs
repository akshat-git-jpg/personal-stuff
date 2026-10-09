import test from "node:test";
import assert from "node:assert/strict";
import { planPieces, parseSilences, poseAt, frameDiff, smoothLimit, motionWeights } from "../src/workflows/clip-batch.mjs";

// Fake pose map: the "pose" is one gray level that swings with an 4 s period, 30 s long.
const map = Array.from({ length: 30 * 25 }, (_, i) => new Uint8Array(4).fill(Math.round(100 + 80 * Math.sin((2 * Math.PI * i) / 25 / 4))));
const pauses = (ts) => ts.map((t) => ({ start: t - 0.4, end: t + 0.4 }));

test("short clip is one piece, no lead", () => {
  assert.deepEqual(planPieces(18, [], map), [{ start: 0, end: 18, lead: 0, joinCost: null }]);
});

test("pieces stay 10-25 s, cut inside a pause, and cover the audio", () => {
  const sil = pauses([12, 17, 21, 33, 41, 47, 58]);
  const p = planPieces(70, sil, map);
  assert.equal(p[0].start, 0);
  assert.equal(p.at(-1).end, 70);
  for (let i = 0; i < p.length; i++) {
    const len = p[i].end - p[i].start;
    assert.ok(len >= 10 - 1e-6 && len <= 25 + 1e-6, JSON.stringify(p));
    if (i + 1 < p.length) {
      assert.equal(p[i].end, p[i + 1].start);
      assert.ok(sil.some((s) => p[i].end >= s.start && p[i].end <= s.end), "cut not in a pause");
    }
  }
});

test("each join matches the end pose to the next piece's start pose", () => {
  const p = planPieces(70, pauses([12, 17, 21, 33, 41, 47, 58]), map);
  for (let i = 0; i + 1 < p.length; i++) {
    const end = poseAt(map, p[i].lead + (p[i].end - p[i].start)), start = poseAt(map, p[i + 1].lead);
    assert.ok(frameDiff(end, start) <= p[i].joinCost + 1e-6);
    assert.ok(p[i].joinCost < 3, `join ${i} cost ${p[i].joinCost}`);
    assert.ok(p[i + 1].lead >= 0 && p[i + 1].lead <= 3);
  }
});

test("smoothLimit is the 99th percentile frame step", () => {
  assert.ok(smoothLimit(map) > 0 && smoothLimit(map) <= 5);
});

test("parseSilences reads ffmpeg silencedetect output", () => {
  const log = "[silencedetect] silence_start: 1.5\n[silencedetect] silence_end: 2.1 | silence_duration: 0.6\n";
  assert.deepEqual(parseSilences(log), [{ start: 1.5, end: 2.1 }]);
});

test("motionWeights: a moving pixel outweighs a still one", () => {
  const m = Array.from({ length: 50 }, (_, i) => Uint8Array.from([100, i % 2 ? 200 : 0]));
  const w = motionWeights(m);
  assert.ok(w[1] > w[0]);
  assert.ok(frameDiff(Uint8Array.from([0, 0]), Uint8Array.from([0, 200]), w) > frameDiff(Uint8Array.from([0, 0]), Uint8Array.from([200, 0]), w));
});
