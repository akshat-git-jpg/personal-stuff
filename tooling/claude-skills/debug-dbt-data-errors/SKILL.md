---
name: debug-dbt-data-errors
description: Debug be-dbt (Zluri dbt) run failures caused by bad source data — "value too long for type character varying", invalid enum/uuid/timestamp cast, or an incremental model erroring repeatedly on the same batch. Finds the exact Mongo document that broke the run and hands over a cleanup query. Triggers on "dbt failed", "debug this dbt error", "which document broke dbt", "value too long", "dbt data error", or a pasted dbt log containing "Database Error in model".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# Debug dbt Data Errors (be-dbt)

## Overview

be-dbt incremental models read CDC mirror tables in prod Postgres. Each mirror table
(e.g. `zluri.orgusers`) holds **one row per Mongo `_id`** with the full document in a
`_doc` jsonb column, plus `modified_date` and `operation` (I/U/D). Models process
batches windowed on `modified_date` (see `macros/incremental_logic_where.sql`); the
window per model is tracked in `zluri_schema.process_tracker` (keyed by the fully
qualified model name).

When one document violates a target column constraint, the whole batch INSERT fails,
`delete+insert` rolls back, and **every retry replays the same window** — the run is
stuck until that document is fixed. Your job: pinpoint the document, show it, and give
the user a Mongo cleanup query.

**Repo:** `/Users/kbtg/codebase/be-dbt` (clone of ZluriHQ/be-dbt)
**Tools:** `mcp__postgres-app-prod__execute_sql` (read-only Postgres). The prod Mongo
MCP is read-only — **never execute the fix; hand the query to the user.**

## When to use

- dbt log shows `Database Error in model <x>` with a data-shaped error (see cookbook).
- The same model fails on every retry/iteration at the same batch.

NOT for: compilation/jinja errors, missing relations, permission/connection errors,
or dbt test failures — those are code/infra, not data.

## Step 1 — Extract facts from the dbt log

| Fact | Where in log |
|---|---|
| Model + file | `Database Error in model org_users (models/process_orgusers/org_users.sql)` |
| Error text | e.g. `value too long for type character varying(256)` |
| Batch window | `Batch Start time: <ts>   Batch end time: <ts>` — this is the `modified_date` window, **truncated to whole seconds** (`::timestamp(0)`). All timestamps are UTC even when the start is printed without a tz suffix |

No batch line in the log? Get the window start from the tracker:
```sql
SELECT last_processed_timestamp FROM zluri_schema.process_tracker
WHERE table_name LIKE '%<model_name>%';
```

## Step 2 — Map model → source table and fields

Read `models/<dir>/<model>.sql`:
- `source('<schema>', '<table>')` → the mirror table (e.g. `zluri.orgusers`).
- The `jsonb_to_record(_doc::jsonb) AS r(...)` block maps `_doc` keys → columns.
  Note which **`_doc` key** feeds each suspect target column (names can differ, e.g.
  `skyflow_id` → `orgusers_skyflow_id`).

## Step 3 — Find which target columns can raise this error

```sql
-- varchar(N) overflow: list candidate columns (swap 256 for the N in the error)
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'zluri_schema' AND table_name = '<target_table>'
  AND character_maximum_length = 256;
```
For enum errors: the failing type and value are named in the error itself
(`invalid input value for enum <type>: "<value>"`); list valid values with
`SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = enumtypid WHERE typname = '<type>'`.

## Step 4 — Hunt the offending row in the mirror

One query: window filter + a `GREATEST(...)` / predicate over every candidate field.
Pattern for varchar overflow (adapt field list from Steps 2–3):

```sql
SELECT _id, modified_date, length(_doc::jsonb->>'name') AS name_len /* , ... one per candidate */
FROM <schema>.<table>
WHERE modified_date >= '<batch_start_truncated_to_seconds>'::timestamp
  AND modified_date <= '<batch_end_truncated_to_seconds>'::timestamp
  AND GREATEST(length(_doc::jsonb->>'name') /* , ... */) > 256;
```

