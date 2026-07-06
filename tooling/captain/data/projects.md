# Known projects

Path, default lane, and the verify command a crewmate should run before
calling a ship task done. The captain knows these at birth; new rows get
added by the captain (or the owner) as new projects come up. Registry is
data, not code — adding a project never touches `bin/` or `lanes.d/`.

| Project | Path | Default lane | Test command |
|---|---|---|---|
| personal-stuff | `/Users/kbtg/codebase/personal-stuff` | claude-tmux | `./scripts/check-apps.sh` |
| printing-press library | `~/printing-press/library/*` | claude-headless | per-CLI `test-*.sh` (see the CLI's own README) |
