# Tracker-app In-App Link Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two Admin-only powers to the deployed tracker-app — create a video row, and generate its go.agrolloo short links + YouTube description — so the whole flow runs from the UI instead of `process_yt_tracker.py`.

**Architecture:** Extend the existing Hono Worker to bind the *same* Cloudflare KV (`CLICKS_KV`) and D1 (`clicks-db`) the redirector already uses. Port `process_yt_tracker.py`'s logic into testable TS modules (`gemini.ts`, `affiliate.ts`, `linkgen.ts`) plus a `sheets.appendRow`. Add `POST /api/video` and `POST /api/generate-links`, both gated to `Admin`. Client gets a "New Video" modal and a "Generate links & description" action in the card detail panel.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers (KV + D1 native bindings), Google Sheets v4 REST, Gemini REST (`gemini-2.5-flash`), React (Vite SPA), Vitest.

**Working dir for all commands:** `youtube/tracker-app/` (run `cd youtube/tracker-app` first). Tests: `npm test` (vitest). Spec: `docs/superpowers/specs/2026-06-15-tracker-link-generation-design.md`.

---

## File Structure

**Create (Worker):**
- `src/worker/gemini.ts` — Gemini REST client (`generateText`, `generateJSON`).
- `src/worker/affiliate.ts` — Affiliate Programs sheet reader + `normalizeToolName`.
- `src/worker/linkgen.ts` — ported `process_one_video`: detect → resolve → mint code → KV+D1 → describe. Pure helpers + an orchestrator taking injected deps.
- `src/worker/prompts.ts` — the two prompt templates as exported string constants (canonical copies of `common/prompts/tracker/*.md`).

**Create (tests):**
- `test/affiliate.test.ts` — `normalizeToolName`.
- `test/linkgen.test.ts` — `generateVideoCode`, `resolveTools`, `formatActualLinks`, `formatShortLinks`, and `processVideo` with mock deps.

**Modify (Worker):**
- `src/worker/auth.ts` — extend `Env` with `CLICKS_KV`, `DB`, `GEMINI_API_KEY`, `LINK_DOMAIN`, `AFFILIATE_PROGRAMS_SHEET_URL`.
- `src/worker/sheets.ts` — add `appendRow`.
- `src/worker/index.ts` — add `POST /api/video` and `POST /api/generate-links`.
- `wrangler.toml` — add KV + D1 bindings and `[vars]`.

**Modify (Client):**
- `src/client/api.ts` — `createVideo`, `generateLinks` wrappers + types.
- `src/client/CardDetail.tsx` — "Generate links & description" action + results UI (Admin-only).
- `src/client/Board.tsx` — "New Video" button + modal (Admin-only).

**Modify (Python, last):**
- `youtube/yt-analysis/process_yt_tracker.py` — deprecation header.
- `docs/yt-tracker-workflow.md` — mark superseded.

---

## Task 1: Gemini REST client

**Files:**
- Create: `src/worker/gemini.ts`

- [ ] **Step 1: Write `gemini.ts`**

```typescript
/**
 * gemini.ts
 * Minimal Gemini REST client (Generative Language API v1beta).
 * Self-contained and promotable to a shared TS lib later — no Worker-binding deps.
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
export const DEFAULT_MODEL = "gemini-2.5-flash";

export interface GeminiClient {
  generateText(prompt: string): Promise<string>;
  generateJSON<T = unknown>(prompt: string): Promise<T>;
}

interface GenResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

function extractText(json: GenResponse): string {
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callGemini(
  apiKey: string,
  model: string,
  prompt: string,
  jsonMode: boolean,
  retries = 1,
): Promise<string> {
  const url = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: prompt }] }],
  };
  if (jsonMode) {
    body.generationConfig = { responseMimeType: "application/json" };
  }
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Gemini ${model} failed (${resp.status}): ${text}`);
      }
      return extractText((await resp.json()) as GenResponse);
    } catch (e) {
      lastErr = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw lastErr;
}

