<!-- boss frontmatter -->
---
executor: codex
model: gpt-5.6-terra
test_cmd: cd apps/tutorial-tracker-app && npm test
ui: true
deploy:
needs: ["255, 256 and 257 must land first"]
needs_prs: [216, 217, 218]
touches: [apps/tutorial-tracker-app/src/worker/linkguard.ts, apps/tutorial-tracker-app/src/worker/linkprobe.ts, apps/tutorial-tracker-app/src/worker/notify-telegram.ts, apps/tutorial-tracker-app/src/worker/index.ts, apps/tutorial-tracker-app/src/client/LinkHealth.tsx, apps/tutorial-tracker-app/src/client/LinksTab.tsx, apps/tutorial-tracker-app/wrangler.toml, apps/tutorial-tracker-app/migrations/0006_link_checks.sql, apps/tutorial-tracker-app/test/linkguard.test.ts, apps/tutorial-tracker-app/test/linkprobe.test.ts, apps/tutorial-tracker-app/test/link-health-ui.test.tsx]

# --- Mutation gate. This plan ADDS the guard's checks, so boss must prove they can fire.
mutation_apply: perl -0pi -e 's/return issues;\n\}/return [];\n}/' apps/tutorial-tracker-app/src/worker/linkguard.ts
mutation_command: npm test
mutation_expect: LINKGUARD_GATE
mutation_cwd: apps/tutorial-tracker-app
mutation_timeout: 600
---

# Plan 258: the link guard — cron, Health view, Telegram

## Summary

- **Problem statement**: The 2026-08-28 audit found 6 links serving a crash page
  and 2 more returning HTTP 200 while earning nothing. All of it was invisible:
  the owner learned about the crash from a viewer's screenshot, and about the lost
  commission only because a one-off script was written that day. Nothing watches
  these 134 links.
- **Goals**:
  - **Daily** structural checks that read only our own records — no requests to
    any affiliate network, no cost, no click inflation.
  - **Weekly** chain probe that follows each link to its end and compares against
    last week, so a programme quietly ending is caught in days not quarters.
  - **Monthly** list of the links no robot can verify.
  - A **Health** sub-view showing all of it, and a Telegram message when something
    is newly wrong.
- **Decisions confirmed** (owner, this session):
  - Telegram from the Worker via the Bot API directly (a Worker cannot run the
    local `notify` CLI)
  - The guard may write its own snapshot rows in D1 — `decisions.md:179`
    read-only rule governs *agent* runs, and this is deterministic code
  - Weekly, not daily, for the chain probe — daily would add ~4,000 clicks a
    month to the networks' dashboards with zero sales
  - Bot-blocked sites: **try once, then auto-mark unverifiable** and list monthly
  - The guard must NEVER touch the owner's click analytics
  - No AI/LLM anywhere in this feature
- **Executor proposed**: `codex` / `gpt-5.6-terra` (owner instruction 2026-08-28:
  every plan in this batch runs on codex terra). Escalate to `gpt-5.6-sol` only
  if this plan fails a round on terra (`tooling/boss/data/rules.md` line 22).
- **Done criteria**: `npm test` green with all three new suites present and
  executed; the mutation recipe proves the checks can fail; no request the guard
  makes targets `go.agrolloo.com`; nothing writes to `clicks`; screenshot committed
- **Stop conditions**: the guard would request a `go.agrolloo.com` URL; anything
  would write to `clicks`; the probe would run on the daily schedule
- **Test / verification for success**: pure unit tests over the check functions
  with a fixture set built from the real audit data, an injected fetch for the
  probe, a test proving `assertNotOwnShortLink` throws, and the armed mutation
  recipe that proves the checks can fail
- **Open points for plan readiness**: none

## Executor instructions

**Drift check — run this FIRST:**

```bash
git diff --stat 3e730698..HEAD -- apps/tutorial-tracker-app/
```

`src/worker/programs.ts`, `src/worker/catalog.ts`, `src/client/LinksTab.tsx` and
`src/client/TrackingLinks.tsx` MUST exist (plans 255-257). If any is missing,
STOP.

**Before you write the mutation-gate test, DRY-RUN the recipe in the frontmatter.**
Plan 175's recipe was wrong and nobody noticed because nothing executed it. Run
`mutation_apply`, confirm `npm test` fails printing `LINKGUARD_GATE`, then
`git checkout -- src/worker/linkguard.ts` and confirm it passes again.

## Status

- **Priority**: high
- **Effort**: large
- **Risk**: medium (a cron that makes outbound requests; the analytics table is
  adjacent)
- **Depends on**: plans 255, 256, 257
- **Category**: feature
- **Planned-at SHA**: `3e730698`
- **Difficulty**: standard

## Why this matters

The owner's framing: *"even if the link is working, but it's not redirecting me to
the actual my affiliate link. Basically, if it's redirecting the users to the home
page, that's also an issue."* That is the failure class no error page reveals.

Real examples from the audit, which this guard must catch:

