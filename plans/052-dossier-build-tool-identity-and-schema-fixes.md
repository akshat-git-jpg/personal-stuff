<!-- boss frontmatter -->
---
executor: agy
model: "Gemini 3.1 Pro (High)"
test_cmd: python3 -m pytest pipelines/youtube/dossiers/tests -q
ui: false
deploy:
needs: ["owner's explicit choice: executor agy, model Gemini 3.1 Pro (High) — do not substitute", "052 must land before 053 — 053's driver script calls create_tool_if_new and relies on the new verdict shape"]
---

# Plan 052: dossier-build — fix tool-identity matching + extraction schema

## Summary

- **Problem statement**: A live `dossier-build` run on 2026-07-08 (9 videos, 23 tools) revealed two library-level bugs in `pipelines/youtube/dossiers/registry.py` and `prompts.py`: (1) `match_tool()` only compares a newly-discovered tool name against `tools/<slug>/tool.json` folders already **on disk**, but tool folders are only created during the merge step — which runs *after* every video in a batch finishes extraction. So the same tool mentioned under different (often caption-garbled) names across videos in one batch never has anything to match against, and each name gets its own new-tool slug. Observed: "HeyGen" fragmented into `heygen`/`hey-gen`/`heygen-ai`/`hen`, "ElevenLabs" into `elevenlabs`/`11-labs`/`11-laps`, across a single 9-video batch — caught only by manual inspection before merging. (2) `TOOL_SCHEMA`'s `verdict` field is declared as a single object, but the extraction prompt's own instructions ("every item carries ts") imply list-of-items semantics for every field — and in practice Gemini 3.5 Flash (High) returned `verdict` as a list, with inconsistent inner keys, for every one of the 9 videos processed. `parse_extraction_output()` doesn't validate structural shape at all beyond checking `tool_name` is present, so this schema violation passed silently.
- **Goals**:
  - Tool folders (`tool.json`) get created the moment extraction discovers a genuinely new tool, not deferred to merge — so later videos in the *same* batch can match against them.
  - Widen `match_tool`'s near-duplicate detection modestly (0.82 → 0.75 similarity) — empirically verified against all 23 real tool slugs from today's run with zero false positives at this threshold — and add an extraction-prompt instruction telling the model to normalize an obviously garbled well-known tool name to its real spelling (the caption-mishearing cases too far from any string-similarity threshold to catch mechanically).
  - Make `verdict` a list of `{claim, ts}` objects, matching every other field's shape, in both `TOOL_SCHEMA` and the extraction prompt text.
  - `parse_extraction_output()` validates that every known list-field is actually a list, and every item in it has a `ts` — catching genuine type violations without being brittle about which other keys a model uses per item.
  - Keep `docs/superpowers/specs/2026-07-08-dossier-skills-design.md` in sync (its own comment in `prompts.py` requires this).
