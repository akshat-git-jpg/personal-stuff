# Avatar mapping for tutorial-pipeline-1 — EDIT THIS to plug in real HeyGen avatar ids.
# Keyed by the Drive folder's _xx / _yy suffix. Each type carries its OWN HeyGen 4 avatar id
# (full-screen, metered) AND HeyGen 3 avatar id (unlimited corner-style, free) — both are
# avatars you've ALREADY created in HeyGen; this pipeline never creates a new one.

TYPES = {
    "xx": {
        "heygen4_avatar_id": "REPLACE_WITH_XX_HEYGEN4_AVATAR_ID",
        "heygen3_avatar_id": "REPLACE_WITH_XX_HEYGEN3_AVATAR_ID",
    },
    "yy": {
        "heygen4_avatar_id": "REPLACE_WITH_YY_HEYGEN4_AVATAR_ID",
        "heygen3_avatar_id": "REPLACE_WITH_YY_HEYGEN3_AVATAR_ID",
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
