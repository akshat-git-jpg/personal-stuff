# 060 · plan-avatar-blocks  ·  [ANTIGRAVITY] + [HUMAN review]

Decide which passages the **full-screen HeyGen 4 avatar** speaks — *before* TTS — so step 080 can
chunk the audio to clean block boundaries. U-curve toward a ~5-min budget (knobs in the rulebook).

- **In:** `../040-polish-script-for-delivery-sonnet/output/<base>.improved.txt`
- **Out:** `output/<base>.avatar-plan.md` (the review doc) → **you review & approve** →
  `output/<base>.avatar-segments.json` (the handoff step 080 consumes)
- **How:** Claude drafts per `rulebook.md`; you give feedback in plain language; iterate until approved. No GPU yet.
- **Next:** step 080 reads the `.avatar-segments.json`
