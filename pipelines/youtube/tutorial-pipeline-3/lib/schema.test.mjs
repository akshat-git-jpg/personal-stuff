import test from 'node:test';
import assert from 'node:assert';
import { validateScript } from './schema.mjs';

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

test('validateScript - valid', () => {
  const result = validateScript(makeValidScript());
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));
});

test('validateScript - non-sequential ids', () => {
  const script = makeValidScript();
  script.sections[1].id = "s03";
  const result = validateScript(script);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors[0], /non-sequential id/);
});

test('validateScript - zero demo sections', () => {
  const script = makeValidScript();
  script.sections[1].demo = false;
  script.sections[1].recording.status = 'none';
  const result = validateScript(script);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors[0], /demo: true/);
});

test('validateScript - inline marker with no flags[] entry', () => {
  const script = makeValidScript();
  script.sections[2].display_text = "This is a [VERIFY: marker] with no flag and it needs at least eight words to pass.";
  const result = validateScript(script);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors.join('|'), /inline marker VERIFY:marker has no flags\[\] entry/);
});

test('validateScript - flags[] entry with no inline marker', () => {
  const script = makeValidScript();
  script.sections[2].flags.push({ kind: "VERIFY", note: "missing" });
  const result = validateScript(script);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors[0], /flags\[\] entry VERIFY:missing has no inline marker/);
});

test('validateScript - demo section with recording.status: "none"', () => {
  const script = makeValidScript();
  script.sections[1].recording.status = "none";
  const result = validateScript(script);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors[0], /demo section has recording.status "none"/);
});

test('validateScript - 5-word display_text', () => {
  const script = makeValidScript();
  script.sections[0].display_text = "This is too short yeah.";
  const result = validateScript(script);
  assert.strictEqual(result.ok, false);
  assert.match(result.errors[0], /word count is 5, must be between 8 and 320/);
});

test('validateScript - polished stage rules', () => {
  const script = makeValidScript();
  script.stage = "polished";
  script.sections[0].spoken_text = "Notion and Asana both promise to run your whole team which is a huge claim to make.";
  script.sections[1].spoken_text = "Head to the pricing page and click the exact upgrade button. We will verify it.";
  script.sections[1].display_text = "Head to the pricing page and click the exact upgrade button. We will verify it.";
  script.sections[1].flags = [];
  script.sections[2].spoken_text = "This is a conclusion for the whole demonstration and it makes sense to wrap it up.";
  const result = validateScript(script, { stage: 'polished' });
  assert.strictEqual(result.ok, true, JSON.stringify(result.errors));

  // leftover flag
  script.sections[1].flags = [ { kind: "VERIFY", note: "leftover" } ];
  script.sections[1].display_text = "Head to the pricing page and click [VERIFY: leftover]. We will verify it.";
  const result2 = validateScript(script, { stage: 'polished' });
  assert.strictEqual(result2.ok, false);
  assert.match(result2.errors[0], /polished stage forbids flags/);

  // empty spoken_text
  script.sections[1].flags = [];
  script.sections[1].display_text = "Head to the pricing page and click the exact upgrade button. We will verify it.";
  script.sections[1].spoken_text = "";
  const result3 = validateScript(script, { stage: 'polished' });
  assert.strictEqual(result3.ok, false);
  assert.match(result3.errors[0], /polished stage requires non-empty spoken_text/);
});
