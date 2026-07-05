## Step 7: Collision Detection & Resolution

After the managed clone is freshened, check for name collisions before creating a branch or PR. This replaces the previous "Check for Existing PR" step.

### Detection

Run these checks in sequence:

**1. Check merged CLIs in managed clone:**

```bash
MERGED_COLLISION="$PREEXISTING_MERGED_COLLISION"
MERGED_PATHS="$PREEXISTING_MERGED_PATHS"
```

Use the pre-package snapshot from Step 5. Do not re-run `ls
"$PUBLISH_REPO_DIR/library"/*/"<api-slug>"` here: Step 6 has already copied the
new package into that path, so a fresh `ls` would make every new print look like
a merged collision. If `MERGED_COLLISION=true`, note the category path from
`MERGED_PATHS`.

**2. Check all open PRs (any author):**

```bash
gh pr list --repo mvanhorn/printing-press-library --head "feat/<api-slug>" --state open --json number,title,url,author
```

If the list is non-empty, record `PR_COLLISION=true`. For each PR, note the PR number, URL, and author login.

**3. Identify own PRs:**

Filter the PR list from step 2 by `--author @me`:

For fork-based PRs, the head includes the username prefix:

```bash
ACCESS=$(jq -r .access "$PUBLISH_CONFIG")
GH_USER=$(jq -r .gh_user "$PUBLISH_CONFIG")

if [ "$ACCESS" = "fork" ]; then
  HEAD_REF="$GH_USER:feat/<api-slug>"
else
  HEAD_REF="feat/<api-slug>"
fi

gh pr list --repo mvanhorn/printing-press-library --head "$HEAD_REF" --state open --author @me --json number,title,url
```

If found, record `OWN_PR=true`, store `EXISTING_PR_NUMBER` and `EXISTING_PR_URL`.

**If no open PR was found**, also check for a previously merged PR on the same branch — by ANY author, not just yours:

```bash
MERGED_PR=$(gh pr list --repo mvanhorn/printing-press-library --head "$HEAD_REF" --state merged --json number --jq '.[0].number' 2>/dev/null)
```

If `MERGED_PR` is non-empty, the branch name was already used and merged. Set `BRANCH_MERGED=true` so Step 8 creates a new branch name (e.g., `feat/<api-slug>-YYYYMMDD`) instead of reusing the merged branch. Do NOT force-push onto a merged branch — `gh pr edit` would silently update a closed PR nobody is watching.

The author-agnostic lookup also catches **squash-zombie branches**: GitHub squash-merge leaves the source branch behind on the remote, with pre-squash commit refs that look "ahead of main" but are content-equivalent to the squash commit. Without this check, the skill misclassifies the zombie as fresh-publish, then `git push -u` fails because the remote branch already exists. Timestamping sidesteps the issue entirely.

### No collision

If no merged CLI exists and no open PRs match (other than your own), set `EXISTING_PR_NUMBER` from the own-PR check (or empty if none) and proceed to Step 8 normally.

If an existing open PR of yours was found, inform the user:
> "Found your open PR #N for `<api-slug>`. Will update it with the new version."

### Collision detected — display info

Show the user what was found:

```
⚠️  Name collision detected for <api-slug>

  Merged: <category>/<api-slug> exists in the library
  Open PR: #<number> by <author> — <url>
```

Show all applicable lines. If `OWN_PR=true`, tag the PR as "(yours)".

### Resolution paths

Present three options via AskUserQuestion:

**If `OWN_PR=true` (your own open PR exists):**
- **Update** — Update your existing PR with the new version (default, preserves current behavior)
- **Alongside** — Rename yours with a qualifier and publish next to the existing one
- **Bail** — Cancel the publish

**If PR collision exists but is another user's, or merged collision only:**
- **Replace** — Intentionally overwrite the existing CLI
- **Alongside** — Rename yours with a qualifier and publish next to the existing one
- **Bail** — Cancel the publish and view the existing CLI/PR

#### Update path (own PR)

This is the existing update flow. Set `EXISTING_PR_NUMBER` from the detection step and proceed to Step 8, which handles force-push and PR description update.

#### Replace path

**For merged CLIs or your own PR:** Standard confirmation:
> "This will replace the existing `<api-slug>`. Continue?"

**For another user's PR:** Stronger confirmation naming the other author:
> "⚠️  This will replace `<author>`'s `<api-slug>` (PR #N). Are you sure?"

