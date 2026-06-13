# Changelog

## 1.0.0 — 2026-04-06

- Initial release
- Discovers and removes git worktrees by branch name across multiple Zluri repos
- Checks for uncommitted changes before removal with force-remove option
- Cleans up associated Cursor `.code-workspace` file if present
- Memory-based parent folder caching (agent-agnostic)
- Generic path examples
