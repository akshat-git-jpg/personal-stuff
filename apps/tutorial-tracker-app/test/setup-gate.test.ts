import { describe, it, expect } from "vitest";
import app from "../src/worker/index";
import { PIPELINES } from "../src/shared/engine/registry";
import { requiredToCreate, colOf, stageHasReviewerSlot, createFieldsOf } from "../src/shared/engine/types";

describe("setup gate", () => {
  for (const pid of Object.keys(PIPELINES)) {
    const p = PIPELINES[pid];
    
    it(`[${pid}] requiredToCreate includes stage 0's brief fields`, () => {
      const req = requiredToCreate(p);
      const briefCols = createFieldsOf(p).map(f => f.col);
      for (const col of briefCols) {
        expect(req).toContain(col);
      }
    });
    
    it(`[${pid}] includes an assignee column for every stage after the first`, () => {
      const req = requiredToCreate(p);
      for (const s of p.stages.slice(1)) {
        expect(req).toContain(colOf(s, "assignee"));
      }
    });

    it(`[${pid}] includes no reviewer column`, () => {
      const req = requiredToCreate(p);
      for (const s of p.stages) {
        if (stageHasReviewerSlot(s)) {
          expect(req).not.toContain(colOf(s, "reviewer"));
        }
      }
    });
    
    it(`[${pid}] a payload missing any one of them is reported as incomplete`, async () => {
      const payload: Record<string, string> = { pipeline: pid };
      for (const col of requiredToCreate(p)) {
        payload[col] = "filled";
      }
      
      const toOmit = p.stages.slice(1).map(s => colOf(s, "assignee"))[0];
      payload[toOmit] = "";
      
      const req = new Request("http://localhost/api/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Dev-Email": "admin@x.com",
          "X-Dev-Roles": "Admin",
          "X-Dev-System": pid
        },
        body: JSON.stringify(payload)
      });
      const res = await app.request(req, {}, { DEV_AUTH: "1" } as any);
      
      if (res.status !== 400) {
        throw new Error("incomplete video was accepted");
      }
      
      const json = await res.json() as any;
      expect(json.error).toMatch(/^Missing:/);
    });
  }
});
