---
executor: claude-p
model: sonnet
test_cmd: bash pipelines/video/visuals-flow/scripts/check.sh
ui:
deploy:
needs: []
---

# Plan 086: Plain-text transcript export + LLM-step doc reconciliation

## Summary

- **Problem statement**: Both LLM passes (020 cue, 070 shot) are documented to paste raw `transcript.json` — 421KB / ~69k tokens on test-01 — when the prompt only consumes the word text (~33KB / ~8k tokens); the timestamps are dead weight the model is told to ignore. Separately, four docs contradict each other on whether RULEBOOK.md is pasted alongside the prompt.
- **Goals**:
  - `lib/transcript-text.mjs`: emits the joined word stream for a workdir (stdout or `--out`).
  - One authoritative load-list, written into every doc: **sessions paste the prompt ONLY (it is self-contained); RULEBOOK.md is the judgment archive maintained by the 060 fold, never pasted**; `{{TRANSCRIPT}}`/transcript placeholders are filled with `transcript-text` output, never raw JSON.
- **Executor proposed**: claude-p / sonnet (rules.md: prose/docs the owner judges by taste; the code portion is trivial).
- **Done criteria** (terse): `check.sh` exit 0 incl. a new unit test; `node lib/transcript-text.mjs test-01 | wc -c` ≈ 32–33k; zero remaining doc instructions to paste transcript.json or RULEBOOK into an LLM pass.
- **Stop conditions** (terse): any change to actual RULES (density caps, anchors, etc.) — this plan touches framing/instructions only; rule content changes belong to the 060 fold.
- **Test / verification for success**: unit test on the exporter + grep-based doc assertions.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 88c6943..HEAD -- pipelines/video/visuals-flow/lib pipelines/video/visuals-flow/steps pipelines/video/visuals-flow/HANDOFF.md pipelines/video/visuals-flow/INTEGRATION.md pipelines/.claude/skills/visuals-flow/SKILL.md`

## Status

- **Priority**: P1 (largest recurring token cost in the pipeline)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Difficulty**: standard
- **Planned at**: commit `88c6943`, 2026-07-18

## Why this matters

Every video pays the transcript twice (cue pass + shot pass). Measured on test-01: raw `transcript.json` is 421,380 bytes (~69k tokens); the joined word text is 32,646 bytes (~8k tokens). The cue-pass RULEBOOK itself says the model "reads the words for their text and their order only" — `lib/resolve.mjs` re-derives all timing deterministically from anchors afterward. ~120k tokens per video are pure waste. The doc contradiction (prompt says "every rule is inlined… this is the compressed version for direct execution" while its README says "load RULEBOOK.md and cue-pass-prompt.md into the executor") makes sessions unpredictably paste an extra 10.7KB and leaves no authoritative answer.

## Current state (excerpts verified at 88c6943)

All paths relative to `pipelines/video/visuals-flow/` unless noted.

- `videos/<slug>/transcript.json` — flat `[{text, start, end}]` (INTEGRATION.md §2). No plain-text producer exists anywhere in `lib/`.
- `lib/transcribe-groq.mjs` — the style exemplar for a tiny lib CLI: own `resolveWorkdir` (lines 12–16), `main()` with args from `process.argv.slice(2)`, `--out` flag (lines 25–27).
- The contradiction, site by site:
  1. `steps/020-cue-pass-llm/README.md:6-9`: "load `RULEBOOK.md` (the operating manual) and `cue-pass-prompt.md` … fill the prompt's `{{CATALOG}}` and `{{TRANSCRIPT}}` placeholders with `card-library/catalog.json` and `transcript.json`".
  2. `steps/020-cue-pass-llm/cue-pass-prompt.md:2-7`: "Paste this whole file … it has no repo access, so every rule is inlined below rather than linked. Full judgment detail lives in `RULEBOOK.md`; this is the compressed version for direct execution." and line 109-110: `TRANSCRIPT (verbatim word sequence with your quoting source): {{TRANSCRIPT}}`.
  3. `steps/070-shot-pass-llm/README.md:8`: "**In:** `videos/<slug>/transcript.json` + `videos/<slug>/resolved.json` (approved cues) + `RULEBOOK.md`".
  4. `INTEGRATION.md:59-62`: "rulebook = `steps/020-cue-pass-llm/RULEBOOK.md` + `cue-pass-prompt.md` … inputs = `<workdir>/transcript.json` + `card-library/catalog.json`".
  5. `pipelines/.claude/skills/visuals-flow/SKILL.md:33-34` (repo-relative `pipelines/.claude/skills/visuals-flow/SKILL.md`): "read `steps/020-cue-pass-llm/cue-pass-prompt.md`, fill its placeholders (`../card-library/catalog.json` + the transcript text)" — prompt-only, and says "transcript text" (which today has no producer).
  6. `HANDOFF.md:201-203` quick-ref: "Sonnet session with steps/020-cue-pass-llm/cue-pass-prompt.md (+ catalog.json + transcript text)".
- The decided resolution (owner-selected from the 2026-07-18 audit): the PROMPT is the single pasted artifact; RULEBOOK is where the 060 fold accumulates judgment and from which the prompt is re-compressed ("Edit BOTH together", HANDOFF.md:98-101 — that rule stays). "Transcript text" becomes real via the new exporter.

## The exporter (inline — create as `lib/transcript-text.mjs`)

```js
// Plain-text transcript for LLM passes: transcript.json is [{text,start,end}]
// but the cue/shot prompts consume word text + order only (~8k tokens vs ~69k
// raw on a 32-min VO) — resolve.mjs re-derives timing from anchors afterward.
import fs from 'node:fs';
import path from 'node:path';