| Program | Stored | Actually lands on | Why it earns nothing |
|---|---|---|---|
| `bookbolt` | `https://bookbolt.io/6671.html` | `https://bookbolt.io/` after 3 hops | the affiliate id `6671` is stripped |
| `skool` | (hidden sheet link) | `affiliate.gohighlevel.com/home` | wrong company, and a dashboard page |
| `filmora` | `https://agrolloo.com/filmora` | `https://filmora.wondershare.net/` | no tracking parameter survives |

None of these returns an error. All three return HTTP 200.

## Current state

### What already exists that you must reuse

`src/worker/linkhealth.ts` (landed `6349fa5b`) — the credit rules. **Import it;
do not write a second set of regexes.**

```ts
export function normalizeTargetUrl(raw: string | null | undefined): NormalizedUrl | null
export function creditWarnings(url: string, kind: LinkKind, repaired?: boolean): LinkWarning[]
// warning codes: "no_credit_marker" | "points_at_dashboard" | "own_redirect_layer"
//                | "wrapped_redirect" | "scheme_added"
```

`src/worker/programs.ts` (plan 255) — `listPrograms`, `ProgramRow`. The five
guard columns this plan owns and nothing else may write:

```
probe_enabled INTEGER NOT NULL DEFAULT 1
last_checked_at INTEGER, last_status TEXT,
last_final_url TEXT, previous_final_url TEXT
```

`src/worker/clickstore.ts` (plan 257) — `allLinks`, `clickCounts`. **Read only.**

### The cron exemplar

`apps/founders-tracker/src/worker/index.ts:111` is the pattern to follow:

```ts
async scheduled(_event: ScheduledController, env: Env): Promise<void> {
```

The tracker's `wrangler.toml` has **no** `[triggers]` block yet. You add one.

### Conventions to match

- **Exemplar worker module**: `src/worker/clickstore.ts` — small exported async
  functions, `db` first, no classes.
- **Exemplar pure-logic module + tests**: `src/worker/linkhealth.ts` with
  `apps/redirector/test/url.test.ts`.
- **`erasableSyntaxOnly` is ON**: no TS `enum`, no constructor parameter properties.
- Design reference (owner-approved 2026-08-28):
  `https://claude.ai/code/artifact/ef5c97da-f174-4dd6-8c51-a13a60d6d45d`,
  artboard `Health` — including the Telegram message shape.

## Commands you will need

```bash
cd apps/tutorial-tracker-app
npm install
npm test               # THE MERGE GATE
npm run typecheck      # exit 0
npm run build
npx wrangler d1 execute tracker-db --local --file=migrations/0006_link_checks.sql

# trigger the cron locally (wrangler exposes a scheduled endpoint in dev)
npm run dev
curl "http://localhost:5173/__scheduled?cron=30+0+*+*+*"
```

Baseline after plan 257: `Test Files  16 passed`, `Tests >= 318`.

## Scope

**In scope:**

- `migrations/0006_link_checks.sql` (new — the run-history table)
- `src/worker/linkguard.ts` (new — the structural checks, pure)
- `src/worker/linkprobe.ts` (new — the chain probe, fetch injected)
- `src/worker/notify-telegram.ts` (new — the Bot API call)
- `src/worker/index.ts` (add the `scheduled` handler + two endpoints)
- `src/client/LinkHealth.tsx` (new)
- `src/client/LinksTab.tsx` (replace the Health shell)
- `wrangler.toml` (add `[triggers]`)
- `test/linkguard.test.ts`, `test/linkprobe.test.ts`, `test/link-health-ui.test.tsx` (new)

**Out of scope:**

- `src/worker/linkhealth.ts` — import only. It is the credit-rule authority.
- `src/worker/linkgen.ts`, `catalog.ts`, `programs.ts` — read only.
- `apps/redirector/**` — the only writer to `clicks`.
- The `clicks` table — SELECT only, always.
- `src/client/TrackingLinks.tsx` — except to enable its two disabled buttons
  (`Re-check all now`, `Export CSV`), which is the ONE change allowed there.

## Steps

### Step 1 — the run-history table

Create `migrations/0006_link_checks.sql`:

```sql
-- One row per guard run, so the Health view can show when the guard last ran and
-- what it found. Week-over-week comparison itself uses programs.previous_final_url;
-- this table is the audit trail, not the comparison state.
--
-- The guard writes ONLY this table and the five guard columns on programs. It
-- never touches the clicks table: those are the owner's real analytics, written
-- exclusively by the redirector on a genuine visit.

CREATE TABLE IF NOT EXISTS link_checks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at       INTEGER NOT NULL,
  -- 'structural' (daily, no outbound requests) | 'chain' (weekly, follows links)
  -- | 'manual' (an admin pressed Re-check now)
  kind         TEXT NOT NULL,
  checked      INTEGER NOT NULL DEFAULT 0,
  ok_count     INTEGER NOT NULL DEFAULT 0,
  issue_count  INTEGER NOT NULL DEFAULT 0,
  unverifiable INTEGER NOT NULL DEFAULT 0,
  -- JSON array of {code, slug, detail}. Small: only issues, never the full set.
  issues_json  TEXT NOT NULL DEFAULT '[]',
  notified     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_link_checks_ran ON link_checks(ran_at DESC);
```

