#!/usr/bin/env python3
"""
Step 080 — synthesize the voiceover (jamila brand voice, IndexTTS-2 on Modal).  [RUN]

  python3 run.py [<input>] [--chunk-seconds 20] [--interval-silence 150] [--discard-clips]
  python3 run.py [<input>] --only 0042,0043     # redo loop: re-synth just these chunks
  python3 run.py [<input>] --index              # rebuild the timeline only, no synth

Input (default: step 060's output):
  • <base>.avatar-segments.json  → AVATAR-AWARE mode: chunks each segment independently so every
    avatar block is a whole number of clean chunks. Also emits per-block audio + the avatar doc.
  • <base>.improved.txt          → plain mode: one continuous voiceover, no avatar blocks.

What runs WHERE:  local chunks → Modal GPU synth (lib/modal_tts) → local stitch.
Output:
  output/<base>.voice.wav                 the continuous voiceover (all chunks stitched)
  output/avatar-audio/<seg>.wav           one clean clip per avatar block (avatar-aware mode)
  output/<base>.avatar-fullscreen.md      the HeyGen 4 script (timestamps + verbatim lines)
  output/<base>.work/                     kept by default: clips/0000.wav…, chunks.json, index.txt

Redo loop: clips are kept, so re-synthing one flagged chunk costs one chunk of GPU, not the
whole video. Avatar audio is rebuilt automatically after any re-synth.
"""
import sys, re, json, argparse, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parents[2]          # kushal-tutorial-pipeline-v2/
sys.path.insert(0, str(ROOT))
from lib import audio, chunking, modal_tts                   # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
PREV = ROOT / "steps/060-plan-avatar-blocks-antigravity/output"
DEFAULT_REF = ROOT / "shared/ref/jamila-30s.wav"
WPS = chunking.WPS


def die(m): raise SystemExit("✖ " + m)


def load_chunks(inp, chunk_seconds):
    """Return (chunks, avatar_mode). .json => avatar-aware segments; else plain text."""
    if inp.suffix == ".json":
        segs = json.loads(inp.read_text())
        return chunking.chunk_segments(segs, chunk_seconds), True
    return chunking.chunk(inp.read_text(), chunk_seconds), False


def write_index(clip_dir, chunks, out_path):
    text_by_id = {c["id"]: c["text"] for c in chunks}
    role_by_id = {c["id"]: c.get("role", "body") for c in chunks}
    t, lines = 0.0, []
    for w in sorted(clip_dir.glob("*.wav")):
        d = audio.dur(w)
        tag = "🧍" if role_by_id.get(w.stem) == "avatar" else "  "
        preview = " ".join(text_by_id.get(w.stem, "").split()[:8])
        lines.append(f"{w.stem} {tag} {audio.mmss(t)}–{audio.mmss(t + d)}  \"{preview}…\"")
        t += d
    out_path.write_text("\n".join(lines) + "\n")
    return out_path


def stitch(clip_dir, out_wav):
    wavs = sorted(clip_dir.glob("*.wav"))
    if not wavs:
        die("no wavs in clip dir — did the synth run?")
    audio.concat(wavs, out_wav)
    return len(wavs)


def write_avatar_outputs(chunks, clip_dir, out_dir, base):
    """For each avatar segment: concat its chunk clips → avatar-audio/<seg>.wav, and write the
    avatar-fullscreen.md doc (timestamps in the stitched voice + verbatim lines)."""
    if not any(c.get("role") == "avatar" for c in chunks):
        return None
    # cumulative timing across the stitched voice
    start, end, t = {}, {}, 0.0
    for c in chunks:
        d = audio.dur(clip_dir / f"{c['id']}.wav")
        start[c["id"]], end[c["id"]] = t, t + d
        t += d
    # group avatar chunks by segment, preserving order
    order, byseg = [], {}
    for c in chunks:
        if c.get("role") == "avatar":
            sid = c.get("seg") or c["id"]
            if sid not in byseg:
                byseg[sid] = []; order.append(sid)
            byseg[sid].append(c)
    adir = out_dir / "avatar-audio"
    if adir.exists():
        shutil.rmtree(adir)
    adir.mkdir(parents=True, exist_ok=True)

    blocks, lines = [], []
    for sid in order:
        cs = byseg[sid]
        audio.concat([clip_dir / f"{c['id']}.wav" for c in cs], adir / f"{sid}.wav")
        st, en = start[cs[0]["id"]], end[cs[-1]["id"]]
        blocks.append((sid, st, en, " ".join(c["text"] for c in cs)))
    total = sum(en - st for _, st, en, _ in blocks)
    lines += [f"# {base} — full-screen avatar script (HeyGen 4)", "",
              f"Total full-screen avatar: ≈{audio.mmss(total)} across {len(blocks)} blocks.",
              "One clip per block in `./avatar-audio/<id>.wav` — upload each to HeyGen 4 manually.",
              "Lines are verbatim from the script and match the voiceover exactly.", ""]
    for i, (sid, st, en, text) in enumerate(blocks, 1):
        lines += [f"## {i}. {sid} — `{audio.mmss(st)}–{audio.mmss(en)}` (~{round(en - st)}s)"
                  f"  ·  avatar-audio/{sid}.wav", f"> {text}", ""]
    (out_dir / f"{base}.avatar-fullscreen.md").write_text("\n".join(lines))
    print(f"  avatar: {len(blocks)} block(s), ≈{audio.mmss(total)} → {adir}")
    return blocks


