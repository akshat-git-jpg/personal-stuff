## Step 5: Managed Clone

The publish skill manages its own clone of the library repo at `$PUBLISH_REPO_DIR`.

### First-time setup

If `$PUBLISH_REPO_DIR` does not exist:

1. **Detect push access:**
   ```bash
   GH_USER=$(gh api user --jq '.login')
   HAS_PUSH=$(gh api repos/mvanhorn/printing-press-library --jq '.permissions.push' 2>/dev/null || echo "false")
   ```

2. **Detect git protocol:**
   ```bash
   USE_SSH=false
   if ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
     USE_SSH=true
   fi
   ```

3. **Clone based on access:**

   **Push access** (`HAS_PUSH` is `true`):
   ```bash
   # Clone directly — origin IS the upstream
   if [ "$USE_SSH" = "true" ]; then
     REPO_URL="git@github.com:mvanhorn/printing-press-library.git"
   else
     REPO_URL="https://github.com/mvanhorn/printing-press-library.git"
   fi
   git clone --depth 50 "$REPO_URL" "$PUBLISH_REPO_DIR"
   ```

   **No push access** (`HAS_PUSH` is `false`):
   ```bash
   # Fork first — fail explicitly if forking is blocked
   if ! gh repo fork mvanhorn/printing-press-library --clone=false 2>&1; then
     echo "ERROR: Could not fork mvanhorn/printing-press-library."
     echo "The repo may restrict forking, or you may already have a fork with a different name."
     echo "Fork manually at https://github.com/mvanhorn/printing-press-library/fork"
     exit 1
   fi
   FORK="$GH_USER/printing-press-library"

   # Build URLs based on protocol preference
   if [ "$USE_SSH" = "true" ]; then
     FORK_URL="git@github.com:$FORK.git"
     UPSTREAM_URL="git@github.com:mvanhorn/printing-press-library.git"
   else
     FORK_URL="https://github.com/$FORK.git"
     UPSTREAM_URL="https://github.com/mvanhorn/printing-press-library.git"
   fi

   git clone --depth 50 "$FORK_URL" "$PUBLISH_REPO_DIR"
   cd "$PUBLISH_REPO_DIR"
   git remote add upstream "$UPSTREAM_URL"
   git fetch upstream
   ```

4. **Cache the config:**
   ```json
   {
     "managed_by": "printing-press-publish",
     "repo_url": "https://github.com/mvanhorn/printing-press-library",
     "access": "push or fork",
     "gh_user": "<gh username>",
     "protocol": "ssh or https",
     "clone_path": "<expanded $PUBLISH_REPO_DIR>",
     "scope_dir": "<absolute source worktree path>",
     "module_path_base": "github.com/mvanhorn/printing-press-library/library"
   }
   ```
   Write to `$PUBLISH_CONFIG`. The `access` field determines the flow for all subsequent steps. The `gh_user` field is used for cross-repo PR heads. The `module_path_base` always references the upstream repo (PRs land there).

### Subsequent publishes

Read `$PUBLISH_CONFIG`, then re-check access in case it changed (user was granted push access, or access was revoked):

```bash
CURRENT_ACCESS=$(gh api repos/mvanhorn/printing-press-library --jq '.permissions.push' 2>/dev/null || echo "false")
CACHED_ACCESS=$(jq -r .access "$PUBLISH_CONFIG")

if [ "$CURRENT_ACCESS" = "true" ] && [ "$CACHED_ACCESS" = "fork" ]; then
  echo "Access upgraded to push. Reconfiguring clone..."
  rm -rf "$PUBLISH_REPO_DIR"
  # Re-run first-time setup with push access
fi
if [ "$CURRENT_ACCESS" = "false" ] && [ "$CACHED_ACCESS" = "push" ]; then
  echo "Push access revoked. Reconfiguring clone with fork..."
  rm -rf "$PUBLISH_REPO_DIR"
  # Re-run first-time setup with fork access
fi
```

If the clone was removed due to an access change, re-run first-time setup above. Otherwise, freshen the clone to match the canonical upstream:

```bash
cd "$PUBLISH_REPO_DIR"

if [ "$(jq -r .access $PUBLISH_CONFIG)" = "push" ]; then
  # Push access: origin IS the upstream
  git fetch origin
  git checkout main
  git reset --hard origin/main
else
  # Fork: origin is the fork, upstream is canonical
  git fetch upstream
  git checkout main
  git reset --hard upstream/main
  # Also sync origin (fork) so git push works cleanly
  git push origin main --force-with-lease 2>/dev/null || true
fi
```

Verify the clone is healthy:

```bash
git rev-parse --is-inside-work-tree
test "$(git rev-parse --abbrev-ref HEAD)" = "main"
```

