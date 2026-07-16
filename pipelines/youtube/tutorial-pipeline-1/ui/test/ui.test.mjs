import test from "node:test";
import assert from "node:assert";
import { parseFolderId, parseTitleType, decideRunMode } from "../serve.mjs";

test("parseFolderId", () => {
  assert.strictEqual(parseFolderId("https://drive.google.com/drive/folders/123_abc-456"), "123_abc-456");
  assert.strictEqual(parseFolderId("/folders/123"), "123");
  assert.strictEqual(parseFolderId("https://drive.google.com/file/d/123/view"), null);
  assert.strictEqual(parseFolderId("garbage"), null);
  assert.strictEqual(parseFolderId(null), null);
  assert.strictEqual(parseFolderId(undefined), null);
});

test("parseTitleType", () => {
  assert.deepStrictEqual(parseTitleType("My Tutorial @ g1"), {
    title: "My Tutorial",
    type: "g1",
    avatar: "girl-1"
  });
  assert.deepStrictEqual(parseTitleType("X @ G2"), {
    title: "X",
    type: "g2",
    avatar: "girl-2"
  });
  assert.deepStrictEqual(parseTitleType("No Suffix"), null);
  assert.deepStrictEqual(parseTitleType("Weird @ g3"), null);
  // Assert the title has no trailing space
  assert.deepStrictEqual(parseTitleType("Trailing Spaces    @ g1"), {
    title: "Trailing Spaces",
    type: "g1",
    avatar: "girl-1"
  });
});

test("decideRunMode", () => {
  const folderId = "abc";
  
  // no 030 manifest -> FRESH
  assert.strictEqual(
    decideRunMode({ folderId, s010Manifest: { folder_id: folderId }, s030ManifestExists: false }),
    "FRESH"
  );
  
  // 030 but no 010 manifest -> FRESH
  assert.strictEqual(
    decideRunMode({ folderId, s010Manifest: null, s030ManifestExists: true }),
    "FRESH"
  );
  
  // both, mismatched folder_id -> FRESH
  assert.strictEqual(
    decideRunMode({ folderId, s010Manifest: { folder_id: "xyz" }, s030ManifestExists: true }),
    "FRESH"
  );
  
  // both, matching folder_id -> RESUME
  assert.strictEqual(
    decideRunMode({ folderId, s010Manifest: { folder_id: folderId }, s030ManifestExists: true }),
    "RESUME"
  );
});
