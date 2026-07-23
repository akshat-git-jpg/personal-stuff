import fs from "fs";
import path from "path";
import { parseArgs } from "util";
import { loadEnv } from "./env.mjs";

export function mergeState(script, state) {
  const sections = script.sections.map(sec => {
    const st = state.sections.find(s => s.id === sec.id);
    if (!st) return sec;
    return {
      ...sec,
      spoken_text: st.spoken_text,
      tts: {
        ...sec.tts,
        regens_used: Math.max(0, st.takes_used - 1),
        locked: st.locked === 1,
        take: st.take_key || null
      }
    };
  });
  return { ...script, sections };
}

if (process.argv[1] && process.argv[1].endsWith("pull-ui.mjs")) {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "root": { type: "string", default: "." }
    },
    allowPositionals: true
  });

  const slug = positionals[0];
  if (!slug) {
    console.error("Usage: node lib/pull-ui.mjs <slug> [--root d]");
    process.exit(1);
  }

  loadEnv(path.resolve(values.root));

  const scriptPath = path.join(values.root, "videos", slug, "script.json");
  if (!fs.existsSync(scriptPath)) {
    console.error(`Script not found: ${scriptPath}`);
    process.exit(1);
  }

  const script = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
  
  const url = `${process.env.VO_UI_URL}/api/admin/state/${slug}`;
  fetch(url, {
    headers: { "Authorization": `Bearer ${process.env.VO_UI_ADMIN_TOKEN}` }
  }).then(async res => {
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Pull failed: ${res.status} ${txt}`);
    }
    return res.json();
  }).then(state => {
    const merged = mergeState(script, state);
    fs.writeFileSync(scriptPath, JSON.stringify(merged, null, 2) + "\n");
    
    const allLocked = merged.sections.every(s => s.tts?.locked);
    if (allLocked) {
      console.log(`all locked — run: node lib/set-stage.mjs ${slug} locked`);
    } else {
      console.log("State pulled successfully.");
    }
  }).catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
