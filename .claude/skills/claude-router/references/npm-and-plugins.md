# npm sources, plugins, env vars

Detail for [../SKILL.md](../SKILL.md). Contents:
- Source: `npx skills add <owner>/<repo>`
- Installing a plugin
- Don't share plugin state across accounts
- Removing a plugin
- Environment variables for skills
- npm auth issue (CodeArtifact)

## Source: `npx skills add <owner>/<repo>`

Always run with the public registry to bypass CodeArtifact auth:
```bash
npx --registry=https://registry.npmjs.org skills add <owner>/<repo>
```

The installer is interactive. Tell the user:
1. At the agent picker, **Claude Code is NOT in the default selection**. They must scroll to "Claude Code (.claude/skills)", press Space to select, then Enter.
2. Pick **user scope** when asked.

After install completes, the skill lands at `~/.agents/skills/<skill-name>/`. That folder is
a shelf, not a load point; nothing reads it directly. Copy the skill into the repo that
needs it and commit it:
```bash
cp -R ~/.agents/skills/<skill-name> "/Users/kbtg/codebase/personal-stuff/.claude/skills/<skill-name>"
# pipelines-only instead: .../personal-stuff/pipelines/.claude/skills/<skill-name>
```
Copy rather than symlink into `~/.agents/skills`: a link there is machine-local and dangles
on a fresh laptop until the skill is reinstalled, whereas a committed copy travels with the
repo and works for anyone who clones it. Re-run `npx skills add` when you want a newer
version, then copy over the folder again.

## Installing a plugin

Plugins are per-account (`<account_dir>/plugins/`, managed by Claude Code's installer).
Two ways in: `/plugin install` inside an interactive session, or the `claude plugin install`
CLI from a shell (used for the private plugin: `claude plugin install work-skills@work-skills --scope local`;
CLI reference: https://code.claude.com/docs/en/plugins/cli-reference). The CLI runs under
whichever `CLAUDE_CONFIG_DIR` is set, so prefix it per account.

1. Confirm the target account(s).
2. For each chosen account, give the user the exact commands, naming the terminal:

   *"In a `claude-<account>` session, run:*
   ```
   /plugin install <plugin>@<marketplace>
   ```
   *Pick **Install for you (user scope)**."*

3. If the marketplace isn't registered yet in that account, prepend:
   ```
   /plugin marketplace add <repo>
   ```
   (Anthropic's `claude-plugins-official` may auto-register on first session; check `<account_dir>/plugins/known_marketplaces.json`.)

4. After install: tell the user to **fully quit and re-launch** the session (`/quit`, then `claude-<account>`). `/reload-plugins` is not enough; installed-plugin state is read at session start only.

5. For both accounts, repeat steps 2-4 in the OTHER account. **Each account does its own install, no shortcuts.**

6. Verify: `<account_dir>/plugins/installed_plugins.json` lists it.

## Don't share plugin state across accounts

Even if the manifest looks valid, Claude Code's `/plugins` UI rejects symlinked or path-rewritten plugin installs. **Always run a fresh install per account.** It takes ~10 seconds.

## Removing a plugin

*"In a `claude-<account>` session run `/plugin uninstall <plugin>@<marketplace>` (or `claude plugin uninstall` from a shell under that account's `CLAUDE_CONFIG_DIR`). Repeat in the other account if you want it gone from both."*

## Environment variables for skills

Some skills need API keys at runtime. Always add to `~/.zshrc`:

```bash
export <VAR_NAME>="<value>"
```

After adding, the user must `source ~/.zshrc` or open a new terminal. Confirm with `echo $<VAR_NAME>`.

Don't create `.env` files in the project unless the skill explicitly loads dotenv.

## npm auth issue (CodeArtifact)

**Symptom:** `npm error code E401 - Unable to authenticate, your authentication token seems to be invalid` when running `npx skills add ...` or any `npx`/`npm install`.

**Cause:** the user's `~/.npmrc` points at AWS CodeArtifact (Zluri's private registry). Tokens expire after ~12 hours.

**Fix for installing public packages (skills, plugins):** always prepend `--registry`:
```bash
npx --registry=https://registry.npmjs.org <command>
```

**Don't run `aws codeartifact login`** unless the user is doing actual Zluri development that needs `@zluri/*` packages; that's an interactive auth flow not needed for skill/plugin installs.

Never `sudo npx ...`; run as the normal user.
