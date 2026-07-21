# Video Design

## Resolving Cues
For beat cards, the cue anchor dictates absolute order, but the *first beat's absolute time* dictates placement, clamped to `BEAT_LEAD_IN` (0.6s) to guarantee no dead air.
