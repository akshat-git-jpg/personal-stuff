---
executor: claude-p
model: sonnet
test_cmd: bash .claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh && bash .claude/skills/kushal-health/scripts/check-skill.sh
ui:
deploy:
needs: [plan 269 must land first - this skill drives its push script and API]
needs_plans: [269]
needs_prs: []
touches: [.claude/skills/kushal-health/]
mutation_apply: sed -i.bak '/^## Owner check$/d' .claude/skills/kushal-health/SKILL.md && rm .claude/skills/kushal-health/SKILL.md.bak
mutation_command: bash .claude/skills/kushal-health/scripts/check-skill.sh
mutation_expect: missing section: ## Owner check
---

# Plan 270: `kushal-health` skill — add a blood report from a PDF

## Summary

- **Problem statement**: Plan 269 ships the app and a push script, but nothing turns a lab PDF
  into the JSON it takes. The owner wants to say "add my blood report <path>" and have Claude do it.
- **Goals**:
  - A repo-scoped skill `.claude/skills/kushal-health/` that: extracts text with `pdftotext`, maps every test to a canonical marker key, shows the owner a check table, waits for "ok", writes a short verdict using the history, pushes JSON + PDF, and confirms.
  - A seed alias table of common Indian lab test names -> canonical keys, so the same test from different labs lands on one chart line.
  - A small structural check script (`scripts/check-skill.sh`) used as the merge gate.
- **Decisions confirmed** (owner, 2026-10-06):
  - How reports get in -> Claude reads the PDF in a session, owner checks the numbers, Claude pushes (no AI in the app).
  - Verdict -> app colours by rule + a short Claude-written verdict per report, stored with the report.
  - Access -> PIN gate; this skill never touches the PIN.
  - Original PDFs -> stored in R2 via the push script.
- **Executor proposed**: claude-p / sonnet — the deliverable is instruction prose the owner judges (rules.md "quality-setting content" row).
- **Done criteria**: skill folder exists, description within budget, `check-skill.sh` passes, mutation fires.
- **Stop conditions**: plan 269's `scripts/push-report.mjs` is missing or its flags differ from this plan.
- **Test / verification for success**: description-budget check + `check-skill.sh` (required sections, required commands, alias table shape) + mutation.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7a4042ee..HEAD -- .claude/skills/kushal-health apps/kushal-health/scripts/push-report.mjs` (expect: only plan 269's `apps/kushal-health` files; `.claude/skills/kushal-health` must not exist)

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plan 269 (merged)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `7a4042ee`, 2026-10-06

## Why this matters

The app only stores numbers it is handed. The quality of every chart depends on this step: one
wrong marker key splits a test into two lines, one wrong range paints a normal value red. So the
skill makes Claude show the owner every value before anything is saved, and it reuses existing
keys from the live data before coining new ones. Health data must never land in git, memory or
docs — the skill says so in its first rules.

## Current state

- Skills live in `.claude/skills/<name>/SKILL.md` and are auto-discovered; nothing to register (root `CLAUDE.md`). Exemplar with a similar "fetch, check with owner, push" shape: `.claude/skills/my-income/SKILL.md` — match its frontmatter style (`name`, `description` with trigger phrases).
- Description budget: `.claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh` warns over 500 chars, fails over 700. Keep this one under 500.
- Plan 269 provides (verify they exist before writing — STOP if not):
  - `apps/kushal-health/scripts/push-report.mjs --history` -> prints `BloodData` JSON (`reports[]` newest first; `markers[]` with `key,name,panel,unit,points[]`).
  - `apps/kushal-health/scripts/push-report.mjs <report.json> [<report.pdf>]` -> pushes; re-pushing the same `report.id` replaces it.
  - Config from `apps/kushal-health/.ingest.env` (`KUSHAL_HEALTH_URL`, `KUSHAL_HEALTH_INGEST_TOKEN`); exit 2 when missing.
  - Ingest body (`apps/kushal-health/src/shared/types.ts` `IngestBody`), validated server-side by `apps/kushal-health/src/worker/validate.ts`:
    ```ts
    { report: { id, collected_on, lab, source_file, verdict },
      results: [{ marker_key, name, panel, name_on_report, value_text, value_num, qualifier, unit, ref_text, ref_low, ref_high }] }
    ```
    `id` `/^[a-z0-9-]{3,80}$/`; `collected_on` `YYYY-MM-DD`; `marker_key` `/^[a-z0-9_]{1,40}$/`; `panel` one of `Diabetes, Lipid, Thyroid, Liver, Kidney, CBC, Vitamins, Hormones, Other`; `qualifier` one of `<`, `<=`, `>`, `>=` or null.
- Real PDFs are text PDFs from Indian labs. `pdftotext -layout` (`/opt/homebrew/bin/pdftotext`) gives rows like:
  ```
  Investigation              Observed Value   Unit     Biological Ref. Interval   Specimen
  THYROID STIMULATING HORMONE  2.10           µIU/mL   0.35 - 4.94                Serum
  ```
  Dates appear as `Collection : 30-Dec-2023 / 00:00 AM`. One visit can produce several PDFs on the same date — each PDF becomes its own report id.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Description budget | `bash .claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh` | exit 0, no FAIL for kushal-health |
| Skill structure | `bash .claude/skills/kushal-health/scripts/check-skill.sh` | `check-skill OK`, exit 0 |
| Plan 269 present | `test -f apps/kushal-health/scripts/push-report.mjs && echo ok` | `ok` |

## Scope

**In scope**: `.claude/skills/kushal-health/SKILL.md`, `.claude/skills/kushal-health/markers.md`, `.claude/skills/kushal-health/scripts/check-skill.sh`.

**Out of scope**: anything under `apps/` (plan 269 owns it); `CLAUDE.md` routing table and other registries (updated at landing); any real report file or value.

## Git workflow

- Branch: `advisor/270-kushal-health-ingest-skill`
- Commit: `feat(skills): kushal-health ingest skill` — no AI footers. Do NOT push.

## Steps

### Step 1: `SKILL.md`

Frontmatter:
```yaml
---
name: kushal-health
description: Add a blood test / lab report PDF to Kushal Health (kushal-health.agrolloo.com). Reads the PDF with pdftotext, maps each test to a marker, shows the owner every value to check, writes a short verdict from the history, then pushes the numbers and the PDF. Triggers on "add my blood report", "add this lab report", "kushal-health", "blood test report", "upload my health report", "redo that blood report".
---
```

Body sections, with these exact `##` headings in this order (`check-skill.sh` asserts them):

