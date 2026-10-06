# Vendored from upstream

- Source: https://github.com/mvanhorn/cli-printing-press, folder `skills/`
- Commit: `639a8b15dff725edd185d7f9b1d8d0b93fe85a95` (2026-10-04)
- Synced: 2026-10-06
- Skills: `printing-press`, `-amend`, `-import`, `-output-review`, `-polish`,
  `-publish`, `-reprint`, `-retro`, `-score`. `printing-press-catalog` was removed
  upstream and is archived in `.claude/skills-archive/2026-10-06/`.
- The previous copy was upstream `d7bf1bf2` (2026-05-27), unchanged except for the
  patches below.

## Local patches (re-apply after the next sync)

1. **AXI alignment.** `references/axi-alignment.md` (local file), an "AXI alignment"
   section near the end of `phases/10-generate.md`, and "Priority 9: AXI checklist" in
   `printing-press-polish/SKILL.md`.
2. **Flat references table.** "Supporting references" at the end of this skill's
   `SKILL.md` links every reference file directly.
3. **Cross-skill links.** `printing-press-amend` (SKILL.md, `references/pii-scrubbing.md`)
   and `printing-press-publish/SKILL.md` link to sibling skills with `../<skill>/...`.
   `references/fetch-docs.md` calls the helper by its path from the repo root.
4. **Descriptions under 500 chars** for `-amend`, `-polish` and `-reprint`.

## Send upstream

- Cross-skill paths (`skills/printing-press-retro/...`, "`references/secret-protection.md`
  in the printing-press skill") do not resolve when the skills are installed outside the
  upstream repo. Use `../<skill>/...` links.
- `SKILL.md` links only some references. The rest are reached only through a phase
  file, so an agent can preview only part of them. Add a flat references table.
- About 30 reference and phase files are over 100 lines and have no contents list.
- `printing-press-amend` description is 881 chars. `-reprint` (663) and `-polish` (513)
  are also long.
- `printing-press-publish/SKILL.md` is 1,901 lines in one file. Split it into
  per-step references.
