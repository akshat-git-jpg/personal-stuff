"""Request validation for the synth web endpoint. Pure python — unit-testable
offline, imported inside the Modal container via add_local_python_source."""
import re

ID_RE = re.compile(r"^s\d{2}$")
TEXT_MAX = 1200
EMO_MAX = 200
IV_MIN, IV_MAX, IV_DEFAULT = 50, 500, 200


def validate_payload(p):
    """Returns (ok, error, cleaned). cleaned = {id, text, interval_silence, emo_text}."""
    if not isinstance(p, dict):
        return False, "payload must be a JSON object", None
    sid, text = p.get("id"), p.get("text")
    if not isinstance(sid, str) or not ID_RE.match(sid):
        return False, "id must match s\\d\\d (e.g. s07)", None
    if not isinstance(text, str) or not text.strip():
        return False, "text is required", None
    if len(text) > TEXT_MAX:
        return False, f"text too long (max {TEXT_MAX} chars)", None
    iv = p.get("interval_silence", IV_DEFAULT)
    if isinstance(iv, bool) or not isinstance(iv, (int, float)) or int(iv) != iv:
        return False, "interval_silence must be an integer", None
    iv = int(iv)
    if not (IV_MIN <= iv <= IV_MAX):
        return False, f"interval_silence out of range {IV_MIN}-{IV_MAX}", None
    emo = p.get("emo_text") or None
    if emo is not None and (not isinstance(emo, str) or len(emo) > EMO_MAX):
        return False, "emo_text must be a string of at most 200 chars", None
    return True, None, {"id": sid, "text": text.strip(),
                        "interval_silence": iv, "emo_text": emo}