- **Executor proposed**: `agy`, model `Gemini 3.1 Pro (High)` — owner's explicit choice (see frontmatter `needs`).
- **Done criteria** (terse): `test_cmd` exits 0, including new tests for `create_tool_if_new`, the lowered threshold, and the new verdict-shape validation; no file under `pipelines/youtube/dossiers/videos/` or `tools/` was touched.
- **Stop conditions** (terse): any quoted excerpt doesn't match the file on disk; `pipelines/youtube/dossiers/videos/` or `tools/` contents differ from what's noted in Current state (live, uncommitted data from today's run — never touch it).
- **Test / verification for success**: pytest — extend the existing `test_registry.py`/`test_prompts.py` fixture-based suites (mocked, no network, no API keys).
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. Do NOT
> edit `plans/README.md`'s status table — boss/secretary owns that registry
> on `main` (see `decisions.md` 2026-07-07); stage only this plan file with
> your commit (`git add plans/052-…`). Keep ALL writes inside the repo working tree.
> Do **not** touch anything under `pipelines/youtube/dossiers/videos/` or
> `pipelines/youtube/dossiers/tools/` — that's live, uncommitted research data
> from a run today, orthogonal to this plan.
>
> **Drift check (run first)**: `git diff --stat c93686a..HEAD -- pipelines/youtube/dossiers/registry.py pipelines/youtube/dossiers/prompts.py pipelines/youtube/dossiers/tests pipelines/.claude/skills/dossier-build/SKILL.md docs/superpowers/specs/2026-07-08-dossier-skills-design.md` (expect: no output — none of these touched since planning)

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (051 already landed)
- **Category**: bug
- **Difficulty**: standard — every decision (exact threshold value, exact code, exact prompt wording) is fully specified below; nothing is left to the executor's judgment.
- **Planned at**: commit `c93686a`, 2026-07-08

## Why this matters

`dossier-build`'s entire value proposition is that per-tool research compounds across videos instead of resetting each time (see plan 051 / the design spec). A tool-identity bug that silently fragments one real tool into 3-4 dossier folders defeats that purpose worse than not deduping at all — a human skimming `tools/heygen/dossier.md` would see a partial, out-of-date picture and not know 3 other folders hold the rest. This was only caught because the owner manually reviewed the tool list before merging; at any real batch size (10-25 videos, the skill's stated typical range) that manual review doesn't scale. This plan fixes the two root causes: the batch-order gap in when tool folders get created, and a schema mismatch between what the prompt implies and what the schema (and therefore validation) actually expects.

## Current state

