import test from "node:test";
import assert from "node:assert";
import { publishScript } from "./publish-ui.mjs";

test("publishScript success", async () => {
  const script = { stage: "tts", sections: [] };
  const mockFetch = async (url, opts) => {
    return { ok: true, json: async () => ({ link: "http://vo.test" }) };
  };
  const res = await publishScript(script, { slug: "test-slug" }, mockFetch);
  assert.strictEqual(res.link, "http://vo.test");
});

test("publishScript rejects non-tts stage", async () => {
  await assert.rejects(
    publishScript({ stage: "polished" }, {}, () => {}),
    /stage must be tts/
  );
});
