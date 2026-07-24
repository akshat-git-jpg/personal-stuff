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
