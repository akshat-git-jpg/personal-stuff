# Hostinger MCP

Official Hostinger API MCP server wired into Claude Code, so Claude can manage
Hostinger infrastructure (VPS, domains, DNS, hosting, billing, email/Reach) on
your behalf when launching projects.

- Package: [`hostinger-api-mcp`](https://github.com/hostinger/api-mcp-server) (official, `hostinger` org)
- 118 tools across: VPS (62), Domains (18), Hosting (13), Reach (10), DNS (8), Billing (7)

## Files

| File | Purpose |
|------|---------|
| `.env` | Holds `API_TOKEN`. **Not committed** (see `.gitignore`). `chmod 600`. |
| `run.sh` | Loads `.env` and launches the unified MCP binary. Claude Code points here. |

## How it's registered

Registered as the MCP server **`hostinger`** at user scope:

```bash
claude mcp add hostinger -s user -- "/Users/kbtg/codebase/personal-stuff/hostinger mcp/run.sh"
```

The token lives only in `.env`; the launcher sources it at startup, so it's
never written into Claude's `~/.claude.json`.

## Rotating the token

1. Hostinger panel → account menu → **API** → generate a new token.
2. Replace the value in `.env`.
3. Revoke the old token in the panel.

No need to touch the MCP registration — it just re-reads `.env` on next launch.

## Narrowing scope (optional)

The full server exposes all 118 tools. To cut context bloat you can point
`run.sh` at a category-specific binary instead, e.g.:

- `hostinger-vps-mcp` (62) · `hostinger-domains-mcp` (18) · `hostinger-hosting-mcp` (13)
- `hostinger-dns-mcp` (8) · `hostinger-billing-mcp` (7) · `hostinger-reach-mcp` (10)
