import fs from "fs";
import path from "path";
import { parseArgs } from "util";

export function renderScriptMd(script) {
  let md = `# ${script.video} — script v${script.version}  (stage: ${script.stage})\n`;
  
  const sortedSections = [...script.sections].sort((a, b) => a.id.localeCompare(b.id));

  for (const sec of sortedSections) {
    const demoTag = sec.demo ? "[demo]" : "[no demo]";
    md += `\n## ${sec.id} ${demoTag}\n\n${sec.display_text}\n`;

    let hasBlockquote = false;

    if (sec.notes && sec.notes.trim() !== "") {
      if (!hasBlockquote) {
        md += `\n`;
        hasBlockquote = true;
      }
      md += `> notes: ${sec.notes}\n`;
    }

    if (sec.flags && sec.flags.length > 0) {
      if (!hasBlockquote) {
        md += `\n`;
        hasBlockquote = true;
      }
      for (const flag of sec.flags) {
        md += `> FLAG (${flag.kind}): ${flag.note}\n`;
      }
    }
  }

  return md;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      root: { type: "string" },
    },
    allowPositionals: true,
  });

  const slug = positionals[0];
  if (!slug) {
    console.error("Usage: node lib/render-script-md.mjs <slug> [--root <dir>]");
    process.exit(1);
  }

  const root = values.root || process.cwd();
  const jsonPath = path.join(root, "videos", slug, "script.json");
  const mdPath = path.join(root, "videos", slug, "script.md");

  const script = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const md = renderScriptMd(script);
  fs.writeFileSync(mdPath, md, "utf8");
}
