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
| `.claude/skills/<name>/SKILL.md` | `~/.codex/skills/<name>/SKILL.md` |
| `pipelines/.claude/skills/<name>` | `~/.codex/skills/<name>` (already mirrored) |
| `.claude/settings.json` | `~/.codex/config.toml` — different format, not portable |
| `.claude/hooks/` | `~/.codex/hooks.json` |
| `~/.claude/CLAUDE.md` | `~/.codex/AGENTS.md` |
| a nested `CLAUDE.md` | the sibling nested `AGENTS.md`, else read the `CLAUDE.md` directly |

**Skills live in `$CODEX_HOME/skills` (default `~/.codex/skills`), NOT in the
repo.** Codex 0.149 discovers skills only there and inside installed plugins;
its own help says "Installs into `$CODEX_HOME/skills/<skill-name>`". In this
version `.agents/` is the **plugin** root (`~/.agents/plugins/marketplace.json`)
and `.agents/skills/` is read by nothing — a mirror was briefly built there in
error and removed the same day (decisions.md 2026-08-24).

`~/.codex/skills/` holds **symlinks** into this repo's `.claude/skills/` and
`pipelines/.claude/skills/`. One copy of every skill on disk. Edit the real file
under `.claude/skills/` — never the link.

`scripts/relink.sh` rebuilds that mirror (via
`scripts/mirror-codex-skills.sh`). Run it after adding, renaming, or deleting
any skill.

**Codex skills are not slash commands.** Claude exposes a skill as
`/<skill-name>`; Codex injects a name-and-description list the model reads with
`skills.read`. Ask for one in plain language — `/yt-video-edit` will never
autocomplete.

Two consequences of that mirror being **global**: these 35 skills load in every
project, including ZluriHQ work repos where several do not apply; and the links
point at `/Users/kbtg/codebase/personal-stuff`, so moving or deleting that
checkout breaks them.

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

Nothing Codex reads is committed — `~/.codex/skills` is built on each machine —
so the mirror must be generated after cloning, never assumed.

`git clone` on Windows without `core.symlinks` also writes the 12
`.claude/skills/` entries that point into `pipelines/` as plain TEXT FILES
holding their target path, which breaks those skills for **Claude** too.

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
