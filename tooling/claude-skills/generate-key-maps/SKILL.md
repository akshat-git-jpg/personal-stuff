---
name: generate-key-maps
description: Build the query-builder property file (key_map + joins + custom functions) for a Postgres table in the dashboard-api repo. Use when creating a new <entity>.properties/index.ts with key_map and joins from a mikro-orm entity and a frontend property file. Triggers on "generate key maps", "generate key map and joins", "create property file for <table>", "build query-builder properties", or any task involving generating postgres/src/app/properties/<entity>.properties/ in dashboard-api.
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# Generate Key Maps

Build a complete query-builder property module (`<entity>.properties/index.ts` plus joins, custom function files, `COLUMNS.md`, and `.relation-graph.md`) for a Postgres table in the dashboard-api repo.

## When to Apply

- Working inside the `dashboard-api` repo (or its worktree).
- The developer says some variant of "generate key maps", "create property file for <table>", "build query-builder properties for <entity>".
- A frontend property file already exists (e.g. `postgres/src/app/properties/users.properties3.js` or `v2Table/users-main.properties.js`).
- A mikro-orm entity exists for the base table at `postgres/src/app/dal/schemas/mikro-orm/`.

## Steps

### 0. Locate the skill scripts (one shell variable, used by every helper call below)

Before running any helper, set `SKILL_DIR` so the rest of the steps can reference scripts deterministically. **Do not hand-type absolute paths to the scripts** — the directory differs per Claude account (`.claude-work` vs `.claude-personal`) and typos like `.claire-work` will silently break things.

```bash
SKILL_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills/generate-key-maps"
test -f "$SKILL_DIR/SKILL.md" || { echo "Skill not found at $SKILL_DIR"; exit 1; }
```

Every helper invocation in the steps below uses `"$SKILL_DIR/scripts/<helper>.ts"`. Run the `SKILL_DIR=...` line in the same shell session as the helper calls (or include it in each Bash call).

### 1. Ask for two paths (in this order)

> "What is the path to the frontend property file (the one used by the FE — e.g., `postgres/src/app/properties/users.properties3.js`)?"

> "What is the path to the mikro-orm entity file for the base table (e.g., `postgres/src/app/dal/schemas/mikro-orm/users/OrgUser.entity.ts`)?"

Validate each:

- **Frontend file**: must be a `.js` or `.ts` file that, when parsed, yields a non-empty `field_id` list. Run `npx tsx "$SKILL_DIR/scripts/parse-frontend-props.ts" <path>` and check `.fields | length > 0`.
- **Entity file**: must contain an `@Entity` decorator. Run `npx tsx "$SKILL_DIR/scripts/parse-entity.ts" <path>` and check `.tableName` is non-empty.

If either fails, re-ask that single question with a one-line explanation of what was wrong.

### 2. Parse and build the relation graph

Run the three helpers directly from the command line, using `$SKILL_DIR` from Step 0:

```bash
npx tsx "$SKILL_DIR/scripts/parse-entity.ts" <entity-path> > /tmp/entity.json
npx tsx "$SKILL_DIR/scripts/parse-frontend-props.ts" <frontend-path> > /tmp/fe.json
npx tsx "$SKILL_DIR/scripts/build-relation-graph.ts" <entity-path> postgres/src/app/dal/schemas/mikro-orm > /tmp/graph.json
```

The graph walker has two output formats:
- Default (no flag) — JSON, suitable for programmatic consumption.
- `--format=tree` — ASCII tree (root first, then each entity with its outgoing edges, self-references labelled). Use this format when embedding the graph into the plan file at Step 4.

The relation graph is **not** printed in chat — it goes into the plan file at Step 4 instead, to keep terminal output minimal.

### 3. Classify every field_id

Read `references/canonical-fields.md` for the always-emitted set, then `references/classification-rules.md` for the five-bucket decision flow.

For each `field_id` in the FE model:
- Apply the rules in priority order (CANONICAL → LOCAL → FOREIGN → AGGREGATED → CUSTOM).
- Record reasoning so it can appear in the plan's `source / logic` column.
- Mark `LOW CONFIDENCE` when the classification isn't clean.

For 1-2 anchor reference modules (default `group.properties`, `cost-center.properties`), read their `index.ts` to anchor formatting and naming choices.