def basename(inp):
    return re.sub(r"\.(improved|final|clean|avatar-segments)$", "", inp.stem)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", nargs="?", help="avatar-segments.json or script.txt (default: step 060 output)")
    ap.add_argument("--ref", default=str(DEFAULT_REF))
    ap.add_argument("--chunk-seconds", type=float, default=20)
    ap.add_argument("--interval-silence", type=int, default=150,
                    help="ms of silence between sentences (lower = tighter)")
    ap.add_argument("--only", default=None, help="re-synth ONLY these chunk ids (e.g. 0042,0043)")
    ap.add_argument("--index", action="store_true", help="rebuild the timeline only, no synth")
    ap.add_argument("--discard-clips", action="store_true", help="delete the work dir after stitching")
    a = ap.parse_args()

    if a.input:
        inp = pathlib.Path(a.input)
    else:  # prefer the avatar-segments handoff, fall back to a plain script
        inp = next(iter(sorted(PREV.glob("*.avatar-segments.json"))), None) \
            or next(iter(sorted(PREV.glob("*.improved.txt"))), None)
    if not inp or not inp.exists():
        die(f"no input (pass a path, or run step 060 first → {PREV})")
    if not pathlib.Path(a.ref).exists():
        die(f"no reference voice at {a.ref}")

    base = basename(inp)
    OUT.mkdir(parents=True, exist_ok=True)
    work = OUT / f"{base}.work"
    clip_dir = work / "clips"
    out_wav = OUT / f"{base}.voice.wav"
    chunks, avatar_mode = load_chunks(inp, a.chunk_seconds)

    # ── rebuild index only ───────────────────────────────────────────────────────────
    if a.index:
        if not clip_dir.exists():
            die(f"no clips at {clip_dir} — run a full synth first")
        print(f"✓ rebuilt {write_index(clip_dir, chunks, work / 'index.txt')}")
        return

    # ── redo loop: re-synth only the flagged chunks ──────────────────────────────────
    if a.only:
        if not clip_dir.exists():
            die(f"no clips at {clip_dir} — run a full synth first")
        prev = json.loads((work / "chunks.json").read_text())
        if len(chunks) != len(prev):
            die(f"chunk count changed ({len(prev)} → {len(chunks)}): the edit shifted boundaries, "
                f"ids no longer line up. Run a full synth instead.")
        ids = {x.strip() for x in a.only.split(",") if x.strip()}
        sel = [c for c in chunks if c["id"] in ids]
        missing = ids - {c["id"] for c in sel}
        if missing:
            die(f"no such chunk id(s): {', '.join(sorted(missing))} (max {chunks[-1]['id']})")
        print(f"→ re-synthing {len(sel)} chunk(s): {', '.join(sorted(ids))}")
        modal_tts.modal_synth(sel, a.ref, clip_dir, a.interval_silence)
        n = stitch(clip_dir, out_wav)
        write_index(clip_dir, chunks, work / "index.txt")
        write_avatar_outputs(chunks, clip_dir, OUT, base)
        print(f"✓ re-stitched {n} clips → {out_wav}")
        return

    # ── full synth ───────────────────────────────────────────────────────────────────
    if clip_dir.exists():
        shutil.rmtree(clip_dir)
    clip_dir.mkdir(parents=True, exist_ok=True)
    (work / "chunks.json").write_text(json.dumps(chunks, ensure_ascii=False, indent=2))
    est_min = sum(len(c["text"].split()) for c in chunks) / WPS / 60
    mode = "avatar-aware" if avatar_mode else "plain"
    print(f"→ {len(chunks)} chunks (~{a.chunk_seconds:g}s target, ~{est_min:.1f} min, {mode})")

    modal_tts.modal_synth(chunks, a.ref, clip_dir, a.interval_silence)
    n = stitch(clip_dir, out_wav)
    write_index(clip_dir, chunks, work / "index.txt")
    write_avatar_outputs(chunks, clip_dir, OUT, base)
    print(f"✓ stitched {n} clips → {out_wav}")
    print("→ next: step 100 (trim-silence)")
    if a.discard_clips:
        shutil.rmtree(work, ignore_errors=True)
        print("  (discarded clips — redo loop disabled for this run)")


if __name__ == "__main__":
    main()