If this fails, the clone is corrupt. Remove `$PUBLISH_REPO_DIR` and re-run first-time setup.

### Interrupted state recovery

Before creating a new branch, check for uncommitted changes:

```bash
cd "$PUBLISH_REPO_DIR"
git status --porcelain
```

If there are uncommitted changes, ask the user via AskUserQuestion:
- "Reset and start fresh"
- "Continue with existing changes"

If reset, run `git checkout -- . && git clean -fd`.

### Pre-package publication-state snapshot

Before Step 6 mutates the managed clone, record whether this API slug already
exists in the public library tree. Step 6 removes and replaces
`library/*/<api-slug>`, so any collision or publication-path decision made
after packaging must use this pre-package snapshot, not a fresh `ls`.

```bash
PREEXISTING_MERGED_PATHS=$(ls "$PUBLISH_REPO_DIR/library"/*/"<api-slug>" 2>/dev/null || true)
PREEXISTING_MERGED_COLLISION=false
if [ -n "$PREEXISTING_MERGED_PATHS" ]; then
  PREEXISTING_MERGED_COLLISION=true
fi
```

## Step 6: Package

Read `$PUBLISH_CONFIG` to get `module_path_base`. Construct the full module path using the API slug (not the CLI name):

```
MODULE_PATH="<module_path_base>/<category>/<api-slug>"
```

For example: `github.com/mvanhorn/printing-press-library/library/productivity/notion`

Run `publish package` with `--target` to stage the CLI into a unique temporary
directory, then copy it into the publish repo:

```bash
PUBLISH_STAGING_ROOT="/tmp/printing-press/publish"
mkdir -p "$PUBLISH_STAGING_ROOT"
STAGING_PARENT="$(mktemp -d "$PUBLISH_STAGING_ROOT/<api-slug>-XXXXXX")"
STAGING_DIR="$STAGING_PARENT/package"

cli-printing-press publish package \
  --dir <cli-dir> \
  --category <category> \
  --target "$STAGING_DIR" \
  --module-path "$MODULE_PATH" \
  --json
```

Parse the JSON result. Note the `staged_dir`, `module_path`, `manuscripts_included`, and `run_id`. The `module_path` field confirms the Go module path that was set in the packaged CLI's `go.mod` and import paths.

`publish package` performs the mandatory vendor-prefix secret scan over the staged CLI, including copied manuscripts, before returning success. If it reports `vendor-prefix tokens detected`, stop and remove or redact the reported file:line findings before retrying. This is a hard gate and does not depend on `gitleaks`, `trufflehog`, or destination-repo push protection.

Then copy the staged CLI into the publish repo, replacing any existing version:

```bash
# Remove existing version (handles category changes)
rm -rf "$PUBLISH_REPO_DIR/library"/*/"<api-slug>"

# Copy staged CLI into publish repo (slug-keyed directory)
cp -r "$STAGING_DIR/library/<category>/<api-slug>" "$PUBLISH_REPO_DIR/library/<category>/<api-slug>"

# Remove root-level binaries (should not be committed). publish package
# already strips these before the copy; this rm -f is belt-and-suspenders
# for the agent path. Cover all three names the Makefile/`go build ./cmd/...`
# can drop: bare slug, CLI binary, MCP peer.
rm -f "$PUBLISH_REPO_DIR/library/<category>/<api-slug>/<api-slug>" \
      "$PUBLISH_REPO_DIR/library/<category>/<api-slug>/<cli-name>" \
      "$PUBLISH_REPO_DIR/library/<category>/<api-slug>/<api-slug>-pp-mcp"

# Defense-in-depth: validate printer attribution before README and registry surfaces.
PRINTER=$(jq -r '.printer // ""' "$PUBLISH_REPO_DIR/library/<category>/<api-slug>/.printing-press.json")
PRINTER_NAME=$(jq -r '.printer_name // ""' "$PUBLISH_REPO_DIR/library/<category>/<api-slug>/.printing-press.json")
if [ -z "$PRINTER" ]; then
  echo "ERROR: manifest .printer is empty. Set 'git config --global github.user <your-handle>' and re-print before publishing."
  exit 1
fi
if [ "$PRINTER" = "USER" ] || [ "$PRINTER" = "user" ]; then
  echo "ERROR: manifest .printer is the literal sentinel \"$PRINTER\" (git config github.user was unset at print time). Set it and re-print before publishing."
  exit 1
fi
if [ -z "$PRINTER_NAME" ]; then
  echo "ERROR: manifest .printer_name is empty. Set 'git config --global user.name <your display name>' and re-print before publishing."
  exit 1
fi

# Do NOT regenerate or commit `cli-skills/pp-<api-slug>/SKILL.md` or
# `registry.json` here. Both are regenerated post-merge by the library's
# `generate-skills.yml` and `generate-registry.yml` workflows via
# `[skip ci]` bot commits. The library's `Fail on changes to generated
# artifacts` check in `verify-library-conventions.yml` hard-fails any PR
# whose diff against base touches these files, regardless of fork vs
# same-repo origin. The library no longer has an in-PR auto-fix path;
# do not re-introduce a mirror or registry regen here.

