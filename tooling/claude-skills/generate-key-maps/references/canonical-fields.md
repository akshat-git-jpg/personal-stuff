# Canonical fields

These field_ids appear in nearly every property module and have a fixed
shape. Always emit them in the key_map, even when the frontend property file
doesn't list them — they are required by the query builder.

| field_id | logical_group | query_type | local_field | cast | as | notes |
|---|---|---|---|---|---|---|
| `_id` | `local` | `local` | `id` | `objectId` | `_id` | Always present. |
| `id` | `local` | `local` | `id` | `objectId` | `id` | Always present. |
| `org_id` | `local` | `local` | `org_id` | `objectId` | `org_id` | Always present. |
| `is_deleted` | `local` | `local` | `is_deleted` | `boolean` | `is_deleted` | Always present. |
| `<entity>_id` | `local` | `local` | `id` | `objectId` | `<entity>_id` | Synonym for `id` exposed under the entity prefix (e.g. `user_id`). Add when the frontend property file references it. |
| `<entity>_org_id` | `local` | `local` | `org_id` | `objectId` | `<entity>_org_id` | Synonym for `org_id` (e.g. `user_org_id`). Add only if FE references it. |
| `<entity>_archive` | `local` | `local` | `is_archived` | `boolean` | `<entity>_archive` | Add when the entity has an `is_archived` column. |

`<entity>` is the short-name derived from the table name (e.g., `org_users` → `user`).

If the frontend property file references additional canonical-style fields (e.g.
`user_created_at`, `user_last_login`), classify them as LOCAL using the same
rules as any other column on the main entity — do NOT hard-code them here.
