import { call, endpoints } from "../client/endpoints.mjs";
import { arg } from "../cli/args.mjs";

export async function listVoices(auth, args) {
  const limit = arg(args, "--limit") || "30", page = arg(args, "--page") || "1";
  const term = (arg(args, "--search") || "").toLowerCase();
  const r = await call(auth, endpoints.voiceList, { page, limit });
  let list = r?.data?.list || [];
  if (term) list = list.filter((v) => (v.display_name || "").toLowerCase().includes(term)
    || (v.labels || []).join(" ").toLowerCase().includes(term));
  if (args.includes("--json")) return console.log(JSON.stringify(list, null, 2));
  for (const v of list)
    console.log(`${v.voice_id}  ${(v.display_name || "").trim().replace(/\s+/g, " ")}` +
      `  (${v.gender || "?"}, ${v.accent || v.language || "?"})  [${(v.labels || []).join(", ").trim()}]`);
  console.error(`\n→ ${list.length} voices (page ${page}). --search <term> to filter, --json for full.`);
}
