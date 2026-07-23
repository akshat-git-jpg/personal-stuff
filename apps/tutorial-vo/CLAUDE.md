# Operate Notes

- Policy constants (`TAKES_MAX`, `SPOKEN_MAX`) live in `src/worker/logic.ts`.
- Publish merge rule: same-version publish preserves takes/lock/respelled text; version bump resets everything to fresh.
- The pipeline side lives in `tutorial-pipeline-3` steps `050-publish-ui`.
