# 110 · scaffold-scene-folders · [RUN · free]

**Job:** Create the per-scene folders from the manifest, start the preview server, and emit the static-build prompt.

**In:** `videos/<slug>/scenes.json`
**Out:** `videos/<slug>/scenes/sNN-<slug>/` (kit symlink + meta.json + static starter)

**Run:** `node steps/110-scaffold-scene-folders-run/run.mjs --video <slug>`
**Then:** **this step also:**
  1. ▶ **SERVER** — starts the preview gallery `node lib/serve.mjs` at http://localhost:4321. Leave it running through step 170 so you can watch scenes fill in.
  2. ▶ **HANDOFF** — run `node lib/handoff.mjs 120 --video <slug>` to copy the STATIC-build prompt into Antigravity → starts 120.

**Cost:** **None.** The only step that starts a server.