function resolveWorkdir(arg) {
  if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);
  const pipelineRoot = path.resolve(import.meta.dirname, '..');
  return path.join(pipelineRoot, 'videos', arg);
}

export function transcriptText(words) {
  return words.map((w) => w.text).join(' ');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const workdirArg = args[0];
  if (!workdirArg) {
    console.error('usage: node lib/transcript-text.mjs <slug-or-path> [--out <file>]');
    process.exit(1);
  }
  const outFlag = args.indexOf('--out');
  if (outFlag !== -1 && !args[outFlag + 1]) {
    console.error('--out needs a file path');
    process.exit(1);
  }
  const words = JSON.parse(fs.readFileSync(path.join(resolveWorkdir(workdirArg), 'transcript.json'), 'utf8'));
  const text = transcriptText(words);
  if (outFlag !== -1) fs.writeFileSync(path.resolve(args[outFlag + 1]), text + '\n');
  else process.stdout.write(text + '\n');
}
```

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test gate (boss merge gate) | `bash scripts/check.sh` (from `pipelines/video/visuals-flow/`) | exit 0, `visuals-flow check OK` |
| Exporter smoke | `node lib/transcript-text.mjs test-01 \| wc -c` | ~32600–32700 |

## Scope

**In scope**:
- `pipelines/video/visuals-flow/lib/transcript-text.mjs` (new) + a unit test file `lib/transcript-text.test.mjs` + add it to `scripts/check.sh`'s test list.
- Doc edits ONLY at the six sites listed above: `steps/020-cue-pass-llm/README.md`, `steps/020-cue-pass-llm/cue-pass-prompt.md` (framing lines 2-7 and the `{{TRANSCRIPT}}` label only), `steps/070-shot-pass-llm/README.md`, `INTEGRATION.md` §4, `pipelines/.claude/skills/visuals-flow/SKILL.md` (the two verb steps), `HANDOFF.md` quick-ref lines.

**Out of scope**:
- Any rule content in either RULEBOOK.md or the prompts' Rules sections (density, anchors, caps, routing — 060-fold territory; touching them is a STOP).
- `lib/resolve.mjs` / anchor matching — anchors remain matched against transcript.json; nothing changes at resolve time.
- The 060 fold step and `tests/TESTS.md`.

## Git workflow

- Branch: `boss/086-transcript-text-export`
- Commit per step, conventional messages, no AI footers. Do NOT push.

## Steps

### Step 1: exporter + test + gate

Create `lib/transcript-text.mjs` exactly as inlined. Create `lib/transcript-text.test.mjs` (follow `lib/feedback-status.test.mjs` conventions): unit-test `transcriptText([{text:'a',...},{text:'b',...}])` → `'a b'`, and a CLI smoke via `spawnSync` against a temp workdir with a 3-word transcript. Append the test file to the `node --test` list in `scripts/check.sh`.

**Verify**: `bash scripts/check.sh` → exit 0; `node lib/transcript-text.mjs test-01 | wc -c` → ~32646.

### Step 2: reconcile the six doc sites

Rewrite each site to say, in its own voice (match each doc's existing tone — these are owner-taste docs):
- Sessions paste **the prompt only**; it is self-contained. RULEBOOK.md is the judgment archive the 060 fold maintains; the fold keeps prompt and RULEBOOK in sync ("Edit BOTH together" stays as-is in HANDOFF.md:98-101).
- `{{TRANSCRIPT}}` / the shot pass's transcript input is filled with `node lib/transcript-text.mjs <slug>` output — never raw transcript.json.
- 070 README's "**In:**" line drops RULEBOOK.md from executor inputs; INTEGRATION.md §4's "rulebook =" line becomes "prompt = `steps/020-cue-pass-llm/cue-pass-prompt.md` (self-contained; RULEBOOK.md is its fold-maintained source, not a session input)".

**Verify**: `grep -rn "transcript.json" steps/020-cue-pass-llm/README.md steps/070-shot-pass-llm/README.md INTEGRATION.md | grep -iv "anchors\|resolve\|ready\|shape\|exists"` → no line instructing an LLM paste of raw JSON; `grep -n "RULEBOOK" steps/020-cue-pass-llm/README.md steps/070-shot-pass-llm/README.md` → no line listing it as a session/executor input.

### Step 3: gate

**Verify**: `bash scripts/check.sh` → exit 0, `visuals-flow check OK`.

## Test plan

`lib/transcript-text.test.mjs` per Step 1; doc assertions are the Step 2 greps.

## Done criteria

- [ ] `bash scripts/check.sh` exits 0 (exporter test included in the gate).
- [ ] `node lib/transcript-text.mjs test-01 | wc -c` ≈ 32646 (±100).
- [ ] Step 2 grep assertions hold.
- [ ] `plans/README.md` row 086 updated to DONE.

## STOP conditions

- The edit would change a RULE (anything under "## Rules" in a prompt or a numbered RULEBOOK rule) rather than load-list/framing text — stop; that's 060-fold territory.
- A seventh doc site referencing the transcript paste turns up — apply the same fix if it is purely a load-list line, otherwise stop and report.

## Maintenance notes

- The 060 fold's contract is unchanged: lessons land in RULEBOOK + prompt together; this plan only ends the "paste both" ambiguity.
- Future sessions save ~120k tokens/video; the Convergence metrics in `tests/TESTS.md` should be unaffected (same words reach the model).
