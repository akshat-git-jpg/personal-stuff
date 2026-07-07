# 230 · create-thumbnail · [ANTIGRAVITY]

**Job:** Design + render the 1280×720 YouTube thumbnail from the kit (bold headline + one hero visual).

**In:** `videos/<slug>/script.md` (the hook/signature beat) + `kit/`
**Out:** `videos/<slug>/renders/<slug>_thumb.png`

**Run:** `node lib/handoff.mjs 230 --video <slug>` → Antigravity builds `thumb/` + renders the PNG.
**Then:** ▶ print the thumbnail path — video + thumbnail are ship-ready.

**Cost:** **Antigravity sub.** (was Opus — thumbnail is kit-composition Antigravity can do.)
