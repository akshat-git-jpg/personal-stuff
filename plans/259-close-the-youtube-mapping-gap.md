<!-- boss frontmatter -->
---
executor: codex
model: gpt-5.6-terra
test_cmd: cd apps/tutorial-tracker-app && npm test
ui:
deploy:
needs: ["257 (PR#218) and 258 (PR#219) must land first — this plan edits files both of them own"]
needs_prs: [218, 219]
touches: [apps/tutorial-tracker-app/src/worker/ytsync.ts, apps/tutorial-tracker-app/src/worker/index.ts, apps/tutorial-tracker-app/src/worker/linkguard.ts, apps/tutorial-tracker-app/test/ytsync.test.ts, apps/tutorial-tracker-app/test/linkguard.test.ts]

# --- Mutation gate. This plan adds a guard check, so boss must prove it can fire.
# The mutation removes the new issue code's push; the test asserting it is reported
# must then fail printing LINKGUARD_GATE.
mutation_apply: perl -0pi -e 's/code: "unmapped_video",/code: "NEVER_EMITTED",/' apps/tutorial-tracker-app/src/worker/linkguard.ts
mutation_command: npm test
mutation_expect: LINKGUARD_GATE
mutation_cwd: apps/tutorial-tracker-app
mutation_timeout: 600
---

# Plan 259: close the YouTube-mapping gap

## Summary

- **Problem statement**: `clicks-db.videos.yt_video_id` is written by **nothing in
  the codebase**. It was filled once by a manual backfill on 2026-06-16, so every
  video published since then has it NULL. The analytics dashboard attaches links
  to uploads by that column, so those videos showed `0 clicks` and
  "No links for this video". On 2026-08-28 the dashboard was showing **2 of 69
  recorded clicks**; four videos were hiding 54. The owner only learned a link was
  broken because a viewer commented on the video.
- **Goals**:
  - The tracker writes `videos.yt_video_id` automatically when an admin saves the
    card's `yt_link`, so the mapping can never silently go missing again.
  - The link guard reports any video that has links but no mapping, so the
    condition is self-announcing instead of waiting for a viewer's comment.
- **Decisions confirmed** (owner, 2026-08-28):
  - Capture route -> the tracker extracts the id when `yt_link` is saved
    ("Tracker writes it when you paste yt_link"), and the owner will fill that
    field manually per video
  - Fix 1 (backfilling the three affected videos) and Fix 2 (the dashboard
    surfacing unmapped links) were done directly and are already live — this plan
    does NOT redo them
  - No AI/LLM anywhere in this feature
- **Executor proposed**: `codex` / `gpt-5.6-terra` (owner instruction 2026-08-28:
  every plan in this batch runs on codex terra). Escalate to `gpt-5.6-sol` only if
  this plan fails a round on terra (`tooling/boss/data/rules.md` line 22).
- **Done criteria**: `npm test` green with both suites present and executed; the
  mutation recipe proves the new guard check can fail; saving a `yt_link` writes
  `yt_video_id`; a malformed or absent link never writes anything
- **Stop conditions**: an existing non-null `yt_video_id` would be overwritten;
  anything would write to the `clicks` table; a failed sync would fail the card save
- **Test / verification for success**: pure unit tests on the id extractor and on
  the new guard check, plus a recording fake D1 proving the exact statements issued
- **Open points for plan readiness**: none

## Executor instructions

**Drift check — run this FIRST:**

```bash
git diff --stat 75e63732..HEAD -- apps/tutorial-tracker-app/
```

`src/worker/linkguard.ts` MUST exist (plan 258) and `src/worker/catalog.ts` MUST
exist (plan 257). If either is missing, STOP — this plan runs after both.

**Line numbers in this plan are from `75e63732`, BEFORE plans 257 and 258 landed.**
Both edited `src/worker/index.ts`. Locate the seams by the quoted code, never by
line number, and if a quoted snippet no longer exists, STOP and report rather than
guessing where it moved.

## Status

