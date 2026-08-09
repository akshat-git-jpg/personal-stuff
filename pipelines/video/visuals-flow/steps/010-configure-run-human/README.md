# 010 · configure the run · [OWNER]

The owner's Drive delivery choices for this video, recorded in
`videos/<slug>/run-config.json`.

- **In:** the owner's Drive folder + account for delivery (optional)
- **Out:** `videos/<slug>/run-config.json`
- **Skip when:** the owner doesn't state a preference — then no file is
  written and step 150 falls back to its own defaults.
- **Next:** `run.sh <slug> transcribe` (step 010)

```bash
bash run.sh <slug> configure --drive-folder <id> --drive-account <email>   # set
bash run.sh <slug> configure                                               # show
```

## What used to live here

The HeyGen engine choice (`--engine heygen3|heygen4`) and the review mode
(`--review full|express`) were both asked at kickoff, twenty-plus steps before
either decision had anything real to be judged against:

- **Review mode** was removed 2026-08-07 (plan 194) — every board gate is real
  now, and the intro is always the bespoke film.
- **Engine** was removed 2026-08-07 (plan 197) — it pre-authorised metered
  HeyGen spend against a clip count nobody had computed yet. That decision now
  belongs to the **avatar spend gate** (step 102, `lib/avatar-plan.mjs`), which
  proposes character + model + clip count + cost from `shots.resolved.json`'s
  real numbers, and gates every HeyGen submission on the owner's approval —
  see `steps/420-propose-avatar-human/`.

`run-config.json` holds only source/delivery fields now
(`drive_folder`/`drive_account`).
