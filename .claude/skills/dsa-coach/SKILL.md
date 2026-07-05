---
name: dsa-coach
description: DSA learning workflow for learning/DSA in personal-stuff. Use for any data-structures/algorithms learning ask — explain a topic or pattern with intuition, build a sequenced problem list, create or update notes. Triggers on "explain <dsa topic>", "leetcode problems for <topic>", "DSA notes", "add to my DSA folder", "help me learn <algorithm>", "dsa-coach".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# DSA Coach

Conventions for all DSA learning work. Notes live in `learning/DSA/<topic>/`
(kebab-case topic folders, one per topic).

## How he learns (follow this exactly)

- **Intuition first.** Explain WHY a technique works before any code — build a
  mental picture he can visualize (pointers moving, buckets filling). Use one
  canonical problem as the anchor (e.g. Dutch National Flag for 3 pointers).
- **To the point.** No preamble, no history, no exhaustive variants. He has
  explicitly asked for "keep it to the point" — short files beat complete ones.
- **Common confusions addressed head-on.** Each explanation names the 2-3
  places people get confused and resolves them.

## File conventions in learning/DSA/

- **Problem lists:** a plain md file of leetcode links ONLY, in
  learn-this-order sequence (easy → hard within the topic). No solutions, no
  descriptions — just the ordered links. Name it `problems.md` inside the
  topic folder.
- **Topic notes:** `notes.md` inside the topic folder — intuition, the anchor
  problem walkthrough, the confusion list, and a minimal code template.
- **Curriculum:** the master sequence file lives at `learning/DSA/` root —
  update it when adding a new topic folder rather than creating a second list.

## When solving a problem together

Ask him to attempt the approach verbally first; confirm or correct the
intuition before writing code. Code answers stay minimal — one clean solution,
complexity in one line, no alternative implementations unless asked.