**Verify:**

```bash
npx wrangler d1 execute tracker-db --local --file=migrations/0006_link_checks.sql
npx wrangler d1 execute tracker-db --local --file=migrations/0006_link_checks.sql
npx wrangler d1 execute tracker-db --local --command \
  "SELECT COUNT(*) AS cols FROM pragma_table_info('link_checks')"
#   -> cols = 9
```

### Step 2 — the structural checks (pure; this is the gated code)

Create `src/worker/linkguard.ts`. **These functions make no network requests.**

```ts
/**
 * linkguard.ts
 * The daily structural checks. PURE: no I/O, no fetch, no D1. Given the
 * catalogue and the minted links, it returns everything wrong that can be known
 * without asking the internet.
 *
 * Runs daily because it is free. The expensive part — actually following each
 * link — is the weekly chain probe in linkprobe.ts, kept weekly because
 * following an affiliate link registers a click in that network's dashboard, and
 * ~4,000 clicks a month with no sales reads as fraud.
 */

import { creditWarnings, normalizeTargetUrl } from "./linkhealth";
import type { ProgramRow } from "./programs";

export type IssueCode =
  | "bad_url"              // stored value is not a usable web address
  | "own_redirect_layer"   // points at agrolloo.com, an unverifiable hop
  | "points_at_dashboard"  // our own affiliate dashboard, earns nothing
  | "no_credit_marker"     // affiliate link with no affiliate code in it
  | "approved_no_link"     // approved programme with nothing to publish
  | "duplicate_target"     // two programmes resolving to the same destination
  | "kv_d1_mismatch"       // the redirect and the record disagree
  | "link_without_program" // a live link whose programme no longer exists
  | "unclassified_kind";   // a link minted before the kind column existed

export interface GuardIssue {
  code: IssueCode;
  slug: string;
  detail: string;
}

export interface GuardInput {
  programs: ProgramRow[];
  links: { slug: string; tool: string; target_url: string; kind: string | null }[];
  /** slug -> value currently in CLICKS_KV. */
  kv: Record<string, string>;
}

/**
 * Every structural fault, deterministically ordered (by code then slug) so a
 * diff between two runs is stable.
 */
export function structuralIssues(input: GuardInput): GuardIssue[] {
  const issues: GuardIssue[] = [];
  const { programs, links, kv } = input;

  // --- catalogue-level checks -------------------------------------------------
  const targetOwners = new Map<string, string[]>();

  for (const p of programs) {
    const isAffiliate = p.kind === "affiliate";

    if (!p.target_url) {
      if (isAffiliate && p.approval_status === "approved") {
        issues.push({ code: "approved_no_link", slug: p.slug,
          detail: `${p.name} is approved but has no link, so it can never be published.` });
      }
      continue;
    }

    const norm = normalizeTargetUrl(p.target_url);
    if (!norm) {
      issues.push({ code: "bad_url", slug: p.slug,
        detail: `${p.name}: stored value is not a usable web address (${JSON.stringify(p.target_url.slice(0, 60))}).` });
      continue;
    }

    for (const w of creditWarnings(norm.url, isAffiliate ? "affiliate" : "external")) {
      // "scheme_added" is reported by the redirector's live log, not here.
      if (w.code === "scheme_added") continue;
      issues.push({
        code: w.code as IssueCode,
        slug: p.slug,
        detail: `${p.name}: ${w.message}`,
      });
    }

    // Two programmes must not share a destination. This is the check that would
    // have caught the sheet's Skool row pointing at GoHighLevel.
    const key = norm.url.replace(/\/+$/, "").toLowerCase();
    targetOwners.set(key, [...(targetOwners.get(key) ?? []), p.slug]);
  }

  for (const [target, owners] of targetOwners) {
    if (owners.length > 1) {
      for (const slug of owners.sort()) {
        issues.push({ code: "duplicate_target", slug,
          detail: `Shares its destination (${target}) with: ${owners.filter(o => o !== slug).sort().join(", ")}.` });
      }
    }
  }

  // --- link-level checks -----------------------------------------------------
  const bySlug = new Map(programs.map((p) => [p.slug, p]));

  for (const l of links) {
    if (!bySlug.has(l.tool)) {
      issues.push({ code: "link_without_program", slug: l.slug,
        detail: `Live link points at tool "${l.tool}", which has no programme row.` });
    }
    if (l.kind === null || l.kind === "") {
      issues.push({ code: "unclassified_kind", slug: l.slug,
        detail: `Minted before the kind column existed, so its credit expectation is unknown.` });
    }
    const kvValue = kv[l.slug];
    if (kvValue === undefined) {
      issues.push({ code: "kv_d1_mismatch", slug: l.slug,
        detail: `Recorded in the database but missing from the live redirects — this link 404s.` });
    } else if (kvValue.trim() !== l.target_url.trim()) {
      issues.push({ code: "kv_d1_mismatch", slug: l.slug,
        detail: `Redirect sends visitors to ${kvValue} but the record says ${l.target_url}.` });
    }
  }

  issues.sort((a, b) => (a.code === b.code ? a.slug.localeCompare(b.slug) : a.code.localeCompare(b.code)));
  return issues;
}
```