- **`pipelines/youtube/dossiers/registry.py`** (read in full) — pure bookkeeping, no LLM calls, no subprocess. Relevant current code:

  ```python
  def parse_extraction_output(raw_text):
      """Extract + validate the fenced ```json block an extraction call must
      return. Raises ParseError with a human-readable reason on any failure."""
      fence = re.search(r"```json\s*(.*?)\s*```", raw_text, re.DOTALL)
      if not fence:
          raise ParseError("no fenced ```json block found in output")
      try:
          data = json.loads(fence.group(1))
      except json.JSONDecodeError as e:
          raise ParseError(f"fenced block is not valid JSON: {e}")
      tools = data.get("tools")
      if not isinstance(tools, list) or not tools:
          raise ParseError("'tools' key missing or empty")
      for i, t in enumerate(tools):
          if not isinstance(t, dict) or not t.get("tool_name"):
              raise ParseError(f"tools[{i}] missing required 'tool_name'")
      return data
  ```

  ```python
  def load_tool(slug):
      return json.loads((TOOLS_DIR / slug / "tool.json").read_text())


  def all_tool_slugs():
      if not TOOLS_DIR.exists():
          return []
      return sorted(p.parent.name for p in TOOLS_DIR.glob("*/tool.json"))


  def match_tool(tool_name, aliases=None, near_threshold=0.82):
      """Match a discovered tool_name against existing tool folders.
      Returns ('exact', slug) | ('near', slug) | ('none', normalize_name(tool_name))."""
      aliases = aliases or []
      candidate_names = [tool_name] + list(aliases)
      candidate_slugs = {normalize_name(n) for n in candidate_names}
      for slug in all_tool_slugs():
          existing = load_tool(slug)
          existing_names = [existing.get("name", "")] + existing.get("aliases", [])
          existing_slugs = {normalize_name(n) for n in existing_names}
          if candidate_slugs & existing_slugs:
              return "exact", slug
      best_slug, best_ratio = None, 0.0
      for slug in all_tool_slugs():
          existing = load_tool(slug)
          existing_names = [existing.get("name", "")] + existing.get("aliases", [])
          for cn in candidate_names:
              for en in existing_names:
                  ratio = difflib.SequenceMatcher(None, normalize_name(cn), normalize_name(en)).ratio()
                  if ratio > best_ratio:
                      best_slug, best_ratio = slug, ratio
      if best_slug and best_ratio >= near_threshold:
          return "near", best_slug
      return "none", normalize_name(tool_name)
  ```

  **Root cause of the batch-fragmentation bug**: `all_tool_slugs()`/`load_tool()` read from `TOOLS_DIR` (`tools/<slug>/tool.json`), and nothing in `registry.py` or the `dossier-build` skill (see below) creates that file until the **merge** step. `dossier-build`'s Step 2 (extraction) runs for every pending video in the batch before Step 3 (merge) runs for any tool — so a tool first seen in video 3 of 9 has no folder to match against when video 3 is processed, even if videos 1 and 2 already mentioned the "same" tool under a different spelling.

  **Empirical threshold check** (done during planning, reproducible): comparing all 23 real tool slugs created by today's run pairwise, **zero pairs score ≥ 0.70** on `difflib.SequenceMatcher` — so lowering `near_threshold` to 0.75 introduces no observed false positives on real data. The specific caption-garble cases from today: `heygen-ai` vs `heygen` = 0.8 (now caught), `hey-gen` vs `heygen` = 0.923 (already caught even at 0.82, but only reachable at all once folders exist — see the batch-order fix above), `11-laps` vs `11-labs` = 0.857 (now caught). One case remains uncatchable by string similarity alone: `hen` vs `heygen` = 0.667 — this is why the extraction prompt also gets a normalization instruction (Step 3 below) rather than relying solely on a lower threshold, which would risk false positives on genuinely distinct short names.

- **`pipelines/youtube/dossiers/prompts.py`** (read in full) — the `verdict` field:

  ```python
      "verdict": {"type": "object", "properties": {"summary": {"type": "string"}, "rank": {"type": "string"}, "ts": {"type": "string"}}},
  ```

  and the extraction prompt's relevant lines:

  ```
  For EACH tool identified, extract:
  - identity_notes: what it is, who it's for
  - pricing_claims: plan, price, detail - copied exactly as spoken, never rounded or converted
  - strengths / weaknesses / quirks: friction, surprises, bugs, confusing UX
  - demos: things the creator actually DID on screen (not just described)
  - comparisons: explicit head-to-head claims against other tools named in this video
  - verdict: the creator's ranking or recommendation, with their stated reasoning

  Every item carries "ts": the [mm:ss] of the transcript line supporting it.
  Empty arrays are fine. NEVER invent or infer beyond the transcript.
  ```

  Note the contradiction already present: "every item carries ts" implies every field (including `verdict`) is a list of ts-tagged items, but `TOOL_SCHEMA` declared `verdict` as a bare object. This is very likely *why* Gemini 3.5 Flash (High) returned `verdict` as a list in all 9/9 extractions during today's run — it was following the prompt's own stated convention over the (never explicitly restated per-field) schema. The fix makes the schema match the prompt's actual, working convention, rather than fighting it.

- **`pipelines/youtube/dossiers/tests/test_registry.py`** and **`test_prompts.py`** (both read in full) — existing fixture-based pytest suites, no network/subprocess, using `tmp_path`/`monkeypatch` to isolate `VIDEOS_DIR`/`TOOLS_DIR`. `test_registry.py`'s existing `test_match_tool_near_duplicate` already passes `near_threshold=0.7` explicitly, so it is unaffected by lowering the default.

- **`pipelines/.claude/skills/dossier-build/SKILL.md`** (read in full) — Step 2, point 5's third bullet currently reads:

  ```
     - `("none", slug)` -- new tool; note it in the run's "new tools" list; this video mentions `slug`.
  ```

  and Step 3, point 3 currently reads:

  ```
  3. Read the current `pipelines/youtube/dossiers/tools/<slug>/dossier.md`, or use `prompts.DOSSIER_SKELETON.format(tool_name=..., date=today, n=0, newest="—")` if the tool folder is new (create `tools/<slug>/tool.json` with `{"name", "aliases"}` from the first video's `tools[]` entry for this slug).
  ```

- **`docs/superpowers/specs/2026-07-08-dossier-skills-design.md`** (read in full) — `prompts.py`'s module docstring says these prompts are "Verbatim from" this spec and must not be edited without updating the spec to match. The spec's own copies of the extraction prompt (lines 101-133), `TOOL_SCHEMA` (lines 135-154), and the "Tool identity matching" section (lines 217-223) need the same edits mirrored in, so the doc and code don't diverge.

- **Uncommitted working-tree state** (do not touch): `git status --short` currently shows `pipelines/youtube/dossiers/videos/` and `pipelines/youtube/dossiers/tools/` as untracked directories (9 video folders, 23 tool folders — real research data from a run today), plus `pipelines/youtube/dossiers/.last-method.json`. None of this is in scope for this plan.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Run dossiers test suite | `python3 -m pytest pipelines/youtube/dossiers/tests -q` | exit 0 |
| Sanity-check threshold on real data | `cd pipelines/youtube/dossiers && python3 -c "import sys,itertools,difflib; sys.path.insert(0,'.'); import registry; slugs=registry.all_tool_slugs(); print([(a,b,round(difflib.SequenceMatcher(None,a,b).ratio(),3)) for a,b in itertools.combinations(slugs,2) if difflib.SequenceMatcher(None,a,b).ratio()>=0.70])"` | `[]` (no output pairs — confirms no new false positives against live data) |

## Scope

**In scope**:
- `pipelines/youtube/dossiers/registry.py` (edit)
- `pipelines/youtube/dossiers/prompts.py` (edit)
- `pipelines/youtube/dossiers/tests/test_registry.py` (extend)
- `pipelines/youtube/dossiers/tests/test_prompts.py` (extend)
- `pipelines/.claude/skills/dossier-build/SKILL.md` (edit, two spots)
- `docs/superpowers/specs/2026-07-08-dossier-skills-design.md` (edit, to mirror the prompt/schema/matching changes)

**Out of scope**:
- `pipelines/youtube/dossiers/videos/**`, `pipelines/youtube/dossiers/tools/**`, `.last-method.json` — live, uncommitted data from a run today. Do not touch, regenerate, or commit any of it.
- Any new driver/runner script (`extract.py`, `merge.py`, etc.) — that's plan 053, which depends on this one.
- `pipelines/.claude/skills/dossier-transcripts/SKILL.md` — untouched here (plan 053's metadata-backfill work).
- `pipelines/common/transcribe.py` — untouched.
- The `agy` CLI retry/timeout logic and usage documentation — plan 053.

## Git workflow

- Branch: `advisor/052-dossier-build-tool-identity-and-schema-fixes`
- Commit: `fix(dossiers): dedupe tool identity within a batch + fix verdict schema` — no AI footers. Do NOT push.

## Steps

### Step 1: `registry.py` — create tool folders immediately, not at merge time

In `pipelines/youtube/dossiers/registry.py`, change the `match_tool` default threshold:

Replace:
```python
def match_tool(tool_name, aliases=None, near_threshold=0.82):
```
with:
```python
def match_tool(tool_name, aliases=None, near_threshold=0.75):
```

Then add a new function immediately after `match_tool`'s closing `return "none", normalize_name(tool_name)` line:

```python


def create_tool_if_new(tool_name, aliases, slug):
    """Create tools/<slug>/tool.json immediately when extraction discovers a
    genuinely new tool (match_tool returned ("none", slug)) - do NOT wait for
    the merge step. This lets later videos in the SAME batch match against it
    via match_tool's on-disk lookup: previously, tool folders were only
    created during merge (after the whole batch finished extraction), so the
    same real tool mentioned under different names across videos in one batch
    (e.g. caption-garbled spellings) each scored "none" independently and
    fragmented into separate slugs (see plans/052-dossier-build-tool-identity-
    and-schema-fixes.md). dossier.md is still created lazily at merge time
    (DOSSIER_SKELETON) - it needs the per-tool skeleton logic that lives in
    dossier-build's merge step, not extraction. Returns True if it created
    tool.json, False if one already existed (idempotent - safe to call for
    every "none" match without checking existence first)."""
    tool_dir = TOOLS_DIR / slug
    tool_json_path = tool_dir / "tool.json"
    if tool_json_path.exists():
        return False
    tool_dir.mkdir(parents=True, exist_ok=True)
    tool_json_path.write_text(json.dumps({"name": tool_name, "aliases": aliases or []}, indent=2, sort_keys=True))
    return True
```

**Verify**: `python3 -c "
import sys; sys.path.insert(0, 'pipelines/youtube/dossiers')
import registry
print(registry.match_tool.__defaults__)
print(callable(registry.create_tool_if_new))
"` -> `(None, 0.75)` then `True`

### Step 2: `registry.py` — validate extraction output structurally

Replace the whole `parse_extraction_output` function:

```python
def parse_extraction_output(raw_text):
    """Extract + validate the fenced ```json block an extraction call must
    return. Raises ParseError with a human-readable reason on any failure."""
    fence = re.search(r"```json\s*(.*?)\s*```", raw_text, re.DOTALL)
    if not fence:
        raise ParseError("no fenced ```json block found in output")
    try:
        data = json.loads(fence.group(1))
    except json.JSONDecodeError as e:
        raise ParseError(f"fenced block is not valid JSON: {e}")
    tools = data.get("tools")
    if not isinstance(tools, list) or not tools:
        raise ParseError("'tools' key missing or empty")
    for i, t in enumerate(tools):
        if not isinstance(t, dict) or not t.get("tool_name"):
            raise ParseError(f"tools[{i}] missing required 'tool_name'")
        for field in LIST_FIELDS:
            value = t.get(field, [])
            if not isinstance(value, list):
                raise ParseError(f"tools[{i}] ({t.get('tool_name')!r}) field {field!r} must be a list, got {type(value).__name__}")
            for j, item in enumerate(value):
                if not isinstance(item, dict) or not item.get("ts"):
                    raise ParseError(f"tools[{i}] ({t.get('tool_name')!r}) {field}[{j}] missing required 'ts'")
    return data
