import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ProgramRow } from "../worker/programs";

type Issue = { code: string; slug: string; detail: string };
type Latest = { ran_at: number; checked: number; unverifiable: number; issues_json: string };
type State = "loading" | "ready" | "forbidden" | "error";

/** Costs commission right now. */
const MONEY = new Set(["no_credit_marker", "points_at_dashboard", "bad_url", "kv_d1_mismatch"]);
/** Records that drifted: real, but nothing is bleeding while you read it. */
const CHANGED = new Set(["changed_destination", "duplicate_target", "approved_no_link", "link_without_program", "unclassified_kind"]);

export function LinkHealth({ onFix }: { onFix: (program: ProgramRow) => void }) {
  const [state, setState] = useState<State>("loading");
  const [latest, setLatest] = useState<Latest | null>(null);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [running, setRunning] = useState(false);

  async function load() {
    setState("loading");
    try {
      const response = await fetch("/api/link-health", { credentials: "same-origin" });
      if (response.status === 403) { setState("forbidden"); return; }
      if (!response.ok) throw new Error();
      const body = await response.json() as { latest: Latest | null; programs: ProgramRow[] };
      setLatest(body.latest);
      setPrograms(body.programs);
      setState("ready");
    } catch { setState("error"); }
  }

  async function recheck() {
    setRunning(true);
    try {
      await fetch("/api/link-health/recheck", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" });
      await load();
    } finally { setRunning(false); }
  }

  useEffect(() => { void load(); }, []);

  if (state === "loading") return <p className="text-sm text-muted-foreground">Loading link health…</p>;
  if (state === "forbidden") return <p className="text-sm text-destructive">You need the Admin role to see link health.</p>;
  if (state === "error") return <div className="flex gap-3 text-sm text-destructive"><span>Health could not load.</span><Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button></div>;

  const issues: Issue[] = latest ? JSON.parse(latest.issues_json) : [];

  // Three buckets that PARTITION the list, so the headline count always equals
  // the cards on screen. The old version filtered against two hardcoded sets and
  // silently dropped every other code — own_redirect_layer, unmapped_video,
  // wrapped_redirect and scheme_added were all counted and never rendered, so a
  // headline count would have disagreed with what you can actually see and click.
  // "Also worth fixing" is a catch-all by construction: a code added to the guard
  // later shows up here on its own instead of disappearing.
  const moneyIssues = issues.filter((issue) => MONEY.has(issue.code));
  const changedIssues = issues.filter((issue) => CHANGED.has(issue.code));
  const otherIssues = issues.filter((issue) => !MONEY.has(issue.code) && !CHANGED.has(issue.code));

  const programFor = (slug: string) => programs.find((program) => program.slug === slug);

  const renderGroup = (title: string, selected: Issue[]) => selected.length ? (
    <section className="space-y-2">
      <h3 className="font-medium">{title} <span className="text-muted-foreground tabular-nums">({selected.length})</span></h3>
      {selected.map((issue) => {
        const program = programFor(issue.slug);
        return (
          <div className="rounded-lg border border-border p-3" key={`${issue.code}:${issue.slug}`}>
            <p className="font-medium">{issue.slug}</p>
            <p className="mt-1 text-sm text-muted-foreground">{issue.detail}</p>
            {program && <Button size="xs" className="mt-2" variant="outline" onClick={() => onFix(program)}>Fix programme</Button>}
          </div>
        );
      })}
    </section>
  ) : null;

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" data-testid="link-health">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Link health</h2>
            {!latest ? (
              <p className="text-sm text-muted-foreground">The guard has not run yet. It first runs at 06:00 IST.</p>
            ) : (
              <>
                <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight" data-testid="attention-count">
                  {issues.length === 0
                    ? `All ${latest.checked} links are fine`
                    : `${issues.length} need${issues.length === 1 ? "s" : ""} your attention`}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {issues.length > 0 && <>
                    <span className="tabular-nums">{moneyIssues.length}</span> costing money
                    {" · "}<span className="tabular-nums">{changedIssues.length}</span> changed
                    {otherIssues.length > 0 && <>{" · "}<span className="tabular-nums">{otherIssues.length}</span> other</>}
                    {" · "}<span className="tabular-nums">{latest.checked - issues.length}</span> fine of <span className="tabular-nums">{latest.checked}</span>
                    {" · "}
                  </>}
                  Last run {new Date(latest.ran_at * 1000).toLocaleString()}
                </p>
              </>
            )}
          </div>
          <Button size="sm" disabled={running} onClick={() => void recheck()}>{running ? "Checking…" : "Re-check now"}</Button>
        </div>

        {renderGroup("Costing you money now", moneyIssues)}
        {renderGroup("Changed since last week", changedIssues)}
        {renderGroup("Also worth fixing", otherIssues)}

        <div className="rounded-lg border border-dashed border-border p-3 text-sm">
          <strong className="tabular-nums">{latest?.unverifiable ?? 0} links block robots — only you can check them</strong>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="rounded-lg border border-border p-4">
          <h3 className="font-medium">What runs, and when</h3>
          <p className="mt-2 text-sm text-muted-foreground">One 06:00 IST run every day checks our records. On Sundays the same run also follows destinations once, kept weekly so networks do not see automated traffic every day. On the first of each month it also lists robot-blocked links.</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <h3 className="font-medium">What Telegram sends you</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{issues.length ? `${issues.length} link issues need attention.` : "A Sunday heartbeat confirms the guard is healthy."}</p>
        </div>
        <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">No AI is involved. These are deterministic checks of stored links and weekly destinations.</div>
      </aside>
    </section>
  );
}
