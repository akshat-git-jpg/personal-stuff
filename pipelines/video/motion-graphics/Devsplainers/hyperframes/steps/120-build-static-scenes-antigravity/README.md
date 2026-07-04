# 120 · build-static-scenes · [ANTIGRAVITY]

**Job:** Build each scene’s final-frame look (no motion yet) from the storyboard + kit.

**In:** `storyboard.md` + `kit/` + the scaffolded scene folders
**Out:** a static `index.html` in every `scenes/sNN-*/`

**Run:** paste the prompt from 110’s handoff into Antigravity (`node lib/handoff.mjs 120 --video <slug>`).
**Then:** proceed to 130.

**Cost:** **Antigravity sub.** ← the heavy grind (reads kit, writes HTML, fixes lint, iterates). Zero Opus.
