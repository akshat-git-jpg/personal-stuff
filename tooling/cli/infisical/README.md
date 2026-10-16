# pp-secrets (Infisical)

One place for every gitignored secret file in this repo. Add or change a secret once, and every
machine (the owner's Mac, his sister's Windows PC) gets it on its next Claude session.

- **Store:** Infisical Cloud, org `Agrolloo`, project `personal-stuff`, environment `prod`.
  Owner login: `akshatpatidar17@gmail.com` (GitHub sign-in) at https://app.infisical.com.
- **Which files:** [`secrets.map.json`](secrets.map.json). Each `.env`-style file is one Infisical
  folder with one secret per key. Each other file (JSON, `.txt`, `.md`) is one folder with a single
  `FILE_CONTENT` secret. The folder name is the file path with every `.` and `@` turned into `_`.
- **Auto-pull:** a `SessionStart` hook in `.claude/settings.json` runs `pull --quiet` on every
  session. With no login on the machine it does nothing; a network error never blocks a session.
- **Runtime:** plain `node` (20+), no npm install, same on macOS and Windows.

## Commands

```
node tooling/cli/infisical/pp-secrets.mjs setup <login.json>   # one time per machine
node tooling/cli/infisical/pp-secrets.mjs pull                 # write every file from Infisical
node tooling/cli/infisical/pp-secrets.mjs status               # what pull would change; changes nothing
node tooling/cli/infisical/pp-secrets.mjs push [path...]       # upload local files (all if no path)
```

Exit codes: 0 ok, 1 error, 2 usage, 3 push conflict.

## Add a secret

- **New key in a file that is already mapped:** add it in the Infisical web UI, in that file's folder.
  Or edit the local file and run `push <path>`.
- **A whole new secret file:** add one line to `secrets.map.json` (commit it), then `push <path>`.

## How pull decides (so nothing is lost)

- File missing on this machine: written.
- Local value still equals what this machine last synced: replaced with the Infisical value.
- Local value was edited since the last sync: **kept**, and pull prints `kept ... run push`.
- First pull on a machine with old hand-copied files: Infisical wins, and the old file is copied to
  `~/.config/pp-secrets/backup/<time>/` first.
- `push` never deletes a key in Infisical, and refuses (exit 3) to overwrite a value someone changed
  in the web UI since this machine last synced. `--force` overrides.

Secrets always land in the **main checkout** (resolved via `git rev-parse --git-common-dir`), never in
a `pp-work` workspace. `.env` comments and order are kept locally; Infisical stores values unquoted.

## Machine-local files (never in git)

- `~/.config/pp-secrets/infisical.json`: this machine's login (Client ID + its own Client Secret).
- `~/.config/pp-secrets/state.json`: hashes of what was last synced, used for the rules above.

One machine identity, `personal-stuff-machines` (role `member` on the project), with **one Client Secret
per machine** (`owner-mac`, `sister-windows`). A lost machine: delete only its Client Secret in
Infisical (Organization > Access Control > Identities > personal-stuff-machines > Universal Auth).

## Staying on the free plan (owner rule: never pay)

Free plan limits as of 2026-10-16: 5 identities (users + machine identities), 3 environments per
project, unlimited projects and secrets. In use: 1 user + 1 machine identity, 1 environment.

- Add machines as new **Client Secrets** on the existing identity, never as new identities.
- Never start a trial, add a card, or turn on secret syncs, integrations, rotation or extra environments.
- If Infisical ever ends the free plan: the core is MIT open source and self-hostable for $0, and
  the escrow (`infra/escrow/`) still holds an offline copy of every file.

## Not synced, on purpose

- `infra/secrets/telegram-user.session`: a full login to the owner's Telegram account.
- `infra/secrets/heygen-web-curls.txt.bak`, `infra/secrets/heygen-usage-last.json`: a backup and a ledger, not secrets.
- VPS-side secrets (`/srv/crons/*/.env`, `/root/.claude-rc.env`): still copied by hand, see `VPS-CRONS.md`.
- Cloudflare Worker prod secrets: still `wrangler secret put` per app.
