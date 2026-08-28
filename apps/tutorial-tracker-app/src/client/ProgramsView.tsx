import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { creditWarnings } from "../worker/linkhealth";
import { APPROVAL_LABELS, networkLabel } from "../worker/programs";
import type { ApprovalStatus, Kind, ProgramRow } from "../worker/programs";

/**
 * The Programs table: the affiliate/external catalogue that replaced the Google
 * Sheet. Extracted from LinksTab so search, filtering and sorting have somewhere
 * readable to live.
 *
 * The "Affiliate code" column is the point of this whole screen. A link can
 * return HTTP 200 and still earn nothing — on 2026-08-28 an audit found bookbolt
 * resolving to a bare `bookbolt.io/`, dropping the affiliate id `6671`. That
 * column is the at-a-glance answer to "will this actually pay me?", which is why
 * each value carries an explanation rather than a bare word.
 */

/** What the Affiliate code column shows, and what each value means on hover. */
interface CreditCell {
  label: string;
  className: string;
  title: string;
}

export function creditCell(program: ProgramRow): CreditCell {
  if (!program.target_url) {
    return {
      label: "no link yet",
      className: "text-muted-foreground",
      title: "No destination saved, so this programme cannot be published in a video.",
    };
  }
  if (program.kind === "external") {
    return {
      label: "not expected",
      className: "text-muted-foreground",
      title:
        "This tool has no affiliate programme, so a plain homepage is the correct destination. Nothing to earn, nothing to check.",
    };
  }

  const missing = creditWarnings(program.target_url, program.kind).some(
    (w) => w.code === "no_credit_marker",
  );
  if (missing) {
    return {
      label: "no code found",
      className: "text-amber-700 dark:text-amber-400",
      title:
        "No affiliate code found in this link. It may still pay through a code in the path, but this is the exact shape of a link that earns nothing. Worth opening your affiliate dashboard and comparing.",
    };
  }

  // Show the actual code when it is a query parameter — the most useful form,
  // because you can compare it against your affiliate dashboard at a glance.
  try {
    const search = new URL(program.target_url).search;
    const match = search.match(
      /[?&](via|ref|referral|referrer|fpr|fp_ref|aff|aff_id|affiliate|sca_ref|invite|tag|_r)=([^&]+)/i,
    );
    if (match) {
      return {
        label: `${match[1]}=${match[2]}`,
        className: "text-emerald-700 dark:text-emerald-400",
        title: `Your affiliate code is in the link as "${match[1]}=${match[2]}". This is what tells the programme the sale came from you.`,
      };
    }
  } catch {
    // Unparseable URLs are caught by validation before saving; fall through.
  }

  return {
    label: "tracked by network",
    className: "text-emerald-700 dark:text-emerald-400",
    title:
      "No code in the address bar, but the link goes through an affiliate network (Impact, PartnerStack, Rewardful and similar) or carries a code in its path. The network does the tracking, so this earns normally.",
  };
}

type SortCol = "name" | "kind" | "destination" | "credit" | "coupon" | "approval" | "checked";
interface SortState { col: SortCol; dir: "asc" | "desc" }
type TypeFilter = "all" | Kind;
type HealthFilter = "all" | "earning" | "no-code" | "no-link" | "attention";

/**
 * Column order, and which ones sort. Header-click sorting matches the All videos
 * board (PipelineBoard) on purpose — the owner asked for one consistent pattern
 * rather than a dropdown here and headers there.
 */
/** Verbatim from Filters.tsx so the two filter panels match exactly. */
const selectCls = "h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

const COLUMNS: { col: SortCol | null; label: string }[] = [
  { col: "name", label: "Program" },
  { col: "kind", label: "Type" },
  { col: "destination", label: "Destination" },
  { col: "credit", label: "Affiliate code" },
  { col: "coupon", label: "Coupon" },
  { col: "approval", label: "Approval" },
  { col: "checked", label: "Last checked" },
  { col: null, label: "" },
];

export interface ProgramsViewProps {
  programs: ProgramRow[];
  loading: boolean;
  error: { message: string; status?: number } | null;
  importResult: string | null;
  onAdd: (kind: Kind) => void;
  onEdit: (program: ProgramRow) => void;
  onDelete: (program: ProgramRow) => void;
  onImport: () => void;
  onRetry: () => void;
}

