# Avatar mapping for tutorial-pipeline-1 — EDIT THIS to plug in real HeyGen avatar ids.
# Keyed by the Drive folder's " @ g1" / " @ g2" suffix. Each type carries its OWN HeyGen 4 avatar id
# (full-screen, metered) AND HeyGen 3 avatar id (unlimited corner-style, free) — both are
# avatars you've ALREADY created in HeyGen; this pipeline never creates a new one.

TYPES = {
    "g1": {
        # girl 1
        "heygen4_avatar_id": "7629dffbebe141eb8f701630948bd707",
        "heygen3_avatar_id": "7629dffbebe141eb8f701630948bd707",
    },
    "g2": {
        # girl 2
        "heygen4_avatar_id": "887ad69c743d4740a0174eecb3198ef4",
        "heygen3_avatar_id": "887ad69c743d4740a0174eecb3198ef4",
    },
}

# Which HeyGen engine renders which segment. Default: intro/conclusion are the short, high-impact
# bookends -> HeyGen 4 (full-screen, metered, like tutorial-pipeline-2's "a4" flow); body is the
# long middle section -> HeyGen 3 (unlimited corner-style, free, like its "a3" flow). Edit freely.
SEGMENT_ENGINE = {
    "intro": "heygen4",
    "body": "heygen3",
    "conclusion": "heygen4",
}
