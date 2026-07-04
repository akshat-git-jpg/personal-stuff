---
name: printing-press
description: Generate a ship-ready CLI for an API with a lean research -> generate -> build -> shipcheck loop.
version: 2.0.0
min-binary-version: "4.0.0"
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - WebFetch
  - WebSearch
  - AskUserQuestion
  - Agent
---

# /printing-press

Generate the best useful CLI for an API without burning an hour on phase theater.

```bash
/printing-press Notion
/printing-press Discord codex
/printing-press --spec ./openapi.yaml
/printing-press --har ./capture.har --name MyAPI
/printing-press https://postman.com/explore
/printing-press https://postman.com
```

## What Changed In v2

The old skill inflated the path to ship:
- too many mandatory research documents before code existed
- too many separate late-stage validation phases after code existed
- too many chances to discover obvious failures late

This version uses one lean loop:
1. Resolve the spec and write one research brief
2. Generate
3. Build the highest-value gaps
4. Run one shipcheck block
5. Optionally run live API smoke tests

Artifacts are still written, but only the ones that materially help the next step.

## Modes

### Default

Normal mode. Claude does research, generation orchestration, implementation, and verification.

### Codex Mode

If the arguments include `codex` or `--codex`, offload pure code-writing tasks to Codex CLI.

Use Codex for:
- writing store/data-layer code
- writing workflow commands
- fixing dead flags / dead code / path issues
- README cookbook edits

Keep on Claude:
- research and product positioning
- choosing which gaps matter
- verification results and ship decisions

If Codex fails 3 times in a row, stop delegating and finish locally.

### Polish Mode (Standalone Skill)

For second-pass improvements to an existing CLI, use the standalone polish skill:

```bash
/printing-press-polish redfin
```

See the `printing-press-polish` skill for details. It runs diagnostics, fixes verify failures, removes dead code, cleans up descriptions and README, and offers to publish.

## Rules

