# Plan 023: voice-autoqc must FLAG missing/failed TTS clips instead of silently dropping them

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 671741e..HEAD -- pipelines/youtube/kushal-tutorial-pipeline-v2/steps/105-voice-autoqc-run/run.py`
> On any drift, compare excerpts below against live code; mismatch = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Executor**: antigravity
- **Difficulty**: mechanical
- **Planned at**: commit `671741e`, 2026-07-05

## Why this matters

Step 105 of the tutorial pipeline QCs synthesized voice clips so "the human
gate only listens to flags" (its own docstring). But a chunk whose `.wav` was
never produced (TTS crash, partial run of step 080) is `continue`d out of BOTH
loops — it appears in the output JSON as **nothing at all**: not a pass, not a
flag. The human reviewer at the next gate sees only flags, so a script line
that was never voiced ships silently missing from the final voiceover.

After this plan: every chunk in `chunks.json` gets exactly one entry in the
QC output; missing clips are `"flag"` with reason `"clip missing / synthesis failed"`,
and the script fails loud if the output entry count ever diverges from the
chunk count.

## Current state

File: `pipelines/youtube/kushal-tutorial-pipeline-v2/steps/105-voice-autoqc-run/run.py`
(pure Python 3 stdlib + local `lib.asr`/`lib.audio`; run as
`python3 run.py --base <name> [--skip-wer]`).

- In: `../080-synthesize-voice-run/output/<base>.work/{clips/*.wav, chunks.json}`
- Out: `./output/<base>.voice-qc.json` mapping chunk id → `{"verdict": "pass"|"flag", "reasons": [...]}`

The two drop sites (excerpts, exact current code):

```python
    # measurement loop
    for c in chunks:
        cid = c["id"]
        wav_path = clips_dir / f"{cid}.wav"
        if not wav_path.exists(): continue      # <-- drop site 1
        ...
        c["_wav"] = wav_path
```

```python
    # verdict loop
    for c in chunks:
        cid = c["id"]
        if "_wav" not in c: continue            # <-- drop site 2
        reasons = []
        ...
        results[cid] = {"verdict": verdict, "reasons": reasons}
```

Tail of the file (for orientation — the writing + summary print):

```python
    with open(out_file, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nQC complete. Pass: {pass_count}, Flag: {flag_count}")
    for cid, data in results.items():
        if data["verdict"] == "flag":
            print(f"  {cid}: {', '.join(data['reasons'])}")
```

Also present: `if not mean_dbs: sys.exit("✖ no clips found")` after the
measurement loop — keep that (all-clips-missing is still a hard error).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax check | `python3 -m py_compile pipelines/youtube/kushal-tutorial-pipeline-v2/steps/105-voice-autoqc-run/run.py` | exit 0 |
| Synthetic run (built in test plan below) | see Test plan | flags missing clip |

## Scope

**In scope**:
- `pipelines/youtube/kushal-tutorial-pipeline-v2/steps/105-voice-autoqc-run/run.py`

**Out of scope**:
- Step 080 (synthesis) and every other step folder.
- `lib/asr.py`, `lib/audio.py`.
- Thresholds (`WER_FLAG`, `LOUD_DB_DELTA`, `PACE_BAND`, `CLIP_PEAK_COUNT`) — do not tune.

## Git workflow

- Branch: `advisor/023-voice-autoqc-missing-clips`
- Commit: `fix(tutorial-pipeline): 105 flags missing TTS clips instead of dropping them` — no AI footers. Do NOT push.

## Steps

### Step 1: Flag missing clips in the verdict loop

In the verdict loop, replace `if "_wav" not in c: continue` with:

```python
        if "_wav" not in c:
            results[cid] = {"verdict": "flag", "reasons": ["clip missing / synthesis failed"]}
            flag_count += 1
            continue
```

(The measurement loop's `continue` at drop site 1 can stay — it only skips
measurement; the verdict loop now catches the chunk.)

**Verify**: `python3 -m py_compile .../run.py` → exit 0 (use the full path from
the table above).

### Step 2: Reconcile counts before writing

Immediately before `with open(out_file, "w")`, add:

```python
    if len(results) != len(chunks):
        missing = [c["id"] for c in chunks if c["id"] not in results]
        sys.exit(f"✖ QC bug: {len(results)} results for {len(chunks)} chunks; unaccounted: {missing}")
```

**Verify**: `python3 -m py_compile .../run.py` → exit 0.

## Test plan

No test suite exists for pipeline steps (repo policy: manual smoke tests).
Smoke it synthetically without ffmpeg/Groq:

1. Create a scratch work dir matching the expected layout:
   ```bash
   cd pipelines/youtube/kushal-tutorial-pipeline-v2
   mkdir -p steps/080-synthesize-voice-run/output/plantest.work/clips
   printf '[{"id":"c1","text":"hello world"},{"id":"c2","text":"second line"}]' \
     > steps/080-synthesize-voice-run/output/plantest.work/chunks.json
   ```
2. Give c1 a real (tiny, silent) wav so the "no clips found" guard passes:
   ```bash
   python3 - <<'EOF'
   import wave, struct
   with wave.open("steps/080-synthesize-voice-run/output/plantest.work/clips/c1.wav","w") as w:
       w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)
       w.writeframes(struct.pack("<h", 0) * 16000)
   EOF
   ```
   (c2 deliberately has NO wav.)
3. Run: `python3 steps/105-voice-autoqc-run/run.py --base plantest --skip-wer`
   — requires `ffmpeg` on PATH for c1's loudness probe (`which ffmpeg` first;
   if absent, STOP condition below).
4. Assert: `steps/105-voice-autoqc-run/output/plantest.voice-qc.json` contains
   an entry for **both** c1 and c2, and c2 is
   `{"verdict": "flag", "reasons": ["clip missing / synthesis failed"]}`.
5. Clean up: delete `steps/080-synthesize-voice-run/output/plantest.work/` and
   `steps/105-voice-autoqc-run/output/plantest.voice-qc.json`. Neither may be
   committed.

## Done criteria

- [ ] `python3 -m py_compile` exits 0 on run.py
- [ ] Synthetic run: c2 appears as a flag with reason `clip missing / synthesis failed`
- [ ] Synthetic run: total entries in output JSON == entries in chunks.json
- [ ] Scratch artifacts deleted; `git status` shows only `run.py` modified (plus `plans/README.md`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `ffmpeg` is not on PATH (the smoke test can't run — report; do not fake the
  verification).
- The live code at the two drop sites doesn't match the excerpts.
- Any real `<base>.work` directories exist that your scratch names could
  collide with (`plantest` should be safe — if it exists, pick another name).

## Maintenance notes

- Step 080 writing partial clips (zero-byte wav) would still pass existence —
  if that ever happens in practice, extend the check to `stat().st_size > 44`.
- The reconciliation guard means any future refactor that reintroduces a drop
  dies loudly instead of shipping a silent hole.
