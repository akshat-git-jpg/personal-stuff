# 070 - publish to the desk

**[RUN]** &nbsp; Publishes and prints the freelancer URL.

Parses `script-plan.md` into beats, mints or reuses that video's secret token, and pushes the snapshot to D1. Prints one URL, which is the entire handoff. Runs ONLY after the owner approves at 055.

**Reads:** `script-plan.md`

**Writes:** `a secret desk URL`

---

## The command

```bash
cd apps/yt-script-desk
set -a && . ../../infra/secrets/script-desk.env && set +a
node bin/desk.mjs publish <key>
```

It prints one URL. That URL is the handoff - nothing else is sent.

## Finding an older video's link

```bash
node bin/desk.mjs list
```

Every published video, newest first: date, key, title, URL, and whether it is
finished. This IS the registry - the links cannot be kept in a file because this
repo is public, so the database holds them and this reads them back.

## Direction of truth

`script-plan.md` in git is upstream. D1 is a copy. Re-publishing re-reads the file
and reuses the same token, so the freelancer's link never changes.