If confirmed:
- The PR description must include: `⚠️ **Replaces existing \`<api-slug>\`** — <reason provided by user or "newer version">`
- Set `EXISTING_PR_NUMBER=""` (create a new PR, don't update theirs)
- Proceed to Step 8 normally

#### Alongside path (rename)

**1. Extract the original API slug** from the manifest's `api_name` field:

```bash
# Read from .printing-press.json in the publish repo's staged CLI
ORIGINAL_API_SLUG=$(cat "$PUBLISH_REPO_DIR/library/<category>/<api-slug>/.printing-press.json" | jq -r '.api_name')
```

**2. Generate rename suggestions** using slug format. Derive the new CLI name from the chosen slug:

- Numeric: `<api-slug>-2` (if that collides, try `-3`, `-4`, etc.)
- Non-numeric: `<api-slug>-alt`
- Custom: prompt the user for a qualifier word

After the user chooses a slug, compute:

```bash
NEW_API_SLUG="<chosen-slug>"
NEW_CLI_NAME="${NEW_API_SLUG}-pp-cli"
```

Present the format to the user:
> "Rename format: `<api-slug>-<qualifier>`. Pick a qualifier:"
>
> 1. `2` → `<api-slug>-2`
> 2. `alt` → `<api-slug>-alt`
> 3. Enter custom qualifier

**3. Verify each suggestion is non-colliding** before presenting:

```bash
# Check merged
ls "$PUBLISH_REPO_DIR/library"/*/"<suggestion>" 2>/dev/null
# Check open PRs
gh pr list --repo mvanhorn/printing-press-library --head "feat/<suggestion>" --state open --json number
```

If a suggestion collides, skip it or increment the numeric suffix.

**4. Rename the CLI in the publish repo:**

Since Step 6 copied the staged CLI into `$PUBLISH_REPO_DIR`, the rename operates on that directory. Note: `--old-name`/`--new-name` still use CLI-name format (e.g., `dub-pp-cli`) because `RenameCLI` does content replacement — bare slugs would cause collateral damage. The `--dir` path uses the slug-keyed directory.

```bash
cli-printing-press publish rename \
  --dir "$PUBLISH_REPO_DIR/library/<category>/<api-slug>" \
  --old-name <old-cli-name> \
  --new-name "$NEW_CLI_NAME" \
  --json
```

Parse the JSON result. Verify `"success": true`. Note that `new_dir` should now be `$PUBLISH_REPO_DIR/library/<category>/$NEW_API_SLUG`.

**5. Update all downstream references for Step 8:**

- Branch name: `feat/$NEW_API_SLUG` (not the old slug)
- PR title: `feat($NEW_API_SLUG): add $NEW_API_SLUG`
- Commit message: `feat($NEW_API_SLUG): add $NEW_API_SLUG`
- Registry.json entry: `name` → `$NEW_API_SLUG`
- Set `EXISTING_PR_NUMBER=""` (always a new PR for a renamed CLI)

Proceed to Step 8 with the new name.

#### Bail path

Show links to what exists:
- If merged: "Existing CLI at `library/<category>/<api-slug>/`"
- If open PR: "Open PR: <url>"

Exit the publish flow. If Step 6 already wrote files into `$PUBLISH_REPO_DIR`, clean up with `git checkout -- . && git clean -fd` in the managed clone.

## Step 8: Branch, Commit, and PR

### Create branch

**If `EXISTING_PR_NUMBER` is set** (updating an existing PR):

Always overwrite the branch — the intent is clearly to update:

```bash
git checkout -B feat/<api-slug>
```

**If `EXISTING_PR_NUMBER` is empty and `BRANCH_MERGED` is true** (previous PR was merged):

Auto-create a timestamped branch — do not reuse the merged branch name:

```bash
git checkout -b feat/<api-slug>-$(date +%Y%m%d)
```

**If `EXISTING_PR_NUMBER` is empty and `BRANCH_MERGED` is not set** (no open or merged PR):

Check for stale branches and competing PRs:

```bash
# Check local and remote branches
LOCAL_BRANCH=$(git branch --list "feat/<api-slug>" | head -1)
REMOTE_BRANCH=$(git ls-remote --heads origin "feat/<api-slug>" 2>/dev/null | head -1)

# If a remote branch exists, check who owns it
if [ -n "$REMOTE_BRANCH" ]; then
  # Check for ANY open PR on this branch (not just ours)
  OTHER_PR=$(gh pr list --repo mvanhorn/printing-press-library --head "feat/<api-slug>" --state open --json number,author --jq '.[0]' 2>/dev/null)
fi
```

**If another user's open PR exists on this branch** (`OTHER_PR` is non-empty and author is not `@me`):
> "Someone else has an open PR for `<api-slug>` (PR #N by @author). Creating a timestamped branch to avoid conflicts."

Auto-create a timestamped branch: `feat/<api-slug>-YYYYMMDD`. Do NOT offer to overwrite — that would stomp their work.

**If the branch exists but no competing PR** (stale branch from a previously closed/merged PR):

Ask via AskUserQuestion:
> "Found a stale branch `feat/<api-slug>` (likely from a previous publish). Overwrite it?"

- "Overwrite existing branch" — reuse the branch name
- "Create timestamped variant (feat/<api-slug>-YYYYMMDD)"

**If no branch exists:** Create normally.

```bash
# New branch:
git checkout -b feat/<api-slug>

# Overwrite existing:
git checkout -B feat/<api-slug>
```

### Commit and push

```bash
cd "$PUBLISH_REPO_DIR"
git add library/
git commit -m "feat(<api-slug>): add <api-slug>"
```

Push to origin (which is the fork for non-push users, or the upstream for push users):

**If updating an existing PR** (`EXISTING_PR_NUMBER` is set):

```bash
git push --force-with-lease -u origin feat/<api-slug>
```

**If creating a new PR** and you chose "Overwrite existing branch" earlier:

```bash
git push --force-with-lease -u origin feat/<api-slug>
```

**Otherwise** (new branch, no conflicts):

```bash
git push -u origin feat/<api-slug>
```

### Capture the pushed commit SHA

After pushing, capture the head commit SHA. This is used to build durable manuscript links in the PR body (see "Build the PR description" below).

```bash
HEAD_SHA=$(git rev-parse HEAD)
```

The SHA stays resolvable on `mvanhorn/printing-press-library` for the life of the PR (GitHub mirrors fork-PR head commits to `refs/pull/<N>/head` on the upstream), and remains valid after the PR is merged and the branch is deleted. Each invocation of this skill captures a fresh `HEAD_SHA` after its push and rewrites the body, so links stay current across updates the skill performs. If the branch is force-pushed outside this skill, re-run `/printing-press-publish` to refresh the body — the prior links will still resolve, but they'll point at the manuscript contents from before the out-of-band push.

### Create or update PR

Read `access` and `gh_user` from `$PUBLISH_CONFIG`. These determine how `gh pr create` is called.

**For fork-based PRs** (`access` is `fork`): use `--head <gh_user>:feat/<api-slug>` so GitHub creates a cross-repo PR from the fork to the upstream. Without `--head`, `gh pr create` would try to find the branch on the upstream repo (where the user can't push) and fail.

**For push-access PRs** (`access` is `push`): use `--head feat/<api-slug>` so GitHub creates the PR from the branch this flow just pushed, even when the managed clone or shell session has other branches checked out.

Build the PR description from:
- The manifest (`description`, `api_name`, `category`, `printing_press_version`, `spec_url`)
- The manifest's `novel_features` array from the packaged CLI after Step 6
- The `help_output` captured in Step 4
- The CLI's README (first 2-3 paragraphs, or note that README is missing)
- Links to every file under `.manuscripts/<run-id>/research/` and `.manuscripts/<run-id>/proofs/`. Each link must be a full `https://github.com/mvanhorn/printing-press-library/blob/<HEAD_SHA>/library/<category>/<api-slug>/.manuscripts/<run-id>/<subdir>/<filename>` URL — never a relative path (GitHub resolves those against `…/pull/`, producing broken `…/pull/library/…` URLs) and never a directory (the blob view requires a file). Enumerate the actual files; do not invent or skip them.
- The validation results from Step 4
- The publish live gate result from Step 4.5, including any explicit
  `--skip-live-test` reason
- A Gaps section listing any missing manifest fields

Read `novel_features` from
`$PUBLISH_REPO_DIR/library/<category>/<api-slug>/.printing-press.json` after
packaging. Preserve the manifest order. Do not derive
this section from README prose, SKILL prose, root help, or memory of the run:
those surfaces may be summarized or hand-edited, while the packaged manifest is
the publish-time source of truth. For each entry, include the command, name, and
description. If the array is empty, write `No novel commands recorded in
.printing-press.json.` and include the missing field in **Gaps**; do not omit the
section.

Also include a publication-path line so new prints, reprints, PR updates, and
collision renames are distinguishable:
- `New print` — no merged CLI and no existing PR matched this slug.
- `Update existing PR #<N>` — this publish refreshes an open PR.
- `Reprint/replace` — a merged library CLI existed before this publish and the
  selected path replaces it. This must be based on
  `PREEXISTING_MERGED_COLLISION=true`, not on the post-package tree.
- `Alongside print` — this publish renamed the API slug to avoid a collision;
  include the original slug.
If `/printing-press-reprint` handed off a degraded reprint with no prior
public-library source, use `New print` and add the degraded-reprint note only if
that context is available from the handoff.

**MANDATORY: Before constructing the PR body, scrub all workspace PII.** The library
repo is public. Scan any live test results, acceptance data, or manuscript excerpts
for organization names, team member names, and email addresses. Replace with generic
descriptions ("the workspace", "5 team members", "12 users"). Team keys (e.g., "ESP")
are OK but org names (e.g., "Acme Corp") are not. See `references/secret-protection.md`
in the printing-press skill for the full policy.

Write the constructed PR body to a temporary Markdown file and pass it with
`--body-file`. Do this for both PR creation and PR updates. Do not inline the
body in a shell argument; large fenced help output, Markdown tables, and
backticks are too easy to mangle.

**PR description template:**

```markdown
## After the PR opens

Once the PR is open, it enters the public library repo's review contract. That contract is owned by [`mvanhorn/printing-press-library` AGENTS.md → "Automated code review with Greptile"](https://github.com/mvanhorn/printing-press-library/blob/main/AGENTS.md#automated-code-review-with-greptile); read it for the canonical version. An agent invoking this skill from `cli-printing-press` will not have loaded the library's AGENTS.md, so the obligations are summarized here.

Greptile reviews **incrementally**: every commit you push re-triggers a fresh review, which can surface new findings the previous round didn't. This is a loop, not a single pass — drive the PR to a *stable* green and don't declare done after round one.

### Drive the PR to stable green

Iterate until **all** of these hold, confirmed by the review that your most recent fix commit triggered:

- **Greptile score ≥ 4.** The 0-5 score is a confidence signal, not a hard gate; 4/5 and 5/5 are both acceptable end states, and the score lands there naturally once threads are addressed.
- **No unresolved review threads.** For each P0/P1/P2 thread, either push a fix or reply with a concrete reason it shouldn't fire — not "won't fix", but *why* the code is right as written or *why* deferral is justified.
- **All CI checks pass.** `verify-library-conventions`, `Govulncheck`, and any other workflow on the PR.

Read findings from two surfaces — they don't overlap:

- `gh pr view <PR> --repo <owner>/<repo> --comments` returns the top-level issue conversation (Greptile's summary comment, score, CI bots).
- `gh api repos/<owner>/<repo>/pulls/<PR>/comments` returns the inline diff-anchored review comments — Greptile posts each P0/P1/P2 finding here, **and these are NOT included in `--comments`**. Skipping this call is how an agent silently declares "all findings resolved" while every inline thread is still open.

**Monitoring is the harness's job, not a busy-loop you hand-roll.** Use whatever PR-activity monitoring your environment provides — react to review/CI events as they arrive, or re-check on an interval if it doesn't push events. After each fix push, wait for the re-triggered review to land before judging done; a new round can reopen the gate.

**Don't hand-edit `registry.json` or `cli-skills/pp-<api-slug>/SKILL.md` to satisfy a finding** — both are bot-regenerated post-merge by `[skip ci]` commits, and the library's `Fail on changes to generated artifacts` check pre-rejects any PR that touches them.

### Terminal state — then hand back

Once the PR is stably green, the skill's job is done. **Do not merge it and do not poll waiting for it to merge** — merges into the public library are the maintainer's manual review, not this skill's and (for a fork contributor) not the user's either.

Read `access` from `$PUBLISH_CONFIG` (`jq -r .access "$PUBLISH_CONFIG"`) to determine what to do next:

- **If `access` is `push`** (maintainer/admin with push access): apply the `awaiting-maintainer` label to signal the PR is ready for manual review:
  ```bash
  gh pr edit <PR> --repo mvanhorn/printing-press-library --add-label awaiting-maintainer
  ```
- **If `access` is `fork`** (community contributor): you cannot merge or label the upstream PR. There is nothing more to do once it's green.

Then **report the terminal state and return control to the caller.** Do not offer a retro or any follow-up menu from this skill by default — that decision belongs to whoever invoked publish. The `printing-press` pipeline offers retro as its own post-publish tail; a direct human invocation without `--from-polish` just ends here.

If `POLISH_HANDOFF=true`, offer retro as a soft tail after the PR is green. This preserves the standalone polish -> publish workflow without allowing polish's same-turn `AskUserQuestion` answer to create or update a public-library PR.

Present via `AskUserQuestion`:

> "PR opened: <PR_URL>. Run a retro? It surfaces systemic gaps from this session (generator misses, scorer bugs, skill-doc drift) as a GitHub issue for the Printing Press maintainers. Every retro filed raises the floor for the next CLI, and your session context is freshest right now."
>
> 1. **No, I'm done** (default)
> 2. **Yes, run retro now**

If the user picks yes, invoke `/printing-press-retro`.
