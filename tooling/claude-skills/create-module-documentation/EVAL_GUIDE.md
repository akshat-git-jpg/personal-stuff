# Eval & Optimization Guide for `create-module-documentation`

This guide walks you through testing, benchmarking, and optimizing the skill. Pick it up whenever you're ready — nothing here runs automatically.

**Skill-creator base path:** `~/.claude/skills/skill-creator/`

---

## Part 1: Setting Up Test Cases

Create an `evals/` directory next to the skill and add `evals.json`:

```bash
mkdir -p zluri-docs/skills/create-module-documentation/evals
```

Write 2-3 realistic test prompts. Each should mimic what a real user would say when documenting a module.

### evals.json format

```json
{
  "skill_name": "create-module-documentation",
  "evals": [
    {
      "id": 1,
      "prompt": "Document the license-management module. Collections: licenses, licenseAssignments, licenseEntitlements. Tables: none. Repos: dashboard-api (API) with files: src/app/controllers/LicenseController.ts, src/app/services/LicenseService.ts, src/app/dal/license.dal.ts. Also backend-scripts (script) with files: scripts/license-sync.ts, scripts/license-cleanup.ts",
      "expected_output": "Module HLD at docs/license-management.md with overview placeholder, 3 collections listed, repo table with 2 entries. ER diagram at diagrams/license-management.md. Two repo docs created.",
      "files": [],
      "assertions": []
    },
    {
      "id": 2,
      "prompt": "I need to create module documentation for our notifications system. MongoDB collections are: notifications, notificationtemplates, notificationpreferences. Postgres: notification_logs, notification_channels. Repos: dashboard-api (API type) — src/app/controllers/NotificationController.ts, src/app/services/NotificationService.ts. And Integration-queue-consumer (script type) — src/consumers/notification-consumer.ts, src/handlers/notification-handler.ts",
      "expected_output": "Module HLD with both MongoDB and Postgres sections, ER diagram covering both databases, repo docs for both repos using correct templates.",
      "files": [],
      "assertions": []
    },
    {
      "id": 3,
      "prompt": "/create-module-documentation for a simple module — workflows. Just one collection: workflows. One repo: backend-scripts (script) with files: scripts/workflow-engine.ts, scripts/workflow-executor.ts",
      "expected_output": "Minimal but complete documentation — HLD with 1 collection, simple ER diagram, one repo doc.",
      "files": [],
      "assertions": []
    }
  ]
}
```

---

## Part 2: Running Test Cases

Create a workspace directory for results:

```bash
mkdir -p zluri-docs/skills/create-module-documentation-workspace/iteration-1
```

### For each test case, spawn TWO subagents in the same turn:

**With-skill run:**
```
Execute this task:
- Skill path: zluri-docs/skills/create-module-documentation/SKILL.md
- Task: <eval prompt from evals.json>
- Save outputs to: <workspace>/iteration-1/eval-<ID>/with_skill/outputs/
- Outputs to save: all generated .md files
```

**Baseline run (without skill):**
```
Execute this task (no skill):
- Task: <same eval prompt>
- Save outputs to: <workspace>/iteration-1/eval-<ID>/without_skill/outputs/
- Outputs to save: all generated .md files
```

### Write eval_metadata.json for each test case:

```json
{
  "eval_id": 1,
  "eval_name": "license-management-full",
  "prompt": "Document the license-management module...",
  "assertions": []
}
```

### Capture timing data

When each subagent completes, you'll get `total_tokens` and `duration_ms` in the notification. Save immediately to `timing.json` in the run directory:

```json
{
  "total_tokens": 84852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3
}
```

---

## Part 3: Writing Assertions

While runs are in progress, draft assertions for each test case. Good assertions for this skill:

