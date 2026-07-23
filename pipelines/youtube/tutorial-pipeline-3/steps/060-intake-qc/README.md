# 060-intake-qc

Run order:

```bash
bash run.sh <slug> pull-audio
bash run.sh <slug> pull-recordings
bash run.sh <slug> qc
```

- If `qc` fails, send the freelancer the failing section IDs + issues from `intake-report.md` (that list IS the bounce message).
- **Gate 2**: A Claude session reads `videos/<slug>/qc/*.png` against each section's `notes` and records verdicts at the bottom of `intake-report.md` (append a `## Gate 2 (session)` section).
- After everything passes, set each section to `qc-passed` and run:

```bash
node lib/set-stage.mjs <slug> recorded
node lib/set-stage.mjs <slug> qc-passed
```
