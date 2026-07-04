## Phase 5.5: Polish

**Always runs.** Invoke the `printing-press-polish` skill to run diagnostics, fix quality issues, and return a delta. The polish skill carries `context: fork` in its frontmatter, so its diagnostic-fix-rediagnose loop runs in a forked context — diagnostic spam, fix iterations, and re-audits stay scoped to the polish session and don't pollute this generation flow. The skill is autonomous — no user input needed. The goal is to ship the best CLI possible, not the fastest.

Before invoking polish, collect the Phase 3 transcendence gate state and include
it in the polish input bundle:

```yaml
phase3_transcendence_rows_planned: <planned>
phase3_transcendence_rows_built: <built>
phase3_transcendence_rows_missing:
  - <manifest row name or command>
prior_sub60_reprint: <true|false>
partial_transcendence_override: <none or build-log note path>
```

Invoke via the Skill tool (**foreground** — must complete before promoting).
Pass `$CLI_WORK_DIR` as the first line of `args`, followed by the Phase 3 bundle:

```
Skill(
  skill: "cli-printing-press:printing-press-polish",
  args: "$CLI_WORK_DIR
phase3_transcendence_rows_planned: <planned>
phase3_transcendence_rows_built: <built>
phase3_transcendence_rows_missing:
  - <manifest row name or command>
prior_sub60_reprint: <true|false>
partial_transcendence_override: <none or build-log note path>"
)
```

Polish must treat `prior_sub60_reprint: true` plus any missing row as `ship_recommendation: hold` unless `partial_transcendence_override` names the accepted exception. This keeps mid-pipeline polish from recommending `ship` for a reprint that regressed from the approved manifest before Phase 6 sees the artifact.

**Pass `$CLI_WORK_DIR` (the absolute working-dir path), not the API slug.** Phase 5.5 fires before Phase 5.6 promotes the working CLI to the library, so `$PRESS_LIBRARY/<slug>/` either doesn't exist yet or contains the *prior* run's CLI. If you paraphrase the args to the slug (e.g., `args: "producthunt"`), polish silently operates on the stale library copy.

**Do not pass `--standalone` in `args`.** Polish's Publish Offer is gated on caller mode (see polish SKILL.md "Publish Offer"): slash-command invocations or Skill-tool invocations carrying `--standalone` run the offer; everything else defers. Phase 5.5 is mid-pipeline — main SKILL owns the publish flow at Phase 6 — so this invocation must remain flag-free. Passing `--standalone` here would re-introduce the failure mode the flag was added to prevent: polish forks the public library, sets global git config, and opens a real PR before the working CLI has been promoted.

The polish skill runs the full diagnostic-fix-rediagnose loop including MCP tool quality polish (via `cli-printing-press tools-audit` plus the playbook at `references/tools-polish.md`) and ends its response with a `---POLISH-RESULT---` block containing scorecard/verify/tools-audit before/after, fixes applied, and a ship recommendation.

Parse the result block. Display the delta to the user:

```
Polish pass:
  Verify:      86% → 93% (+7%)
  Scorecard:   92  → 94  (+2)
  Tools-audit: 76  → 0   pending findings
  Fixed: [summary of fixes_applied from result]
```

**Verdict override:** If the polish skill's `ship_recommendation` is `hold` and the Phase 4 verdict was `ship`, downgrade to `hold`. Release the lock without promoting.

Mid-pipeline polish does **not** run `publish-validate` — that gate is the publish skill's responsibility at Phase 6, where the prerequisites it checks (manifest.printer from `git config github.user`, packaged `tools-manifest.json`, phase5 acceptance proof under `$CLI_DIR/.manuscripts/<run>/proofs/`) are actually satisfied. Polish emits `publish_validate_before: skipped (mid-pipeline)` and `publish_validate_after: skipped (mid-pipeline)` in this invocation; treat those values as informational, never as a hold signal. A first-time user without `git config github.user` set will no longer see their CLI-level run downgraded to `hold` because of a publish prerequisite that the press itself owns satisfying.

Write the polish skill's full response to:

`$PROOFS_DIR/<stamp>-fix-<api>-pp-cli-polish.md`

## Phase 5.6: Promote and Archive

### Acceptance gate check

Before promoting, verify the Phase 5 JSON gate marker:

