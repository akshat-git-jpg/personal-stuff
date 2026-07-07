---
executor: agy
model:
test_cmd: python3 -m py_compile pipelines/youtube/explainer-videos-pipeline-1/2-scripting/030-clean-script-for-tts-run/run.py
ui:
deploy:
needs: ["044"]
---

# Plan 045: explainer-videos-pipeline-1 — 2-scripting stage

## Summary

- **Problem statement**: `2-scripting/` is empty. This pipeline needs a step that
  clones a named competitor channel's script voice (via the existing
  `yt-style-copy` skill), a human approval gate, and a text-cleaning pass so
  the script is safe to feed to TTS.
- **Goals**:
  - `010-write-script-opus/`: a rulebook.md (paste-prompt/Claude-Code-rules
    style, matching `tutorial-pipeline-2`'s `-sonnet`/`-antigravity` step
    convention) that drives `yt-style-copy`'s `write-script` verb against a
    named channel, hard-stopping if that channel's `script-style-dna.md` is
    missing, then copies the result into this step's own `output/`.
  - `020-review-script-human/`: a README documenting the human gate — resolve
    every `[VERIFY: …]` placeholder, approve before TTS spend.
  - `030-clean-script-for-tts-run/`: a deterministic script that strips
    markdown + the trailing rubric HTML comment from the approved script,
    and hard-fails if any `[VERIFY:` substring survived review.
- **Executor proposed**: `agy` (owner's explicit instruction for this whole build).
- **Done criteria**: all 3 step folders exist with README.md + rulebook.md/run.py +
  output/; `030`'s `run.py` compiles and correctly strips a synthetic sample
  input, correctly hard-fails on a sample containing `[VERIFY:`.
- **Stop conditions**: none beyond what's specified per-step below (this plan
  authors instructions/scripts, it does not run `yt-style-copy` for a real
  video — no channel has been named yet).
