# boss routing rulebook (reference)

The `orchestrate` skill consults these DEFAULTS when it fills a plan's boss frontmatter
(`executor`+`model`) at plan-authoring time (Step 3.5). `secretary` does NOT re-derive
routing — it raises whatever orchestrate stamped. Boss reads only the frontmatter, so
this file never contradicts a live dispatch. Append-only once the owner confirms a
novel routing. A one-off `boss-dispatch.sh --executor/--model` flag overrides at dispatch.

| task type / label | executor | model |
|---|---|---|
| default | claude-p | sonnet |
| type:refactor (large) | claude-p | opus |
| type:chore (mechanical) | agy | (agy default) |
