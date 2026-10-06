# press-clis

Go source for the CLIs I generated with Printing Press. These run from `~/go/bin`, and until now the only copy of their source lived in `~/printing-press/library/<name>/`, which is not a git repo and is not backed up anywhere. One disk failure and the source was gone, binary still sitting on PATH, nothing to rebuild it from.

So the source gets mirrored here.

## What is mirrored

- `paypal-txns/` is the source for `paypal-txns-pp-cli`. It reads PayPal Business transactions and reports income grouped by month, then by program. See `../../pipelines/income-analysis/README.md` for how I actually query it.

Not mirrored yet: `impact`, `gumroad`, `skool`, `pinterest`. The same risk applies to all four.

## impact-pp-cli: known gap

`paypal-txns-pp-cli` has an `income` subcommand that does the month-by-program rollup inside
the CLI and prints it with `--table`. `impact-pp-cli` has no equivalent, so the loop and the
rendering are the caller's job every time (the `pp-impact` skill holds that contract), which is
how the format drifted before. The durable fix is an `income` subcommand on `impact-pp-cli`
mirroring the PayPal one. Start by mirroring its source from `~/printing-press/library/impact/`
into this folder, the way `paypal-txns/` was; today it is in no git repo.

The `pp-impact` skill is repo-scoped on purpose (source in `pipelines/.claude/skills/pp-impact/`,
symlinked into `.claude/skills/`), never in an account-scoped manifest, so a personal-finance
skill never loads into a work session.

## This is a mirror, not the working copy

Edit the source in `~/printing-press/library/paypal-txns/`, build there, then copy back here. Building from this folder works, but a binary built here drifts from the one on PATH, and then two trees disagree about what the CLI does.

Sync after any change:

```bash
rsync -a --delete \
  --exclude '/paypal-txns-pp-cli' \
  --exclude '/bin/' \
  --exclude '/.printing-press-pii-polish.json' \
  ~/printing-press/library/paypal-txns/ tooling/press-clis/paypal-txns/
```

Keep the leading slashes. An unanchored `--exclude 'paypal-txns-pp-cli'` matches any path
component with that name, so it silently drops the `cmd/paypal-txns-pp-cli/` source directory
along with the top-level binary, and the mirror then fails to build.

## Restoring from this mirror

```bash
mkdir -p ~/printing-press/library/paypal-txns
rsync -a tooling/press-clis/paypal-txns/ ~/printing-press/library/paypal-txns/
cd ~/printing-press/library/paypal-txns && make install
```

Credentials are not in here and never should be. `paypal-txns-pp-cli` reads `~/.config/paypal-txns-pp-cli/creds.env` (chmod 600, outside every repo). After a restore that file has to come back separately, or every call fails auth.

## What is excluded, and why

The compiled binary (18 MB, rebuildable from source) and `.printing-press-pii-polish.json`, a Printing Press scan artifact kept at chmod 600. Everything else is copied, including `.manuscripts/`, because that holds the API research the generator ran and it is what makes a regeneration possible.
