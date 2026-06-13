# Plan format & approval gate

After classifying every field, write the plan to a **markdown file in `/tmp`**
and print a **short summary** in chat with the file path. Do not dump the
full plan into the chat — large entities (50+ fields) crowd the terminal.

The developer reviews and edits the plan file in their editor, then types
`APPROVE` (case-sensitive) in chat. On `APPROVE`, the skill **re-reads the
plan file from disk** to pick up any edits, then proceeds to generate.

## Plan file location

```
/tmp/generate-key-maps/<entity-tableName>-plan.md
```

Create the parent directory if it doesn't exist (`mkdir -p
/tmp/generate-key-maps`).

If a plan file with the same name already exists from a previous run,
overwrite it.

## Plan file contents

The file is a markdown document with a clear instruction banner up top,
the read-only context (inputs, graph, field plan), and the editable
sections (custom-function briefs, optional Edits). Format:

````markdown
# Property module plan: <main_table> → <output_dir>

> **You are looking at the plan file. Edit this file directly to refine
> the plan, then type `APPROVE` in chat.** No other file needs editing.
>
> Editable sections below:
> 1. **Custom-function scaffolds** — replace each `TODO` block with your brief.
> 2. **Edits (optional)** — only if you want to override classifications or
>    the output directory.
>
> Read-only sections (do not edit; they're for your reference):
> - Inputs resolved
> - Relation graph
> - Field plan
>
> Type `CANCEL` in chat to abort and delete the plan file.

## Inputs resolved (read-only)

- Entity:    `<entity-file-path>`
- Frontend:  `<frontend-file-path>`
- Output:    `<output_dir>`   (NEW — will create | EXISTING — confirm overwrite)
- Sibling refs read: `group.properties/index.ts`, `cost-center.properties/index.ts`

## Relation graph (read-only, lazy-walked)

The full output of `build-relation-graph.ts --format=tree`, rendered
**verbatim** — every entity, every edge. The whole graph stays in this
file precisely because it would crowd chat.

```
<paste the FULL --format=tree output here, all entities, no truncation>
```

## Field plan — <n> fields (read-only)

| field_id | bucket | source / logic | flags |
|---|---|---|---|
| `_id` | CANONICAL | `<table>.id → objectId` | |
| `user_name` | LOCAL | `<table>.name → varchar` | |
| `user_owner_name` | FOREIGN | self-join via `owner_id` → `org_users.name` | |
| `user_email_alias_count` | AGGREGATED | `COUNT(org_user_alternate_emails.email)` | |
| `user_business_unit_name_path` | CUSTOM | tree walk on `org_business_units` | NEEDS BRIEF |
| `user_role` | CUSTOM | (fell through — review) | NEEDS BRIEF, LOW CONFIDENCE |
| ... | | | |

(One row per field. Never collapse rows. Never merge a row onto the header
line. If the table is long, that's fine.)

## Custom-function scaffolds — <m> needing briefs

For each heading below, the skill needs a natural-language description of
what the SQL should compute. **Replace the `<!-- TODO ... -->` block with
your brief.** Plain text or markdown; multi-line is fine. Everything you
write between a heading and the next `###` becomes the brief.

If you leave a TODO block in place, that function ships as a `// TODO`
stub (compiles cleanly but returns NULL).

### functions/managed_user_app_count.ts  [NEEDS BRIEF]

<!-- TODO: Replace this entire comment with your natural-language brief.
     Pattern references (in references/custom-fn-patterns.md):
       Pattern A — filtered count over a child relation (enum filter)
       Pattern B — tree walk / path
       Pattern C — self-join chain (denormalised lookup)
       Pattern D — pass-through aggregation with explicit time window
       Pattern E — direct projection through indirect relation
     Example brief:
       count of org_user_applications joined to org_applications where
       org_applications.application_state IN ('centrally managed','team managed')
       and org_user_applications.status = 'active'
-->

### functions/user_business_unit_tree.ts  [NEEDS BRIEF]

<!-- TODO: Replace with your brief — see Pattern B in custom-fn-patterns.md
     for tree walks. -->

### functions/user_role.ts  [NEEDS BRIEF]