### 4. Write the plan file and wait (do NOT dump the plan into chat)

Per `references/plan-format.md`:

1. Create `/tmp/generate-key-maps/` if it doesn't exist (`mkdir -p`).
2. Write the full plan as markdown to `/tmp/generate-key-maps/<tableName>-plan.md`. The file contains: an instruction banner at the top, inputs resolved, the relation graph (ASCII tree), the full field plan table, one heading per custom-function scaffold, and an optional `## Edits` section.
3. **Print only a short summary in chat** (file path + bucket counts + NEEDS BRIEF count + low-confidence list + output-dir status + the four-line "what to do next" block). Nothing more. The full plan stays in the file.

**Rendering rules — these are the difference between a clean plan and a confusing one:**

- **Relation graph**: paste the **complete output** of `npx tsx "$SKILL_DIR/scripts/build-relation-graph.ts" <entity-path> <search-dir> --format=tree` verbatim — every entity and every edge. **Never** abbreviate, summarize, or write `(other relations omitted)`. The whole graph is *why* we put it in a file rather than chat.
- **Field plan table**: emit one row per field, on its own line, with exactly four pipe-separated cells: `| field_id | bucket | source / logic | flags |`. Never collapse rows, never glue a row onto the header line, never wrap a single field across multiple table rows.
- **Custom-function scaffolds**: under each `### functions/<name>.ts  [NEEDS BRIEF]` heading, write a `<!-- TODO ... -->` block per the template in `references/plan-format.md`. The TODO body should reference the relevant pattern from `references/custom-fn-patterns.md` and include a concrete example brief.
- **Edits section**: include the full TODO block with commented-out example directives (per `plan-format.md`). Don't print bare `<placeholder>` syntax — that confuses the developer.
- **Use real entity/table names verbatim**. If the entity is `OrgCostCenter` mapped to `org_cost_centers`, write that. Don't paraphrase to `or_centers` or any other shortened form.

The developer reviews and edits the plan file in their editor — they replace each TODO block with a brief, optionally add `RECLASSIFY` / `OUTPUT_DIR` directives in the `## Edits` section, then reply in chat.