# Verify this changed/new CLI builds and has no reachable Go vulnerabilities from the publish repo
cd "$PUBLISH_REPO_DIR/library/<category>/<api-slug>" \
  && go build ./... \
  && go run golang.org/x/vuln/cmd/govulncheck@v1.3.0 ./...
```

Keep vulnerability verification scoped to `library/<category>/<api-slug>` in
publish PRs. The public library is a historical collection and cannot be kept
fully current on every unrelated PR; whole-library govulncheck sweeps belong in
a scheduled/reporting workflow, while blocking CI should scan only added or
changed CLI modules.

After the publish repo copy and build verification are complete, remove the staging
directory:

```bash
rm -rf "$STAGING_PARENT"
```

Note: `staged_dir` is keyed by the API slug (e.g., `espn`), matching the publish repo's directory layout. The copy step is a same-name copy, not a rename.

## Step 6.5: Record Customizations

Before collision detection or branch creation, inspect the packaged CLI's
customizations index:

```bash
PATCHES_INDEX="$PUBLISH_REPO_DIR/library/<category>/<api-slug>/.printing-press-patches.json"
if [ ! -f "$PATCHES_INDEX" ]; then
  echo "ERROR: packaged CLI is missing .printing-press-patches.json. Reprint with a current cli-printing-press binary before publishing."
  exit 1
fi
if ! jq -e '
  (.schema_version | type == "number") and
  (.applied_at | type == "string" and length > 0) and
  (.base_run_id | type == "string" and length > 0) and
  (.base_printing_press_version | type == "string" and length > 0) and
  (.patches | type == "array")
' "$PATCHES_INDEX" >/dev/null; then
  echo "ERROR: packaged CLI has malformed .printing-press-patches.json. Reprint with a current cli-printing-press binary before publishing."
  exit 1
fi
```

Fresh prints from current `cli-printing-press generate` include this file with
`"patches": []`; leave that unchanged when no hand customization was made after
generation. If the file is missing, the CLI was generated by an older binary;
reprint with a current `cli-printing-press` build rather than synthesizing the
deterministic provenance fields by hand.

## Step 6.6: Record contributor attribution

When the human running this publish is **not** the CLI's original creator,
record them as a contributor so they are credited in the README byline, NOTICE,
and the public registry. The command is idempotent — it skips the creator and
anyone already listed — so it is safe to run on every publish:

```bash
"$PRINTING_PRESS_BIN" contributors add \
  --dir "$PUBLISH_REPO_DIR/library/<category>/<api-slug>" \
  || echo "note: this binary predates 'contributors add'; skipping contributor recording"
```

The step is best-effort: `contributors add` is an additive command, so a binary
that predates it simply skips recording rather than blocking the publish (the
`min-binary-version` floor only tracks the major). Pass `--front` when this
publish is a reprint (a from-scratch regeneration) so the reprinter is listed
first among contributors. Never edit `contributors[]` or the `creator` block by
hand — the creator is permanent, and the command owns the list (matching the
manifest-as-authority rule).

If you changed generated CLI files during the print or publish session, append
one concise entry per customization to `patches[]` before opening the library
PR. This index is the durable hand-edit contract that tells future agents and
regen tooling what must be preserved beyond generator output.

Use this shape:

```json
{
  "id": "<api-slug>-<short-feature-name>",
  "summary": "What changed (one sentence).",
  "reason": "Why the generated output needed this customization.",
  "files": ["internal/cli/example.go"],
  "validated_outcome": "Optional: focused check that proved the customization.",
  "upstream_issue": "Optional: https://github.com/mvanhorn/cli-printing-press/issues/<n>"
}
```

Rules:

- Use kebab-case ids prefixed with the API slug for grep-ability across the
  public library.
- Keep `summary` and `reason` short. The manifest is an index, not a duplicate
  of the git diff.
- Include non-Go support files in `files` when they are part of the same
  code-level customization. README/SKILL.md-only polish does not need a patch
  manifest entry.
- Inline `// PATCH(...)` source comments are optional navigation aids. The public
  library verifier currently requires the patches file to exist and
  `patches` to be an array; it does not require a marker/comment pairing.
- If an entry exists only to work around an old verifier or pipeline bug that no
  longer applies, delete the stale workaround entry instead of carrying it
  forward.

For the authoritative public-library authoring contract, read the
`mvanhorn/printing-press-library` `AGENTS.md` section
"`.printing-press-patches.json` records library-side customizations".
