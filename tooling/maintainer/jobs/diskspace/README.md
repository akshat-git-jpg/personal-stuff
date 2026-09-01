# diskspace

This job answers one question: **how much of the working tree is gitignored bulk, and which of it can safely go.**

It is about the checkout on this machine, not about git. Nothing it reports is in a commit, in the pack, or in a clone. Reclaiming here changes one laptop's free space and nothing else.

## Why it is separate from `bigfiles` and `artifacts`

| Job | Looks at | Driven by |
|---|---|---|
| `bigfiles` | files **tracked** at HEAD, plus history bloat | file size vs the 4 MB push limit |
| `artifacts` | leftovers of **one published video** | the tracker's `yt_link` + upload status |
| `diskspace` | **gitignored** paths anywhere in the tree | total bytes and staleness |

`bigfiles` already prints oversized untracked *files*. It stops there on purpose: it does not size *directories*, so a 4.8 GB `assembly-cache/` made of 12,000 small files is invisible to it. That gap is this job.

## The four classes

Every gitignored path is sorted into one of four classes. The class, not the size, decides what may happen to it.

| Class | Comes back how | Action |
|---|---|---|
| `CACHE` | by itself, on the next run | delete, once approved |
| `REBUILD` | one documented command | delete, once approved, **command quoted in the proposal** |
| `DERIVED` | a pipeline re-run that costs time or money | archive, and only when stale |
| `KEEP` | it does not | never proposed, ever |

## The danger this job exists to contain

Gitignored does **not** mean disposable. The same `git status --ignored` list that holds 11 GB of dead model weights also holds `.dev.vars`, `.mcp.json`, `config.json`, `seed.sql`, and every owner-recorded screen capture under `videos/*/src/`. None of those have a copy in git. A blanket "clean the ignored files" is a data-loss event.

So the classifier is an **allowlist of things that may go**, not a denylist of things that may not. An unrecognised path lands in `KEEP` and is reported as unclassified. Silence is never permission.

See [`runbook.md`](runbook.md) for the class rules, the staleness gate, and the archive path.