On `APPROVE`: re-read the plan file from disk, parse briefs and edits (treat any line that's purely a markdown comment `<!-- ... -->` or that starts with `#`/`//` as a leftover placeholder, not content), apply edits to the in-memory plan, proceed to generate.

On `CANCEL`: delete the plan file, exit cleanly.

If the developer sends chat-only edit blocks instead of editing the file, apply them to the in-memory plan, rewrite the plan file (so the developer sees the result next time they open it), and print a one-line ack — wait again.

If the output directory already contains a non-empty `index.ts`, mark it `EXISTING — confirm overwrite` in both the file and the chat summary; require explicit approval.

### 5. Generate files

After `APPROVE`:

1. Build the `ApprovedPlan` JSON object from your classification.
2. Pipe it to `npx tsx "$SKILL_DIR/scripts/scaffold-property-file.ts" < /tmp/plan.json > <output>/index.ts`.
3. For each entry in `customFunctions`, pipe its CustomFnPlan to `scaffold-custom-fn.ts` and write to `<output>/functions/<name>.ts`.
4. Generate `<output>/COLUMNS.md` per `references/columns-md-template.md` (parse the existing file if present and merge per the idempotency rules).
5. Generate `<output>/.relation-graph.md` from the relation graph: a markdown ASCII tree plus an edges table.
6. For any custom function with a `BRIEF`, do a follow-up translation pass: read the `BRIEF: ...` block in the scaffolded file, consult `references/custom-fn-patterns.md`, replace the `// TODO` body with the real CTE, and remove the `BRIEF` block.

### 6. Validate

```bash
npx tsx "$SKILL_DIR/scripts/validate.ts" < /tmp/validate-input.json
```

The structural check runs first. If it returns errors, print them and ask the developer how to proceed (auto-fix where deterministic; otherwise abort and list the errors).

Run `tsc --noEmit` against the dashboard-api project (it has its own tsconfig). If it returns errors, print them and offer to revisit the affected entries — but do not auto-modify dashboard-api's project config.

### 7. Print final summary

This is the one place a longer chat output is OK — the developer wants to see exactly what was written.

List in chat: every file written (full path), any `NEEDS BRIEF` items still open, any custom functions where the `BRIEF` translation may need review, and the validation outcome (tsc result, structural checks).

## Rules

- **Always ask for both paths first.** Never auto-discover the frontend file or entity by guessing.
- **Never overwrite a non-empty `index.ts` without explicit confirmation.**
- **Never silently classify a low-confidence field.** Surface it in the plan and wait for `RECLASSIFY` if the developer wants to change it.
- **Never invent business logic for CUSTOM fields without a brief.** Emit the TODO scaffold (which compiles) and wait for the developer.
- **Never modify dashboard-api source outside `<output>` directory.** The skill is a generator — it does not refactor surrounding code.
- **Always follow the conventions in `references/scaffold-conventions.md`** — alias prefixes, casts, `// @ts-expect-error fix types` lines.

## Examples

**Example 1: minimal happy path**

User: *"generate key maps"*

Agent (Step 1):
> "What is the path to the frontend property file...?"

User: `postgres/src/app/properties/users.properties3.js`

Agent:
> "What is the path to the mikro-orm entity file...?"

User: `postgres/src/app/dal/schemas/mikro-orm/users/OrgUser.entity.ts`

Agent (Step 2-4): parses both, builds the relation graph, classifies, **writes the plan to `/tmp/generate-key-maps/org_users-plan.md`**, prints a short summary in chat:

```
Plan written to: /tmp/generate-key-maps/org_users-plan.md  (47 fields)

Summary:
  Buckets: 7 canonical, 22 local, 8 foreign, 6 aggregated, 4 custom
  Custom-function scaffolds NEEDS BRIEF: 4
  Low-confidence classifications: 1  (user_role)
  Output directory: postgres/src/app/properties/user.properties/  (NEW)

Open the file, add briefs / reclassifications, then reply:
  APPROVE   — re-read the file and generate
  CANCEL    — exit and delete the plan file
```

Developer opens the file, finds the `### functions/managed_user_app_count.ts  [NEEDS BRIEF]` heading and writes the brief on the lines below it:

```markdown
### functions/managed_user_app_count.ts  [NEEDS BRIEF]

count of org_user_applications joined to org_applications where
org_applications.application_state IN ('centrally managed','team managed','individually managed')
and org_user_applications.status='active'

### functions/user_role.ts  [NEEDS BRIEF]
```

They also drop into the `## Edits` section at the bottom:

```
RECLASSIFY user_role: foreign via v2_role_id → user_role.role_name
```

Saves the file and types `APPROVE` in chat. Agent (Step 5-7) re-reads the file, applies the brief and the reclassification, writes files, runs validator, prints summary including the 3 functions still `NEEDS BRIEF`.

## Troubleshooting

| Issue | Fix |
|---|---|
| `parse-entity.ts` throws "No @Entity class found" | Path doesn't point at a mikro-orm entity. Re-ask. |
| `parse-frontend-props.ts` returns 0 fields | The file is a thin wrapper but the require points to a non-property file. Check the require path; the parser auto-follows `v2Table/*` and `*-main.properties` requires only. |
| Relation graph missing an entity | Custom brief references a table not in the graph. Run `expandGraph` with the class name. The skill should ask "Where is `<ClassName>.entity.ts`?" if grep fails to locate it. |
| `tsc --noEmit` fails on a `cast` | Inferred cast is wrong. Check the entity file's `columnType`. |
| Validator: `duplicate \`as\` alias` | Two field_ids resolved to the same `as` value. Likely a CANONICAL/`<entity>_id` collision. Adjust per `canonical-fields.md`. |
| Validator: `key_map entry references logical_group X but no matching joins entry` | A `foreign`/`aggregated`/`custom` entry in key_map without its join. Add the join entry. |

## Internal references

- `references/canonical-fields.md` — always-emitted fields
- `references/classification-rules.md` — five-bucket flow
- `references/plan-format.md` — plan grammar + edit syntax
- `references/scaffold-conventions.md` — naming, casts, alias rules
- `references/custom-fn-patterns.md` — CTE patterns for custom functions
- `references/columns-md-template.md` — CSM-facing doc generation rules
