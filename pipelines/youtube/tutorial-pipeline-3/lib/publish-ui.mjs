import fs from "fs";
import path from "path";
import { parseArgs } from "util";
import { loadEnv } from "./env.mjs";

export async function publishScript(script, opts, fetchImpl = fetch) {
  if (script.stage !== "tts") {
    throw new Error(`stage must be tts (got ${script.stage})`);
  }
  const url = `${process.env.VO_UI_URL}/api/admin/publish/${opts.slug}`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.VO_UI_ADMIN_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ script, drive_url: opts.drive_url })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Publish failed: ${res.status} ${txt}`);
  }
  return await res.json();
}

if (process.argv[1] && process.argv[1].endsWith("publish-ui.mjs")) {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "drive-url": { type: "string" },
      "root": { type: "string", default: "." }
    },
    allowPositionals: true
  });

  const slug = positionals[0];
  if (!slug) {
    console.error("Usage: node lib/publish-ui.mjs <slug> [--drive-url URL] [--root d]");
    process.exit(1);
  }

  loadEnv(path.resolve(values.root));
  
  const scriptPath = path.join(values.root, "videos", slug, "script.json");
  if (!fs.existsSync(scriptPath)) {
    console.error(`Script not found: ${scriptPath}`);
    process.exit(1);
  }

  const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));

  publishScript(script, { slug, drive_url: values["drive-url"] }).then(res => {
    console.log(res.link);
  }).catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
