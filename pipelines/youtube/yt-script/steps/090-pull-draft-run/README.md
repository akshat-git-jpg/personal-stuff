# 090 - pull the draft

**[RUN]** &nbsp; Pulls his completed draft back into the repo.

Downloads his words to `videos/<key>/script-draft.md`, stored verbatim as provenance and tracked in git. Also prints every locked line he edited - each one is a place where the plan and reality disagreed, and each is worth reading before finalising.

**Reads:** `a secret desk URL`

**Writes:** `script-draft.md`

---

## The command

```bash
cd apps/yt-script-desk
set -a && . ../../infra/secrets/script-desk.env && set +a
node bin/desk.mjs pull <key>
```

## Read the edited-line list

Every line it prints is a spot where he overrode pre-written copy. Usually that
means the plan assumed something the tool did not do. The original is kept and is
restorable in the desk.

## script-draft.md is never edited in place

It is the record of what he actually wrote. Final tweaks go into `script.md` at
100.
