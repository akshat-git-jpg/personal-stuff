---
name: close-session
description: Use when a personal-stuff (non-Zluri) session is ending - "close session", "wrap up", "end session", "before I clear", "/close-session" - or before /clear or /compact after a session that changed things or taught a lesson. Updates the docs the session made stale and turns Claude's mistakes and the owner's corrections into fixes (code, hook, skill, CLAUDE.md, memory), proposed first. Zluri work sessions use zluri-close-session.
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# close-session

Run [procedure.md](procedure.md) with the routing table and rules below.

## Routing table (personal-stuff)

One fact, one home. Take the first row that fits.

| The lesson or change is about | Home |
|---|---|
| Our own script, CLI, hook or mod behaved wrong | Fix the code itself (rung 1), in a `pp-work` workspace |
| A CLI or tool trap (flag, auth, registry, guard) | that tool's `README.md`/`CLAUDE.md`, or `personal-stuff-debugging-playbook` |
| How a skill behaves, or it did not trigger | that skill in `.claude/skills/` or `pipelines/.claude/skills/` |
| An app changed (feature, route, binding, deploy) | `apps/<name>/README.md` and `CLAUDE.md` |
| A new or changed live URL or Worker | `my-hosted-sites.md` and `INFRA.md`; ask about the kushal-tools hub card |
| A non-obvious decision or a load-bearing "why" | one dated line in `decisions.md` |
| Routing: a new tool or area Claude must find | the "Find it fast" table in root `CLAUDE.md` |
| A rule for every session, in every repo | the account's global `$CLAUDE_CONFIG_DIR/CLAUDE.md` (not in git) |
| Skills, CLIs or MCPs were added, removed or renamed | propose "update my-repo" as an item (redeploy only if approved) |
| Live work state (open branch, next step) | memory, per the policy in `MEMORY.md`: a scratch cache, promoted to the repo within a month |

## Rules

- Every repo edit goes in a `pp-work` workspace (`cd "$(pp-work claim --kind code --slug close-session)"`),
  then the `commit-now` flow, which lands it. Never edit the main checkout.
- `procedure.md` is shared with work-skills: after editing it, run `scripts/sync-shared-skills.sh`.
- Never write a secret value. Write where it lives (`personal-stuff-config-and-secrets`).
- No incident stories in skills. Keep the fact, drop the timeline; the story goes in `decisions.md` if anywhere.
