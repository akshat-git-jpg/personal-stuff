---
executor: agy
model:
test_cmd: cd apps/tutorial-tracker-app && npm test
ui:
deploy: cd apps/tutorial-tracker-app && npx wrangler d1 execute tracker-db --remote --file=migrations/0004_backfill_card_slugs.sql
needs: ["Nothing. 0003_card_slug.sql (PR#200) already landed and added the nullable column plus the unique partial index."]
needs_prs: []
touches: [apps/tutorial-tracker-app/migrations/0004_backfill_card_slugs.sql, apps/tutorial-tracker-app/test/slug-backfill.test.ts]

mutation_apply: python3 -c "import io;p='apps/tutorial-tracker-app/migrations/0004_backfill_card_slugs.sql';s=io.open(p,encoding='utf-8').read();s=s.replace(\"SET slug = 'wise-vs-paypal-my-honest-recommendation'\",\"SET slug = 'wise-vs-revolut-my-honest-recommendation'\",1);io.open(p,'w',encoding='utf-8').write(s)"
mutation_command: npm test
mutation_expect: duplicate slug
mutation_cwd: apps/tutorial-tracker-app
mutation_timeout: 600
---

# Plan 250: backfill the slug for all 76 live cards

## Summary

- **Problem statement**: `0003_card_slug.sql` added `cards.slug` as **nullable**, and
  `239`/`240`/`241` only mint a slug for **newly created** cards. Production still reads
  `cards: 76, with_slug: 0, missing: 76`. Every downstream consumer built in 239-241 (the
  affiliate chain, `clicks-db`, the script desk, the registry sync) keys off `cards.slug`,
  so for all 76 existing videos those paths have nothing to work with.
- **Goals**:
  - Mint the canonical slug **once** for all 76 cards, using the already-landed
    `slugify` + `mintSlug` from `src/shared/slug.ts` — no second slug rule.
  - Make the backfill idempotent, so re-running it can never renumber a minted slug.
  - Land a test that fails if two cards would ever share a slug.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High). The hard part (the exact 76-row
  mapping) is fully inlined below and already dry-run verified; the executor places two
  files.
- **Done criteria**: `npm test` green in `apps/tutorial-tracker-app`, the new test asserts
  76 unique non-empty slugs, and after the deploy step production reports
  `cards: 76, with_slug: 76`.
- **Stop conditions**: any slug in the table below differs from what `slugify` produces at
  execution time; the migration touches any column other than `slug`; the unique index
  rejects an insert.
- **Test / verification for success**: a new vitest file that parses the migration SQL and
  asserts shape, uniqueness, count, and the `slug IS NULL` guard on every statement.
- **Open points for plan readiness**: none.

## Executor instructions

Drift check before you start:

```bash
git diff --stat f8eb55f2..HEAD -- apps/tutorial-tracker-app/src/shared/slug.ts \
  apps/tutorial-tracker-app/migrations/
```

If `src/shared/slug.ts` changed, **STOP** — the table below was generated from it.

## Status

