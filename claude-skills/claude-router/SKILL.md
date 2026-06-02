---
name: claude-router
description: Manage Claude Code skills and plugins in the user's dual-account setup (work + personal). Use this skill when the user asks to create, design, build, scaffold, or brainstorm a new custom skill from scratch (including naming, writing SKILL.md, choosing trigger phrases, validating frontmatter); install or add an existing skill or plugin from npx skills, GitHub, or a local folder; remove or uninstall a skill or plugin; install in both/work/personal; debug why a skill or plugin is not loading or not appearing in /skills or /plugins; fix /skills empty; run /plugin install; set up env vars for skills; or resolve npm 401 / CodeArtifact auth errors.
user-invocable: true
metadata:
  author: kbtg
  version: 3.0.0
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

### Skills are a single git-backed store, symlinked into both accounts

As of 2026-06-02 skills are **no longer copied** into each account. They live once in a
version-controlled store and are symlinked into each account's `skills/` dir. A symlinked
skill is indistinguishable from a real one — it appears in `/skills`, the slash/dropdown
menu, and auto-invokes on its description exactly like a local skill.

- **Store:** `/Users/kbtg/codebase/personal stuff/claude-skills/` (the only real copies; in git, private repo `akshat-git-jpg/personal-stuff`)
- **Relink script:** `claude-skills/relink.sh` — idempotent; (re)creates every symlink from the manifests. Run it after any membership change and on a new laptop.
- **Membership manifests** (`claude-skills/manifest/`, one skill name per line):
  - `work.txt`     → linked into `~/.claude-work/skills/` (sourced from the store)
  - `personal.txt` → linked into `~/.claude-personal/skills/` (sourced from the store)
  - `agents.txt`   → `pp-*` printing-press skills sourced from `~/.agents/skills/`, linked into **both** accounts

A name in **both** `work.txt` and `personal.txt` = shared; in **one** = exclusive to that account.
Because there is ONE physical file per skill, editing it (by you or by Claude) updates both
accounts at once — no copy, no sync, no drift.

