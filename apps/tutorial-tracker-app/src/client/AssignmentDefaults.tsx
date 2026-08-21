/**
 * AssignmentDefaults.tsx — admin editor for default people per (category,
 * subcategory) combination. New cards in a matching combo get these assignees +
 * reviewers pre-filled; an exact (category, subcategory) set wins over a
 * category-level one (blank subcategory). Lives in the Team tab.
 */
import { useEffect, useState } from "react";
import { PIPELINES, reviewerColOf, assigneeColOf } from "./stages";
import { holdsRoleInSystem } from "../shared/engine/memberships";
import {
  getDefaults, getDefaultCols, saveDefaults, deleteDefault, getTeam, personLabel,
  type AssignmentDefaultRow, type TeamMember,
} from "./api";
import { fieldLabel } from "./labels";
import { ComboSelect } from "./CardDetail";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const inputCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";
const selectCls = "h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

function colRole(col: string): string {
  for (const p of Object.values(PIPELINES)) for (const s of p.stages) {
    if (reviewerColOf(s) === col) return "Reviewer";
    if (assigneeColOf(s) === col) return s.role;
  }
  return "";
}
const PIPELINE_LIST = Object.values(PIPELINES).map((p) => ({ id: p.id, name: p.name }));
const scopeKey = (cat: string, sub: string) => `${cat}\u0000${sub}`;

interface Props {
  categoryOptions: string[];
  subcategoryOptions: string[];
  /** Controlled system (from the Team tab's active system); omit to show an own selector. */
  system?: string;
  /** Called after save/delete so the parent can refresh category/subcategory options. */
  onChanged?: () => void;
}

interface Draft { category: string; subcategory: string; assignments: Record<string, string>; }
const EMPTY: Draft = { category: "", subcategory: "", assignments: {} };

