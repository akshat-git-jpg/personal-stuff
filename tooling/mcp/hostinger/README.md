# hostinger (token home only)

Holds `.env` with the Hostinger API tokens (gitignored, `chmod 600`). The MCP server that
used to live here was deleted 2026-10-16; `pp-hostinger` (`../../cli/hostinger`) reads this
file, and `infra/escrow/escrow-backup.sh` backs it up. Keep the path stable for both.

Rotate: Hostinger panel → API → new token, replace it in `.env`, revoke the old one.
