import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { introSpan, introWords } from './inputs.mjs';

test('introSpan throws when segments.json has no intro part', () => {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'inputs-test-'));
  fs.writeFileSync(path.join(w, 'segments.json'), JSON.stringify({ structure: [{part: 'body', start: 0, end: 10}] }));
  assert.throws(() => introSpan(w), /no "intro" part/);
  fs.rmSync(w, { recursive: true, force: true });
});

test('introWords throws when transcript.json is not an array', () => {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'inputs-test-'));
  fs.writeFileSync(path.join(w, 'segments.json'), JSON.stringify({ structure: [{part: 'intro', start: 0, end: 10}] }));
  fs.writeFileSync(path.join(w, 'transcript.json'), JSON.stringify({ not: 'array' }));
  assert.throws(() => introWords(w), /must be an array/);
  fs.rmSync(w, { recursive: true, force: true });
});

test('introWords filters the flat word array to the span', () => {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), 'inputs-test-'));
  fs.writeFileSync(path.join(w, 'segments.json'), JSON.stringify({ structure: [{part: 'intro', start: 0, end: 2}] }));
  fs.writeFileSync(path.join(w, 'transcript.json'), JSON.stringify([
    { text: "a", start: 0.1, end: 0.5 },
    { text: "b", start: 1.5, end: 1.8 },
    { text: "c", start: 2.1, end: 2.5 }
  ]));
  const words = introWords(w);
  assert.equal(words.length, 2);
  assert.equal(words[0].text, "a");
  assert.equal(words[1].text, "b");
  fs.rmSync(w, { recursive: true, force: true });
});
