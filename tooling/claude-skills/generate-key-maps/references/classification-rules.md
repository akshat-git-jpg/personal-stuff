# Classification rules

Each `field_id` from the frontend property file is assigned to one of four
buckets. Apply the rules in priority order — first match wins.

## 1. CANONICAL

Apply the rules in `canonical-fields.md`. Emitted unconditionally.

## 2. LOCAL

A field is LOCAL when its name maps to a column on the main entity.

**Resolution:**
1. Strip the entity prefix (`user_`, `group_`, `cost_center_`, etc.) from the field_id. Example: `user_name` → `name`.
2. Look for a column with that name on the main entity (`columns` from `parse-entity.ts`).
3. If not found, try common synonyms:
   - `joining_date` → `onboarding_time`
   - `created_at` → `user_created_time` (with fallback to `created_at`)
   - `last_active` ↛ LOCAL (this is usually AGGREGATED — see below)

**Cast inference** (from `columnType`):

| Mikro-orm `columnType` | Cast |
|---|---|
| `uuid` | `objectId` (the query builder transforms uuid → mongo objectId on output) |
| `uuid[]` | `uuid[]` and set `field_is_array: true` |
| `varchar`, `character varying`, `string` | `varchar` |
| `boolean` | `boolean` |
| `integer` | `integer` |
| `timestamptz`, `timestamp with time zone` | `TIMESTAMP WITH TIME ZONE` |
| `numeric(20,4)` | `numeric(20,4)` |
| custom enums (e.g. `user_status`, `account_type`) | `varchar` |

## 3. FOREIGN

A field is FOREIGN when it resolves to a column on an entity reachable by a
single `@ManyToOne` **or `@OneToOne`** from the main entity. Both decorator
types own a FK column (`fieldName`) and behave the same way for joining.

**Triggers (any one is enough):**
- The field name follows the `<related-entity-prefix>_<column>` pattern. Example: `user_business_unit_name` → `org_business_units.name` via `org_business_unit_id`.
- The frontend filter hint says `entity: 'org_xyz'` AND `filter_type: 'objectId'` for an `<entity-prefix>_id` field. Example: `user_owner_id` with `entity: 'org_users'`.
- The field name starts with the **stem of a relation's `fieldName`** on the main entity (where the stem is the `fieldName` minus a trailing `_id`). Example: a relation `@OneToOne(() => OrgUser, { fieldName: 'owner_id' })` has stem `owner`; field `owner_name`, `owner_account_type`, `owner_profile_img`, `owner_status` all match and resolve via that relation. This rule is **load-bearing** for FE files that don't carry an entity prefix on these columns (cost-center, group, business-unit modules).

**Resolution:**
1. Build the candidate-relation set: every `@ManyToOne` and `@OneToOne` on the main entity. Each candidate has `fieldName`, `targetClass`, and `targetTable` (from the relation graph).
2. For each candidate, derive its stem (`fieldName` minus trailing `_id` if present).
3. For the field being classified, check whether it equals `<stem>_id` (the FK itself — classify as LOCAL) or starts with `<stem>_` (a column on the related entity — classify as FOREIGN, suffix is the foreign column).
4. If multiple stems could match (e.g. `owner` and `owner_account_type`), prefer the longest matching stem.
5. Self-joins resolve back to the main entity; use a distinct logical_group keyed by the FK column (e.g. `owner_details` for `owner_id`).
6. If the FE filter hint names the target entity, use that as the source of truth even if naming heuristics disagree.

**Output shape:**
- `query_type: 'foreign'`
- `logical_group: '<stem>_details'` (e.g. `owner_details`, `reporting_manager_details`, `business_unit_details`)
- `foreign_field: '<column on related>'`
- A matching `joins` entry: `{ local_table, local_field: <fieldName>, foreign_table: <related table>, foreign_field: 'id' }`

**Examples (cost-center module — no entity prefix on FE field_ids):**

| field_id | matched relation | foreign_field | logical_group |
|---|---|---|---|
| `owner_id` | `@OneToOne(() => OrgUser, fieldName: 'owner_id')` | LOCAL (it's the FK column itself, cast `objectId`) | `local` |
| `owner_name` | same relation, stem `owner` | `name` (on `org_users`) | `owner_details` |
| `owner_account_type` | same | `account_type` | `owner_details` |
| `owner_profile_img` | same | `profile_img` | `owner_details` |
| `owner_status` | same | `status` | `owner_details` |

## 4. AGGREGATED

A field is AGGREGATED when it computes a count/sum/max/avg over a child
relation reachable by `@OneToMany` (or via a junction table) from the main
entity, and the aggregation is expressible as a single SQL expression
without enum-style filters that aren't visible in the schema.

**Triggers:**
- Name suffix: `_count`, `_sum`, `_total`, `_max`, `_last_active`, `_average`
- Frontend `filter_type: 'range'` AND a child relation holds the metric column

**Output shape:**
- `query_type: 'aggregated'`
- `logical_group: '<child>_x'` or `<child>_details`
- `group_operation: 'COUNT(<child_table>.<col>)'` or `SUM`/`MAX`/etc.
- `grouped_on: '<main_table>.id'`
- `time_period: 'current_month' | 'ytd' | 'current_fy' | 'prev_fy' | 'prev_month'` if the field name hints at a window
- A matching `joins` entry pointing at the child table

## 5. CUSTOM

Anything that doesn't fit the above. The skill emits a custom function file
in `functions/<name>.ts` and wires it via the `function:` reference.

**Triggers:**
- Name patterns: `_path`, `_tree`, `_grade`, `_role`, `_avg_spend`, `_metrics`, `*_owner_name` (when the chain has more than one hop), `*_child_count`
- Aggregation that requires filtering child rows on enum values not derivable from the schema (`application_state IN (...)`)
- Multi-table joins beyond a single FK hop
- Self-join chains that need denormalisation (`user_reporting_manager_*`)

**Output shape:**
- `query_type: 'custom'`
- `logical_group` = the custom function name
- `function: <function_name>` (imported from `./functions/<function_name>`)
- A matching `joins` entry where `foreign_table` = the function name (treated as a CTE)

## Confidence model

When you cannot pick a bucket cleanly, mark the field with `LOW CONFIDENCE`
in the plan and write the reasoning. Never silently classify low-confidence
fields. The developer corrects via `RECLASSIFY` in the approval gate.

## Anchor examples (from `user.properties`)

| field_id | bucket | source |
|---|---|---|
| `user_name` | LOCAL | `org_users.name` |
| `user_status` | LOCAL | `org_users.status` |
| `user_owner_id` | LOCAL | `org_users.owner_id` |
| `user_owner_name` | FOREIGN (self-join) | `org_users.name` via `owner_id` |
| `user_business_unit_name` | FOREIGN | `org_business_units.name` via `org_business_unit_id` |
| `user_email_alias_count` | AGGREGATED | `COUNT(org_user_alternate_emails.email)` grouped on `org_users.id` |
| `user_current_month_spend` | AGGREGATED | `SUM(org_user_spends.spend)`, `time_period: 'current_month'` |
| `user_business_unit_name_path` | CUSTOM | tree walk on `org_business_units` |
| `managed_user_app_count` | CUSTOM | filtered count over `org_user_applications`, enum on `application_state` |
| `user_role` | CUSTOM | denormalisation through a non-obvious chain |
| `user_reporting_manager_email` | CUSTOM | self-join chain through `reporting_manager_id` |
