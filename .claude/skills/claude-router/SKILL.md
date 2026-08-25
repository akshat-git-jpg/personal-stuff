---
name: claude-router
description: Manage Claude Code skills and plugins in the dual-account setup (work + personal). Use when the user asks to create or scaffold a new custom skill (naming, SKILL.md, trigger phrases, frontmatter), install or remove a skill or plugin (npx skills, GitHub, local folder; scope both/work/personal), debug a skill or plugin not loading or /skills empty, run /plugin install, set env vars for skills, or fix npm 401 / CodeArtifact auth errors.
user-invocable: true
metadata:
  author: kbtg
  version: 3.1.0
---

# Claude Code Config Router

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

**Superseded 2026-08-25.** The old model (a global store in `tooling/claude-skills/`,
per-account manifests, symlinks into `~/.claude-work/skills` and
`~/.claude-personal/skills`) is gone. Do not recreate it; `check-repo-hygiene.sh` fails
if `tooling/claude-skills/` reappears.

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
claude plugin install work-skills@work-skills --scope local   # writes .claude/settings.local.json (gitignored)
```

The user's npm registry points at AWS CodeArtifact (Zluri). Tokens expire ~12hr — see "npm auth issue" below.

> **CRITICAL — skill discovery is cached.** `claude -p "list skills"` does NOT reflect a
> newly added, removed, or edited skill until a real interactive session relaunch (it can
> even show a stale list). **Never** trust `claude -p` to verify a skill change. Check the
> **filesystem** instead — does `.claude/skills/<name>/SKILL.md` exist and read cleanly? —
> and tell the user to relaunch the session.

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
5. **Target scope?** work / personal / both (always ask — see "Decision rule").
6. **Any env vars or external API keys it'll need?** If yes, note them for the env section later.

If the description is vague (e.g., "a skill to help with code review"), push for specifics — what review style, what triggers, what output. Vague descriptions auto-trigger unreliably.

### Phase 2: Write the final skill

Once the user confirms name, description, scope, and content:

1. Construct `SKILL.md` content. Frontmatter MUST follow these rules:

```yaml
---
name: <kebab-case-name>      # must match folder name
description: <plain string>  # what + when, with explicit trigger phrases
user-invocable: true         # required for /skills + dropdown
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

5. Validate frontmatter against the rules in "Frontmatter requirements" (next section). Strip any disallowed fields.

6. Verify (see "Verification" section).

7. Tell the user to restart any active `claude-<account>` sessions.

### Description quality (critical for auto-trigger)

The `description` field decides when Claude auto-loads the skill. Bad descriptions → skill never triggers and the user has to call it explicitly each time. Good descriptions cover:

- **What** the skill does, in one phrase
- **When** to use it — list explicit trigger words/phrases the user is likely to say
- **Specificity** — broad enough to catch real prompts, narrow enough to avoid false matches

Bad: *"A code review skill."*
Good: *"Reviews staged git changes for security issues, missing tests, and breaking API changes. Triggers on 'review my changes', 'check this PR', 'look for security issues in this diff'."*

When brainstorming, draft the description WITH trigger phrases, then read it back to the user to confirm coverage.

**Description token budget:** every linked skill's description is loaded into EVERY session of that account — prose beyond what + trigger phrases is a permanent token tax. Aim for ≤500 characters, hard cap ~700. Cut narrative detail (how it works internally, edge-case caveats) — that belongs in the body, which only loads on invocation. When editing any existing skill, trim its description to this budget in the same pass.

## Installing a skill

A skill = one folder containing `SKILL.md` + optional `references/`, `scripts/`, `assets/`.

### Procedure

1. Confirm target scope.
2. Identify the source. Three common ones:
   - `npx skills add <owner>/<repo>` from a public GitHub repo — see "npm auth" section below
   - A local folder the user provides
   - A SKILL.md the user pastes inline
3. Place the skill folder in the repo that needs it: `.claude/skills/<skill-name>/`, or `pipelines/.claude/skills/<skill-name>/` if it is pipelines-only. Nothing else to register.
4. Validate the SKILL.md frontmatter (see below). Fix it if invalid.
5. Verify on the filesystem (see "Verification" section).
6. Tell the user: *"Restart any running `claude-<account>` session — skills load only at session start."*

### Source: `npx skills add <owner>/<repo>`

Always run with the public registry to bypass CodeArtifact auth:
```bash
npx --registry=https://registry.npmjs.org skills add <owner>/<repo>
```

The installer is interactive. Tell the user:
1. At the agent picker, **Claude Code is NOT in the default selection**. They must scroll to "Claude Code (.claude/skills)", press Space to select, then Enter.
2. Pick **user scope** when asked.

