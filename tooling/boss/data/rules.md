# boss routing rulebook (reference)

The `orchestrate` skill consults these DEFAULTS when it fills a plan's boss frontmatter
(`executor`+`model`) at plan-authoring time (Step 3.5). `secretary` does NOT re-derive
routing — it raises whatever orchestrate stamped. Boss reads only the frontmatter, so
this file never contradicts a live dispatch. Append-only once the owner confirms a
novel routing. A one-off `boss-dispatch.sh --executor/--model` flag overrides at dispatch.

**Default flipped to agy (owner decision 2026-07-18):** agy runs on the Antigravity
subscription (effectively free tokens) and its track record on fully-inlined plans is
strong (LESSONS 2026-07-09: 10-step refactor and greenfield app, both first-try green;
2026-07-18: 5-card + 2-mod build passed render inspection). claude-p is now the
exception for the scenarios below, not the default.

| task type / scenario | executor | model |
|---|---|---|
| default (any plan that passes the fully-inlined bar) | agy | (agy default — Gemini 3.1 Pro High) |
| quality-setting CONTENT the owner judges by taste — rulebooks, prompts, prose, docs | claude-p | sonnet |
| plan can't be fully inlined — real judgment/exploration expected mid-execution | claude-p | sonnet |
| tricky — subtle concurrency, security-sensitive, gnarly refactor needing live judgment | claude-p | opus |

Riders on the agy default (from LESSONS — they are what makes it safe):
- The plan must be FULLY inlined (schemas, snippets, exact commands). If Step 3.5 can't
  get it there, that's the "can't be fully inlined" row, not a reason to water down the plan.
- Visual/graphics output still passes the render+visual-inspection gate before landing
  (decisions.md 2026-07-07 mitigation — the verifier renders and LOOKS, agy never
  self-certifies visuals).
- Verify agy by COMMITS/files, never by its run-log or a SUCCESS envelope alone; a
  0-token SUCCESS envelope is a failure (LESSONS 2026-07-07).
