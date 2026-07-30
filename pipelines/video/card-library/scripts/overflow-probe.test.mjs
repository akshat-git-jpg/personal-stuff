import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert';
import { probeCardVariant, fillToCapacity, probeTimes } from './overflow-probe.mjs';

// The gate is worthless unless it can fail. This fixture is the real defect:
// enacted/pipeline-flow, title "Submagic: Straight To Posted", variant "b".
// It clipped both the title's top line and the final node off the canvas
// (c17, opusclip-vs-submagic, 2026-07-30). If this test ever goes green with
// the probe reporting "ok", the probe has stopped working — not the card.
test('the probe reports overflow on the known-bad c17 input', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovf-'));
  fs.cpSync('enacted/pipeline-flow', path.join(dir, 'pipeline-flow'), { recursive: true });
  const res = await probeCardVariant(path.join(dir, 'pipeline-flow'), 'b', {
    title: 'Submagic: Straight To Posted',
    variant: 'b',
    register: 'light',
    steps: [
      { step: 'Auto Edit', icon: 'bolt' },
      { step: 'Publish Ready', icon: 'star' },
      { step: 'Posted', icon: 'rocket' },
    ],
    beats: [
      { step: 'Auto Edit', at: 0.6 },
      { step: 'Publish Ready', at: 2.44 },
      { step: 'Posted', at: 4.2 },
    ],
  }, [1.2, 3.0]);
  assert.equal(res.broken, true, 'the probe must reject the input that actually shipped clipped');
  assert.ok(res.offenders.length > 0);
});

test('the probe passes the same card with a title that fits', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovf-'));
  fs.cpSync('enacted/pipeline-flow', path.join(dir, 'pipeline-flow'), { recursive: true });
  const res = await probeCardVariant(path.join(dir, 'pipeline-flow'), 'b', {
    title: 'Straight To Posted',
    variant: 'b',
    register: 'light',
    steps: [
      { step: 'Auto Edit', icon: 'bolt' },
      { step: 'Publish Ready', icon: 'star' },
      { step: 'Posted', icon: 'rocket' },
    ],
    beats: [
      { step: 'Auto Edit', at: 0.6 },
      { step: 'Publish Ready', at: 2.44 },
      { step: 'Posted', at: 4.2 },
    ],
  }, [1.2, 3.0]);
  assert.equal(res.broken, false);
});

test('fillToCapacity respects max_words / max_chars', () => {
  const card = {
    variables: {
      heading: { type: 'string', role: 'heading', max_words: 3 },
      sub: { type: 'string', role: 'label', max_chars: 10 }
    }
  };
  const filled = fillToCapacity(card, 'a');
  assert.equal(filled.heading.split(' ').length, 3);
  assert.equal(filled.sub.length, 10);
});

test('probeTimes includes every beat at', () => {
  const card = { max_beats: 2, beat_shape: { label: { type: 'string' } } };
  const vars = { beats: [{at: 1}, {at: 2.5}] };
  const times = probeTimes(card, vars);
  assert.ok(times.includes(1));
  assert.ok(times.includes(2.5));
});