Predicates for other error types:
| Error | Predicate per candidate field |
|---|---|
| varchar(N) overflow | `length(_doc::jsonb->>'f') > N` |
| invalid enum value | `_doc::jsonb->>'f' NOT IN (<pg_enum labels>) AND _doc::jsonb->>'f' IS NOT NULL` |
| invalid uuid | `(_doc::jsonb->'f'->>'$oid') !~ '^[0-9a-f]{24}$'` (models build uuids as `'00000000' + $oid`) |
| bad timestamp/numeric | `(_doc::jsonb->'f'->>'$date') !~ '^-?[0-9]+$'` |

Then fetch the full document for the hit(s):
```sql
SELECT _id, modified_date, operation, jsonb_pretty(_doc::jsonb) AS doc
FROM <schema>.<table> WHERE _id = '<hit>';
```

## Step 5 — Report the finding

Give: `_id`, `orgId`, identifying fields (email/name), the offending field + its
length/value, and **where it came from** — check `audit_keys.actor_name`,
`source_types`, `source_details[].keyword`. Integration-synced docs (e.g. `sdk_okta`)
can be re-broken by the next sync; say so.

## Step 6 — Mongo cleanup query (hand over, don't run)

The mirror is one row per `_id`, so fixing the doc in Mongo re-emits it through CDC
with a fresh `modified_date`, the bad value leaves the stuck window, and dbt unblocks
on its own — no Postgres patching. Sanity-check the assumption first:
`SELECT COUNT(*) FROM <schema>.<table> WHERE _id = '<hit>';` → must be 1.

**Format all Mongo queries as `db.getCollection("<collection>")...`** (user preference —
works in Studio 3T / Compass / mongosh regardless of collection name).

Template (varchar overflow — aggregation-pipeline update so it can transform in place):
```js
db.getCollection("<collection>").updateOne(
  { _id: ObjectId("<hit>") },
  [
    {
      $set: {
        <field>: { $trim: { input: { $substrCP: ["$<field>", 0, <N>] } } },
        modified_at: "$$NOW"   // force CDC to emit the update
      }
    }
  ]
)
```
Template (invalid enum value — replace with the nearest valid label from Step 3, or
`$unset` the field if the model tolerates NULL — check the model SQL first):
```js
db.getCollection("<collection>").updateOne(
  { _id: ObjectId("<hit>") },
  { $set: { <field>: "<valid_enum_label>" }, $currentDate: { modified_at: true } }
)
```
Same idea for uuid/date corruption: `$set` a valid value or `$unset`. Always bump
`modified_at` so CDC emits the update.

Include a verify snippet, e.g.
`db.getCollection("<collection>").findOne({_id: ObjectId("<hit>")}, {<field>: 1})`.

## Recurrence warning (always include)

If the doc was written by an integration sync, the source can rewrite the bad value.
The durable fix is model-side — truncate in the model (`LEFT(r."field", N)`) or widen
the target column — and belongs in a be-dbt PR, not this skill's scope.

## Common mistakes

- **Forgetting the window truncation** — the macro casts to `::timestamp(0)`; use
  second-precision bounds or you may miss/include edge rows.
- **Scanning without the window** — mirror tables are huge; always filter
  `modified_date` first.
- **Running the Mongo update yourself** — prod Mongo access here is read-only by
  design. Deliver the query.
- **Patching the Postgres mirror row** — pointless; it's one-row-per-`_id` and the
  Mongo fix overwrites it via CDC.
- **Declaring victory on the first hit** — report ALL rows matching the predicate in
  the window; there can be more than one.

## Worked example (2026-07-07, org_users)

Error: `value too long for type character varying(256)` in `org_users`, batch
13:20:04→13:21:02. Model reads `zluri.orgusers`; target had 14 varchar(256) columns.
Window scan with `GREATEST(length(...))` found one row: `_id 6a4cfb7faec081c67c1e066a`,
`name` = 511 chars (255 F's + space + 255 L's — a boundary-test user via `sdk_okta`).
Fix: `updateOne` with `$substrCP`+`$trim` on `name`, `modified_at: "$$NOW"`.
