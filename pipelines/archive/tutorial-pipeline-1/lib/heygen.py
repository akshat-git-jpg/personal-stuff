"""HeyGen submission for tutorial-pipeline-1 — wraps the heygen-web CLI's generate-from-template +
download commands. Same anti-ban posture as tutorial-pipeline-2/lib/heygen.py: no polling,
randomized human-like gaps between submissions.

girl 1/girl 2's ids in shared/avatar_mapping.py are HeyGen TEMPLATE ids (a pre-composed
background + avatar bubble, not a raw avatar) — see tooling/cli/heygen-web/API-REFERENCE.md's
"Create from template" section. generate-from-template swaps only the audio in; the template's
own visual composition (already correctly framed for its own aspect ratio) is untouched.
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


def submit_from_template(cli, audio_path, template_id, title):
    """Submit one render from a HeyGen template. Returns {"video_id":..., "status":"submitted"}."""
    node = shutil.which("node") or "node"
    r = subprocess.run([node, cli, "generate-from-template", "--template", template_id,
                        "--audio", str(audio_path), "--title", title],
                       capture_output=True, text=True)
    if r.returncode != 0:
        return {"status": "error", "error": (r.stderr or r.stdout).strip()}
    out = json.loads(r.stdout)
    return {"video_id": out.get("video_id"), "status": "submitted"}


def download(cli, video_id, dest):
    node = shutil.which("node") or "node"
    r = subprocess.run([node, cli, "download", video_id, "--out", str(dest)],
                       capture_output=True, text=True)
    return r.returncode == 0