- **Do not ship a CLI that hasn't been behaviorally tested against real targets.** `go build` and `verify` pass-rate are structural signals, not correctness signals. Phase 5's mechanical test matrix runs every subcommand + `--json` + error paths; if that matrix was not executed, the CLI is not shippable. Quick Check is the floor; Full Dogfood is required when the user asks for thoroughness.
- **Bugs found during dogfood are fix-before-ship, not "file for v0.2".** If a 1-3 file edit resolves it, do it now. `ship-with-gaps` is deprecated as a default verdict (see Phase 4). Context is freshest in-session; a v0.2 backlog that may never be revisited ships known-broken CLIs.
- **Features approved in Phase 1.5 are shipping scope.** Do not downgrade a shipping-scope feature to a stub mid-build. If implementation becomes infeasible, return to Phase 1.5 with a revised manifest and get explicit re-approval.
- **Do not quote human-time estimates for sub-tasks** ("~15-30 min", "~1 hour", "quick fix") in `AskUserQuestion` options, phase descriptions, or reference docs. The agent does the work, not the user; agent-fabricated estimates are notoriously bad and train users to distrust the prompt. Describe scope instead (lines of code, files touched, relative size). The carve-outs are wall-clock estimates for genuinely time-bound things: the whole-CLI run (set the user's expectation up front — most CLIs take 30+ minutes), tool installs (`go install` takes ~10 seconds), and printing-press subcommands that do network-bound work (crowd-sniff scans npm + GitHub, ~5-10 minutes). Anything bounded by agent reasoning time is not time-bound — describe scope.
- **Use raw captures for contract research.** When reading official docs, auth/error/rate-limit pages, endpoint references, OpenAPI/Postman links, or source pages whose exact identifiers affect the generated CLI, read [references/fetch-docs.md](references/fetch-docs.md) and use its `fetch-docs.sh` helper. Reserve `WebFetch` for quick TL;DR reads where losing field-level details is acceptable.
- Optimize for time-to-ship, not time-to-document.
- Reuse prior research whenever it is already good enough.
- Do not split one idea across multiple mandatory artifacts.
- Durable files produced by this skill go under `$PRESS_RUNSTATE/` (working state) or `$PRESS_MANUSCRIPTS/` (archived). Short-lived command captures may use `/tmp/printing-press/` and must be removed after use.
- Do not create a separate narrative phase for dogfood, dead-code audit, runtime verification, and final score. Treat them as one shipcheck block.
- Run cheap, high-signal checks early.
- Fix blockers and high-leverage failures first.
- Reuse the same spec path across `generate`, `dogfood`, `verify`, and `scorecard`.
- YAML, JSON, local paths, and URLs are all valid spec inputs for the verification tools.
- Maximum 2 verification fix loops unless the user explicitly asks for more.

## Secret & PII Protection (Cardinal Rules)

**These rules are non-negotiable. They apply at ALL times during a run.**

API key **values**, token **values**, passwords, and session cookies must NEVER
appear in any artifact: source code, manuscripts, proofs, READMEs, HARs, or
anything committed to git. Env var **names** (e.g., `STEAM_API_KEY`) and
placeholders (e.g., `"your-key-here"`) are safe.

During Phase 5.6 (archiving) and before publishing, read and apply
[references/secret-protection.md](references/secret-protection.md) for:
- Exact-value scanning and auto-redaction of artifacts
- HAR auth stripping (headers, query strings, cookies)
- API key handling rules during the run
- Session state cleanup ordering

## Preflight

Read `references/preflight.md` and execute its setup contract in full before
anything else — it selects the binary (local build vs global), verifies the Go
toolchain, runs version/upgrade advisories, probes browser-sniff backends, and
detects codex mode.

Only after preflight completes successfully (no `[setup-error]`; no global skill update that requires restart; any `[repo-upgrade-available]`, `[upgrade-available]`, or `[browser-tools-missing]` was offered to the user; `PRINTING_PRESS_BIN` is captured) should you proceed to the Orientation & Briefing section below.

## Orientation & Briefing

After preflight has completed, check whether the user provided arguments. Handle two cases:

### No Arguments: Orientation

If the user typed `/printing-press` with no arguments (no API name, no `--spec`, no `--har`, no URL), print an orientation and ask what they'd like to build:

> The Printing Press generates a fully functional CLI for any API. You give it an API name, a spec file, or a URL. It researches the landscape, catalogs every feature that exists in any competing tool, invents novel features of its own, then generates a Go CLI that matches and beats everything out there — with offline search, agent-native output, and a local SQLite data layer.
>
> By the end, you'll have a working CLI in `$PRESS_LIBRARY/` that you can use for yourself, ship on your own, or apply to add to the printing-press library.
>
> The process takes 30-60 minutes depending on API complexity. Simple APIs with official specs (Stripe, GitHub) are faster. Undocumented APIs that need discovery (ESPN, Domino's) take longer.

Print these example invocations as plain text BEFORE the `AskUserQuestion` call (so they appear as context above the question, not as competing menu options):

```
/printing-press Notion
/printing-press Discord codex
/printing-press --spec ./openapi.yaml
/printing-press --har ./capture.har --name MyAPI
/printing-press https://postman.com
```

Then ask via `AskUserQuestion`:

- **question:** `"What API would you like to build a CLI for?"`
- **header:** `"API target"`
- **multiSelect:** `false`
- **options:**
  1. **label:** `"Type it (recommended)"` — **description:** `"Provide an API name, URL, spec path, or HAR file via the 'Other' option below."`
  2. **label:** `"Browse existing CLIs first"` — **description:** `"Visit the public library to see what's already been printed before deciding what to build."`

**Do not add additional options** — no "Show me popular options", no pre-populated buttons for Notion / Stripe / GitHub / Linear / Discord. The example invocations above already cover the common shapes, and most popular APIs are already in the public library (offering to re-print them is noise). The two options above plus the automatic "Other" field is the entire interface.

If the user picks **"Type it (recommended)"**, they will provide their answer via the auto "Other" field. Set their input as the argument and proceed to the briefing below.

If the user picks **"Browse existing CLIs first"**, print the public library URL prominently and try to open it in the browser, then end the skill so the user can browse before deciding:

```bash
echo ""
echo "Public library: https://github.com/mvanhorn/printing-press-library"
echo "(If you have the Printing Press Library plugin, you can also run /ppl in Claude Code.)"
echo ""
command -v open >/dev/null 2>&1 && open https://github.com/mvanhorn/printing-press-library
```

After printing, end the skill cleanly. Do not proceed to briefing or research — the user is exploring, not building yet. They can re-invoke `/printing-press <api>` once they've decided.

### With Arguments: Briefing

When the user provided an argument (API name, `--spec`, `--har`, or URL), print a brief process overview. This sets expectations and collects any upfront context. (Preflight has already run at this point.)

Print as prose, matching the style of the example below:

> Very well. Setting the type for `<API>`.
>
> **Here is how this will proceed:**
> 1. I shall research `<API>` across the internet: official docs, community wrappers, competing CLIs, MCP servers, and npm/PyPI packages
> 2. I shall catalog every feature that exists in any tool, then devise novel features of my own that no existing tool offers
> 3. I shall present what I found and what I invented — you will have a chance to add your own ideas or adjust the plan before I build
> 4. I shall generate a Go CLI, build every feature from the plan, then verify quality through dogfood, runtime verification, and scoring
>
> **What you will have at the end:** A fully functional CLI at `$PRESS_LIBRARY/<api>` that you can use yourself, ship on your own, or apply to add to the printing-press library.
>
> **Time:** 30-60 minutes depending on API complexity.
>
> **Things that help if you have them:**
> - An API key (for live smoke testing at the end)
> - A logged-in browser session (for discovering authenticated endpoints)
> - A spec file or HAR capture (skips discovery)

If the user provided `--spec`, adapt: "You have provided a spec, so I shall skip discovery and proceed directly to analysis and generation. Should be faster."

If the user provided `--har`, adapt: "You have provided a HAR capture, so I shall generate a spec from your traffic and skip browser browser-sniffing."

Then ask via `AskUserQuestion`:

- **question:** `"Anything you want me to know before I begin? A vision for what this CLI should do, specific features you care about, or auth context I should have?"`
- **header:** `"Briefing"`
- **multiSelect:** `false`
- **options:**
  1. **label:** `"Let's go (recommended)"` — **description:** `"Start research now. I'll ask about API keys, browser auth, or other context when I need them."`
  2. **label:** `"I have context to share"` — **description:** `"Tell me your vision, specific features, or auth context (API key, logged-in browser session) before research starts."`

**Do not add additional options** — auth is already handled by Phase 0.5 (API Key Gate) and Phase 1.6 (Pre-Browser-Sniff Auth Intelligence) downstream. A user who wants to volunteer auth context can do so via option 2's free-text response. The two options above plus the automatic "Other" field is the entire interface.

If the user picks **"Let's go (recommended)"**, proceed to the Multi-Source Priority Gate (or, for single-source runs, directly to Phase 0).

If the user picks **"I have context to share"**, capture their free-text response as `USER_BRIEFING_CONTEXT`. The response may include:

- **Vision / specific features** — captured as-is. This context will be:
  - Added to the Phase 1 Research Brief under a `## User Vision` section
  - Used as a 4th self-brainstorm question in Phase 1.5c.5: "Based on the user's stated vision, what features directly serve their stated goals that the absorbed features don't cover?"
  - Referenced at the Phase Gate 1.5 absorb gate: "You mentioned [summary] at the start. Want to add more, or does the manifest already cover it?"
- **Auth context** — if the user mentions an API key, env var, or logged-in browser session, set the corresponding `AUTH_CONTEXT` fields so the API Key Gate (Phase 0.5) and Pre-Browser-Sniff Auth Intelligence (Phase 1.6) do not re-ask.

### Multi-Source Priority Gate

After the briefing question resolves, inspect the user's original argument AND any `USER_BRIEFING_CONTEXT` they provided. If together they name **two or more distinct services, sites, or APIs** (e.g., "Google Flights and Kayak", "Notion + Linear combo CLI", "flightgoat: Google Flights, Kayak.com/direct, and FlightAware"), this is a combo CLI and priority ordering MUST be confirmed before Phase 1 research.

**Why this gate exists:** Phase 1 research defaults to the first resolvable spec as the primary source. When the user listed services in a specific order, that order is their intent — but the generator's spec-first bias will silently invert it (picking a well-documented paid API over a free reverse-engineered one the user actually wanted as the headline feature). This has caused real user-visible failures where the CLI shipped with the wrong primary and required a paid API key for what the user intended as the free primary command.

**Parse the order from the prose.** Use the user's wording verbatim. Commas, "then", "and", explicit "primary/secondary", or numbered lists all signal ordering. If the user wrote "Google Flights, Kayak, FlightAware" — that is the order. Do not reorder by spec availability, tier, or ease of generation.

**Confirm via `AskUserQuestion`:**

> "You mentioned **<Source A>**, **<Source B>**, and **<Source C>**. I'll treat **<Source A>** as the primary — it gets the headline commands, the top of the README, and the first-run experience. Is that the right order?"

Options:
1. **Yes, that order is correct** — Proceed with `SOURCE_PRIORITY=[A, B, C]` captured to run state.
2. **Different order** — User provides the correct ordering; capture it.
3. **They're peers, no primary** — Rare; capture as equal weighting but warn the user that one will still lead the README.

Write the confirmed ordering to `$API_RUN_DIR/source-priority.json`:

```json
{
  "sources": ["google-flights", "kayak-direct", "flightaware"],
  "confirmed_at": "<ISO timestamp>",
  "raw_user_phrasing": "<verbatim text that established the order>"
}
```

**Phase 1 MUST consult this file.** When selecting a spec source, the primary source wins even if it has no spec and a later source has a clean OpenAPI. When the primary has no official spec, flag that openly in the brief under `## Source Priority` (see the brief template in `references/phase-1-research-brief.md`) and route to the browser-sniff/docs path for the primary — do not promote a secondary source just because its spec is cleaner.

**Economics check.** If the confirmed primary source is free (no API key required) AND the generator's default path would make the primary CLI commands require a paid key (because the auth applies broadly or because a paid secondary source is bleeding into the primary path), surface the tradeoff explicitly before generating:

> "The primary source (**<Source A>**) is free, but the default path would require a **<paid key>** for the headline commands because <reason>. Options: (1) keep primary free, gate only the secondary commands on the paid key; (2) require the paid key for everything; (3) drop the paid source."

Default to option 1 unless the user overrides. Record the decision in `source-priority.json` under `auth_scoping`.

**Single-source runs:** If only one service is named, skip this gate entirely — no ordering to confirm.

---

## Run Initialization

After you know `<api>` (from the Orientation & Briefing flow above; preflight already ran at the top), initialize the run-scoped artifact paths:

```bash
RUN_ID="$(date +%Y%m%d-%H%M%S)"
API_RUN_DIR="$PRESS_RUNSTATE/runs/$RUN_ID"
RESEARCH_DIR="$API_RUN_DIR/research"
PROOFS_DIR="$API_RUN_DIR/proofs"
PIPELINE_DIR="$API_RUN_DIR/pipeline"
DISCOVERY_DIR="$API_RUN_DIR/discovery"
CLI_WORK_DIR="$API_RUN_DIR/working/<api>-pp-cli"
STAMP="$(date +%Y-%m-%d-%H%M%S)"

# Session state (live cookies, CSRF tokens captured during authenticated
# browser-sniff) lives OUTSIDE $API_RUN_DIR so the Phase 5.5 archive
# `cp -r "$DISCOVERY_DIR"` cannot pick it up. Containment by location, not by
# manual rm-before-archive.
#
# Base prefix is user-scoped (`printing-press-$(id -u)`) so that on a Linux
# host with a shared /tmp, the umask-077 subshell below does not lock the
# top-level `printing-press` directory to a single user. macOS already gives
# us a per-user $TMPDIR; the $(id -u) suffix keeps semantics identical there.
SESSION_BASE="${TMPDIR:-/tmp}/printing-press-$(id -u)"
SESSION_DIR="$SESSION_BASE/session/$RUN_ID"
SESSION_STATE_FILE="$SESSION_DIR/session-state.json"

mkdir -p "$RESEARCH_DIR" "$PROOFS_DIR" "$PIPELINE_DIR" "$CLI_WORK_DIR"
# Create $SESSION_DIR inside a subshell with a tight umask so it lands at 0700
# at creation, not after a follow-up chmod. The two-step `mkdir; chmod` form
# leaves a TOCTOU window where a concurrent process could open the directory
# (and any session-state.json written into it) while perms are still
# umask-derived (typically 0755 on Linux). The umask propagates to every
# directory `mkdir -p` creates; the user-scoped $SESSION_BASE above is what
# keeps that from blocking other users on the same host.
(umask 077 && mkdir -p "$SESSION_DIR")
STATE_FILE="$API_RUN_DIR/state.json"
```

Maintain a lightweight state file at `$STATE_FILE` so `/printing-press-score` can rediscover the current run. It should always contain:

```json
{
  "api_name": "<api>",
  "run_id": "$RUN_ID",
  "working_dir": "$CLI_WORK_DIR",
  "output_dir": "$CLI_WORK_DIR",
  "spec_path": "<absolute spec path if known>"
}
```

`run_id` is the same `YYYYMMDD-HHMMSS` value computed earlier as `RUN_ID="$(date +%Y%m%d-%H%M%S)"`. The generator's manifest writer derives the same value from the `--research-dir` basename when generate is invoked through the canonical `$API_RUN_DIR` (whose basename equals `$RUN_ID`); persisting it in `state.json` here keeps `/printing-press-score` and any future state-loading consumer in sync. Without `run_id` in either path, `cli-printing-press dogfood --live --write-acceptance` refuses to write the gate marker.

Do not create a `go.work` file in `$CLI_WORK_DIR`. Generated modules must build and test as standalone modules; a mismatched workspace `go` directive can break Go 1.25+ toolchains and lefthook checks. Editor/gopls workspace noise is cosmetic and must not be traded for broken `go build` or `go test`.

There are exactly three durable writable locations. Every generated artifact this
skill preserves goes to one of them:

- **`$PRESS_RUNSTATE/`** — mutable working state for the current run (research, proofs, pipeline artifacts, plans, intermediate docs)
- **`$PRESS_LIBRARY/`** — published CLIs (`<api-slug>/` subdirectories)
- **`$PRESS_MANUSCRIPTS/`** — archived run evidence (research, proofs, discovery)

Short-lived command captures may use `/tmp/printing-press/` with unique `mktemp`
paths and must be deleted after use.

Examples of the current naming/layout:
- `$PRESS_LIBRARY/notion/` — published CLI directory (keyed by API slug)
- `notion-pp-cli` — the binary name inside the directory
- `/printing-press emboss notion` — emboss accepts both slug and CLI name
- `discord-pp-cli/internal/store/store.go` — internal source paths still use CLI name
- `linear-pp-cli stale --days 30 --team ENG` — binary invocations use CLI name
- `github.com/mvanhorn/discord-pp-cli` — Go module paths use CLI name

## Outputs

Every run writes up to 5 concise artifacts under the current managed run and archives them to `$PRESS_MANUSCRIPTS/<api-slug>/<run-id>/`:

1. `research/<stamp>-feat-<api>-pp-cli-brief.md`
2. `research/<stamp>-feat-<api>-pp-cli-absorb-manifest.md`
3. `proofs/<stamp>-fix-<api>-pp-cli-build-log.md`
4. `proofs/<stamp>-fix-<api>-pp-cli-shipcheck.md`
5. `proofs/<stamp>-fix-<api>-pp-cli-live-smoke.md` (only if live testing runs)

These do not need to be 200+ lines. Keep them dense, evidence-backed, and directly useful.

## Phase Playbooks (lazy-loaded — MANDATORY reads)

The full playbook for every phase lives in `references/`. **When a phase
begins, Read its file COMPLETELY before taking any action in that phase.**
Never run a phase from this table alone — the files carry the stop gates,
enforcement rules, marker files, and exact commands. Skip conditions live
inside each file: when unsure whether a phase applies, read the file and let
it tell you to skip.

Run order and files:

| # | Phase | File |
|---|-------|------|
| 1 | Phase 0: Resolve And Reuse | `references/phase-0-resolve-reuse.md` |
| 2 | Phase 1: Research Brief (+ Phase 1.6 pre-browser-sniff auth intelligence) | `references/phase-1-research-brief.md` |
| 3 | Phase 1.7: Browser-Sniff Gate (must produce decision marker) | `references/phase-1.7-browser-sniff-gate.md` |
| 4 | Phase 1.8: Crowd-Sniff Gate | `references/phase-1.8-crowd-sniff-gate.md` |
| 5 | Phase 1.5: Ecosystem Absorb Gate (MANDATORY STOP GATE) | `references/phase-1.5-absorb-gate.md` |
| 6 | Phase 1.9: API Reachability Gate (MANDATORY) | `references/phase-1.9-reachability-gate.md` |
| 7 | Phase 2: Generate (all pre-generation enrichment + lock) | `references/phase-2-generate.md` |
| 8 | Phase 3: Build The GOAT | `references/phase-3-build.md` |
| 9 | Phase 4: Shipcheck (+ 4.7 sync-param, 4.8 SKILL review, 4.9 docs audit, 4.85 output review, 4.95 code review) | `references/phase-4-shipcheck.md` |
| 10 | Phase 5: Dogfood Testing (MANDATORY when an API key is available) | `references/phase-5-dogfood.md` |
| 11 | Phase 5.5: Polish + Phase 5.6: Promote & Archive (always run) | `references/phase-5.5-polish-promote.md` |
| 12 | Phase 6: Next Steps (NOT optional — every run ends with its menu) | `references/phase-6-next-steps.md` |

Note the non-numeric run order: 1.7 and 1.8 run BEFORE 1.5, and Phase 1.5
refuses to proceed without Phase 1.7's marker file.

## Fast Guidance

### When to use `cli-printing-press print`

Use `cli-printing-press print <api>` only when the user explicitly wants a resumable on-disk pipeline with phase seeds. It is optional.

The fast path for `/printing-press <API>` is:
- brief
- generate
- build
- shipcheck

### When to stop researching

Stop when you can answer:
- what to build first
- what data to persist
- what incumbent features cannot be missing

If the next research step does not change those answers, stop and generate.

### What not to do

Do not:
- write 5 separate mandatory research documents
- defer all workflows to "future work"
- skip verification because the CLI compiles
- treat scorecard alone as ship proof
- discover YAML/URL spec incompatibility late and manually convert specs if the tools can already consume them
- rerun the whole late-phase gauntlet for cosmetic README polish
- skip features because "the MCP already handles that" (absorb everything, beat it with offline + agent-native)
- build only "top 3-5 workflows" when the absorb manifest has 15+ (build them ALL, then transcend)
- generate before the Phase 1.5 Ecosystem Absorb Gate is approved
- call a CLI "GOAT" without matching every feature the best competitor has

### What counts as success

Success is:
- a generated CLI that gets to shipcheck without generator blockers
- verification tools working against the same spec the user generated from
- one or two fix loops, not a maze of re-entry phases
- a CLI that is plausibly shippable today, not a perfect design memo
