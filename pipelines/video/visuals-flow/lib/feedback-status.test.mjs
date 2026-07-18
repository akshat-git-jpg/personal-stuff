import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { runFeedbackStatus } from './feedback-status.mjs';

const TMP_ROOT = path.join(import.meta.dirname, '.test-tmp', 'feedback-status');

function setupWorkdir(slug, files) {
  const wd = path.join(TMP_ROOT, slug);
  fs.mkdirSync(wd, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(wd, name), typeof content === 'string' ? content : JSON.stringify(content));
  }
  return wd;
}

test.before(() => {
  if (fs.existsSync(TMP_ROOT)) {
    fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  }
});

test('feedback-status: all folded/applied -> exit 0', () => {
  const wd = setupWorkdir('video-all-ok', {
    'cues.json': '{}',
    'cues.llm.json': '{}',
    'feedback.json': {
      items: {
        'c01': { text: 'ok', applied: 'yes' },
        'c02': { text: 'ok', folded: 'yes' }
      }
    }
  });

  // Capture stdout/stderr
  const origLog = console.log;
  const origError = console.error;
  let logData = '';
  let errData = '';
  console.log = (s) => logData += s + '\n';
  console.error = (s) => errData += s + '\n';

  try {
    const code = runFeedbackStatus([wd]);
    assert.equal(code, 0);
    assert.equal(errData, ''); // no missing cues.llm.json warning
    assert.equal(logData.trim(), '');
  } finally {
    console.log = origLog;
    console.error = origError;
  }
});

test('feedback-status: pending item -> exit 1 and logs item', () => {
  const wd = setupWorkdir('video-pending', {
    'cues.json': '{}',
    'cues.llm.json': '{}',
    'feedback.json': {
      items: {
        'c01': { text: 'needs fix', added: new Date().toISOString() }
      }
    }
  });

  const origLog = console.log;
  let logData = '';
  console.log = (s) => logData += s + '\n';

  try {
    const code = runFeedbackStatus([wd]);
    assert.equal(code, 1);
    assert.match(logData, /c01/);
    assert.match(logData, /needs fix/);
  } finally {
    console.log = origLog;
  }
});

test('feedback-status: missing cues.llm.json -> stderr warning, exit unaffected', () => {
  const wd = setupWorkdir('video-missing-llm', {
    'cues.json': '{}',
    'feedback.json': {
      items: {
        'c01': { text: 'ok', applied: 'yes' }
      }
    }
  });

  const origLog = console.log;
  const origError = console.error;
  let errData = '';
  console.log = () => {};
  console.error = (s) => errData += s + '\n';

  try {
    const code = runFeedbackStatus([wd]);
    assert.equal(code, 0); // Still 0 because no pending items
    assert.match(errData, /warning:.*has cues.json but no cues.llm.json/i); // Actual output is 'warning: <wd> has cues.json but no cues.llm.json'
  } finally {
    console.log = origLog;
    console.error = origError;
  }
});
