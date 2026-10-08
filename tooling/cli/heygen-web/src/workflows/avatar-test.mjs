import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPhotoAvatar } from "../operations/avatars.mjs";
import { submitAudioGenerate } from "../operations/render.mjs";
import { usageSnapshot } from "../operations/account.mjs";
import { call, endpoints } from "../client/endpoints.mjs";
import { die } from "../client/http.mjs";
import { arg } from "../cli/args.mjs";

// One avatar test: photo avatar → Avatar III video → credit check → Test Avatar folder → mapping row.
// Driven by the avatar-test skill; the mapping is the record of every test.
const __dirname = dirname(fileURLToPath(import.meta.url));
export const MAPPING = process.env.HEYGEN_AVATAR_TESTS ||
  resolve(__dirname, "../../../../../pipelines/video/heygen/avatar-test/avatar-tests.json");
export const TEST_FOLDER = "f214dcf8986a4114ba69b9630e38fe00"; // "Test Avatar"
const METERS = ["credits", "seconds_consumed", "ai_image_credits", "ai_video_credits", "ai_concept_credits"];
const POLL_MS = 20000, TIMEOUT_MS = 20 * 60 * 1000;

export function meterSpent(before, after) {
  return METERS.filter((k) => (after[k] ?? 0) !== (before[k] ?? 0))
    .map((k) => `${k} ${before[k]} → ${after[k]}`);
}

export function appendMapping(row, file = MAPPING) {
  const doc = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { tests: [] };
  doc.tests.push(row);
  writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
}

async function waitDone(auth, id) {
  const end = Date.now() + TIMEOUT_MS;
  for (;;) {
    const item = (await call(auth, endpoints.projectItemsStatus, { id }))?.data?.[0];
    if (item?.status === "completed" || item?.status === "failed") return item;
    if (Date.now() > end) die(`video ${id} still rendering after 20 min; re-check with: status ${id}`);
    console.error(`  rendering… ${item?.progress != null ? item.progress.toFixed(0) + "%" : ""}`);
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

export async function avatarTest(auth, args) {
  const image = arg(args, "--image"), audio = arg(args, "--audio"), name = arg(args, "--name");
  if (!image || !audio || !name) die("avatar-test needs --image <pic> --audio <file> --name <avatar name> [--pic-drive <url>] [--source-pic <path>] [--source-drive <url>] [--watermark removed|none]");
  if (!existsSync(image)) die(`no such image: ${image}`);
  if (!existsSync(audio)) die(`no such audio: ${audio}`);

  const before = await usageSnapshot(auth);
  console.error(`credits before: ${before.credits}, seconds ${before.seconds_consumed}/${before.seconds_limit}`);

  const { look_id } = await createPhotoAvatar(auth, [image, "--name", name]);
  const title = `${name} - test ${new Date().toISOString().slice(0, 10)}`;
  const { video_id } = await submitAudioGenerate(auth, { avatar: look_id, audioPath: audio, engine: "heygen3", title, orientation: "landscape" });
  console.error(`→ video ${video_id} submitted, waiting for the render (credits are billed at the end)`);
  const done = await waitDone(auth, video_id);

  const after = await usageSnapshot(auth);
  const spent = meterSpent(before, after);
  let moved = false;
  if (done.status === "completed") {
    const r = await call(auth, endpoints.projectItemsMove, {}, { body: { project_id: TEST_FOLDER, items: [{ item_type: "heygen_video", item_ids: [video_id] }] } });
    moved = r?.code === 100;
  }
  const row = {
    date: new Date().toISOString().slice(0, 10), avatar_name: name, avatar_id: look_id,
    video_title: title, video_id, video_status: done.status, audio: basename(audio),
    pic_local: resolve(image), pic_source: arg(args, "--source-pic") || null, pic_drive: arg(args, "--pic-drive") || null, pic_source_drive: arg(args, "--source-drive") || null,
    watermark: arg(args, "--watermark") || "none", credits_used: spent.length ? spent : 0,
    in_test_folder: moved,
  };
  appendMapping(row);
  console.log(JSON.stringify(row, null, 2));
  if (spent.length) { console.error(`⚠️ CREDITS USED: ${spent.join(", ")}`); process.exit(2); }
  if (done.status !== "completed") { console.error(`✖ render ${done.status}: ${done.error_message || ""}`); process.exit(1); }
  console.error(`✓ 0 credits used · moved to Test Avatar: ${moved} · recorded in ${basename(MAPPING)}`);
}
