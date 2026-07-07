#!/usr/bin/env python3
"""
Step 2/030 — strip the approved script down to TTS-safe plain text.  [RUN]

Removes markdown syntax and the trailing rubric HTML comment from the
approved script.md, and HARD-FAILS if any "[VERIFY:" placeholder survived
review — TTS must never speak an unresolved placeholder aloud.

  python3 run.py [<base>]   (default: infer from step 010's newest output)

In:  ../010-write-script-opus/output/<base>.script.md
Out: output/<base>.tts-ready.txt
"""
import sys, re, argparse, pathlib

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "output"
PREV = HERE.parent / "010-write-script-opus" / "output"


def die(m): raise SystemExit("✖ " + m)


def infer_base():
    cands = sorted(PREV.glob("*.script.md"))
    if not cands:
        die(f"no script found at {PREV} — run step 010 first")
    return cands[-1].name.split(".script.md")[0]


def clean(text):
    # strip the trailing rubric HTML comment(s), e.g. <!-- rubric: 14/15 pass ... -->
    text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL)
    # strip markdown emphasis/headers/links (keep the words)
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    return text.strip() + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?", help="topic base (default: infer from step 010)")
    a = ap.parse_args()

    base = a.base or infer_base()
    src = PREV / f"{base}.script.md"
    if not src.exists():
        die(f"no such file: {src}")

    raw = src.read_text()
    cleaned = clean(raw)

    if "[VERIFY:" in cleaned:
        die(f"unresolved [VERIFY: ...] placeholder(s) remain in {src} — "
            f"go back to step 020 and resolve them before TTS")

    OUT.mkdir(parents=True, exist_ok=True)
    out_path = OUT / f"{base}.tts-ready.txt"
    out_path.write_text(cleaned)
    print(f"✓ {len(cleaned.split())} words → {out_path}")
    print("→ next: step 3-voiceover/010 (synthesize-voice)")


if __name__ == "__main__":
    main()
