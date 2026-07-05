## Step 1: Prerequisites

Verify `gh` is authenticated:

```bash
gh auth status
```

If this fails, stop and tell the user: "GitHub CLI is not authenticated. Run `gh auth login` first."

## Step 2: Resolve API Slug

Run:

```bash
cli-printing-press library list --json
```

Parse the JSON output into a list of CLIs. The library is now keyed by API slug (the directory name), not CLI name.

**Name resolution order** (matches the score skill for consistency):

1. **Exact match:** If the argument matches a directory name (API slug) exactly, use it
2. **CLI name match:** If no exact match, try matching against `cli_name` fields, then derive the API slug from the manifest's `api_name` field
3. **Suffix match:** If no match yet, try `<argument>-pp-cli` against `cli_name` fields
4. **Glob match:** If no suffix match, search for entries where `cli_name` or `api_name` contains the argument as a substring. Cap at 5 most-recent matches. If multiple matches, present them via AskUserQuestion and let the user pick
5. **No match:** List all available CLIs and ask the user to pick or re-enter
6. **No argument:** If invoked with no name, list all CLIs sorted by modification time and let the user pick

Once resolved, read the manifest's `api_name` field to get the API slug. Use this slug for all downstream operations (branch names, registry entries, collision detection, path construction). The `cli_name` from the manifest is only used for binary-level operations.

When presenting matches, show the API slug and modification time in a human-friendly format (e.g., "2 hours ago", "3 days ago").

## Step 3: Determine Category

Read `.printing-press.json` from the resolved CLI directory.

**Category resolution order:**

1. If the manifest has a `category` field, present it for confirmation:
   > "Publishing as **<category>**. OK?"
   Give the user the option to change it

2. If no `category` but `catalog_entry` is present, look it up:
   ```bash
   cli-printing-press catalog show <catalog_entry> --json
   ```
   Extract the category from the result. Present for confirmation

3. If neither provides a category, present the full list via AskUserQuestion:
   - developer-tools, monitoring, cloud, project-management
   - productivity, social-and-messaging, sales-and-crm, marketing
   - payments, auth, commerce, ai, media-and-entertainment, devices, other

## Step 4: Validate

Run:

```bash
cli-printing-press publish validate --dir <cli-dir> --json
```

`govulncheck` in this step is intentionally scoped to `<cli-dir>` only. It
uses the default `govulncheck ./...` mode so reachable symbol findings block
publish, while merely-required vulnerable modules without a call path do not
become release blockers. Do not replace this with a full public-library scan or
`govulncheck -show verbose`.

Parse the JSON result. Display each check result to the user:

```
Validating <api-slug>...
  manifest        PASS
  phase5          PASS
  go mod tidy     PASS
  govulncheck     PASS
  go vet          PASS
  go build        PASS
  --help          PASS
  --version       PASS
  manuscripts     WARN (no manuscripts found)
```

If `"passed": false`, report the failing checks and **stop**. Do not create a partial PR.
The `manifest` check is authoritative for the public-library provenance
contract: current `schema_version`, `run_id`, `printing_press_version`,
`printer`, `printer_name`, and MCP metadata files when MCP is advertised. If it
fails, tell the user to re-print or re-package with current Printing Press
metadata before opening the library PR.

Save the `help_output` field from the result — it's used in the PR description.

## Step 4.5: Live End-to-End Gate

Before touching the managed publish clone, rerun the live behavioral gate
against the CLI that is about to be published. Step 4 proves the source builds
and validates structurally; this step proves the current post-edit tree still
works against the real upstream API. Do not rely on an older
`phase5-acceptance.json` from generation or polish because the CLI may have
been hand-edited since that marker was written.

Resolve the Phase 5 proofs directory from the CLI manifest:

```bash
MANIFEST="$CLI_DIR/.printing-press.json"
API_SLUG=$(jq -r '.api_name // empty' "$MANIFEST")
CLI_NAME=$(jq -r '.cli_name // empty' "$MANIFEST")
RUN_ID=$(jq -r '.run_id // empty' "$MANIFEST")
AUTH_TYPE=$(jq -r '.auth_type // "none"' "$MANIFEST")
AUTH_ENV=$(jq -r '.auth_env_vars[0] // empty' "$MANIFEST")

if [ -z "$API_SLUG" ] || [ -z "$RUN_ID" ]; then
  echo "ERROR: manifest is missing api_name or run_id; cannot run publish live gate."
  exit 1
fi

PROOFS_DIR="$CLI_DIR/.manuscripts/$RUN_ID/proofs"
if [ ! -d "$PROOFS_DIR" ] && [ -n "$API_SLUG" ] && [ -d "$PRESS_MANUSCRIPTS/$API_SLUG/$RUN_ID/proofs" ]; then
  PROOFS_DIR="$PRESS_MANUSCRIPTS/$API_SLUG/$RUN_ID/proofs"
elif [ ! -d "$PROOFS_DIR" ] && [ -n "$CLI_NAME" ] && [ -d "$PRESS_MANUSCRIPTS/$CLI_NAME/$RUN_ID/proofs" ]; then
  PROOFS_DIR="$PRESS_MANUSCRIPTS/$CLI_NAME/$RUN_ID/proofs"
fi
mkdir -p "$PROOFS_DIR"
```

