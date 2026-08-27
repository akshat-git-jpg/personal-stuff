# yt-script-desk — operating guide

## Core rules and architecture

### The two-track rule
**The left track is the audio timeline. Instructions never enter it.** The desk splits every beat into two columns:
1. The audio timeline on the left: words that will be spoken, lines the maker writes himself, and a **DEMO** block marking a stretch where nothing is spoken at all.
2. Instructions on the right, in four toggleable blocks: What to cover, Screen Recording notes, General Notes, Video Editor Notes.

**DEMO is the one thing in the left track that is not spoken copy, and it is not an exception to the rule.** A silent stretch is timeline content: something plays and nobody talks. Added 2026-08-27, because a 12-second cold open with no voiceover had nowhere to appear, so the timeline read as if the video began on the first spoken line. How to shoot it stays in SHOW; how to cut it stays in EDIT. A DEMO lane that grows shooting notes has smuggled an instruction into the left track. Guarded by `src/components/__tests__/demoLane.test.tsx`.

### The API process does not hot-reload. Vite does.
`npm run dev:local` runs two things: Vite (watches `src/`, reloads on save) and `server/local.mjs` (a plain node process that imported `buildBeats` **at startup**). Change the parser in `pipelines/youtube/yt-script/lib/` and the frontend picks it up while the API keeps serving the old shape. **Restart `dev:local` after any parser change.**

Seen live 2026-08-27: `demo` was added, the frontend hot-reloaded, the API did not, and `beat.demo.length` on undefined blanked the whole page. `normalizeDoc` in `src/api.ts` now fills missing list fields at the boundary, so this degrades to "the new field is absent" instead of a crash — which is also what protects freelancers holding links published before a field existed, since D1 snapshots are frozen at publish time. Guarded by `src/__tests__/oldSnapshot.test.ts`.

**Any new beat field goes in `normalizeDoc`.** A field the UI reads with `.length` and does not normalise is a blank page waiting for the next publish.

### Beats are labelled by the outline's heading
**Never by `beat.title`.** A body beat is headed by its outline section; an intro or conclusion beat by its part name. The section header prints once per section, not once per beat.

Before 2026-08-27 the desk rendered `beat.title` and never rendered `beat.section` at all, so the section names the owner approved at gate 040 were invisible in the tool built to review them, and what he read instead was prose the script plan had invented ("Cold open — a finished Vox shot, no logos, no UI"). `beat.title` is still parsed and still in the data; it is an index label for whoever reads the markdown, not a heading. Guarded by `src/components/__tests__/outlineHeadings.test.tsx`.

### The resolution order (`says -> say -> draft`)
When parsing what text should appear in the spoken track, the resolution order is:
1. `says` (final locked copy)
2. `say` (draft prompt, which becomes **What to cover** in the right track, leaving the left track empty for the maker to fill)
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
