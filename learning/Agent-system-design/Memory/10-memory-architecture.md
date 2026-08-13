# 10 — Memory architecture

## First fix: "memory" is four different things

Almost every design mistake here comes from conflating them.

| Layer | Lives in | Lifespan | Example |
|---|---|---|---|
| **Working** | the context window | this turn | the file you just read |
| **Session** | `messages[]` | this run | "earlier you said use Sonnet for workers" |
| **Long-term** | disk / DB | forever | "my channel never uses clickbait questions in titles" |
| **Knowledge** | a corpus you retrieve from | forever | 40 competitor transcripts |

> **Memory ≠ knowledge.** Memory is what was *learned or decided*. Knowledge is what *exists*.

Different storage, different retrieval, different invalidation. One system for both is the most common architecture error.

---

## The storage decision (most people get this wrong)

Instinct says "memory → vector database." Usually wrong.

| Your question shape | Store | Why |
|---|---|---|
| Exact lookup, filter, count, join | **SQLite** | "which tools have I covered?" is a `WHERE`, not a similarity search |
| Small, stable, always relevant | **a file, always loaded** | zero retrieval logic, zero failure modes |
| "Find text about X" across many docs | **grep / SQLite FTS5** | exact, debuggable, free |
| Fuzzy semantic across thousands of docs | **vector DB** | genuinely the only case |
| Structured facts you'll aggregate | **SQLite** | you'll want `AVG(ctr) GROUP BY title_style` |

Actual YT memory needs:

```
"which tools have I already reviewed?"       → SQLite    (exact)
"what's my channel voice?"                   → file      (always load)
"what did I tell the agent about hooks?"     → file      (always load)
"find where competitors discuss pricing"     → FTS5      (full-text)
"which title patterns got >8% CTR?"          → SQLite    (aggregate)
```

**Zero need embeddings.** You'd reach for vectors only at "semantically similar segments across 500 hours of transcript" — and even then FTS5 gets 80% for 5% of the complexity.

Start with files. Graduate to SQLite when you need to query. Vectors only when you've proven full-text isn't enough.

---

## Episodic vs semantic — the distinction that makes memory age well

**Episodic** — a thing that happened
> *"On 2026-07-12, the boss dispatch failed because the brief path was relative."*

**Semantic** — a rule extracted from it
> *"Dispatch briefs need absolute paths — the executor cd's into the worktree first."*

The episode is a log entry. The rule is memory. **Episodes age badly** (the specific run stops mattering); **rules age well** (true until the code changes).

**Workflow:** episode happens → extract the rule → store the rule → **delete the episode.**

`MEMORY.md`'s consolidation policy — *"any fact still true after a month gets promoted to its repo home and deleted here"* — is exactly this: episodic scratch → semantic durable, with a TTL. Most people never build that and their memory file becomes a swamp.

---

## Retrieval: how memory reaches the model

### 1. Always-loaded (an index)
```
memory/MEMORY.md      ← one line per memory, ~40 tokens each
```
The model sees titles + hooks and knows *what exists*. Progressive disclosure applied to memory.

**Budget: under ~2k tokens.** Past that it costs you on every turn of every session.

### 2. Model-fetched (a tool)
```python
{"name": "recall",
 "description": "Search long-term memory. Use when a task references past "
                "decisions, channel conventions, or prior video coverage.",
 "input_schema": {"path": "string"}}
```
Model reads the index, decides something's relevant, pulls the file. **This is the default you want.**

### 3. Auto-injected (harness decides)
Your code matches the incoming request against memories and injects before the model sees anything.

Powerful, but it's Channel 1 injection you don't control — and when retrieval is wrong the model reasons over irrelevant context without knowing why. Use sparingly.

---

## The hard part: invalidation

**A stale memory is worse than no memory** — the model trusts it and won't verify.

> *"Use `pp-yt upload --draft` to stage videos"* → flag renamed three months ago → the agent confidently runs a broken command forever.

### 1. Date everything, surface the date
```markdown
---
name: yt-upload-flow
written: 2026-05-02
---
```
Model sees "3 months ago" and calibrates trust.

