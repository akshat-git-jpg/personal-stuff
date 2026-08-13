# 07 — Orchestration topologies

This is the chapter that actually means "AI agent system design": given a task, what *shape* should the system be?

**Running example:** *"Research the top 10 AI coding tools right now, then write a 9-minute video script comparing them, plus a title and thumbnail brief."*

Rough sizes (illustrative but realistic):
- One tool = 3 web pages + 1 competitor transcript ≈ **25k tokens**
- 10 tools = **250k tokens of raw input**

---

## Meta-rule: don't use a model as a for-loop

> If the inputs fully determine the output, that step is **code** — not a model call.

You have 40 transcripts in `dossiers/videos/`. You want every tool mentioned.

### ❌ What people build
```
for each of 40 transcripts:
    ask model: "list the tools mentioned"
merge, dedupe, count  ← also asked the model
```
40 calls, ~15 min, ~$4, and dedupe is unreliable — "Claude Code" / "claude code" / "Claude-Code" get counted separately depending on the model's mood.

### ✅ What you build
```python
# code: mechanical extraction
hits = Counter()
for f in transcripts:
    for tool in KNOWN_TOOLS:                # regex/alias table
        if tool.pattern.search(f.read_text()):
            hits[tool.canonical] += 1

# ONE model call: the genuinely ambiguous part
ask model: f"""Mention counts: {hits}. Which 10 belong in a 2026
comparison video, and why? Flag anything that looks like hype vs
real adoption."""
```
1 call, 20 seconds, ~$0.05, exact counts.

**The test:** for each model call, ask *"do the inputs fully determine the output?"* If yes → that's code. Model calls are for judgment, not iteration.

---

# Shape 1 — Single loop

```
you → [ agent ⟳ web_search, fetch, transcribe, write_file ] → script.md
```

**When:** one coherent task that fits in one context. **This is the default** — don't leave it without a reason.

**Where it breaks on our example:** by tool #7 the context holds 180k tokens of raw docs.

1. **Context rot** — tool #1's details are buried 150k back. Comparison gets vague about early tools, sharp about late ones.
2. **Cost compounds.** Every turn re-uploads the growing history. 38 turns averaging ~140k input ≈ **5.3M input tokens ≈ $27** for one script.
3. **Serial.** ~25 min wall-clock.

**Still right for:** *"research Cursor, write a 2-minute script."* Six turns, done.

---

# Shape 2 — Pipeline

You already know the steps for a video. Encode them in code; model calls are stations.

```
research.json → outline.md → script.md → hook.md → thumb-brief.md
      ↑ code       ↑ code      ↑ code      ↑ code
```

```python
research = agent("Research these 10 tools", tools=[search, fetch], schema=RESEARCH)
save("research.json", research)                      # ← checkpoint

outline  = agent(f"Outline a 9-min script from: {research.summaries}")
save("outline.md", outline)                          # ← checkpoint

script   = agent(f"Write the script. Outline: {outline}. Facts: {research}")
save("script.md", script)

hook     = agent(f"Write 3 hook options for: {script[:800]}")
thumb    = agent(f"Thumbnail brief for: {hook.winner}")
```

**Why it's underrated:**

- **Checkpoints.** Script flat? Re-run from `outline.md`. Don't re-pay for research.
- **Testable.** Fixed input per stage → eval each in isolation.
- **Cheap.** Script stage sees 3k of summaries, not 250k of raw pages.
- **Debuggable.** Bad output → you know which stage.

This is what the `plans/` + executor pattern already is.

**Wrong when:** you don't know the steps. *"Figure out why this video underperformed"* is an investigation; a pipeline forces a shape onto it.

---

# Shape 3 — Orchestrator–worker (fan-out)

```
                    ┌─ researcher: Cursor      ─┐
                    ├─ researcher: Claude Code  ─┤
orchestrator ───────┼─ researcher: Copilot      ─┼──→ 10 briefs → script
                    ├─ researcher: Windsurf     ─┤
                    └─ ...6 more                ─┘
```

Each worker gets a **fresh, empty context window**, tools `[web_search, fetch]`, and a brief:
> *"Research \<tool\>. Return: pricing, standout feature, biggest complaint, who it's for. 200 words max. Cite a URL per claim."*

