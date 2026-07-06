# Captain backlog

Owner-visible. Printed at session start.

## From the 2026-07-06 greenlight review of cap/link-clis

That review scored the whole (then un-merged) branch, so it surfaced real bugs
in already-landed code unrelated to link-clis. r1 was fixed while redesigning
greenlight (commit 1e2ba44). The rest are genuine and now sit on `main`:

- **[security] yt-claude relay: unauthenticated CORS → prompt-injected RCE.**
  `tooling/cli/yt-claude/relay.py:206` sets `Access-Control-Allow-Origin: *` on
  `/queue` with no auth/CSRF. While `yt-claude serve` runs, any webpage can POST
  a video URL; with an IDE target (plist default `antigravity`) the extension
  auto-executes `claude --dangerously-skip-permissions` on a prompt embedding
  the attacker-controlled video title. Remote, unauthenticated agentic exec.
  → Fix: bind localhost only + require a per-session token on `/queue`; drop the
  wildcard CORS. Worker task, `--verify` with a token/authz check.

- **[security] escrow-backup leaves plaintext secrets in /tmp on gpg failure.**
  `infra/escrow/escrow-backup.sh:71` traps `rm -rf "$STAGE"` on EXIT before
  `TARBALL="$STAGE.tar.gz"` exists; the trap never covers the tarball. If gpg
  (cancelled/no-pinentry/disk-full) fails after the tarball is built, `set -e`
  exits and the plaintext bundle (pipelines/.env, credentials.json, OAuth
  tokens, infra/secrets/*) is left behind — contradicting its "plaintext wiped"
  claim. → Fix: extend the trap to the tarball path. Worker task.

- **[correctness] cap-session-start reconcile uses unanchored `grep`.**
  `bin/cap-session-start.sh:47` — `tmux list-windows | grep -q "$window"` does
  substring matching, so a live `cap-10` masks a dead `cap-1` (dead crewmate not
  flagged for teardown). → Fix: match the window name as a whole field.

- **[portability] cap-session-start uses BSD-only `stat -f %m`.**
  `bin/cap-session-start.sh:26` — no `stat -c %Y` Linux fallback, unlike the lane
  scripts (agy-headless.sh, antigravity.sh) which all guard it. Hard-fails under
  `set -uo pipefail` if the captain ever runs on the VPS. → Fix: add the fallback.

- **[info] wt get silently skips a dirty unleased slot.**
  `tooling/cli/wt/wt:122` — an unleased-but-dirty worktree (crashed holder that
  never `wt return`ed) is neither reclaimed nor reported, shrinking the pool
  until someone runs `wt prune`. → Decide whether `get` should auto-reset a
  dirty orphaned slot. Needs owner call.