- **Priority**: high (silent revenue-reporting loss)
- **Effort**: small-medium
- **Risk**: low (additive; the sync is best-effort and never blocks a save)
- **Depends on**: plans 257 (PR#218), 258 (PR#219)
- **Category**: bug
- **Planned-at SHA**: `75e63732`
- **Difficulty**: standard

## Why this matters

The owner's own question when he saw the dashboard: *"he must have clicked that
link to get the information, why the click was not registered?"*

It **was** registered. 19 clicks existed on that video, four of them from
`https://www.youtube.com/` minutes before he looked. The redirector, KV, the
`links` table and the `clicks` table were all correct. The only broken link in the
chain was the last one: nothing had recorded which YouTube upload that video was.

That is the whole bug class this plan closes. A missing mapping is indistinguishable
from "no clicks", so it hid for months and cost an unknown amount of commission.

## Current state

### The measured damage (2026-08-28, production)

```
clicks total                 69
clicks visible in dashboard   2      <- before the fix
clicks hidden by NULL mapping 54
links hidden by NULL mapping  36 of 134
videos with NULL yt_video_id  22 of 87
```

Already fixed directly, outside this plan (do NOT redo):

- `RkIr -> K-Uj9NnetLQ`, `vcfX -> TaBrgRQSqeU`, `Ixxk -> n7KLdCjod2U` written into
  `videos.yt_video_id`. Visible clicks went 2 -> 55.
- `apps/analytics-app` now returns an `unmatched` array and renders it, so unmapped
  links are shown instead of dropped. Live at version `6358d177`.

### Nothing writes the column — the two INSERTs, verbatim

```ts
// apps/tutorial-tracker-app/src/worker/clickstore.ts:26
.prepare("INSERT INTO videos (video_code, video_title, created_at) VALUES (?, ?, ?)")
```

```python
# pipelines/youtube/yt-analysis/process_yt_tracker.py:168
"INSERT INTO videos (video_code, video_title, created_at) VALUES (?, ?, ?)",
```

Neither sets `yt_video_id`. There is no `UPDATE videos` anywhere in the repo.

### The field that already exists and is meant to hold this

```ts
// src/shared/columns.ts:94
yt_link: "YouTube link",
```

```ts
// src/shared/engine/definitions/standard.ts:60
work: { id: "yt_link", label: "YouTube link", type: "url", slot: "work_link", required: "submit" },
```

So the upload stage already requires a YouTube link to submit. **It is empty on all
76 cards today** — the owner has committed to filling it going forward. Until he
does, this plan changes nothing at runtime; it makes the mapping automatic from the
first card he fills.

### The write seam — one choke point for every card field

```ts
// src/worker/datastore.ts:102
async updateCells(rowId: string, values: Record<string, string | undefined>, expected?: { col: string; value: string }) {
  const card = await this.db.prepare(`SELECT * FROM cards WHERE id = ?`).bind(rowId).first<CardDB>();
  if (!card) throw new Error(`Row with row_id "${rowId}" not found`);
```

Every `yt_link` write goes through here. **Do NOT put the sync inside
`datastore.ts`** — that class owns `TRACKER_DB` only, and this write targets a
different database (`DB` / clicks-db). Crossing that boundary inside the store
would make it depend on a binding it has no business knowing.

Instead, hook the route that calls it:

```ts
// src/worker/index.ts:558
app.post("/api/update", async (c) => {
```

### Conventions to match

- **Exemplar worker module**: `src/worker/clickstore.ts` — small exported async
  functions, `db` first, prepared statements, no classes.
- **Exemplar pure-logic module + tests**: `src/worker/linkhealth.ts` with
  `test/linkgen.test.ts`.
- **`erasableSyntaxOnly` is ON**: no TS `enum`, no constructor parameter properties.

## Commands you will need

```bash
cd apps/tutorial-tracker-app
npm install
npm test              # THE MERGE GATE
npm run typecheck     # exit 0
npm run build
```

Baseline after plans 257 + 258: `npm test` passes. Record the exact
`Test Files` / `Tests` counts before you start; yours must be higher.

## Scope

**In scope:**

- `src/worker/ytsync.ts` (new — the id extractor + the one-row update)
- `src/worker/index.ts` (call the sync from the `/api/update` handler ONLY)
- `src/worker/linkguard.ts` (add ONE issue code)
- `test/ytsync.test.ts` (new)
- `test/linkguard.test.ts` (add cases for the new code)

**Out of scope — do not touch:**

- `src/worker/datastore.ts` — see the boundary note above. If you think the sync
  belongs there, STOP and report.
- `src/worker/clickstore.ts`, `linkhealth.ts`, `catalog.ts`, `programs.ts` — read only.
- `apps/analytics-app/**` — Fix 2 already shipped. Nothing here changes it.
- `apps/redirector/**` — the only writer to `clicks`.
- The `clicks` table — never written, by anything, ever.
- `pipelines/youtube/yt-analysis/process_yt_tracker.py` — legacy path, being retired.

## Steps

### Step 1 — the id extractor and the sync (new file)

Create `src/worker/ytsync.ts`.

```ts
/**
 * ytsync.ts
 * Keeps clicks-db.videos.yt_video_id in step with the tracker card's yt_link.
 *
 * Why this exists: nothing in the codebase ever wrote that column. It was filled
 * once by a manual backfill on 2026-06-16, so every video published afterwards
 * had it NULL — and the analytics dashboard attaches links to YouTube uploads by
 * exactly that column. On 2026-08-28 the dashboard showed 2 of 69 recorded
 * clicks; 54 were hidden behind NULL mappings. The owner found out because a
 * viewer commented that a link was broken.
 *
 * The sync is deliberately best-effort: a failure here must never fail the
 * admin's card save. A missing mapping is a reporting problem; a failed save
 * loses the operator's work.
 */

/**
 * Pull the 11-character video id out of any YouTube URL shape the owner might
 * paste. Returns null when the input is not a YouTube video link — including a
 * channel, a playlist-only url, or prose.
 *
 * Handled: watch?v=, youtu.be/, /shorts/, /embed/, /live/, and a bare id.
 */
export function extractYouTubeId(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  const ID = /^[A-Za-z0-9_-]{11}$/;

  // A bare id, pasted without a url.
  if (ID.test(value)) return value;

  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./i, "").toLowerCase();
  const isYouTube =
    host === "youtube.com" || host === "m.youtube.com" ||
    host === "music.youtube.com" || host === "youtu.be";
  if (!isYouTube) return null;

  // youtu.be/<id>
  if (host === "youtu.be") {
    const seg = u.pathname.split("/").filter(Boolean)[0] ?? "";
    return ID.test(seg) ? seg : null;
  }

  // youtube.com/watch?v=<id>
  const v = u.searchParams.get("v");
  if (v && ID.test(v)) return v;

  // youtube.com/{shorts,embed,live,v}/<id>
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && ["shorts", "embed", "live", "v"].includes(parts[0].toLowerCase())) {
    return ID.test(parts[1]) ? parts[1] : null;
  }

  return null;
}

/**
 * Record the mapping for one video_code. Returns what it did, so the caller can
 * log it without inspecting the database again.
 *
 * NEVER overwrites an existing non-null value: a wrong mapping written over a
 * correct one would silently move another video's clicks. Changing an existing
 * mapping is a deliberate manual act, not a side effect of editing a card.
 */
export type SyncOutcome = "written" | "unchanged" | "already-set" | "no-video-row" | "skipped";

export async function syncYouTubeId(
  db: D1Database, videoCode: string, ytLink: string | null | undefined,
): Promise<SyncOutcome> {
  const code = (videoCode ?? "").trim();
  const id = extractYouTubeId(ytLink);
  if (!code || !id) return "skipped";

  const row = await db
    .prepare("SELECT yt_video_id FROM videos WHERE video_code = ?")
    .bind(code)
    .first<{ yt_video_id: string | null }>();
  if (!row) return "no-video-row";
  if (row.yt_video_id === id) return "unchanged";
  if (row.yt_video_id) return "already-set";

  await db
    .prepare("UPDATE videos SET yt_video_id = ? WHERE video_code = ? AND yt_video_id IS NULL")
    .bind(id, code)
    .run();
  return "written";
}
```

**Verify:** create `test/ytsync.test.ts` covering at least these, then `npm test`:

```ts
import { describe, it, expect } from "vitest";
import { extractYouTubeId, syncYouTubeId } from "../src/worker/ytsync";

describe("extractYouTubeId", () => {
  it("reads watch?v=", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=TaBrgRQSqeU")).toBe("TaBrgRQSqeU");
  });
  it("reads watch?v= with extra params", () => {
    expect(extractYouTubeId("https://youtube.com/watch?v=TaBrgRQSqeU&t=42s&list=PLx")).toBe("TaBrgRQSqeU");
  });
  it("reads youtu.be", () => {
    expect(extractYouTubeId("https://youtu.be/K-Uj9NnetLQ")).toBe("K-Uj9NnetLQ");
  });
  it("reads /shorts/, /embed/, /live/", () => {
    expect(extractYouTubeId("https://www.youtube.com/shorts/n7KLdCjod2U")).toBe("n7KLdCjod2U");
    expect(extractYouTubeId("https://www.youtube.com/embed/n7KLdCjod2U")).toBe("n7KLdCjod2U");
    expect(extractYouTubeId("https://www.youtube.com/live/n7KLdCjod2U")).toBe("n7KLdCjod2U");
  });
  it("accepts a scheme-less url and a bare id", () => {
    expect(extractYouTubeId("youtube.com/watch?v=TaBrgRQSqeU")).toBe("TaBrgRQSqeU");
    expect(extractYouTubeId("TaBrgRQSqeU")).toBe("TaBrgRQSqeU");
  });
  it("returns null for a channel, a non-YouTube host, prose and empty", () => {
    expect(extractYouTubeId("https://www.youtube.com/@AgrolloReviews")).toBeNull();
    expect(extractYouTubeId("https://vimeo.com/123456789")).toBeNull();
    expect(extractYouTubeId("will add the link later")).toBeNull();
    expect(extractYouTubeId("")).toBeNull();
    expect(extractYouTubeId(null)).toBeNull();
  });
  it("returns null for an id of the wrong length", () => {
    expect(extractYouTubeId("https://youtu.be/tooshort")).toBeNull();
  });
});

/** Recording fake D1 — asserts the EXACT statements issued, not just the result. */
function recordingDb(existing: string | null | undefined) {
  const statements: string[] = [];
  const stmt: Record<string, unknown> = {};
  stmt.bind = () => stmt;
  stmt.first = async () => (existing === undefined ? null : { yt_video_id: existing });
  stmt.all = async () => ({ results: [] });
  stmt.run = async () => ({ success: true });
  const db = { prepare(sql: string) { statements.push(sql); return stmt; } };
  return { db: db as unknown as D1Database, statements };
}

describe("syncYouTubeId", () => {
  it("writes the mapping when the column is NULL", async () => {
    const { db, statements } = recordingDb(null);
    expect(await syncYouTubeId(db, "vcfX", "https://youtu.be/TaBrgRQSqeU")).toBe("written");
    expect(statements.some((s) => /UPDATE videos SET yt_video_id/i.test(s))).toBe(true);
  });
  it("does NOT overwrite an existing different mapping", async () => {
    const { db, statements } = recordingDb("OTHERvideo1");
    expect(await syncYouTubeId(db, "vcfX", "https://youtu.be/TaBrgRQSqeU")).toBe("already-set");
    expect(statements.some((s) => /UPDATE/i.test(s))).toBe(false);
  });
  it("is a no-op when the mapping already matches", async () => {
    const { db, statements } = recordingDb("TaBrgRQSqeU");
    expect(await syncYouTubeId(db, "vcfX", "https://youtu.be/TaBrgRQSqeU")).toBe("unchanged");
    expect(statements.some((s) => /UPDATE/i.test(s))).toBe(false);
  });
  it("reports no-video-row when the code is unknown", async () => {
    const { db } = recordingDb(undefined);
    expect(await syncYouTubeId(db, "zzzz", "https://youtu.be/TaBrgRQSqeU")).toBe("no-video-row");
  });
  it("skips a non-YouTube link, empty link, or missing code without querying", async () => {
    for (const [code, link] of [["vcfX", "not a link"], ["vcfX", ""], ["", "https://youtu.be/TaBrgRQSqeU"]] as const) {
      const { db, statements } = recordingDb(null);
      expect(await syncYouTubeId(db, code, link)).toBe("skipped");
      expect(statements).toHaveLength(0);
    }
  });
  it("never touches the clicks table", async () => {
    const { db, statements } = recordingDb(null);
    await syncYouTubeId(db, "vcfX", "https://youtu.be/TaBrgRQSqeU");
    for (const s of statements) expect(s).not.toMatch(/\bclicks\b/i);
  });
});
```

### Step 2 — call it from the update route

In `src/worker/index.ts`, find the handler that begins:

```ts
app.post("/api/update", async (c) => {
```

After the existing update has succeeded (do not change any existing behaviour),
add the sync. It must be fire-and-forget and swallow its own errors.

```ts
// Keep the analytics mapping in step. Best-effort on purpose: a failure here
// must never fail the admin's save. Nothing wrote videos.yt_video_id before
// 2026-08-28, which hid 54 of 69 recorded clicks behind NULL mappings.
if (Object.prototype.hasOwnProperty.call(values, "yt_link")) {
  const row = await getStore(c.env).readRow(rowId);      // or the equivalent already in scope
  const code = String((row as Record<string, unknown>)?.video_code ?? "").trim();
  c.executionCtx.waitUntil(
    syncYouTubeId(c.env.DB, code, String(values.yt_link ?? ""))
      .then((outcome) => { if (outcome !== "skipped") console.log("ytsync", JSON.stringify({ code, outcome })); })
      .catch((e) => console.error("ytsync failed", e)),
  );
}
```

Adapt the two lines that read the row and the values bag to whatever names are
actually in scope in that handler after plans 257/258 — the shape above is the
requirement, not the literal identifiers. Import at the top:

```ts
import { syncYouTubeId } from "./ytsync";
```

**Verify:**

```bash
npm run typecheck        # exit 0
npm test                 # still green
grep -c 'from "./ytsync"' src/worker/index.ts      # -> 1
# the sync is called from exactly one place
grep -c "syncYouTubeId(" src/worker/index.ts       # -> 1
# datastore.ts was NOT touched
git diff --name-only -- src/worker/datastore.ts | wc -l   # -> 0
```

### Step 3 — the guard reports an unmapped video

In `src/worker/linkguard.ts` (from plan 258), add ONE issue code. Extend the
`IssueCode` union:

```ts
  | "unmapped_video"       // has links, but no YouTube id -> clicks invisible in analytics
```

Extend `GuardInput` with the mapping, so the check stays pure:

```ts
export interface GuardInput {
  programs: ProgramRow[];
  links: { slug: string; tool: string; target_url: string; kind: string | null }[];
  kv: Record<string, string>;
  /** video_code -> yt_video_id (null when unmapped). From clicks-db.videos. */
  videos?: Record<string, string | null>;
}
```

Inside `structuralIssues`, in the link-level loop section, add:

```ts
  // A video with links but no YouTube id is invisible in the analytics dashboard:
  // it attaches links to uploads by videos.yt_video_id, so a NULL there reads as
  // "0 clicks". This is the 2026-08-28 bug (54 of 69 clicks hidden), reported once
  // per video rather than once per link.
  if (input.videos) {
    const codesWithLinks = new Set<string>();
    for (const l of links) {
      const code = l.slug.split("/")[0];
      if (code) codesWithLinks.add(code);
    }
    for (const code of [...codesWithLinks].sort()) {
      if (!(code in input.videos)) continue;          // unknown video: link_without_program covers it
      if (input.videos[code]) continue;               // mapped, fine
      issues.push({
        code: "unmapped_video",
        slug: code,
        detail: `Video ${code} has links but no YouTube video recorded against it, so its clicks are invisible in analytics. Set the YouTube link on the card.`,
      });
    }
  }
```

Then have `runStructural` pass the mapping, reading it from `clicks-db`:

```sql
SELECT video_code, yt_video_id FROM videos
```

**Verify:** add to `test/linkguard.test.ts` (names must carry `LINKGUARD_GATE`):

```ts
  it("LINKGUARD_GATE flags a video with links but no YouTube mapping", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "openart", target_url: "https://openart.ai/?via=seema" })],
      links: [{ slug: "vcfX/openart", tool: "openart", target_url: "https://openart.ai/?via=seema", kind: "affiliate" }],
      kv: { "vcfX/openart": "https://openart.ai/?via=seema" },
      videos: { vcfX: null },
    });
    const u = issues.find((i) => i.code === "unmapped_video");
    expect(u).toBeDefined();
    expect(u!.slug).toBe("vcfX");
    expect(u!.detail).toContain("invisible in analytics");
  });

  it("LINKGUARD_GATE does not flag a video that IS mapped", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "openart", target_url: "https://openart.ai/?via=seema" })],
      links: [{ slug: "vcfX/openart", tool: "openart", target_url: "https://openart.ai/?via=seema", kind: "affiliate" }],
      kv: { "vcfX/openart": "https://openart.ai/?via=seema" },
      videos: { vcfX: "TaBrgRQSqeU" },
    });
    expect(issues.map((i) => i.code)).not.toContain("unmapped_video");
  });

  it("LINKGUARD_GATE reports an unmapped video ONCE, not once per link", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "a", target_url: "https://a.example/?ref=1" }),
                 prog({ slug: "b", target_url: "https://b.example/?ref=1" })],
      links: [{ slug: "vcfX/a", tool: "a", target_url: "https://a.example/?ref=1", kind: "affiliate" },
              { slug: "vcfX/b", tool: "b", target_url: "https://b.example/?ref=1", kind: "affiliate" }],
      kv: { "vcfX/a": "https://a.example/?ref=1", "vcfX/b": "https://b.example/?ref=1" },
      videos: { vcfX: null },
    });
    expect(issues.filter((i) => i.code === "unmapped_video")).toHaveLength(1);
  });

  it("LINKGUARD_GATE omits the check entirely when no mapping is supplied", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "a", target_url: "https://a.example/?ref=1" })],
      links: [{ slug: "vcfX/a", tool: "a", target_url: "https://a.example/?ref=1", kind: "affiliate" }],
      kv: { "vcfX/a": "https://a.example/?ref=1" },
    });
    expect(issues.map((i) => i.code)).not.toContain("unmapped_video");
  });
```

### Step 4 — dry-run the mutation recipe

```bash
cd apps/tutorial-tracker-app
npm test                                    # clean: passes
perl -0pi -e 's/code: "unmapped_video",/code: "NEVER_EMITTED",/' src/worker/linkguard.ts
npm test 2>&1 | grep -q LINKGUARD_GATE && echo MUTATION_DETECTED
git checkout -- src/worker/linkguard.ts
npm test                                    # passes again
```

If `MUTATION_DETECTED` does not print, fix the recipe or the test names BEFORE
finishing. A gate that cannot fire reads as coverage.

## Test plan

| File | Follows | Covers |
|---|---|---|
| `test/ytsync.test.ts` (new) | `test/linkgen.test.ts` | every URL shape in Step 1, the never-overwrite rule, the skip paths, and that `clicks` is never named in any statement |
| `test/linkguard.test.ts` (extend) | itself | the 4 `unmapped_video` cases in Step 3 |

## Done criteria

```bash
cd apps/tutorial-tracker-app

npm test                 # green; Test Files and Tests counts BOTH higher than your recorded baseline
test -s test/ytsync.test.ts && echo SUITE_PRESENT
npm test 2>&1 | grep -q "ytsync" && echo SUITE_RAN
npm run typecheck        # exit 0
npm run build            # succeeds

grep -c 'from "./ytsync"' src/worker/index.ts    # -> 1
grep -c "syncYouTubeId(" src/worker/index.ts     # -> 1
git diff --name-only 75e63732..HEAD -- src/worker/datastore.ts | wc -l   # -> 0

# the analytics gate from plan 257 must still hold
npm test 2>&1 | grep -q "CLICKS_READONLY_GATE" && echo ANALYTICS_GATE_STILL_RAN

# nothing in this app writes to clicks
grep -rniE "(insert|update|delete)[^;]{0,40}\bclicks\b" src/worker/ src/client/ | grep -v "CLICKS_KV" | wc -l
#   -> 0
```

## STOP conditions

- **An existing non-null `yt_video_id` would be overwritten.** That silently moves
  another video's clicks. The `AND yt_video_id IS NULL` clause and the
  `already-set` branch are both required; if you remove either, STOP.
- **Anything would INSERT, UPDATE or DELETE in the `clicks` table.** STOP.
- **A failed sync would fail the card save.** The operator's work matters more than
  the mapping. If you cannot make it best-effort, STOP and report.
- **You are about to put the sync in `datastore.ts`.** STOP — that class owns
  `TRACKER_DB`; this write targets `DB` (clicks-db).
- **A quoted snippet from `index.ts` no longer exists.** Plans 257/258 edited that
  file. STOP and report rather than guessing where the seam moved.
- **The mutation recipe does not make `npm test` fail printing `LINKGUARD_GATE`.**
  STOP and fix it first.
- **A gate assertion fails.** Fix the code or the fixture. Weakening, swapping or
  deleting an assertion is a STOP.
- **A test performs real network or real D1 I/O.** STOP; the fake is injected for
  exactly this reason.

## Maintenance notes

- This closes the write side only. The 19 videos still unmapped in production are
  mostly test cards; the owner fills `yt_link` per video from here on, and the
  guard now nags about any that carry links.
- If the owner ever needs to CHANGE an existing mapping, that stays a deliberate
  manual `UPDATE` — by design this code refuses to.
- `pipelines/youtube/yt-analysis/process_yt_tracker.py:168` also inserts `videos`
  rows without `yt_video_id`. It is the legacy path; if it is still in use, it
  needs the same treatment, which is a separate plan.
- A reviewer should scrutinise: that the sync really is fire-and-forget (a thrown
  promise inside `waitUntil` must not surface to the caller), and that
  `unmapped_video` is reported once per video, not once per link.
