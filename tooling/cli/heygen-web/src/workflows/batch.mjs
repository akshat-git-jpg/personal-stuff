import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { die } from "../client/http.mjs";
import { arg } from "../cli/args.mjs";
import { resolveAvatar } from "../client/registry.mjs";
import { submitGenerate } from "../operations/render.mjs";
import { downloadCore } from "../operations/videos.mjs";
import { meterChecked } from "../operations/account.mjs";

// Batch generate many clips from a file. Each clip = one unlimited Avatar III submit.
//   --file *.txt   → one script per line (uses shared --avatar/--voice/--orientation/--res)
//   --file *.json  → [{ "text": "...", "avatar"?, "voice"?, "title"?, "orientation"?, "res"? }, ...]
// Writes a manifest (line ↔ video_id) so `download` can be run later per id.
export async function batch(auth, args) {
  const file = arg(args, "--file"); if (!file) die("batch needs --file <items.txt|items.json>");
  if (!existsSync(file)) die(`no such file: ${file}`);
  const iv = args.includes("--iv");
  const shared = {
    avatar: resolveAvatar(arg(args, "--avatar")), voice: arg(args, "--voice"),
    orientation: arg(args, "--orientation"), res: arg(args, "--res"), iv,
  };
  const outDir = arg(args, "--out-dir") || ".";
  const delay = Number(arg(args, "--delay") || 1500); // ms between submits, be polite
  const doDl = args.includes("--download");

  // parse items
  const txt = readFileSync(file, "utf8");
  let items;
  if (file.endsWith(".json")) {
    items = JSON.parse(txt);
    if (!Array.isArray(items)) die("JSON batch file must be an array of objects");
  } else {
    items = txt.split("\n").map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#")).map((text) => ({ text }));
  }
  if (!items.length) die("no items found in batch file");

  // validate every item resolves an avatar+voice before spending anything
  const resolved = items.map((it, i) => {
    const m = {
      text: it.text, avatar: resolveAvatar(it.avatar) || shared.avatar, voice: it.voice || shared.voice,
      title: it.title || `batch ${i + 1}`,
      orientation: it.orientation || shared.orientation,
      res: it.res || shared.res, iv: shared.iv,
    };
    if (!m.text || !m.avatar || !m.voice)
      die(`item ${i + 1} missing text/avatar/voice (set per-item or via --avatar/--voice). Got: ${JSON.stringify(it)}`);
    return m;
  });

  console.error(`→ batch: ${resolved.length} clips, ${iv ? "Avatar IV (METERED)" : "Avatar III (unlimited)"} …`);
  const results = [];
  // One meter-check around the whole batch (not per-clip) — proves the run stayed free.
  await meterChecked(auth, args, async () => {
    for (let i = 0; i < resolved.length; i++) {
      const it = resolved[i];
      try {
        const { video_id, raw } = await submitGenerate(auth, it);
        results.push({ index: i + 1, title: it.title, text: it.text, video_id: video_id || null,
          ok: !!video_id, code: raw?.code });
        console.error(`  [${i + 1}/${resolved.length}] ${video_id ? "✓ " + video_id : "✖ no video_id: " + JSON.stringify(raw)}`);
      } catch (e) {
        results.push({ index: i + 1, title: it.title, text: it.text, video_id: null, ok: false, error: String(e) });
        console.error(`  [${i + 1}/${resolved.length}] ✖ ${e}`);
      }
      if (i < resolved.length - 1) await new Promise((r) => setTimeout(r, delay));
    }
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const manifest = resolve(outDir, `batch-${stamp}.json`);
  writeFileSync(manifest, JSON.stringify({ created: stamp, count: results.length, results }, null, 2));
  const ok = results.filter((r) => r.ok).length;
  console.error(`\n→ ${ok}/${results.length} submitted. manifest: ${manifest}`);

  if (doDl) {
    console.error(`→ downloading (give renders ~time; will retry) …`);
    for (const r of results.filter((x) => x.ok)) {
      const out = resolve(outDir, `${r.video_id}_${shared.res || "720p"}.mp4`);
      const url = await downloadCore(auth, r.video_id, shared.res || "720p", false, 12, 15000);
      if (!url) { console.error(`  ✖ ${r.video_id}: not ready after retries (download later)`); continue; }
      writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer()));
      console.error(`  ✓ ${out}`);
    }
  }
  console.log(JSON.stringify({ manifest, ok, total: results.length }, null, 2));
}
