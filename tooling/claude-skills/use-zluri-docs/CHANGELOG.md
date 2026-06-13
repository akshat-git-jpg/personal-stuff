# Changelog

## [1.2.0] - 2026-05-07

### Added
- Step 5: Drill down into per-repo documentation for every repo listed in the module doc's Relevant Repositories table
- Local clone detection for each repo, with fallback to `gh` CLI for remote reading
- Branch confirmation when reading repos via `gh` CLI (no default branch assumptions)
- `gh` CLI setup instructions (PAT-based auth) when user doesn't have it configured
- Rule: read all per-repo docs before starting work on the task
- Rule: use files listed in documentation as the index for searching — grep within documented files instead of the entire repo
- Support for reading companion `.md` files before their corresponding code files (per AGENTS.md)
- New troubleshooting entries for repo clone not found, `gh` CLI auth, and missing per-repo docs

### Changed
- Example updated to show the full per-repo drill-down flow including `gh` CLI fallback and doc-guided file discovery

## [1.1.1] - 2026-05-06

### Fixed
- Removed top-level `version` field from frontmatter (spec violation — only `metadata.version` is allowed by the agentskills spec)

## [1.1.0] - 2026-04-30

### Changed
- Switched from GitHub API (`gh api`) to local clone reads using the Read tool
- Added `git checkout main && git pull` step to ensure docs are up to date
- Added user confirmation step before loading files

## [1.0.0] - 2026-04-25

### Added
- Initial release: load Zluri module docs from the zluri-docs GitHub repo via `gh api`
- Module alias table for common user phrases
- Troubleshooting guide
