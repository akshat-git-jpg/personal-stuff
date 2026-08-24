# MCP maintenance runbook

## Purpose

The MCP job compares the machine-local configuration with the files that recreate and
document it. It reports drift but does not decide whether a configured server should stay.

`.mcp.json` is gitignored because it contains absolute paths. The generator is the tracked
source of truth, so drift between the two files is otherwise invisible until someone
regenerates the config.

## Procedure

1. Run `bash tooling/maintainer/bin/run-job.sh mcp`.
2. Read `tooling/maintainer/state/findings/<date>-mcp.md`.
3. Fix `DROPPED-BY-REGEN` findings in `scripts/regen-mcp-json.sh` before regenerating.
4. Verify missing commands, entry points, and env paths against the server that owns them.
5. Ask the owner about undocumented or apparently unused servers. Do not remove them from a
   grep result or reference count.

After the tracked generator is correct, `bash tooling/maintainer/jobs/mcp/fix.sh` regenerates
`.mcp.json` and runs the check again. The fix refuses to regenerate while any configured
server would be dropped. There is no force option.

## Worked example: generator and Cloudflare drift

The first run found five configured servers but only two in the generator. Regenerating at
that point would have removed `indian-railways`, `davinci-resolve`, and
`davinci-resolve-advanced`. The repair added all three entries to the generator before
touching `.mcp.json`.

The same audit found that the Cloudflare server still searched for `ty/.env` and `TY/.env`
after those directories were retired. Its env lookup now derives `pipelines/.env` from the
server file's location and keeps the existing shell and `.mcp.json` env fallback.

## Reading the result

- Exit 0 means the check found no generator, entry point, command, or env-path drift.
- Exit 1 means the check found one of those problems.
- Exit 2 means the check itself broke, such as invalid JSON. Do not treat it as clean.
- Documentation lines remain review output and do not change the exit code. Verify every
  reported path before proposing a change.
