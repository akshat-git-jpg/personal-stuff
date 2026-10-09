import test from "node:test";
import assert from "node:assert/strict";
import { assertDraftAvatarIII, draftEngineReport } from "../src/operations/render.mjs";

const draft = (content) => ({ visual: { elements: { bg: { content: { src: "x" } }, av: { content } } } });

test("Avatar III template passes", () => {
  const els = assertDraftAvatarIII(draft({ engine: "avatar_iii", use_avatar_iv_model: false, use_unlimited_mode: true }));
  assert.equal(els.length, 1);
  assert.equal(els[0].id, "av");
});

test("Avatar IV template is refused on the heygen3 path", () => {
  assert.throws(() => assertDraftAvatarIII(draft({ engine: "avatar_iv", use_avatar_iv_model: true, use_unlimited_mode: false })),
    /TEMPLATE-NOT-AVATAR-III/);
});

test("Avatar III with unlimited mode off is refused (metered III)", () => {
  assert.throws(() => assertDraftAvatarIII(draft({ engine: "avatar_iii", use_avatar_iv_model: false, use_unlimited_mode: false })),
    /TEMPLATE-NOT-AVATAR-III/);
});

test("a draft with no engine field is refused, not assumed free", () => {
  assert.throws(() => assertDraftAvatarIII({ visual: { elements: { bg: { content: { src: "x" } } } } }), /TEMPLATE-ENGINE-UNKNOWN/);
  assert.deepEqual(draftEngineReport({}), []);
});

test("patchAvatarIV flips the generate-from-audio payloads to Avatar IV", async () => {
  const { patchAvatarIV } = await import("../src/operations/render.mjs");
  const { fillTemplate } = await import("../src/client/payloads/fill.mjs");
  for (const name of ["generate-audio-save.json", "generate-audio-generate.json"]) {
    const body = fillTemplate(name, { __WIDTH__: 1920, __HEIGHT__: 1080, __SCALE__: 1 });
    assert.equal(patchAvatarIV(body), 1, name);
    const s = JSON.stringify(body);
    assert.ok(!s.includes('"avatar_iii"'), name);
    assert.ok(s.includes('"use_avatar_iv_model":true') && s.includes('"use_unlimited_mode":false'), name);
  }
});

test("modelTitle adds the model once", async () => {
  const { modelTitle } = await import("../src/operations/render.mjs");
  assert.equal(modelTitle("intro", false), "intro - Avatar III");
  assert.equal(modelTitle("intro", true), "intro - Avatar IV");
  assert.equal(modelTitle("intro - Avatar IV", true), "intro - Avatar IV");
});