- **Test / verification for success**: `py_compile` on `030`'s `run.py`, plus a
  synthetic-input test proving the strip + hard-fail logic (Step 3 below).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 5a11eac..HEAD -- pipelines/youtube/explainer-videos-pipeline-1/2-scripting`
> Expect empty (the folder is currently empty). If plan 044 has not landed yet
> (`pipelines/youtube/explainer-videos-pipeline-1/lib/` does not exist), STOP —
> this plan depends on it.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (the `010` rulebook's contract with `yt-style-copy`'s actual
  output path is glob-based, not a fixed path — see Current State)
- **Depends on**: 044
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `5a11eac`, 2026-07-07

## Why this matters

The scripting stage is the pipeline's first creative step and its output shape
(a clean, placeholder-free text file) is what every downstream stage — voice,
timing, visuals — is built against. Getting the two approval gates right
(yt-style-copy's own internal outline-approval, then this pipeline's own
final-script approval) and the TTS-safety cleaning right here prevents a
placeholder or markdown artifact from silently ending up spoken aloud three
stages later.

## Current state

- `pipelines/youtube/explainer-videos-pipeline-1/2-scripting/` is empty.
- `pipelines/.claude/skills/yt-style-copy/SKILL.md` (read yourself in full) —
  the relevant verb is `write-script <slug> "<topic>"`:
  - Loads `script-style-dna.md`, `rubric.md`, and every file in `exemplars/`
    from `pipelines/youtube/competitor-styles/channels/<slug>/`.
  - Output dir: `pipelines/youtube/competitor-styles/channels/<slug>/output/scripts/<topic-kebab-slug>/`
    — `<topic-kebab-slug>` is yt-style-copy's OWN slugification of the topic
    string, not necessarily matching this pipeline's `safe()` transform. Do
    not try to predict the exact folder name; find it by globbing (see Step 2).
  - **Pass 1 — outline.** Writes `outline.md`, STOPS and waits for explicit
    human approval before Pass 2. This is a gate INSIDE `write-script` itself,
    separate from and prior to this plan's own `020-review-script-human`.
  - **Pass 2 — full script.** Writes `script.md` in the channel's exact voice.
    Any unverifiable factual claim gets a `[VERIFY: …]` placeholder instead of
    an invented fact.
  - **Pass 3 — QC (automatic, same session).** Appends a scorecard to the
    BOTTOM of `script.md` as an HTML comment:
    `<!-- rubric: 14/15 pass; #7 n/a because … -->`. There is no separate
    scorecard file — `script.md` already contains everything.
  - Guardrail from the skill itself: "If `script-style-dna.md` is missing for
    the requested slug, run `build-script-style-dna` first (confirm with the
    user — it's the expensive step)." This pipeline's hard-stop policy (owner
    decision, this batch) matches that guardrail exactly — never auto-trigger it.
- `pipelines/youtube/tutorial-pipeline-2/3-scripting/040-polish-script-for-delivery-sonnet/README.md`
  and its `rulebook.md` (read both yourself) are the closest exemplar for a
  `[SONNET]`-tag step's README+rulebook shape and tone — this plan's `010`
  follows the same shape but tagged `[OPUS]` and delegating to `yt-style-copy`
  instead of doing the rewrite itself.
- `pipelines/youtube/competitor-styles/channels/youri/` (read the directory
  listing yourself) currently has NO `output/scripts/` subfolder yet (nothing
  has been generated for it) — this plan does not run `write-script` for a
  real channel; it only authors the rulebook that a later real invocation will
  follow.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax-check `030`'s run.py | `python3 -m py_compile pipelines/youtube/explainer-videos-pipeline-1/2-scripting/030-clean-script-for-tts-run/run.py` | exit 0 |
| Confirm folder empty before starting | `find pipelines/youtube/explainer-videos-pipeline-1/2-scripting -type f` | zero output |

## Scope

**In scope**:
- `pipelines/youtube/explainer-videos-pipeline-1/2-scripting/010-write-script-opus/README.md`
- `pipelines/youtube/explainer-videos-pipeline-1/2-scripting/010-write-script-opus/rulebook.md`
- `pipelines/youtube/explainer-videos-pipeline-1/2-scripting/020-review-script-human/README.md`
- `pipelines/youtube/explainer-videos-pipeline-1/2-scripting/030-clean-script-for-tts-run/run.py`
- `pipelines/youtube/explainer-videos-pipeline-1/2-scripting/030-clean-script-for-tts-run/README.md`

**Out of scope**:
- `pipelines/.claude/skills/yt-style-copy/` itself — never edit this skill; the
  rulebook only *invokes* it.
- `pipelines/youtube/competitor-styles/` contents — never author or fake a
  channel pack; that's a separate, manual step the owner runs when they name a
  real channel.
- Any other stage folder (`3-voiceover` etc.) — plans 046–050.

## Git workflow

- Branch: `boss/045-explainer-scripting`
- Commit: `feat(explainer-pipeline-1): 2-scripting stage (write-script, review, clean-for-tts)` — no AI footers. Do NOT push.

## Steps

### Step 1: `010-write-script-opus/`

Write `README.md`:

```markdown
# 2/010 · write-script  ·  [OPUS]

Clones a named competitor channel's script voice for this video's topic, via
the `yt-style-copy` skill's `write-script` verb. Run in a Claude Code session
on model **Opus** (`/model opus` first) — this is the pipeline's highest-
judgment creative step.

- **In:** `--slug <channel>` + `--topic "..."` (topic also read from
  `../../0-input/010-create-drive-folders-run/output/<base>.manifest.json`)
- **Out:** `output/<base>.script.md` (copied from yt-style-copy's own output
  location — see rulebook.md for the exact copy step)
- **How:** Claude applies `rulebook.md`.
- **Hard-stop:** if `pipelines/youtube/competitor-styles/channels/<slug>/script-style-dna.md`
  does not exist, STOP and tell the user to run yt-style-copy's
  `build-script-style-dna <slug>` first. Never auto-trigger it.
- **Next:** step 020 (human review) reads `output/<base>.script.md`.
```

Write `rulebook.md`:

```markdown
# Rulebook — 2/010 write-script

Run in a Claude Code session on model Opus.

1. Take `--slug <channel>` and `--topic "<topic>"` from the operator (or read
   `<topic>` from `../../0-input/010-create-drive-folders-run/output/*.manifest.json`
   if only `--slug` was given).
2. Check `pipelines/youtube/competitor-styles/channels/<slug>/script-style-dna.md`
   exists. If it does not, STOP here and tell the operator:
   "No script-style-dna.md for '<slug>'. Run yt-style-copy build-script-style-dna
   <slug> first (requires transcripts/ to be non-empty), then re-run this step."
   Do not proceed.
3. Invoke the `yt-style-copy` skill's `write-script <slug> "<topic>"` verb
   exactly as documented in `pipelines/.claude/skills/yt-style-copy/SKILL.md`.
   This has its OWN internal two-pass gate: it drafts `outline.md` and STOPS
   for your explicit approval before drafting the full `script.md`. Approve
   the outline, then let it produce `script.md` (with the QC scorecard already
   appended as a trailing HTML comment — do not look for a separate scorecard
   file).
4. Find the produced file: glob
   `pipelines/youtube/competitor-styles/channels/<slug>/output/scripts/*/script.md`,
   sorted by modification time, take the newest (it was just created in this
   same session). Copy it — unmodified, HTML comment included — to
   `./output/<base>.script.md` in THIS step's own output folder, where
   `<base>` is the safe-name of the topic (alnum + spaces/`-_.` kept, else
   replaced with `_`; see `0-input/010`'s `safe()` function for the exact
   transform — reuse it, do not reinvent a different one).
5. Report to the operator: the slug used, the word count of the copied script,
   and the rubric scorecard's pass/fail line from the trailing HTML comment.
```

**Verify**: `test -f pipelines/youtube/explainer-videos-pipeline-1/2-scripting/010-write-script-opus/rulebook.md && test -f pipelines/youtube/explainer-videos-pipeline-1/2-scripting/010-write-script-opus/README.md && echo ok` → `ok`.

### Step 2: `020-review-script-human/`

Write `README.md`:

```markdown
# 2/020 · review-script  ·  [HUMAN]

Read `../010-write-script-opus/output/<base>.script.md` in full.

- **Resolve every `[VERIFY: …]` placeholder** — either replace it with a real,
  checked fact, or delete the claim entirely. `030-clean-script-for-tts-run`
  hard-fails if any `[VERIFY:` substring survives, by design — this is the
  gate that must catch them, not a later step.
- **Check the trailing rubric scorecard** (an HTML comment at the bottom of
  `script.md`) for any failing check; decide if it's acceptable or needs a
  rewrite pass back at 010.
- **Approve** by proceeding to step 030. There is no separate approval file —
  approval is simply choosing to run the next step.

This is separate from — and comes AFTER — `write-script`'s own internal
outline-approval gate (which already happened inside step 010, before the
full script was drafted).
```

**Verify**: `test -f pipelines/youtube/explainer-videos-pipeline-1/2-scripting/020-review-script-human/README.md && echo ok` → `ok`.

### Step 3: `030-clean-script-for-tts-run/`

Write `run.py`:

```python
#!/usr/bin/env python3
"""
Step 2/030 — strip the approved script down to TTS-safe plain text.  [RUN]

Removes markdown syntax and the trailing rubric HTML comment from the
approved script.md, and HARD-FAILS if any "[VERIFY:" placeholder survived
review — TTS must never speak an unresolved placeholder aloud.

  python3 run.py [<base>]   (default: infer from step 010's newest output)

In:  ../010-write-script-opus/output/<base>.script.md
Out: output/<base>.tts-ready.txt
"""
import sys, re, argparse, pathlib

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
PREV = HERE.parent / "010-write-script-opus" / "output"


def die(m): raise SystemExit("✖ " + m)


def infer_base():
    cands = sorted(PREV.glob("*.script.md"))
    if not cands:
        die(f"no script found at {PREV} — run step 010 first")
    return cands[-1].name.split(".script.md")[0]


def clean(text):
    # strip the trailing rubric HTML comment(s), e.g. <!-- rubric: 14/15 pass ... -->
    text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
    # strip markdown emphasis/headers/links (keep the words)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    return text.strip() + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?", help="topic base (default: infer from step 010)")
    a = ap.parse_args()

    base = a.base or infer_base()
    src = PREV / f"{base}.script.md"
    if not src.exists():
        die(f"no such file: {src}")

    raw = src.read_text()
    cleaned = clean(raw)

    if "[VERIFY:" in cleaned:
        die(f"unresolved [VERIFY: ...] placeholder(s) remain in {src} — "
            f"go back to step 020 and resolve them before TTS")

    OUT.mkdir(parents=True, exist_ok=True)
    out_path = OUT / f"{base}.tts-ready.txt"
    out_path.write_text(cleaned)
    print(f"✓ {len(cleaned.split())} words → {out_path}")
    print("→ next: step 3-voiceover/010 (synthesize-voice)")


if __name__ == "__main__":
    main()
```

Write `README.md`:

```markdown
# 2/030 · clean-script-for-tts  ·  [RUN]

Strips markdown + the trailing rubric HTML comment; hard-fails if any
`[VERIFY:` placeholder survived the human review at step 020.

- **In:** `../010-write-script-opus/output/<base>.script.md`
- **Out:** `output/<base>.tts-ready.txt`
- **Run:** `python3 run.py [<base>]`
- **Next:** step 3-voiceover/010 reads `<base>.tts-ready.txt`
```

**Verify**: `python3 -m py_compile pipelines/youtube/explainer-videos-pipeline-1/2-scripting/030-clean-script-for-tts-run/run.py` → exit 0.

### Step 4: Synthetic-input test of the clean/hard-fail logic

Create a throwaway test fixture proving both code paths, then delete it (do not
commit test fixtures — this plan has no test framework, so prove it manually and
report the result in the run-log instead):

```bash
cd pipelines/youtube/explainer-videos-pipeline-1/2-scripting
mkdir -p 010-write-script-opus/output
cat > 010-write-script-opus/output/smoketest.script.md <<'EOF'
# Hook

**This** is a *test* script with a [link](http://example.com).

<!-- rubric: 12/15 pass; #3 n/a -->
EOF
python3 030-clean-script-for-tts-run/run.py smoketest
cat 030-clean-script-for-tts-run/output/smoketest.tts-ready.txt
# Expect: "Hook\n\nThis is a test script with a link.\n" — no #, **, *, (url), no HTML comment

cat > 010-write-script-opus/output/smoketest2.script.md <<'EOF'
Some claim here [VERIFY: check this number] stays unresolved.
EOF
python3 030-clean-script-for-tts-run/run.py smoketest2 ; echo "exit=$?"
# Expect: exit=1, stderr contains "unresolved [VERIFY:"

rm -rf 010-write-script-opus/output 030-clean-script-for-tts-run/output
```

**Verify**: first run prints cleaned text with no `#`/`*`/markdown-link syntax
and no HTML comment; second run exits non-zero with the `[VERIFY:` message;
both `output/` dirs removed afterward (leave no fixture artifacts committed).

## Test plan

No test framework in `pipelines/`. Verification is `py_compile` + the manual
synthetic-input proof in Step 4, reported in the run-log (exact stdout/stderr
of both smoke-test invocations).

## Done criteria

- [ ] `010-write-script-opus/{README.md,rulebook.md}` exist
- [ ] `020-review-script-human/README.md` exists
- [ ] `030-clean-script-for-tts-run/{run.py,README.md}` exist and `run.py` compiles
- [ ] Synthetic test proves: markdown+comment stripped correctly; `[VERIFY:` present → hard-fail with clear message
- [ ] No leftover fixture files under `output/` in either step folder after Step 4

## STOP conditions

- Plan 044 has not landed (`pipelines/youtube/explainer-videos-pipeline-1/lib/` missing) — this plan does not strictly need `lib/`, but its sibling `0-input` manifest reference in the rulebook does; if `0-input/` doesn't exist yet, note it in the rulebook as "manifest path may not exist yet" rather than blocking, since this plan's own deliverables don't call it programmatically
- Any file already exists under `2-scripting/` before Step 1 — stop, do not overwrite, report what's there

## Maintenance notes

- The `<topic-kebab-slug>` yt-style-copy uses for its own output folder name is
  intentionally NOT reverse-engineered here — the rulebook globs for the
  newest `script.md` instead of constructing the path, because yt-style-copy's
  slugification is an implementation detail of a skill this plan must not
  duplicate or assume.
- If `yt-style-copy`'s `write-script` output contract ever changes (e.g. the
  scorecard moves to a separate file), update `rulebook.md`'s Step 4 pickup
  logic and `030`'s `clean()` regex together — they both assume the scorecard
  is a trailing HTML comment inside `script.md`.
