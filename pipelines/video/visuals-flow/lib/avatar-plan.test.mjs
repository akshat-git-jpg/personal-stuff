import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildAvatarPlan, mergeAvatarPlan, requireAvatarPlanApproved, avatarPlanPath } from './avatar-plan.mjs';

function tmpWorkdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-plan-test-'));
}

const REGISTRY = {
  'girl-1': { template_id: 'abc123', description: 'Girl template' },
  'specs-man': { template_id: 'def456', image: 'characters/specs-man/source.jpeg', description: 'Man with specs' },
  'side-avatar': { image: 'characters/side-avatar/source.jpeg', description: 'Side-view woman' },
};

const SHOTS_RESOLVED = {
  video: 'test-01',
  spans: [
    { id: 'z01', purpose: 'avatar-full', mode: 'full', start: 0, end: 5, duration: 5 },
    { id: 'z02', purpose: 'avatar-full', mode: 'full', start: 10, end: 22.5, duration: 12.5 },
  ],
};

test('buildAvatarPlan derives clips/seconds from shots.resolved.json spans, not an estimate', () => {
  const plan = buildAvatarPlan({ workdir: '/tmp/x', shotsResolved: SHOTS_RESOLVED, registry: REGISTRY });
  assert.equal(plan.clips, 2);
  assert.equal(plan.seconds, 17.5);
  assert.equal(plan.video, 'test-01');
  assert.equal(plan.character, null);
  assert.equal(plan.model, null);
  assert.equal(plan.approved, false);
  assert.deepEqual(plan.models, ['heygen3', 'heygen4']);
});

test('buildAvatarPlan lists every registry entry as a candidate with its capabilities', () => {
  const plan = buildAvatarPlan({ workdir: '/tmp/x', shotsResolved: SHOTS_RESOLVED, registry: REGISTRY });
  const byId = Object.fromEntries(plan.candidates.map((c) => [c.id, c]));
  assert.equal(byId['girl-1'].hasTemplate, true);
  assert.equal(byId['girl-1'].hasImage, false);
  assert.equal(byId['specs-man'].hasTemplate, true);
  assert.equal(byId['specs-man'].hasImage, true);
  assert.equal(byId['side-avatar'].hasTemplate, false);
  assert.equal(byId['side-avatar'].hasImage, true);
});

test('buildAvatarPlan handles a video with no avatar spans at all', () => {
  const plan = buildAvatarPlan({ workdir: '/tmp/x', shotsResolved: { video: 'x', spans: [] }, registry: REGISTRY });
  assert.equal(plan.clips, 0);
  assert.equal(plan.seconds, 0);
});

test('mergeAvatarPlan keeps character/model/approved from the existing file, clips/seconds from the fresh one', () => {
  const existing = { character: 'specs-man', model: 'heygen4', approved: true, clips: 1, seconds: 5 };
  const fresh = buildAvatarPlan({ workdir: '/tmp/x', shotsResolved: SHOTS_RESOLVED, registry: REGISTRY });
  const merged = mergeAvatarPlan(existing, fresh);
  assert.equal(merged.character, 'specs-man');
  assert.equal(merged.model, 'heygen4');
  assert.equal(merged.approved, true);
  assert.equal(merged.clips, 2); // re-authored shots: reflects the CURRENT count
  assert.equal(merged.seconds, 17.5);
});

test('mergeAvatarPlan with no existing file just returns the fresh plan', () => {
  const fresh = buildAvatarPlan({ workdir: '/tmp/x', shotsResolved: SHOTS_RESOLVED, registry: REGISTRY });
  assert.equal(mergeAvatarPlan(null, fresh), fresh);
});

test('requireAvatarPlanApproved throws UNAPPROVED-AVATAR-SPEND when the file is absent', () => {
  const w = tmpWorkdir();
  assert.throws(() => requireAvatarPlanApproved(w), /UNAPPROVED-AVATAR-SPEND/);
});

test('requireAvatarPlanApproved throws UNAPPROVED-AVATAR-SPEND when approved is false', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(avatarPlanPath(w), JSON.stringify({ character: 'girl-1', model: 'heygen3', approved: false }));
  assert.throws(() => requireAvatarPlanApproved(w), /UNAPPROVED-AVATAR-SPEND/);
});

test('requireAvatarPlanApproved throws UNAPPROVED-AVATAR-SPEND when character is null', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(avatarPlanPath(w), JSON.stringify({ character: null, model: 'heygen3', approved: true }));
  assert.throws(() => requireAvatarPlanApproved(w), /UNAPPROVED-AVATAR-SPEND/);
});

test('requireAvatarPlanApproved throws UNAPPROVED-AVATAR-SPEND when model is null', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(avatarPlanPath(w), JSON.stringify({ character: 'girl-1', model: null, approved: true }));
  assert.throws(() => requireAvatarPlanApproved(w), /UNAPPROVED-AVATAR-SPEND/);
});

test('requireAvatarPlanApproved passes and returns the plan when character, model and approved are all set', () => {
  const w = tmpWorkdir();
  fs.writeFileSync(avatarPlanPath(w), JSON.stringify({ character: 'girl-1', model: 'heygen3', approved: true }));
  const plan = requireAvatarPlanApproved(w);
  assert.equal(plan.character, 'girl-1');
  assert.equal(plan.model, 'heygen3');
  assert.equal(plan.approved, true);
});