Each returns **~250 tokens**. It burned 25k reading — but that 25k **dies with the worker**.

The orchestrator holds `10 × 250 = 2,500 tokens` of briefs. It never sees a raw web page.

| | Single loop | Fan-out |
|---|---|---|
| Orchestrator context peak | ~250k | **~5k** |
| Wall-clock | ~25 min | **~4 min** |
| Total input tokens | ~5.3M | ~1.4M |
| Cost @ Opus | ~$27 | **~$7** |
| Cost, workers on Sonnet | — | **~$3** |

Cheaper *and* faster *and* higher quality — because the orchestrator reasons over clean summaries.

### Two traps

**Trap 1 — workers share the filesystem, not the conversation.**
```
❌ delegate("research the next one")
   → "the next what? which tool? what format?"

✅ delegate("""Research the AI coding tool 'Windsurf'.
   Return exactly: pricing tiers, standout feature, biggest recurring
   complaint, target user. 200 words. One source URL per claim.
   Write to dossiers/windsurf.md and report the path.""")
```
Every worker starts from zero. Over-brief them.

**Trap 2 — model tiering.** Workers do reading and extracting: high-input, low-judgment → **Haiku or Sonnet**. Keep Opus for synthesis and the script. Most of the cost saving above comes from this.

**Wrong when:** subtasks aren't independent. "Write section 3" depends on section 2's tone.

---

# Shape 4 — Judge panel

Use for the **title and hook**, not the script. A script has one broadly correct shape; a title has a thousand, and the difference is your entire CTR.

```
                     ┌─ angle: curiosity gap  ─┐
script summary ──────┼─ angle: contrarian      ─┼──→ 3 judges score ──→ winner
                     ├─ angle: outcome-promise ─┤        │
                     ├─ angle: number/listicle ─┤        └─ graft best bits
                     └─ angle: personal stakes ─┘             from runners-up
```

**Generators** — 5 parallel calls, each with a *different explicit angle*. Same prompt five times gives five near-identical titles; different angles force real spread.

**Judges** — 3 parallel calls, each a *different lens*:
- *"Would I click this at 3am? Curiosity 1–10."*
- *"Does this promise what the script delivers? Honesty 1–10."*
- *"Readable at thumbnail size on a phone? Clarity 1–10."*

**Cost:** 8 small calls ≈ $0.30, against a title that decides whether 200k people see the video. Best-value shape in the whole pipeline.

**Wrong when:** narrow-answer tasks. "What's this file's line count" has one right answer.

---

# Shape 5 — Loop-until-dry

You said "top 10 tools." How do you know it's 10 and not 14? You don't — you're guessing at the size of the work.

```python
seen, keep = set(), []
dry_rounds = 0

while dry_rounds < 2:                      # stop after 2 empty rounds
    found = parallel([                     # 4 finders, different angles
        agent("Search reddit/HN for AI coding tools people actually use"),
        agent("Search 2026 'best AI coding tool' listicles"),
        agent("Scan our dossier transcripts for tools mentioned"),
        agent("Check GitHub trending + Product Hunt for new entrants"),
    ])

    fresh = [t for t in flatten(found) if canonical(t) not in seen]
    if not fresh:
        dry_rounds += 1
        continue
    dry_rounds = 0
    seen.update(canonical(t) for t in fresh)          # ← seen, not keep

    for tool in fresh:
        v = agent(f"Is {tool} real, actively maintained, used by >1k devs? Cite evidence.")
        if v.legit:
            keep.append(tool)
```

Round 1: 9 tools. Round 2: 4 more (2 real, 2 vapourware killed by the verifier). Round 3: 1. Rounds 4–5: nothing → stop. You end with 12, and you know you stopped because the well ran dry.

### The trap that matters
```python
seen.update(fresh)     # ✅ everything encountered
keep.append(tool)      # ✅ only what survived verification
```
Dedupe against `keep` and the 2 vapourware tools get re-found and re-verified **every round**. It never converges. Subtle and universal — it's most "why does my agent loop forever" reports.