| Assertion | What it checks |
|-----------|---------------|
| `module_hld_exists` | File exists at `docs/<MODULE_NAME>.md` |
| `hld_has_overview` | HLD contains a non-empty `## Overview` section |
| `hld_lists_all_collections` | Every collection name from the input appears in the HLD |
| `hld_lists_all_tables` | Every table name from the input appears (if any were provided) |
| `hld_has_repo_table` | HLD contains a `## Relevant Repositories` table |
| `hld_repo_table_complete` | Repo table has one row per repo from the input |
| `er_diagram_exists` | File exists at `diagrams/<MODULE_NAME>.md` |
| `er_has_mermaid_block` | ER file contains a ````mermaid` code block |
| `er_uses_graph_td` | Mermaid uses `graph TD` (not `erDiagram`) |
| `er_has_all_collections` | Every collection appears as a node in the diagram |
| `er_has_relationship_summary` | ER file contains a `## Relationship Summary` table |
| `repo_docs_exist` | A doc file exists for each repo |
| `api_repo_has_correct_sections` | API repo docs have Controllers, Services, DAL sections |
| `script_repo_has_core_files` | Script repo docs have Core Files section |
| `overview_not_ai_generated` | Overview text matches user input (not boilerplate like "This module provides...") |

Add assertions to both `eval_metadata.json` and `evals/evals.json`:

```json
{
  "assertions": [
    {
      "name": "module_hld_exists",
      "type": "file_exists",
      "check": "docs/<MODULE_NAME>.md exists in outputs"
    },
    {
      "name": "hld_lists_all_collections",
      "type": "content_contains",
      "check": "All collection names from input appear in the HLD file"
    }
  ]
}
```

---

## Part 4: Grading & Benchmarking

### Grade each run

Use the grader agent from the skill-creator:

```
Read ~/.claude/skills/skill-creator/agents/grader.md and evaluate each assertion
against the outputs in <workspace>/iteration-1/eval-<ID>/<run_type>/outputs/.
Save results to grading.json in each run directory.
```

**grading.json format** (the viewer requires these exact field names):

```json
{
  "eval_id": 1,
  "run_type": "with_skill",
  "expectations": [
    {
      "text": "module_hld_exists",
      "passed": true,
      "evidence": "File docs/license-management.md found in outputs/"
    },
    {
      "text": "hld_lists_all_collections",
      "passed": true,
      "evidence": "Found: licenses, licenseAssignments, licenseEntitlements"
    }
  ]
}
```

For assertions that can be checked programmatically (file existence, string matching), write and run a script rather than eyeballing it.

### Aggregate into benchmark

```bash
python -m scripts.aggregate_benchmark \
  zluri-docs/skills/create-module-documentation-workspace/iteration-1 \
  --skill-name create-module-documentation
```

Run this from the skill-creator directory (`~/.claude/skills/skill-creator/`). It produces `benchmark.json` and `benchmark.md` with pass_rate, timing, and tokens for each configuration.

### Launch the viewer

```bash
nohup python ~/.claude/skills/skill-creator/eval-viewer/generate_review.py \
  zluri-docs/skills/create-module-documentation-workspace/iteration-1 \
  --skill-name "create-module-documentation" \
  --benchmark zluri-docs/skills/create-module-documentation-workspace/iteration-1/benchmark.json \
  > /dev/null 2>&1 &
VIEWER_PID=$!
```

For iteration 2+, also pass:
```
--previous-workspace zluri-docs/skills/create-module-documentation-workspace/iteration-<N-1>
```

If no browser is available (headless/cowork), use `--static /tmp/review.html` instead.

### What you'll see in the viewer

**Outputs tab:** Click through each test case — see the prompt, generated files, and leave feedback in the textbox.

**Benchmark tab:** Pass rates, timing, and token usage comparing with-skill vs without-skill. Per-eval breakdowns and analyst observations.

When done reviewing, click "Submit All Reviews" — saves feedback to `feedback.json`.

---

## Part 5: Iteration Loop