export function ProgramsView({
  programs, loading, error, importResult,
  onAdd, onEdit, onDelete, onImport, onRetry,
}: ProgramsViewProps) {
  const [query, setQuery] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [health, setHealth] = useState<HealthFilter>("all");
  const [sort, setSort] = useState<SortState | null>({ col: "name", dir: "asc" });

  // Same semantics as PipelineBoard: re-clicking a column flips direction; a new
  // column starts ascending for text, descending for "most recent" style data.
  function toggleSort(col: SortCol) {
    setSort((prev) => prev?.col === col
      ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { col, dir: col === "checked" ? "desc" : "asc" });
  }
  const caret = (col: SortCol) => sort?.col === col
    ? (sort.dir === "asc" ? <ArrowUp className="inline size-3" /> : <ArrowDown className="inline size-3" />)
    : null;
  const ariaSort = (col: SortCol): "ascending" | "descending" | "none" =>
    sort?.col === col ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
  const headCls = "text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground";

  const unavailable = !!error && error.status !== 403;

  // Precompute the credit cell once per program: sorting and filtering both need it.
  const decorated = useMemo(
    () => programs.map((p) => ({ program: p, credit: creditCell(p) })),
    [programs],
  );

  const counts = useMemo(() => {
    let earning = 0, noCode = 0, noLink = 0, attention = 0;
    for (const { program, credit } of decorated) {
      if (!program.target_url) noLink++;
      else if (program.kind === "external") earning++;
      else if (credit.label === "no code found") noCode++;
      else earning++;
      if (program.last_status === "no_credit" || program.last_status === "dead") attention++;
    }
    return { all: decorated.length, earning, noCode, noLink, attention };
  }, [decorated]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = decorated.filter(({ program, credit }) => {
      if (typeFilter !== "all" && program.kind !== typeFilter) return false;
      if (health === "no-link" && program.target_url) return false;
      if (health === "no-code" && credit.label !== "no code found") return false;
      if (health === "earning" && (credit.label === "no code found" || !program.target_url)) return false;
      if (health === "attention" &&
          program.last_status !== "no_credit" && program.last_status !== "dead") return false;
      if (!q) return true;
      return (
        program.name.toLowerCase().includes(q) ||
        program.slug.toLowerCase().includes(q) ||
        program.target_url.toLowerCase().includes(q) ||
        program.coupon_code.toLowerCase().includes(q) ||
        networkLabel(program.network).toLowerCase().includes(q)
      );
    });
    if (!sort) return list;
    const dir = sort.dir === "asc" ? 1 : -1;
    const byName = (a: typeof list[number], b: typeof list[number]) =>
      a.program.name.localeCompare(b.program.name, undefined, { sensitivity: "base" });
    list = [...list].sort((a, b) => {
      switch (sort.col) {
        case "kind":
          return dir * (a.program.kind.localeCompare(b.program.kind) || byName(a, b));
        case "destination":
          return dir * (a.program.target_url.localeCompare(b.program.target_url) || byName(a, b));
        case "credit":
          return dir * (a.credit.label.localeCompare(b.credit.label) || byName(a, b));
        case "coupon":
          return dir * (a.program.coupon_code.localeCompare(b.program.coupon_code) || byName(a, b));
        case "approval":
          return dir * ((APPROVAL_LABELS[a.program.approval_status as ApprovalStatus] ?? "")
            .localeCompare(APPROVAL_LABELS[b.program.approval_status as ApprovalStatus] ?? "") || byName(a, b));
        case "checked":
          // Never-checked counts as 0, so it groups at one end rather than scattering.
          return dir * ((a.program.last_checked_at ?? 0) - (b.program.last_checked_at ?? 0) || byName(a, b));
        default:
          return dir * byName(a, b);
      }
    });
    return list;
  }, [decorated, query, typeFilter, health, sort]);

  const hasPrecise = typeFilter !== "all" || health !== "all";
  const hasFilters = hasPrecise || query.trim() !== "";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Programs</h2>
          <p className="text-sm text-muted-foreground">
            Validated affiliate and external destinations. This replaced the Google Sheet.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={unavailable || error?.status === 403}
            title={unavailable ? "Programs could not load" : "A tool with no affiliate programme"}
            onClick={() => onAdd("external")}
          >
            Add external
          </Button>
          <Button
            disabled={unavailable || error?.status === 403}
            title={unavailable ? "Programs could not load" : "A tool that pays you commission"}
            onClick={() => onAdd("affiliate")}
          >
            <Plus /> Add affiliate
          </Button>
        </div>
      </div>

      {/* What the Affiliate code column is telling you. Without this the values
          read as jargon — the owner asked outright what they meant. */}
      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Affiliate code</span> answers &ldquo;will
        this link actually pay me?&rdquo;{" "}
        <span className="text-emerald-700 dark:text-emerald-400">via=abc123</span> is your code,
        visible in the link.{" "}
        <span className="text-emerald-700 dark:text-emerald-400">tracked by network</span> means an
        affiliate network does the tracking instead.{" "}
        <span className="text-amber-700 dark:text-amber-400">no code found</span> means nothing
        identifies you &mdash; the shape of a link that earns nothing. Hover any value for detail.
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading programs…</p>
      ) : error?.status === 403 ? (
        <p className="text-sm text-destructive">You need the Admin role to manage links.</p>
      ) : error ? (
        <div className="flex items-center gap-3 text-sm text-destructive">
          <span>{error.message}</span>
          <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>
        </div>
      ) : programs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6">
          <p className="text-sm text-muted-foreground">No programs yet.</p>
          <Button className="mt-3" variant="outline" onClick={onImport}>
            Import from the old sheet
          </Button>
          {importResult && <p className="mt-3 text-sm text-foreground">{importResult}</p>}
        </div>
      ) : (
        <>
          {/* Deliberately identical in shape to Filters.tsx on the All videos tab:
              search left, "N shown" + More filters + Clear right, and the
              precise controls hidden behind More filters. The owner asked for one
              consistent pattern rather than a wall of chips here. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              id="p-q"
              type="search"
              placeholder="Search name, link, coupon…"
              aria-label="Search programs"
              className="h-8 w-[240px] bg-transparent text-xs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground" data-testid="program-count">
                {shown.length} shown
              </span>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                aria-expanded={showMore}
                className={cn("h-8 gap-1.5", hasPrecise && "text-foreground")}
                onClick={() => setShowMore((o) => !o)}
              >
                <SlidersHorizontal className="size-3.5" /> More filters
              </Button>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="h-8"
                  onClick={() => { setQuery(""); setTypeFilter("all"); setHealth("all"); }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {(showMore || hasPrecise) && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground" htmlFor="p-type">Type</label>
                <select id="p-type" className={selectCls} value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
                  <option value="all">All {counts.all}</option>
                  <option value="affiliate">Affiliate</option>
                  <option value="external">External</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground" htmlFor="p-state">State</label>
                <select id="p-state" className={selectCls} value={health}
                  onChange={(e) => setHealth(e.target.value as HealthFilter)}>
                  <option value="all">Any state</option>
                  <option value="earning">Earning {counts.earning}</option>
                  <option value="no-code">No code {counts.noCode}</option>
                  <option value="no-link">No link {counts.noLink}</option>
                  {counts.attention > 0 && <option value="attention">Needs attention {counts.attention}</option>}
                </select>
              </div>
            </div>
          )}

          {shown.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              No programs match those filters.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => { setQuery(""); setTypeFilter("all"); setHealth("all"); }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50 text-left">
                  <tr>
                    {COLUMNS.map(({ col, label }) => (
                      <th className="px-3 py-2" key={label || "actions"} aria-sort={col ? ariaSort(col) : undefined}>
                        {col ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(col)}
                            title={`Sort by ${label}`}
                            className={cn(headCls, "text-left hover:text-foreground")}
                          >
                            {label} {caret(col)}
                          </button>
                        ) : (
                          <span className="sr-only">Actions</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map(({ program: p, credit }) => {
                    const tint =
                      p.last_status === "no_credit" || p.last_status === "dead"
                        ? "bg-destructive/5"
                        : p.last_status === "unverifiable"
                          ? "bg-warning/10"
                          : "";
                    return (
                      <tr className={tint} key={p.slug}>
                        <td className="px-3 py-3 font-medium">
                          {p.name}
                          <span className="ml-2 font-mono text-[11px] text-muted-foreground">{p.slug}</span>
                        </td>
                        <td className="px-3 py-3 capitalize text-muted-foreground">{p.kind}</td>
                        <td className="max-w-48 px-3 py-3 break-all text-xs">{p.target_url || "—"}</td>
                        <td className={`px-3 py-3 ${credit.className}`} title={credit.title}>
                          {credit.label}
                        </td>
                        <td className="px-3 py-3">{p.coupon_code || "—"}</td>
                        <td className="px-3 py-3">
                          {p.kind === "external"
                            ? "—"
                            : (APPROVAL_LABELS[p.approval_status as ApprovalStatus] ?? p.approval_status)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {p.last_checked_at
                            ? new Date(p.last_checked_at * 1000).toLocaleDateString()
                            : "not yet"}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1">
                            <Button size="xs" variant="outline" onClick={() => onEdit(p)}>Edit</Button>
                            <Button size="xs" variant="ghost" className="text-destructive" onClick={() => onDelete(p)}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Showing {shown.length} of {programs.length}.
          </p>
        </>
      )}
    </section>
  );
}
