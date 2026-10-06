# Sample dialogues

Worked examples for [../SKILL.md](../SKILL.md).

### "Install valyu-best-practices"

> Retired from this repo on 2026-08-25 (0 invocations ever; archived at
> `.claude/skills-archive/2026-08-25/valyu-best-practices/`). Kept here as the
> worked example for installing ANY `npx skills add` package.
1. Ask which repo it should fire in. "Both accounts" is no longer a thing; the account does not decide.
2. Run `npx --registry=https://registry.npmjs.org skills add valyuAI/skills`. Tell user: select "Claude Code" in agent picker, choose "user scope".
3. After it lands at `~/.agents/skills/valyu-best-practices/`, copy it into that repo:
   ```bash
   cp -R ~/.agents/skills/valyu-best-practices "/Users/kbtg/codebase/personal-stuff/.claude/skills/"
   ```
4. Check frontmatter in the copy: `metadata.version` unquoted semver; drop `user-invocable: false` if the user wants a slash command.
5. Remind user: skill needs `VALYU_API_KEY` in `~/.zshrc`. Add if missing.
6. Commit it (`commit-now`). Any account opening that repo now has it.

### "Install Superpowers plugin in personal only"
1. Tell user: *"In a `claude-personal` session run `/plugin install superpowers@claude-plugins-official`. Pick user scope. Then `/quit` and relaunch."*
2. (If marketplace not registered: prepend `/plugin marketplace add anthropics/claude-plugins-official`.)
3. After they confirm, verify on the filesystem: `grep -c superpowers ~/.claude-personal/plugins/installed_plugins.json` is non-zero, and `ls ~/.claude-personal/plugins/cache/*/superpowers*/*/skills/` lists 13+ skill folders.

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
