#!/usr/bin/env python3
"""Write Claude's per-note status back to the reviewer (the page polls claude_status.json and
shows ✓ done / ✗ skipped / ❓ question live on each note).

Usage:
  post_status.py <review_dir> <label> <items_json>
  post_status.py ~/Downloads/NO_SIGNAL-Review "NO_SIGNAL · v16" '{"<noteId>":{"status":"fixed","message":"pushed the clip 5s later"}}'

items_json maps each note's id (from feedback_latest.json) to:
  {"status": "fixed" | "skipped" | "question", "message": "..."}
- fixed    → ✓ green, message = what you changed
- skipped  → ✗ grey,  message = why you didn't
- question → ❓ amber, message = the clarifying question (Luuk gets an inline reply box)
Only ask a question when the note is genuinely too vague to act on — an editor asks before guessing.
"""
import sys, json, time, os
if len(sys.argv) != 4:
    sys.exit(__doc__)
d, label, items = os.path.expanduser(sys.argv[1]), sys.argv[2], json.loads(sys.argv[3])
out = {"label": label, "ts": int(time.time()), "items": items}
p = os.path.join(d, "claude_status.json")
json.dump(out, open(p, "w", encoding="utf-8"), indent=1)
n_ask = sum(1 for v in items.values() if v.get("status") == "question")
print(f"wrote {p} — {len(items)} notes ({n_ask} question{'s' if n_ask!=1 else ''})")
