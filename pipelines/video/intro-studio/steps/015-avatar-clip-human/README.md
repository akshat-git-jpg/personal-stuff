# 015-avatar-clip-human

In: the intro VO
Out: one avatar clip covering the WHOLE intro, saved as `avatar.mp4`.

Command: (No automated command) Owner-run using `tooling/cli/heygen-web`.
Verify with: `bash run.sh <slug> avatar-check`

**One clip for the whole intro.** Do not slice per beat. HeyGen renders a single avatar clip speaking the entire intro VO; the film then decides moment to moment whether to show it full-screen, dock it into a panel, or hide it. Because the audio is continuous, the lip-sync is correct whenever the face is visible, and no span negotiation is needed anywhere in the system.

- The clip is saved to `videos/<slug>/avatar.mp4`.
- Generation is **owner-run** with `tooling/cli/heygen-web`, resolving a character slug from `pipelines/video/heygen/registry.json` (`specs-man` is the current default man template; `girl-1`/`girl-2` are template renders). Read `tooling/cli/heygen-web/CLAUDE.md` before submitting.
- Every render gets a row in `pipelines/video/heygen/RENDERS.md` per the media policy in `pipelines/CLAUDE.md`.
- **This step makes no network call from intro-studio code, and no test in this repo may make one.** HeyGen calls are ToS-grey and account-bound (`tooling/cli/heygen-web/CLAUDE.md`: "Never run live HeyGen calls to test").
- If the owner already has a suitable clip, they drop it at `videos/<slug>/avatar.mp4` and skip generation entirely.