```

This is intentionally lenient on which *other* keys each item carries (real model output uses inconsistent keys like `text`/`claim`/`recommendation`+`reasoning` per item across different videos — all are valid as long as `ts` is present and the field itself is a list), but strict on structural shape: every listed field must be a list, and every item in it must be a dict with `ts`.

Add the `LIST_FIELDS` constant near the top of the file, directly above the `class ParseError(Exception):` line:

```python
LIST_FIELDS = ["identity_notes", "pricing_claims", "strengths", "weaknesses", "quirks", "demos", "comparisons", "verdict"]


class ParseError(Exception):
    pass
```

(Remove the old standalone `class ParseError(Exception):\n    pass` line once `LIST_FIELDS` is placed directly above it — don't leave two copies.)

**Verify**: `python3 -c "
import sys; sys.path.insert(0, 'pipelines/youtube/dossiers')
import registry
raw = '''\`\`\`json
{\"tools\": [{\"tool_name\": \"X\", \"verdict\": {\"summary\": \"bad shape\"}}]}
\`\`\`'''
try:
    registry.parse_extraction_output(raw)
    print('FAIL: should have raised')
except registry.ParseError as e:
    print('ok:', e)
"` -> prints `ok: tools[0] ('X') field 'verdict' must be a list, got dict`