<!-- TODO: Replace with your brief. -->

...

## Edits (optional)

Leave this section empty if you don't need to override anything — just type
`APPROVE` in chat.

<!-- TODO: To override classification or change the output path, write
     directives below this comment, one per line, then DELETE this TODO.

     Directive forms:
       RECLASSIFY <field_id>: <new_bucket> via <details>
       OUTPUT_DIR <new_path>

     Concrete examples (uncomment by removing the leading `# ` if you want
     to use them, then edit values):

     # RECLASSIFY user_role: foreign via v2_role_id → user_role.role_name
     # OUTPUT_DIR postgres/src/app/properties/user.properties.test/

     If you don't need any overrides, delete this entire TODO and leave the
     section blank. -->
````

## Chat output (kept tight)

After writing the file, the **only** thing printed in chat is a short
summary:

```
Plan written to: /tmp/generate-key-maps/<entity-tableName>-plan.md  (<n> fields)

Summary:
  Buckets: <c> canonical, <l> local, <f> foreign, <a> aggregated, <u> custom
  Custom-function scaffolds NEEDS BRIEF: <m>
  Low-confidence classifications: <k>  (<comma-separated field_ids>)
  Output directory: <output_dir>  (NEW | EXISTING)

Open the file, add briefs / reclassifications, then reply:
  APPROVE   — re-read the file and generate
  CANCEL    — exit and delete the plan file
```

Nothing else in chat at this stage. No relation graph dump, no per-field
breakdown, no scaffold list.

## On developer reply

### `APPROVE`
1. Re-read the plan file from disk.
2. Parse:
   - For each `### functions/<name>.ts` heading, collect every line until
     the next `###` as the brief. **A line that's purely a markdown
     comment `<!-- ... -->` (especially one starting with `<!-- TODO`) is
     treated as a leftover placeholder — strip it before deciding whether
     a brief was provided.** If the captured text after stripping comments
     is empty or whitespace-only, the function stays a TODO scaffold. The
     `[NEEDS BRIEF]` flag in the heading is informational — the skill
     determines presence/absence from the body content, not the flag.
   - For the `## Edits` section, parse one directive per line. Skip lines
     that are comments (`<!-- ... -->`) or that begin with `#` or `//`
     (commented-out examples the developer left in place):
     - `RECLASSIFY <field_id>: <bucket> via <details>` — update the
       in-memory plan's classification for that field.
     - `OUTPUT_DIR <path>` — replace the output directory.
3. Apply the edits to the in-memory plan and proceed to generate.
4. After generation, the plan file is left in place for reference. The
   developer can delete `/tmp/generate-key-maps/` whenever they want.

### `CANCEL`
1. Delete the plan file.
2. Exit cleanly. No files written.

### Anything else (chat-only edit blocks — fallback)

If the developer responds with `BRIEF <name>:` / `RECLASSIFY <field_id>:` /
`OUTPUT_DIR <path>` blocks in chat instead of editing the file:

1. Apply them to the in-memory plan.
2. Rewrite the plan file with the edits applied (so the developer sees
   them next time they look at the file).
3. Print a one-line acknowledgement in chat: `Plan updated. Re-review
   /tmp/generate-key-maps/<entity>-plan.md and reply APPROVE / CANCEL.`
4. Wait again.

This keeps the editor flow primary while still accepting chat-block edits
as a convenience.

## Block parsing rules (chat-only fallback)

- A `BRIEF` block runs from the line introducing it until the next
  `BRIEF`/`RECLASSIFY`/`OUTPUT_DIR`/`APPROVE`/`CANCEL` keyword or the end of
  the message.
- `RECLASSIFY` and `OUTPUT_DIR` are single-line.
- Keywords are case-sensitive.

## Flags column vocabulary

| Flag | Meaning |
|---|---|
| `NEEDS BRIEF` | Custom field. Will scaffold with TODOs unless a brief is provided. |
| `LOW CONFIDENCE` | Classification is a best guess. Developer should review. |
| `OVERWRITE` | An existing file at the output path will be replaced. |
| `MERGE` | An existing `COLUMNS.md` row will be preserved if its column hasn't changed. |
