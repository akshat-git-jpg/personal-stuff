---
name: claude-router
description: Manages Claude Code skills and plugins in the dual-account setup (work + personal) where skills are repo-scoped. Covers creating or scaffolding a skill (naming, SKILL.md, triggers, frontmatter), installing or removing a skill or plugin (npx skills, GitHub, local folder), a skill or plugin not loading or /skills empty, /plugin install, env vars for skills, and npm 401 / CodeArtifact auth errors.
user-invocable: true
metadata:
  author: kbtg
  version: 3.2.0
---

# Claude Code Config Router

Contents: User's setup · Which account to launch · Decision rule · Creating a new skill · Frontmatter · Installing a skill · Removing a skill · Verification · Common gotchas · Maintaining this skill · Final checks. Plugins, npm sources, env vars and the CodeArtifact fix: [references/npm-and-plugins.md](references/npm-and-plugins.md). Worked dialogues: [references/examples.md](references/examples.md).

Authoritative playbook for managing skills and plugins in this user's two-account Claude Code setup. Follow it end-to-end. Don't ask the user for setup details that are already documented here.

## User's setup

Two Claude Code "accounts" — work and personal — kept fully separate via per-account `CLAUDE_CONFIG_DIR`.

| Account | Config dir | Launch command |
|---|---|---|
| Work | `/Users/kbtg/.claude-work` | `claude-work` |
| Personal | `/Users/kbtg/.claude-personal` | `claude-personal` |

Aliases live in `~/.zshrc`:
```bash
claude-work()     { CLAUDE_CONFIG_DIR="$CLAUDE_WORK_CONFIG_DIR"     command claude "$@"; }
claude-personal() { CLAUDE_CONFIG_DIR="$CLAUDE_PERSONAL_CONFIG_DIR" command claude "$@"; }
```

Each account has independent plugins, auth, history, MCP, and settings. **Plugins are NOT shared** — they're per-account `/plugin install` (symlinking/path-rewriting plugin state proved unreliable).

### Skills are REPO-SCOPED — the account does not decide what loads

The full model, with counts and the four-question test, is
`tooling/maintainer/jobs/skills/runbook.md` §1-4. Never recreate a global skill store;
`check-repo-hygiene.sh` fails if `tooling/claude-skills/` reappears.

Claude Code reads **`<repo>/.claude/skills/`** automatically for whoever opens the repo.
That is the whole mechanism. No install, no symlink, no manifest, no account check. The
owner's test: *"if my sister uses her own Claude account in personal-stuff, all the
skills should work."*

| Skill belongs to… | Put the folder in | Loads |
|---|---|---|
| personal-stuff generally | `.claude/skills/<name>/` | any session in this repo, any account |
| pipelines work only | `pipelines/.claude/skills/<name>/` | pipelines sessions (symlinked up so a root session sees it too) |
| Zluri work | the private `work-skills` plugin (below) | ZluriHQ repos where it is installed local-scope |

**What survives, and why.** Three things the repo cannot carry on its own, all
machine-local, all handled by `scripts/relink.sh`:

1. **Codex has no per-repo skill path at all.** It reads only `$CODEX_HOME/skills`, which
   is global. `.claude/codex-skills.txt` lists the handful worth paying for in *every*
   Codex session; `mirror-codex-skills.sh` symlinks exactly those. Adding a name there is
   the one remaining "make this global" lever — use it sparingly.
2. **The private `work-skills` plugin** (`~/codebase/work-skills`, GitHub
   `akshat-git-jpg/work-skills`, PRIVATE). Holds the Zluri skills, which must not sit in
   this PUBLIC repo, plus five person-level skills duplicated on purpose:
   `claude-router`, `github-router`, `humanizer`, `i-have-adhd`, `session-handoff`. A
   symlink cannot span a public and a private repo without leaving a dead link in
   whichever one someone else clones, so two real copies plus
   `scripts/sync-shared-skills.sh` is the honest version. **This repo is the source;
   `work-skills` is always the copy.** Drift is caught by the hygiene gate at commit time
   and by the `com.kushal.skills-sync` launchd job daily.
