import test from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";
import { renderScriptMd } from "./render-script-md.mjs";

test("renderScriptMd - pure function", () => {
  const script = {
    video: "notion-vs-asana",
    version: 1,
    stage: "generated",
    sections: [
      {
        id: "s01",
        demo: false,
        display_text: "Notion and Asana both promise to run your whole team...",
        notes: "",
        flags: []
      },
      {
        id: "s02",
        demo: true,
        display_text: "Head to the pricing page and click [VERIFY: exact upgrade button label].",
        notes: "stay on the pricing page until the section ends",
        flags: [ { kind: "VERIFY", note: "exact upgrade button label" } ]
      }
    ]
  };

  const md = renderScriptMd(script);
  const expected = `# notion-vs-asana — script v1  (stage: generated)

## s01 [no demo]

Notion and Asana both promise to run your whole team...

## s02 [demo]

Head to the pricing page and click [VERIFY: exact upgrade button label].

> notes: stay on the pricing page until the section ends
> FLAG (VERIFY): exact upgrade button label
`;
  assert.equal(md, expected);
});

test("renderScriptMd - CLI", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "render-md-"));
  const slug = "test-video";
  const videoDir = path.join(tmpDir, "videos", slug);
  fs.mkdirSync(videoDir, { recursive: true });

  const script = {
    video: slug,
    version: 2,
    stage: "verified",
    sections: [
      {
        id: "s01",
        demo: false,
        display_text: "Hello",
        notes: "",
        flags: []
      }
    ]
  };
  fs.writeFileSync(path.join(videoDir, "script.json"), JSON.stringify(script));

  execFileSync(process.execPath, [
    "lib/render-script-md.mjs",
    slug,
    "--root",
    tmpDir
  ]);

  const md = fs.readFileSync(path.join(videoDir, "script.md"), "utf8");
  assert.match(md, /# test-video — script v2  \(stage: verified\)/);
  assert.match(md, /## s01 \[no demo\]/);
  assert.match(md, /Hello/);
});
