# 020-script-gen

How to run the step:
- Open a Claude Code session (Sonnet default)
- Fill `prompt.md`'s placeholders
- Output is `videos/<slug>/script.json` + `script.md`
- The session must run `node lib/lint-script.mjs videos/<slug>/script.json` and fix errors before finishing.
