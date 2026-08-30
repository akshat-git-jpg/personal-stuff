# hostinger

`pp-hostinger` CLI — manage Hostinger VPS, domains, DNS, firewall, snapshots and
billing from the command line (used by the `hostinger` Claude skill instead of an
MCP server). Entry point `pp-hostinger` (wraps `pp_hostinger.py`). Stdlib only.

## Two accounts

There are **two separate Hostinger logins**, each with its own API token. A token
only ever sees its own account, which is why `agrolloo.com` is invisible to the VPS
token (`GET /api/domains/v1/portfolio/agrolloo.com` answers *"Domain is not
registered at Hostinger"* even though `whois` names Hostinger as the registrar).

| `--account` | What lives there | Token key in `.env` |
|---|---|---|
| `vps` (default) | the KVM 2 VPS + its billing | `API_TOKEN_VPS`, or plain `API_TOKEN` |
| `web` | the web-hosting account — `agrolloo.com` is expected here | `API_TOKEN_WEB` |

```bash
pp-hostinger vps list                    # vps account (default — unchanged behaviour)
pp-hostinger --account web domains list  # the other account
```

`vps` is the default and plain `API_TOKEN` still resolves to it, so every existing
caller and the `hostinger` skill keep working untouched.

## Auth setup

Tokens live in `../../mcp/hostinger/.env` (gitignored, `chmod 600`), one line each:

```
API_TOKEN=<vps account token>        # the original key, still the vps alias
API_TOKEN_WEB=<web hosting token>
```

An environment variable of the same name wins over the file.

### Getting a token

Sign in to the account you want, then: **hPanel → account menu → API → generate
token**. The token is account-scoped — generate one per login. Rotating is the same
flow: create the new token, replace the line in `.env`, delete the old token.

## Commands

```
domains check NAME [--tlds com,net] [--alternatives]   availability
domains list                                           portfolio (owned domains)
vps list | info VM_ID | metrics VM_ID [--hours N]
vps start|stop|restart VM_ID
firewall list | info ID | add-rule ID … | sync ID VM_ID
snapshot get|create|restore VM_ID                      (create OVERWRITES)
dns list DOMAIN | dns update DOMAIN --records JSON|@file [--overwrite]
api METHOD /api/PATH [--body JSON|@file]               raw escape hatch
```

Useful raw calls (both accounts):

```bash
pp-hostinger --account web api GET /api/billing/v1/subscriptions    # what renews, and when
pp-hostinger --account web api GET /api/billing/v1/payment-methods  # the card on file
pp-hostinger --account web api GET /api/domains/v1/portfolio        # domains + expiry
```
