#!/usr/bin/env python3
"""
Step 090 — plan the A3 corner render parts.  [RUN]

The corner talking-head (Avatar III) covers the WHOLE video, but a single continuous render gets
long enough to hallucinate, so we cap each part at ~7 min (config: a3.max_render_seconds). This
is the ONE place corner chunking lives.

How (no silence detection, no estimation): step 080 already synthesized the voice as clean,
sentence-packed chunk wavs with known real durations. We just GROUP consecutive chunks into
balanced parts, each <= the cap, and concat each part's chunks. Cuts land exactly on chunk =
sentence boundaries; durations are exact.

  python3 run.py [<base>]                 # default base: inferred from step 080 output

In:  ../080-synthesize-voice-run/output/<base>.work/{clips/*.wav, chunks.json}
Out: output/corner-parts/<base>__a3__corner[-pNN].wav   (one clip per part, kept SEPARATE)
     output/<base>.corner-parts.json                    (part → chunk ids, duration, file)

Step 150 (run-a3) just uploads these — it does no chunking.
"""
import sys, json, math, argparse, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]          # tutorial-pipeline-2/
sys.path.insert(0, str(ROOT))
from lib import audio                                        # noqa: E402
from shared import heygen_config as C                        # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
PARTS_DIR = OUT / "corner-parts"
SYNTH_OUT = ROOT / "4-voiceover/080-synthesize-voice-run/output"


def die(m): raise SystemExit("✖ " + m)


def infer_base(arg):
    if arg:
        return arg
    cands = sorted(SYNTH_OUT.glob("*.work"))
    if not cands:
        die(f"can't infer <base> — run step 080 first (no *.work in {SYNTH_OUT})")
    return cands[0].name[:-len(".work")]


def group_chunks(chunks, clips, cap):
    """Group consecutive chunks into balanced parts, each <= cap seconds (real durations)."""
    durs = [audio.dur(clips / f"{c['id']}.wav") for c in chunks]
    total = sum(durs)
    n = max(1, math.ceil(total / cap))
    target = total / n                      # balanced target; <= cap since n = ceil(total/cap)
    parts, cur, cur_s = [[]], 0.0, 0.0
    for c, d in zip(chunks, durs):
        if parts[-1] and (cur + d > cap or (cur + d > target and len(parts) < n)):
            parts.append([]); cur = 0.0
        parts[-1].append(c); cur += d
    return [p for p in parts if p], total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?")
    a = ap.parse_args()
    base = infer_base(a.base)

    work = SYNTH_OUT / f"{base}.work"
    clips = work / "clips"
    cj = work / "chunks.json"
    if not clips.exists() or not cj.exists():
        die(f"need step 080's chunks ({clips} + {cj}) — run step 080 (keep clips, the default)")

    chunks = json.loads(cj.read_text())
    cap = C.FLOWS["a3"]["max_render_seconds"]
    groups, total = group_chunks(chunks, clips, cap)
    PARTS_DIR.mkdir(parents=True, exist_ok=True)
    for old in PARTS_DIR.glob("*.wav"):
        old.unlink()

    single = len(groups) == 1
    manifest = {"base": base, "cap_seconds": cap, "total": round(total, 1), "parts": []}
    print(f"→ corner {audio.mmss(total)} → {len(groups)} part(s), cap {audio.mmss(cap)}")
    for i, g in enumerate(groups, 1):
        name = f"{base}__a3__corner" if single else f"{base}__a3__corner-p{i:02d}"
        out_wav = PARTS_DIR / f"{name}.wav"
        audio.concat([clips / f"{c['id']}.wav" for c in g], out_wav)
        d = audio.dur(out_wav)
        manifest["parts"].append({"name": name, "file": str(out_wav),
                                  "chunks": [c["id"] for c in g], "seconds": round(d, 1)})
        print(f"   {name}  {audio.mmss(d)}  ({len(g)} chunks)")
    (OUT / f"{base}.corner-parts.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"✓ {OUT / f'{base}.corner-parts.json'}")
    print("→ next: step 150 run-a3 uploads these parts (one HeyGen render each)")


if __name__ == "__main__":
    main()