export function createGeminiClient(apiKey: string, model = DEFAULT_MODEL): GeminiClient {
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");
  return {
    async generateText(prompt: string) {
      return callGemini(apiKey, model, prompt, false);
    },
    async generateJSON<T = unknown>(prompt: string): Promise<T> {
      const text = await callGemini(apiKey, model, prompt, true);
      return JSON.parse(text) as T;
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd youtube/tracker-app && npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add youtube/tracker-app/src/worker/gemini.ts
git commit -m "feat(tracker-app): add Gemini REST client"
```

---

## Task 2: Prompt constants

**Files:**
- Create: `src/worker/prompts.ts`

- [ ] **Step 1: Write `prompts.ts`** (verbatim ports of `common/prompts/tracker/*.md`; `{placeholders}` kept as `${...}` template slots)

```typescript
/** Canonical prompt templates (ported from common/prompts/tracker/). */

export function detectToolsPrompt(videoTitle: string, videoNotes: string, candidatesBlock: string): string {
  return `You are an expert at parsing video creator notes to identify ALL tools/products mentioned for promotion in a YouTube video.

Given:
- A video title
- Free-form notes the creator wrote about the video
- A list of TOOLS WITH AFFILIATE PROGRAMS the creator already has

Your job: identify ALL tools/products the creator is going to promote in this video — INCLUDING those that don't have an affiliate program (the creator wants to mention them anyway, just without affiliate revenue).

For each tool, return:
- \`slug\`: kebab-case identifier (lowercase, hyphens, e.g., "invideo-studio", "runway-ml")
- \`display_name\`: the human-readable name (e.g., "Invideo Studio", "Runway ML")
- \`homepage_url\`: the tool's official homepage. REQUIRED for tools NOT in the affiliate list. For tools IN the affiliate list (matched by slug), this can be empty (the system will use the affiliate URL).

Match conservatively — only include tools clearly intended for promotion (mentioned by name, compared, demoed, recommended). Do NOT include tools mentioned only as competitors that the creator is NOT going to link to.

For the slug:
- Lowercase only
- Replace spaces and special chars with hyphens
- Be consistent: if a tool is "Invideo Studio" in display name, slug is "invideo-studio"
- If a tool's slug matches one from the affiliate list below, the system will treat it as affiliate

For the homepage_url:
- Use https:// always
- Use the canonical homepage (e.g., "https://fliki.ai", "https://runwayml.com")
- For affiliate-list tools, leave as empty string ""

---

Video title: ${videoTitle}

Notes:
${videoNotes}

Tools with existing affiliate programs (slug — display name):
${candidatesBlock}

Return JSON:
{"tools": [
  {"slug": "invideo-studio", "display_name": "Invideo Studio", "homepage_url": ""},
  {"slug": "fliki", "display_name": "Fliki", "homepage_url": "https://fliki.ai"}
]}`;
}

export function describePrompt(videoTitle: string, videoNotes: string, linksBlock: string): string {
  return `You are writing the YouTube video description for a creator's affiliate-focused tutorial/comparison video. Generate a clear, engaging description that:

- Opens with a 1-2 line hook summarizing what the video covers
- Lists each tool/product mentioned with the affiliate short URL alongside its name (use the exact short URL provided)
- Mentions any coupon codes inline next to the relevant tool
- Closes with a brief CTA (e.g., "Subscribe for more comparisons", "Drop a comment if you've tried these")
- Sounds like a real creator wrote it — friendly, not corporate

Format the description with line breaks for readability. No hashtags. No emojis unless they fit naturally.

---

Video title: ${videoTitle}

Creator's notes:
${videoNotes}

Tools to feature (link → short URL → coupon if any):
${linksBlock}

Output the description text only. No preamble, no markdown headers, no quoting.`;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd youtube/tracker-app && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add youtube/tracker-app/src/worker/prompts.ts
git commit -m "feat(tracker-app): add tracker prompt templates"
```

---

## Task 3: Affiliate sheet reader

**Files:**
- Create: `src/worker/affiliate.ts`
- Test: `test/affiliate.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/affiliate.test.ts
import { describe, it, expect } from "vitest";
import { normalizeToolName } from "../src/worker/affiliate";

describe("normalizeToolName", () => {
  it("lowercases and hyphenates", () => {
    expect(normalizeToolName("Invideo Studio")).toBe("invideo-studio");
  });
  it("strips special chars and collapses separators", () => {
    expect(normalizeToolName("Runway ML!!")).toBe("runway-ml");
  });
  it("trims leading/trailing hyphens", () => {
    expect(normalizeToolName("  -Fliki- ")).toBe("fliki");
  });
  it("throws on empty", () => {
    expect(() => normalizeToolName("   ")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd youtube/tracker-app && npx vitest run test/affiliate.test.ts`
Expected: FAIL ("Cannot find module '../src/worker/affiliate'").

- [ ] **Step 3: Write `affiliate.ts`**

```typescript
/**
 * affiliate.ts
 * Reads the Affiliate Programs sheet (Sheet1) and normalizes tool names.
 * Ported from common/affiliate.py.
 */

import { sheetsGet } from "./sheets";
import { extractSheetId } from "./sheet-id";

export interface AffiliateRecord {
  tool: string;
  displayName: string;
  targetUrl: string;
  approvalStatus: string;
  couponStatus: string;
  couponCode: string;
  isApproved: boolean;
}

export function normalizeToolName(name: string): string {
  if (!name || !name.trim()) throw new Error("Tool name is empty");
  const s = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return s.replace(/^-+|-+$/g, "");
}

export async function loadAffiliateRecords(
  token: string,
  sheetUrl: string,
): Promise<Record<string, AffiliateRecord>> {
  const sheetId = extractSheetId(sheetUrl);
  const rows = await sheetsGet(token, sheetId, "Sheet1!A1:Z999");
  if (rows.length < 2) return {};

  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const cell = (row: string[], col: string) => {
    const i = idx(col);
    return i >= 0 && i < row.length ? row[i].trim() : "";
  };

  const out: Record<string, AffiliateRecord> = {};
  for (const row of rows.slice(1)) {
    const display = cell(row, "Affiliate Program");
    if (!display) continue;
    let slug: string;
    try {
      slug = normalizeToolName(display);
    } catch {
      continue;
    }
    const approvalStatus = cell(row, "Approval Status");
    out[slug] = {
      tool: slug,
      displayName: display,
      targetUrl: cell(row, "My Affiliate Link"),
      approvalStatus,
      couponStatus: cell(row, "Coupon Status"),
      couponCode: cell(row, "Coupon Code"),
      isApproved: approvalStatus.toLowerCase() === "approved",
    };
  }
  return out;
}
```

- [ ] **Step 2b: Create `src/worker/sheet-id.ts`** (small extractor, since the Worker had no URL→id helper before)

```typescript
/** Extract the spreadsheet id from a full Google Sheets URL (or pass through a bare id). */
export function extractSheetId(urlOrId: string): string {
  const m = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : urlOrId.trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd youtube/tracker-app && npx vitest run test/affiliate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add youtube/tracker-app/src/worker/affiliate.ts youtube/tracker-app/src/worker/sheet-id.ts youtube/tracker-app/test/affiliate.test.ts
git commit -m "feat(tracker-app): add affiliate sheet reader + tool-name normalization"
```

---

## Task 4: linkgen pure helpers

**Files:**
- Create: `src/worker/linkgen.ts` (helpers first; orchestrator in Task 5)
- Test: `test/linkgen.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// test/linkgen.test.ts
import { describe, it, expect } from "vitest";
import {
  generateVideoCode,
  resolveTools,
  formatActualLinks,
  formatShortLinks,
} from "../src/worker/linkgen";
import type { AffiliateRecord } from "../src/worker/affiliate";

const aff = (over: Partial<AffiliateRecord> & { tool: string }): AffiliateRecord => ({
  displayName: over.tool, targetUrl: "", approvalStatus: "", couponStatus: "",
  couponCode: "", isApproved: false, ...over,
});

describe("generateVideoCode", () => {
  it("returns a 4-char code not in the existing set", () => {
    const code = generateVideoCode(new Set<string>());
    expect(code).toMatch(/^[a-zA-Z0-9]{4}$/);
  });
  it("avoids collisions", () => {
    // exhaust nothing realistically; just assert it differs from a seeded existing
    const existing = new Set<string>();
    const c1 = generateVideoCode(existing);
    existing.add(c1);
    const c2 = generateVideoCode(existing);
    expect(c2).not.toBe(c1);
  });
});

describe("resolveTools", () => {
  const affiliates: Record<string, AffiliateRecord> = {
    railway: aff({ tool: "railway", isApproved: true, targetUrl: "https://aff/railway", couponCode: "SAVE10" }),
    render: aff({ tool: "render", isApproved: false, targetUrl: "" }),
  };
  it("uses affiliate URL when approved", () => {
    const r = resolveTools([{ slug: "railway", display_name: "Railway", homepage_url: "" }], affiliates);
    expect(r).toEqual([{ slug: "railway", displayName: "Railway", targetUrl: "https://aff/railway", couponCode: "SAVE10", hasAffiliate: true }]);
  });
  it("falls back to homepage_url for non-affiliate tools", () => {
    const r = resolveTools([{ slug: "fliki", display_name: "Fliki", homepage_url: "https://fliki.ai" }], affiliates);
    expect(r).toEqual([{ slug: "fliki", displayName: "Fliki", targetUrl: "https://fliki.ai", couponCode: "", hasAffiliate: false }]);
  });
  it("skips tools with no resolvable URL", () => {
    const r = resolveTools([{ slug: "render", display_name: "Render", homepage_url: "" }], affiliates);
    expect(r).toEqual([]);
  });
});

describe("formatters", () => {
  it("formatShortLinks pairs tool: url", () => {
    expect(formatShortLinks([["railway", "https://go/x/railway"]])).toBe("railway: https://go/x/railway");
  });
  it("formatActualLinks flags non-affiliate", () => {
    expect(formatActualLinks([["railway", "https://aff", true], ["fliki", "https://fliki.ai", false]]))
      .toBe("railway: https://aff\nfliki: https://fliki.ai (no affiliate)");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd youtube/tracker-app && npx vitest run test/linkgen.test.ts`
Expected: FAIL ("Cannot find module '../src/worker/linkgen'").

- [ ] **Step 3: Write the helpers in `linkgen.ts`**

```typescript
/**
 * linkgen.ts
 * Ported from process_yt_tracker.py: detect tools → resolve URLs → mint code →
 * write KV + D1 → generate description. Pure helpers + an injected-deps orchestrator.
 */

import type { AffiliateRecord } from "./affiliate";

const BASE62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 4;

export interface DetectedTool {
  slug: string;
  display_name: string;
  homepage_url: string;
}

export interface ResolvedTool {
  slug: string;
  displayName: string;
  targetUrl: string;
  couponCode: string;
  hasAffiliate: boolean;
}

export function generateVideoCode(existing: Set<string>, maxAttempts = 100): string {
  for (let i = 0; i < maxAttempts; i++) {
    let code = "";
    const bytes = new Uint8Array(CODE_LENGTH);
    crypto.getRandomValues(bytes);
    for (let j = 0; j < CODE_LENGTH; j++) code += BASE62[bytes[j] % BASE62.length];
    if (!existing.has(code)) return code;
  }
  throw new Error(`Could not generate a unique ${CODE_LENGTH}-char code in ${maxAttempts} attempts`);
}

export function resolveTools(
  detected: DetectedTool[],
  affiliates: Record<string, AffiliateRecord>,
): ResolvedTool[] {
  const out: ResolvedTool[] = [];
  for (const entry of detected) {
    const rec = affiliates[entry.slug];
    if (rec && rec.isApproved && rec.targetUrl.trim()) {
      out.push({
        slug: entry.slug,
        displayName: entry.display_name || rec.displayName,
        targetUrl: rec.targetUrl,
        couponCode: rec.couponCode,
        hasAffiliate: true,
      });
    } else {
      const fallback = (rec?.targetUrl.trim() || "") || entry.homepage_url;
      if (!fallback) continue; // no URL anywhere — skip this tool
      out.push({
        slug: entry.slug,
        displayName: entry.display_name,
        targetUrl: fallback,
        couponCode: "",
        hasAffiliate: false,
      });
    }
  }
  return out;
}

export function formatShortLinks(items: [string, string][]): string {
  return items.map(([tool, url]) => `${tool}: ${url}`).join("\n");
}

export function formatActualLinks(items: [string, string, boolean][]): string {
  return items
    .map(([tool, url, hasAff]) => (hasAff ? `${tool}: ${url}` : `${tool}: ${url} (no affiliate)`))
    .join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd youtube/tracker-app && npx vitest run test/linkgen.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add youtube/tracker-app/src/worker/linkgen.ts youtube/tracker-app/test/linkgen.test.ts
git commit -m "feat(tracker-app): add linkgen pure helpers (code gen, resolution, formatting)"
```

---

## Task 5: linkgen orchestrator (`processVideo`)

**Files:**
- Modify: `src/worker/linkgen.ts`
- Test: `test/linkgen.test.ts` (append)

- [ ] **Step 1: Append the failing test**

```typescript
// append to test/linkgen.test.ts
import { processVideo } from "../src/worker/linkgen";
import type { GeminiClient } from "../src/worker/gemini";

function fakeGemini(tools: DetectedTool[], description: string): GeminiClient {
  return {
    async generateJSON<T>() { return { tools } as unknown as T; },
    async generateText() { return description; },
  };
}

describe("processVideo", () => {
  it("mints code, writes KV+D1, returns description + links", async () => {
    const kv: Record<string, string> = {};
    const d1videos: { video_code: string; video_title: string }[] = [];
    const d1links: { slug: string }[] = [];
    const deps = {
      gemini: fakeGemini(
        [{ slug: "railway", display_name: "Railway", homepage_url: "" }],
        "DESC",
      ),
      affiliates: {
        railway: { tool: "railway", displayName: "Railway", targetUrl: "https://aff/railway",
          approvalStatus: "Approved", couponStatus: "", couponCode: "", isApproved: true } as AffiliateRecord,
      },
      linkDomain: "go.agrolloo.com",
      existingCodes: async () => new Set<string>(),
      videoCodeForTitle: async () => null,
      existingSlugs: async () => new Set<string>(),
      insertVideo: async (code: string, title: string) => { d1videos.push({ video_code: code, video_title: title }); },
      insertLink: async (slug: string) => { d1links.push({ slug }); },
      kvPut: async (k: string, v: string) => { kv[k] = v; },
    };
    const res = await processVideo("Best hosts", "compare railway", deps);
    expect(res.description).toBe("DESC");
    expect(res.links).toHaveLength(1);
    expect(res.links[0].short_url).toMatch(/^https:\/\/go\.agrolloo\.com\/[a-zA-Z0-9]{4}\/railway$/);
    expect(Object.keys(kv)).toHaveLength(1);
    expect(d1videos).toHaveLength(1);
    expect(d1links).toHaveLength(1);
  });

  it("throws when no tools detected", async () => {
    const deps = {
      gemini: fakeGemini([], ""),
      affiliates: {},
      linkDomain: "go.agrolloo.com",
      existingCodes: async () => new Set<string>(),
      videoCodeForTitle: async () => null,
      existingSlugs: async () => new Set<string>(),
      insertVideo: async () => {},
      insertLink: async () => {},
      kvPut: async () => {},
    };
    await expect(processVideo("x", "", deps)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd youtube/tracker-app && npx vitest run test/linkgen.test.ts`
Expected: FAIL ("processVideo is not a function").

- [ ] **Step 3: Append the orchestrator + interfaces to `linkgen.ts`**

```typescript
// append to src/worker/linkgen.ts
import { detectToolsPrompt, describePrompt } from "./prompts";
import type { GeminiClient } from "./gemini";

export interface LinkGenDeps {
  gemini: GeminiClient;
  affiliates: Record<string, AffiliateRecord>;
  linkDomain: string;
  existingCodes: () => Promise<Set<string>>;
  videoCodeForTitle: (title: string) => Promise<string | null>;
  existingSlugs: (videoCode: string) => Promise<Set<string>>;
  insertVideo: (videoCode: string, title: string) => Promise<void>;
  insertLink: (slug: string, videoCode: string, tool: string, targetUrl: string) => Promise<void>;
  kvPut: (slug: string, targetUrl: string) => Promise<void>;
}

export interface GeneratedLink {
  tool: string;
  short_url: string;
  target_url: string;
  has_affiliate: boolean;
  coupon: string;
}

export interface LinkGenResult {
  video_code: string;
  description: string;
  links: GeneratedLink[];
  non_affiliate_tools: string[];
  short_links_text: string;
  actual_links_text: string;
}

export async function processVideo(
  videoTitle: string,
  videoNotes: string,
  deps: LinkGenDeps,
): Promise<LinkGenResult> {
  if (!videoTitle.trim()) throw new Error("video_title is empty");

  const candidatesBlock = Object.entries(deps.affiliates)
    .map(([slug, rec]) => `- ${slug} — ${rec.displayName}`)
    .join("\n");

  const detectedRaw = await deps.gemini.generateJSON<{ tools?: DetectedTool[] }>(
    detectToolsPrompt(videoTitle, videoNotes, candidatesBlock),
  );
  const detected = (detectedRaw.tools ?? [])
    .filter((t) => t && (t.slug ?? "").trim())
    .map((t) => ({
      slug: t.slug.trim(),
      display_name: (t.display_name || t.slug).trim(),
      homepage_url: (t.homepage_url || "").trim(),
    }));
  if (detected.length === 0) throw new Error("LLM returned no tools — refine notes and try again");

  const resolved = resolveTools(detected, deps.affiliates);
  if (resolved.length === 0) throw new Error("No tools resolved — all detected tools failed URL resolution");

  const existingCode = await deps.videoCodeForTitle(videoTitle);
  let videoCode: string;
  let alreadyPresent = new Set<string>();
  if (existingCode) {
    videoCode = existingCode;
    alreadyPresent = await deps.existingSlugs(videoCode);
  } else {
    videoCode = generateVideoCode(await deps.existingCodes());
    await deps.insertVideo(videoCode, videoTitle);
  }

  const actualItems: [string, string, boolean][] = [];
  const shortPairs: [string, string][] = [];
  const links: GeneratedLink[] = [];
  const nonAffiliate: string[] = [];

  for (const r of resolved) {
    const slug = `${videoCode}/${r.slug}`;
    const short = `https://${deps.linkDomain}/${slug}`;
    actualItems.push([r.slug, r.targetUrl, r.hasAffiliate]);
    shortPairs.push([r.slug, short]);
    links.push({ tool: r.slug, short_url: short, target_url: r.targetUrl, has_affiliate: r.hasAffiliate, coupon: r.couponCode });
    if (!r.hasAffiliate) nonAffiliate.push(r.slug);
    if (alreadyPresent.has(slug)) continue;
    await deps.insertLink(slug, videoCode, r.slug, r.targetUrl);
    await deps.kvPut(slug, r.targetUrl);
  }

  const linksBlock = links
    .map((l) => `- ${l.tool} → ${l.short_url}${l.coupon ? ` (coupon: ${l.coupon})` : ""}`)
    .join("\n");
  const description = await deps.gemini.generateText(describePrompt(videoTitle, videoNotes, linksBlock));

  return {
    video_code: videoCode,
    description,
    links,
    non_affiliate_tools: nonAffiliate,
    short_links_text: formatShortLinks(shortPairs),
    actual_links_text: formatActualLinks(actualItems),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd youtube/tracker-app && npx vitest run test/linkgen.test.ts`
Expected: PASS (all linkgen tests).

- [ ] **Step 5: Commit**

```bash
git add youtube/tracker-app/src/worker/linkgen.ts youtube/tracker-app/test/linkgen.test.ts
git commit -m "feat(tracker-app): add processVideo orchestrator with injected deps"
```

---

## Task 6: `sheets.appendRow`

**Files:**
- Modify: `src/worker/sheets.ts`

- [ ] **Step 1: Add `appendRow` + a `nextRowId` helper to `sheets.ts`** (append at end; reuse existing `sheetsGet`, `colLetter`, `TAB`, `READ_RANGE`, `COLUMNS`)

```typescript
// append to src/worker/sheets.ts

/** Compute the next r#### id by scanning existing row_ids. */
function nextRowId(rows: string[][], rowIdColIdx: number): string {
  let counter = 1;
  for (let i = 1; i < rows.length; i++) {
    const m = (rows[i][rowIdColIdx] ?? "").trim().match(/^r(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= counter) counter = n + 1;
    }
  }
  return `r${String(counter).padStart(4, "0")}`;
}

/**
 * Append a new Master row. `values` maps known Column → value; missing columns are blank.
 * Generates and returns the new row_id. Stamps last_updated.
 */
export async function appendRow(
  token: string,
  sheetId: string,
  values: Partial<Record<Column, string>>,
): Promise<string> {
  const raw = await sheetsGet(token, sheetId, READ_RANGE);
  if (raw.length < 1) throw new Error("Sheet has no header row");
  const header = raw[0].map((h) => h.trim());

  const rowIdColIdx = header.indexOf("row_id");
  if (rowIdColIdx === -1) throw new Error('"row_id" column not found — run ensureRowIds first');

  const rowId = nextRowId(raw, rowIdColIdx);
  const full: Record<string, string> = { ...values, row_id: rowId, last_updated: new Date().toISOString() };

  // Build a row array aligned to the sheet header order.
  const rowArray = header.map((h) => full[h] ?? "");

  const range = `${TAB}!A1`;
  const url =
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}:append` +
    `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [rowArray] }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Sheets append failed (${resp.status}): ${text}`);
  }
  return rowId;
}
```

Note: `SHEETS_BASE`, `TAB`, `READ_RANGE`, `COLUMNS`, `colLetter`, and `Column` are already in scope in `sheets.ts`. If `sheetsGet` is not exported within the module scope, it is (defined there). Verify imports compile.

- [ ] **Step 2: Typecheck**

Run: `cd youtube/tracker-app && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add youtube/tracker-app/src/worker/sheets.ts
git commit -m "feat(tracker-app): add appendRow for creating Master rows"
```

---

## Task 7: Bindings — `Env` + `wrangler.toml`

**Files:**
- Modify: `src/worker/auth.ts` (the `Env` interface)
- Modify: `wrangler.toml`

- [ ] **Step 1: Extend `Env` in `auth.ts`**

Find the `export interface Env { ... }` block and add these fields:

```typescript
  // Affiliate-link generation (App A)
  CLICKS_KV: KVNamespace;
  DB: D1Database;
  GEMINI_API_KEY: string;
  LINK_DOMAIN: string;
  AFFILIATE_PROGRAMS_SHEET_URL: string;
```

- [ ] **Step 2: Add bindings to `wrangler.toml`**

Append after the existing `SESSIONS` KV block:

```toml
[[kv_namespaces]]
binding = "CLICKS_KV"
id = "5d39bf8966014043a2bf7de3ac93fc2b"

[[d1_databases]]
binding = "DB"
database_name = "clicks-db"
database_id = "3415a408-ccc9-49e2-8fe1-60009dfd83ce"

[vars]
LINK_DOMAIN = "go.agrolloo.com"
AFFILIATE_PROGRAMS_SHEET_URL = "PASTE_FROM_ROOT_.env_AFFILIATE_PROGRAMS_SHEET_URL"
```

`GEMINI_API_KEY` is a secret, not a var: it will be set via `npx wrangler secret put GEMINI_API_KEY` (and added to `.dev.vars` locally). Do NOT commit the key.

- [ ] **Step 3: Typecheck**

Run: `cd youtube/tracker-app && npx tsc --noEmit`
Expected: PASS (D1Database/KVNamespace come from `@cloudflare/workers-types`, already used by the existing `SESSIONS`/`ASSETS` bindings).

- [ ] **Step 4: Commit**

```bash
git add youtube/tracker-app/src/worker/auth.ts youtube/tracker-app/wrangler.toml
git commit -m "feat(tracker-app): bind CLICKS_KV, clicks-db D1, and link-gen vars"
```

---

## Task 8: D1/KV adapter for the Worker

**Files:**
- Create: `src/worker/clickstore.ts`

This wraps native D1/KV calls into the `LinkGenDeps` shape, keeping `index.ts` thin and `linkgen.ts` binding-free.

- [ ] **Step 1: Write `clickstore.ts`**

```typescript
/**
 * clickstore.ts
 * Native D1 + KV adapters that satisfy linkgen's injected deps.
 * D1 schema (owned by workers/redirector): videos(video_code, video_title, created_at),
 * links(slug, video_code, tool, target_url, created_at).
 */

export async function existingCodes(db: D1Database): Promise<Set<string>> {
  const { results } = await db.prepare("SELECT video_code FROM videos").all<{ video_code: string }>();
  return new Set((results ?? []).map((r) => r.video_code));
}

export async function videoCodeForTitle(db: D1Database, title: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT video_code FROM videos WHERE video_title = ? LIMIT 1")
    .bind(title)
    .first<{ video_code: string }>();
  return row?.video_code ?? null;
}

export async function existingSlugs(db: D1Database, videoCode: string): Promise<Set<string>> {
  const { results } = await db
    .prepare("SELECT slug FROM links WHERE video_code = ?")
    .bind(videoCode)
    .all<{ slug: string }>();
  return new Set((results ?? []).map((r) => r.slug));
}

export async function insertVideo(db: D1Database, videoCode: string, title: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare("INSERT INTO videos (video_code, video_title, created_at) VALUES (?, ?, ?)")
    .bind(videoCode, title, now)
    .run();
}

export async function insertLink(
  db: D1Database, slug: string, videoCode: string, tool: string, targetUrl: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare("INSERT INTO links (slug, video_code, tool, target_url, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(slug, videoCode, tool, targetUrl, now)
    .run();
}
```

- [ ] **Step 2: Typecheck**

Run: `cd youtube/tracker-app && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add youtube/tracker-app/src/worker/clickstore.ts
git commit -m "feat(tracker-app): add native D1/KV adapters for link generation"
```

---

## Task 9: `POST /api/video` endpoint

**Files:**
- Modify: `src/worker/index.ts`

- [ ] **Step 1: Add the route** (place after the existing `POST /api/update` handler; reuse `getUser`, `getAccessToken`, `appendRow`, `bustBoardCache`)

Add import at top: `import { readRows, updateCell, touchRow, appendRow } from "./sheets";` (extend the existing import line).

```typescript
// POST /api/video  — Admin-only: create a new Master row.
// Body: { video_title, video_notes?, category?, subcategory?, topic_status? }
app.post("/api/video", async (c) => {
  const { roles } = getUser(c);
  if (!roles.includes("Admin")) return c.json({ error: "forbidden" }, 403);

  let body: { video_title?: string; video_notes?: string; category?: string; subcategory?: string; topic_status?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const title = (body.video_title ?? "").trim();
  if (!title) return c.json({ error: "video_title is required" }, 400);

  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);
  const today = new Date().toISOString().slice(0, 10);
  const rowId = await appendRow(token, c.env.SHEET_ID, {
    video_title: title,
    video_notes: (body.video_notes ?? "").trim(),
    category: (body.category ?? "").trim(),
    subcategory: (body.subcategory ?? "").trim(),
    topic_status: (body.topic_status ?? "Draft").trim(),
    topic_date: today,
  });

  await bustBoardCache(c.env);
  return c.json({ row_id: rowId });
});
```

- [ ] **Step 2: Typecheck + build**

Run: `cd youtube/tracker-app && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add youtube/tracker-app/src/worker/index.ts
git commit -m "feat(tracker-app): POST /api/video to create a row (Admin-only)"
```

---

## Task 10: `POST /api/generate-links` endpoint

**Files:**
- Modify: `src/worker/index.ts`

- [ ] **Step 1: Add imports** at top of `index.ts`:

```typescript
import { createGeminiClient } from "./gemini";
import { loadAffiliateRecords } from "./affiliate";
import { processVideo } from "./linkgen";
import * as clickstore from "./clickstore";
```

- [ ] **Step 2: Add the route** (after `/api/video`)

```typescript
// POST /api/generate-links — Admin-only: generate short links + description for a row.
// Body: { row_id }
app.post("/api/generate-links", async (c) => {
  const { roles } = getUser(c);
  if (!roles.includes("Admin")) return c.json({ error: "forbidden" }, 403);

  let body: { row_id?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const rowId = (body.row_id ?? "").trim();
  if (!rowId) return c.json({ error: "row_id is required" }, 400);

  const token = await getAccessToken(c.env.GOOGLE_SA_JSON);
  const allRows = await cachedReadRows(c.env);
  const target = allRows.find((r) => ((r.row_id as string) || "").trim() === rowId);
  if (!target) return c.json({ error: "row not found", row_id: rowId }, 404);
  const title = ((target.video_title as string) ?? "").trim();
  if (!title) return c.json({ error: "row has no video_title" }, 400);
  const notes = ((target.video_notes as string) ?? "").trim();

  try {
    const affiliates = await loadAffiliateRecords(token, c.env.AFFILIATE_PROGRAMS_SHEET_URL);
    const gemini = createGeminiClient(c.env.GEMINI_API_KEY);
    const db = c.env.DB;

    const result = await processVideo(title, notes, {
      gemini,
      affiliates,
      linkDomain: c.env.LINK_DOMAIN,
      existingCodes: () => clickstore.existingCodes(db),
      videoCodeForTitle: (t) => clickstore.videoCodeForTitle(db, t),
      existingSlugs: (code) => clickstore.existingSlugs(db, code),
      insertVideo: (code, t) => clickstore.insertVideo(db, code, t),
      insertLink: (slug, code, tool, url) => clickstore.insertLink(db, slug, code, tool, url),
      kvPut: (k, v) => c.env.CLICKS_KV.put(k, v),
    });

    // Write the three publish-asset cells back onto the row.
    await updateCell(token, c.env.SHEET_ID, rowId, "video_description", result.description);
    await updateCell(token, c.env.SHEET_ID, rowId, "actual_links", result.actual_links_text);
    await updateCell(token, c.env.SHEET_ID, rowId, "short_links", result.short_links_text);
    try { await touchRow(token, c.env.SHEET_ID, rowId); } catch { /* no-op */ }
    await bustBoardCache(c.env);

    return c.json({
      description: result.description,
      links: result.links,
      non_affiliate_tools: result.non_affiliate_tools,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: "generation_failed", message: msg }, 500);
  }
});
```

- [ ] **Step 3: Typecheck + build the SPA**

Run: `cd youtube/tracker-app && npx tsc --noEmit && npm run build`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add youtube/tracker-app/src/worker/index.ts
git commit -m "feat(tracker-app): POST /api/generate-links to mint links + description (Admin-only)"
```

---

## Task 11: Client API wrappers

**Files:**
- Modify: `src/client/api.ts`

- [ ] **Step 1: Append wrappers + types**

```typescript
// append to src/client/api.ts

export interface GeneratedLink {
  tool: string;
  short_url: string;
  target_url: string;
  has_affiliate: boolean;
  coupon: string;
}

export interface GenerateLinksResult {
  description: string;
  links: GeneratedLink[];
  non_affiliate_tools: string[];
}

export async function createVideo(input: {
  video_title: string;
  video_notes?: string;
  category?: string;
  subcategory?: string;
}): Promise<{ row_id: string }> {
  const res = await fetch("/api/video", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await throwOnError(res);
  return res.json() as Promise<{ row_id: string }>;
}

export async function generateLinks(row_id: string): Promise<GenerateLinksResult> {
  const res = await fetch("/api/generate-links", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ row_id }),
  });
  await throwOnError(res);
  return res.json() as Promise<GenerateLinksResult>;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd youtube/tracker-app && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add youtube/tracker-app/src/client/api.ts
git commit -m "feat(tracker-app): client wrappers for createVideo + generateLinks"
```

---

## Task 12: "Generate links & description" UI in CardDetail

**Files:**
- Modify: `src/client/CardDetail.tsx`

- [ ] **Step 1: Add imports + state**

Extend the api import:
```typescript
import { updateCell, review, displayName, ForbiddenError, generateLinks } from "./api";
import type { GenerateLinksResult } from "./api";
```

Inside the `CardDetail` component body (with the other `useState` calls), add:
```typescript
const isAdmin = roles.includes("Admin");
const [genLoading, setGenLoading] = useState(false);
const [genResult, setGenResult] = useState<GenerateLinksResult | null>(null);
const [genError, setGenError] = useState<string | null>(null);

async function handleGenerate() {
  setGenLoading(true);
  setGenError(null);
  try {
    const r = await generateLinks((row.row_id as string) || "");
    setGenResult(r);
    onSaved(); // refresh the board so the saved cells show
  } catch (e) {
    setGenError(e instanceof Error ? e.message : String(e));
  } finally {
    setGenLoading(false);
  }
}
```

- [ ] **Step 2: Render the action**

In the JSX, inside the "publish" section (or just below the section list — find where `SECTIONS` are rendered and add this block for admins only), insert:

```tsx
{isAdmin && (
  <div className="generate-links-panel" style={{ marginTop: 12, padding: 12, border: "1px solid var(--border, #333)", borderRadius: 8 }}>
    <button onClick={handleGenerate} disabled={genLoading}>
      {genLoading ? "Generating…" : "Generate links & description"}
    </button>
    {genError && <p style={{ color: "#e06c75" }}>{genError}</p>}
    {genResult && (
      <div style={{ marginTop: 10 }}>
        <h4>Description</h4>
        <textarea readOnly value={genResult.description} rows={6} style={{ width: "100%" }} />
        <button onClick={() => navigator.clipboard.writeText(genResult.description)}>Copy description</button>
        <h4 style={{ marginTop: 10 }}>Short links</h4>
        <ul>
          {genResult.links.map((l) => (
            <li key={l.tool}>
              <code>{l.tool}</code>: <a href={l.short_url} target="_blank" rel="noreferrer">{l.short_url}</a>
              {!l.has_affiliate && <span style={{ color: "#e5c07b" }}> (no affiliate — verify URL)</span>}
              {" "}
              <button onClick={() => navigator.clipboard.writeText(l.short_url)}>Copy</button>
            </li>
          ))}
        </ul>
        {genResult.non_affiliate_tools.length > 0 && (
          <p style={{ color: "#e5c07b" }}>
            Verify these non-affiliate URLs: {genResult.non_affiliate_tools.join(", ")}
          </p>
        )}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Build the SPA**

Run: `cd youtube/tracker-app && npx tsc --noEmit && npm run build`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add youtube/tracker-app/src/client/CardDetail.tsx
git commit -m "feat(tracker-app): Generate links & description action in card detail (Admin)"
```

---

## Task 13: "New Video" button + modal in Board

**Files:**
- Modify: `src/client/Board.tsx`

- [ ] **Step 1: Add imports + state** near the top of the `Board` component:

```typescript
import { createVideo } from "./api";
// ... inside component:
const [showNewVideo, setShowNewVideo] = useState(false);
const [nvTitle, setNvTitle] = useState("");
const [nvNotes, setNvNotes] = useState("");
const [nvCategory, setNvCategory] = useState("");
const [nvSubcategory, setNvSubcategory] = useState("");
const [nvBusy, setNvBusy] = useState(false);
const [nvError, setNvError] = useState<string | null>(null);

async function submitNewVideo() {
  if (!nvTitle.trim()) { setNvError("Title is required"); return; }
  setNvBusy(true); setNvError(null);
  try {
    await createVideo({ video_title: nvTitle.trim(), video_notes: nvNotes.trim(), category: nvCategory.trim(), subcategory: nvSubcategory.trim() });
    setShowNewVideo(false);
    setNvTitle(""); setNvNotes(""); setNvCategory(""); setNvSubcategory("");
    // trigger a board reload — Board already has a refresh path; call the same loader used after edits.
    window.location.reload();
  } catch (e) {
    setNvError(e instanceof Error ? e.message : String(e));
  } finally {
    setNvBusy(false);
  }
}
```

Note: if `Board.tsx` exposes a `reload()`/`refresh()` callback (used after edits), call that instead of `window.location.reload()` — prefer it. Check the component's existing refresh mechanism and use it.

- [ ] **Step 2: Render the button (Admin-only) + modal**

Where the Admin tab bar / board header is rendered, add a button visible only when the user holds `Admin` (the component already knows `roles`):

```tsx
{roles.includes("Admin") && (
  <button onClick={() => setShowNewVideo(true)}>+ New Video</button>
)}

{showNewVideo && (
  <div className="modal-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
    <div className="modal" style={{ background: "var(--bg, #1e1e1e)", padding: 20, borderRadius: 10, width: 480, maxWidth: "90vw" }}>
      <h3>New Video</h3>
      <label>Title<input value={nvTitle} onChange={(e) => setNvTitle(e.target.value)} style={{ width: "100%" }} /></label>
      <label>Notes<textarea value={nvNotes} onChange={(e) => setNvNotes(e.target.value)} rows={4} style={{ width: "100%" }} /></label>
      <label>Category<input value={nvCategory} onChange={(e) => setNvCategory(e.target.value)} style={{ width: "100%" }} /></label>
      <label>Subcategory<input value={nvSubcategory} onChange={(e) => setNvSubcategory(e.target.value)} style={{ width: "100%" }} /></label>
      {nvError && <p style={{ color: "#e06c75" }}>{nvError}</p>}
      <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={() => setShowNewVideo(false)} disabled={nvBusy}>Cancel</button>
        <button onClick={submitNewVideo} disabled={nvBusy}>{nvBusy ? "Creating…" : "Create"}</button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Build the SPA**

Run: `cd youtube/tracker-app && npx tsc --noEmit && npm run build`
Expected: both PASS.

- [ ] **Step 4: Commit**

```bash
git add youtube/tracker-app/src/client/Board.tsx
git commit -m "feat(tracker-app): New Video button + modal (Admin)"
```

---

## Task 14: Full test + build gate

- [ ] **Step 1: Run the whole suite**

Run: `cd youtube/tracker-app && npm test`
Expected: all tests PASS (the existing 129 + new affiliate/linkgen tests).

- [ ] **Step 2: Typecheck + build**

Run: `cd youtube/tracker-app && npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit (if any lint/format fixups were needed)**

```bash
git add -A youtube/tracker-app
git commit -m "test(tracker-app): green suite + build for link generation" || echo "nothing to commit"
```

---

## Task 15: Deprecate the Python path

**Files:**
- Modify: `youtube/yt-analysis/process_yt_tracker.py`
- Modify: `docs/yt-tracker-workflow.md`

- [ ] **Step 1: Add a deprecation note at the top of `process_yt_tracker.py`** (right under the module docstring)

```python
# DEPRECATED (2026-06-15): This workflow now lives in the tracker-app UI
# (Admin → New Video → "Generate links & description"). The canonical logic is
# ported to youtube/tracker-app/src/worker/linkgen.ts. This script is retained
# for reference only and is no longer maintained. See
# docs/superpowers/specs/2026-06-15-tracker-link-generation-design.md.
```

- [ ] **Step 2: Mark the workflow doc superseded** — add at the top of `docs/yt-tracker-workflow.md`, under the title:

```markdown
> **Superseded (2026-06-15):** Tracker processing now runs in the tracker-app UI
> (Admin → New Video → "Generate links & description"), not this script. Kept for
> historical reference. See `docs/superpowers/specs/2026-06-15-tracker-link-generation-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add youtube/yt-analysis/process_yt_tracker.py docs/yt-tracker-workflow.md
git commit -m "docs: deprecate process_yt_tracker.py in favor of tracker-app UI"
```

---

## Deployment (manual, after code is merged — not part of TDD loop)

1. `cd youtube/tracker-app`
2. Put the affiliate sheet URL into `wrangler.toml` `[vars]` (from root `.env` `AFFILIATE_PROGRAMS_SHEET_URL`).
3. `npx wrangler secret put GEMINI_API_KEY` (paste the key from root `.env`).
4. Add the same vars to `.dev.vars` for local dev.
5. **Share the Affiliate Programs sheet** with the app's service account (`n8n-google-sa@n8n-workflows-454504.iam.gserviceaccount.com`) as Viewer.
6. `npm run build && npx wrangler deploy`.
7. Smoke test: log in as Admin → New Video → Generate → confirm a `go.agrolloo.com/<code>/<tool>` link redirects and a click shows up via `sync_clicks.py`.

---

## Self-Review notes

- **Spec coverage:** create row (Task 9), generate links+desc (Tasks 1–10), KV/D1 reuse (Tasks 7–8), RBAC Admin-only (Tasks 9–10), error handling (Task 10 try/catch + skip logic in Task 4/5), idempotency by title (Task 5/8), tests (Tasks 3–5, 14), Python retirement (Task 15), generic-ready Gemini (Task 1 self-contained client). All covered.
- **Idempotency:** `videoCodeForTitle` + `existingSlugs` reuse code and skip present slugs (Task 5/8), matching the Python behavior and keeping `sync_clicks.py` joins intact.
- **No partial writes on failure:** sheet write-backs happen only after `processVideo` succeeds (Task 10); a Gemini/zero-tool failure throws before any sheet mutation. (KV/D1 inserts inside `processVideo` are idempotent on re-run.)
- **Type consistency:** `LinkGenDeps`, `GeneratedLink`, `AffiliateRecord`, `DetectedTool`, `GeminiClient` are defined once and reused across worker + client types.
