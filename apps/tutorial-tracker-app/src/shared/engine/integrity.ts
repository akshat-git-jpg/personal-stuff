// ===========================================================================
// CARD INTEGRITY — states the app itself never produces, but a direct D1 write
// or a stale Team change can. Each one leaves a card nobody can move.
// Run daily by the Worker cron; findings go to Telegram.
// ===========================================================================
import { colOf, stageHasReviewerSlot, stageKind } from "./types";
import type { PipelineDef } from "./types";
import { assignmentProblems } from "./assign";
import { REVIEWER_ROLE } from "./registry";
import { holdsRoleInSystem, type Memberships } from "./memberships";
import { lifecycle } from "./lifecycle";
import { statusOf, stageHasReviewer } from "./derive";
import { pipeOf, type Row } from "./rbac";

export type CardIssueCode = "review_without_reviewer" | "reviewer_lacks_role" | "assignee_lacks_role" | "self_review" | "bad_default";

export interface CardIssue {
  code: CardIssueCode;
  row_id: string;
  title: string;
  stage: string;
  detail: string;
}

const norm = (s: string | undefined) => (s || "").trim().toLowerCase();

/** Every stuck state across all cards. `team` maps a lowercased email to its memberships. */
export function cardIssues(rows: Row[], team: Map<string, Memberships>): CardIssue[] {
  const out: CardIssue[] = [];
  for (const row of rows) {
    const p = pipeOf(row);
    const base = { row_id: row.row_id ?? "", title: row.video_title ?? "" };
    for (const s of p.stages) {
      const lc = lifecycle(s.lifecycle);
      const status = statusOf(s, row);
      if (!status || status === lc.done) continue;
      const stage = s.label;

      if (lc.reviewed && status === "In Review" && !stageHasReviewer(s, row)) {
        out.push({ ...base, stage, code: "review_without_reviewer",
          detail: "Is In Review but has no reviewer, so it is in nobody's review queue." });
      }

      const reviewer = stageHasReviewerSlot(s) ? norm(row[colOf(s, "reviewer")]) : "";
      if (reviewer && !holdsRoleInSystem(team.get(reviewer) ?? {}, p.id, REVIEWER_ROLE)) {
        out.push({ ...base, stage, code: "reviewer_lacks_role",
          detail: `Reviewer ${reviewer} is not a Reviewer in ${p.name}, so they cannot approve it.` });
      }

      const assignee = norm(row[colOf(s, "assignee")]);
      if (assignee && !holdsRoleInSystem(team.get(assignee) ?? {}, p.id, s.role)) {
        out.push({ ...base, stage, code: "assignee_lacks_role",
          detail: `Assignee ${assignee} is not a ${s.role} in ${p.name}, so they cannot work on it.` });
      }

      if (reviewer && reviewer === assignee && stageKind(s) !== "brief") {
        out.push({ ...base, stage, code: "self_review",
          detail: `${reviewer} is both doer and reviewer, and nobody may review their own work.` });
      }
    }
  }
  return out;
}

/** Default assignments that would put a new card in a stuck state. */
export function defaultIssues(p: PipelineDef, defaults: Record<string, string>, team: Map<string, Memberships>): CardIssue[] {
  return assignmentProblems(p, defaults, team).map((x) => ({
    code: "bad_default" as const, row_id: "", title: `${p.name} defaults`, stage: x.col,
    detail: `${x.email}: ${x.message}`,
  }));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Telegram HTML report, or null when every card is healthy. */
export function cardIssuesReport(issues: CardIssue[], appUrl = ""): string | null {
  if (!issues.length) return null;
  const lines = issues.map((i) => `• <b>${esc(i.title || i.row_id)}</b> (${esc(i.stage)}): ${esc(i.detail)}`);
  const head = `Tracker: ${issues.length} stuck card${issues.length === 1 ? "" : "s"}`;
  return [head, ...lines, ...(appUrl ? [appUrl] : [])].join("\n");
}
