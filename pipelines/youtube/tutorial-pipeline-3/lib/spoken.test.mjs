import test from "node:test";
import assert from "node:assert";
import { deriveSpoken } from "./spoken.mjs";

test("deriveSpoken - throws on flagged input", () => {
  assert.throws(() => deriveSpoken("Click [VERIFY: foo]"), /flag markers/);
});

test("deriveSpoken - empty map", () => {
  assert.equal(deriveSpoken("Hello world", {}), "Hello world");
  assert.equal(deriveSpoken("Hello world"), "Hello world");
});

test("deriveSpoken - basic replace", () => {
  assert.equal(deriveSpoken("I love Notion", { "Notion": "No shun" }), "I love No shun");
});

test("deriveSpoken - longer-key precedence", () => {
  const map = {
    "IndexTTS": "Index TTS",
    "IndexTTS-2": "Index TTS two"
  };
  assert.equal(deriveSpoken("I use IndexTTS-2 and IndexTTS.", map), "I use Index TTS two and Index TTS.");
});

test("deriveSpoken - no partial word replacement", () => {
  assert.equal(deriveSpoken("Notional concept", { "Notion": "No shun" }), "Notional concept");
});
