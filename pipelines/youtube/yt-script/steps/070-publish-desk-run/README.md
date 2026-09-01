# 070 - publish to the desk

**[RUN]** &nbsp; Publishes and prints the freelancer URL.

Parses `script-plan.md` into beats, mints or reuses that video's secret token, and pushes the snapshot to D1. Prints one URL, which is the entire handoff. Runs ONLY after the owner approves at 055.

**Reads:** `script-plan.md`

**Writes:** `a secret desk URL`

---

## The command

Two commands, in this order, and the first one is not optional when the owner has
edited anything on the desk:

```bash
cd apps/yt-script-desk
set -a && . ../../infra/secrets/script-desk.env && set +a
node bin/desk.mjs apply <key>        # staged desk edits -> script-plan.md
node bin/desk.mjs publish <key>
```

It prints one URL. That URL is the handoff - nothing else is sent.

## It refuses until the owner has approved

The Approve button lives in the header of the LOCAL desk only. `publish` reads that
sign-off and stops without it:

```
REFUSED: ai-avatar-generators has not been approved

Publishing mints a live secret URL and sends the script to the maker.
Open the local desk and hit Approve first:
  http://localhost:5175/?key=ai-avatar-generators
```

**Approval is of a specific script, not a permanent flag.** It records a fingerprint of
the plan as the owner read it - the file plus whatever was staged - and `publish`
recomputes that hash. Edit anything afterwards and the approval goes `stale`, the desk
button changes to **Re-approve**, and publish refuses again. An edit made in his editor,
outside the desk entirely, is caught the same way.

The fingerprint is taken over the plan's CONTENT, so running `apply` in between does not
void it: staged or written in, the script says the same thing. Approve once, apply,
publish.

Exit codes: `2` unanswered ASK, `3` not approved or stale, `4` edits still staged.

## It refuses to publish edits that are only staged

`publish` snapshots `script-plan.md` and nothing else. A desk edit lives in
`desk-draft.json` until `apply` writes it in, so publishing with staging present would
hand the maker the text as it was BEFORE the owner edited it, while telling him it
shipped. It stops instead:

```
REFUSED: 3 desk edits in ai-avatar-generators are not in script-plan.md yet

Publish snapshots script-plan.md. Your staged edits are not in it, so the maker
would get the text as it was BEFORE you edited it. Write them in first:

  node bin/desk.mjs apply ai-avatar-generators
```

Review what is waiting with `node bin/desk.mjs edits <key>` first - `apply` writes it
into a tracked file, and a stray test keystroke staged during review becomes part of the
brief. Guarded by `bin/__tests__/approvalGate.test.mjs`.

## It refuses while a question is still open

An `**ASK**` lane is one of the owner's own review questions. Publishing hands the
script to a freelancer, so publishing over an unanswered one means the review never
finished. The command stops and names them:

```
REFUSED: 2 unanswered ASK notes in vox-style-video-ai
  1.1
      Cut this to two sentences.
  2.4  Locking the look
      Is 200% too close to read the texture?

Say "edits are done" in the terminal first, or pass --force to publish anyway.
```

`--force` publishes regardless. **The `ask` field is stripped either way** - the
owner's private question never reaches the maker's snapshot. Guarded by
`bin/__tests__/askGate.test.mjs`.

## The three gates, in order

| Order | Gate | Exit | Cleared by |
|---|---|---|---|
| 1 | unanswered `**ASK**` | 2 | answering it in `script-plan.md` |
| 2 | not approved / stale | 3 | **Approve** in the local desk header |
| 3 | edits still staged | 4 | `node bin/desk.mjs apply <key>` |

Each takes `--force`. Reaching for it means publishing something nobody signed off, or
shipping the pre-edit text - say so in the terminal rather than doing it quietly.

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
