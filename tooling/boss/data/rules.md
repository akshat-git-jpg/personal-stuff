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
| owner asks for codex, or a fully-inlined plan you want off the agy queue | codex | (codex default — gpt-5.6-terra) |
| a codex plan that is large, subtle, or has already failed once on terra | codex | gpt-5.6-sol |

**The codex default is `gpt-5.6-terra` (owner decision 2026-08-28).** The Codex CLI
model menu offers `gpt-5.6-sol` (frontier), `gpt-5.6-terra` (balanced, everyday work) and
`gpt-5.6-luna` (fast/cheap), plus the legacy `gpt-5.5`, `gpt-5.4` and `gpt-5.4-mini`
reachable only via `-m`. terra takes the default seat because a boss plan that clears the
fully-inlined bar is by construction everyday work — the judgment was spent at authoring
time, so paying frontier rates per dispatch buys little, and the ChatGPT weekly limit is
the real constraint. Escalate to `sol` for a large or subtle plan, or as the second round
after terra fails once; that is its own row above. Boss never guesses the model — it
passes `-m` explicitly on every dispatch and resume, so this default only applies when a
plan's `model:` is blank.

**Any Codex model name works.** `executors/codex.sh` does not validate the string; it
hands it straight to `codex exec -m`. So a plan may name `gpt-5.6-luna` or a legacy model
and boss will run it, but an invalid name fails inside the CLI, not at dispatch. Override
order: plan frontmatter `model:` → `boss-dispatch.sh --model` → `CODEX_DEFAULT_MODEL`
→ `gpt-5.6-terra`.

**codex is a valid option, not a default (owner decision 2026-08-25).** The OpenAI
Codex CLI runs on the owner's ChatGPT subscription (`auth_mode=chatgpt`), so like agy its
tokens are effectively free and it does not share claude-p's Claude usage pool. It earns a
row rather than the default seat because it has no track record in this repo's boss
history yet — agy keeps the default until codex has landed real PRs. Pick it when the
owner names it, or to run a second fully-inlined plan concurrently without queueing behind
an agy crew. The agy riders below apply to codex unchanged (fully-inlined bar, the
render+visual-inspection gate on visual output, verify by COMMITS never by the run log).

Riders on the agy default (from LESSONS — they are what makes it safe):
- The plan must be FULLY inlined (schemas, snippets, exact commands). If Step 3.5 can't
  get it there, that's the "can't be fully inlined" row, not a reason to water down the plan.
- Visual/graphics output still passes the render+visual-inspection gate before landing
  (decisions.md 2026-07-07 mitigation — the verifier renders and LOOKS, agy never
  self-certifies visuals).
- Verify agy by COMMITS/files, never by its run-log or a SUCCESS envelope alone; a
  0-token SUCCESS envelope is a failure (LESSONS 2026-07-07).
