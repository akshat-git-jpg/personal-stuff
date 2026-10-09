# HeyGen generation config — EDIT THIS to change avatars, voices, limits, pacing.
# Read by step 150 (submit-avatar-videos). Two flows:
#   a4  full-screen avatar blocks (impactful moments)  — HeyGen 4, metered
#   a3  corner talking-head for the WHOLE video         — Avatar III, unlimited (free)
#
# "Voice" here = the audio we UPLOAD (our jamila voiceover), not a HeyGen voice — so the avatar
# lip-syncs to our own brand voice. Change avatar_id / audio source / limits freely below.

FLOWS = {
    "a4": {
        "label": "HeyGen 4 full-screen",
        # web_session for BOTH flows: the official API has limits that make it useless here, so we
        # drive HeyGen through your logged-in browser session (you drop in cookies/auth at runtime).
        # This is ban-risky, so the anti-ban pacing below applies to this flow too.
        "backend": "web_session",
        "avatar_id": "REPLACE_WITH_HEYGEN4_AVATAR_ID",
        "audio": "per_block",          # one render per clip in 50-synthesize/output/avatar-audio/*.wav
        # No chunking — full-screen blocks are always short (seconds to ~1-2 min), never over a limit.
    },
    "a3": {
        "label": "HeyGen 3 corner (Avatar III)",
        # web session (unlimited Avatar III). Ban-risky — the anti-ban pacing below matters.
        "backend": "web_session",
        "avatar_id": "REPLACE_WITH_AVATAR_III_ID",
        "audio": "corner_parts",       # pre-made parts from step 090 (55-.../output/corner-parts/*.wav)
        "max_render_seconds": 420,     # 7-min cap per part — a QUALITY guard (long continuous avatar
                                       # renders start to hallucinate), well under the 30-min Avatar III
                                       # API cap. Used by step 090 to group chunks. Parts stay SEPARATE.
    },
}

# ── Anti-ban pacing (we deliberately behave like a human; slower is safer). Seconds. ──
PACING = {
    "min_gap": 45,         # min wait between two submissions
    "max_gap": 150,        # max wait (a fresh random value in [min,max] before each submit)
    "settle_every": 5,     # after this many submissions in a run…
    "settle_gap": 600,     # …take this much of a longer break
    "max_per_run": 0,      # 0 = no cap. Else stop after N submissions/run so huge jobs span days.
    "jitter_order": True,  # randomize submission order so it doesn't look scripted
    "backoff_on_error": 900,  # on any error, wait this long before the run gives up (no hammering)
}

# ── Usage check (run EVERY time, before + after, to catch mistakes). ──
USAGE = {
    "cmd": "heygen-web",   # CLI used for `usage --save` / `--diff`; set "" to skip (not recommended)
    "expect": {"a3": "zero", "a4": "nonzero"},  # A3 unlimited should be Δ0; A4 metered should move
}

# ── Web-session credentials (web_session backend). NEVER commit this file. ──
# Provide a session export (cookies/headers from your logged-in browser) at this path; the
# web_session backend reuses it so we don't repeatedly log in (which looks like a bot).
SESSION_FILE = "shared/heygen-session.json"   # gitignored; you supply it
