# Capture cleanup — LLM-judged, text-preserving

**Date:** 2026-06-09
**Project:** personal-dashboard (`/Users/kbtg/codebase/personal stuff/personal-dashboard`)
**Status:** approved, ready for plan

## Problem

Capture currently has two modes, both wrong for the user:

1. **Old (removed):** the LLM rephrased the captured line. It dropped/changed parts
   the user wanted to keep, so it was turned off.
2. **Current:** the LLM only fills metadata (deadline/time/schedule/tags); the user's
   text is stored byte-for-byte. This keeps cruft — "remind me to", filler, and the
   date words that were already promoted into the deadline.

The user wants the middle ground: the LLM **understands** the line (to extract
deadline/schedule/context), and the stored text is the user's line **minus only the
redundant bits** — filler and any words already captured as structured metadata.

## Decision

Rely entirely on the LLM, steered by a better prompt. **No code-side verifier, no
filler word lists, no raw-original column.** The model decides what is filler and what
to keep; we make that behavior reliable through an explicit, conservative prompt
contract and few-shot examples. If the model ever over-trims, the user edits the row
(every row is already click-to-edit).

Rejected alternatives (for the record):
- Deterministic `verifiedClean` subsequence guard — user chose to trust the LLM instead.
- Curated filler/date removable-word list — too brittle.
- Storing the raw original for recovery — unnecessary; click-to-edit is the recovery path.

## The cleanup contract (shared across all categories)

Every cleanup prompt instructs the model to return a string that:

- Uses **only the user's own words, in their original order**.
- Removes **only**:
  - throat-clearing / filler ("remind me to", "I need to", "don't forget to",
    "gonna", "ugh", "like", "just", etc. — by judgment, not a fixed list), and
  - words that were already captured as structured metadata for that category
    (the date/time words for to-dos; the day/duration words for habits).
- Does **not** reword, paraphrase, translate, expand abbreviations, fix grammar, or
  reorder words.
- Never invents words that were not in the input.
- When unsure whether a word matters, **keeps it**.
- Reads naturally — like the user wrote it, minus the cruft.

Each prompt carries 2–3 few-shot examples to anchor the behavior, e.g.:
- to-do: `remind me to call the bank tomorrow about the loan` → `call the bank about the loan` (deadline = tomorrow)
- to-do: `ugh I really need to finally book the dentist` → `book the dentist`
- habit: `gym every mon wed fri` → `gym` (schedule = Mon/Wed/Fri)

## Per-category behavior

| Category | Cleaned text = input minus… | Metadata still extracted |
|---|---|---|
| To-do | filler + extracted date/time words | deadline, time, area, priority, tags |
| Habit | filler + extracted day/duration words | weekdays, mode, start/end date, tags |
| Mindset | filler only (no dates to pull) | tags |
| Note | filler only; change as little as possible | tags |

Mindset and Note will usually come back nearly identical — that is intended.

## Implementation outline

### `src/lib/capture.js`
- Update prompts to the cleanup contract above, with few-shot examples:
  - `buildSystemPrompt` (to-do `parseCapture`)
  - `buildClassifyPrompt` (no-prefix `classifyCapture`)
  - `buildHabitPrompt` (`parseHabit` — already says "strip duration/day words"; tighten
    to the contract and add examples)
  - `parseRemember` — **change from rephrase to deletion-only.** Drop the "turn a
    rambled thought into a concise line" instruction; apply the cleanup contract
    (filler only). Set `temperature: 0`.
- Add `parseNote(text, { model, key, captureRules, existingTags }) → { text, tags }`:
  filler-only cleanup + tags, "this is a factual note, change as little as possible."
  Non-throwing; fallback `{ text: trimmed, tags: [] }`.
- Each parser returns the **LLM's cleaned text** as the title/name/text (today's
  fallbacks on error / missing key are unchanged: chrono + verbatim text).

### `src/routes/capture.routes.js`
Stop forcing verbatim `body`; use the parser output:
- to-do: `createTodo(parsed)` (was `{ ...parsed, title: body }`)
- habit: `createHabit(h)` (was `{ ...h, name: body }`)
- mindset: `createRemember(result.text, result.tags)` (was `createRemember(body, …)`)
- note: `const r = await parseNote(body, llmOpts); createNote(r.text, r.tags)`
  (was `deriveTags` + verbatim body)
- no-prefix classify path: use `c.title` / parser text instead of `text.trim()`
- `deriveTags` becomes unused once notes route to `parseNote`; remove it.

### Fallback (unchanged)
No API key, error, or timeout → existing `chronoFallback` keeps the user's verbatim
text. Capture never blocks and never loses the line.

## Testing

- Manual capture checks per category (key present): confirm filler/date words are
  dropped and substantive words are preserved verbatim.
- Fallback path (key blank): confirm text is stored verbatim.
- No new pure functions to unit-test (the verifier was cut).

## Out of scope

- Voice input changes (capture text is already whatever reaches `/api/capture`).
- Any schema change.
- Changes to metadata extraction logic beyond prompt wording.
