---
name: claude-router
description: Manages Claude Code skills and plugins in the dual-account setup (work + personal) where skills are repo-scoped. Covers creating or scaffolding a skill (naming, SKILL.md, triggers, frontmatter), installing or removing a skill or plugin (npx skills, GitHub, local folder), a skill or plugin not loading or /skills empty, /plugin install, env vars for skills, and npm 401 / CodeArtifact auth errors.
user-invocable: true
metadata:
  author: kbtg
  version: 3.3.0
---

# Claude Code Config Router

Playbook for skills and plugins in this user's two-account setup. Follow it end to end. Do not ask for setup details that are written here.

References:
- [references/authoring.md](references/authoring.md): read when writing or editing a skill's frontmatter or description.
- [references/npm-and-plugins.md](references/npm-and-plugins.md): read for `npx skills add`, plugin install or remove, env vars, or an npm E401.
- [references/examples.md](references/examples.md): read for worked dialogues of common asks.

## Setup

| Account | Config dir | Launch command | Use it in |
|---|---|---|---|
| Work | `/Users/kbtg/.claude-work` | `claude-work` (`claude` is aliased to it) | every other `/Users/kbtg/codebase/` repo (Zluri) |
| Personal | `/Users/kbtg/.claude-personal` | `claude-personal` | `personal-stuff/`, `IT/`, `personal projects/` under `/Users/kbtg/codebase/` |

- The launchers are shell functions in `~/.zshrc` that set `CLAUDE_CONFIG_DIR` from `$CLAUDE_WORK_CONFIG_DIR` / `$CLAUDE_PERSONAL_CONFIG_DIR`.
- Each account has its own plugins, auth, history, MCP and settings. The account decides login, billing and the git identity `github-router` picks. It does **not** decide which skills load.
- **Plugins are not shared.** Each account runs its own `/plugin install`. Symlinked or path-rewritten plugin state proved unreliable.
- To read or install the other account's plugins, run `env CLAUDE_CONFIG_DIR=<dir> claude plugin ...` and confirm in `<dir>/plugins/installed_plugins.json`. A bare `CLAUDE_CONFIG_DIR=<dir> claude` prefix hits the alias and shows this account (debugging playbook #5).
- npm points at AWS CodeArtifact (Zluri). Tokens expire after about 12 hours. Fix: [references/npm-and-plugins.md](references/npm-and-plugins.md).

## Skills are repo-scoped

Claude Code reads `<repo>/.claude/skills/` for whoever opens the repo. That is the whole mechanism: no install, no symlink, no manifest, no account check. Owner's test: *"if my sister uses her own Claude account in personal-stuff, all the skills should work."*

Full model and the four-question test: `personal-stuff/tooling/maintainer/jobs/skills/runbook.md` sections 1-4. Never recreate a global skill store: `scripts/check-repo-hygiene.sh` fails if `tooling/claude-skills/` exists.

Three machine-local things the repo cannot carry, all handled by `personal-stuff/scripts/relink.sh`:

1. **Codex has no per-repo skill path.** It reads only `$CODEX_HOME/skills`. `.claude/codex-skills.txt` lists the few skills worth loading in every Codex session; `scripts/mirror-codex-skills.sh` symlinks exactly those. Adding a name there is the one "make this global" lever. Use it sparingly.
2. **The private `work-skills` plugin** (`~/codebase/work-skills`, GitHub `akshat-git-jpg/work-skills`, PRIVATE). It holds the Zluri skills, which must not sit in the PUBLIC personal-stuff repo. It also holds four person-level skills duplicated on purpose: `claude-router`, `github-router`, `humanizer`, `i-have-adhd`. A symlink cannot span a public and a private repo without a dead link in one clone, so there are two real copies. **personal-stuff is the source; `work-skills` is always the copy.** `scripts/sync-shared-skills.sh` copies across (`--check` exits 1 on drift). Drift is also caught by the hygiene gate at commit time and the daily `com.kushal.skills-sync` launchd job, which syncs, commits and pushes the plugin.
3. The push gate and the shared memory store (not skill related; see `relink.sh`).

Install the private plugin **local scope**, inside the work repo you use, so nothing is committed to a shared ZluriHQ repo:

```bash
cd /Users/kbtg/codebase/dashboard-api
claude plugin marketplace add /Users/kbtg/codebase/work-skills   # once per machine
claude plugin install work-skills@work-skills --scope local      # writes .claude/settings.local.json (gitignored)
```

## Decision rule: where does the skill fire?

Put it at the smallest scope that covers where it fires:

| Fires in | Put the folder in |
|---|---|
| personal-stuff generally | `personal-stuff/.claude/skills/<name>/` (any account) |
| pipelines work only | `personal-stuff/pipelines/.claude/skills/<name>/` (symlinked up, so a root session sees it too) |
| Zluri work | `~/codebase/work-skills/skills/<name>/` (loads in ZluriHQ repos where the plugin is installed local scope) |
| every Codex session too | also add the name to `personal-stuff/.claude/codex-skills.txt` |

If unclear, **ask** one short question: *"Which repo do you want this in?"* Do not guess, and do not pick a global answer because it is easier. Never commit a personal skill into a shared ZluriHQ repo.

## Creating a new skill

**Phase 1: brainstorm. Write no files yet.** Ask short questions:

