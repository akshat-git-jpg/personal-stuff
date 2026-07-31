---
name: create-module-documentation
description: >
  Create module-level documentation for the Zluri codebase following the zluri-docs
  system — module HLD, database collections/tables, ER diagrams, and per-repo file
  context docs. Triggers on "document a module", "create module docs", "set up
  documentation for a new module", "generate HLD", "onboard a new module", or any
  mention of zluri-docs or Zluri module documentation conventions.
user-invocable: true
metadata:
  author: zluri
  version: 1.0.0
---

# Create Module Documentation

Generate the full documentation suite for a Zluri module: module HLD, ER diagrams,
and per-repo file context docs — all following the zluri-docs conventions.

## What This Skill Produces

1. **Module HLD** at `zluri-docs/docs/<MODULE_NAME>.md` — business overview, database collections/tables, repository registry
2. **ER Diagrams** at `zluri-docs/diagrams/<MODULE_NAME>.md` — Mermaid relationship diagrams for all collections/tables
3. **Per-Repo Docs** at `<REPO>/zluri-docs/docs/<MODULE_NAME>.md` — file-level context docs using the correct template (API or script)

## Hard Rules

- **NEVER generate the business overview** — the user must paste it from their PM. This is the most important rule. The overview bridges code terminology with PRD language and only a human who understands the business domain can write it correctly.
- **NEVER discover files on your own** — Zluri's codebase is not well-structured, and AI file discovery pulls in irrelevant files. The user must list every file and folder explicitly.
- **ALWAYS ask for confirmation** after each generation step before moving to the next.
- **ALWAYS use subagents** for per-repo documentation (one subagent per repo, run in parallel).
- **ALWAYS read the reference templates and examples** before generating any output. The example files show the gold-standard format.

## Before You Start

Read these reference files to understand the expected output format:
- `references/template-module-hld.md` — structural template for the module HLD
- `references/example-module-doc.md` — a completed example (Access Reviews module)
- `references/example-er-diagram.md` — the exact Mermaid format to follow

---

## Phase 1: Gather Inputs Interactively

Collect all inputs through conversation. Ask one question at a time and wait for the user's response before proceeding.

### Q1: Module Name
Ask: **"What is the module name?"** (kebab-case, e.g., `access-reviews`, `license-management`)

Store as `MODULE_NAME`. This determines all output file paths.

### Q2: Business Overview
Ask: **"Paste the business overview for this module. This should come from your PM — I won't generate this. Include: what the module does, key terminology and concepts, and how terms map to the PRD."**

Store as `OVERVIEW_TEXT`. Paste this verbatim into the output — do not edit, summarize, or rephrase it.

### Q3: MongoDB Collections
Ask: **"List all MongoDB collections used by this module. You can enter them comma-separated or one per line. Leave empty if none."**

Example response: `accesscertifications2, accesscertificationentitysets, accesscertificationentities`

Parse the response into an array. Trim whitespace, filter empty strings.

### Q4: Postgres Tables
Ask: **"List all Postgres tables used by this module. Same format — comma-separated or one per line. Leave empty if none."**

Parse the same way as collections.

### Q5–Q7: Repositories (loop for each repo)

For each repository, ask three questions in sequence:

**Q5:** **"Name the next repository to document (e.g., `dashboard-api`, `bull-scheduler`). Type 'done' when you've listed all repos."**

If user says "done", exit the loop and move to confirmation.

**Q6:** **"Is `<REPO_NAME>` an API-based service or a script-based/other service?"**
- **API-based** → will use `references/template-repo-api.md` (Controllers, Services, DAL, Routes, Models sections)
- **Script-based** → will use `references/template-repo-script.md` (Core Files section)

**Q7:** **"List all files and folders in `<REPO_NAME>` that belong to this module. One path per line. Be explicit — I must not discover files on my own."**

Example:
```
src/app/controllers/AccessCertification/
src/app/services/AccessCertService/
src/app/dal/executors/access-certification-admin.executor.ts
src/router/access-cert-router.ts
```

**Q7b (confirmation):** After the user lists files, ask: **"Are these all the files for `<REPO_NAME>`, or did I miss any? Feel free to add more."**

Let the user confirm or add more files. Only proceed to the next repo (back to Q5) after they confirm.

### Confirmation Summary

After all repos are listed, present a summary:

```
Module: <MODULE_NAME>
Overview: <first 150 chars>...
MongoDB Collections: <count> — <list>
Postgres Tables: <count> — <list>
Repositories:
  - <REPO_1> (api) — <file_count> files
  - <REPO_2> (script) — <file_count> files
```

Ask: **"Does this look correct? Should I proceed with documentation generation, or do you want to edit anything?"**

Only proceed after user confirms.

---

## Phase 2: Generate Documentation (Step-by-Step with Approval)

Each step requires user approval before moving to the next. Present the output and ask
**"Does this look good? Should I proceed to the next step?"**

### Step A: Create Module HLD

Read `references/template-module-hld.md` for the structure and `references/example-module-doc.md` for the gold-standard example.

Create file at: `zluri-docs/docs/<MODULE_NAME>.md`

