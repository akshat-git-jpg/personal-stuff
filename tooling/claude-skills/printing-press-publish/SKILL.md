---
name: printing-press-publish
description: Publish a generated CLI to the printing-press-library repo
version: 0.1.0
min-binary-version: "4.0.0"
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
---

# /printing-press publish

> NOTE: this split diverges from upstream mvanhorn/printing-press — redo it if an upstream update overwrites this skill (see decisions.md 2026-07-04 for the precedent).

## Phase Playbooks (lazy-loaded — MANDATORY reads)

The full playbook for every phase lives in `references/`. **When a phase begins, Read its file COMPLETELY before taking any action in that phase.** Never run a phase from this table alone — the files carry the stop gates, enforcement rules, marker files, and exact commands. Skip conditions live inside each file.

| Phase | File |
|-------|------|
| Steps 1-4 | `references/steps-1-4-validate.md` |
| Steps 5-6 | `references/steps-5-6-package.md` |
| Steps 7-8 | `references/steps-7-8-pr.md` |
| PII Protection | `references/pii-protection.md` |


Publish a generated CLI from your local library to the [printing-press-library](https://github.com/mvanhorn/printing-press-library) repo as a pull request.

```bash
/printing-press publish notion-pp-cli
/printing-press publish notion
/printing-press publish notion --from-polish
/printing-press publish notion --skip-live-test=auth-unavailable
/printing-press publish
```

## Direct User Invocation Required

Publishing can fork `mvanhorn/printing-press-library`, push a branch, and open or
update a PR. Before setup or validation, check the invocation context. If this
skill was invoked as a chained continuation from `printing-press-polish`'s
Publish Offer, including an `AskUserQuestion` answer or auto-resolved polish
recommendation, stop immediately and tell the user to send
`/printing-press-publish <cli-name> --from-polish` in a fresh message. A fresh
user-authored request that explicitly asks to publish is sufficient; do not add
another confirmation prompt on top of a direct publish request.

If the fresh user-authored request includes `--from-polish`, record
`POLISH_HANDOFF=true` for the terminal-state step and ignore that marker when
resolving the CLI name. The marker is not a second confirmation and is not
passed to `cli-printing-press`; it only preserves standalone polish's old
post-publish retro offer after the fresh-turn publish completes.

If the fresh user-authored request includes `--skip-live-test=<reason>`, record
the exact non-empty reason as `SKIP_LIVE_TEST_REASON` and remove the flag before
resolving the CLI name. This is the only supported escape valve for the
publish-time live test gate. Use it only for auth-unavailable, known upstream
outage, LAN-unreachable hardware APIs, or similarly concrete operator-approved
cases; never infer a skip from ordinary latency or from the presence of an
older Phase 5 marker.

The public library treats `library/<category>/<api-slug>/.printing-press.json`
and `manifest.json` as the source of truth for registry-display fields. Do not
edit `registry.json`, README catalog cells, or `cli-skills/pp-<api-slug>/SKILL.md`
in publish PRs; all three are bot-regenerated post-merge by the library's own
workflows. The library's `Fail on changes to generated artifacts` check in
`verify-library-conventions.yml` hard-fails any PR — fork or same-repo — whose
diff against base touches `registry.json` or `cli-skills/pp-*/SKILL.md`, so a
publish that includes either is pre-rejected before review.

## Setup

Before doing anything else:

<!-- PRESS_SETUP_CONTRACT_START -->
```bash
# min-binary-version: 4.0.0

# Derive scope first — needed for local build detection
_scope_dir="$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")"
_scope_dir="$(cd "$_scope_dir" && pwd -P)"

# Prefer local build when running from inside the printing-press repo.
_press_repo=false
if [ -x "$_scope_dir/cli-printing-press" ] && [ -d "$_scope_dir/cmd/cli-printing-press" ]; then
  _press_repo=true
  export PATH="$_scope_dir:$PATH"
  echo "Using local build: $_scope_dir/cli-printing-press"
elif ! command -v cli-printing-press >/dev/null 2>&1; then
  if [ -x "$HOME/go/bin/cli-printing-press" ]; then
    echo "cli-printing-press found at ~/go/bin/cli-printing-press but not on PATH."
    echo "Add GOPATH/bin to your PATH:  export PATH=\"\$HOME/go/bin:\$PATH\""
  else
    echo "cli-printing-press binary not found."
    echo "Install with:  go install github.com/mvanhorn/cli-printing-press/v4/cmd/cli-printing-press@latest"
  fi
  return 1 2>/dev/null || exit 1
fi

# Resolve and emit the absolute path the agent must use for every later
# `cli-printing-press` invocation. `export PATH` above only affects this one
# Bash tool call; subsequent calls open a fresh shell and resolve bare
# `cli-printing-press` against the user's default PATH, where a stale global
# can silently shadow the local build. The agent captures this marker and
# substitutes the absolute path into every later invocation.
if [ "$_press_repo" = "true" ]; then
  PRINTING_PRESS_BIN="$_scope_dir/cli-printing-press"
else
  PRINTING_PRESS_BIN="$(command -v cli-printing-press 2>/dev/null || true)"
fi
echo "PRINTING_PRESS_BIN=$PRINTING_PRESS_BIN"

PRESS_BASE="$(basename "$_scope_dir" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9_-]/-/g; s/^-+//; s/-+$//')"
if [ -z "$PRESS_BASE" ]; then
  PRESS_BASE="workspace"
fi

PRESS_SCOPE="$PRESS_BASE-$(printf '%s' "$_scope_dir" | shasum -a 256 | cut -c1-8)"
PRESS_HOME="${PRINTING_PRESS_HOME:-$HOME/printing-press}"
PRESS_RUNSTATE="$PRESS_HOME/.runstate/$PRESS_SCOPE"
PRESS_LIBRARY="$PRESS_HOME/library"
PRESS_MANUSCRIPTS="$PRESS_HOME/manuscripts"
PRESS_CURRENT="$PRESS_RUNSTATE/current"

mkdir -p "$PRESS_RUNSTATE" "$PRESS_LIBRARY" "$PRESS_MANUSCRIPTS" "$PRESS_CURRENT"
```
<!-- PRESS_SETUP_CONTRACT_END -->

After running the setup contract, capture the `PRINTING_PRESS_BIN=<abs-path>` line from stdout. **Every subsequent `cli-printing-press ...` invocation in this skill must use that absolute path** (substitute the value, not the literal `$PRINTING_PRESS_BIN` token) — `export PATH` above only affects the single Bash tool call it runs in, so later calls open a fresh shell where bare `cli-printing-press` resolves against the user's default `PATH` and a stale global can shadow the local build.

After capturing the binary path, check binary version compatibility. Read the `min-binary-version` field from this skill's YAML frontmatter. Run `<PRINTING_PRESS_BIN> version --json` and parse the version from the output. Compare it to `min-binary-version` using semver rules. If the installed binary is older than the minimum, stop immediately and tell the user: "cli-printing-press binary vX.Y.Z is older than the minimum required vA.B.C. Run `go install github.com/mvanhorn/cli-printing-press/v4/cmd/cli-printing-press@latest` to update."

## Configuration

```
PUBLISH_REPO_URL="https://github.com/mvanhorn/printing-press-library"
PUBLISH_REPO_DIR="$PRESS_HOME/.publish-repo-$PRESS_SCOPE"
PUBLISH_CONFIG="$PRESS_HOME/.publish-config-$PRESS_SCOPE.json"
```

### Publish config

`$PUBLISH_CONFIG` stores persistent publish settings as JSON. On first publish, create it with defaults. The user can edit it to change the library repo or module path base.

```json
{
  "managed_by": "printing-press-publish",
  "repo_url": "https://github.com/mvanhorn/printing-press-library",
  "access": "push",
  "protocol": "ssh",
  "clone_path": "<home>/printing-press/.publish-repo-<scope>",
  "scope_dir": "/absolute/path/to/source/worktree",
  "module_path_base": "github.com/mvanhorn/printing-press-library/library"
}
```

The `module_path_base` field sets the Go module path prefix for published CLIs. During packaging, the full module path is constructed as `<module_path_base>/<category>/<api-slug>`. If the user wants CLIs published to a different repo or path, they edit this field.
Store expanded absolute paths for `clone_path` and `scope_dir` so cleanup can
check them without relying on shell-specific `~` expansion. The `managed_by`
field is required before cleanup may delete anything.

### Scoped clone cleanup

Before creating or reusing `$PUBLISH_REPO_DIR`, prune scoped publish clones whose
source worktree no longer exists. This keeps concurrent worktrees isolated
without accumulating one library clone forever per short-lived worktree.

```bash
find "$PRESS_HOME" -maxdepth 1 -name '.publish-config-*.json' -type f | while read -r cfg; do
  [ "$cfg" = "$PUBLISH_CONFIG" ] && continue
  managed_by=$(jq -r '.managed_by // empty' "$cfg" 2>/dev/null || true)
  scope_dir=$(jq -r '.scope_dir // empty' "$cfg" 2>/dev/null || true)
  clone_path=$(jq -r '.clone_path // empty' "$cfg" 2>/dev/null || true)
  [ "$managed_by" = "printing-press-publish" ] || continue
  [ -z "$scope_dir" ] && continue
  [ -e "$scope_dir" ] && continue
  [ -d "$clone_path/.git" ] || continue
  case "$clone_path" in "$PRESS_HOME"/.publish-repo-*) ;; *) continue ;; esac
  origin=$(git -C "$clone_path" remote get-url origin 2>/dev/null || true)
  case "$origin" in *mvanhorn/printing-press-library*|*/*/printing-press-library*) ;; *) continue ;; esac
  [ -z "$(git -C "$clone_path" status --porcelain)" ] || continue
  [ "$(git -C "$clone_path" rev-parse --abbrev-ref HEAD 2>/dev/null || true)" = "main" ] || continue
  rm -rf "$clone_path" "$cfg"
done
```

## <api-slug>

<If this is a Replace path, add: "⚠️ **Replaces existing `<api-slug>`** — <reason from user>">

<description from manifest, or "No description available">

**API:** <api_name> | **Category:** <category> | **Press version:** <printing_press_version>
**Spec:** <spec_url or "Not specified">

### Publication Path

<New print | Update existing PR #N | Reprint/replace | Alongside print from <original-api-slug>>

### CLI Shape

\`\`\`bash
$ <cli-name> --help
<help_output from validation>
\`\`\`

### Novel Commands

| Command | Name | Description |
|---------|------|-------------|
| `<command>` | <name> | <description> |

### What This CLI Does

<First 2-3 paragraphs from README.md in the CLI directory, or "README not found">

### Manuscripts

<!-- One bullet per file, NOT one per directory. Repeat the research/ row for every file in research/, and the proofs/ row for every file in proofs/. Use a human label that matches the file (e.g. `Research Brief`, `Absorb Manifest`, `Novel Features Brainstorm`, `Phase 5 Acceptance`). Substitute `<HEAD_SHA>` with the value captured after push. Do NOT use relative paths. -->

- [<label>](https://github.com/mvanhorn/printing-press-library/blob/<HEAD_SHA>/library/<category>/<api-slug>/.manuscripts/<run-id>/research/<filename>)
- [<label>](https://github.com/mvanhorn/printing-press-library/blob/<HEAD_SHA>/library/<category>/<api-slug>/.manuscripts/<run-id>/research/<filename>)
- … (one bullet for each remaining file in `.manuscripts/<run-id>/research/`)
- [<label>](https://github.com/mvanhorn/printing-press-library/blob/<HEAD_SHA>/library/<category>/<api-slug>/.manuscripts/<run-id>/proofs/<filename>)
- [<label>](https://github.com/mvanhorn/printing-press-library/blob/<HEAD_SHA>/library/<category>/<api-slug>/.manuscripts/<run-id>/proofs/<filename>)
- … (one bullet for each remaining file in `.manuscripts/<run-id>/proofs/`)

### Validation Results

| Check | Result |
|-------|--------|
| Manifest | PASS/FAIL |
| Phase 5 | PASS/FAIL |
| go mod tidy | PASS/FAIL |
| govulncheck (this CLI only, reachable findings) | PASS/FAIL |
| go vet | PASS/FAIL |
| go build | PASS/FAIL |
| --help | PASS/FAIL |
| --version | PASS/FAIL |
| Manuscripts | PRESENT/MISSING |

### Publish Live Gate

<If Step 4.5 ran dogfood: "Full live dogfood reran at publish time and passed. Proof: `<proof path or manuscript link>`">
<If Step 4.5 was skipped: "Skipped with explicit reason: `<SKIP_LIVE_TEST_REASON>`">

### Gaps

<List any missing manifest fields, or omit this section if everything is present>
```

**If updating an existing PR** (`EXISTING_PR_NUMBER` is set):

```bash
cd "$PUBLISH_REPO_DIR"
PR_BODY_FILE="$(mktemp)"
# Write the constructed PR body Markdown to "$PR_BODY_FILE".
gh pr edit "$EXISTING_PR_NUMBER" \
  --repo mvanhorn/printing-press-library \
  --body-file "$PR_BODY_FILE"
rm -f "$PR_BODY_FILE"
```

Display the full PR URL: "Updated PR: <EXISTING_PR_URL>" (use the full `https://` URL, not shorthand).

**If creating a new PR:**

```bash
cd "$PUBLISH_REPO_DIR"

# Read access mode from config
ACCESS=$(jq -r .access "$PUBLISH_CONFIG")
GH_USER=$(jq -r .gh_user "$PUBLISH_CONFIG")

if [ "$ACCESS" = "fork" ]; then
  PR_HEAD_REF="$GH_USER:feat/<api-slug>"
else
  PR_HEAD_REF="feat/<api-slug>"
fi

PR_BODY_FILE="$(mktemp)"
# Write the constructed PR body Markdown to "$PR_BODY_FILE".

gh pr create \
  --repo mvanhorn/printing-press-library \
  --head "$PR_HEAD_REF" \
  --base main \
  --title "feat(<api-slug>): add <api-slug>" \
  --body-file "$PR_BODY_FILE"

rm -f "$PR_BODY_FILE"
```

Display the full PR URL (e.g., `https://github.com/mvanhorn/printing-press-library/pull/10`), not the shorthand `org/repo#N` format. The full URL is clickable in all terminals and contexts.

## Error Handling

- **`gh` not authenticated:** Detect in Step 1, tell user to run `gh auth login`
- **CLI not found:** Show available CLIs in Step 2, let user pick
- **Validation fails:** Show per-check results in Step 4, stop
- **Repo unreachable:** Report clearly in Step 5
- **Fork creation fails:** `gh repo fork` may fail if the user already has a fork with a different name, or if the org restricts forking. Report the error and suggest the user fork manually via the GitHub web UI.
- **Collision check fails:** If `gh pr list` or `ls` commands fail (network, auth), warn but don't block — proceed as if no collision exists
- **Rename fails:** Show the error from `publish rename --json`. Offer to retry with a different qualifier or bail. If the publish repo is in a partial state, reset with `git checkout -- . && git clean -fd` before retrying
- **Branch conflict (no existing PR):** Ask user in Step 8 (overwrite or timestamp)
- **Push fails:** For fork users, ensure they're pushing to their fork (origin), not upstream. Report the error, suggest checking `gh auth status` and `git remote -v`
- **Cross-repo PR creation fails:** If `gh pr create --head user:branch` fails with "head not found", the branch wasn't pushed to the fork. Verify with `git ls-remote origin feat/<api-slug>`
