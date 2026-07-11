"""The single GPU call: IndexTTS-2 on Modal. Used by step 080 (synthesize).

Reuses the existing app at pipelines/video/tts/modal/indextts2_app.py — the only piece of
this pipeline that runs off-machine. Everything else is local.
"""
import json, subprocess, pathlib

# lib/modal_tts.py → parents: [0]=lib [1]=explainer-videos-pipeline-1 [2]=youtube [3]=pipelines
MODAL_APP = pathlib.Path(__file__).resolve().parents[3] / "video/tts/modal/indextts2_app.py"


def modal_synth(chunks, ref, clip_dir, interval_silence, modal_app=MODAL_APP):
    """Synth the given chunks ([{id, text, ...}]) on Modal -> clip_dir/<id>.wav (overwrites).
    Only id+text are sent to Modal; any extra keys (role/seg) are ignored."""
    clip_dir = pathlib.Path(clip_dir)
    if not pathlib.Path(modal_app).exists():
        raise SystemExit(f"✖ Modal app not found at {modal_app}")
    payload = [{"id": c["id"], "text": c["text"]} for c in chunks]
    seg_json = clip_dir.parent / "_synth.json"
    seg_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    cmd = ["modal", "run", str(modal_app),
           "--segments", str(seg_json), "--ref", str(ref), "--out", str(clip_dir),
           "--interval-silence", str(interval_silence)]
    print("→ Modal GPU synth:\n  " + " ".join(cmd))
    subprocess.run(cmd, check=True)
    seg_json.unlink(missing_ok=True)