**Note the exact shape of the final two lines** (`issues.sort(...)` then
`return issues;` then `}`): the mutation recipe in this plan's frontmatter
rewrites `return issues;\n}` to `return [];\n}`. Do not reformat those lines.

**Verify:** create `test/linkguard.test.ts`. **Every test name must contain the
token `LINKGUARD_GATE`** — that is the string boss's mutation gate looks for.

```ts
import { describe, it, expect } from "vitest";
import { structuralIssues } from "../src/worker/linkguard";
import type { ProgramRow } from "../src/worker/programs";

const prog = (over: Partial<ProgramRow> & { slug: string }): ProgramRow => ({
  name: over.slug, kind: "affiliate", target_url: "", network: "other",
  approval_status: "approved", coupon_status: "unknown", coupon_code: "",
  coupon_url: "", coupon_terms: "", dashboard_url: "", dashboard_credentials: "",
  notes: "", probe_enabled: 1, last_checked_at: null, last_status: null,
  last_final_url: null, previous_final_url: null,
  created_at: 0, updated_at: 0, updated_by: "", ...over,
} as ProgramRow);

describe("structuralIssues", () => {
  it("LINKGUARD_GATE flags a scheme-less stored value as bad_url", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "openart", target_url: "not a url at all" })],
      links: [], kv: {},
    });
    expect(issues.map(i => i.code)).toContain("bad_url");
  });

  it("LINKGUARD_GATE flags an affiliate link with no affiliate code", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "bookbolt", target_url: "https://bookbolt.io/" })],
      links: [], kv: {},
    });
    expect(issues.map(i => i.code)).toContain("no_credit_marker");
  });

  it("LINKGUARD_GATE does NOT flag a missing code on an external tool", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "cursor", kind: "external", target_url: "https://cursor.com" })],
      links: [], kv: {},
    });
    expect(issues.map(i => i.code)).not.toContain("no_credit_marker");
  });

  it("LINKGUARD_GATE flags our own agrolloo.com hop", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "filmora", target_url: "https://agrolloo.com/filmora" })],
      links: [], kv: {},
    });
    expect(issues.map(i => i.code)).toContain("own_redirect_layer");
  });

  it("LINKGUARD_GATE flags a link pointing at our own dashboard", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "bookbolt", target_url: "https://affiliate.bookbolt.io/account.php" })],
      links: [], kv: {},
    });
    expect(issues.map(i => i.code)).toContain("points_at_dashboard");
  });

  it("LINKGUARD_GATE flags two programmes sharing a destination", () => {
    const issues = structuralIssues({
      programs: [
        prog({ slug: "skool", target_url: "https://example.com/x?ref=a" }),
        prog({ slug: "gohighlevel", target_url: "https://example.com/x?ref=a" }),
      ], links: [], kv: {},
    });
    const dupes = issues.filter(i => i.code === "duplicate_target");
    expect(dupes).toHaveLength(2);
    expect(dupes[0].detail).toContain("Shares its destination");
  });

  it("LINKGUARD_GATE flags an approved programme with no link", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "clickfunnels", target_url: "", approval_status: "approved" })],
      links: [], kv: {},
    });
    expect(issues.map(i => i.code)).toContain("approved_no_link");
  });

  it("LINKGUARD_GATE does not nag about an unapproved programme with no link", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "wix", target_url: "", approval_status: "rejected" })],
      links: [], kv: {},
    });
    expect(issues).toHaveLength(0);
  });

  it("LINKGUARD_GATE flags a KV/record disagreement", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "openart", target_url: "https://openart.ai/?via=seema" })],
      links: [{ slug: "vcfX/openart", tool: "openart", target_url: "https://openart.ai/?via=seema", kind: "affiliate" }],
      kv: { "vcfX/openart": "https://openart.ai/?via=SOMEONE_ELSE" },
    });
    const m = issues.find(i => i.code === "kv_d1_mismatch");
    expect(m).toBeDefined();
    expect(m!.detail).toContain("SOMEONE_ELSE");
  });

  it("LINKGUARD_GATE flags a link missing from KV entirely", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "openart", target_url: "https://openart.ai/?via=seema" })],
      links: [{ slug: "vcfX/openart", tool: "openart", target_url: "https://openart.ai/?via=seema", kind: "affiliate" }],
      kv: {},
    });
    expect(issues.some(i => i.code === "kv_d1_mismatch" && i.detail.includes("404"))).toBe(true);
  });

  it("LINKGUARD_GATE flags a live link whose programme was deleted", () => {
    const issues = structuralIssues({
      programs: [], links: [{ slug: "abcd/gone", tool: "gone", target_url: "https://x.example/?ref=1", kind: "affiliate" }],
      kv: { "abcd/gone": "https://x.example/?ref=1" },
    });
    expect(issues.map(i => i.code)).toContain("link_without_program");
  });

  it("LINKGUARD_GATE flags a link with no kind recorded", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "t", target_url: "https://t.example/?ref=1" })],
      links: [{ slug: "abcd/t", tool: "t", target_url: "https://t.example/?ref=1", kind: null }],
      kv: { "abcd/t": "https://t.example/?ref=1" },
    });
    expect(issues.map(i => i.code)).toContain("unclassified_kind");
  });

  it("LINKGUARD_GATE returns nothing for a wholly healthy catalogue", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "openart", target_url: "https://openart.ai/home/?via=seema" })],
      links: [{ slug: "vcfX/openart", tool: "openart", target_url: "https://openart.ai/home/?via=seema", kind: "affiliate" }],
      kv: { "vcfX/openart": "https://openart.ai/home/?via=seema" },
    });
    expect(issues).toEqual([]);
  });

  it("LINKGUARD_GATE orders issues stably so two runs can be diffed", () => {
    const input = {
      programs: [prog({ slug: "b", target_url: "bad" }), prog({ slug: "a", target_url: "bad" })],
      links: [], kv: {},
    };
    expect(structuralIssues(input).map(i => i.slug)).toEqual(["a", "b"]);
  });
});
```