If `SKIP_LIVE_TEST_REASON` is unset, run full live dogfood and write a fresh
acceptance marker into that proofs directory:

```bash
LIVE_GATE_JSON="$PROOFS_DIR/publish-live-gate.json"
LIVE_GATE_ARGS=(
  dogfood
  --dir "$CLI_DIR"
  --live
  --level full
  --timeout 120s
  --write-acceptance "$PROOFS_DIR/phase5-acceptance.json"
  --json
)
if [ -n "$AUTH_ENV" ]; then
  LIVE_GATE_ARGS+=(--auth-env "$AUTH_ENV")
fi

rm -f "$PROOFS_DIR/phase5-skip.json"
if ! "$PRINTING_PRESS_BIN" "${LIVE_GATE_ARGS[@]}" >"$LIVE_GATE_JSON"; then
  echo "Publish live gate failed. See $LIVE_GATE_JSON and $PROOFS_DIR/phase5-acceptance.json."
  jq -r '.tests[]? | select(.status == "fail") | "- \(.command) [\(.kind)]: \(.reason // "failed")"' "$LIVE_GATE_JSON" 2>/dev/null || true
  exit 1
fi
```

On failure, stop exactly like Step 4's `passed: false`: no managed clone, no
branch, no package, no PR. Report the failed command, exit code when present,
stderr or reason snippet, and the path to the fresh proof files so the operator
can re-run dogfood and fix the CLI.

If `SKIP_LIVE_TEST_REASON` is set from `--skip-live-test=<reason>`, write a
fresh skip marker instead of running dogfood:

```bash
SKIP_REASON_LOWER=$(printf '%s' "$SKIP_LIVE_TEST_REASON" | tr '[:upper:]' '[:lower:]')
case "$AUTH_TYPE" in
  api_key|bearer_token|oauth2)
    ;;
  none)
    case "$SKIP_REASON_LOWER" in
      *upstream*outage*|lan-unreachable-from-generation-host)
        ;;
      *)
        echo "ERROR: --skip-live-test is only valid for auth_type=none during a known upstream outage or LAN-unreachable hardware case."
        exit 1
        ;;
    esac
    ;;
  *)
    echo "ERROR: --skip-live-test is not valid for auth_type=$AUTH_TYPE. Run the live gate instead."
    exit 1
    ;;
esac

API_KEY_AVAILABLE=false
if [ -n "$AUTH_ENV" ] && [ -n "${!AUTH_ENV:-}" ]; then
  API_KEY_AVAILABLE=true
fi

rm -f "$PROOFS_DIR/phase5-acceptance.json"
jq -n \
  --arg api "$API_SLUG" \
  --arg run "$RUN_ID" \
  --arg reason "$SKIP_LIVE_TEST_REASON" \
  --arg auth "$AUTH_TYPE" \
  --argjson api_key_available "$API_KEY_AVAILABLE" \
  --argjson browser_session_available false \
  '{
    schema_version: 1,
    api_name: $api,
    run_id: $run,
    status: "skip",
    level: "none",
    skip_reason: $reason,
    auth_context: {
      type: $auth,
      api_key_available: $api_key_available,
      browser_session_available: $browser_session_available
    }
  }' > "$PROOFS_DIR/phase5-skip.json"
if [ "$SKIP_REASON_LOWER" = "lan-unreachable-from-generation-host" ]; then
  tmp_marker=$(mktemp "${TMPDIR:-/tmp}/phase5-skip.XXXXXX")
  jq '.auth_context.local_network_only = true' "$PROOFS_DIR/phase5-skip.json" > "$tmp_marker" &&
    mv "$tmp_marker" "$PROOFS_DIR/phase5-skip.json"
fi
LIVE_GATE_JSON=""
```

Then rerun Step 4's validation:

```bash
"$PRINTING_PRESS_BIN" publish validate --dir "$CLI_DIR" --json
```

This second validation proves the fresh acceptance or skip marker satisfies the
same Phase 5 contract that package and publish rely on. If it fails, stop
before Step 5.
