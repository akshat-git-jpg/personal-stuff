# 030-verify-tm

Owner sends `script.md` to the tutorial maker (Drive doc); the tutorial maker resolves every FLAG line and corrects anything the live tool contradicts, writing rough notes inline; a Claude session applies the returned edits into `script.json` **using `applyTextEdit` semantics** (never hand-editing version/tts fields), re-runs `node lib/render-script-md.mjs <slug>`, then `node lib/set-stage.mjs <slug> verified`. In UI v2 this step moves into the web UI (plan 132's successor), which is why it stays deliberately thin here.
