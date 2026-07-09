import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "..");

test("1. Imports: modules can be imported without throwing", async () => {
  const toImport = [
    "src/cli/dispatch.mjs",
    "src/operations/account.mjs",
    "src/operations/audio.mjs",
    "src/operations/auth.mjs",
    "src/operations/avatars.mjs",
    "src/operations/render.mjs",
    "src/operations/videos.mjs",
    "src/operations/voices.mjs",
    "src/workflows/batch.mjs",
    "src/workflows/generate.mjs",
    "src/workflows/photo-to-video.mjs",
    "src/workflows/raw.mjs",
    "src/client/endpoints.mjs",
    "src/client/http.mjs",
    "src/client/registry.mjs"
  ];
  for (const path of toImport) {
    await import(resolve(PKG_ROOT, path));
  }
  assert.ok(true, "All modules imported successfully");
});

test("2. Registry completeness: 25 named keys, valid paths", async () => {
  const { endpoints } = await import(resolve(PKG_ROOT, "src/client/endpoints.mjs"));
  
  const expectedKeys = [
    "avatarGroupPrivateList", "avatarLookList", "photoTempCreate", "imageAttributesSubmit",
    "photoTempConvert", "textDraftCreate", "textDraftSave", "textDraftGenerate",
    "sceneAvatarPreview", "sceneAvatarPreviewCheck", "heygenTemplateGet", "voiceList",
    "projectItems", "projectItemsStatus", "projectItemTrash", "avatarShortcutSubmit",
    "fileUrlGet", "fileUpload", "fastAsr", "videoGenerateLimits", "monthlyPriorityCount",
    "aiGenerateElementLimits", "migrateToCreditCheck", "videoDownload", "videoDownloadStatus"
  ];

  const actualKeys = Object.keys(endpoints);
  assert.strictEqual(actualKeys.length, 25, "Expected 25 endpoints, got " + actualKeys.length);
  
  for (const key of expectedKeys) {
    assert.ok(actualKeys.includes(key), "Missing endpoint: " + key);
    const ep = endpoints[key];
    assert.ok(ep.method, key + " missing method");
    const pathStr = ep.path({ limit: 10, page: 1, group_id: "g", tid: "t", name: "n", job_id: "j", vid: "v", id: "i", type: "t", base: "b", ct: "c", wf: "w" });
    assert.ok(pathStr.startsWith("/"), key + " path must start with /");
  }
});

test("3. Command parity: dispatch table keys", () => {
  const expectedCommands = new Set([
    "auth-check", "list-avatars", "list-looks", "limits", "usage", "generate",
    "generate-from-audio", "generate-from-template", "batch", "create-photo-avatar",
    "photo-to-video", "studio-render", "studio-render-status", "list-voices",
    "list-videos", "status", "delete-video", "raw", "download"
  ]);
  
  const dispatchCode = fs.readFileSync(resolve(PKG_ROOT, "src/cli/dispatch.mjs"), "utf8");
  const matches = [...dispatchCode.matchAll(/case "([^"]+)":/g)];
  const actualCommands = new Set(matches.map(m => m[1]));
  
  assert.strictEqual(actualCommands.size, expectedCommands.size, "Command count mismatch");
  for (const cmd of expectedCommands) {
    assert.ok(actualCommands.has(cmd), "Missing command in dispatch: " + cmd);
  }
});

test("4. Payload fill: valid JSON without __ tokens", async () => {
  const { fillTemplate } = await import(resolve(PKG_ROOT, "src/client/payloads/fill.mjs"));
  
  const save = fillTemplate("save.json", { __VIDEO_ID__: "v", __AVATAR_ID__: "a" });
  assert.ok(typeof save === "object");
  assert.ok(!/__[A-Z_]+__/.test(JSON.stringify(save)), "save.json should not contain unsubstituted tokens");

  const preview = fillTemplate("preview.json", { __VIDEO_ID__: "v", __AVATAR_ID__: "a" });
  assert.ok(!/__[A-Z_]+__/.test(JSON.stringify(preview)), "preview.json should not contain unsubstituted tokens");

  const genSave = fillTemplate("generate-audio-save.json", {
    __VIDEO_ID__: "v", __AVATAR_ID__: "a", __TITLE__: "t", __AUDIO_URL__: "u",
    __AUDIO_TEXT__: "txt", __VOICE_ID__: "vid", __WIDTH__: 1920, __HEIGHT__: 1080, __SCALE__: 1
  });
  assert.ok(!/__[A-Z_]+__/.test(JSON.stringify(genSave)), "generate-audio-save.json should not contain unsubstituted tokens");
});

test("5. Help without auth", () => {
  const out = execSync("node heygen-web.mjs help", {
    cwd: PKG_ROOT,
    env: { ...process.env, HEYGEN_WEB_CURLS: "/nonexistent" },
    encoding: "utf8"
  });
  assert.ok(out.includes("generate-from-template"));
  assert.ok(out.includes("photo-to-video"));
});

test("6. Avatar registry: slug resolves, raw id passes through", async () => {
  const { loadRegistry, resolveAvatar, resolveTemplate } =
    await import(resolve(PKG_ROOT, "src/client/registry.mjs"));

  const reg = loadRegistry();
  assert.ok(typeof reg === "object", "registry loads as an object");
  // avatars.json is valid and seeded
  assert.ok(reg["girl-1"] && reg["girl-1"].template_id, "girl-1 seeded with a template_id");
  assert.ok(reg["girl-1"].description, "entries carry a description");

  // known slug → mapped id
  assert.strictEqual(resolveTemplate("girl-1"), "7629dffbebe141eb8f701630948bd707");
  assert.strictEqual(resolveTemplate("girl-2"), "887ad69c743d4740a0174eecb3198ef4");
  // unknown value → passthrough (raw ids keep working)
  assert.strictEqual(resolveTemplate("some-raw-id-123"), "some-raw-id-123");
  assert.strictEqual(resolveAvatar("another-raw-id"), "another-raw-id");
  // undefined → undefined (missing flag stays missing)
  assert.strictEqual(resolveAvatar(undefined), undefined);
});