1. What should it do? One sentence.
2. When should it trigger? 3-5 example phrases.
3. Name? Suggest a kebab-case option; the user can override.
4. Single SKILL.md, or does it need `scripts/`, `references/`, `assets/`? Default: single SKILL.md.
5. Which repo should it fire in, and Codex-global or not? Always ask (Decision rule).
6. Any env vars or API keys?

Push back on vague asks ("a skill to help with code review"): what style, what triggers, what output. Vague descriptions auto-trigger unreliably. Draft the description with trigger phrases and read it back to the user.

**Phase 2: write it**, once the user confirms name, description, scope and content:

1. Frontmatter: `name` (equal to the folder), `description` (what + when, with trigger phrases), `user-invocable: true`, `metadata.author: kbtg`, `metadata.version: 1.0.0`. Rules and budget: [references/authoring.md](references/authoring.md).
2. Body: imperative, concrete, structured (headers, lists, tables). At least one example for a non-trivial skill. Under ~500 lines; move longer material to `references/`.
3. `mkdir -p` the folder in the right repo (Decision rule) and write `SKILL.md` plus any extras. **The folder is the whole registration, for every account.** Optional extras only:
   ```bash
   # only if Codex should carry it in every project:
   echo <name> >> /Users/kbtg/codebase/personal-stuff/.claude/codex-skills.txt
   /Users/kbtg/codebase/personal-stuff/scripts/relink.sh
   # only if it is one of the four shared skills:
   /Users/kbtg/codebase/personal-stuff/scripts/sync-shared-skills.sh
   ```
4. Check the frontmatter (exact key spelling; no `user-invocable: false` unless intended).
5. Verify on the filesystem (below). Nothing to restart.

## Installing a skill

A skill is one folder: `SKILL.md` plus optional `references/`, `scripts/`, `assets/`.

1. Confirm which repo it fires in (Decision rule).
2. Source: `npx skills add <owner>/<repo>` (procedure in [references/npm-and-plugins.md](references/npm-and-plugins.md)), a local folder, or a SKILL.md pasted inline.
3. Put the folder at `.claude/skills/<name>/` (or `pipelines/.claude/skills/<name>/`) and commit. Nothing else to register.
4. Check the frontmatter, then verify on the filesystem.

Plugins install per account via `/plugin install` or `claude plugin install`: see [references/npm-and-plugins.md](references/npm-and-plugins.md).

## Removing a skill

Delete the folder and commit. No manifest, no account to unlink:

```bash
cd "$(pp-work claim --kind code --slug drop-<skill-name>)"
git rm -r .claude/skills/<skill-name>
```

Only if they apply:
- It was in `codex-skills.txt`: drop the line, run `scripts/relink.sh` (it prunes the stale link).
- It was a shared skill: remove it from `SHARED` in `scripts/sync-shared-skills.sh`, then delete the copy in `work-skills` by hand.

## Verification

**Never verify with headless `claude -p "list skills"`.** It can return a stale or wrong-account list. Check the filesystem:

```bash
head -5 /Users/kbtg/codebase/personal-stuff/.claude/skills/<name>/SKILL.md
/Users/kbtg/codebase/personal-stuff/scripts/skills-status.sh   # where everything loads, plus Codex mirror and plugin
```

- A skill is installed when `<repo>/.claude/skills/<name>/SKILL.md` is readable and its frontmatter opens and closes with `---`. That is all, for every account.
- A plugin is installed when `<account_dir>/plugins/installed_plugins.json` lists it.
- **Reload (docs, 2026-10-06):** Claude Code watches `~/.claude/skills/`, the project `.claude/skills/` and `--add-dir` skill dirs, and picks up an add, edit or remove in the live session, except in bare mode. A top-level skills dir created after the session started needs `/reload-skills`. If a change still does not show (for example a `pipelines/` skill reached through a symlink), run `/reload-skills` or relaunch.

## Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Skill in folder but `/skills` does not list it | Misnamed folder or file (`skill.md`), unclosed `---` block, or a new top-level skills dir | Fix the name or block; `/reload-skills` |
| Skill missing from `/` autocomplete | `user-invocable: false` | Remove it (default is `true`) |
| Skill changes not reflected | Bare/headless run, or a symlinked dir the watcher missed | `/reload-skills` or relaunch `claude-<account>` |
| Skill loads in one repo, not another | Skills are repo-scoped | Put it in the repo where it fires |
| `/reload-plugins` shows "0 plugins" | Plugin state is read only at session start | Quit fully (`/quit` or Ctrl+D twice), relaunch |
| Plugin works in one account, not the other | Plugins are per account | Install separately in the other account |
| `npm error code E401` | CodeArtifact token expired | `npx --registry=https://registry.npmjs.org ...` |
| `sudo npx ...` | Never | Run as the normal user |

## Maintaining this skill

Source: `/Users/kbtg/codebase/personal-stuff/.claude/skills/claude-router/`. It is a shared skill, so edit it there, never the `work-skills` copy, then run `scripts/sync-shared-skills.sh` (or let the hygiene gate or daily job catch it). Commit to personal-stuff and bump `metadata.version` on non-trivial changes.

## Final checks before declaring done

After any install or remove:
1. Verify on the filesystem: `SKILL.md` readable (or gone); for a plugin, `installed_plugins.json` lists it. Never via `claude -p`.
2. Tell the user exactly what to reload: nothing for a skill edit in a live session, `/reload-skills` for a new top-level skills dir, a full relaunch (`/quit`, then `claude-<account>`) for a plugin.
3. If env vars were added, tell the user to `source ~/.zshrc`.

Do not leave the user wondering whether it worked.