**Multi-modal finders matter:** four finders each searching a *different way* find things one angle structurally cannot.

---

# The real system: composed

```
┌──────────────────────────────────────────────────────────────┐
│  PIPELINE (code owns the flow, checkpoints between stages)   │
│                                                              │
│  Stage 1: DISCOVER          loop-until-dry                   │
│           ↓ tools.json ← checkpoint                          │
│  Stage 2: RESEARCH          orchestrator-worker (Sonnet)     │
│           ↓ research.json ← checkpoint                       │
│  Stage 3: DEDUPE + RANK     ██ PLAIN CODE ██ (no model)      │
│           ↓                                                  │
│  Stage 4: OUTLINE           single loop (Opus)               │
│           ↓ outline.md ← checkpoint                          │
│  Stage 5: SCRIPT            single loop (Opus)               │
│           ↓ script.md ← checkpoint                           │
│  Stage 6: TITLE + THUMB     judge panel                      │
│  Stage 7: FACT-CHECK        fan-out, 1 worker per claim      │
└──────────────────────────────────────────────────────────────┘
```

Read the choices back:

- **Discover** → unknown size → loop-until-dry
- **Research** → independent + context-heavy → fan-out, cheap model
- **Dedupe** → inputs determine output → **code**
- **Outline/Script** → one coherent creative task → single loop, best model
- **Title** → wide space, quality critical → judge panel
- **Fact-check** → N independent claims → fan-out

Each choice falls out of one question about the work. **That's the skill** — not memorising shapes, but reading the work and knowing which question to ask.

---

## Pick by question

| Ask yourself | Shape |
|---|---|
| Do I already know the steps? | **Pipeline** |
| Is it one task, one context? | **Single loop** |
| Is the work independent and parallel? | **Orchestrator–worker** |
| Is the space wide, quality critical? | **Judge panel** |
| Do I not know how much work there is? | **Loop-until-dry** |

---

## The barrier trap

Stage 2 → Stage 4 is a **barrier**: nothing moves until all 10 researchers finish.

```
Cursor      ██                       done 0:40
Copilot     ███                      done 1:00
Claude Code ████████████████████     done 6:30  ← 22k-token transcript
                                     ↓
                        outline starts 6:30
```
Nine workers idle for five minutes.

**Correct here?** Yes — the outline genuinely needs all 10 briefs to rank and structure them.

**Wrong at Stage 7** — each claim is independent. Don't wait for all 40 claims to be extracted before verifying any. Pipeline them.

**The test:** does the next stage need *all* prior results **together**? Dedup across the full set — yes. Early-exit on a count — yes. "I need to flatten the list first" — **no**, do that inside a stage.

---

## Cost and latency, same task

| Shape | Wall-clock | Input tokens | Cost | Quality |
|---|---|---|---|---|
| Single loop, Opus | 25 min | 5.3M | ~$27 | vague on early tools |
| Pipeline, Opus | 18 min | 1.9M | ~$10 | good, re-runnable |
| + fan-out research | **6 min** | 1.4M | ~$7 | **better** |
| + Sonnet workers | 5 min | 1.4M | **~$3** | same |
| + judge panel on title | 6 min | 1.5M | ~$3.30 | much better title |

Final row: **8× cheaper, 4× faster, and better.** None of it from a better model. All of it from shape.

---

## Exercise (90 min, two sittings)

**Sitting 1 — the fan-out**
1. Add `delegate(brief, model)` to `mini.py` — your loop calling itself with a fresh `messages` list and a cheaper model. ~12 lines.
2. Task: *"For each of these 5 tools, write a 200-word brief to `briefs/<tool>.md`."*
3. Run as **single loop**. Log turns, input tokens, wall-clock.
4. Run as **fan-out**. Log the same, plus orchestrator peak context.

**Sitting 2 — the judge panel**
5. Generate 5 titles from 5 named angles.
6. Score with 3 judges on 3 named lenses.
7. Read the losers. Would a single generate-once call have produced the winner?

**Expected finding:** fan-out uses more *total* tokens and dramatically less *orchestrator* context. That trade is the entire reason subagents exist.
