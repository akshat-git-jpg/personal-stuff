with open('pipelines/video/visuals-flow/TASTE-SIMPLE.md', 'r') as f:
    taste = f.read()

# 8a
taste = taste.replace("`simple` picks and fills from seven locked cards and prizes legibility and repeatability",
                      "`simple` picks and fills from the shared body card catalogue and prizes legibility and repeatability")

# 8b
taste = taste.replace("`S4` in the pacing lint checks that a card's `vars` satisfy its kit contract",
                      "`S4` in the pacing lint checks that a card's `vars` satisfy its catalog contract")

# append rule S-T8
rule_t8 = """
## S-T8 — A truncation notice is information, not a defect to design around.

Body cards were built for 4-15s and an intro beat runs 1.5-4.0s, so almost
every card raises `NOTICE truncation`. Do not pick a card because it notices
less, and do not stretch a beat past its spoken line to silence one. Pick the
card that says the right thing; the notice tells the owner where to look in the
render.

**From:** owner decision, 2026-08-23 — swap the intro onto the body catalogue
first and fix the cards that actually look wrong, rather than retrofitting all
68 up front.

**Enforced by:** author judgement (the notice itself is non-blocking by
design).
"""
if "S-T8" not in taste:
    taste += rule_t8

with open('pipelines/video/visuals-flow/TASTE-SIMPLE.md', 'w') as f:
    f.write(taste)

