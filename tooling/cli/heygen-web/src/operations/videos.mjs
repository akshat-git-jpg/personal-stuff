import { writeFileSync } from "node:fs";
import { call, endpoints } from "../client/endpoints.mjs";
import { die } from "../client/http.mjs";
import { arg } from "../cli/args.mjs";

export async function listVideos(auth, args) {
  const limit = arg(args, "--limit") || "30";
  const type = arg(args, "--type") || "heygen_video";
  const r = await call(auth, endpoints.projectItems, { limit, type });
  const items = r?.data?.items || [];
  if (args.includes("--json")) return console.log(JSON.stringify(items, null, 2));
  for (const it of items) {
    const dt = it.created_ts ? new Date(it.created_ts * 1000).toISOString().slice(0, 16).replace("T", " ") : "?";
    console.log(`${it.video_id}  ${dt}  ${String(it.status).padEnd(9)} ${String((it.duration || 0).toFixed(1) + "s").padStart(7)}  ${it.name || ""}`);
  }
  console.error(`\n→ ${items.length} videos (type=${type}). delete-video <id...> to trash.`);
}

export async function status(auth, id) {
  if (!id) die("status needs <video_id>");
  const r = await call(auth, endpoints.projectItemsStatus, { id });
  const item = r?.data?.[0];
  if (!item) die("no such video_id (or no status yet): " + id);
  console.log(JSON.stringify(item, null, 2));
  if (item.status === "processing" && item.eta != null)
    console.error(`→ processing, ~${Math.round(item.eta)}s left (${item.progress?.toFixed(1)}%)`);
  else
    console.error(`→ ${item.status}`);
}

export async function deleteVideos(auth, ids, args) {
  if (!ids.length) die("delete-video needs <video_id> [<video_id> ...]");
  const type = arg(args, "--type") || "heygen_video";
  const body = { items: ids.map((id) => ({ id, item_type: type })) };
  const r = await call(auth, endpoints.projectItemTrash, {}, { body });
  console.log(JSON.stringify(r, null, 2));
  if (r?.code === 100) console.error(`✓ trashed ${ids.length} item(s): ${ids.join(", ")}`);
}

export async function downloadCore(auth, id, res, caps, kickRetries = 0, kickGap = 15000) {
  for (let attempt = 0; ; attempt++) {
    const kick = await call(auth, endpoints.videoDownload, {}, {
      body: { video_id: id, resolution: res, resource_type: "heygen_video", with_captions: caps },
    });
    let url = kick?.data?.download_url;
    const wf = kick?.data?.workflow_id;
    if (url) return url;
    if (wf) {
      for (let i = 0; i < 200; i++) {
        const s = await call(auth, endpoints.videoDownloadStatus, { workflow_id: wf });
        const st = (s?.data?.status || "").toUpperCase();
        process.stderr.write(".");
        if (st === "COMPLETED") return s.data.download_url;
        if (st === "FAILED" || st === "ERROR") die(`\ntranscode ${st}: ${JSON.stringify(s)}`);
        await new Promise((r) => setTimeout(r, 3000));
      }
      return null;
    }
    if (attempt >= kickRetries) return null;
    await new Promise((r) => setTimeout(r, kickGap));
  }
}

export async function download(auth, id, args) {
  if (!id) die('download needs <video_id>');
  const res = arg(args, "--res") || "1080p";
  const caps = args.includes("--captions");
  const url = await downloadCore(auth, id, res, caps);
  if (!url) die("no download_url (is the video done rendering?). Wait ~1 min and retry.");
  process.stderr.write(" done\n");
  const out = arg(args, "--out") || `${id}_${res}.mp4`;
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(out, buf);
  console.log(`saved ${out} (${(buf.length / 1e6).toFixed(1)} MB)`);
}
