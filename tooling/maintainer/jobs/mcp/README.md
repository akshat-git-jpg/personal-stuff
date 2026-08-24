# MCP job

Checks the machine-local MCP configuration for four kinds of drift:

1. Servers in `.mcp.json` that `scripts/regen-mcp-json.sh` would drop.
2. Commands or entry point paths that do not exist.
3. Env files named by MCP server code that do not exist.
4. Configured servers missing from `tooling/mcp/README.md`.

Run it with `bash tooling/maintainer/bin/run-job.sh mcp`.

The fourth section is a review list. A server that appears unused is an `ask` for the
owner, never permission to remove it.
