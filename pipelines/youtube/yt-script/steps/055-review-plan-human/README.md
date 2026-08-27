# 055 - review the plan

**[OWNER]** &nbsp; You read the markdown and the desk side by side, and give feedback.

The owner reviews `videos/<key>/script-plan.md` two ways at once: the raw markdown in an editor, and the same file rendered by the local desk at `localhost:5175`. One gate, one pass. Feedback goes in the terminal and the session edits that same file; the owner can also edit it directly. Merged from the old 055 (markdown only) and 060 (desk only) on 2026-08-27.

**Reads:** `script-plan.md`

**Gate:** the words are right AND the plan reads right in the actual UI

---

## What you do

**1. Boot the desk once.**

```bash
cd apps/yt-script-desk
npm run dev:local
```

Open `http://localhost:5175/?key=<key>`.

**2. Open the markdown in your editor.**

```
pipelines/youtube/yt-script/videos/<key>/script-plan.md
```

To send it to the VS Code window you are already in, rather than a new one:

```bash
code -r <path>
```

**3. Read both.** Say what to change in the terminal and the session edits the
file. You can also edit it yourself; it is the source of truth, not a generated
copy.

**4. Refresh the browser after any edit.** The desk re-reads the file on every
request, so a save plus a refresh is all it takes. Nothing to restart, nothing to
regenerate, and the session is not involved.

Then say go, and step 070 publishes the file you just approved.

## Why these were one gate from 2026-08-27

They were two gates, and the split assumed you would read the markdown, finish,
then boot a server and read it again. In practice both views answer different
halves of the same question and having both open costs nothing. Owner:
*"I was wondering if both of this can be done in parallel… if I am making changes
in the MD file then maybe it can immediately reflect in the local desk setup"*
and then *"merge the two steps"*.

**The two halves are still worth naming**, because the desk catches things the
markdown cannot and the reverse:

- **The markdown answers: are the words right?** Section order, what a beat
  covers, a claim that came out wrong, a beat that should not exist.
- **The desk answers: does it read right in the UI?** A beat that is fine as
  markdown but splits badly across the two tracks, a `SHOW` lane that says
  nothing once it is on its own, an instruction track he will misread.
- **And a third, which is why having both open is better than either:** a
  malformed lane label. `lib/beats.mjs` drops an unrecognised form to plain prose
  **silently**, with no error anywhere. The markdown looks fine. In the desk that
  beat visibly loses its coloured lane. That is the only place the failure shows.

## No live reload, and that is fine

`server/local.mjs` calls `readFileSync` on the markdown for every
`GET /api/video`, so there is no cache and no restart needed. What it does not do
is push changes to the browser: there is no watcher and no websocket. Vite's hot
reload watches `src/`, not `videos/`.

So the loop is **edit, save, refresh**. The owner accepted that explicitly rather
than have a watcher built: *"no instant live refresh required I can just refresh
the browser"*.

## Watch for

- **`desk-draft.json` overrides the markdown, per beat.** If a spoken line gets
  edited inside the desk UI, that edit wins for that beat from then on, and a
  later change to the same beat in the markdown will not appear. There is a
  restore control per beat. **While reviewing, prefer editing the markdown** and
  leave the desk's SAY boxes alone.

  The owner is deciding whether desk-side editing should exist at all now that
  both views are open together (2026-08-27, undecided). Do not remove it until he
  says so.
- **Do not repair a lane form by hand.** The forms in
  `SCRIPT-PLAN-INSTRUCTIONS.md` are parsed. If a lane looks wrong, say so and the
  session fixes it against the instructions.
- **A body `SAY` is meant to read like a prompt, not a finished line.** That is
  correct, not a gap. Finished copy there is the bug.

## Why this is a gate

Publishing at 070 mints a live secret URL. Reviewing after that is reviewing
something already shipped. This was the real bug on 2026-08-23, when the old step
2 published first and then said "wait for approval".

## Also registered in localapps

`tooling/cli/local-apps-dashboard/apps.json`, id `script-desk`, ports 5175 + 4327.
