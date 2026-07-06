# Draft: AXI alignment for cli-printing-press (file manually)

> **Status**: draft only. Not filed. The owner reviews and files this
> manually against `github.com/mvanhorn/cli-printing-press` when ready —
> nothing here should be treated as filed or acted upon automatically.

## Title

Adopt remaining AXI agent-first CLI principles in generated output (TOON
mode, template-level empty states, aggregates, truncation, home view)

## Summary

AXI (axi.md, kunchenguid) is a benchmarked set of 10 design principles for
agent-first CLIs. The reference implementation, gh-axi, scored 100% task
success at 1/3 the cost of the GitHub MCP server by following them. An
internal audit of the press's generated output (`docs/press-axi-upstream-issue.md`'s
sibling, `tooling/claude-skills/printing-press/references/axi-alignment.md`)
found the press already covers most of AXI: piped output auto-switches to
JSON, `--select`/`--compact` narrow output, typed exit codes with a JSON
error envelope, and deterministic store ordering. Several gaps can be
closed as post-generation skill patches (empty states, truncation hints,
aggregates, a home view) and are being applied that way in the interim. One
gap — TOON output — and the deeper form of the others require changes to
the generator's templates, which live outside what a downstream skill can
patch. This issue tracks the template-level asks.

## Upstream-only asks

### 1. TOON output mode

Add a Token-Oriented Object Notation (or equivalent denser-than-JSON)
rendering mode, exposed as `--toon` and folded into what `--agent` implies.
This is the one AXI principle the press has no coverage for at any layer —
skill-level patches can't add a new output encoding without touching the
render pipeline.

- **Template**: `helpers.go.tmpl` (the output-rendering pipeline: this is
  where JSON/table/plain/csv branch today; TOON would be a new branch here).
- **Also touches**: `root.go.tmpl` (new `--toon` flag, and folding it into
  the `--agent` flag bundle alongside `--json --compact --no-input
  --no-color --yes`).

### 2. Template-level empty states

Bake `<noun>: 0 results for <scope>` into the generated list-command
rendering itself, instead of relying on a per-CLI post-generation patch to
add it after the fact. Every generated resource list/search command should
emit this by default when the result set is empty, in whatever output mode
(JSON/table/plain) the command already uses.

- **Template**: `command_endpoint.go.tmpl` and `command_promoted.go.tmpl`
  (must stay in sync — both render list-shaped commands and both currently
  emit an empty array/empty table on a zero-length result set).
- **Also touches**: `helpers.go.tmpl` if the empty-state formatting is
  factored into a shared render helper (preferred, to avoid duplicating the
  string across both command templates).

### 3. `count: N of M total`

When the underlying API response exposes a total/pagination count, thread it
into the generated list output as `count: N of M total` (JSON) or an
equivalent table/plain-mode footer, and add cheap derived counts
(`comments: 7`) to generated detail views where the response includes a
countable nested collection.

- **Template**: `command_endpoint.go.tmpl` / `command_promoted.go.tmpl` (the
  list/detail rendering logic — needs to read pagination metadata out of the
  API response struct, which varies per spec).
- **Also touches**: `readme.md.tmpl` / `skill.md.tmpl` (the "Output Formats"
  / example output sections should show the new field so the contract docs
  don't drift from actual behavior).

### 4. Truncation + `--full`

Generated commands that render a large text field (body, description, log,
diff — anything the spec marks as a long string) should truncate to
500-1500 chars with a `(truncated, N chars total)` suffix by default, and
every such command should get a generated `--full` flag that returns the
untruncated field.

- **Template**: `command_endpoint.go.tmpl` / `command_promoted.go.tmpl`
  (per-field truncation logic keyed off spec field length/type hints) and
  `root.go.tmpl` if `--full` is implemented as a persistent flag rather than
  a per-command one.
- **Also touches**: `readme.md.tmpl` / `skill.md.tmpl` (document `--full` in
  "Output Formats"), `scorecard.go` (must not accidentally start scoring
  `--full` under an existing dimension pattern — see the anti-gaming note in
  `references/scorecard-patterns.md`).

### 5. No-args home view

Bare `<cli>` with no subcommand should show a compact live home view (auth
state + 2-3 headline resources fetched live) instead of Cobra's default help
text. Today `root.go.tmpl` wires `<cli>` with no args to `--help`.

- **Template**: `root.go.tmpl` (the root command's `RunE`/`Run` for the
  no-args case).
- **Also touches**: `readme.md.tmpl` / `skill.md.tmpl` ("Quick Start" section
  should show the home view as the very first example, since it is now the
  zero-effort entry point), `scorecard.go` if a "Content First" or similar
  dimension gets added later to reward this.

## Process note for whoever files this

Each ask above changes rendered output for every future generated CLI, so
per `docs/GOLDEN.md` the golden files must be regenerated and diffed after
any template change, and `scorecard.go` must be checked in lockstep with
`command_endpoint.go.tmpl`/`command_promoted.go.tmpl` so a new rendering
pattern doesn't silently start or stop scoring on an existing dimension.

## Not asking for

- Forking `cli-printing-press` — that's the owner's call, not implied by
  filing this issue.
- Any change to already-published CLIs in `~/printing-press/library/` — this
  is template-level only; existing CLIs would need a reprint or a manual
  polish pass to pick up template changes.