- **Priority**: high (it unblocks every slug consumer built in 239-241)
- **Effort**: small — two new files, no source changes
- **Risk**: medium — this mints permanent identity for 76 real videos
- **Depends on**: nothing (PR#200 landed)
- **Category**: bug
- **Difficulty**: standard
- **Planned-at SHA**: `f8eb55f2`

## Why this matters

A slug is permanent. `docs/specs/2026-08-25-video-identity-design.md` states it is minted
once at card creation and frozen — the tracker deliberately puts `slug` only in
`createFields`, so it never appears on an edit surface. That is exactly why the backfill has
to be right the first time: there is no rename path, by design, and the registry "NEVER
renames a directory" either.

## Current state

`apps/tutorial-tracker-app/migrations/0003_card_slug.sql` (landed, applied to prod):

```sql
ALTER TABLE cards ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_slug ON cards (slug) WHERE slug IS NOT NULL;
```

Its own comment says "cards created before this migration have no slug **until backfilled**".
This plan is that backfill.

Production, queried 2026-08-25 via the D1 HTTP API:

```
SELECT COUNT(*) AS cards, COUNT(slug) AS with_slug FROM cards
-> { cards: 76, with_slug: 0 }
```

`src/shared/slug.ts` exports `slugify(title)` and
`mintSlug(title, taken, cardId)`. `mintSlug` appends `-2`, `-3`, ... when a base slug is
already claimed, and falls back to `video-<cardId>` for a title with no usable characters.
**Do not re-implement either.** The table below is their output.

### The six duplicate-title groups are real videos, not junk cards

Thirteen cards fall into six groups that share an exact title, so `mintSlug` assigns a
numeric suffix. These were checked before generating the table — each card in a group
carries a **different `extra_json.topic_date`**, i.e. they are re-records of the same
video made on different dates:

| Base slug | Cards (id -> topic_date) |
|---|---|
| `fliki-ai-coupon-code-still-working` | r0040 -> 2024-09-09, r0062 -> 2025-07-10 |
| `invideo-ai-coupon-code-still-working` | r0042 -> 2024-09-09, r0051 -> 2024-09-17, r0064 -> 2025-07-10 |
| `submagic-promo-code-still-working` | r0043 -> 2024-09-15, r0070 -> 2025-07-10 |
| `tradingview-coupon-code-tradingview` | r0047 -> 2024-09-16, r0067 -> 2025-07-10 |
| `jenni-ai-promo-code-still-working` | r0052 -> 2024-09-17, r0075 -> 2025-07-10 |
| `everbee-promo-code-still-working` | r0057 -> 2024-09-17, r0066 -> 2025-07-10 |

In every group, **card-id order is also chronological order**, so `-2` / `-3` reads as
"the 2nd / 3rd time this video was made". That is why the table is generated in card-id
order and why the order is part of the answer: a different iteration order would attach
the suffix to a different video.

## Commands you will need

```bash
cd apps/tutorial-tracker-app
npm test                      # vitest run; this is the merge gate
```

## Scope

**In scope — create these two files only:**

- `apps/tutorial-tracker-app/migrations/0004_backfill_card_slugs.sql`
- `apps/tutorial-tracker-app/test/slug-backfill.test.ts`

**Out of scope — do not touch:**

- `src/shared/slug.ts` — the mapping was generated from it; changing it invalidates the table.
- `migrations/0003_card_slug.sql` — already applied to prod.
- Any `src/worker/**` or `src/client/**` file — new-card minting already works.
- The `clicks-db` database — plan 241 owns it.

## Steps

### Step 1 — write the migration

Create `apps/tutorial-tracker-app/migrations/0004_backfill_card_slugs.sql`. It starts with
this header, then **one guarded UPDATE per row of the table in the appendix, in that exact
order**:

```sql
-- Backfill the canonical slug for every card that predates 0003_card_slug.sql.
-- Generated by running apps/tutorial-tracker-app/src/shared/slug.ts (slugify +
-- mintSlug) over the 76 live cards in card-id order. Card-id order is also
-- chronological order here, so a -2/-3 suffix reads as "the 2nd/3rd time this
-- video was made" - see the plan for the evidence.
--
-- Idempotent: every UPDATE is guarded on slug IS NULL, so re-running this
-- migration can never renumber a slug that has already been minted.

-- r0027  Wise vs Revolut (My HONEST Recommendation)
UPDATE cards SET slug = 'wise-vs-revolut-my-honest-recommendation' WHERE id = 'r0027' AND slug IS NULL;
-- r0028  BEST Email Marketing Software 2024: Which One Should You Choose?
```

Each statement has this exact shape (`slug IS NULL` is what makes it idempotent):

```sql
-- r0027  Wise vs Revolut (My HONEST Recommendation)
UPDATE cards SET slug = 'wise-vs-revolut-my-honest-recommendation' WHERE id = 'r0027' AND slug IS NULL;
```

**Verify:**

```bash
grep -c '^UPDATE cards' apps/tutorial-tracker-app/migrations/0004_backfill_card_slugs.sql
# expected: 76
grep -c "AND slug IS NULL;" apps/tutorial-tracker-app/migrations/0004_backfill_card_slugs.sql
# expected: 76
```

### Step 2 — write the test

Create `apps/tutorial-tracker-app/test/slug-backfill.test.ts`. It reads the migration file
as text and asserts the properties below. Follow the style of the neighbouring
`test/slug.test.ts`.

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { slugify } from "../src/shared/slug";

const SQL = readFileSync(
  new URL("../migrations/0004_backfill_card_slugs.sql", import.meta.url),
  "utf8",
);

/** [id, slug, commentedTitle] for every UPDATE, in file order. */
function parse() {
  const out: Array<{ id: string; slug: string; title: string }> = [];
  const lines = SQL.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(
      /^UPDATE cards SET slug = '(.+)' WHERE id = '(.+)' AND slug IS NULL;$/,
    );
    if (!m) continue;
    const c = (lines[i - 1] ?? "").match(/^-- (\S+)\s+(.*)$/);
    out.push({ slug: m[1], id: m[2], title: c ? c[2] : "" });
  }
  return out;
}

