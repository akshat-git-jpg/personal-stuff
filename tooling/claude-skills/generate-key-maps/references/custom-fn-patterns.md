# Custom function patterns

Custom functions emit a CTE used by the query builder. Every function has
the same signature and return shape — only the body of the `with_clause`
varies. This file catalogues the common patterns so the LLM doesn't have
to invent them from scratch.

## Standard signature

```ts
import {
  KeyMapValueCustomFunctionParameters,
  KeyMapValueCustomFunctionReturns,
} from '../../../libs/query-builder/interface';

const <name> = ({
  org_id,
  local_conditions,
  main_table,
  filters,
  fy_month,
  filterExpressionBuilder,
  columns,
}: KeyMapValueCustomFunctionParameters): KeyMapValueCustomFunctionReturns => {
  const with_clause = `...`;
  const select_clause = '...';
  return { with_clause, select_clause };
};

export default <name>;
```

## Pattern A — filtered count over a child relation

Used when an aggregation requires filtering on enum values not visible
from the schema (e.g. `application_state IN (...)`).

**Anchor:** `user.properties/functions/managed_user_app_count.ts`.

Skeleton:

```ts
const with_clause = `
  SELECT ${main_table}.id AS id,
    COUNT(
      CASE
        WHEN <child_alias>.<enum_col> IN ('val1', 'val2') THEN 1
        ELSE NULL
      END
    ) AS <as>
  FROM zluri_schema.${main_table} ${main_table}
  LEFT JOIN zluri_schema.<link_table> <link_alias>
    ON ${main_table}.id = <link_alias>.<fk_to_main>
    AND <link_alias>.org_id = '${org_id}'
    AND <link_alias>.is_deleted = false
  LEFT JOIN zluri_schema.<child_table> <child_alias>
    ON <link_alias>.<fk_to_child> = <child_alias>.id
    AND <child_alias>.org_id = '${org_id}'
    AND <child_alias>.is_deleted = false
  WHERE ${main_table}.org_id = '${org_id}'
    AND ${main_table}.is_deleted = false
    ${local_conditions ? `AND ${local_conditions}` : ''}
  GROUP BY ${main_table}.id
`;
const select_clause = `COALESCE(<as>.<as>::<cast>, 0) AS <as>`;
```

## Pattern B — tree walk (path)

Used for `_path` fields (department path, business-unit path, cost-center
path).

**Anchor:** `user.properties/functions/user_business_unit_tree.ts` (and
sibling `user_department_tree.ts`).

Skeleton (recursive CTE):

```ts
const with_clause = `
  WITH RECURSIVE tree AS (
    SELECT id, parent_id, name, ARRAY[name]::varchar[] AS path
    FROM zluri_schema.<tree_table>
    WHERE parent_id IS NULL AND org_id = '${org_id}'
    UNION ALL
    SELECT t.id, t.parent_id, t.name, tree.path || t.name::varchar
    FROM zluri_schema.<tree_table> t
    JOIN tree ON t.parent_id = tree.id
    WHERE t.org_id = '${org_id}'
  )
  SELECT ${main_table}.id AS id,
    array_to_string(tree.path, ' > ') AS <as_name_path>,
    array_to_string(tree.path[1:array_length(tree.path,1)-1], ' > ') AS <as_root>
  FROM zluri_schema.${main_table} ${main_table}
  LEFT JOIN tree ON tree.id = ${main_table}.<fk_to_tree>
  WHERE ${main_table}.org_id = '${org_id}' AND ${main_table}.is_deleted = false
    ${local_conditions ? `AND ${local_conditions}` : ''}
`;
```

Set `materialized: true` on the corresponding `joins` entry — recursive
CTEs benefit from materialisation.

## Pattern C — self-join chain (denormalised lookup)

Used for `<entity>_reporting_manager_*` style fields. The function selects
multiple columns at once and the key_map references each via the `as`
field.

**Anchor:** `user.properties/functions/reporting_manager_details.ts`.

Each key_map entry sharing this `logical_group` shows up in the `columns`
array passed into the function — read it to know which columns to project.