Run `npm test`. Expect `Tests >= 332`.

### Step 3 — dry-run the mutation recipe NOW

Before going further, prove the gate can fire:

```bash
cd apps/tutorial-tracker-app
# clean must pass
npm test
# apply
perl -0pi -e 's/return issues;\n\}/return [];\n}/' src/worker/linkguard.ts
# must FAIL, and the output must contain LINKGUARD_GATE
npm test 2>&1 | grep -q LINKGUARD_GATE && echo MUTATION_DETECTED
# revert
git checkout -- src/worker/linkguard.ts
npm test
```

If `MUTATION_DETECTED` does not print, the recipe or the test names are wrong.
**Fix them before continuing** — a gate that cannot fire reads as coverage.

### Step 4 — the chain probe

Create `src/worker/linkprobe.ts`. `fetch` is injected so tests never touch the
network.

```ts
/**
 * linkprobe.ts
 * The weekly chain probe: follow each destination to its end and judge whether
 * the affiliate code survived.
 *
 * HARD RULE: this probes the DESTINATION url only, never a go.agrolloo.com short
 * link. Requesting a short link would write a row to the clicks table and
 * corrupt the owner's real analytics. `assertNotOwnShortLink` enforces it and
 * throws rather than silently skipping.
 */

import { creditWarnings } from "./linkhealth";

export type ProbeStatus = "ok" | "no_credit" | "dead" | "unverifiable";

export interface ProbeResult {
  slug: string;
  status: ProbeStatus;
  httpStatus: number | null;
  finalUrl: string | null;
  detail: string;
}

const SHORT_LINK_HOST = /(^|\.)go\.agrolloo\.com$/i;

/** Throws on a short link. Never returns false — a silent skip would hide a bug. */
export function assertNotOwnShortLink(url: string): void {
  let host: string;
  try { host = new URL(url).hostname; } catch { return; }
  if (SHORT_LINK_HOST.test(host)) {
    throw new Error(
      `linkprobe refuses ${url}: probing our own short links would write to the clicks table and falsify the owner's analytics.`,
    );
  }
}

/** A bot-block, not a broken link. Try once, then mark unverifiable. */
export function isBotBlock(httpStatus: number): boolean {
  return httpStatus === 403 || httpStatus === 429 || httpStatus === 503;
}

