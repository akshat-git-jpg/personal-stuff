import test from "node:test";
import assert from "node:assert";
import { mergeState } from "./pull-ui.mjs";

test("mergeState", () => {
  const script = {
    sections: [
      { id: "s01", spoken_text: "old", tts: { regens_used: 0, locked: false, take: null } }
    ]
  };
  const state = {
    sections: [
      { id: "s01", spoken_text: "new", takes_used: 3, locked: 1, take_key: "key1" }
    ]
  };
  const merged = mergeState(script, state);
  assert.strictEqual(merged.sections[0].spoken_text, "new");
  assert.strictEqual(merged.sections[0].tts.regens_used, 2);
  assert.strictEqual(merged.sections[0].tts.locked, true);
  assert.strictEqual(merged.sections[0].tts.take, "key1");
});
