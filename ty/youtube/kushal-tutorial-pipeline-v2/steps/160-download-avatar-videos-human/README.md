# 160 · download-avatar-videos-human  ·  [HUMAN] (+ [RUN] helper)

Get the finished HeyGen renders (submitted in step 150, no polling) off HeyGen and into
`output/videos/` — the one place the avatar `.mp4`s live. Step 170 packages them from here.

There is **no polling** (anti-ban), so a human decides when the renders are done. Two ways in:

**Manual (works today — submit/fetch endpoints are stubs):**
1. Open HeyGen, confirm all renders for this video finished.
2. Download each `.mp4` and name it exactly like the manifest job (e.g. `BODY_2__a4__intro.mp4`,
   `BODY_2__a3__corner-p01.mp4`). `check.py` lists the exact names.
3. Drop them into `output/videos/`.
4. `python3 check.py [<base>]` — confirms every expected video is present (✓/✗).

**Scripted (once `lib/heygen.py` `WebSessionBackend.fetch` is wired):**
```bash
python3 download.py [<base>] [--flow a4|a3|both]   # pulls finished renders into output/videos/
python3 check.py   [<base>]                        # verify
```

- **In:** `../150-submit-avatar-videos/output/<base>.heygen-manifest.json` (the job list)
- **Out:** `output/videos/<base>__a4__*.mp4` + `<base>__a3__corner*.mp4`
- **Next:** step 170 copies these into the editor handoff tree.

Parts stay **separate** — one `.mp4` per block / corner part; the editor stitches them in their NLE.
`check.py` exits non-zero while anything is missing, so it doubles as the gate before step 170.
