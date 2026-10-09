# 040-polish-lint

Run order:
1. Claude session executes `rulebook.md` on the verified script.
2. `node lib/lint-script.mjs videos/<slug>/script.json --stage polished` must exit 0.
3. `node lib/set-stage.mjs <slug> polished`.
4. `node lib/set-stage.mjs <slug> tts` when the owner is ready to publish to the UI.
