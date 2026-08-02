# 025-approve-screenplay-human

The owner reads `screenplay.json` and either approves it by setting a top-level `"approved": true`, or edits beats directly and re-runs the lint.

Commands:
```bash
bash run.sh <slug> lint
# Then manually edit videos/<slug>/screenplay.json to set "approved": true
```

This is the cheap gate — reading a beat sheet takes two minutes, re-rendering a wrong composition does not. Plan 182's authoring step refuses to run while `approved` is not `true`.