### 2. Verify before recommending
*"If a memory names a file, function, or flag, confirm it still exists before acting on it."* Highest-value line in any memory system's own instructions.

### 3. Point, don't copy
```markdown
❌ "The pinterest cron runs 06:30 UTC via /opt/scripts/pin.sh"
✅ "Pinterest cron schedule + path: see VPS-CRONS.md"
```
Copied facts drift from their source. Pointers can't.

### 4. Promote and delete
Scratch cache → durable home → **remove from cache.** Anything in two places will disagree eventually.

### 5. Delete on contradiction, don't append
```markdown
❌ "Use Sonnet for workers.
    UPDATE 2026-06: actually Haiku.
    UPDATE 2026-07: back to Sonnet for research, Haiku for extraction."
✅ "Workers: Sonnet for research, Haiku for extraction."
```
Correction-stacking makes the model reconcile contradictions on every read. Rewrite the fact.

---

## The write path — who's allowed to remember?

Let the model write freely and within a month you have:
```
- "User seems to prefer concise responses"
- "User is working on a YouTube project"
- "User asked about agents on Tuesday"
```
Noise. Unfalsifiable. Loaded into every future session, costing tokens and diluting real memories.

**Three controls:**
1. **Constrain the schema** — force `{name, type, fact, why, how_to_apply}`. Vague observations don't fit a `how_to_apply` field.
2. **Gate the write** — model proposes, you confirm. Or auto-write to `pending/` and sweep weekly.
3. **Cap the size** — hard limit on index length, forcing promote-and-delete instead of infinite growth.

**A rule saying "don't save X" is worth more than any retrieval trick.** "Don't save what the repo already records" prevents most bloat.

---

## Memory is an injection surface — the worst one

A poisoned web page affects **one run**. A poisoned *memory* replays into **every future session** — and the model treats it as trusted first-party context, not untrusted fetched data.

```
untrusted page → worker reads it → worker writes a "learning" to memory
              → loads into every session for the next year
```

**Rule:** an agent that reads untrusted content must not have write access to long-term memory. Different agent, different tool set. Same least-capability principle as ch08.

---

## Concrete: memory for the video pipeline

```
memory/
  MEMORY.md              ← index, always loaded, <2k tokens
  voice.md               ← channel voice + banned phrases (always loaded)
  feedback-rules.md      ← semantic rules from review notes
  pending/               ← model-proposed, awaiting sweep

data/
  videos.db              ← SQLite
    videos(id, title, published, ctr, topic, tools_covered)
    corrections(video_id, note, rule_extracted, date)
```

| Agent asks | Source | Mode |
|---|---|---|
| "have I covered Windsurf?" | `videos.db` | tool call, exact |
| "what's my voice?" | `voice.md` | always loaded |
| "what did he say about hooks?" | `feedback-rules.md` | always loaded |
| "which titles worked?" | `videos.db` aggregate | tool call |
| "what did competitors say about pricing?" | transcripts + FTS5 | tool call |

**The compounding loop:** after each video review, extract *rules* from corrections, not the corrections themselves.

```
❌ "On video 41 he said the intro was too slow"
✅ "Intros: state the payoff within 12 seconds. Owner cuts anything slower."
```
One is an episode. The other makes the next script better.

---

## Five anti-patterns

1. **Vector DB by default.** You almost certainly want SQLite + a text file.
2. **Storing episodes instead of rules.** Logs aren't memory.
3. **Unbounded growth.** No size cap → the index eats your context budget every turn.
4. **Copying facts that live elsewhere.** Duplication guarantees drift.
5. **Untrusted-reading agents with memory write access.** Permanent injection.

---

## Exercise (45 min)

1. **List 8 things** the video pipeline should remember across runs. Raw. (10 min)
2. **Tag each** `episodic` or `semantic`. Rewrite every episodic one as a rule, or delete it. (10 min)
3. **Assign storage** — file / SQLite / FTS5. Count how many need a vector DB. (5 min)
4. **Write `voice.md`** with real channel rules. This one file improves every script the agent writes. (15 min)
5. **Add a `recall(path)` tool** to `mini.py` — reads a file from `memory/`. Five lines. (5 min)

**The number to notice at step 3:** almost certainly zero.
