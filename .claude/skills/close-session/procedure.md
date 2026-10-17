# Close-session procedure (shared)

The one procedure behind `close-session` (personal-stuff) and `zluri-close-session` (work-skills).
**Source: personal-stuff `.claude/skills/close-session/procedure.md`.** work-skills holds a copy at
`skills/zluri-close-session/references/procedure.md`, kept identical by
`personal-stuff/scripts/sync-shared-skills.sh`. Edit the source, then run the script.

The calling skill supplies the **routing table** (where each kind of fact lives) and its own rules.

## Goal

Make the next session better than this one: docs match what changed, and every lesson lands once, in the
place that stops it from happening again. Never bloat: a run that removes lines is as good as one that adds.

## Keep it cheap

Each tool call re-reads the whole session, so cost grows with session length. Use few calls:
- Read every candidate target in **one** batch of parallel reads. Do not grep the repo.
- Only touch files this session changed, or the homes the routing table names for a lesson.
- More than 3 approved edits: hand them to one subagent (`model: sonnet`) with the list and file paths.
- Nothing worth saving: say so in one line and stop. Do not run the rest.

## 1. Harvest (the whole session, not the last turns)

If the session was compacted, the summary lost detail: also search this session's transcript
(`$CLAUDE_CONFIG_DIR/projects/<project>/<session-id>.jsonl`) for the owner's corrections ("no", "wrong", "don't",
"why did you", "again").

Collect only these:
1. **Claude's mistakes**: a claim later retracted, a guess that failed, retries that wasted time, a misread
   instruction. Name the check that would have caught it.
2. **Owner corrections and preferences**: "don't do X", "always Y".
3. **Skill gaps**: a skill that should have triggered and did not, was wrong, or missed a step.
4. **Tool traps**: a command that failed, why, and the fix that worked (verified in this session).
5. **Docs now stale**: a README, CLAUDE.md or doc describing something this session changed.
6. **Live work state** that git, a PR or Jira does not already record.

Skip one-off details and anything already written down correctly.

## 2. Pick the rung (fix the cause before writing a note)

For each lesson, take the **highest** rung that works:

| Rung | Fix | Use when |
|---|---|---|
| 1 | Fix the script, hook text, config or default itself | The tool or our own code caused it |
| 2 | Add a hook or gate that blocks or redirects | A rule was already written and still broken |
| 3 | One trap line in the owning skill (or its `references/`) | A fact Claude needs at the moment of use |
| 4 | `CLAUDE.md` line | A rule for every session; at most 2 lines added per run |
| 5 | Memory file | Live work state only |

Rung 3 and 4 lines state a fact **verified in this session**, never a guess. If this session proved an existing
line wrong, the fix is to correct or delete that line.

## 3. Check the lesson ledger

Ledger: `~/.claude-lessons.tsv` (machine-local, not in git). Columns: `date  scope  key  rung  home`.
`key` is a short slug for the lesson (`npx-work-registry-401`). Read it once.
A lesson whose key is already there **came back**: propose it one rung higher than last time.

## 4. Propose, then stop

One numbered list, one line each:

```
<n>. <target file> - add|update|delete|fix - <the change in a few words>  [rung N]
```

Then the net size: `+<lines> / -<lines>`. Wait for the owner. They answer once: "ok", or "drop 2, 5".
Optional items (a redeploy, a new skill, a new hook) are listed like any other and done only if approved.

## 5. Apply

- Keep a SKILL.md under about 150 lines; move detail to its `references/`.
- A skill that did not trigger: fix its description (when to use, never the steps; under 500 chars).
- Bump an edited skill's `metadata.version` (patch for facts, minor for new steps).
- Append one ledger line per applied lesson.
- Commit as the calling skill says. Report: what changed where, and the net `+/-` lines.
