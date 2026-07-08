"""HeyGen submission for tutorial-pipeline-1 — wraps the heygen-web CLI's generate-from-audio +
download commands. Same anti-ban posture as tutorial-pipeline-2/lib/heygen.py: no polling,
randomized human-like gaps between submissions. generate-from-audio's HTTP body is a [TODO][HNS]
stub in heygen-web.mjs until the audio-upload request is captured — this wrapper is real and ready
the moment that's wired; submit() just returns status="stub-not-wired" until then.
"""
import time, json, random, subprocess, shutil, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]           # tutorial-pipeline-1/


def resolve_cli(explicit=None):
    if explicit:
        if not pathlib.Path(explicit).exists():
            raise SystemExit(f"✖ --heygen-cli not found: {explicit}")
        return explicit
    guess = ROOT.parents[2] / "tooling/cli/heygen-web/heygen-web.mjs"
    if guess.exists():
        return str(guess)
    raise SystemExit("✖ can't find heygen-web.mjs — pass --heygen-cli /path/to/heygen-web.mjs")


def human_delay(pacing, n_done):
    gap = random.uniform(pacing["min_gap"], pacing["max_gap"])
    if pacing.get("settle_every") and n_done and n_done % pacing["settle_every"] == 0:
        gap += pacing.get("settle_gap", 0)
    print(f"   …waiting {gap:.0f}s (human pacing)")
    time.sleep(gap)


def submit(cli, audio_path, avatar_id, engine, title):
    """Submit one render. Returns {"video_id":..., "status":"submitted"} for real, or
    {"status":"stub-not-wired", "error":...} while generate-from-audio's HTTP body is a stub."""
    node = shutil.which("node") or "node"
    r = subprocess.run([node, cli, "generate-from-audio", "--avatar", avatar_id,
                        "--audio", str(audio_path), "--engine", engine, "--title", title],
                       capture_output=True, text=True)
    if r.returncode != 0:
        return {"status": "stub-not-wired", "error": (r.stderr or r.stdout).strip()}
    out = json.loads(r.stdout)
    return {"video_id": out.get("video_id"), "status": "submitted"}


def download(cli, video_id, dest):
    node = shutil.which("node") or "node"
    r = subprocess.run([node, cli, "download", video_id, "--out", str(dest)],
                       capture_output=True, text=True)
    return r.returncode == 0