1. `## Rules` — numbered, verbatim intent:
   1. Health data never goes into git, memory, `decisions.md`, docs, artifacts or any chat outside this session. Work files go in `$CLAUDE_JOB_DIR/tmp` if set, else `mktemp -d`; delete them at the end.
   2. Nothing is pushed before the owner says ok to the check table.
   3. Copy values and ranges exactly as printed. Never guess a missing range — leave `ref_low`/`ref_high` null and `ref_text` empty.
   4. The verdict is not medical advice: no diagnosis, no medicine or dose suggestions. If anything is out of range, end with "Worth showing to your doctor."
2. `## Setup check` — `test -f apps/kushal-health/.ingest.env` (from repo root). If missing, tell the owner to create it from `apps/kushal-health/.ingest.env.example` with the `INGEST_TOKEN` secret value, and stop.
3. `## Read the PDF` — `pdftotext -layout "<pdf>" -`. Empty or near-empty text -> it is a scanned image; tell the owner this skill only reads text PDFs and stop. Pull: collection date (`Collection` line; fall back to `Report` date) as `YYYY-MM-DD`; lab name (footer / letterhead); lab id (`Lab. Id`). Every result row: name, observed value, unit, reference interval. Skip `Method:`, `Remarks`, `Comments` and note text.
4. `## Map to markers` — first run `node apps/kushal-health/scripts/push-report.mjs --history` and list existing `markers[].key`. For each test: (a) if an existing marker is the same test, reuse its key; (b) else use the key from `markers.md`; (c) else coin a key: lowercase, `a-z0-9_`, short, by the test's common short name (`ferritin`, `apo_b`). Panel from `markers.md` or the best fit from the fixed list. Value parsing table:

   | Printed value | value_text | value_num | qualifier |
   |---|---|---|---|
   | `5.6` | `5.6` | 5.6 | null |
   | `<1.3` | `<1.3` | 1.3 | `<` |
   | `>90` | `>90` | 90 | `>` |
   | `Non Reactive` | `Non Reactive` | null | null |

   Range parsing table:

   | Printed range | ref_text | ref_low | ref_high |
   |---|---|---|---|
   | `0.35 - 4.94` | `0.35 - 4.94` | 0.35 | 4.94 |
   | `<4.00` or `Upto 4` | as printed | null | 4.00 |
   | `>40` | `>40` | 40 | null |
   | `Non Reactive` | `Non Reactive` | null | null |
   | Age/sex tables (e.g. `Male: 13-17`) | the line for an adult male | 13 | 17 |
   | nothing printed | `` | null | null |