describe("0004 slug backfill", () => {
  const rows = parse();

  it("covers every live card exactly once", () => {
    expect(rows).toHaveLength(76);
    expect(new Set(rows.map((r) => r.id)).size).toBe(76);
  });

  it("mints no duplicate slug", () => {
    const seen = new Set<string>();
    for (const r of rows) {
      // the unique partial index on cards(slug) would reject this in production
      expect(seen.has(r.slug), `duplicate slug ${r.slug} (${r.id})`).toBe(false);
      seen.add(r.slug);
    }
  });

  it("mints no empty or malformed slug", () => {
    for (const r of rows) {
      expect(r.slug).not.toBe("");
      expect(r.slug).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/);
      expect(r.slug.length).toBeLessThanOrEqual(45); // 40 + a -NN suffix
    }
  });

  it("every UPDATE is guarded, so re-running renumbers nothing", () => {
    const updates = SQL.split("\n").filter((l) => l.startsWith("UPDATE cards"));
    expect(updates).toHaveLength(76);
    for (const u of updates) expect(u).toContain("AND slug IS NULL;");
  });

  it("touches only the slug column", () => {
    expect(SQL).not.toMatch(/\b(DROP|DELETE|ALTER|INSERT)\b/i);
    for (const u of SQL.split("\n").filter((l) => l.startsWith("UPDATE cards"))) {
      expect(u).toMatch(/^UPDATE cards SET slug = /);
    }
  });

  it("agrees with slugify, ignoring the collision suffix", () => {
    for (const r of rows) {
      if (!r.title) continue;
      const base = slugify(r.title);
      if (!base) continue;
      // r.slug is either the base, or the base plus -2 / -3 / ...
      expect(r.slug === base || new RegExp(`^${base}-\\d+$`).test(r.slug)).toBe(true);
    }
  });
});
```

**Verify:**

```bash
cd apps/tutorial-tracker-app && npm test
# expected: all suites pass, including "0004 slug backfill" (6 tests)
```

### Step 3 — confirm the gate can actually fire

Apply the mutation from the frontmatter (it makes `r0029`'s slug a duplicate of `r0027`'s),
re-run `npm test`, and confirm it FAILS printing `duplicate slug`. Then revert it.

**Verify:** clean passes -> mutated fails with `duplicate slug` -> reverted passes.

## Test plan

The one new file is `test/slug-backfill.test.ts` described above. It is a pure text test —
it needs no D1, no network and no `.dev.vars`, so it runs in any checkout.

## Done criteria

```bash
cd apps/tutorial-tracker-app && npm test            # exit 0
grep -c '^UPDATE cards' migrations/0004_backfill_card_slugs.sql   # 76
grep -c 'AND slug IS NULL;' migrations/0004_backfill_card_slugs.sql # 76
```

After the **deploy** step (owner-gated, boss runs it only on an explicit "deploy"):

```
SELECT COUNT(*) AS cards, COUNT(slug) AS with_slug FROM cards
-> { cards: 76, with_slug: 76 }
```

## STOP conditions

- **`slugify` output differs from the table.** The drift check catches this. Do not
  "fix" the table — stop and report.
- **A gate assertion fails.** Fix the migration, never the assertion. Weakening, swapping
  or deleting an assertion in `slug-backfill.test.ts` is a STOP.
- **You are tempted to write a second slug rule** (a date suffix, a hash, a manual rename).
  There is exactly one rule and it lives in `src/shared/slug.ts`. Stop and report.
- **The migration wants to touch any column but `slug`.** Stop.
- **You are about to run the deploy command yourself.** Don't. Deploy is owner-gated.

## Maintenance notes

- This migration is a **one-shot**. Once prod reports 76/76, every statement in it is inert
  because of the `slug IS NULL` guard. Leave the file in place as the record of what was
  minted.
- A future card whose title collides with one of these gets `-2` / `-3` from `mintSlug` at
  creation time, using the same `taken` set read from the DB. Nothing here special-cases it.
- A reviewer should scrutinise the six duplicate-title groups above. If any of those pairs
  turns out to be an accidental duplicate card rather than a re-record, the fix is to
  **delete the extra card**, not to renumber the slug.

## Appendix — the 76 card-to-slug mapping

Generated by running `slugify` + `mintSlug` from `src/shared/slug.ts` over the live cards
in card-id order. Dry-run verified against an in-memory SQLite carrying the same unique
partial index as production: 76 rows in, 76 unique slugs out, a second run changed nothing,
and a hand-set slug survived untouched.

| Card | Title | Slug |
|---|---|---|
| `r0027` | Wise vs Revolut (My HONEST Recommendation) | `wise-vs-revolut-my-honest-recommendation` |
| `r0028` | BEST Email Marketing Software 2024: Which One Should You Choose? | `best-email-marketing-software-2024-which` |
| `r0029` | Wise vs PayPal (My HONEST Recommendation) | `wise-vs-paypal-my-honest-recommendation` |
| `r0030` | ActiveCampaign vs Mailchimp : Which one is right for you? | `activecampaign-vs-mailchimp-which-one` |
| `r0031` | ActiveCampaign vs MailerLite : Which one is right for you? | `activecampaign-vs-mailerlite-which-one` |
| `r0032` | Pictory Coupon Code (Highest Pictory Discount Code) – Still Working | `pictory-coupon-code-highest-pictory` |
| `r0033` | Fliki AI Coupon Code (Highest Fliki AI Discount Code) – Still Working | `fliki-ai-coupon-code-highest-fliki-ai` |
| `r0034` | Invideo Coupon Code (Highest Invideo Discount code) – Still Working | `invideo-coupon-code-highest-invideo` |
| `r0035` | Heygen Ai Review : Best AI Avatar Generator | `heygen-ai-review-best-ai-avatar` |
| `r0036` | Heygen vs Synthesia: Which one is right for you? | `heygen-vs-synthesia-which-one-right` |
| `r0037` | VidIQ Vs TubeBuddy: Which one is right for you? | `vidiq-vs-tubebuddy-which-one-right` |
| `r0038` | Shopify VS WooCommerce: Which one is right for you? | `shopify-vs-woocommerce-which-one-right` |
| `r0039` | Pictory vs Invideo vs Fliki vs Synthesia vs Lumen5 \| Best AI Video Generator | `pictory-vs-invideo-vs-fliki-vs-synthesia` |
| `r0040` | Fliki AI Coupon Code – Still Working | `fliki-ai-coupon-code-still-working` |
| `r0041` | Envato Elements Coupon Code – Still Working | `envato-elements-coupon-code-still` |
| `r0042` | Invideo AI Coupon Code – Still Working | `invideo-ai-coupon-code-still-working` |
| `r0043` | Submagic Promo Code – Still Working | `submagic-promo-code-still-working` |
| `r0044` | TubeBuddy Coupon Code – Still Working | `tubebuddy-coupon-code-still-working` |
| `r0045` | VidIQ Promo Code \| VidIQ Coupon Code – Still Working | `vidiq-promo-code-vidiq-coupon-code-still` |
| `r0046` | Namecheap Coupon Code – Still Working | `namecheap-coupon-code-still-working` |
| `r0047` | TradingView Coupon Code \| TradingView Discount Code – Still Working | `tradingview-coupon-code-tradingview` |
| `r0048` | Dropship.io Promo Code – Still Working | `dropship-io-promo-code-still-working` |
| `r0049` | AutoDS Coupon Code – Still Working | `autods-coupon-code-still-working` |
| `r0050` | Leonardo Ai Coupon Code \| Leonardo Ai Discount Code – Still Working | `leonardo-ai-coupon-code-leonardo-ai` |
| `r0051` | Invideo AI Coupon Code – Still Working | `invideo-ai-coupon-code-still-working-2` |
| `r0052` | Jenni AI Promo Code – Still Working | `jenni-ai-promo-code-still-working` |
| `r0053` | PiPiADS Coupon Code – Still Working | `pipiads-coupon-code-still-working` |
| `r0054` | Systeme.io Coupon Code – Still Working | `systeme-io-coupon-code-still-working` |
| `r0055` | Synthesia Promo Code – Still Working | `synthesia-promo-code-still-working` |
| `r0056` | Murf AI Promo Code – Still Working | `murf-ai-promo-code-still-working` |
| `r0057` | EverBee Promo Code – Still Working | `everbee-promo-code-still-working` |
| `r0058` | Jungle Scout Coupon Code – Still Working | `jungle-scout-coupon-code-still-working` |
| `r0059` | Glitching Ai Promo Code – Still Working | `glitching-ai-promo-code-still-working` |
| `r0060` | InVideo Studio vs InVideo AI: Which one is right for you? | `invideo-studio-vs-invideo-ai-which-one` |
| `r0061` | Fliki Ai Promo code  – Still Working | `fliki-ai-promo-code-still-working` |
| `r0062` | Fliki AI Coupon Code – Still Working | `fliki-ai-coupon-code-still-working-2` |
| `r0063` | Invideo AI Discount Code– Still Working | `invideo-ai-discount-code-still-working` |
| `r0064` | Invideo AI Coupon Code – Still Working | `invideo-ai-coupon-code-still-working-3` |
| `r0065` | Everbee Coupon Code – Still Working | `everbee-coupon-code-still-working` |
| `r0066` | EverBee Promo Code – Still Working | `everbee-promo-code-still-working-2` |
| `r0067` | TradingView Coupon Code \| TradingView Discount Code – Still Working | `tradingview-coupon-code-tradingview-2` |
| `r0068` | TradingView  Promo Code– Still Working | `tradingview-promo-code-still-working` |
| `r0069` | Submagic Coupon Code – Still Working | `submagic-coupon-code-still-working` |
| `r0070` | Submagic Promo Code – Still Working | `submagic-promo-code-still-working-2` |
| `r0071` | Elevenlabs Promo Code \| Elevenlabs Coupon Code – Still Working – Still Working | `elevenlabs-promo-code-elevenlabs-coupon` |
| `r0072` | Crayo AI Promo Code – Still Working | `crayo-ai-promo-code-still-working` |
| `r0073` | Creatify AI Coupon Code – Still Working | `creatify-ai-coupon-code-still-working` |
| `r0074` | Filmora Coupon Code 2025 \| Wondershare coupon code \| Filmora 14 Coupon Code – Still Working | `filmora-coupon-code-2025-wondershare` |
| `r0075` | Jenni AI Promo Code – Still Working | `jenni-ai-promo-code-still-working-2` |
| `r0076` | Helium 10 Coupon Code – Still Working | `helium-10-coupon-code-still-working` |
| `r0077` | HeyGen Coupon Code \| Heygen Promo Code – Still Working | `heygen-coupon-code-heygen-promo-code` |
| `r0078` | Kittl Coupon code – Still Working | `kittl-coupon-code-still-working` |
| `r0079` | Lovable AI Promo Code – Still Working | `lovable-ai-promo-code-still-working` |
| `r0080` | HeyGen vs Synthesia: BEST AI Avatar Video Generator | `heygen-vs-synthesia-best-ai-avatar-video` |
| `r0081` | Heygen vs Synthesia vs Creatify vs D-ID vs Veed.io \| Best AI Avatar Generator | `heygen-vs-synthesia-vs-creatify-vs-d-id` |
| `r0082` | HeyGen AI Review & Tutorial | `heygen-ai-review-tutorial` |
| `r0083` | Base44 vs Lovable: Which is the best AI builder? | `base44-vs-lovable-which-best-ai-builder` |
| `r0084` | N8N vs Flowise: Which Is The Best No-Code Automation Tool? | `n8n-vs-flowise-which-best-no-code` |
| `r0085` | LangChain vs N8N:  Which One is Better for Automations? | `langchain-vs-n8n-which-one-better` |
| `r0086` | OpenArt Promo Code – Working | `openart-promo-code-working` |
| `r0087` | Base44 Coupon Code | `base44-coupon-code` |
| `r0088` | N8N coupon code | `n8n-coupon-code` |
| `r0089` | Lovable Vs Base44 Vs Bolt Vs Replit Vs Cursor | `lovable-vs-base44-vs-bolt-vs-replit-vs` |
| `r0090` | Submagic Coupon Code | `submagic-coupon-code` |
| `r0091` | Book Bolt Coupon Code | `book-bolt-coupon-code` |
| `r0105` | How to Make a Realistic AI Clone of Yourself | `how-make-realistic-ai-clone-yourself` |
| `r0107` | N8n vs  flowise vs zapier vs make vs langchain \| Best No-Code Automation Tool | `n8n-vs-flowise-vs-zapier-vs-make-vs` |
| `r0108` | Submagic vs Opus Clip | `submagic-vs-opus-clip` |
| `r0109` | lovable vs claude code | `lovable-vs-claude-code` |
| `r0110` | How To Create Long AI Animation Videos with Consistent Characters \|how to create animated story videos with ai ( full guide) | `how-create-long-ai-animation-videos-with` |
| `r0111` | How to Create a Consistent AI Influencer that Gets Sponsors (Full Course) | `how-create-consistent-ai-influencer-gets` |
| `r0112` | egypt - how to create realistic ai talking avatar (with 100% Lip Sync) | `egypt-how-create-realistic-ai-talking` |
| `r0113` | higgsfiled vs openart vs synthesa vs heygen vs arcads \|best ai video generator | `higgsfiled-vs-openart-vs-synthesa-vs` |
| `r0114` | best realistic ai avatar generator for youtube videos | `best-realistic-ai-avatar-generator` |
| `r0115` | OpenArt AI Review | `openart-ai-review` |
| `r0116` | openart VS higgsfield | `openart-vs-higgsfield` |
