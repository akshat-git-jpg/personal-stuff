# pp-secrets (Infisical)

Every personal secret file lives in Infisical and syncs both ways on its own: the owner's Mac, his
sister's Windows PC and the VPS. **Nobody copies a secret by hand, and Claude never asks the owner to.**
Create, edit or delete the file where it belongs; the next sync carries it everywhere.

- **Store:** Infisical Cloud, org `Agrolloo`, project `personal-stuff`, environment `prod`.
  Owner login: `akshatpatidar17@gmail.com` (GitHub sign-in) at https://app.infisical.com.
- **Runtime:** plain `node` (20+), no npm install. Same file on macOS, Windows and the VPS.

## When it runs (all automatic)

| Where | Trigger | Command |
|---|---|---|
| Mac, Windows | every Claude session start in this repo (`SessionStart` hook) | `sync --quiet` |
| Mac, Windows | end of every Claude turn (`Stop` hook), detached, logs to `~/.config/pp-secrets/sync.log` | `sync --background` |
| VPS | cron every 15 min at :07 (`vps-crons/crontab.txt`) | `sync --quiet` |

No login on a machine: the hooks do nothing. A network error never blocks a session.

## What is synced (found automatically, no list to keep)

- **Repos:** untracked files in `personal-stuff` and the personal repos listed in `OTHER_REPOS`
  (`IT`, `vps-crons`, `personal projects/mend-pilot`, as siblings of personal-stuff) whose name looks
  like a secret: `.env`, `*.env`, `.env.*`, `.dev.vars`, `*credentials*.json`, `token*.json`,
  `*secret*`, `tokens/*.json`, anything in `infra/secrets/`. A repo that is not cloned is skipped.
- **Home:** `~/.config/*-pp-cli/` and `~/.config/pp-trip/` files ending `.env`, `.toml` or `.json`.
- **VPS only:** `/srv/crons/*/.env` and `/root/.claude-rc.env`.
- **Never:** work or ZluriHQ repos; `*.example`, `*.bak`, `*.log`; `*.session`, because Telegram kills a
  session used from two machines at once (`telegram-user.session`); binary files.

The file list itself is in Infisical (`/_registry`, key `FILES`), so a new file needs no commit.
Each `.env`-style file is one folder with one secret per key (edit them in the web UI). Every other
file is one folder with a single `FILE_CONTENT` secret. Folder = the file id with `.` and `@` as `_`:
`repo:personal-stuff/apps/gym-app/.dev.vars` -> `/repo/personal-stuff/apps/gym-app/_dev_vars`.

## Commands

```
node tooling/cli/infisical/pp-secrets.mjs sync           # what the hooks run; prints each change
node tooling/cli/infisical/pp-secrets.mjs status         # what sync would do; changes nothing
node tooling/cli/infisical/pp-secrets.mjs remove <path>  # delete a secret file everywhere
node tooling/cli/infisical/pp-secrets.mjs setup <login.json>  # one time per machine
```

Exit codes: 0 ok, 1 error, 2 usage. `pull` and `push` are old names for `sync`.

## How sync decides (so nothing is lost)

Per key, against a hash of what this machine last synced (`~/.config/pp-secrets/state.json`):

- Only the local side changed: pushed. Only Infisical changed: pulled.
- Both changed: the newer one wins (file mtime vs Infisical `updatedAt`).
- A machine's first sync: Infisical wins (old hand-copied files lose).
- `remove` marks the file removed. Other machines delete their copy on their next sync, unless the
  file there was edited after the removal (then it comes back).
- Any local file sync overwrites or deletes is copied first to `~/.config/pp-secrets/backup/<time>/`.

Repo files always land in the **main checkout** (via `git rev-parse --git-common-dir`), never in a
`pp-work` workspace. `.env` comments and order are kept locally; Infisical stores values unquoted.

## Logins (never in git)

One machine identity, `personal-stuff-machines` (role `member` on the project), with **one Client Secret
per machine**: `owner-mac`, `sister-windows`, `vps`. Each machine keeps its own in
`~/.config/pp-secrets/infisical.json` (the VPS one has `"machine": "vps"`). A lost machine: delete only
its Client Secret (Organization > Access Control > Identities > personal-stuff-machines > Universal Auth).

## Staying on the free plan (owner rule: never pay)

Free plan limits as of 2026-10-16: 5 identities (users + machine identities), 3 environments per project,
unlimited projects and secrets, a request rate limit (sync waits and retries on HTTP 429). In use:
1 user + 1 machine identity, 1 environment.

- A new machine is a new **Client Secret** on the existing identity, never a new identity.
- Never start a trial, add a card, or turn on secret syncs, integrations, rotation or extra environments.
- If Infisical ever ends the free plan: the core is MIT open source and self-hostable for $0, and
  the escrow (`infra/escrow/`) still holds an offline copy.

## Not here

- Cloudflare Worker prod secrets: still `wrangler secret put` per app (Cloudflare cannot read them back).
- `/root/.claude/.credentials.json` on the VPS: a Claude login, machine-specific.
