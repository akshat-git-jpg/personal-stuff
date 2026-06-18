/**
 * Generate CONTROL.md — a read-only, human-readable mirror of the control tables
 * in src/shared/control.ts. Run it after editing control.ts so the doc never drifts:
 *
 *   npx tsx scripts/gen-control-md.ts
 *
 * It writes CONTROL.md in the app root. Column names match control.ts exactly
 * (so the doc lines up with the file you edit).
 */
import { writeFileSync } from "node:fs";
import { CONTROL } from "../src/shared/control";
import { STAGES } from "../src/shared/pipeline";

const list = (cols: string[]) => (cols.length ? cols.join(", ") : "—");

const lines: string[] = [];
lines.push("# Tutorials Tracker — control matrix");
lines.push("");
lines.push("> Auto-generated from `src/shared/control.ts` by `scripts/gen-control-md.ts`.");
lines.push("> **Do not edit by hand** — edit `control.ts` and re-run the generator.");
lines.push("");
lines.push("For each stage: what each role sees (`show`), can edit (`edit`), and must");
lines.push("fill before moving forward. Pipeline order: " + STAGES.map((s) => s.label).join(" → ") + ".");
lines.push("");

for (const stage of STAGES) {
  const sc = CONTROL[stage.id];
  if (!sc) continue;
  lines.push(`## ${stage.label}  ·  worker = ${stage.ownerRole}`);
  lines.push("");

  // Worker table
  lines.push(`### ${stage.ownerRole} (worker)`);
  lines.push("");
  lines.push("| Status | Shown | Editable | Must fill to advance |");
  lines.push("|---|---|---|---|");
  for (const [status, rule] of Object.entries(sc.worker)) {
    lines.push(`| ${status} | ${list(rule.show)} | ${list(rule.edit)} | ${list(rule.mustFill)} |`);
  }
  lines.push("");

  // Reviewer table
  lines.push("### Reviewer");
  lines.push("");
  lines.push("| Status | Shown | Editable |");
  lines.push("|---|---|---|");
  for (const [status, rule] of Object.entries(sc.reviewer.byStatus)) {
    lines.push(`| ${status} | ${list(rule.show)} | ${list(rule.edit)} |`);
  }
  lines.push("");
  lines.push(`- **Must fill to Approve** (→ Done): ${list(sc.reviewer.toApprove)}`);
  lines.push(`- **Must fill to Request changes** (→ Need Changes): ${list(sc.reviewer.toSendBack)}`);
  lines.push("");
}

lines.push("---");
lines.push("");
lines.push("Notes:");
lines.push("- Admin always sees & edits everything (not tabled).");
lines.push("- `*_eta` is a calendar date, required before To Do → In Progress, editable only at To Do.");
lines.push("- A shown-but-not-editable column renders read-only; a column not shown is hidden.");

writeFileSync(new URL("../CONTROL.md", import.meta.url), lines.join("\n") + "\n");
console.log("Wrote CONTROL.md");
