# Secrets escrow

One encrypted archive of every gitignored secret on this Mac, pushed offsite to Google
Drive. The Mac is otherwise the only copy of these files. Drive is offsite, so the escrow
survives **both** a Mac loss and a VPS loss, and turns the laptop-migration secrets step
into "restore one archive".

- **Script:** [`escrow-backup.sh`](escrow-backup.sh)
- **Encryption:** gpg symmetric, AES256. Ciphertext only ever leaves the machine.
- **Destination:** Drive folder `secrets-escrow` on `kushalbakliwal25@gmail.com` (personal).
- **Passphrase:** yours. Store it in the password manager. It is never written anywhere by
  the script — lose it and the archive is unrecoverable, which is the point.
- **Decision:** `decisions.md`, 2026-07-06.

## What's in the archive

Resolved dynamically at run time — only paths that exist are bundled. As of 2026-07-06:

| Bundled as | Source |
|---|---|
| `repo/pipelines/.env` | Python workspace (~21 keys) |
| `repo/pipelines/credentials.json` | Google service account |
| `repo/tooling/mcp/google-shared/credentials.json` + `tokens/` | OAuth client + 5 account tokens |
| `repo/infra/secrets/` | heygen cURLs, hostinger-vps.env, impact.env, minio.env |
| `repo/apps/*/.dev.vars` | per-app Worker local dev secrets (7 apps) |
| `home/.config/paypal-txns-pp-cli` | PayPal CLI creds |
| `MANIFEST.txt` | date, host, contents list |

Not yet included (add if you want them — see below): `GUMROAD_ACCESS_TOKEN` (a shell env
var, not a file) and `~/.ssh/` keys (the doc scopes those to a separate migration step, but
`hostinger_vps` is high-value — adding it is a one-line edit to `CANDIDATES`).

## Run it (monthly)

```bash
# from repo root — prompts for the passphrase, encrypts, uploads, wipes local plaintext
./infra/escrow/escrow-backup.sh
```

Refresh cadence: **monthly**, driven by a calendar reminder (simplest secure option — the
passphrase is typed by hand each time and never stored on disk or in a cron env). Same-named
archive for the month is overwritten; a new month gets a new dated file.

Dry-run first if you want to see the file list without touching anything:

```bash
./infra/escrow/escrow-backup.sh --dry-run
```

## Restore (new machine)

```bash
# 1. list the escrow folder / grab the latest archive from Drive (web UI or pp-drive)
# 2. decrypt + unpack (prompts for the passphrase from your password manager):
gpg -d personal-stuff-secrets-escrow-YYYYMMDD.tar.gz.gpg | tar -xzf - -C /tmp/escrow
# 3. copy the trees back into place:
#    /tmp/escrow/repo/*  -> <cloned personal-stuff repo>/
#    /tmp/escrow/home/*  -> ~/
# 4. re-run the wiring the repo expects after a clone:
./scripts/relink.sh && ./scripts/regen-mcp-json.sh
```

Then verify with `./scripts/skills-status.sh` and the diagnostics `doctor.sh` (see the
`personal-stuff-build-and-env` skill for the full new-machine sequence).

## Automating it later (cron)

The script supports batch mode via `GPG_PASSPHRASE`, but putting a symmetric passphrase in
a cron env is weaker than the manual flow. If you want unattended nightly/weekly escrow,
switch to **asymmetric** gpg instead: generate a keypair, encrypt to the *public* key (no
secret needed to run the backup), and keep the private key only in the password manager +
this very escrow. That removes the chicken-and-egg of "where does the cron's passphrase
live". Until then, the monthly manual run is the intended path.