1. Read `feedback.json` — empty feedback means the output was fine
2. Focus improvements on test cases where you had specific complaints
3. Edit the SKILL.md based on feedback — generalize, don't overfit to specific test cases
4. Rerun all test cases into `iteration-<N+1>/` (including baseline runs)
5. Launch viewer with `--previous-workspace` pointing at the prior iteration
6. Review again, repeat until satisfied

### Tips for improving the skill

- **Generalize from feedback.** If the ER diagram missed relationships in one test, don't add a rule for that specific case — improve the schema discovery instructions generally.
- **Keep it lean.** Read the transcripts (not just outputs) — if the skill makes the model waste time, trim those instructions.
- **Explain why.** Instead of `ALWAYS do X`, explain why X matters. The model follows reasoning better than commands.
- **Look for repeated work.** If every test run independently creates the same helper pattern, bundle it in the skill.

---

## Part 6: Description Optimization

After the skill is finalized and working well, optimize the description for better triggering.

### Step 1: Generate 20 trigger eval queries

Create a JSON file with 10 should-trigger and 10 should-not-trigger queries:

```json
[
  {
    "query": "I need to set up docs for our billing module — we have about 8 mongo collections and 3 repos involved, following the zluri-docs pattern",
    "should_trigger": true
  },
  {
    "query": "Can you add a JSDoc comment to this function in the access reviews controller?",
    "should_trigger": false
  }
]
```

**Should-trigger queries (10):** Different phrasings of wanting to document a module — casual, formal, indirect references to "HLD", "module docs", "zluri-docs", "onboard a module", etc.

**Should-not-trigger queries (10):** Near-misses that share keywords but need something different — editing existing docs, reading docs, adding code comments, creating API docs (Swagger), writing README files, etc.

### Step 2: Review with user

Use the HTML template from the skill-creator:

```bash
# Read the template
cat ~/.claude/skills/skill-creator/assets/eval_review.html

# Replace placeholders:
# __EVAL_DATA_PLACEHOLDER__ → your JSON array
# __SKILL_NAME_PLACEHOLDER__ → create-module-documentation
# __SKILL_DESCRIPTION_PLACEHOLDER__ → current description

# Write to temp file and open
open /tmp/eval_review_create-module-documentation.html
```

User can edit queries, toggle should-trigger, add/remove entries, then click "Export Eval Set" to download `eval_set.json`.

### Step 3: Run the optimization loop

```bash
python -m scripts.run_loop \
  --eval-set <path-to-eval_set.json> \
  --skill-path zluri-docs/skills/create-module-documentation \
  --model claude-opus-4-6 \
  --max-iterations 5 \
  --verbose
```

Run from the skill-creator directory. This:
- Splits eval set into 60% train / 40% test
- Evaluates current description (3 runs per query for reliability)
- Proposes improved descriptions based on failures
- Re-evaluates each iteration on both train and test
- Returns JSON with `best_description` (selected by test score to avoid overfitting)

### Step 4: Apply the result

Update the `description` field in SKILL.md frontmatter with `best_description` from the output.

---

## Reference Paths

| What | Path |
|------|------|
| Skill-creator base | `~/.claude/skills/skill-creator/` |
| Grader agent | `~/.claude/skills/skill-creator/agents/grader.md` |
| Comparator agent | `~/.claude/skills/skill-creator/agents/comparator.md` |
| Analyzer agent | `~/.claude/skills/skill-creator/agents/analyzer.md` |
| Schemas reference | `~/.claude/skills/skill-creator/references/schemas.md` |
| Eval review HTML | `~/.claude/skills/skill-creator/assets/eval_review.html` |
| Aggregate script | `~/.claude/skills/skill-creator/scripts/aggregate_benchmark.py` |
| Review viewer | `~/.claude/skills/skill-creator/eval-viewer/generate_review.py` |
| Optimization loop | `~/.claude/skills/skill-creator/scripts/run_loop.py` |
