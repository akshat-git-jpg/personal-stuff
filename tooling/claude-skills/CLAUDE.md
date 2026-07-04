# claude-skills/ — single source of truth for custom Claude Code skills

This folder holds all hand-authored Claude Code skills for BOTH accounts (work + personal),
symlinked into each account's config dir. One physical copy per skill → editing here updates
both accounts at once. **The authoritative playbook for creating/installing/removing skills is
the `claude-router` skill** (loads globally); this file is just local orientation.

- **Membership / split:** `manifest/work.txt` + `manifest/personal.txt` — in both = shared,
  in one = exclusive. `relink.sh` rebuilds the symlinks from these and prunes ones removed.
- **After any change:** run `./scripts/relink.sh` (at the repo root), then **restart** the
  affected session — skill discovery is cached, so `/skills` (and `claude -p`) won't reflect
  changes until relaunch.
- **Don't move/rename this folder** without rerunning `scripts/relink.sh` — symlinks would dangle.
- `pp-*` skills are auto-sourced from `~/.agents/skills/` (printing-press), not stored here.

Full how-to: see `README.md` in this folder.

### Skill Linking vs. skills-lock.json
- **Manifest + `relink.sh`**: Links local repo-owned skills into `~/.claude-work/skills` and `~/.claude-personal/skills`.
- **`skills-lock.json` + `npx skills`**: Installs external github-sourced hyperframes/GSAP skills.
- The two mechanisms are completely independent and neither reads or affects the other.