5. `## Owner check` — show one table: `Marker (key) | As printed | Value | Unit | Range | Status`, where Status uses the app's rule in words (out of range / near edge = within 10% of the range width from an edge / normal / no range). Above it: date, lab, report id, PDF file name. Ask: "Do these match the PDF? Say ok, or tell me what to fix." Do not continue until the owner says ok.
6. `## Write the verdict` — use `--history` to compare each marker with its previous reading. Rubric (all must hold):
   - ≤ 120 words, plain short sentences, no jargon without a 3-word explanation.
   - Line 1: one-sentence overall call, e.g. "Mostly normal. 2 values need a look."
   - Then one bullet per out-of-range or near-edge marker: name, value + unit, the range, and the change since last time if there is one ("up from 140 in Jun 2024").
   - One bullet for clear improvements, if any.
   - Ends with "Worth showing to your doctor." when anything is out of range.
   Show the verdict to the owner before pushing; edits they ask for go in.
7. `## Push` — build the JSON (`report.id` = `<collected_on>-<lab-slug>-<lab id lowercased>`, `[a-z0-9-]` only; `source_file` = the PDF's base name), write it to the work dir, run `node apps/kushal-health/scripts/push-report.mjs <json> "<pdf>"`. A 400 prints the failing field — fix and re-push (same id replaces). Several PDFs: one JSON + push per PDF.
8. `## Confirm` — run `--history` again and check the report id is in `reports` with `has_pdf: true`. Tell the owner: report added, N markers, link `https://kushal-health.agrolloo.com`. Delete the work dir.
9. `## Redo or fix a report` — re-run the same flow with the same `report.id`; the push replaces its results and keeps the PDF unless a new one is passed.

### Step 2: `markers.md`

A table `| key | panel | names seen on reports |` with exactly these rows:

| key | panel | names |
|---|---|---|
| hba1c | Diabetes | HbA1c, Glycated Haemoglobin, Glycosylated Hemoglobin |
| glucose_fasting | Diabetes | Fasting Blood Sugar, FBS, Glucose Fasting, Plasma Glucose (F) |
| glucose_pp | Diabetes | Post Prandial Blood Sugar, PPBS, Glucose PP |
| cholesterol_total | Lipid | Total Cholesterol, Cholesterol Total, S. Cholesterol |
| hdl | Lipid | HDL Cholesterol, HDL-C |
| ldl | Lipid | LDL Cholesterol, LDL-C, LDL Direct |
| vldl | Lipid | VLDL Cholesterol |
| triglycerides | Lipid | Triglycerides, TG |
| non_hdl | Lipid | Non-HDL Cholesterol |
| tsh | Thyroid | TSH, Thyroid Stimulating Hormone, TSH Ultrasensitive |
| t3_total | Thyroid | T3, Total T3, Triiodothyronine |
| t4_total | Thyroid | T4, Total T4, Thyroxine |
| ft3 | Thyroid | Free T3, FT3 |
| ft4 | Thyroid | Free T4, FT4 |
| anti_tpo | Thyroid | Anti TPO, Anti Thyroid Peroxidase Antibody |
| anti_tg | Thyroid | Anti Thyroglobulin, aTg, Anti-Tg Antibody |
| sgot | Liver | SGOT, AST, Aspartate Aminotransferase |
| sgpt | Liver | SGPT, ALT, Alanine Aminotransferase |
| alp | Liver | Alkaline Phosphatase, ALP |
| ggt | Liver | GGT, Gamma GT |
| bilirubin_total | Liver | Total Bilirubin, Bilirubin Total |
| albumin | Liver | Albumin, S. Albumin |
| creatinine | Kidney | Creatinine, S. Creatinine |
| urea | Kidney | Urea, Blood Urea |
| bun | Kidney | BUN, Blood Urea Nitrogen |
| uric_acid | Kidney | Uric Acid, S. Uric Acid |
| egfr | Kidney | eGFR |
| hemoglobin | CBC | Haemoglobin, Hemoglobin, Hb |
| wbc | CBC | Total Leucocyte Count, TLC, WBC Count |
| platelets | CBC | Platelet Count, Platelets |
| rbc | CBC | RBC Count, Total RBC |
| esr | CBC | ESR |
| vit_d | Vitamins | Vitamin D, 25-OH Vitamin D, 25 Hydroxy Vitamin D |
| vit_b12 | Vitamins | Vitamin B12, Cyanocobalamin |
| iron | Vitamins | Serum Iron, Iron |
| ferritin | Vitamins | Ferritin |
| testosterone | Hormones | Testosterone Total |
| crp | Other | CRP, C-Reactive Protein, hs-CRP |
| hbsag | Other | HBsAg |

**Verify**: `grep -c '^| [a-z0-9_]* |' .claude/skills/kushal-health/markers.md` -> `≥ 39`

### Step 3: `scripts/check-skill.sh`

Write exactly this:
```bash
#!/usr/bin/env bash
# Structural gate for the kushal-health skill.
set -uo pipefail
D="$(cd "$(dirname "$0")/.." && pwd)"
S="$D/SKILL.md"; M="$D/markers.md"; fail=0
for h in "## Rules" "## Setup check" "## Read the PDF" "## Map to markers" "## Owner check" "## Write the verdict" "## Push" "## Confirm" "## Redo or fix a report"; do
  grep -qxF "$h" "$S" || { echo "missing section: $h"; fail=1; }
done
for s in "pdftotext -layout" "push-report.mjs --history" "push-report.mjs <json>" "Worth showing to your doctor." "120 words" ".ingest.env"; do
  grep -qF -- "$s" "$S" || { echo "missing text: $s"; fail=1; }
done
grep -q '^name: kushal-health$' "$S" || { echo "bad frontmatter name"; fail=1; }
rows=$(grep -cE '^\| [a-z0-9_]+ \| (Diabetes|Lipid|Thyroid|Liver|Kidney|CBC|Vitamins|Hormones|Other) \|' "$M")
[ "$rows" -ge 39 ] || { echo "markers.md has $rows valid rows, need >= 39"; fail=1; }
dups=$(grep -oE '^\| [a-z0-9_]+ \|' "$M" | sort | uniq -d)
[ -z "$dups" ] || { echo "duplicate marker keys: $dups"; fail=1; }
[ "$fail" -eq 0 ] && echo "check-skill OK"
exit "$fail"
```
`chmod +x` it.

**Verify**: `bash .claude/skills/kushal-health/scripts/check-skill.sh` -> `check-skill OK`

### Step 4: Mutation dry run

Run the frontmatter mutation by hand and confirm it fires, then restore:
`cp .claude/skills/kushal-health/SKILL.md /tmp/ks.bak && sed -i.bak '/^## Owner check$/d' .claude/skills/kushal-health/SKILL.md && rm .claude/skills/kushal-health/SKILL.md.bak; bash .claude/skills/kushal-health/scripts/check-skill.sh; cp /tmp/ks.bak .claude/skills/kushal-health/SKILL.md`

**Verify**: output contains `missing section: ## Owner check`, and a re-run of `check-skill.sh` afterwards prints `check-skill OK`

## Test plan

`check-descriptions.sh` (budget) + `check-skill.sh` (sections, key commands, alias table shape and uniqueness) + the mutation. Prose quality is reviewed against the Step 1 rubric by the verifier.

## Done criteria

- [ ] `bash .claude/skills/personal-stuff-diagnostics-and-tooling/scripts/check-descriptions.sh` exits 0
- [ ] `bash .claude/skills/kushal-health/scripts/check-skill.sh` prints `check-skill OK`
- [ ] `awk '/^description:/{print length($0)-13}' .claude/skills/kushal-health/SKILL.md` prints a number ≤ 500
- [ ] Step 4 mutation printed `missing section: ## Owner check`
- [ ] No file under `.claude/skills/kushal-health/` contains a real report value or a real lab id (only the synthetic examples in this plan)

## STOP conditions

- `apps/kushal-health/scripts/push-report.mjs` does not exist, or does not support `--history` and `<json> [<pdf>]` — plan 269 has not landed; stop.
- `check-skill.sh` fails and the only fix is to loosen the check — stop. Fix SKILL.md or markers.md instead.
- You are about to read or include anything from the owner's real PDFs — stop; this plan never touches real data.

## Maintenance notes

- After landing, add a routing row to root `CLAUDE.md` "Find it fast": blood tests / health reports -> `kushal-health` skill + `apps/kushal-health/CLAUDE.md`.
- First real use (owner, after 269 is deployed): "add my blood report ~/Downloads/LABREPORT.pdf and ~/Downloads/LABREPORT-1.pdf".
- New marker names the owner's labs print should be added to `markers.md` over time; keys never change once used (they are the chart line identity in D1).
