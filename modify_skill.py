import re

with open('.claude/skills/yt-video-edit/SKILL.md', 'r') as f:
    skill = f.read()

old_bullet = """- `simple` — steps 115 (author the cut list) → 125 (owner gate) → 135 (render).
  The cards are LOCKED (`pipelines/video/intro-kit/`, 7 of them). You pick and fill;
  you never design. Rulebook: `steps/115-author-intro-simple-llm/SIMPLE-PASS.md`.
  Taste: `TASTE-SIMPLE.md`. Pacing is ENFORCED by `lib/intro-kit/lint-cutlist.mjs`."""

new_bullet = """- `simple` — steps 115 (author the cut list) → 125 (owner gate) → 135 (render).
  Cards come from the SHARED body catalogue
  (`pipelines/video/card-library/catalog.json`) — the same one the cue pass
  uses, slugs are `"<type>/<card>"`. You pick and fill; you never design.
  Rulebook: `steps/115-author-intro-simple-llm/SIMPLE-PASS.md`. Taste:
  `TASTE-SIMPLE.md`. Pacing is ENFORCED by `lib/intro-kit/lint-cutlist.mjs`
  (S1-S5, S7 — S6 retired with the old kit)."""

skill = skill.replace(old_bullet, new_bullet)

old_phrase = "the `simple` flow is a locked kit of 7 cards (plan 219)"
new_phrase = "the `simple` flow picks from the shared body catalogue (plan 229)"
skill = skill.replace(old_phrase, new_phrase)

with open('.claude/skills/yt-video-edit/SKILL.md', 'w') as f:
    f.write(skill)
