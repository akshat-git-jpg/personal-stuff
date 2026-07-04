---
name: scout
description: Evaluate an external tool, repo, service, or business idea FOR THIS USER — grounded in his actual stack, active bets, and costs, not generic pros/cons. Use when the user shares a URL, repo, tweet, or product and asks "check this", "is this useful to us/me?", "pros and cons?", "should I use this?", "is X a good idea to make money?", "what's this tool/repo?". Verdict-first.
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# Scout — "is this thing useful to ME?"

The user constantly evaluates tools, repos, and money-making ideas. A generic
pros/cons list wastes his time — the only question that matters is fit with what
he already runs and what he's trying to do.

## Procedure

1. **Ground first.** Read `context/CLAUDE.md` in personal-stuff (who he is,
   active bets, product inventory). If the thing touches hosting/infra, skim
   `INFRA.md`; if it overlaps an existing tool, check `tooling/` and
   `my-hosted-sites.md` for what it would duplicate.
2. **Research just enough to judge.** WebFetch/WebSearch the thing itself —
   what it does, pricing, maintenance status (last commit, stars trend if a
   repo). Stop when you can render a verdict; don't write a report.
3. **Answer verdict-first**, in this shape:
   - **Verdict:** Adopt / Try / Skip / Watch — one line with the core reason.
   - **Fit:** what it would replace, duplicate, or complement in HIS stack —
     name the existing piece (e.g. "you already have this via rtk / pp-gmail /
     the redirector Worker").
   - **Cost:** money, setup time, maintenance burden, and token/context cost
     if it's an AI-workflow tool.
   - **If Adopt/Try:** the one concrete next step (command, folder, or plan).
4. Keep the whole answer under ~250 words unless he asks for depth. For
   money-making ideas, weigh against his active bets (YouTube, Pinterest,
   income pipelines) — say if it competes for the same time budget.

## Don'ts

- No generic feature lists or "many developers find…" filler.
- Don't recommend building/buying anything without naming what existing asset
  it overlaps.
- If the verdict is Skip, say so in the first line — don't soften it.
