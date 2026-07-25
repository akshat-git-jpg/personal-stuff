import { test } from 'node:test';
import assert from 'node:assert';
import { auditGate } from './audit-gate.mjs';

test('audit-gate: labelled fullframe blocks unless accepted', () => {
  const resolved = {
    cues: [
      { id: 'c01', placement: 'fullframe' },
      { id: 'c02', placement: 'fullframe' },
      { id: 'c03', placement: 'fullframe' },
    ]
  };

  const audit = {
    items: [
      { id: 'c01', verdict: 'labelled' },
      { id: 'c02', verdict: 'labelled', accepted: true },
      { id: 'c03', verdict: 'enacted' },
    ]
  };

  const { errors, warnings } = auditGate({ audit, resolved });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /c01: labelled fullframe/);
  assert.equal(warnings.length, 0);
});

test('audit-gate: labelled overlay warns only', () => {
  const resolved = {
    cues: [
      { id: 'c01', placement: 'overlay' },
    ]
  };
  const audit = {
    items: [
      { id: 'c01', verdict: 'labelled' },
    ]
  };

  const { errors, warnings } = auditGate({ audit, resolved });
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /c01: labelled overlay/);
});

test('audit-gate: missing audit errors', () => {
  const { errors } = auditGate({ audit: null, resolved: {} });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /run the 035 audit first/);
});

// Regression: the gate read `resolved.cues`, but resolve.mjs writes the array
// under `resolved`. Every lookup missed, so the gate passed anything.
test('audit gate reads the real resolved.json shape and still blocks', () => {
  const resolved = { video: 't', offset: 0, resolved: [{ id: 'c02', placement: 'fullframe' }] };
  const audit = { items: [{ id: 'c02', verdict: 'labelled' }] };
  const { errors } = auditGate({ audit, resolved });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /labelled fullframe/);
});

test('audit gate: accepted:true clears the block, overlays only warn', () => {
  const resolved = { video: 't', offset: 0, resolved: [
    { id: 'c02', placement: 'fullframe' },
    { id: 'c04', placement: 'overlay' },
  ] };
  const audit = { items: [
    { id: 'c02', verdict: 'labelled', accepted: true },
    { id: 'c04', verdict: 'labelled' },
  ] };
  const { errors, warnings } = auditGate({ audit, resolved });
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 1);
});

test('audit gate errors when resolved.json carries no cue array', () => {
  const { errors } = auditGate({ audit: { items: [] }, resolved: { video: 't' } });
  assert.match(errors.join(' '), /no cue array/);
});
