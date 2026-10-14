// Shared money maths and labels. One place decides what "spent" means, so the
// Overview, Transactions and Cards pages can never disagree about a total.

import type { Row, Source, TagNode } from "./api";

export const SOURCES: Record<Source, { label: string; short: string; color: string }> = {
  sbi: { label: "SBI savings", short: "SBI savings", color: "var(--src-sbi)" },
  sbic: { label: "SBI Card", short: "SBI Card", color: "var(--src-sbic)" },
  neu: { label: "Tata Neu Infinity", short: "Tata Neu", color: "var(--src-neu)" },
  icici: { label: "Amazon Pay ICICI", short: "Amazon ICICI", color: "var(--src-icici)" },
};

/** The tag tree, indexed both ways. Children are sorted by name. */
export interface Tree { byId: Map<string, TagNode>; kids: Map<string | null, TagNode[]> }

export function makeTree(tags: TagNode[]): Tree {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const kids = new Map<string | null, TagNode[]>();
  for (const t of tags) {
    const p = t.parent_id && byId.has(t.parent_id) ? t.parent_id : null;
    kids.set(p, [...(kids.get(p) ?? []), t]);
  }
  for (const l of kids.values()) l.sort((a, b) => a.name.localeCompare(b.name));
  return { byId, kids };
}

/** The tags from the top down to `id`. */
export function chain(tree: Tree, id: string | null | undefined): TagNode[] {
  const out: TagNode[] = [];
  for (let t = id ? tree.byId.get(id) : undefined; t && out.length < 50; t = t.parent_id ? tree.byId.get(t.parent_id) : undefined) out.unshift(t);
  return out;
}

export const namesOf = (tree: Tree, id: string | null | undefined) => chain(tree, id).map((t) => t.name);

/** `id` and every tag below it. */
export function within(tree: Tree, id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const x = stack.pop()!;
    if (out.has(x)) continue;
    out.add(x);
    for (const k of tree.kids.get(x) ?? []) stack.push(k.id);
  }
  return out;
}

/** Where tagging a trip payment should start: that trip's tag. */
export const tripTag = (tags: TagNode[], label?: string) => (label ? tags.find((t) => t.key === `trip/${label}`)?.id ?? null : null);

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const rs = (n: number, paise = false) =>
  "₹" + Math.abs(n).toLocaleString("en-IN", {
    minimumFractionDigits: paise && n % 1 ? 2 : 0, maximumFractionDigits: paise ? 2 : 0,
  });

export const dayLabel = (iso: string) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;
export const monthLabel = (ym: string) => `${MONTHS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
export const monthOf = (iso: string) => iso.slice(0, 7);

/** Money that left and counts as spending. Card bills and card-side payments never do. */
export const isSpend = (r: Row) => r.kind === "spend" && r.amount !== null && r.amount < 0;
/** Money that came in: salary, interest, other credits, refunds. A loan to you is not income. */
export const isIn = (r: Row) => (r.kind === "in" || r.kind === "refund") && r.amount !== null && r.amount > 0 && r.tags[0] !== "loan";

/** Compact rupees for tight spots: ₹1.4L, ₹12k, ₹850. */
export const rsShort = (n: number) => {
  const a = Math.abs(n);
  return a >= 1e5 ? `₹${(a / 1e5).toFixed(a >= 1e6 ? 0 : 1).replace(/\.0$/, "")}L` : a >= 1e3 ? `₹${Math.round(a / 1e3)}k` : rs(a);
};

export function totals(rows: Row[]) {
  let spent = 0, inn = 0, needs = 0, needsN = 0, fxOnly = 0;
  for (const r of rows) {
    if (r.amount === null) { if (r.kind === "spend") fxOnly++; continue; }
    if (isSpend(r)) {
      spent -= r.amount;
      if (r.status === "needs") { needs -= r.amount; needsN++; }
    } else if (isIn(r)) inn += r.amount;
  }
  return { spent, inn, needs, needsN, fxOnly };
}

/** The tag a row is counted under in "where it went". Untagged money stays apart. */
export const mainTag = (r: Row) => (r.status === "needs" || !r.tags.length ? "needs you" : r.tags[0]);

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const todayIso = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

/** Hash route: "#/transactions?tag=food&month=2026-09". */
export function parseHash(h: string): { page: string; params: URLSearchParams } {
  const [path, q] = h.replace(/^#\/?/, "").split("?");
  return { page: path || "overview", params: new URLSearchParams(q ?? "") };
}

export type SortKey = "date" | "source" | "what" | "tag" | "status" | "amount";
export type Sort = { key: SortKey; desc: boolean };

/** Amount sorts by size, so the biggest money is first whether it went out or came in. */
export function sortRows(rows: Row[], { key, desc }: Sort): Row[] {
  const v = (r: Row): string | number => {
    switch (key) {
      case "date": return r.date + (r.time ?? "");
      case "source": return SOURCES[r.source].short;
      case "what": return (r.desc ?? r.payee).toLowerCase();
      case "tag": return r.tags.join("/") || "~";
      case "status": return r.status;
      case "amount": return Math.abs(r.amount ?? 0);
    }
  };
  return [...rows].sort((a, b) => {
    const x = v(a), y = v(b);
    const c = typeof x === "number" ? x - (y as number) : x.localeCompare(y as string);
    return desc ? -c : c;
  });
}

/** Click a column once to sort by it; click it again to flip the order. Dates and amounts start biggest first. */
export const nextSort = (s: Sort, key: SortKey): Sort =>
  s.key === key ? { key, desc: !s.desc } : { key, desc: key === "date" || key === "amount" };