### Step 3: `prompts.py` — fix `verdict` schema + add name-normalization instruction

Replace the `TOOL_SCHEMA` line:
```python
        "verdict": {"type": "object", "properties": {"summary": {"type": "string"}, "rank": {"type": "string"}, "ts": {"type": "string"}}},
```
with:
```python
        "verdict": {"type": "array", "items": {"type": "object", "properties": {"claim": {"type": "string"}, "ts": {"type": "string"}}, "required": ["claim", "ts"]}},
```

In `EXTRACTION_PROMPT`, replace this block:
```
Identify every distinct tool discussed with real content (ignore a tool named
only in passing with no claims about it).

For EACH tool identified, extract:
- identity_notes: what it is, who it's for
- pricing_claims: plan, price, detail - copied exactly as spoken, never rounded or converted
- strengths / weaknesses / quirks: friction, surprises, bugs, confusing UX
- demos: things the creator actually DID on screen (not just described)
- comparisons: explicit head-to-head claims against other tools named in this video
- verdict: the creator's ranking or recommendation, with their stated reasoning
```
with:
```
Identify every distinct tool discussed with real content (ignore a tool named
only in passing with no claims about it). If a tool's name looks like it was
mangled by auto-captions (a well-known software/AI product name garbled into
something phonetically similar - e.g. "Hunen"/"Hen" for "HeyGen", "11 Labs"/
"11 laps" for "ElevenLabs"), use the tool's real, correctly-spelled name as
tool_name and add the garbled transcript spelling to aliases, so the same
tool is never split into multiple entries by a transcription error.

For EACH tool identified, extract:
- identity_notes: what it is, who it's for
- pricing_claims: plan, price, detail - copied exactly as spoken, never rounded or converted
- strengths / weaknesses / quirks: friction, surprises, bugs, confusing UX
- demos: things the creator actually DID on screen (not just described)
- comparisons: explicit head-to-head claims against other tools named in this video
- verdict: the creator's ranking or recommendation claims, with their stated reasoning (same list-of-{claim, ts} shape as the other fields - a video can state more than one verdict-type claim, e.g. one per comparison round)
```

