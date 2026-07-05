// Guard: the CLIENT field-classification layer must stay in lockstep with the
// engine for EVERY pipeline — not just Standard. This is the test that was
// missing when tut-2 (a pipeline with non-Standard column names) rendered every
// field as a plain text input: ETAs weren't date pickers, deliverable links had
// no link treatment, instructions weren't textareas, assignees weren't dropdowns.
//
// fieldType()/LINK_HINTS are pure functions of the typed defs, so a new pipeline
// can't silently fall back to "text" without failing here.
import { describe, it, expect } from "vitest";
import { PIPELINES } from "../src/shared/engine/registry";
import { colOf, stageHasReviewerSlot, stageHasInstruction, stageHasEta, workField, type FieldType } from "../src/shared/engine/types";
import { lifecycle } from "../src/shared/engine/lifecycle";
import { fieldType } from "../src/client/columnMeta";
import { LINK_HINTS } from "../src/client/labels";

// engine FieldDef.type → client widget: a URL is a link, everything else is itself.
const widgetForType = (t: FieldType): string => (t === "url" ? "link" : t);

describe("client widgets match the engine field defs for every pipeline", () => {
  for (const p of Object.values(PIPELINES)) {
    for (const s of p.stages) {
      it(`${p.id}/${s.id} — every slot classifies correctly`, () => {
        expect(fieldType(colOf(s, "assignee"))).toBe("assignee");
        if (stageHasReviewerSlot(s)) expect(fieldType(colOf(s, "reviewer"))).toBe("assignee");
        if (stageHasInstruction(s)) expect(fieldType(colOf(s, "instruction"))).toBe("textarea");
        if (stageHasEta(s)) expect(fieldType(colOf(s, "eta"))).toBe("eta");
        if (lifecycle(s.lifecycle).reviewed) expect(fieldType(colOf(s, "feedback"))).toBe("textarea");

        const wf = workField(s);
        if (wf) {
          expect(fieldType(colOf(s, "work_link"))).toBe(widgetForType(wf.type));
          // Deliverable URLs must carry the public-share hint everywhere.
          if (wf.type === "url") expect(LINK_HINTS[colOf(s, "work_link")]).toBeTruthy();
        }
        for (const f of s.extra ?? []) {
          const col = f.slot ? colOf(s, f.slot) : f.id;
          expect(fieldType(col)).toBe(widgetForType(f.type));
        }
      });
    }
  }
});

// The exact failure mode that bit us: a real field rendering as a bare text box.
it("no deliverable work-link column falls back to plain text", () => {
  for (const p of Object.values(PIPELINES)) for (const s of p.stages) {
    const wf = workField(s);
    if (wf && wf.type === "url") {
      expect(fieldType(colOf(s, "work_link")), `${p.id}/${s.id} work link`).toBe("link");
    }
  }
});