- If `$PROOFS_DIR/phase5-acceptance.json` exists with `status: "pass"` → proceed to promote.
- If `$PROOFS_DIR/phase5-acceptance.json` exists with `status: "fail"` → CLI is on hold. Do NOT promote. Proceed to Archive Manuscripts.
- If `$PROOFS_DIR/phase5-skip.json` exists and the auth-aware skip is valid → proceed to promote.
- If neither JSON marker exists → Phase 5 was skipped or not recorded. Go back and run it, or write the valid skip marker. Do NOT promote without one.

### Promote to Library

If the shipcheck verdict is `ship` **or** `ship-with-gaps`, promote the verified CLI from the working directory to the library. This must happen BEFORE archiving — the CLI in the library is the primary deliverable, and Phase 6's publish path expects `$PRESS_LIBRARY/<api>/` to hold the current run.

**Pick the promote path by whether the library already holds hand-authored content.** `lock promote --dir` performs an **atomic swap** of `$CLI_WORK_DIR` over `$PRESS_LIBRARY/<api>` — every file in the library that is not in the fresh tree is gone after the swap. Whole hand-authored files (a separate `internal/syncer/` package, novel-feature command files under `internal/cli/` without the `// Generated by ...` header, hand-built migration files under `internal/store/`) survive a `cli-printing-press regen-merge` pass but are wiped by a bare swap. This is the same preservation dynamic called out under [**Hand-edits must be regen-mergeable.**](#hand-edit-durability); the orchestration here must honor it.

Detect hand-authored content in the existing library:

```bash
LIB_TARGET="$PRESS_LIBRARY/<api>"
NOVEL_COUNT=0
if [ -d "$LIB_TARGET" ]; then
  MANIFEST="$LIB_TARGET/.printing-press.json"
  HAS_NOVEL_FIELD=false
  if [ -f "$MANIFEST" ]; then
    # `novel_features` is the canonical count when the field is present.
    # Distinguish absent (older manifest predating the field) from explicit zero —
    # `jq '.novel_features // [] | length'` collapses both to 0, which would
    # silently route older CLIs through the destructive Path A swap.
    HAS_NOVEL_FIELD=$(jq 'has("novel_features")' "$MANIFEST" 2>/dev/null || echo false)
  fi
  if [ "$HAS_NOVEL_FIELD" = "true" ]; then
    NOVEL_COUNT=$(jq -r '.novel_features | length' "$MANIFEST" 2>/dev/null || echo 0)
  else
    # File probe fallback fires in three cases: manifest missing entirely
    # (interrupted run, restored-from-backup state, much older CLI), manifest
    # present but predates the `novel_features` field, and manifest present
    # but corrupt-enough that `jq has()` errored. Any *.go file under
    # internal/cli/, internal/syncer/, or internal/store/ whose first 20
    # lines lack the "Generated by CLI Printing Press" header is hand-authored;
    # one such file is enough to route through Path B.
    for dir in "$LIB_TARGET/internal/cli" "$LIB_TARGET/internal/syncer" "$LIB_TARGET/internal/store"; do
      [ -d "$dir" ] || continue
      while IFS= read -r f; do
        if ! head -n 20 "$f" 2>/dev/null | grep -q "Generated by CLI Printing Press"; then
          NOVEL_COUNT=1
          break 2
        fi
      done < <(find "$dir" -type f -name '*.go')
    done
  fi
fi
```

The presence check (`jq 'has("novel_features")'`) and the manifest existence check are independent. A library can exist with a hand-authored layer but no manifest at all (interrupted run, restored-from-backup state, much older CLI), so gating the file-probe fallback behind `[ -f manifest ]` would leave that case routing through the destructive Path A swap.

**Path A — first print or no hand-authored content (`! -d "$LIB_TARGET"` or `NOVEL_COUNT == 0`).** Use the destructive swap. Fast path; no library content to preserve:

```bash
# Atomic swap: copies working dir, writes manifest, updates run pointer, releases lock.
cli-printing-press lock promote --cli <api>-pp-cli --dir "$CLI_WORK_DIR"
```

The `promote` command handles the full sequence: stages the working directory, atomically swaps it into `$PRESS_LIBRARY/<api>` (slug-keyed), writes the `.printing-press.json` manifest, updates the `CurrentRunPointer`, and releases the lock — all in one step. The `--cli` flag accepts the CLI binary name; the Go code translates to the slug-keyed library path internally.

**Path B — reprint over a library with hand-authored content (`-d "$LIB_TARGET"` AND `NOVEL_COUNT > 0`).** Use `regen-merge` to fold the fresh tree into the live library before promotion. `regen-merge` classifies every Go file under `internal/` and `cmd/` against the fresh tree, overwrites safely-templated files, re-injects `AddCommand` calls in `root.go` and resource-parents that the fresh tree lacks, and leaves files with hand-edited additions (`TEMPLATED-WITH-ADDITIONS`) untouched for human review. `--apply` writes via stage-and-swap-with-recovery, so partial failure can never lose data.

`regen-merge --apply` exits 0 even when it leaves `TEMPLATED-WITH-ADDITIONS` files (the human-review verdicts are reported, not raised as errors). The halt condition must be checked explicitly against the report — capture `--json` and inspect the verdict counts:

```bash
REGEN_REPORT="$PROOFS_DIR/regen-merge-report.json"
if ! cli-printing-press regen-merge "$LIB_TARGET" \
    --fresh "$CLI_WORK_DIR" --apply --json > "$REGEN_REPORT"; then
  # Real error (input error, apply failure). Release the lock — it was
  # acquired upstream by the press pipeline; regen-merge does not own it —
  # and surface the failure to the user.
  cli-printing-press lock release --cli <api>-pp-cli
  echo "regen-merge --apply failed; see $REGEN_REPORT" >&2
  exit 1
fi

# Halt on review-required verdicts before promoting. regen-merge exits 0
# in these cases; the JSON report is the source of truth.
NEEDS_REVIEW=$(jq '[.files[] | select(.verdict == "TEMPLATED-WITH-ADDITIONS"
  or .verdict == "TEMPLATED-BODY-DRIFT"
  or .verdict == "TEMPLATED-VALUE-DRIFT"
  or .verdict == "NOVEL-COLLISION")] | length' "$REGEN_REPORT")
if [ "$NEEDS_REVIEW" -gt 0 ]; then
  # Release the lock so the next reprint of this CLI is not blocked until
  # timeout. lock promote would have released it; the halt path must too.
  cli-printing-press lock release --cli <api>-pp-cli
  echo "regen-merge flagged $NEEDS_REVIEW file(s) for human review. " \
       "Inspect $REGEN_REPORT, resolve inline hand-edits, then re-run." >&2
  exit 1
fi
```

After `regen-merge` succeeds with no review-required verdicts, the live library directory is the new run. Do **not** then call `lock promote --dir "$CLI_WORK_DIR"` — that would atomically swap the working dir over the just-merged library and undo the preservation. Promote in place: point `lock promote --dir` at the library itself so the manifest write, run-pointer update, and lock release still run. Two extra steps are required compared to Path A:

1. Copy the current run's PII-polish ledger into `$LIB_TARGET` before promote. `lock promote --dir` internally runs `validatePIIGateForPromote` against the target directory, which reads `$LIB_TARGET/.printing-press-pii-polish.json`. After `regen-merge --apply` the generator-emitted Go files have fresh line numbers, so the prior reprint's ledger (still sitting in `$LIB_TARGET` from the last atomic swap) has stale `{file, line, kind, span}` identity keys for those files and previously-accepted findings re-surface as pending — the gate fails before the swap and the lock stays held. Bringing the current run's ledger over fixes the identity match for generator-emitted files; hand-authored files with new findings still surface correctly as pending.
2. Guard the promote with an explicit lock-release on failure. Unlike Path A, where a promote-gate failure simply leaves the working dir alone, a Path B failure leaves the lock held on the live library because the gate fires before the swap and before `ReleaseLock`. Mirror the lock-release guards from the regen-merge error branches above.

```bash
if [ -f "$CLI_WORK_DIR/.printing-press-pii-polish.json" ]; then
  cp "$CLI_WORK_DIR/.printing-press-pii-polish.json" "$LIB_TARGET/.printing-press-pii-polish.json"
else
  # Current run produced no PII findings (clean API or polish skipped).
  # Remove the stale prior-reprint ledger so the gate sees a clean state
  # — otherwise the old identity keys would replay against freshly
  # line-shifted generator files and surface false-positive pendings.
  rm -f "$LIB_TARGET/.printing-press-pii-polish.json"
fi
cli-printing-press lock promote --cli <api>-pp-cli --dir "$LIB_TARGET" || {
  cli-printing-press lock release --cli <api>-pp-cli
  echo "lock promote failed for $LIB_TARGET; lock released. " \
       "Inspect the PII gate output above and resolve before re-running." >&2
  exit 1
}
```

`TEMPLATED-WITH-ADDITIONS` and the other review verdicts represent inline hand-edits to generator-emitted files that need human review (see [**Hand-edits must be regen-mergeable.**](#hand-edit-durability) for the separate-file pattern that avoids this in future). The dry-run report (omit `--apply`) is the right tool for inspection once the halt path fires.

`ship-with-gaps` is promoted (on either path) because the verdict means "the CLI is shippable with documented, non-blocking gaps" — the gaps are recorded in the README's `## Known Gaps` block and the user opts in via Phase 6's publish prompt. Treating ship-with-gaps as un-promotable would strand the verified working copy and leave the library on a stale prior run.

If the shipcheck verdict is `hold`, the lock was already released in Phase 4. Do NOT promote on either path. The working copy stays in `$CLI_WORK_DIR` and is not copied to the library.

### Archive Manuscripts

Archive the run's research, proofs, and discovery artifacts to `$PRESS_MANUSCRIPTS/`
**unconditionally** after promotion (or after lock release for `hold` verdicts). This
happens regardless of the shipcheck verdict — even a `hold` run produces research
and proofs that future runs should be able to reuse.

Archiving and publishing are separate concerns. Archiving preserves research for
future `/printing-press` runs on the same API. Publishing ships the CLI to the
library repo. A run that isn't ready to publish still produces valuable research.

```bash
# Archive under API slug (e.g., steam-web), matching the slug-keyed library layout.
API_SLUG="<api>"
mkdir -p "$PRESS_MANUSCRIPTS/$API_SLUG/$RUN_ID"
cp -r "$RESEARCH_DIR" "$PRESS_MANUSCRIPTS/$API_SLUG/$RUN_ID/research" 2>/dev/null || true
cp -f "$API_RUN_DIR/research.json" "$PRESS_MANUSCRIPTS/$API_SLUG/$RUN_ID/research.json" 2>/dev/null || true
cp -r "$PROOFS_DIR" "$PRESS_MANUSCRIPTS/$API_SLUG/$RUN_ID/proofs" 2>/dev/null || true

# Archive discovery artifacts (browser-sniff captures, URL lists, traffic analysis, browser-sniff report).
# Session state lives outside $DISCOVERY_DIR (see Run Initialization), so the
# archive cannot pick it up. The legacy rm is a no-op safety net for an
# in-flight $DISCOVERY_DIR carried over from a pre-isolation run.
rm -f "$DISCOVERY_DIR/session-state.json" 2>/dev/null || true

# Strip response bodies from HAR before archiving to control size.
if [ -d "$DISCOVERY_DIR" ]; then
  for har in "$DISCOVERY_DIR"/browser-sniff-capture.har "$DISCOVERY_DIR"/browser-sniff-capture.json; do
    if [ -f "$har" ] && command -v jq >/dev/null 2>&1; then
      jq 'del(.log.entries[].response.content.text)' "$har" > "${har}.stripped" 2>/dev/null && mv "${har}.stripped" "$har" || rm -f "${har}.stripped"
    fi
  done
  cp -r "$DISCOVERY_DIR" "$PRESS_MANUSCRIPTS/$API_SLUG/$RUN_ID/discovery" 2>/dev/null || true
fi

# Wipe live-auth scratch dir now that the run is archived. The directory lives
# under ${TMPDIR:-/tmp}, so OS-level tmp reaping is the long-tail fallback, but
# we clean explicitly so back-to-back runs do not accumulate session state.
rm -rf "$SESSION_DIR" 2>/dev/null || true
```

**MANDATORY: After archiving, you MUST proceed to Phase 6 below. Do not print a summary and stop. Do not treat archiving as the end of the run. The run ends when the user has been asked about next steps via the ship-path or hold-path menu.**