Plugins live in `<account_dir>/plugins/` (Claude Code's installer manages this; per-account).

The user's npm registry points at AWS CodeArtifact (Zluri). Tokens expire ~12hr — see "npm auth issue" below.

> **CRITICAL — skill discovery is cached.** `claude -p "list skills"` does NOT reflect newly
> added / removed / relinked skills until a real interactive session relaunch (it can even
> show a stale/other-account list). **Never** trust `claude -p` to verify a skill change.
> Verify on the **filesystem** instead — does each account's `skills/<name>` resolve to a
> folder with a readable `SKILL.md`? — and tell the user to relaunch the session.

## Code folders → Claude account

| Folder | Claude account |
|---|---|
| `/Users/kbtg/codebase/TY` | `claude-personal` |
| `/Users/kbtg/codebase/personal stuff/` | `claude-personal` |
| `/Users/kbtg/codebase/IT` | `claude-personal` |
| `/Users/kbtg/codebase/personal projects/` | `claude-personal` |
| `/Users/kbtg/codebase/` (all other Zluri/work repos) | `claude-work` |

## Decision rule

Every install/remove operation has a **target scope**:

- **work** — only the work account → name in `manifest/work.txt`
- **personal** — only the personal account → name in `manifest/personal.txt`
- **both** — name in BOTH manifests (one physical skill, linked into each)

If the user doesn't say which scope, **ask**. One short question: *"Install in work, personal, or both?"* Don't guess.

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

3. Create the skill folder ONCE in the store:

   ```bash
   mkdir -p "/Users/kbtg/codebase/personal stuff/claude-skills/<name>"
   ```

4. Write `SKILL.md` (and optionally `references/`, `scripts/`, `assets/`) into the store folder, then add `<name>` to the chosen manifest(s) and relink:

   ```bash
   cd "/Users/kbtg/codebase/personal stuff/claude-skills"
   echo <name> >> manifest/work.txt        # if work
   echo <name> >> manifest/personal.txt    # if personal  (both => both lines)
   ./relink.sh
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

## Installing a skill

A skill = one folder containing `SKILL.md` + optional `references/`, `scripts/`, `assets/`.

### Procedure

1. Confirm target scope.
2. Identify the source. Three common ones:
   - `npx skills add <owner>/<repo>` from a public GitHub repo — see "npm auth" section below
   - A local folder the user provides
   - A SKILL.md the user pastes inline
3. Place the skill folder ONCE in the store `claude-skills/<skill-name>/`, add its name to the chosen manifest(s), and run `./relink.sh`.
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

After install completes, the skill lands at `~/.agents/skills/<skill-name>/`. Bring it into the store, add to manifest(s), and relink:
```bash
cp -R ~/.agents/skills/<skill-name> "/Users/kbtg/codebase/personal stuff/claude-skills/<skill-name>"
cd "/Users/kbtg/codebase/personal stuff/claude-skills"
echo <skill-name> >> manifest/work.txt       # and/or manifest/personal.txt
./relink.sh
```
Alternatively, `relink.sh` can auto-source a skill straight from `~/.agents/skills/` without
copying it into the store (this is how the `pp-*` skills work): just add the name to the
manifest(s) and run `./relink.sh` — don't copy. Use this for printing-press-managed skills so
they aren't duplicated. (Note: agents-sourced skills won't exist on a fresh laptop until
reinstalled, whereas store skills travel with the repo.)

### Source: user-provided folder or inline SKILL.md

Place files in the store at `claude-skills/<skill-name>/`, add the name to the chosen manifest(s), and run `./relink.sh`.

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

Delete the skill's name from the relevant manifest(s) and relink — `relink.sh` prunes the
now-unlisted symlink from that account (e.g. removing it from `personal.txt` only takes it
out of personal but keeps it in work):

```bash
cd "/Users/kbtg/codebase/personal stuff/claude-skills"
# edit manifest/work.txt and/or manifest/personal.txt to delete the line(s)
./relink.sh
```

To delete the skill **entirely**, also `rm -rf claude-skills/<skill-name>` and remove it from
both manifests. Tell the user to restart any running session.

## Removing a plugin

You can't `/plugin uninstall` from Bash. Tell the user:

*"In a `claude-<account>` session run `/plugin uninstall <plugin>@<marketplace>`. Repeat in the other account if you want it gone from both."*

## Verification

**Do NOT use `claude -p "list skills"` to verify — skill discovery is cached and headless
runs return stale or even wrong-account lists.** Verify on the **filesystem** instead:

```bash
# Resolves through the symlink to a readable SKILL.md = correctly installed.
ls -l ~/.claude-work/skills/<name>     && head -3 ~/.claude-work/skills/<name>/SKILL.md
ls -l ~/.claude-personal/skills/<name> && head -3 ~/.claude-personal/skills/<name>/SKILL.md
```

A skill is correctly installed when `<account>/skills/<name>/SKILL.md` is readable through the
symlink AND `<name>` is in that account's manifest. For plugins, check
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
| A skill silently vanished | Repo moved/renamed → symlink dangles | Rerun `claude-skills/relink.sh` |
| Skill present in wrong account | Manifest membership drifted | Fix `manifest/*.txt`, run `relink.sh` (it prunes) |
| `/reload-plugins` shows "0 plugins" | Plugin install state is read only at session start | Quit fully (`/quit` or Ctrl+D twice), relaunch |
| Plugin works in one account, not the other | Plugins are per-account | Run `/plugin install` separately in the other account |
| `npm error code E401` | CodeArtifact token expired | Use `npx --registry=https://registry.npmjs.org ...` |
| `sudo npx ...` | Don't | Run as normal user |

## Sample dialogues

### "Install valyu-best-practices in both"
1. Run `npx --registry=https://registry.npmjs.org skills add valyuAI/skills`. Tell user: select "Claude Code" in agent picker, choose "user scope".
2. After it lands at `~/.agents/skills/valyu-best-practices/`, copy it into the store once:
   ```bash
   cp -R ~/.agents/skills/valyu-best-practices "/Users/kbtg/codebase/personal stuff/claude-skills/"
   ```
3. Validate frontmatter in the store copy — strip `license`, `compatibility`; ensure `metadata.version: 1.0.0` unquoted; add `user-invocable: true`.
4. Add to both manifests and relink:
   ```bash
   cd "/Users/kbtg/codebase/personal stuff/claude-skills"
   echo valyu-best-practices >> manifest/work.txt
   echo valyu-best-practices >> manifest/personal.txt
   ./relink.sh
   ```
5. Remind user: skill needs `VALYU_API_KEY` in `~/.zshrc`. Add if missing.
6. Verify on the filesystem (symlink resolves to a readable SKILL.md in both accounts); tell user to restart sessions.

### "Install Superpowers plugin in personal only"
1. Tell user: *"In a `claude-personal` session run `/plugin install superpowers@claude-plugins-official`. Pick user scope. Then `/quit` and relaunch."*
2. (If marketplace not registered: prepend `/plugin marketplace add anthropics/claude-plugins-official`.)
3. After they confirm, verify: `CLAUDE_CONFIG_DIR=~/.claude-personal claude -p "list skills" | grep superpowers`. Should list 13+ `superpowers:*` skills.

### "Remove Superpowers from work"
Tell user: *"In a `claude-work` session run `/plugin uninstall superpowers@claude-plugins-official`, then `/quit` and relaunch."*

### "I want valyu only in personal"
Same as the "both" dialogue, but add `valyu-best-practices` to `manifest/personal.txt` only. Don't add it to `work.txt`.

## Maintaining this skill

`claude-router` now lives in the store at
`/Users/kbtg/codebase/personal stuff/claude-skills/claude-router/SKILL.md` and is symlinked
into BOTH accounts. **Edit that one file — both accounts update at once. No manual sync.**
(Run `claude-skills/relink.sh` only if the symlinks are missing.) Commit the change to the
`personal-stuff` repo. Bump `metadata.version` on non-trivial changes.

## Final checks before declaring done

After any install/remove operation:
1. Run the verification command (`CLAUDE_CONFIG_DIR=... claude -p "list skills" | grep <name>`).
2. Tell the user explicitly which sessions to restart and how (`/quit` → `claude-<account>`).
3. If env vars were added, tell the user to `source ~/.zshrc`.

Do NOT leave the user wondering whether it worked.
