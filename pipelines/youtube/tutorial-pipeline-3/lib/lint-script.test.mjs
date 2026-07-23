import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lintScriptPath = path.join(__dirname, 'lint-script.mjs');

function makeValidScript() {
  return {
    "video": "notion-vs-asana",
    "channel": "agrollo-reviews",
    "version": 1,
    "stage": "generated",
    "sections": [
      {
        "id": "s01",
        "demo": false,
        "display_text": "Notion and Asana both promise to run your whole team which is a huge claim to make.",
        "spoken_text": "",
        "flags": [],
        "notes": "",
        "version": 1,
        "tts": { "regens_used": 0, "locked": false, "take": null },
        "recording": { "status": "none" }
      },
      {
        "id": "s02",
        "demo": true,
        "display_text": "Head to the pricing page and click [VERIFY: exact upgrade button label]. We will verify it.",
        "spoken_text": "",
        "flags": [ { "kind": "VERIFY", "note": "exact upgrade button label" } ],
        "notes": "stay on the pricing page until the section ends",
        "version": 1,
        "tts": { "regens_used": 0, "locked": false, "take": null },
        "recording": { "status": "pending" }
      },
      {
        "id": "s03",
        "demo": false,
        "display_text": "This is a conclusion for the whole demonstration and it makes sense to wrap it up.",
        "spoken_text": "",
        "flags": [],
        "notes": "",
        "version": 1,
        "tts": { "regens_used": 0, "locked": false, "take": null },
        "recording": { "status": "none" }
      }
    ]
  };
}

test('lint-script CLI', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tp3-"));
  const validPath = path.join(tmpDir, 'valid.json');
  fs.writeFileSync(validPath, JSON.stringify(makeValidScript()));

  const invalidScript = makeValidScript();
  invalidScript.sections[1].demo = false;
  invalidScript.sections[1].recording.status = 'none';
  const invalidPath = path.join(tmpDir, 'invalid.json');
  fs.writeFileSync(invalidPath, JSON.stringify(invalidScript));

  try {
    execFileSync('node', [lintScriptPath, validPath]);
  } catch (err) {
    assert.fail('Should exit 0 for valid script');
  }

  try {
    execFileSync('node', [lintScriptPath, invalidPath]);
    assert.fail('Should exit 1 for invalid script');
  } catch (err) {
    assert.strictEqual(err.status, 1);
    assert.match(err.stderr.toString(), /ERROR: .*demo: true/);
  }

  fs.rmSync(tmpDir, { recursive: true });
});
