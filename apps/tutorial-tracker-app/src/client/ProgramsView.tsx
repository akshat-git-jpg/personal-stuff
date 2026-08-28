import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type SortKey = "name" | "kind" | "credit" | "approval" | "checked";
type TypeFilter = "all" | Kind;
type HealthFilter = "all" | "earning" | "no-code" | "no-link" | "attention";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "kind", label: "Type" },
  { key: "credit", label: "Affiliate code" },
  { key: "approval", label: "Approval" },
  { key: "checked", label: "Last checked" },
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
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [health, setHealth] = useState<HealthFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [desc, setDesc] = useState(false);

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
    const dir = desc ? -1 : 1;
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "kind":
          return dir * (a.program.kind.localeCompare(b.program.kind) ||
                        a.program.name.localeCompare(b.program.name));
        case "credit":
          return dir * (a.credit.label.localeCompare(b.credit.label) ||
                        a.program.name.localeCompare(b.program.name));
        case "approval":
          return dir * ((APPROVAL_LABELS[a.program.approval_status as ApprovalStatus] ?? "")
            .localeCompare(APPROVAL_LABELS[b.program.approval_status as ApprovalStatus] ?? "") ||
            a.program.name.localeCompare(b.program.name));
        case "checked":
          // Never-checked sorts last on ascending, so the stale ones surface.
          return dir * ((a.program.last_checked_at ?? 0) - (b.program.last_checked_at ?? 0));
        default:
          return dir * a.program.name.localeCompare(b.program.name, undefined, { sensitivity: "base" });
      }
    });
    return list;
  }, [decorated, query, typeFilter, health, sort, desc]);

  const chip = (active: boolean) =>
    `h-8 rounded-full px-3 text-xs font-medium transition-colors ${
      active
        ? "bg-foreground text-background"
        : "border border-border bg-card text-muted-foreground hover:text-foreground"
    }`;

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
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-8 w-64"
              placeholder="Search name, link, coupon or network…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search programs"
            />
            <div className="flex gap-1" role="group" aria-label="Filter by type">
              <button type="button" className={chip(typeFilter === "all")} onClick={() => setTypeFilter("all")}>
                All {counts.all}
              </button>
              <button type="button" className={chip(typeFilter === "affiliate")} onClick={() => setTypeFilter("affiliate")}>
                Affiliate
              </button>
              <button type="button" className={chip(typeFilter === "external")} onClick={() => setTypeFilter("external")}>
                External
              </button>
            </div>
            <div className="flex gap-1" role="group" aria-label="Filter by health">
              <button type="button" className={chip(health === "all")} onClick={() => setHealth("all")}>
                Any state
              </button>
              <button type="button" className={chip(health === "earning")} onClick={() => setHealth("earning")}
                title="Has a destination and something identifying you">
                Earning {counts.earning}
              </button>
              <button type="button" className={chip(health === "no-code")} onClick={() => setHealth("no-code")}
                title="Affiliate programme whose link carries no code">
                No code {counts.noCode}
              </button>
              <button type="button" className={chip(health === "no-link")} onClick={() => setHealth("no-link")}
                title="No destination saved yet, so it cannot be published">
                No link {counts.noLink}
              </button>
              {counts.attention > 0 && (
                <button type="button" className={chip(health === "attention")} onClick={() => setHealth("attention")}
                  title="The guard's last check found this earning nothing or dead">
                  Needs attention {counts.attention}
                </button>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Sort</span>
              <select
                className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort programs by"
              >
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <button
                type="button"
                className={chip(false)}
                onClick={() => setDesc((d) => !d)}
                title={desc ? "Descending — click for ascending" : "Ascending — click for descending"}
                aria-label="Toggle sort direction"
              >
                {desc ? "↓" : "↑"}
              </button>
            </div>
          </div>

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
                <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    {["Program", "Type", "Destination", "Affiliate code", "Coupon", "Approval", "Last checked", ""].map((h) => (
                      <th className="px-3 py-2 font-medium" key={h}>{h}</th>
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
