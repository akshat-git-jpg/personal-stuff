import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { captionsApply, captionSegKey, maskCaptionWords, COUPON_CODE_RE } from './assemble.mjs';
import { bubbleGeometry, avatarFocus } from './effects/bubble.mjs';
import { contribute as captionContribute } from './effects/captions.mjs';
import { loadRunConfig, isCouponTemplate } from './run-config.mjs';

test('caption scope: screen keeps today\'s behaviour, all adds avatar and graphic', () => {
  assert.equal(captionsApply({ kind: 'avatar' }), false);
  assert.equal(captionsApply({ kind: 'screen' }), true);
  assert.equal(captionsApply({ kind: 'avatar' }, 'all'), true);
  assert.equal(captionsApply({ kind: 'graphic' }, 'all'), true);
  assert.equal(captionsApply({ kind: 'film' }, 'all'), false);
});

test('beat subs get distinct caption files', () => {
  assert.equal(captionSegKey({ id: 's01' }), 's01');
  assert.notEqual(captionSegKey({ id: 's01', sub: 0 }), captionSegKey({ id: 's01', sub: 1 }));
});

test('caption module reads the sub-aware file on avatar segments only in scope all', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-'));
  fs.writeFileSync(path.join(dir, 'seg-s01.1.ass'), 'x');
  const ctx = { capDir: dir, capChunks: [{}], captionScope: 'all' };
  const seg = { kind: 'avatar', id: 's01', sub: 1 };
  assert.match(captionContribute(seg, [{}], ctx).vfSuffix, /seg-s01\.1\.ass/);
  assert.equal(captionContribute(seg, [{}], { ...ctx, captionScope: 'screen' }), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('bubble corner: bottom-right sits on the bottom inset, default stays top-right', () => {
  const top = bubbleGeometry(1920, 1080);
  const bottom = bubbleGeometry(1920, 1080, { corner: 'bottom-right' });
  assert.equal(top.OY, top.INSET);
  assert.equal(bottom.OY, 1080 - bottom.INSET - bottom.D);
  assert.equal(bottom.OX, top.OX);
});

test('bubble focus per template, specs-man default for unknown', () => {
  assert.deepEqual(avatarFocus('girl-1'), { x: 0.5, y: 0.37 });
  assert.equal(bubbleGeometry(1920, 1080, { zoom: avatarFocus('helen-office').zoom }).DZ,
    Math.round(bubbleGeometry(1920, 1080).D * 1.4 / 2) * 2);
  assert.deepEqual(avatarFocus('nobody'), avatarFocus('specs-man'));
});

test('run-config template: coupon accepted, typo refused', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-'));
  assert.equal(isCouponTemplate(dir), false);
  fs.writeFileSync(path.join(dir, 'run-config.json'), JSON.stringify({ template: 'coupon' }));
  assert.equal(isCouponTemplate(dir), true);
  fs.writeFileSync(path.join(dir, 'run-config.json'), JSON.stringify({ template: 'cupon' }));
  assert.throws(() => loadRunConfig(dir), /template "cupon"/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('bubble from: no bubble before it, and the clip stays in sync after it', async () => {
  const { contribute } = await import('./effects/bubble.mjs');
  const ctx = (from) => ({ w: 1920, h: 1080, cornerJobs: [{ start: 0, end: 300, file: 'c.mp4' }], bubbleOpts: { from } });
  assert.equal(contribute({ kind: 'screen', start: 0, end: 15 }, [{}], ctx(20)), null);
  const r = contribute({ kind: 'screen', start: 10, end: 60 }, [{}], ctx(20));
  const ss = r.inputs[r.inputs.indexOf('-ss') + 1];
  assert.equal(Number(ss), 20, 'slice starts at t=20 of the source clip');
});

test('coupon captions never show a code', () => {
  const w = [{ text: 'enter' }, { text: 'AGR25.' }, { text: 'Growth' }, { text: '$29.25,' }, { text: 'SAVE10' }];
  assert.deepEqual(maskCaptionWords(w, COUPON_CODE_RE).map((x) => x.text), ['enter', 'the code.', 'Growth', '$29.25,', 'the code']);
  assert.equal(maskCaptionWords(w, null), w);
});