**Structure:**
1. Title: `# <ModuleName> — Module HLD`
2. `## Overview` — paste the user-provided `OVERVIEW_TEXT` verbatim
3. `### MongoDB Collections` — for each collection:
   - Try to read its schema using MongoDB MCP (`collection-schema` tool) OR look for schema/model files in the repos listed by the user
   - Write: `- \`collectionname\` — one-line responsibility description (defined in <repo>)`
4. `### Postgres Tables` — for each table:
   - Write a one-line description
   - Note any 1:1 mappings to MongoDB collections if applicable
5. `## Relevant Repositories` — table with columns: Repository, Responsibility, Repo-level docs
   - Repo-level docs path follows the pattern: `<repo-subpath>/zluri-docs/docs/<MODULE_NAME>.md`

**→ Present the generated HLD to the user. Ask for approval before continuing.**

### Step B: Create ER Diagrams

Read `references/example-er-diagram.md` for the exact Mermaid format.

Create file at: `zluri-docs/diagrams/<MODULE_NAME>.md`

**Rules:**
- Use Mermaid `graph TD` (NOT `erDiagram`) — this preserves exact collection names with full field lists
- Label edges with FK field names and cardinality (e.g., `-->|"1:N certification_id"|`)
- Group related collections in `subgraph` blocks with descriptive names
- Use dotted arrows (`-.->`) for lineage/clone relationships
- Use MongoDB MCP `collection-schema` OR schema/model files to discover FK fields and key columns
- Include a `## Relationship Summary` table below the diagram listing every FK relationship
- Add notes for special patterns (TTL collections, polymorphic references, etc.)

**→ Present the generated ER diagram to the user. Ask for approval before continuing.**

### Step C: Create Per-Repo Docs (via Subagents)

For EACH repo, spawn a **separate subagent** using the Agent tool. All subagents can run in parallel since they are independent.

**Subagent prompt for API-type repos:**
```
You are documenting the <MODULE_NAME> module in the <REPO_NAME> repository.

Read references/template-repo-api.md for the template structure.
Read references/example-module-doc.md to understand the documentation style.

Your task:
1. Read every file and folder listed below
2. Create documentation at: <REPO_NAME>/<repo-subpath>/zluri-docs/docs/<MODULE_NAME>.md
3. Use this structure:
   - Title: # <MODULE_NAME> — <REPO_NAME> Files Context
   - Description line: "This document maps key files in the <MODULE_NAME> module..."
   - Sections: Controllers, Service Classes, Helper Services, DAL, Route Schemas,
     Entity Classes, Models, Key Design Patterns
   - For each file document: Path, Responsibility, What Goes Here,
     What Does NOT Go Here, When to modify

Files to read:
<list of files for this repo>

IMPORTANT: Only document files the user listed. Do NOT discover additional files.
```

**Subagent prompt for Script-type repos:**
```
You are documenting the <MODULE_NAME> module in the <REPO_NAME> repository.

Read references/template-repo-script.md for the template structure.

Your task:
1. Read every file and folder listed below
2. Create documentation at: <REPO_NAME>/zluri-docs/docs/<MODULE_NAME>.md
3. Use this structure:
   - Title: # <MODULE_NAME> — <REPO_NAME> Files Context
   - Description line: "This document maps key files in the <MODULE_NAME> module..."
   - Section: Core Files
   - For each file: filename, Path, Responsibility, Key Operations,
     What Goes Here, What Does NOT Go Here, When to modify

Files to read:
<list of files for this repo>

IMPORTANT: Only document files the user listed. Do NOT discover additional files.
```

**→ After all subagents complete, present each repo doc to the user. Ask for approval.**

### Step D: Final Verification

- Confirm all expected files were created:
  - `zluri-docs/docs/<MODULE_NAME>.md`
  - `zluri-docs/diagrams/<MODULE_NAME>.md`
  - `<REPO>/zluri-docs/docs/<MODULE_NAME>.md` for each repo
- Verify the Relevant Repositories table in the HLD has correct links to each repo doc
- Verify the ER diagram contains all collections and tables from the inputs

**→ Present the final checklist to the user for sign-off.**

---

## Schema Discovery Strategy

When writing collection/table descriptions and ER diagrams, use this priority order:

1. **MongoDB MCP** — if available, use `collection-schema` to read the actual schema. This gives you field names, types, and indexes which reveal FK relationships.
2. **Schema/model files in repos** — look for model definitions in the files the user listed (e.g., Mongoose schemas in `backend-libs` or `dashboard-api`, TypeORM entities in `dashboard-api`). These are authoritative for understanding field relationships.
3. **Ask the user** — if neither MCP nor schema files are available, ask the user to describe the key fields and relationships between collections.

Never guess FK relationships. If you can't determine them from schema data, mark them with a comment and ask the user.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| MongoDB MCP not available | Use schema/model files from repos, or ask user to describe schemas |
| Repo not cloned locally | Ask user to clone the repo first, or skip and add a placeholder in the HLD |
| Subagent can't read files | Verify the file paths the user provided are correct and accessible |
| User has no PM overview | The overview is required. Ask user to write even a brief 2-3 sentence summary — but they must write it, not you |
| Too many collections for one diagram | Split into multiple subgraph sections, or create separate diagrams per domain area |