## Pattern D — pass-through aggregation with explicit time window

Used for `<entity>_current_month_spend`, `<entity>_total_spend`, etc., when
the aggregation logic itself isn't expressible declaratively (e.g.
multi-column SUMs with conditional weighting).

**Anchor:** `user.properties/functions/user_spend_metrics.ts`.

## Pattern E — direct column projection through indirect relation

Used for `<entity>_owner_name`, `<entity>_dept_owner_name` — the chain has
more than one hop or requires resolving a denormalised cache table.

**Anchor:** `user.properties/functions/user_dept_owner_name.ts`.

---

## Briefs that reference an existing function

Developers often write briefs that point at an existing custom function in
another module rather than describing the SQL from scratch. Treat any of
these phrases as a directive to **read the named file and use it as the
template**:

- "similar to `<name>`"
- "like `<name>`"
- "see `<path>`"
- "analogous to `<name>`"
- "based on `<name>`"
- "copy `<name>` but for ..."

### Resolution

1. Look in `dashboard-api/postgres/src/app/properties/*.properties/functions/`
   for a file whose basename matches the referenced name (`<name>.ts`,
   with or without the extension).
2. If the brief includes a path (e.g. `user.properties/functions/user_business_unit_tree.ts`),
   resolve it relative to the properties directory.
3. If you can't locate the file, ask the developer for the path before
   guessing — never invent SQL based on a name alone.

### What to substitute

Read the anchor file's source. Identify these slots and substitute from the
relation graph + classification context for the new module:

| Slot | How to find it |
|---|---|
| `main_table` | Always the new module's main table (from `${main_table}` interpolation). |
| `tree_table` / `child_table` | The non-main table the anchor joins to; in the new module, this is read from the relation graph or the brief. |
| FK / parent column | If the anchor uses `parent_id`, check the new entity's actual column name (could be `direct_parent_id` etc.). |
| Self-join vs FK-join | If the new entity self-references for the tree, the join condition becomes `tree.id = ${main_table}.id` instead of `tree.id = ${main_table}.<fk>`. |
| Output `as` aliases | From the new module's key_map entries — usually distinct from the anchor's aliases. |

### Worked example

Brief:

```
BRIEF cost_center_tree:
  similar to functions/user_business_unit_tree.ts in user.properties/, but
  for org_cost_centers itself (self-tree, no separate FK). Use
  direct_parent_id as the parent column. Output aliases:
  cost_center_name_path, cost_center_root_name.
```

Steps:

1. Read `dashboard-api/postgres/src/app/properties/user.properties/functions/user_business_unit_tree.ts`.
2. Identify substitutions:
   - `org_users` (main_table in anchor) → `org_cost_centers` (main_table in new module)
   - `org_business_units` (tree_table) → `org_cost_centers` (same as main; self-tree)
   - `parent_id` → `direct_parent_id`
   - Anchor's `LEFT JOIN tree ON tree.id = org_users.org_business_unit_id` →
     new `LEFT JOIN tree ON tree.id = org_cost_centers.id` (self-join because
     the entity *is* the tree)
   - Output aliases: `user_business_unit_name_path` → `cost_center_name_path`,
     and any sibling alias like `user_root_business_unit_name` →
     `cost_center_root_name`
3. Emit `cost_center.properties/functions/cost_center_tree.ts` with the
   substitutions applied; CTE shape unchanged from the anchor.
4. Mention in the final summary that this function was generated by
   substitution from `user_business_unit_tree.ts` so the developer can
   spot-check.

### When the brief is ambiguous

If the brief names an anchor but the substitutions are unclear (e.g., the
new entity has multiple self-refs and the brief doesn't say which is the
parent), don't guess. Stop and ask one targeted question, then proceed.

---

When the developer's `BRIEF` doesn't match any pattern above and doesn't
reference an existing function, fall back to a structural translation:
read the brief, identify (a) the tables involved, (b) the join keys (from
the relation graph), (c) any filter predicates, (d) the aggregation if
any, (e) the final cast — and emit a CTE in the standard shape.
