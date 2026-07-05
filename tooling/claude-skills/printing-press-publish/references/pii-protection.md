## Secret & PII Protection

Before creating the PR, verify that no secrets leaked into the packaged CLI.

**This matters because the library repo is public.** A leaked API key in a PR is
a security incident — anyone can see it, even if the PR is later closed.

### What the Printing Press checks (deterministic)

The generation skill (`/printing-press`) runs an exact-value scan during Phase 5.5
if the user provided an API key. By the time publish runs, the Printing Press's own
mistakes should already be caught. But the user may have edited files between
generation and publish.

### What publish checks

1. **Mandatory binary scan:** `cli-printing-press publish package` scans the staged CLI and manuscripts for live-looking vendor-prefix tokens (`sk-or-v1-*`, `sk_live_*`, `ghp_*`, `ghs_*`, `xoxb-*`, `AKIA*`, and similar). If it fails with `vendor-prefix tokens detected`, treat the package as unpublishable. Do not copy, commit, push, or open a PR until the reported file:line findings are removed or redacted.

2. **If the user's exact API key value is known**, scan the packaged tree before creating the PR. This catches edits or manuscripts added after Phase 5.5:
   ```bash
   if [ -n "$API_KEY_VALUE" ] && [ ${#API_KEY_VALUE} -ge 16 ]; then
     if grep -rF "$API_KEY_VALUE" "$PUBLISH_REPO_DIR/library/<category>/<api-slug>" 2>/dev/null; then
       echo "BLOCKING: API key value found in staged publish tree."
       exit 1
     fi
   fi
   ```

3. **If `gitleaks` or `trufflehog` is installed**, run it as an enrichment pass on the staged directory:
   ```bash
   if command -v gitleaks >/dev/null 2>&1; then
     gitleaks detect --source "<staging-dir>/library" --no-git --verbose 2>&1
   elif command -v trufflehog >/dev/null 2>&1; then
     trufflehog filesystem "<staging-dir>/library" 2>&1
   fi
   ```
   These tools use vendor-specific patterns (Steam keys, Stripe keys, GitHub
   tokens) with low false-positive rates. Their findings add detector breadth
   beyond the mandatory floor. Review any finding before proceeding.

4. **Always do the lightweight structural check:**
   - Verify no `.env` files, `session-state.json`, or `config.toml` with
     real credentials exist in the staged directory
   - Check README examples use `"your-key-here"` placeholders, not real values
   - Check manuscripts (if included) don't contain auth headers or cookie values

5. **Never include** in the staged directory:
   - `.env` files
   - `session-state.json`
   - Config files with real credentials
   - HAR captures with un-stripped auth headers

If the mandatory binary scan or exact-value scan finds issues, stop. For
external-tool or lightweight structural findings, warn the user and ask whether
to proceed. The user makes the final call on those non-mandatory findings.

### PII pattern scanning (mandatory)

Beyond the secret scans above, run the **PII pattern scanning** step from
[../printing-press/references/secret-protection.md](../printing-press/references/secret-protection.md#pii-pattern-scanning)
(section "PII pattern scanning"). This catches PII captured during live dogfood
that the prose guidance missed — emails, real attendee names, account
identifiers — before they ship to the public library repo.

The scan has two tiers:
- **Tier 1 (auto-redact silently):** vendor-prefix-anchored bearer tokens
  (`Bearer cal_live_*`, `Bearer sk_live_*`, `Bearer ghp_*`, `xoxp-*`, etc.).
  Near-zero false-positive rate.
- **Tier 2 (warn, batched user prompt):** generic emails, generic bearer tokens,
  capitalized first+last name patterns. Allowlist suppresses spec-derived API
  vocabulary ("Event Types", "Booking Links") automatically.

A pre-scrub copy of the staging directory is preserved at
`<staging>.pre-pii-scrub/` so the user can recover from a wrong redaction.

Two prior PII leaks shipped to the public library before this scan existed.
The scan is the mechanical defense layer the prose guidance alone could not
provide.