After install completes, the skill lands at `~/.agents/skills/<skill-name>/`. That folder is
a shelf, not a load point — nothing reads it directly. Copy the skill into the repo that
needs it and commit it:
```bash
cp -R ~/.agents/skills/<skill-name> "/Users/kbtg/codebase/personal-stuff/.claude/skills/<skill-name>"
# pipelines-only instead: .../personal-stuff/pipelines/.claude/skills/<skill-name>
```
Copy rather than symlink into `~/.agents/skills`: a link there is machine-local and dangles
on a fresh laptop until the skill is reinstalled, whereas a committed copy travels with the
repo and works for anyone who clones it. Re-run `npx skills add` when you want a newer
version, then copy over the folder again.

### Source: user-provided folder or inline SKILL.md

Place the files at `.claude/skills/<skill-name>/` (or `pipelines/.claude/skills/<skill-name>/`)
and commit. Nothing else to register.

### Frontmatter requirements (Claude Code's parser is strict)

Required:
```yaml
---
name: <skill-name>           # kebab-case, must match folder name
description: <plain string>  # what + when to trigger
user-invocable: true         # required for /skills + dropdown visibility
---
```

Recommended:
```yaml
metadata:
  author: <name>
  version: 1.0.0             # MUST be valid semver, unquoted
```

**Strip these fields if present** — they cause silent rejection:
- `license`, `compatibility`, or any non-standard top-level key
- `version` at top level (must be nested under `metadata`)
- `version: "1.0"` (quoted, non-semver) → fix to `1.0.0`

## Installing a plugin

**Critical:** plugins must be installed via `/plugin install` interactively inside Claude Code. **You CANNOT install plugins from Bash.** Don't try.

### Procedure

1. Confirm target scope.
2. For each chosen account, give the user the exact commands to run, naming the terminal:

   *"In a `claude-<account>` session, run:*
   ```
   /plugin install <plugin>@<marketplace>
   ```
   *Pick **Install for you (user scope)**."*

3. If the marketplace isn't registered yet in that account, prepend:
   ```
   /plugin marketplace add <repo>
   ```
   (Anthropic's `claude-plugins-official` may auto-register on first session — check `<account_dir>/plugins/known_marketplaces.json`.)

4. After install: tell the user to **fully quit and re-launch** the session (`/quit`, then `claude-<account>`). `/reload-plugins` is not enough — installed-plugin state is read at session start only.

5. If scope is "both", repeat steps 2-4 in the OTHER account. **Each account does its own install — no shortcuts.** Past attempts at sharing plugin state via symlinks/sed-rewrites proved unreliable.

6. Verify (see "Verification").

### Don't try to share plugin state across accounts

Even if the manifest looks valid, Claude Code's `/plugins` UI rejects symlinked or path-rewritten plugin installs. **Always run a fresh `/plugin install` per account.** It only takes ~10 seconds.

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

Tell the user to restart any running session — discovery is cached.

## Removing a plugin

You can't `/plugin uninstall` from Bash. Tell the user:

*"In a `claude-<account>` session run `/plugin uninstall <plugin>@<marketplace>`. Repeat in the other account if you want it gone from both."*

## Verification

**Do NOT use `claude -p "list skills"` to verify — skill discovery is cached and headless
runs return stale or even wrong-account lists.** Verify on the **filesystem** instead:

```bash
# Resolves through the symlink to a readable SKILL.md = correctly installed.
head -3 /Users/kbtg/codebase/personal-stuff/.claude/skills/<name>/SKILL.md
/Users/kbtg/codebase/personal-stuff/scripts/skills-status.sh    # where everything loads
```

A skill is correctly installed when `.claude/skills/<name>/SKILL.md` is readable — that is
all, for every account. `skills-status.sh` additionally reports the Codex mirror, the private
plugin, and any stale account symlink left over from the old store. For plugins, check
`<account_dir>/plugins/installed_plugins.json`. Then tell the user to relaunch the session so
discovery refreshes — that interactive relaunch is the only authoritative `/skills` check.

## Environment variables for skills

Some skills need API keys at runtime (e.g. `VALYU_API_KEY`). Always add to `~/.zshrc`:

```bash
export <VAR_NAME>="<value>"
```

After adding, the user must `source ~/.zshrc` or open a new terminal. Confirm with `echo $<VAR_NAME>`.

Don't create `.env` files in the project unless the skill explicitly loads dotenv.

## npm auth issue (CodeArtifact)

**Symptom:** `npm error code E401 - Unable to authenticate, your authentication token seems to be invalid` when running `npx skills add ...` or any `npx`/`npm install`.

**Cause:** User's `~/.npmrc` points at AWS CodeArtifact (Zluri's private registry). Tokens expire after ~12 hours.

