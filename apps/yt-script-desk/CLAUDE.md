# yt-script-desk — operating guide

## Core rules and architecture

### The two-track rule
**The left track is the audio timeline. Instructions never enter it.** The desk splits every beat into two columns:
1. The audio timeline on the left: words that will be spoken, lines the maker writes himself, and a **DEMO** block marking a stretch where nothing is spoken at all.
2. Instructions on the right, in ONE block headed **Notes**, behind the `Instructions` toggle. In local mode it is a live textarea — just type.
   (It was three blocks with three chips — What to cover, Video notes, General notes — until 2026-08-29. Owner: *"remove those sections about video notes separately, general notes separately, everything else. Just need a simple bullet points."* One reader, one job, one list.)

**DEMO is the one thing in the left track that is not spoken copy, and it is not an exception to the rule.** A silent stretch is timeline content: something plays and nobody talks. Added 2026-08-27, because a 12-second cold open with no voiceover had nowhere to appear, so the timeline read as if the video began on the first spoken line. How to shoot it stays in SHOW; how to cut it stays in EDIT. A DEMO lane that grows shooting notes has smuggled an instruction into the left track. Guarded by `src/components/__tests__/demoLane.test.tsx`.

### The API process does not hot-reload. Vite does.
**The test suite needs Node 22.** On Node 20 `vitest` will not start at all:
jsdom pulls `html-encoding-sniffer`, which `require()`s `@exodus/bytes`, and every
published version of that package is ESM-only. You get 19 startup errors and
`Tests  no tests`, which reads like a broken config and is not one. Run it as:

```bash
PATH="/opt/homebrew/opt/node@22/bin:$PATH" npx vitest run
```

Verified 2026-08-29: Node 20.18.3 fails, Node 22.14.0 passes 146/146.

## Editing: in place, staged, applied in one go

**On the local desk every box is live.** No pencil, no confirmation — click the
words and type. Owner, 2026-08-29: *"i think its better if we can have entire
flow editable in place - on local. no need to click pencil."*

**The hosted freelancer link is unchanged**: pencil plus a confirm dialog on
spoken copy, and no way at all to edit the notes. That gate exists so a change to
somebody else's locked copy is a decision he took rather than a stray keystroke.
`alwaysEditable={!isHosted}` in `App.tsx` is the whole switch.

**An always-open box saves on a 600ms pause as well as on blur**, because a box
that is never closed may never be blurred either.

**The edit does NOT rewrite `script-plan.md`.** It stages in `videos/<key>/desk-draft.json` (gitignored)
and the card shows `edited, not yet applied` until it is.

Owner, 2026-08-29: *"make the edit in place for script and instructions"* and
*"can we do commit in 1 go. i will edit wherever required and tell you once all
are reviewed and done. then you can update/edit in 1 go."*

```bash
node bin/desk.mjs edits <key>            # what is staged, as a diff
node bin/desk.mjs apply <key>            # splice it all into script-plan.md, clear the stage
node bin/desk.mjs apply <key> --dry-run  # count only, write nothing
```

`apply` resolves each block's real source range from `buildEditModel` and splices
**bottom-up**, so one edit cannot shift another's range. It refuses to write
markdown that does not parse. Guarded by `bin/__tests__/applyStaged.test.mjs` —
`APPLY_WRONG_CARD` is the one that matters, because a splice landing on the wrong
card rewrites a section nobody was looking at.

**Notes editing is local only.** The hosted freelancer link passes no handler, so
the pencil never renders and he cannot rewrite his own brief.

**The whole-file markdown editor is hidden**, not deleted. `?edit=1` on the local
URL brings it back. It still does the thing in-place editing cannot: move a
section, delete one, add a block. Owner, asked whether to remove it: *"Keep it,
just hidden."*

## The DEMO lane is not in the full script

The read-through is what the narrator says, in order. A silent stretch has no
words, so it does not appear there — it printed as `[The finished Vox shot plays.
No voiceover.]` in the same serif face until 2026-08-29 and read as a line to
say. It still renders in the write view's LEFT track, which is the audio
timeline, and that is where it belongs.

`npm run dev:local` runs two things: Vite (watches `src/`, reloads on save) and `server/local.mjs` (a plain node process that imported `buildBeats` **at startup**). Change the parser in `pipelines/youtube/yt-script/lib/` and the frontend picks it up while the API keeps serving the old shape. **Restart `dev:local` after any parser change.**

Seen live 2026-08-27: `demo` was added, the frontend hot-reloaded, the API did not, and `beat.demo.length` on undefined blanked the whole page. `normalizeDoc` in `src/api.ts` now fills missing list fields at the boundary, so this degrades to "the new field is absent" instead of a crash — which is also what protects freelancers holding links published before a field existed, since D1 snapshots are frozen at publish time. Guarded by `src/__tests__/oldSnapshot.test.ts`.

**Any new beat field goes in `normalizeDoc`.** A field the UI reads with `.length` and does not normalise is a blank page waiting for the next publish.

### Beats are labelled by the outline's heading
**Never by `beat.title`.** A body beat is headed by its outline section; an intro or conclusion beat by its part name. The section header prints once per section, not once per beat.

Before 2026-08-27 the desk rendered `beat.title` and never rendered `beat.section` at all, so the section names the owner approved at gate 040 were invisible in the tool built to review them, and what he read instead was prose the script plan had invented ("Cold open — a finished Vox shot, no logos, no UI"). `beat.title` is still parsed and still in the data; it is an index label for whoever reads the markdown, not a heading. Guarded by `src/components/__tests__/outlineHeadings.test.tsx`.

