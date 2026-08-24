# AXI alignment

AXI (axi.md, kunchenguid) is a benchmarked set of 10 design principles for
agent-first CLIs — gh-axi scored 100% task success at 1/3 the cost of the
GitHub MCP server by following them. This reference maps the 10 principles
against what the press already generates, and separates the remaining gaps
into two buckets: fix here (skill-lever, applied as a post-generation patch
during phase 2 and polish) vs. fix upstream (template-level, needs a change
in `github.com/mvanhorn/cli-printing-press`; see
`docs/press-axi-upstream-issue.md`).

## The 10 principles (one line each)

1. **Structured over prose** — machine-parseable output (JSON/table), not
   paragraphs.
2. **Progressive disclosure** — summary first, detail on request.
3. **Content truncation with size hints** — long fields get a preview + a
   stated total + an escape hatch, never silent omission.
4. **Pre-computed aggregates** — counts and totals the caller would otherwise
   have to compute themselves.
5. **Definitive empty states** — "0 results" is a result, not silence.
6. **TOON output** — a token-optimized-object-notation mode, denser than JSON,
   for agent callers.
7. **Deterministic ordering** — stable sort so diffs and caches behave.
8. **Content first** — the default view (no args) shows live data, not a
   help screen.
9. **Contextual disclosure** — after non-self-contained output, suggest the
   next runnable command.
10. **Fail loud, fail typed** — typed exit codes and structured error
    payloads, not bare stack traces.

## Press status

| # | Principle | Status | Note |
|---|---|---|---|
| 1 | Structured over prose | already-covered | Piped output auto-switches to JSON; terminal gets a ≤6-column table. |
| 2 | Progressive disclosure | already-covered | `--select`/`--compact` narrow output on request. |
| 3 | Content truncation with size hints | skill-lever | Gap: large text fields must render a 500–1500-char preview + `(truncated, N chars total)` + a `--full` escape hatch, never silent omission. |
| 4 | Pre-computed aggregates | skill-lever | Gap: list output should carry `count: N of M total` when the API exposes totals; detail views carry cheap derived counts (`comments: 7`). |
| 5 | Definitive empty states | skill-lever | Gap: zero-result lists must print `<noun>: 0 results for <scope>` (stdout, structured), never empty output — today the press emits an empty JSON array / empty table. |
| 6 | TOON output | upstream-only | No TOON mode exists; `--llm` terse mode exists only as a per-CLI novel feature (openrouter), not a press default. Template rendering change — see upstream issue. |
| 7 | Deterministic ordering | already-covered | Store/client query patterns already sort by stable keys. |
| 8 | Content first | skill-lever | Gap: bare `<cli>` with no args should show a compact live home view (auth state + 2–3 headline resources), not help. |
| 9 | Contextual disclosure | skill-lever | Gap: after non-self-contained output, emit 1–2 complete runnable next-step commands — generalizing the existing stderr-hint pattern (`Showing N results. To narrow: ...`). Keep these on stderr so piped stdout stays parseable — a deliberate, documented deviation from AXI's stdout preference. |
| 10 | Fail loud, fail typed | already-covered | Typed exit codes (2 usage, 3 not-found, 4 auth, 5 api, 7 rate-limit, 10 config) with actionable multi-line hints; JSON error envelope `{"error","code"}` under `--json`. |

## Standing instruction

During phase 2 (novel features) and polish, apply the skill-lever items to
every generated CLI as post-generation patches; they must not regress the
scorecard.
