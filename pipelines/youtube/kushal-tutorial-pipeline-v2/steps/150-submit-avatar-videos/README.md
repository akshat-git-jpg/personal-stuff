# 150 · submit-avatar-videos  ·  [RUN]  (spends / ban-risk)

Submit the HeyGen avatar renders via your **web session** (drop in cookies/auth at run time).
Two thin per-flow entrypoints; clips are already render-ready upstream, so **no chunking here** —
just submit (**no polling**). Downloading the finished videos is **step 160**.

- **`run-a4.py`** — full-screen blocks. In: `../080-synthesize-voice/output/avatar-audio/*.wav`
  (one render per block). Records jobs named `<base>__a4__<block>`.
- **`run-a3.py`** — corner talking-head. In: `../090-plan-corner-render-parts/output/corner-parts/*.wav`
  (≤7-min parts). Records jobs named `<base>__a3__corner[-pNN]`.

```bash
python3 run-a4.py [<base>]                 # submit full-screen renders (no polling), then stop
python3 run-a3.py [<base>]                 # submit corner renders
# then check HeyGen yourself; when renders finish, download them in step 160.
```

- **Manifest:** `output/<base>.heygen-manifest.json` (every job: flow, audio, video_id, status) —
  step 160 reads this as its download checklist.
- **Usage log:** `output/<base>.usage-log.md` (credits Δ before+after every batch; a3 should be Δ0, a4 metered).
- **Config:** `../../shared/heygen_config.py` — per-flow avatar_id + anti-ban pacing.

## Anti-ban (built in)
Concurrency 1 · randomized human gaps · periodic long "settle" breaks · optional `max_per_run`
cap so big jobs span days · one reused session · **no polling** · back-off on error. Slower on purpose.

## Status: scaffold + stubs
Submit is a **stub** — the web-session render endpoint was never captured. Fill
`lib/heygen.py` `WebSessionBackend.submit` from a HAR (`TODO[HNS]`). Until then jobs record as
`stub-not-wired` so you can see the full plan/naming without spending. Session goes at
`../../shared/heygen-session.json` (gitignored).
