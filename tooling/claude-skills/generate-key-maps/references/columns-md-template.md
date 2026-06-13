# `COLUMNS.md` generation guide

`COLUMNS.md` is the CSM-facing column reference for a property module.
It lives at `<entity>.properties/COLUMNS.md` and is committed alongside
the code.

## Tone

Plain English, accessible to a non-engineer who knows the product.

**Do:**
- "Number of applications assigned to the user."
- "Whether the user is active, inactive, or suspended."
- "Full hierarchy of business units this user belongs to."

**Don't:**
- "COUNT aggregate over org_user_applications joined to org_applications."
- "LEFT JOIN org_business_units with recursive CTE for path."
- Mention CTEs, joins, GROUP BY, or aggregation by name.

## Length

- Quick-reference description: 1 sentence.
- Detailed notes (only for AGGREGATED and CUSTOM where the logic isn't
  obvious from the field name): 2–4 sentences.

## Sources to draw from

- `field_id` — what the column is called in the API/UI.
- `field_name` from the FE property file — display name.
- `field_type: 'multi_select'` with `options` → spell out the values.
- The bucket + how it was resolved (LOCAL → "the X column on this
  table"; FOREIGN → "the name of the X this Y is linked to"; etc.).
- For CUSTOM with a brief: translate the brief to plain English. For
  CUSTOM without a brief: write `<!-- TODO: describe semantics -->`.

## Idempotency rules

If `COLUMNS.md` already exists at the output path:

1. Parse the existing file: extract the quick-reference table by
   `Column ID` and the detailed-notes section by heading.
2. Re-generate **only**:
   - Rows whose `column_id` is new (not in the existing file).
   - Rows whose underlying bucket, source-of-truth, or brief has
     changed since the last run.
3. Preserve human-edited descriptions verbatim for unchanged columns.
4. Print a summary at the end of the run: `<n> new`, `<m> updated`,
   `<k> preserved`.

## Format

Use the `assets/templates/columns.md.tmpl` skeleton:

```
# <Entity title> properties — column reference

> What each column ... please request a regeneration if you rename or
> change a column's semantics.

## Quick reference

| Column ID | Display name | Description |
|---|---|---|
<one row per field>

## Detailed notes (non-trivial columns)

### <column_id>
<2-4 sentences>

### <column_id>
<2-4 sentences>
```

Fields without detailed notes simply omit the `### <column_id>` section.
