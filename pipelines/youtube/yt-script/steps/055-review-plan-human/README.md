# 055 - review the plan

**[OWNER]** &nbsp; You read the markdown and the desk side by side, and give feedback.

The owner reviews `videos/<key>/script-plan.md` two ways at once: the raw markdown in an editor, and the same file rendered by the local desk at `localhost:5175`. One gate, one pass. Feedback goes in the terminal and the session edits that same file; the owner can also edit it directly. Merged from the old 055 (markdown only) and 060 (desk only) on 2026-08-27.

**Reads:** `script-plan.md`

**Gate:** the words are right AND the plan reads right in the actual UI

---

## What you do

**1. Boot the desk once — from the WORKSPACE, not the main checkout.**

```bash
cd "$(pp-work claim --kind code --slug <this-session-slug>)"/apps/yt-script-desk
npm run dev:local
```

Open `http://localhost:5175/?key=<key>`.

**Which checkout the desk runs in decides which file you review.** The server
resolves `videos/<key>/script-plan.md` relative to its own repo root, so a desk
booted in `~/codebase/personal-stuff` shows you whatever has **landed on main**,
not what this session just wrote. The live file is in the workspace.

Symptom when it is wrong (hit on 2026-08-27): edits appear after a few minutes,
in the order they landed, and code changes never appear at all — because the
running Vite server is serving the main checkout's components. If the page looks
one step behind reality, check the server's directory before anything else:

```bash
lsof -a -p "$(lsof -nP -iTCP:5175 -sTCP:LISTEN -t)" -d cwd -Fn | tail -1
```

**A fresh workspace has no `node_modules`.** Install once, and use a private npm
cache — the shared one throws `EACCES` under the sandbox:

```bash
npm ci --cache /tmp/npm-cache-<slug>
```

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

**5. Leave Claude a question wherever you have one.** Type `ask` and press Tab in
the markdown (or write `**ASK**` by hand):

```
**ASK**
Cut this to two sentences. The After Effects line is doing the work.
```

It shows up in the desk as a purple `Asked Claude` card under that beat, so you
can see every open question while you read.

**If `ask` does not expand**, the snippet is fine and the editor is muted. VS Code
and Cursor both ship markdown with quick suggestions off, so nothing pops. Add this
to `.vscode/settings.json` (gitignored, per-machine, carries your account colours so
the repo cannot ship it):

```json
"[markdown]": {
  "editor.quickSuggestions": { "other": "on" },
  "editor.snippetSuggestions": "top",
  "editor.tabCompletion": "on"
}
```

`editor.tabCompletion` is the one that matters — with it, `ask` + Tab expands with
no popup at all. Then reload the window (`Cmd+Shift+P` -> Reload Window).

Second thing to check: project snippets only load when the **folder** is the
workspace root. Opening one file into a window rooted somewhere else loads no
snippets at all. Put one on a beat, or under a
`### SECTION:` heading for something about the whole section.

**6. Say `edits are done` in the terminal.** The session reads every ASK, tells you
what it intends to do about each one, and waits. You say `go`, or `go but skip
3.1`, or `for 2.7 do X instead`. Then it applies your edits, answers the questions,
and deletes the ASK lines.

Round two is the same loop. There is no limit.

Then say go, and step 070 publishes the file you just approved. **Publishing
refuses while any ASK is still open** and lists them - an unanswered question means
this review never finished.

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
  markdown but splits badly across the two tracks, a `VIDEO` lane that says
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

  **Since 2026-08-28 the desk has an EDIT MODE, and it is usually the better
  place to work.** Hit **Edit** in the header (local only) and every note, beat
  and section grows handles: move it up or down, throw it somewhere else with
  "Move to", delete it, add a note, or click any note to edit its raw markdown
  in place while the rest of the page stays readable. Every action writes
  `script-plan.md` immediately - there is no separate save and no second copy.
  Owner: *"it's not easy to read while editing. I'm not able to follow the
  script."*

  **Use the markdown file when you want to restructure in bulk** - it is still
  the source of truth and nothing stops you. Use edit mode for everything else.
  If you have the file open in your editor at the same time, the desk will
  refuse to save over changes it did not see; reload it and carry on.

  The SAY-edit boxes are a separate feature for the **maker** in hosted mode -
  while reviewing, leave those alone.
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

## Editing while you review

**Just type.** Every box on the local desk is live — no pencil, no confirmation.
Notes and spoken lines alike. The card shows `edited, not yet applied` and the
edit sits in `desk-draft.json`; `script-plan.md` is untouched until you say so.

It saves on a pause in typing, so you can close the tab mid-sentence.

**Then it all lands in one commit:**

```bash
cd apps/yt-script-desk
node bin/desk.mjs edits <key>     # everything staged, as a diff
node bin/desk.mjs apply <key>     # spliced into script-plan.md, stage cleared
```

Owner, 2026-08-29: *"can we do commit in 1 go. i will edit wherever required and
tell you once all are reviewed and done. then you can update/edit in 1 go."*

Editing the markdown in your own editor still works and always will — the desk
re-reads the file on every request. The two are interchangeable, but do not do
both to the same block in one sitting: `apply` writes the staged version over
whatever is on disk.

**`?edit=1`** on the local URL brings back the whole-file editor, for moving or
deleting a section — the things in-place editing cannot do.