### The resolution order (`says -> say -> draft`)
When parsing what text should appear in the spoken track, the resolution order is:
1. `says` (final locked copy)
2. `notes` (a body section card's bullet list, which becomes **Notes** in the right track, leaving the left track empty for the maker to fill). An older plan's `say` draft, `video`, `rules` and `facts` fold into the same block.
3. `draft` (the maker's typed copy)

### Data flow and upstream
- `outline.md` (in the yt-script pipeline) is the absolute upstream source of truth.
- The D1 database (`script-desk-db`) is merely a **copy** of the parsed outline.
- When the freelancer finishes, `script-draft.md` is written as the definitive record of their work.
- `script-draft.md` is **never edited in place**. Any final tweaks by the owner go into `script.md`.

### Mutation targets
Constants and URLs used as mutation targets by the merge gates live in this codebase. They are load-bearing for the orchestrator's mutation gates and **must not be tidied away** or abstracted. If a test relies on regex-replacing a domain, that string literal needs to remain visible and constant.

### Deploy chain
The deploy chain is strictly **owner-gated**. Do not attempt to deploy this app automatically or instruct sessions to run Wrangler commands. All deployments happen manually by the owner once the feature branch is reviewed and merged.

## The instruction track linkifies bare URLs. It has no markdown parser.

`renderEmphasis` in `WriteView.tsx` handles exactly two inline marks: `**bold**`
and a bare `http(s)://` URL, which becomes an `<a class="lane-link">` opening in
a new tab. Everything else is printed as written.

So a source reference in a lane is a **bare URL**. A markdown link prints its
brackets. Added 2026-08-28 because the plan names people the freelancer has never
heard of and a URL he has to copy out by hand is not a reference. Guarded by
`laneLinks.test.tsx`, including the trailing-period case — `…Jkt4aTOpqpM.` must
not put the period in the href.

## Edit mode: the desk writes `script-plan.md`, and only on localhost

**This reverses a decision made earlier the same day. Read why before you undo it.**

On 2026-08-28 a full review-and-markup layer for this app was designed and then
stopped by the owner — hover tools per note, a request composer, an overlay
store, four plans:

> *"I feel that this will be too complex. making comments, edits, all those things
> one by one on the URL when I have the entire thing as a text in my MD file, which
> I can easily cut paste everything. I can't do that easily on the UI."*

That was recorded here as "the desk is a reader, do not build editing into it."
Hours later he came back having actually used it:

> *"the MD file is obviously yes it's very easy I can easily cut, paste, delete
> things, add things — but it's not easy to read while editing. I'm not able to
> follow the script, too much things is going on. ... I can do all the things in UI
> and in UI itself I can do entire edit which was possible in the MD file."*

**What was actually wrong the first time.** The rejected design was rejected for
being a *parallel* system — comments, an overlay store, edits held somewhere
other than the file, reconciled later. He was right about that, and it stays
rejected. What the note got wrong was the conclusion: it read his complaint as
"the desk should not edit" when the real constraint was "do not build a second
copy of my script." Edit mode has no second copy. Every control is a line splice
on the markdown, written straight back, atomically. There is nothing to reconcile.

**How it works, in one line each:**

- `buildEditModel()` (in `lib/beats.mjs`) is the STRUCTURAL parse — every block
  with the source lines it came from. `buildBeats()` stays the READING parse.
  Edit mode renders from the first, because once two `VIDEO` blocks are one
  `video` array, deleting "the video note" is a guess.
- `src/lib/edits.ts` turns a click into new markdown. Pure functions, and the
  hardest-tested code in the app — `edits.test.ts` drives the real 1000-line
  plan through a delete, a section move and a rewrite and asserts every spoken
  line came out byte-identical.
- `EditView.tsx` only decides which range each button points at.
- `GET|PUT /api/source` in `server/local.mjs` does the IO.

**Three guards on the write path, all in `server/local.mjs`. Do not remove one
to make something easier:**

1. **Never write markdown that does not parse.** The text is run through
   `buildBeats` BEFORE it goes near the disk. A refused save keeps his text in
   the browser and says what broke.
2. **Never clobber an edit made elsewhere.** He may have the file open in his
   editor. The browser sends back the mtime it loaded; a changed file refuses
   the write rather than silently winning.
3. **Keep the last good version.** Every write copies the file into
   `.desk-backups/` first (gitignored). A splice bug is invisible until he
   scrolls to the damage.

**LOCAL ONLY, and that is a real boundary, not a default.** `isHosted` gates the
button; the Worker serves a frozen D1 snapshot and has no file to write. The
freelancer reads the plan he was sent. He does not rewrite it.

**Spoken copy cannot be deleted from edit mode.** It can be moved and edited,
but the one-click × is disabled on a `SAY` block — approved script is the one
thing here with a real cost if it goes and nobody notices. `editView.test.tsx`
guards it.

**What is still true from the original decision**

The `**ASK**` lane below is unchanged and still earns its place: it is how he
leaves a question for Claude *in the document*, which is a different job from
editing. And `script-plan.md` is still the single source of truth — edit mode
did not change that, it just gave him a second way to type into it.

## The ASK lane

The one thing his editor could not do was leave a question in place that the desk
shows back, so that is what the ASK lane is: an `**ASK**` lane, rendered by
`AskCard` in `WriteView.tsx` as a purple card in the **left** track.

**Nothing purple is ever on paper.** The spoken card is warm cream and serif; an
ASK is a purple-bordered sans box addressed to Claude by name. That separation is
what keeps a note to Claude from being read aloud. `askCard.test.tsx` guards it,
including that the card stays visible when the instruction track is toggled off —
it is not a note, and it is not the maker's business.

**The SAY edit boxes are a different thing again** — those are for the MAKER, in
hosted mode, and are unrelated to the owner's edit mode above.

## Editor Role
The `?role=editor` query string enables internal creator tools (like avatar selection) that freelancers should not see.
