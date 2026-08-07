# 520 · review the assembled cut · [RUN]

Builds a QC filmstrip pack (event sheets, overviews, waveform, checklist) under `$MEDIA/qc`. This allows the cut to be scanned fast BEFORE the final 120 approval.

Uses the `qc` verb, which was a loose helper running `after: "deliver"` before plan 196.

This step produces no files inside the `videos/<slug>/` folder (`external: true`).