export interface ProbeOne {
  slug: string;
  targetUrl: string;
  kind: "affiliate" | "external";
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Pure decision, given an outcome. Separated from the fetch so every branch is
 * unit-testable without a network.
 */
export function judge(item: ProbeOne, httpStatus: number | null, finalUrl: string | null): ProbeResult {
  if (httpStatus === null || finalUrl === null) {
    return { slug: item.slug, status: "unverifiable", httpStatus, finalUrl,
      detail: "The request did not complete, so nothing could be judged." };
  }
  if (isBotBlock(httpStatus)) {
    return { slug: item.slug, status: "unverifiable", httpStatus, finalUrl,
      detail: `The site answered ${httpStatus} to an automated request. Only a person can check this one.` };
  }
  if (httpStatus >= 400) {
    return { slug: item.slug, status: "dead", httpStatus, finalUrl,
      detail: `The destination answered ${httpStatus}.` };
  }
  if (item.kind === "external") {
    return { slug: item.slug, status: "ok", httpStatus, finalUrl,
      detail: "Reachable. No affiliate code expected for an external tool." };
  }
  const lost = creditWarnings(finalUrl, "affiliate")
    .some((w) => w.code === "no_credit_marker");
  if (lost) {
    return { slug: item.slug, status: "no_credit", httpStatus, finalUrl,
      detail: `Loads fine, but the final address carries no affiliate code, so this earns nothing.` };
  }
  return { slug: item.slug, status: "ok", httpStatus, finalUrl,
    detail: "Reachable, and the affiliate code survives to the final address." };
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Follows one destination. Injected fetch; a throw becomes "unverifiable". */
export async function probeOne(item: ProbeOne, doFetch: FetchLike): Promise<ProbeResult> {
  assertNotOwnShortLink(item.targetUrl);
  try {
    const res = await doFetch(item.targetUrl, {
      redirect: "follow",
      headers: { "user-agent": UA },
    });
    return judge(item, res.status, res.url || item.targetUrl);
  } catch (e) {
    return judge(item, null, null);
  }
}

/**
 * Probes a batch with a small concurrency limit — a Worker has a subrequest
 * budget, and hammering an affiliate network looks worse than going slowly.
 */
export async function probeAll(
  items: ProbeOne[], doFetch: FetchLike, concurrency = 4,
): Promise<ProbeResult[]> {
  const out: ProbeResult[] = [];
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, queue.length)) }, async () => {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      out.push(await probeOne(item, doFetch));
    }
  });
  await Promise.all(workers);
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}
```

**Verify:** create `test/linkprobe.test.ts` covering at least:

```
1  assertNotOwnShortLink THROWS on https://go.agrolloo.com/vcfX/openart
2  assertNotOwnShortLink allows a normal destination
3  judge: 200 with ?via= on an affiliate  -> ok
4  judge: 200 bare homepage on an affiliate -> no_credit  (the bookbolt case)
5  judge: 200 bare homepage on an external -> ok          (the cursor case)
6  judge: 404 -> dead
7  judge: 403 -> unverifiable
8  judge: 429 -> unverifiable
9  judge: a thrown fetch -> unverifiable
10 probeOne uses the injected fetch and never the global one
11 probeAll returns one result per item, slug-sorted
12 probeAll with a short link in the batch throws rather than silently skipping
```

### Step 5 — Telegram

Create `src/worker/notify-telegram.ts`:

```ts
/**
 * notify-telegram.ts
 * The Worker cannot run the repo's local `notify` CLI (it reads
 * infra/secrets/telegram.env on a workstation), so it posts to the Bot API
 * directly with Worker secrets.
 *
 * Never throws past itself: a Telegram outage must not fail the guard run.
 */

export interface TelegramEnv {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

export async function sendTelegram(env: TelegramEnv, text: string): Promise<boolean> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chat = env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    console.warn("telegram not configured; message dropped");
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true,
      }),
    });
    if (!res.ok) console.error("telegram send failed", res.status);
    return res.ok;
  } catch (e) {
    console.error("telegram send threw", e);
    return false;
  }
}
```

Add a pure message builder to `linkguard.ts`:

```ts
/**
 * The Telegram body. Returns null when there is nothing worth sending — silence
 * is the default, so a message always means something needs the owner.
 */