**Verify**: `python3 -c "
import sys; sys.path.insert(0, 'pipelines/youtube/dossiers')
import prompts
assert prompts.TOOL_SCHEMA['properties']['verdict']['type'] == 'array'
assert 'mangled by auto-captions' in prompts.EXTRACTION_PROMPT
print('ok')
"` -> `ok`

### Step 4: `docs/superpowers/specs/2026-07-08-dossier-skills-design.md` — mirror the changes

In the same file, apply the identical three edits to keep the spec in sync (per `prompts.py`'s own docstring requirement):

1. Replace line 119 (`- verdict: the creator's ranking or recommendation, with their stated reasoning`) and insert the same "mangled by auto-captions" paragraph before the "For EACH tool identified, extract:" line, matching Step 3's wording exactly (both the inserted paragraph and the reworded verdict bullet).
2. Replace line 150 (`"verdict": {"type": "object", ...}`) with the same array-shaped `TOOL_SCHEMA` line from Step 3.
3. In the "Tool identity matching" section (lines 217-223), after the bullet `- **No match at all** (genuinely new) → auto-create the folder, ...`, add: `Folder creation now happens immediately during extraction (registry.create_tool_if_new), not deferred to the merge step - this closes a batch-order gap where the same tool mentioned under different (e.g. caption-garbled) names across videos in one batch previously scored "no match" independently for each name, since no folder existed yet for any of them to match against (fixed 2026-07-08, see plans/052-dossier-build-tool-identity-and-schema-fixes.md).`

**Verify**: `grep -c "create_tool_if_new" docs/superpowers/specs/2026-07-08-dossier-skills-design.md` -> `1` (or more)

### Step 5: `pipelines/.claude/skills/dossier-build/SKILL.md` — reflect the new creation timing

Replace this bullet in Step 2, point 5:
```
   - `("none", slug)` -- new tool; note it in the run's "new tools" list; this video mentions `slug`.
```
with:
```
   - `("none", slug)` -- new tool; call `registry.create_tool_if_new(tool_name, aliases, slug)` immediately (so later videos in this same batch can match against it), note it in the run's "new tools" list, this video mentions `slug`.
```

Replace this line in Step 3, point 3:
```
3. Read the current `pipelines/youtube/dossiers/tools/<slug>/dossier.md`, or use `prompts.DOSSIER_SKELETON.format(tool_name=..., date=today, n=0, newest="—")` if the tool folder is new (create `tools/<slug>/tool.json` with `{"name", "aliases"}` from the first video's `tools[]` entry for this slug).
```
with:
```
3. Read the current `pipelines/youtube/dossiers/tools/<slug>/dossier.md`, or use `prompts.DOSSIER_SKELETON.format(tool_name=..., date=today, n=0, newest="—")` if `dossier.md` doesn't exist yet. `tool.json` already exists by this point (created during extraction via `create_tool_if_new` — Step 2) — merge no longer creates it.
```

**Verify**: `grep -c "create_tool_if_new" pipelines/.claude/skills/dossier-build/SKILL.md` -> `2`

### Step 6: Extend `test_registry.py`

Add these tests to `pipelines/youtube/dossiers/tests/test_registry.py` (append at the end of the file):

```python


def test_create_tool_if_new_writes_file(tmp_path, monkeypatch):
    monkeypatch.setattr(registry, "TOOLS_DIR", tmp_path / "tools")
    created = registry.create_tool_if_new("HeyGen", ["Hen", "HeyGen AI"], "heygen")
    assert created is True
    data = json.loads((tmp_path / "tools" / "heygen" / "tool.json").read_text())
    assert data == {"name": "HeyGen", "aliases": ["Hen", "HeyGen AI"]}


def test_create_tool_if_new_is_idempotent(tmp_path, monkeypatch):
    monkeypatch.setattr(registry, "TOOLS_DIR", tmp_path / "tools")
    assert registry.create_tool_if_new("HeyGen", [], "heygen") is True
    assert registry.create_tool_if_new("HeyGen", [], "heygen") is False


def test_create_tool_if_new_lets_batch_internal_dedup_work(tmp_path, monkeypatch):
    """The batch-order fix: once create_tool_if_new runs for the first video's
    'none' match, a later video's near-spelling of the same tool in the SAME
    batch now has something on disk to match against."""
    monkeypatch.setattr(registry, "TOOLS_DIR", tmp_path / "tools")
    kind, slug = registry.match_tool("HeyGen")
    assert (kind, slug) == ("none", "heygen")
    registry.create_tool_if_new("HeyGen", [], slug)
    kind2, slug2 = registry.match_tool("HeyGen AI")
    assert (kind2, slug2) == ("near", "heygen")


def test_match_tool_default_threshold_catches_heygen_ai(tmp_path, monkeypatch):
    """Regression test for the live-run threshold gap: 'HeyGen AI' vs 'HeyGen'
    scores 0.8, which the old default (0.82) missed and the new default
    (0.75) catches."""
    monkeypatch.setattr(registry, "TOOLS_DIR", tmp_path / "tools")
    d = tmp_path / "tools" / "heygen"
    d.mkdir(parents=True)
    (d / "tool.json").write_text(json.dumps({"name": "HeyGen", "aliases": []}))
    kind, slug = registry.match_tool("HeyGen AI")
    assert (kind, slug) == ("near", "heygen")


def test_parse_extraction_output_rejects_non_list_field():
    raw = '```json\n{"tools": [{"tool_name": "X", "verdict": {"summary": "bad shape"}}]}\n```'
    try:
        registry.parse_extraction_output(raw)
        assert False, "expected ParseError"
    except registry.ParseError as e:
        assert "verdict" in str(e) and "list" in str(e)


def test_parse_extraction_output_rejects_item_missing_ts():
    raw = '```json\n{"tools": [{"tool_name": "X", "strengths": [{"claim": "fast"}]}]}\n```'
    try:
        registry.parse_extraction_output(raw)
        assert False, "expected ParseError"
    except registry.ParseError as e:
        assert "ts" in str(e)


def test_parse_extraction_output_accepts_verdict_as_list():
    raw = '```json\n{"tools": [{"tool_name": "X", "verdict": [{"claim": "best overall", "ts": "01:00"}]}]}\n```'
    data = registry.parse_extraction_output(raw)
    assert data["tools"][0]["verdict"][0]["claim"] == "best overall"


def test_parse_extraction_output_accepts_heterogeneous_item_keys():
    """Real model output uses inconsistent keys per item (text/claim/summary+rank/
    recommendation+reasoning) - the parser must accept any of these as long as
    ts is present, since the markdown-writing step formats generically."""
    raw = '```json\n{"tools": [{"tool_name": "X", "verdict": [{"recommendation": "buy it", "reasoning": "cheap", "ts": "01:00"}]}]}\n```'
    data = registry.parse_extraction_output(raw)
    assert data["tools"][0]["verdict"][0]["recommendation"] == "buy it"
```

**Verify**: `python3 -m pytest pipelines/youtube/dossiers/tests/test_registry.py -v` -> 18 passed (10 existing + 8 new).

### Step 7: Extend `test_prompts.py`

Add this test to `pipelines/youtube/dossiers/tests/test_prompts.py` (append at the end of the file):

```python


def test_tool_schema_verdict_is_array():
    assert prompts.TOOL_SCHEMA["properties"]["verdict"]["type"] == "array"
    assert "ts" in prompts.TOOL_SCHEMA["properties"]["verdict"]["items"]["required"]


def test_extraction_prompt_has_normalization_instruction():
    assert "mangled by auto-captions" in prompts.EXTRACTION_PROMPT
```

**Verify**: `python3 -m pytest pipelines/youtube/dossiers/tests/test_prompts.py -v` -> 7 passed (5 existing + 2 new).

## Test plan

Steps 6 and 7 are the test plan — all new tests are pure-function, fixture-based, no network/subprocess, matching the existing suite's style exactly (`tmp_path`/`monkeypatch` for filesystem isolation).

## Done criteria

- [ ] `python3 -m pytest pipelines/youtube/dossiers/tests -q` exits 0 (25 tests: 18 in `test_registry.py` + 7 in `test_prompts.py`).
- [ ] `registry.match_tool.__defaults__` shows `0.75` as the new default threshold.
- [ ] `registry.create_tool_if_new` exists, is idempotent, and is covered by tests.
- [ ] `prompts.TOOL_SCHEMA["properties"]["verdict"]["type"] == "array"`.
- [ ] `docs/superpowers/specs/2026-07-08-dossier-skills-design.md` mirrors all three prompt/schema/matching changes.
- [ ] `pipelines/.claude/skills/dossier-build/SKILL.md` references `create_tool_if_new` in both Step 2 and Step 3.
- [ ] No file under `pipelines/youtube/dossiers/videos/` or `pipelines/youtube/dossiers/tools/` was created, modified, or deleted (`git status --short pipelines/youtube/dossiers/videos pipelines/youtube/dossiers/tools` shows the exact same untracked-but-unchanged state as before this plan ran).

## STOP conditions

- Any quoted excerpt in this plan (a code block, a line to replace) doesn't match the file on disk exactly — stop; don't guess a new anchor.
- `pipelines/youtube/dossiers/videos/` or `pipelines/youtube/dossiers/tools/` contents look different from "9 video folders, 23 tool folders, all untracked" — stop and report; this plan must not touch live research data.
- The threshold sanity-check command (Commands table) prints any pairs — stop and report before proceeding with the 0.75 default; that would mean today's real data has a false-positive risk this plan didn't anticipate.
- A non-stdlib package is needed for any of this — stop; stdlib-only is a hard constraint for `registry.py`/`prompts.py` (see plan 051's precedent).

## Maintenance notes

- `near_threshold=0.75` is a data point, not a law — if a future batch produces a real false-positive near-match at this threshold, that's a signal to raise it back up slightly and lean more on the extraction-prompt normalization instruction instead (Step 3) rather than chasing the threshold indefinitely.
- `create_tool_if_new` intentionally does NOT create `dossier.md` — only `tool.json`. Merge (Step 3 of `dossier-build`) still owns `DOSSIER_SKELETON` creation, keyed off whether `dossier.md` exists, not whether the tool folder exists.
- The extraction-prompt normalization instruction only helps for tools the model actually recognizes as well-known; a genuinely obscure or very new tool with garbled captions and no realistic brand match will still fragment — that's inherent to caption-transcription quality, not something schema/threshold tuning can fully solve. The near-duplicate flagging path (`("near", slug)`, held pending for an owner decision) is what catches the borderline cases this plan's threshold change surfaces.
