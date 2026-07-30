import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import assert from 'node:assert';
import { probeCardVariant, fillToCapacity, probeTimes, closeBrowser } from './overflow-probe.mjs';

// probeCardVariant caches a headless browser at module scope. Without this the
// suite prints every ok and then hangs forever on the open handle — which is
// indistinguishable from a passing run that never exits, and is exactly what
// blocked this plan's test_cmd (2026-07-30).
after(closeBrowser);

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

// The suite used to print all four oks and then hang forever: probeCardVariant
// caches a headless browser at module scope and only main() closed it, so a test
// file that imports the function directly leaked the handle. That looks identical
// to a passing run to any caller reading stdout, and it is what made this plan's
// test_cmd unpassable (boss dispatch 3, 2026-07-30). Guard the contract itself.
test('closeBrowser is exported and idempotent', async () => {
  assert.equal(typeof closeBrowser, 'function', 'importers need a way to release the browser');
  await closeBrowser();
  await closeBrowser(); // twice, and with nothing open, must not throw
});