3. The push gate and the shared memory store (unrelated to skills; see `relink.sh`).

Plugins live in `<account_dir>/plugins/` (Claude Code's installer manages this).
Install the private plugin **local scope**, inside the work repo you actually use, so it
stays repo-scoped and nothing is committed to a shared ZluriHQ repo:

```bash
cd /Users/kbtg/codebase/dashboard-api
claude plugin marketplace add /Users/kbtg/codebase/work-skills   # once per machine
claude plugin install work-skills@work-skills --scope local   # writes .claude/settings.local.json (gitignored)
```

The user's npm registry points at AWS CodeArtifact (Zluri). Tokens expire ~12hr; the fix is in [references/npm-and-plugins.md](references/npm-and-plugins.md).

> **Never verify a skill change with headless `claude -p`**: it can return a stale or
> wrong-account list. Check the **filesystem** (see Verification).

## Which account to launch

The account no longer changes which skills load. It still decides the login, the billing,
and the git identity `github-router` picks, so the folder rule stands:

| Folder | Claude account |
|---|---|
| `/Users/kbtg/codebase/personal-stuff/` | `claude-personal` |
| `/Users/kbtg/codebase/IT` | `claude-personal` |
| `/Users/kbtg/codebase/personal projects/` | `claude-personal` |
| `/Users/kbtg/codebase/` (all other Zluri/work repos) | `claude-work` |

## Decision rule

The question is no longer "which account?" but **"where does this skill fire?"** — put it
at the smallest scope that covers that:

- fires only in personal-stuff → `.claude/skills/`
- fires only in pipelines work → `pipelines/.claude/skills/`
- fires only at Zluri → the private `work-skills` plugin
- must fire in every Codex session too → also add the name to `.claude/codex-skills.txt`

If it is genuinely unclear, **ask**. One short question: *"Which repo do you want this in?"*
Don't guess, and don't reach for a global answer because it is easier.

## Creating a new skill from scratch

When the user wants to build a brand-new custom skill, follow this two-phase flow.

### Phase 1: Brainstorm with the user

Don't write any files yet. Ask short, focused questions:

1. **What should the skill do?** One sentence — its core job.
2. **When should it trigger?** What user prompts/intents should auto-invoke it? List 3-5 example phrases.
3. **What's the name?** Suggest a kebab-case option from the description; let the user override.
4. **Single SKILL.md, or does it need scripts/references/assets?** Default to single SKILL.md for simple skills.
5. **Which repo should it fire in?** personal-stuff, pipelines only, or Zluri (`work-skills` plugin); plus Codex-global or not (always ask; see "Decision rule").
6. **Any env vars or external API keys it'll need?** If yes, note them for the env section later.

If the description is vague (e.g., "a skill to help with code review"), push for specifics — what review style, what triggers, what output. Vague descriptions auto-trigger unreliably.

### Phase 2: Write the final skill

Once the user confirms name, description, scope, and content:

1. Construct `SKILL.md` content. Frontmatter (rules in "Frontmatter" below):

```yaml
---
name: <kebab-case-name>      # keep equal to the folder name
description: <plain string>  # what + when, with explicit trigger phrases
user-invocable: true         # repo convention; the default is already true
metadata:
  author: kbtg
  version: 1.0.0             # start at 1.0.0
---
```

2. Body: imperative, concrete, and structured (headers, lists, tables — Claude parses structure well). Include at least one example for non-trivial skills. Keep under ~500 lines; move reference material to `references/` if longer.

3. Create the skill folder in the repo it belongs to:

   ```bash
   mkdir -p "/Users/kbtg/codebase/personal-stuff/.claude/skills/<name>"
   # pipelines-only instead: .../personal-stuff/pipelines/.claude/skills/<name>
   ```

4. Write `SKILL.md` (and optionally `references/`, `scripts/`, `assets/`) into that folder.
   **That is the whole registration** — the folder IS the install, for every account. Only
   two optional extras:

   ```bash
   # ONLY if Codex should carry it in every project (it has no per-repo path):
   echo <name> >> /Users/kbtg/codebase/personal-stuff/.claude/codex-skills.txt
   /Users/kbtg/codebase/personal-stuff/scripts/relink.sh

   # ONLY if it is one of the five person-level skills shared with the private plugin:
   /Users/kbtg/codebase/personal-stuff/scripts/sync-shared-skills.sh
   ```

5. Check frontmatter against "Frontmatter" below (exact key spelling; no `user-invocable: false` unless intended).

6. Verify (see "Verification" section).

7. Nothing to restart: running sessions pick up the new folder (see Verification for when `/reload-skills` is needed).

### Description quality (critical for auto-trigger)

The `description` field decides when Claude auto-loads the skill. Bad descriptions → skill never triggers and the user has to call it explicitly each time. Good descriptions cover:

- **What** the skill does, in one phrase
- **When** to use it — list explicit trigger words/phrases the user is likely to say
- **Specificity** — broad enough to catch real prompts, narrow enough to avoid false matches

Bad: *"A code review skill."*
Good: *"Reviews staged git changes for security issues, missing tests, and breaking API changes. Triggers on 'review my changes', 'check this PR', 'look for security issues in this diff'."*

When brainstorming, draft the description WITH trigger phrases, then read it back to the user to confirm coverage.

**Description token budget:** every skill's description is loaded into EVERY session that can see it — prose beyond what + trigger phrases is a permanent token tax. Aim for ≤500 characters, hard cap ~700. Cut narrative detail (how it works internally, edge-case caveats) — that belongs in the body, which only loads on invocation. When editing any existing skill, trim its description to this budget in the same pass.

## Frontmatter (verified against https://code.claude.com/docs/en/skills, 2026-10-06)

Every field is optional; only `description` is recommended. Use this shape:

```yaml
---
name: <skill-name>           # kebab-case; defaults to the folder name, keep them equal
description: <plain string>  # what + when to trigger
metadata:
  author: <name>
  version: 1.0.0             # unquoted semver, nested under metadata
---
```

- **`user-invocable` defaults to `true`.** Omitting it still gives a `/name` command. Only
  `user-invocable: false` changes anything: it hides the skill from the `/` menu and blocks
  `/name`, while Claude can still auto-invoke it. This repo writes `user-invocable: true`
  explicitly by convention; it is harmless, not required.
- **Unknown keys are ignored, not rejected.** Claude Code "ignores a field it doesn't
  recognize without reporting an error" (docs). So `license`, `compatibility`, or a
  top-level `version` do not hide a skill here. A misspelled real key (e.g. `user_invocable`)
  is silently ignored too, so spell keys exactly, hyphens included.
- Strictness applies **outside** Claude Code: uploading to claude.ai, the Skills API, or
  `package_skill.py` fail hard on keys outside `allowed-tools, compatibility, description,
  license, metadata, name`. Keep frontmatter to those plus `user-invocable` if the skill
  might ship there.

## Installing a skill

A skill = one folder containing `SKILL.md` + optional `references/`, `scripts/`, `assets/`.

1. Confirm which repo it should fire in (Decision rule).
2. Identify the source: `npx skills add <owner>/<repo>` from a public GitHub repo (procedure in [references/npm-and-plugins.md](references/npm-and-plugins.md)), a local folder the user provides, or a SKILL.md pasted inline.
3. Place the skill folder in the repo that needs it: `.claude/skills/<skill-name>/`, or `pipelines/.claude/skills/<skill-name>/` if it is pipelines-only, and commit. Nothing else to register.
4. Check the frontmatter (above).
5. Verify on the filesystem (Verification).

Plugins install differently (per account, via `/plugin install` or `claude plugin install`): see [references/npm-and-plugins.md](references/npm-and-plugins.md).

## Removing a skill

Delete the folder and commit. There is no manifest to edit and no account to un-link:

```bash
cd "$(pp-work claim --kind code --slug drop-<skill-name>)"
git rm -r .claude/skills/<skill-name>
```

Two follow-ups, only if they apply:

```bash
# if it was in the Codex list, drop the line and re-mirror (relink prunes the stale link)
/Users/kbtg/codebase/personal-stuff/scripts/relink.sh

# if it was one of the five shared skills, remove it from SHARED in
# scripts/sync-shared-skills.sh too, then delete the copy in work-skills by hand
```

Interactive sessions pick the removal up live (see Verification); if it lingers, `/reload-skills` or relaunch.

## Verification

**Do NOT use `claude -p "list skills"` to verify.** Headless runs return stale or even
wrong-account lists. Verify on the **filesystem** instead:

```bash
test -r /Users/kbtg/codebase/personal-stuff/.claude/skills/<name>/SKILL.md && head -5 /Users/kbtg/codebase/personal-stuff/.claude/skills/<name>/SKILL.md
/Users/kbtg/codebase/personal-stuff/scripts/skills-status.sh    # where everything loads
```

A skill is correctly installed when `.claude/skills/<name>/SKILL.md` is readable and its
frontmatter block opens and closes with `---`: that is all, for every account.
`skills-status.sh` additionally reports the Codex mirror and the private plugin. For plugins,
check `<account_dir>/plugins/installed_plugins.json`.

**Reload behaviour (docs, 2026-10-06):** Claude Code watches `~/.claude/skills/`, the project
`.claude/skills/`, and `--add-dir` skills dirs, and picks up an add, edit, or remove within the
current session, except in bare mode. A top-level skills directory created after the session
started needs `/reload-skills`. If a change still does not show (for example a
`pipelines/.claude/skills/` skill reached through a symlink), run `/reload-skills` or relaunch.

## Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Skill in folder but `/skills` doesn't list it | Folder or file misnamed (`skill.md`), frontmatter block not closed, or a new top-level skills dir | Fix the name or the `---` block; `/reload-skills` |
| Skill missing from `/` autocomplete | `user-invocable: false` set | Remove it (default is `true`) |
| Skill changes not reflected | Bare/headless run, or a symlinked dir the watcher missed | `/reload-skills` or relaunch interactive `claude-<account>` |
| Skill loads in one repo but not another | Skills are repo-scoped | Put it in the repo where it should fire (Decision rule) |
| `/reload-plugins` shows "0 plugins" | Plugin install state is read only at session start | Quit fully (`/quit` or Ctrl+D twice), relaunch |
| Plugin works in one account, not the other | Plugins are per-account | Install separately in the other account |
| `npm error code E401` | CodeArtifact token expired | `npx --registry=https://registry.npmjs.org ...` |
| `sudo npx ...` | Don't | Run as normal user |

## Maintaining this skill

`claude-router` lives at
`/Users/kbtg/codebase/personal-stuff/.claude/skills/claude-router/SKILL.md`. It is one of the
five person-level skills **duplicated** into the private `work-skills` plugin, so after editing
it run `/Users/kbtg/codebase/personal-stuff/scripts/sync-shared-skills.sh` to carry the change
across — or let the hygiene gate / the daily `com.kushal.skills-sync` job catch it. Edit the
copy here, never the one in `work-skills`. Commit to `personal-stuff` and bump
`metadata.version` on non-trivial changes.

## Final checks before declaring done

After any install/remove operation:
1. Verify on the filesystem: `.claude/skills/<name>/SKILL.md` is readable (or gone, for a removal); for a plugin, `installed_plugins.json` lists it. Never via `claude -p`.
2. Tell the user explicitly what to reload: nothing for a skill edit in a live session, `/reload-skills` for a new top-level skills dir, a full relaunch (`/quit`, then `claude-<account>`) for a plugin.
3. If env vars were added, tell the user to `source ~/.zshrc`.

Do NOT leave the user wondering whether it worked.
