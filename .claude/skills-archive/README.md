# skills-archive

Retired skills, kept recoverable. **Claude never loads these** — only
`.claude/skills/` is a load point, and this folder is deliberately not it.

Nothing here is deleted. To restore one: `git mv .claude/skills-archive/<date>/<name> .claude/skills/<name>`,
then re-run `scripts/relink.sh`.

| Date | Skill | Why | Invocations at retirement |
|---|---|---|---|
| 2026-08-25 | `plan-review` | on-command only, needed `npx lavish-axi` | 1 |
| 2026-08-25 | `roast` | 5-agent council, never used | 0 |
| 2026-08-25 | `research-critic` | superseded by the `improve` job's vetting phase | 0 |
| 2026-08-25 | `scout` | owner's call; overlaps `personal-stuff-research-methodology` | 1 |
| 2026-08-25 | `valyu-best-practices` | paid search API, never called, no repo code uses it | 0 |

## Retired but NOT archived — promoted instead

| Date | Skill | Now lives at |
|---|---|---|
| 2026-08-25 | `improve` | `tooling/maintainer/jobs/improve/` (maintainer job 11) |
| 2026-08-25 | `video-and-tts-reference` | `pipelines/video/CLAUDE.md` (folder operate-doc) |

Audit that produced this: `decisions.md`, 2026-08-25.
