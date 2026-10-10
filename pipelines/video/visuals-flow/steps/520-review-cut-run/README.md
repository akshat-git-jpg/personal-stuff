# 520 · review the assembled cut · [RUN]

Builds a QC filmstrip pack (event sheets, overviews, waveform, checklist) under `$MEDIA/qc`. This allows the cut to be scanned fast BEFORE the final 120 approval.

Uses the `qc` verb, which was a loose helper running `after: "deliver"` before plan 196.

The pack also carries a **report-only** motion pass from the shared kit (`lib/qc-motion.mjs`):
`motion.md` lists dead beats (4s or more with no visible change on the cut) as warnings, and
`phone.jpg` is the cut at one frame a second, 360px wide. It never fails the step; read it
alongside the event sheets.

This step produces no files inside the `videos/<slug>/` folder (`external: true`).
