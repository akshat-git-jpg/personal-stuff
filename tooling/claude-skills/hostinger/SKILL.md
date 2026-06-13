---
name: hostinger
description: Manage Hostinger VPS, domains, DNS, firewall, and snapshots via the pp-hostinger CLI (no MCP needed). Use whenever a task involves checking domain availability, the Hostinger VPS (state, metrics, restart), firewall rules, snapshots, or Hostinger DNS. Triggers on "is this domain available", "check domain", "vps status", "restart the vps", "vps metrics", "firewall rule", "hostinger".
---

# Hostinger via pp-hostinger

All Hostinger work goes through the `pp-hostinger` CLI — do NOT look for a hostinger MCP server (it was removed to save ~18k context tokens/session).

```
CLI: "/Users/kbtg/codebase/personal-stuff/tooling/cli/hostinger/pp-hostinger"
```

Auth is automatic (Bearer `API_TOKEN` from `mcp/hostinger/.env`). The main VPS is `1377177` (srv1377177.hstgr.cloud / hostinger-vps).

## Commands

```bash
pp-hostinger domains check NAME [--tlds com,net] [--alternatives]   # rate limit 10/min
pp-hostinger domains list                       # owned portfolio
pp-hostinger vps list                           # id, hostname, state, ip, plan
pp-hostinger vps info VM_ID
pp-hostinger vps metrics VM_ID [--hours 24]
pp-hostinger vps start|stop|restart VM_ID       # confirm with user before stop/restart
pp-hostinger firewall list
pp-hostinger firewall info FIREWALL_ID
pp-hostinger firewall add-rule FIREWALL_ID --protocol TCP --port 443 [--source custom --source-detail IP]
pp-hostinger firewall sync FIREWALL_ID VM_ID
pp-hostinger snapshot get|create|restore VM_ID  # create OVERWRITES the existing snapshot — confirm first
pp-hostinger dns list DOMAIN
pp-hostinger dns update DOMAIN --records JSON|@file [--overwrite]
pp-hostinger api METHOD /api/PATH [--body JSON] # raw escape hatch — full API surface
```

## Notes

- The `api` escape hatch reaches every endpoint the old MCP had (billing, hosting, reach, PTR, post-install scripts...): endpoint paths are documented at developers.hostinger.com. Confirm with the user before any non-GET escape-hatch call.
- `domains check` is the Pinterest brand-domain workflow (see `TY/pinterest/BRAND-SETUP.md`).
- Most DNS for live sites is on Cloudflare, not Hostinger — check which nameservers a domain uses before editing zones here.