**Fix for installing public packages (skills, plugins):** always prepend `--registry`:
```bash
npx --registry=https://registry.npmjs.org <command>
```

**Don't run `aws codeartifact login`** unless the user is doing actual Zluri development that needs `@zluri/*` packages — that's an interactive auth flow not needed for skill/plugin installs.

## Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `/skills` shows "No skills found" | Skill in `~/.claude/skills/` but user runs `claude-work`/`claude-personal` (different config dir) | Add to store + manifest, run `relink.sh` |
| Skill in folder but `/skills` doesn't list it | Frontmatter has `license`/`compatibility`/`version: "1.0"`/top-level `version` | Strip non-standard keys; ensure `metadata.version: 1.0.0` |
| Skill not in `/` autocomplete | Missing `user-invocable: true` | Add it |
| Skill changes / new / removed skill not reflected | Session started before the change; headless `claude -p` is cached | Restart `claude-<account>` (interactive) |
| A skill silently vanished | Repo moved/renamed → symlink dangles | Rerun `scripts/relink.sh` |
| Skill present in wrong account | Manifest membership drifted | Fix `manifest/*.txt`, run `relink.sh` (it prunes) |
| `/reload-plugins` shows "0 plugins" | Plugin install state is read only at session start | Quit fully (`/quit` or Ctrl+D twice), relaunch |
| Plugin works in one account, not the other | Plugins are per-account | Run `/plugin install` separately in the other account |
| `npm error code E401` | CodeArtifact token expired | Use `npx --registry=https://registry.npmjs.org ...` |
| `sudo npx ...` | Don't | Run as normal user |

## Sample dialogues

### "Install valyu-best-practices"

> Retired from this repo on 2026-08-25 (0 invocations ever; archived at
> `.claude/skills-archive/2026-08-25/valyu-best-practices/`). Kept here as the
> worked example for installing ANY `npx skills add` package.
1. Ask which repo it should fire in. "Both accounts" is no longer a thing — the account does not decide.
2. Run `npx --registry=https://registry.npmjs.org skills add valyuAI/skills`. Tell user: select "Claude Code" in agent picker, choose "user scope".
3. After it lands at `~/.agents/skills/valyu-best-practices/`, copy it into that repo:
   ```bash
   cp -R ~/.agents/skills/valyu-best-practices "/Users/kbtg/codebase/personal-stuff/.claude/skills/"
   ```
4. Validate frontmatter in the copy — strip `license`, `compatibility`; ensure `metadata.version: 1.0.0` unquoted; add `user-invocable: true`.
5. Remind user: skill needs `VALYU_API_KEY` in `~/.zshrc`. Add if missing.
6. Commit it (`commit-now`), then tell the user to restart sessions. Any account opening that repo now has it.

### "Install Superpowers plugin in personal only"
1. Tell user: *"In a `claude-personal` session run `/plugin install superpowers@claude-plugins-official`. Pick user scope. Then `/quit` and relaunch."*
2. (If marketplace not registered: prepend `/plugin marketplace add anthropics/claude-plugins-official`.)
3. After they confirm, verify: `CLAUDE_CONFIG_DIR=~/.claude-personal claude -p "list skills" | grep superpowers`. Should list 13+ `superpowers:*` skills.

### "Remove Superpowers from work"
Tell user: *"In a `claude-work` session run `/plugin uninstall superpowers@claude-plugins-official`, then `/quit` and relaunch."*

### "I want valyu only when I'm doing video work"
Put it in `pipelines/.claude/skills/valyu-best-practices/` instead of `.claude/skills/`. It
then loads for pipelines sessions and not for a plain root-level one.

### "Make this skill available in my Zluri repos"
It goes in the private `work-skills` plugin, not this public repo. Add the folder to
`~/codebase/work-skills/skills/<name>/`, commit and push that repo, then in the ZluriHQ repo
you actually use: `claude plugin install work-skills@work-skills --scope local`. Never commit
a personal skill into a shared ZluriHQ repo.

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
1. Verify on the filesystem (`ls -l <account_dir>/skills/<name>` resolves to a readable SKILL.md) — never via `claude -p` (cached, unreliable).
2. Tell the user explicitly which sessions to restart and how (`/quit` → `claude-<account>`).
3. If env vars were added, tell the user to `source ~/.zshrc`.

Do NOT leave the user wondering whether it worked.