export function buildReport(
  issues: GuardIssue[], unverifiable: number, total: number, includeHeartbeat: boolean,
): string | null {
  if (issues.length === 0 && !includeHeartbeat) return null;
  const lines: string[] = [];
  if (issues.length === 0) {
    lines.push(`<b>Link guard</b> — all ${total} links fine`);
    if (unverifiable) lines.push(`${unverifiable} could not be checked (the site blocks robots)`);
  } else {
    lines.push(`<b>Link guard</b> — ${issues.length} need you`);
    const money = issues.filter(i => i.code === "no_credit_marker" || i.code === "points_at_dashboard" || i.code === "bad_url" || i.code === "kv_d1_mismatch");
    const other = issues.filter(i => !money.includes(i));
    if (money.length) {
      lines.push("", "<b>Earning nothing</b>");
      for (const i of money.slice(0, 10)) lines.push(`• ${i.slug} — ${i.detail}`);
    }
    if (other.length) {
      lines.push("", "<b>Worth a look</b>");
      for (const i of other.slice(0, 10)) lines.push(`• ${i.slug} — ${i.detail}`);
    }
    lines.push("", `${total - issues.length} fine · ${unverifiable} need your eyes`);
  }
  lines.push("", "tutorials-tracker.agrolloo.com → Links → Health");
  return lines.join("\n");
}
```

Add tests to `test/linkguard.test.ts` (names must still carry `LINKGUARD_GATE`):

```
LINKGUARD_GATE buildReport returns null when there is nothing to say
LINKGUARD_GATE buildReport sends a heartbeat when asked, even with no issues
LINKGUARD_GATE buildReport puts money issues before the rest
```

### Step 6 — the scheduled handler and the two endpoints

`wrangler.toml` — add a `[triggers]` block. Cloudflare cron is **UTC**; the owner
is IST (UTC+5:30).

```toml
# Cloudflare cron is UTC. 00:30 UTC = 06:00 IST.
[triggers]
crons = [
  "30 0 * * *",   # daily  06:00 IST — structural only, zero outbound requests
  "45 0 * * 0",   # Sunday 06:15 IST — the chain probe, follows every link once
  "0 1 1 * *",    # 1st    06:30 IST — the unverifiable list, for a human to click
]
```

In `src/worker/index.ts`, add the handler. The app currently exports a Hono app;
follow `apps/founders-tracker/src/worker/index.ts:111` for the shape.

```ts
async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  // Which job ran is decided by the cron string, never by the day of week —
  // that keeps the daily job free of outbound requests even on a Sunday.
  if (event.cron === "30 0 * * *") { ctx.waitUntil(runStructural(env)); return; }
  if (event.cron === "45 0 * * 0") { ctx.waitUntil(runChainProbe(env)); return; }
  if (event.cron === "0 1 1 * *")  { ctx.waitUntil(runUnverifiableDigest(env)); return; }
  console.warn("unknown cron", event.cron);
}
```

`runStructural(env)` must: read `listPrograms`, `clickstore.allLinks`, and the KV
values for those slugs; call `structuralIssues`; write one `link_checks` row; and
send `buildReport(issues, unverifiable, total, false)` if non-null. **It must make
no request to any affiliate network.**

`runChainProbe(env)` must: build `ProbeOne[]` from programs where
`probe_enabled = 1` and `target_url` is non-empty; call `probeAll`; for each
result move `last_final_url` into `previous_final_url` and write the new one plus
`last_status` and `last_checked_at`; add a `changed_destination` issue where the
final URL differs from `previous_final_url`; write a `link_checks` row; and send
the report **with the heartbeat flag true** (so a Sunday message always arrives).

`runUnverifiableDigest(env)` must send the list of programs whose `last_status`
is `unverifiable`, and write no program rows.

Two endpoints:

```ts
// GET /api/link-health -> what the Health view renders
app.get("/api/link-health", async (c) => { /* latest link_checks row + the programs' guard columns */ });

// POST /api/link-health/recheck -> the manual "Re-check now", kind='manual'
app.post("/api/link-health/recheck", async (c) => { /* admin-gated; runs the structural pass, and the chain probe only for a single slug if body.slug is given */ });
```

**Verify:**

```bash
npm run typecheck
npm run build
# the guard never targets our own short links — must print 0
grep -rn "go\.agrolloo\.com" src/worker/linkguard.ts src/worker/linkprobe.ts | grep -v "SHORT_LINK_HOST\|refuses\|never" | wc -l
#   -> 0
```

### Step 7 — the Health view

Create `src/client/LinkHealth.tsx`, exporting `LinkHealth`. Follow the `Health`
artboard. Two columns:

**Left — the issues**, grouped under two headings:
`Costing you money now` (codes `no_credit_marker`, `points_at_dashboard`,
`bad_url`, `kv_d1_mismatch`) and `Changed since last week`
(`changed_destination`, `duplicate_target`, `approved_no_link`,
`link_without_program`, `unclassified_kind`). Each issue shows its `detail` and a
`Fix programme` button that opens `ProgramForm` for that slug.

A third block, always present: `N links block robots — only you can check them`,
with an `Open all` action.

**Right — two cards**: `What runs, and when` (the three schedules, in IST, with
the honest note about why the probe is weekly) and `What Telegram sends you` (the
last report text). Plus a short card stating no AI is involved.

Then in `src/client/LinksTab.tsx`, replace the Health shell with `<LinkHealth />`,
and enable `TrackingLinks`' two previously-disabled buttons, wiring
`Re-check all now` to `POST /api/link-health/recheck`.

**Degraded/empty states** (required):

| Condition | Renders | Actions |
|---|---|---|
| no `link_checks` row yet | `The guard has not run yet. It first runs at 06:00 IST.` | `Re-check now` enabled |
| zero issues | `All N links are fine.` + the last-run time | `Re-check now` enabled |
| 403 | `You need the Admin role to see link health.` | none |
| 5xx | error + `Retry` | `Re-check now` disabled, `title` = "Health could not load" |

### Step 8 — component tests and the screenshot

Create `test/link-health-ui.test.tsx` with at least:

```
1  the never-run state names the 06:00 IST first run
2  the all-fine state shows the count and the last-run time
3  a no_credit issue renders under "Costing you money now" with its detail
4  a changed_destination issue renders under "Changed since last week" with was/now
5  the unverifiable block shows the count and an Open all action
6  403 shows the Admin-role line and no Re-check button
7  5xx disables Re-check with the explanatory title
8  Fix programme opens the program form for that slug
```

Screenshot: the Health view with at least one issue in each group. Commit as
`apps/tutorial-tracker-app/docs/screenshots/258-link-health.png`.

## Test plan

| File | Follows | Covers |
|---|---|---|
| `test/linkguard.test.ts` (new) | `test/linkgen.test.ts` | all 9 issue codes + report building; **every name carries `LINKGUARD_GATE`** |
| `test/linkprobe.test.ts` (new) | `apps/redirector/test/url.test.ts` | the 12 cases in Step 4, injected fetch only |
| `test/link-health-ui.test.tsx` (new) | `test/programs-ui.test.tsx` | the 8 cases in Step 8 |

## Done criteria

```bash
cd apps/tutorial-tracker-app