export function AssignmentDefaults({ categoryOptions, subcategoryOptions, system, onChanged }: Props) {
  const [rows, setRows] = useState<AssignmentDefaultRow[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Defaults are per system — controlled by the parent Team tab, or pick our own.
  const [ownPipelineId, setOwnPipelineId] = useState<string>(PIPELINE_LIST[0]?.id ?? "standard");
  const pipelineId = system ?? ownPipelineId;

  async function load() {
    setLoading(true);
    try {
      const [d, c, t] = await Promise.all([getDefaults(pipelineId), getDefaultCols(pipelineId), getTeam()]);
      setRows(d); setCols(c); setTeam(t);
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [pipelineId]);

  const names: Record<string, string> = {};
  const memberRoles: Record<string, string> = {};
  for (const m of team) { names[m.email.toLowerCase()] = m.name; memberRoles[m.email.toLowerCase()] = (m.roles ?? [m.role]).join(", "); }
  // Only people who hold the role IN this system (reviewers may span systems).
  const peopleFor = (role: string) => team.filter((m) => holdsRoleInSystem(m.memberships ?? {}, pipelineId, role)).map((m) => m.email);

  // Group flat rows into scopes.
  const scopes = new Map<string, Draft>();
  for (const r of rows) {
    const k = scopeKey(r.category, r.subcategory);
    if (!scopes.has(k)) scopes.set(k, { category: r.category, subcategory: r.subcategory, assignments: {} });
    scopes.get(k)!.assignments[r.col] = r.email;
  }
  const scopeList = [...scopes.values()].sort((a, b) =>
    (a.category + a.subcategory).localeCompare(b.category + b.subcategory));

  function startAdd() { setDraft(EMPTY); setEditing(true); setError(null); }
  function startEdit(s: Draft) { setDraft({ ...s, assignments: { ...s.assignments } }); setEditing(true); setError(null); }
  function setAssign(col: string, email: string) { setDraft((d) => ({ ...d, assignments: { ...d.assignments, [col]: email } })); }

  async function save() {
    if (!draft.category.trim()) { setError("Pick a category"); return; }
    setBusy(true); setError(null);
    try {
      await saveDefaults({ pipeline: pipelineId, category: draft.category.trim(), subcategory: draft.subcategory.trim(), assignments: draft.assignments });
      setEditing(false); await load(); onChanged?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }
  async function remove(s: Draft) {
    if (!confirm(`Delete the default set for ${s.category}${s.subcategory ? " › " + s.subcategory : " (whole category)"}?`)) return;
    setBusy(true);
    try { await deleteDefault(pipelineId, s.category, s.subcategory); await load(); onChanged?.(); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Assignment defaults</h2>
        <div className="flex items-center gap-2">
          {/* Own selector only when uncontrolled (parent Team tab controls the system otherwise). */}
          {!system && PIPELINE_LIST.length > 1 && (
            <select className={selectCls} value={pipelineId} onChange={(e) => { setOwnPipelineId(e.target.value); setEditing(false); }}>
              {PIPELINE_LIST.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <Button size="sm" onClick={startAdd} disabled={editing}><Plus className="size-4" /> Add default set</Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Pre-fill assignees + reviewers for new cards by <strong className="font-medium text-foreground">category × subcategory</strong>. A set for an exact
        combination wins; leave subcategory blank to apply to the whole category. Only blank fields are filled — manual picks are never overwritten.
      </p>

      {error && <div className="text-sm font-medium text-destructive">{error}</div>}

      {editing && (
        <div className="space-y-3 rounded-[10px] border border-border bg-muted/30 p-4 shadow-xs">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground/80">Category</label>
            <ComboSelect id="def-cat" value={draft.category} options={categoryOptions} placeholder="New category…"
              onChange={(v) => setDraft((d) => ({ ...d, category: v }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground/80">Subcategory</label>
            <ComboSelect id="def-sub" value={draft.subcategory} options={subcategoryOptions} placeholder="New subcategory…"
              onChange={(v) => setDraft((d) => ({ ...d, subcategory: v }))} />
          </div>
          <p className="text-[11px] text-muted-foreground">Leave subcategory as “— None —” to default the whole category.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {cols.map((col) => {
              const role = colRole(col);
              const people = peopleFor(role);
              const val = draft.assignments[col] ?? "";
              return (
                <div className="space-y-1" key={col}>
                  <label className="text-xs font-medium text-foreground/80">{fieldLabel(col)}</label>
                  <select value={val} className={inputCls} onChange={(e) => setAssign(col, e.target.value)}>
                    <option value="">— None —</option>
                    {val && !people.includes(val) && <option value={val}>{personLabel(val, names, memberRoles)}</option>}
                    {people.map((email) => <option key={email} value={email}>{personLabel(email, names, memberRoles)}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
          <div className="text-sm text-muted-foreground" data-testid="defaults-draft-preview">
            A new video here starts with: {cols.map((col) => {
              const email = draft.assignments[col];
              const label = fieldLabel(col).toLowerCase();
              if (email) return `${names[email.toLowerCase()] ?? email} (${label})`;
              return `no default (${label})`;
            }).join(", ")}
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save set"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : scopeList.length === 0 && !editing ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">No default sets yet — add one to auto-assign new cards.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {scopeList.map((s) => (
            <div key={scopeKey(s.category, s.subcategory)} className="flex flex-col gap-2 rounded-[10px] border border-border bg-card p-4 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-[16px] font-semibold leading-snug tracking-tight text-foreground">
                    {s.category}{s.subcategory ? ` › ${s.subcategory}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.subcategory ? "Specific subcategory" : "Whole category"}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(s)} disabled={busy}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => void remove(s)} disabled={busy}>Delete</Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground" data-testid="defaults-set-preview">
                A new video here starts with: {cols.map((col) => {
                  const email = s.assignments[col];
                  const label = fieldLabel(col).toLowerCase();
                  if (email) return `${names[email.toLowerCase()] ?? email} (${label})`;
                  return `no default (${label})`;
                }).join(", ")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
