# 020 · segment-into-beats · [ANTIGRAVITY]

**Job:** Split the script into an ordered list of beats — one beat per intended scene.

**In:** `videos/<slug>/script.md`
**Out:** `videos/<slug>/beats.md` (numbered 1..N)

**Run:** `node lib/handoff.mjs 020 --video <slug>` → copies the prompt + focuses Antigravity; paste with ⌘V+Enter.
**Then:** Antigravity writes `beats.md` → proceed to 030.

**Cost:** **Antigravity sub.** 1 beat = 1 VO clip = 1 scene — this alignment is what makes audio sync automatic.
