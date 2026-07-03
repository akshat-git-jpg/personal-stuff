"""HeyGen generation client for step 150.

Design goals (from the spec):
  • automated, but NEVER polls — `submit` fires and records; you check HeyGen yourself; `fetch`
    downloads finished renders later.
  • least ban risk — one session reused, concurrency 1, randomized human-like gaps, periodic long
    "settle" breaks, optional per-run cap, back-off on error. Slower on purpose.
  • usage checked before+after every batch.

Audio is already pre-chunked into render-ready clips upstream (A4 per block in step 080, A3 corner
parts in step 090), so this client does NO splitting — it just submits and downloads.

The actual HeyGen HTTP calls (submit render, fetch finished video) are STUBS — we never captured
those endpoints. Fill them from a HAR (see TODO blocks). Everything around them is real.
"""
import time, json, random, subprocess, pathlib


# ── anti-ban pacing ──────────────────────────────────────────────────────────────────
def human_delay(pacing, n_done):
    """Wait a randomized, human-like amount before the next action. Longer break periodically."""
    gap = random.uniform(pacing["min_gap"], pacing["max_gap"])
    if pacing.get("settle_every") and n_done and n_done % pacing["settle_every"] == 0:
        gap += pacing.get("settle_gap", 0)
    print(f"   …waiting {gap:.0f}s (human pacing)")
    time.sleep(gap)


def maybe_jitter(items, pacing):
    items = list(items)
    if pacing.get("jitter_order"):
        random.shuffle(items)
    return items


# ── usage check (run before + after every batch) ───────────────────────────────────────
def usage_snapshot(usage_cfg, log_path, tag):
    """Save a usage/credits snapshot via the heygen-web CLI. Degrades gracefully if absent."""
    cmd = usage_cfg.get("cmd")
    if not cmd:
        return None
    try:
        r = subprocess.run([cmd, "usage", "--save"], capture_output=True, text=True, timeout=60)
        out = (r.stdout or "").strip()
    except (FileNotFoundError, subprocess.SubprocessError) as e:
        out = f"(usage check unavailable: {e})"
    with open(log_path, "a") as f:
        f.write(f"\n## {tag} — {time.strftime('%Y-%m-%d %H:%M:%S')}\n{out}\n")
    return out


def usage_diff(usage_cfg, log_path, tag, expect=None):
    cmd = usage_cfg.get("cmd")
    if not cmd:
        return None
    try:
        r = subprocess.run([cmd, "usage", "--diff"], capture_output=True, text=True, timeout=60)
        out = (r.stdout or "").strip()
    except (FileNotFoundError, subprocess.SubprocessError) as e:
        out = f"(usage diff unavailable: {e})"
    note = f"   (expected: {expect})" if expect else ""
    with open(log_path, "a") as f:
        f.write(f"\n## {tag} (after){note} — {time.strftime('%Y-%m-%d %H:%M:%S')}\n{out}\n")
    print(f"   usage Δ logged ({tag}){note}")
    return out


# ── backends ────────────────────────────────────────────────────────────────────────
class Backend:
    """submit(audio, avatar_id, name) -> {video_id, status}; fetch(video_id, dest) -> bool ready."""
    def __init__(self, flow_cfg, root):
        self.cfg, self.root = flow_cfg, root

    def submit(self, audio_path, avatar_id, name):
        raise NotImplementedError

    def fetch(self, video_id, dest):
        raise NotImplementedError


class OfficialAPIBackend(Backend):
    """HeyGen's official API (low ban-risk, metered). Good for the A4 full-screen flow."""
    def submit(self, audio_path, avatar_id, name):
        # TODO[HNS]: capture & implement HeyGen "create video from avatar + uploaded audio".
        #   need: POST endpoint + payload (avatar_id, audio asset id), and the audio-upload call.
        #   Header HEYGEN_API_KEY. Returns a video_id. Fill from the official API docs/HAR.
        raise NotImplementedError(
            f"[TODO official_api.submit] wire HeyGen API: upload {audio_path} + render with "
            f"avatar {avatar_id}. (capture endpoint, then implement)")

    def fetch(self, video_id, dest):
        # TODO[HNS]: GET video status/url by video_id; if completed, download mp4 to dest.
        raise NotImplementedError(f"[TODO official_api.fetch] download video {video_id} -> {dest}")


class WebSessionBackend(Backend):
    """Browser-session 'unlimited' mode (Avatar III, free) — BAN-RISKY. For the A3 corner flow.
    Reuses a stored session so we don't re-login (a bot tell). All pacing/anti-ban care applies."""
    def _session(self):
        sf = self.root / "shared" / "heygen-session.json"
        if not sf.exists():
            raise SystemExit(f"✖ web_session needs {sf} (export your logged-in session there; gitignored)")
        return json.loads(sf.read_text())

    def submit(self, audio_path, avatar_id, name):
        self._session()  # reuse cookies/headers; realistic UA; no fresh login
        # TODO[HNS]: capture & implement the web-session render submit. This is the endpoint that
        #   was NEVER captured (Preserve-log was off). Need: the api2.heygen.com render POST +
        #   payload (avatar_id, uploaded audio id, use_unlimited_mode:true), with the session
        #   cookies + browser headers. Returns a video_id.
        raise NotImplementedError(
            f"[TODO web_session.submit] capture the unlimited render endpoint, then submit "
            f"{audio_path} on avatar {avatar_id}.")

    def fetch(self, video_id, dest):
        # TODO[HNS]: web-session status/url by video_id; download mp4 to dest using the session.
        raise NotImplementedError(f"[TODO web_session.fetch] download video {video_id} -> {dest}")


def get_backend(name, flow_cfg, root):
    return {"official_api": OfficialAPIBackend, "web_session": WebSessionBackend}[name](flow_cfg, root)
