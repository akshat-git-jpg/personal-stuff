# yt-script-desk — operating guide

## Core rules and architecture

### The two-track rule
**Instructions never enter the left track.** The desk strictly splits every beat into two columns:
1. Words that will be spoken on the left.
2. Instructions on the right, in four toggleable blocks: What to cover, Screen Recording notes, General Notes, Video Editor Notes.

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
