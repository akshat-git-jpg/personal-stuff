# Candidate editor test protocol (Mac only, 2026-10-17)

Read first: /Users/kbtg/.claude-work/jobs/2b878578/tmp/research/REQUIREMENTS.md
Test kit (real media + intended timeline): /Users/kbtg/.claude-work/jobs/2b878578/tmp/kit/
(TIMELINE.md = what to build, MANIFEST.md = file facts).

Machine: owner's Apple Silicon Mac. Windows is NOT available; skip Windows checks, but note
any Windows-specific code paths or known issues you see in the code/issues.

## Safety
- Install/build the candidate ONLY inside /Users/kbtg/.claude-work/jobs/2b878578/tmp/candidates/<name>/.
  Never write under /Users/kbtg/codebase or ~/kb-scratch. Never touch ~/.claude* config or
  credentials. Do not register the candidate's MCP server in any global Claude config: if you
  need to call its MCP tools, call them directly over HTTP/stdio from a script.
- Prefer the official release binary (verify it is the GitHub release asset). If you must
  build from source, run its install inside the candidates folder and read package.json
  scripts (postinstall etc.) before running them. Run Python with -I.
- Telemetry: if the app phones home by default, disable it if a setting exists; note it.
- Quit the app when done. Leave no background processes.

## Measurements (record numbers, not impressions)
Launch the Electron app with `--remote-debugging-port=<port>` when possible so you can attach
puppeteer (use `node /Users/kbtg/codebase/personal-stuff/scripts/lib/chrome.mjs` helpers or
puppeteer-core connect) to measure from inside the renderer.

T1 Import + proxies: time to import the kit media; does it make proxies; handles the VFR
   3024x1964 screen recording? Note any errors.
T2 Build the TIMELINE.md timeline (via its MCP/agent API if it has one, else via its project
   file format, else UI automation). Record how hard this was and what could not be expressed.
T3 Playback smoothness at 1080p preview: play 60 s from 3 points (start, middle, a dense
   region with avatar + card overlap). Measure delivered fps / rAF frame intervals / dropped
   frames from inside the renderer (Performance API, requestVideoFrameCallback, the app's
   own stats). Report median and p95 frame time and dropped-frame %.
T4 Scrub/seek: 20 random seeks; time until the correct frame is shown; check A/V sync after
   seeking (VO vs picture) by eye-proxy: compare preview screenshot timestamp vs expected.
T5 HTML graphics: can the HyperFrames cards from kit/cards/ play LIVE as layers? If not
   natively, how much adapter work (estimate in lines + where)? Do they show without a
   long pre-bake wait? Measure any wait.
T6 Preview == export: export the full timeline at 1080p30 (H.264). Record export time.
   Grab preview screenshots at 10 fixed timestamps and the same frames from the export
   (ffmpeg -ss). Compare with ffmpeg ssim/psnr. Report per-frame SSIM.
T7 Agent edits live: through its MCP/agent API, trim one clip, delete one, move one card,
   ripple-delete a gap. Confirm each shows on the timeline/preview without reload; undo works.
T8 Ownability: read the code. Size (LOC by language), structure, tests (run its test suite
   if cheap), docs/ADRs, build steps. Then make ONE small real change: add a "comment"
   (timestamp + text) record that is saved in the project and shown as a marker on the
   timeline. Report how long it took, files touched, and whether it built and worked.
T9 Project folder portability: are media paths relative? Copy the project folder to a new
   path and reopen: does media relink?
T10 Claude terminal pane feasibility: is there a natural place to embed an xterm.js +
   node-pty pane running the user's own `claude` CLI? Any blocker (e.g., sandbox, contextIsolation
   setup, native module build for node-pty)?

T11 Owner's real flow (see REQUIREMENTS "Owner's real edit flow"): split the kit screen
   recording into ~6 clips of 1-3 min. Check (a) per-clip speed change / retime (0.8x,
   1.25x), (b) freeze frame / hold last frame, (c) mute or detach a clip's own audio,
   (d) whether its agent/MCP tools can do (a)-(c), (e) transcript / word-timing features
   usable to align a clip's guide voice to script lines.

## Output
Write /Users/kbtg/.claude-work/jobs/2b878578/tmp/research/test-<name>.md with: a results
table T1-T10 (PASS / PARTIAL / FAIL + numbers + evidence), surprises, and a final verdict
on "is this a good base to fork and own for years?" Separate measured facts from inference.
