# personal-stuff — Codex adapter

This file exists so Codex loads the same project knowledge Claude Code uses.
It is an **adapter**, not a second copy of the rules.

## Read this first

**[CLAUDE.md](CLAUDE.md) is the single source of truth** for how to operate in
this repo: the "Find it fast" routing table, the workspace-claim rule, where new
things go, and the operating notes. Read it before doing anything here. Do not
duplicate its content into this file.

Also loaded by Claude and equally binding here: [decisions.md](decisions.md),
[INFRA.md](INFRA.md), [VPS-CRONS.md](VPS-CRONS.md),
[my-hosted-sites.md](my-hosted-sites.md).

## Path translation (Codex vs Claude)

`CLAUDE.md` names Claude-side paths. Translate them as follows.

| CLAUDE.md says | In Codex, use |
|---|---|
| `.claude/skills/<name>/SKILL.md` | `.agents/skills/<name>/SKILL.md` |
| `pipelines/.claude/skills/<name>` | `.agents/skills/<name>` (already mirrored) |
| `.claude/settings.json` | `.codex/config.toml` — different format, not portable |
| `.claude/hooks/` | `.agents/hooks/` + `.agents/hooks.json` |
| `~/.claude/CLAUDE.md` | `~/.codex/AGENTS.md` |
| a nested `CLAUDE.md` | the sibling nested `AGENTS.md`, else read the `CLAUDE.md` directly |

`.agents/skills/` holds **symlinks** into `.claude/skills/` and
`pipelines/.claude/skills/`. There is one copy of every skill on disk. Edit the
real file under `.claude/skills/` or `pipelines/.claude/skills/` — never the
symlink path.

`scripts/relink.sh` rebuilds the `.agents/skills/` mirror. Run it after adding,
renaming, or deleting any skill.

## What does NOT carry over

- **Hooks.** Claude's hooks in `.claude/settings.json` (rtk rewriting, `dcg`,
  the no-history-in-main guard, the dirty-main Stop nag) do not run under Codex.
  The `.claude/hooks/no-history-in-main.sh` guard is Claude-only, so **nothing
  stops Codex from recording git history in the main checkout.** Claim a
  workspace by hand: `cd "$(pp-work claim --kind code --slug <task>)"`.
- **Sub-agents.** This repo defines none (`.claude/agents/` does not exist), so
  `.codex/agents/` is empty by design.
- **MCP servers.** Claude's are configured per-account outside this repo. Add
  any Codex needs under `[mcp_servers]` in `.codex/config.toml`.
- **Skill frontmatter.** Skills are written for Claude. A skill that calls a
  Claude-only tool by name, or relies on a hook, needs judgement under Codex.

## On Windows, run the mirror after cloning

`.agents/skills/` is committed as 35 **symlinks**. `git clone` on Windows without
`core.symlinks` writes each one as a plain TEXT FILE holding its target path, so
Codex finds no `SKILL.md` and the mirror is silently dead. Same for the 12
`.claude/skills/` entries that point into `pipelines/`, which breaks Claude there
too.

In Git Bash, from the repo root:

```bash
git config core.symlinks true && git checkout -- .   # if the clone already degraded them
bash scripts/relink.sh                               # rebuilds Claude skills AND this mirror
```

Re-run `scripts/relink.sh` after any skill is added, renamed, or deleted.

Without admin or Developer Mode, MSYS `ln -s` makes an NTFS **junction** rather
than a symlink. That reads fine, and `scripts/mirror-codex-skills.sh` detects it
(`[ -L ]` alone does not — decisions.md 2026-08-11). Verify with
`bash scripts/test-mirror-codex-skills.sh`.

Note that the rest of this repo's tooling is macOS-only: `pp-work`, `dcg`, `rtk`,
the VPS access and the secrets escrow do not run on Windows. Skills and knowledge
travel; the tooling does not.

## Local overrides

`AGENTS.override.md` overrides this file without editing it. It is gitignored.