npm test                 # "Test Files  19 passed", Tests >= 360
test -s test/linkguard.test.ts && test -s test/linkprobe.test.ts && test -s test/link-health-ui.test.tsx && echo SUITES_PRESENT
for f in linkguard linkprobe link-health-ui; do npm test 2>&1 | grep -q "$f" || { echo "MISSING RUN: $f"; exit 1; }; done; echo ALL_SUITES_RAN
npm run typecheck        # exit 0
npm run build            # succeeds

# THE ANALYTICS GATE — nothing writes to clicks
grep -rniE "(insert|update|delete)[^;]{0,40}\bclicks\b" src/worker/ src/client/ | grep -v "CLICKS_KV" | wc -l
#   -> 0

# THE PROBE GATE — the guard never requests our own short links
npm test 2>&1 | grep -q "assertNotOwnShortLink" && echo SHORTLINK_GUARD_TESTED

# the three schedules exist
grep -c '"30 0 \* \* \*"' wrangler.toml   # -> 1
grep -c '"45 0 \* \* 0"' wrangler.toml    # -> 1
grep -c '"0 1 1 \* \*"' wrangler.toml     # -> 1

# migration applies twice, clean
npx wrangler d1 execute tracker-db --local --file=migrations/0006_link_checks.sql
npx wrangler d1 execute tracker-db --local --file=migrations/0006_link_checks.sql

test -s docs/screenshots/258-link-health.png && echo SHOT_OK

# FRESH-CHECKOUT RUN (this is the last plan in the batch — LESSONS 2026-07-31)
cd "$(mktemp -d)" && git clone --depth 1 file://$(git -C - rev-parse --show-toplevel 2>/dev/null || echo .) fresh 2>/dev/null || true
# If the clone form above is awkward in your worktree, instead run:
#   git stash list && git clean -xdn apps/tutorial-tracker-app | head
# and then in a pristine copy of the repo: cd apps/tutorial-tracker-app && npm ci && npm test
# The point: the gate must pass without any build artifact your run happened to leave behind.
```

## STOP conditions

- **The guard would request a `go.agrolloo.com` URL.** STOP immediately. That
  writes a row to the owner's analytics. `assertNotOwnShortLink` must throw, not
  skip.
- **Anything would INSERT, UPDATE or DELETE in the `clicks` table.** STOP.
- **The daily job would make an outbound request to an affiliate network.** STOP —
  daily is free-by-design, and the ~4,000-clicks-a-month problem is the whole
  reason the probe is weekly.
- **The mutation recipe does not make `npm test` fail printing `LINKGUARD_GATE`.**
  STOP and fix the recipe or the test names before doing anything else. A gate
  that cannot fire is worse than no gate.
- **A gate assertion fails.** Fix the code or the fixture. Weakening, swapping or
  deleting an assertion is a STOP.
- **You are about to edit `src/worker/linkhealth.ts`.** STOP — import it.
- **A test performs a real network request.** STOP; `fetch` is injected
  everywhere for exactly this reason.
- **A test opens a server or an uncleared timer.** STOP (LESSONS 2026-07-31: the
  runner hangs forever and the failure is invisible).

## Maintenance notes

- **Owner-run after merge**, in this order:
  1. `npx wrangler d1 migrations apply tracker-db --remote`
  2. `npx wrangler secret put TELEGRAM_BOT_TOKEN` and
     `npx wrangler secret put TELEGRAM_CHAT_ID` (values are in
     `infra/secrets/telegram.env`, the same pair the local `notify` CLI uses)
  3. deploy, then trigger a manual `Re-check now` from the Health view and
     confirm a Telegram message arrives
- The `clicks`-write grep and the short-link probe gate are the durable
  protections for the owner's analytics. Never soften either.
- If a network complains about automated clicks, turn `probe_enabled` off for that
  programme in the UI rather than changing the schedule.
- Register the three crons in `VPS-CRONS.md`? **No** — that file documents VPS
  Pattern-B crons. These are Cloudflare Worker crons and belong in `INFRA.md`
  under the `yt-tutorials-tracker` entry. Add them there.
- A reviewer should scrutinise: that `runStructural` truly makes no outbound
  request, and that `previous_final_url` is moved before `last_final_url` is
  overwritten (getting that order wrong makes change detection permanently blind).
