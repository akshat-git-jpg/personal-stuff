#!/usr/bin/env python3
"""
Step 3/010 — synthesize the voiceover (owner's own voice, IndexTTS-2 on Modal).  [RUN]

  python3 run.py [<input>] [--chunk-seconds 20] [--interval-silence 150] [--discard-clips]
  python3 run.py [<input>] --only 0042,0043     # redo loop: re-synth just these chunks
  python3 run.py [<input>] --index              # rebuild the timeline only, no synth

Input (default: step 2/030's output): <base>.tts-ready.txt — one continuous voiceover,
no avatar blocks (this pipeline has no avatar/talking-head output at all).

What runs WHERE:  local chunks → Modal GPU synth (lib/modal_tts) → local stitch.
Output:
  output/<base>.voice.wav     the continuous voiceover (all chunks stitched)
  output/<base>.work/         kept by default: clips/0000.wav…, chunks.json, index.txt

Redo loop: clips are kept, so re-synthing one flagged chunk costs one chunk of GPU,
not the whole video.
"""
import sys, re, json, argparse, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parents[2]          # explainer-videos-pipeline-1/
sys.path.insert(0, str(ROOT))
from lib import audio, chunking, modal_tts                   # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
PREV = ROOT / "2-scripting/030-clean-script-for-tts-run/output"
DEFAULT_REF = ROOT / "shared/ref/owner-30s.wav"
WPS = chunking.WPS


def die(m): raise SystemExit("✖ " + m)


def load_chunks(inp, chunk_seconds):
    return chunking.chunk(inp.read_text(), chunk_seconds)


def write_index(clip_dir, chunks, out_path):
    text_by_id = {c["id"]: c["text"] for c in chunks}
    t, lines = 0.0, []
    for w in sorted(clip_dir.glob("*.wav")):
        d = audio.dur(w)
        preview = " ".join(text_by_id.get(w.stem, "").split()[:8])
        lines.append(f"{w.stem}  {audio.mmss(t)}–{audio.mmss(t + d)}  \"{preview}…\"")
        t += d
    out_path.write_text("\n".join(lines) + "\n")
    return out_path


def stitch(clip_dir, out_wav):
    wavs = sorted(clip_dir.glob("*.wav"))
    if not wavs:
        die("no wavs in clip dir — did the synth run?")
    audio.concat(wavs, out_wav)
    return len(wavs)


def basename(inp):
    return re.sub(r"\.(tts-ready|final|clean)$", "", inp.stem)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", nargs="?", help="tts-ready.txt (default: step 2/030 output)")
    ap.add_argument("--ref", default=str(DEFAULT_REF))
    ap.add_argument("--chunk-seconds", type=float, default=20)
    ap.add_argument("--interval-silence", type=int, default=150,
                    help="ms of silence between sentences (lower = tighter)")
    ap.add_argument("--only", default=None, help="re-synth ONLY these chunk ids (e.g. 0042,0043)")
    ap.add_argument("--index", action="store_true", help="rebuild the timeline only, no synth")
    ap.add_argument("--discard-clips", action="store_true", help="delete the work dir after stitching")
    a = ap.parse_args()

    inp = pathlib.Path(a.input) if a.input else next(iter(sorted(PREV.glob("*.tts-ready.txt"))), None)
    if not inp or not inp.exists():
        die(f"no input (pass a path, or run step 2/030 first → {PREV})")
    if not pathlib.Path(a.ref).exists():
        die(f"no reference voice at {a.ref} — drop your ~30s sample there first "
            f"(see shared/ref/README.md)")

    base = basename(inp)
    OUT.mkdir(parents=True, exist_ok=True)
    work = OUT / f"{base}.work"
    clip_dir = work / "clips"
    out_wav = OUT / f"{base}.voice.wav"
    chunks = load_chunks(inp, a.chunk_seconds)

    if a.index:
        if not clip_dir.exists():
            die(f"no clips at {clip_dir} — run a full synth first")
        print(f"✓ rebuilt {write_index(clip_dir, chunks, work / 'index.txt')}")
        return

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
        print(f"✓ re-stitched {n} clips → {out_wav}")
        return

    if clip_dir.exists():
        shutil.rmtree(clip_dir)
    clip_dir.mkdir(parents=True, exist_ok=True)
    (work / "chunks.json").write_text(json.dumps(chunks, ensure_ascii=False, indent=2))
    est_min = sum(len(c["text"].split()) for c in chunks) / WPS / 60
    print(f"→ {len(chunks)} chunks (~{a.chunk_seconds:g}s target, ~{est_min:.1f} min)")

    modal_tts.modal_synth(chunks, a.ref, clip_dir, a.interval_silence)
    n = stitch(clip_dir, out_wav)
    write_index(clip_dir, chunks, work / "index.txt")
    print(f"✓ stitched {n} clips → {out_wav}")
    print("→ next: step 020 (trim-silence)")
    if a.discard_clips:
        shutil.rmtree(work, ignore_errors=True)
        print("  (discarded clips — redo loop disabled for this run)")


if __name__ == "__main__":
    main()
