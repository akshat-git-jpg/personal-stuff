# Avatar mapping for tutorial-pipeline-1 — EDIT THIS to plug in real HeyGen template ids.
# Keyed by the Drive folder's " @ g1" / " @ g2" suffix. Each type's id is a HeyGen TEMPLATE id
# (a pre-composed background + avatar bubble, already correctly framed for its own aspect
# ratio) — NOT a raw avatar id. See tooling/cli/heygen-web/API-REFERENCE.md's "Create from
# template" section. Same template renders every segment; there's no separate engine per segment.

TYPES = {
    "g1": {
        "template_id": "7629dffbebe141eb8f701630948bd707",  # girl 1
    },
    "g2": {
        "template_id": "887ad69c743d4740a0174eecb3198ef4",  # girl 2
    },
}
