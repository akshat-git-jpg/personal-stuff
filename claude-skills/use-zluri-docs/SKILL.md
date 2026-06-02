---
name: use-zluri-docs
description: >
  Load Zluri module documentation from a local clone of the zluri-docs repository before
  working on a task. Use when the user says "use zluri docs", "/use-zluri-docs", "load zluri
  documentation", or explicitly asks to load module documentation for context. Also offer to
  load docs when the user is planning or implementing a feature.
metadata:
  author: faizal-zluri
  version: 1.2.0
---

# Use Zluri Docs

Load module documentation from a local clone of the [zluri-docs](https://github.com/ZluriHQ/zluri-docs) repository and use it as the source of truth for the current task.

## When to Apply

- User explicitly invokes `/use-zluri-docs`
- User says "use zluri docs" or "load zluri documentation"
- User asks you to reference module documentation before working
- If user is planning a feature or implementation of a feature, ask him if he wants to refer documentation and if he says yes.

## Workflow

Follow these steps **in order**. Do not skip any step.

### Step 1: Ensure Local Clone Exists

The zluri-docs repo should live at `~/Documents/zluri/zluri-docs`.

Check if the local clone exists and update it:

```bash
if [ -d "$HOME/Documents/zluri/zluri-docs/.git" ]; then
  git -C "$HOME/Documents/zluri/zluri-docs" checkout main && git -C "$HOME/Documents/zluri/zluri-docs" pull
else
  git clone git@github.com:ZluriHQ/zluri-docs.git "$HOME/Documents/zluri/zluri-docs"
fi
```

- If the clone or pull succeeds, proceed.
- If it fails, tell the user:
  > "I couldn't clone/update the zluri-docs repository at `~/Documents/zluri/zluri-docs`. Please check your SSH keys or network access."
- Do **not** proceed until the local repo is available and up to date.

### Step 2: Identify the Module(s)

Extract the module name(s) from the user's prompt. Use these mappings for common aliases:

| User says | Module name |
|-----------|-------------|
| Access Certification, Access Reviews, Campaigns | `accessreviews` |
| Access Requests | `accessrequests` |
| Workflows, Playbooks | `workflows` |
| Applications | `applications` |
| SaaS Management | `saas-management` |
| Integrations | `integrations` |
| Licenses | `licenses` |
| Optimization | `optimization` |
| Directory, Users | `directory` |
| Security, Compliance | `security` |
| Tasks | `tasks` |

If the module is unclear from the prompt, **ask the user**:

> "Which module(s) does this relate to? For example: accessreviews, workflows, applications, etc."

**Even if you can determine the module(s), always confirm with the user before proceeding:**

> "Based on your request, I believe the relevant module(s) are: **[module-list]**. Can you confirm, or should I add/remove any?"

Do not proceed until the user confirms.

### Step 3: Discover Available Documentation

List the docs directory to see what files exist:

```bash
ls ~/Documents/zluri/zluri-docs/docs/
```

For each confirmed module, check if `docs/[module-name].md` exists in the listing.

Also check if `AGENTS.md` exists at the repo root:

```bash
ls ~/Documents/zluri/zluri-docs/AGENTS.md
```

**Present the file list to the user for approval:**

> "I found the following documentation files to load:
> - `docs/[module-name].md`
> - `AGENTS.md` (documentation structure guidelines)
>
> Should I proceed with reading these?"

If a module's documentation file does **not** exist, flag it and **ask the user before falling back**:

> "No documentation found for module **[module-name]** at `docs/[module-name].md`. Should I proceed with normal codebase exploration instead?"

Do not fall back to codebase exploration without the user's confirmation.

### Step 4: Load the Documentation

Once the user approves, read each file directly from the local clone:

- `~/Documents/zluri/zluri-docs/docs/[module-name].md`
- `~/Documents/zluri/zluri-docs/AGENTS.md`

Use the Read tool to load these files — no need for `gh api` or base64 decoding.

### Step 5: Load Per-Repo Documentation

Follow the instructions in `AGENTS.md` to drill down into per-repo documentation for every repository mentioned in the module doc.

The module doc (`docs/[module-name].md`) contains a **Relevant Repositories** table listing each repo and its repo-level docs path (e.g., `postgres/zluri-docs/docs/accessreviews.md`).

For **each** repository in that table:

1. **Try to find a local clone.** Check `~/Documents/zluri/[repo-name]` first. If not found, check other common locations.
2. **If the local clone is not found**, ask the user:

   > "I can't find a local clone of **[repo-name]**. How should I proceed?"

   Offer these choices:
   - **Provide the local path** — the user tells you where the repo is cloned.
   - **Use `gh` CLI to read from GitHub** — read files from `https://github.com/ZluriHQ/[repo-name]` using `gh api` or `gh browse`. The user should already have `gh` CLI configured. If they don't, provide setup instructions:
     > To set up `gh` CLI with a Personal Access Token:
     > 1. Create a PAT at https://github.com/settings/tokens with `repo` scope.
     > 2. Run: `gh auth login --with-token <<< "YOUR_TOKEN"`
     > 3. Verify: `gh auth status`

3. **If using `gh` CLI** (no local clone), **ask the user which branch to read from** before fetching any files:

   > "Which branch of **[repo-name]** should I read the docs from? (e.g., `main`, `master`, `develop`)"

   Do not assume a default branch when reading remotely.

4. **Read the per-repo doc.** From the local clone, use the Read tool on the path listed in the module doc table (e.g., `~/Documents/zluri/dashboard-api/postgres/zluri-docs/docs/accessreviews.md`). From GitHub, use:

   ```bash
   gh api repos/ZluriHQ/[repo-name]/contents/[doc-path]?ref=[branch] --jq '.content' | base64 -d
   ```

5. **If the per-repo doc references additional `.md` files** (e.g., a controller doc at `src/app/controllers/someController.md`), read those `.md` files first before reading the corresponding code files. Follow the AGENTS.md rule: always read the documentation file before its companion code file.

**Do not proceed with the task until you have read every per-repo doc listed in the module doc's Relevant Repositories table.**

### Step 6: Use Documentation as Source of Truth

With all documentation loaded (module doc + per-repo docs), apply it to the current task:

- **File responsibilities**: Use the descriptions in the docs to narrow which files to read and modify.
- **"When to modify" guidance**: Follow the docs' advice on when each file should be touched.
- **Architectural patterns**: Preserve the patterns described in the documentation.
- **Cross-reference with code**: The docs describe intent; the actual code is the implementation truth. Use both together.
- **Doc-guided indexing**: When module documentation exists, use the files listed in the docs as your index. Search for keywords by grepping within the files mentioned in the documentation — do **not** grep the entire repo to discover files. The documentation already tells you which files are relevant.

## Rules

- **Always read from the `main` branch of zluri-docs** — the Step 1 checkout ensures this.
- **Never skip the confirmation step** — always confirm the module list and file list with the user.
- **Flag missing docs** — if documentation doesn't exist for a module, tell the user explicitly.
- **Flag outdated docs** — if you notice the documentation contradicts the actual codebase, tell the user.
- **Documentation > guessing** — prefer documented patterns over assumptions.
- **Human in the loop** — for unclear patterns or complex refactors, ask the user before proceeding.
- **Read all per-repo docs before starting work** — do not proceed with the task until every per-repo doc from the module's Relevant Repositories table has been read.
- **Docs-first file discovery** — when module documentation is present, search for keywords within the files listed in the docs instead of grepping the entire repository. The documentation is your file index.

## Example

**User prompt**: "use zluri docs — I need to add a new filter to access reviews campaigns list API"

**Agent response**:

1. Runs `git pull` in `~/Documents/zluri/zluri-docs` to ensure latest docs.
2. "Based on your request, I believe the relevant module is: **accessreviews**. Can you confirm?"
3. *(User confirms)*
4. "I found these documentation files to load:
   - `docs/accessreviews.md`
   - `AGENTS.md`

   Should I proceed?"
5. *(User approves)*
6. Agent reads both files from the local clone.
7. The module doc lists these repos: `dashboard-api`, `bull-scheduler`, `backend-libs`, `backend-scripts`, `Integration-queue-consumer`. Agent checks for local clones at `~/Documents/zluri/[repo-name]` for each.
8. For repos with local clones found, agent reads the per-repo doc (e.g., `~/Documents/zluri/dashboard-api/postgres/zluri-docs/docs/accessreviews.md`).
9. For any repo without a local clone, agent asks: "I can't find a local clone of **backend-scripts**. Would you like to provide the local path, or should I use `gh` CLI to read from GitHub?" If the user chooses `gh` CLI, agent asks which branch to read from, then fetches the doc.
10. If any per-repo doc references additional `.md` files (e.g., `src/app/controllers/campaignController.md`), agent reads those before the corresponding code files.
11. Once all per-repo docs are loaded, agent uses the file lists from the documentation to search for the campaigns list API endpoint — grepping within the documented files rather than searching the entire repo.
12. Agent implements the filter following the documented patterns, modifying only the files identified through the documentation.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `git clone` fails with permission denied | Ensure SSH keys are configured for the ZluriHQ org: `ssh -T git@github.com` |
| `git pull` fails with merge conflict | The local clone has local changes. Run `git -C ~/Documents/zluri/zluri-docs reset --hard origin/main` to reset. |
| Module docs file not found | Not all modules are documented yet. Ask the user whether to fall back to codebase exploration. |
| Docs contradict actual code | Flag to the user — the code is the implementation truth; docs may be outdated. |
| Repo local clone not found | Ask the user: provide the path or allow `gh` CLI fallback. |
| `gh` CLI not authenticated | Guide the user: create a PAT at `https://github.com/settings/tokens` with `repo` scope, then `gh auth login --with-token <<< "TOKEN"`. |
| Per-repo doc path doesn't exist | The repo may not have docs yet. Flag to the user and ask whether to proceed with normal code exploration for that repo. |
