"""Modal app — IndexTTS-2 synth service (the ONLY GPU step in the tts-flow pipeline).

Architecture: Modal does text -> voice clips, nothing else. Whisper, chunking,
trim/anchor, and mux all run locally (CPU). We send up only the text segments +
the reference voice clip; we get back the per-segment .wav bytes.

One-time:   modal run indextts2_app.py::download_models      # pulls ~9.5GB weights into a Volume
Synth:      modal run indextts2_app.py --segments work/chunks.json --ref work/refvoice/ref.wav --out work/idx_chunks

Engine contract: input  = [{"id","text"}, ...]   output = <out>/<id>.wav per segment.
"""
import json
import pathlib
import modal

app = modal.App("indextts2-synth")

# --- Image: clone IndexTTS-2, install its pinned deps (torch 2.8 CUDA on Linux) ---
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "ffmpeg", "build-essential")
    .run_commands(
        "git clone https://github.com/index-tts/index-tts.git /root/index-tts",
        "cd /root/index-tts && pip install -e .",
    )
    .pip_install("huggingface_hub[hf_transfer]", "hf_xet", "soundfile")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

# --- Volume: cache the ~9.5GB checkpoints across runs (download once) ---
vol = modal.Volume.from_name("indextts2-models", create_if_missing=True)
MODELS = "/models"
CKPT = f"{MODELS}/checkpoints"


@app.function(image=image, volumes={MODELS: vol}, timeout=3600)
def download_models():
    """Run once: snapshot the IndexTTS-2 weights into the Volume."""
    from huggingface_hub import snapshot_download
    snapshot_download("IndexTeam/IndexTTS-2", local_dir=CKPT)
    vol.commit()
    print("models ready in volume:", CKPT)


@app.cls(image=image, gpu="A10G", volumes={MODELS: vol}, timeout=3600)
class Synth:
    @modal.enter()
    def load(self):
        import sys
        sys.path.insert(0, "/root/index-tts")
        from indextts.infer_v2 import IndexTTS2
        self.tts = IndexTTS2(
            cfg_path=f"{CKPT}/config.yaml",
            model_dir=CKPT,
            use_fp16=True,
            device="cuda:0",
            use_cuda_kernel=False,   # avoid runtime BigVGAN kernel compile on first pass
            use_deepspeed=False,
        )
        print("IndexTTS2 loaded on cuda:0")

    @modal.method()
    def synth(self, segments, ref_bytes, emo_text=None, interval_silence=200):
        """segments=[{id,text}], ref_bytes=reference wav. Returns {id: wav_bytes}.

        interval_silence = ms of silence IndexTTS-2 inserts between sentences (default 200).
        Lower (~80) = less internal dead air -> tighter pacing, less fit speed-up needed.
        """
        import time
        ref = "/tmp/ref.wav"
        pathlib.Path(ref).write_bytes(ref_bytes)
        out = {}
        for seg in segments:
            sid, text = seg["id"], seg["text"].strip()
            if not text:
                continue
            op = f"/tmp/{sid}.wav"
            t = time.time()
            kw = {"interval_silence": int(interval_silence)}
            if emo_text:
                kw.update(use_emo_text=True, emo_text=emo_text)
            self.tts.infer(spk_audio_prompt=ref, text=text, output_path=op, **kw)
            out[sid] = pathlib.Path(op).read_bytes()
            print(f"  {sid}: {time.time()-t:.1f}s  «{text[:42]}…»", flush=True)
        return out


@app.local_entrypoint()
def main(segments: str, ref: str, out: str, emo_text: str = "", interval_silence: int = 200):
    segs = json.loads(pathlib.Path(segments).read_text())
    ref_bytes = pathlib.Path(ref).read_bytes()
    print(f"sending {len(segs)} segments + ref ({len(ref_bytes)} bytes) to Modal "
          f"(interval_silence={interval_silence}ms)...")
    res = Synth().synth.remote(segs, ref_bytes, emo_text or None, interval_silence)
    od = pathlib.Path(out)
    od.mkdir(parents=True, exist_ok=True)
    for sid, b in res.items():
        (od / f"{sid}.wav").write_bytes(b)
    print(f"wrote {len(res)} wavs to {out}")
