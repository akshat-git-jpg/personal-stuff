# Scaffold conventions

Conventions to follow when emitting `index.ts`, `joins`, and
`functions/<name>.ts` for a property module. The deterministic helpers
already encode most of these — this doc is the reference for cases the
helpers don't cover and for review-time checks.

## Alias prefix

Every `as` alias starts with the entity short-name (`user_`, `group_`,
`cost_center_`, `application_`, `contract_`, etc.). The short-name is
derived from the main `tableName`:

| tableName | short-name | example alias |
|---|---|---|
| `org_users` | `user` | `user_name` |
| `org_groups` | `group` | `group_name` |
| `org_cost_centers` | `cost_center` | `cost_center_name` |
| `org_business_units` | `business_unit` | `business_unit_name` |
| `org_applications` | `application` | `application_name` |
| `org_contracts` | `contract` | `contract_name` |

## logical_group naming

| Bucket | logical_group |
|---|---|
| LOCAL | `'local'` |
| FOREIGN | `'<related>_details'` (or `'<fk>_details'` for self-joins) |
| AGGREGATED | `'<child>_x'` or `'<child>_details'` |
| CUSTOM | `<function_name>` (matches the file in `functions/`) |

## File layout

```
<entity>.properties/
├── index.ts                  ← key_map + joins + main_table + schema
├── functions/
│   ├── <name1>.ts
│   └── <name2>.ts
├── COLUMNS.md
└── .relation-graph.md
```

## index.ts conventions

- Top-of-file imports: `KeyMapValue`, `Joins` from `'../interfaces'`, then one import per custom function file.
- Main exports in this order: `key_map`, `joins`, `main_table`, `schema`.
- Indentation: tabs (matching the existing dashboard-api property files).
- Each `key_map` entry uses single-quote string literals.
- Custom-function references include a `// @ts-expect-error fix types` comment line above `function: <name>` (matches existing convention).

## Output directory derivation

Default convention: strip leading `org_`, then map plural → singular:

| tableName | output dir (relative to `postgres/src/app/properties/`) |
|---|---|
| `org_users` | `user.properties/` |
| `org_groups` | `group.properties/` |
| `org_cost_centers` | `cost-center.properties/` |
| `org_business_units` | `business-unit.properties/` |
| `org_applications` | `application.properties/` |

If the convention doesn't apply cleanly, print the derived path and let the
developer override with `OUTPUT_DIR` in the plan.
