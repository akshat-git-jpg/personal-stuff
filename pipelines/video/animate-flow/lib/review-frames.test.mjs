import test from 'node:test';
import assert from 'node:assert/strict';
import { contractErrors } from './review-frames.mjs';

const canvas = { w: 1920, h: 1080, fps: 30 };
const root = (extra = '') => `<div id="root" data-composition-id="moment" data-start="0" data-width="1920" data-height="1080" data-duration="6.40"${extra}>`;
const page = (body) => `<html><head><script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet"></head><body>${body}</body></html>`;

test('a composition that honours the contract passes', () => {
  assert.deepEqual(contractErrors(page(`${root()}<img src="assets/heygen.png"></div>`), { duration: 6.4, canvas }), []);
});

test('id, canvas, duration, media and outside files are each named', () => {
  const html = page(`<div data-composition-id="main" data-width="1280" data-height="720" data-duration="9"><audio src="assets/a.mp3"></audio><img src="../logo.png"><script src="https://evil.example/x.js"></script></div>`);
  const errs = contractErrors(html, { duration: 6.4, canvas }).join('\n');
  assert.match(errs, /composition id is "main"/);
  assert.match(errs, /canvas is 1280x720/);
  assert.match(errs, /data-duration is 9/);
  assert.match(errs, /silent/);
  assert.match(errs, /outside assets/);
  assert.deepEqual(contractErrors('<div></div>', { duration: 1, canvas }), ['no element carries data-composition-id']);
});
