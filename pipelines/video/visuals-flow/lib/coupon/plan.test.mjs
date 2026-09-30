import test from 'node:test';
import assert from 'node:assert/strict';
import { planCoupon, markOpenerBreaks, findCode, uniqueAnchor } from './plan.mjs';
import { fixBrand, toolFromSlug } from './brand.mjs';
import { resolveShots } from '../resolve-shots.mjs';
import { findPhrase, normWord } from '../resolve.mjs';

// Words at a steady 0.4s each, from a list of sentences.
function script(sentences) {
  const words = [];
  let t = 0;
  for (const s of sentences) {
    for (const text of s.split(' ')) { words.push({ text, start: +t.toFixed(2), end: +(t + 0.35).toFixed(2) }); t += 0.4; }
    t += 0.3;
  }
  return words;
}

const SHAPE = [
  'Before applying the promo code, the price is $39.',
  'After applying the promo code, the price is reduced to $29.25, saving you almost $10 every month for a lifetime.',
  'Hey guys, in this video I will share my exclusive promo code with you.',
  'This code gives the highest lifetime discount on any plan you choose today.',
  'To claim the discount, click the link provided in the description.',
  'It will direct you to a special page where you need to sign up.',
  ...Array.from({ length: 40 }, (_, i) => `Filler sentence number ${i} about the pricing page and the plans here.`),
  'Now enter AGR25 in all caps and hit redeem code.',
  ...Array.from({ length: 20 }, (_, i) => `More filler number ${i} about checking the video description for updates.`),
  'Now complete the checkout and that\'s it you have redeemed the promo code.',
  'Thank you so much for watching and do not forget to hit the subscribe button.',
  'See you in the next video.',
];

test('the coupon shape plans two host spans, link pills and subscribe, and never shows the code', () => {
  const words = markOpenerBreaks(script(SHAPE)).words;
  const r = planCoupon(words, { video: 'v' });
  assert.deepEqual(r.errors, []);
  assert.equal(r.code, 'AGR25');
  const cards = r.cues.cues.map((c) => c.card);
  assert.ok(!cards.includes('overlay/deal-stamp'), 'owner removed the price card');
  assert.ok(!cards.includes('overlay/code-reveal'), 'owner: the code is never on screen');
  assert.ok(!JSON.stringify(r.cues).includes('AGR25'), 'no card variable carries the code');
  assert.equal(cards.at(-1), 'like-subscribe/like-subscribe');
  assert.ok(cards.filter((c) => c.startsWith('link-in-description')).length >= 2);
  assert.equal(r.shots.engineMode, 'test');
  assert.equal(r.avatarPlan.character, 'girl-1');
  assert.equal(r.avatarPlan.model, 'heygen3');
});

test('spans resolve and every cue anchor lands on its own line, in order', () => {
  const words = markOpenerBreaks(script(SHAPE)).words;
  const r = planCoupon(words, { video: 'v' });
  const shots = resolveShots(r.shots, words);
  assert.deepEqual(shots.errors, []);
  assert.equal(shots.spans.length, 2);
  const W = words.map((x) => ({ ...x, n: normWord(x.text) })).filter((x) => x.n);
  let cursor = 0;
  let last = -1;
  for (const c of r.cues.cues) {
    const a = findPhrase(W, c.anchor, cursor);
    assert.ok(!a.err, `${c.id}: ${a.err}`);
    cursor = a.idx + a.len;
    const start = a.start - c.lead;
    assert.ok(start > last, `${c.id} starts after the previous card`);
    last = start;
  }
});

test('no card sits on an avatar cut', () => {
  const words = markOpenerBreaks(script(SHAPE)).words;
  const r = planCoupon(words, { video: 'v' });
  const { s01, s02 } = r.timeline;
  const W = words.map((x) => ({ ...x, n: normWord(x.text) })).filter((x) => x.n);
  let cursor = 0;
  for (const c of r.cues.cues) {
    const a = findPhrase(W, c.anchor, cursor);
    cursor = a.idx + a.len;
    const s = a.start - c.lead, e = s + c.hold;
    for (const b of [s01.start, s01.end, s02.start]) assert.ok(e <= b - 0.5 || s >= b + 0.5, `${c.id} ${s}-${e} crosses ${b}`);
  }
});

test('a recording without the script shape is refused with a reason', () => {
  const r = planCoupon(script(['This is a normal tutorial about something.', 'Nothing else to see here.']), { video: 'v' });
  assert.ok(r.errors.some((e) => /intro opener/.test(e)));
});

test('the run-on outro gets a sentence break before "and that\'s it"', () => {
  const { words, marks } = markOpenerBreaks(script(['Copy it here and that\'s it you are done.']));
  assert.equal(marks, 1);
  assert.equal(words.find((w) => w.text === 'here.')?.text, 'here.');
  assert.equal(words.find((w) => w.text === 'And')?.text, 'And');
});

test('findCode picks the most repeated ALL-CAPS code', () => {
  assert.equal(findCode(script(['Use AGR25 now.', 'Enter AGR25.', 'Not SAVE10.'])), 'AGR25');
  assert.equal(findCode(script(['no code here.'])), null);
});

test('uniqueAnchor grows past a repeated phrase', () => {
  const W = script(['in the description. more words.', 'check in the description today.'])
    .map((x) => ({ ...x, n: normWord(x.text) }));
  const a = uniqueAnchor(W, W.findLastIndex((w) => w.n === 'description'), 0, true);
  assert.equal(findPhrase(W, a.text, 0).idx, a.s);
  assert.ok(a.len > 3);
});

test('brand fix merges split and misspelt tool names, leaves real words alone', () => {
  const w = script(['my EverBe code, the ever beep code, every day, EverBee works.']);
  const { words, fixes } = fixBrand(w, 'EverBee');
  const text = words.map((x) => x.text).join(' ');
  assert.equal(fixes, 2);
  assert.match(text, /my EverBee code, the EverBee code, every day, EverBee works\./);
  assert.equal(toolFromSlug('everbee-promo-code'), 'Everbee');
});
