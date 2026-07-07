import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import registry


def _write_meta(base, video_id, **overrides):
    data = {
        "id": video_id, "extracted": False, "merged_into": {},
    }
    data.update(overrides)
    d = base / "videos" / video_id
    d.mkdir(parents=True, exist_ok=True)
    (d / "meta.json").write_text(json.dumps(data))


def test_pending_extraction_and_merge(tmp_path, monkeypatch):
    monkeypatch.setattr(registry, "VIDEOS_DIR", tmp_path / "videos")
    _write_meta(tmp_path, "AAAAAAAAAAA", extracted=False)
    _write_meta(tmp_path, "BBBBBBBBBBB", extracted=True, merged_into={"hostinger": False, "bluehost": True})
    assert registry.pending_extraction() == ["AAAAAAAAAAA"]
    assert registry.pending_merge_for_tool("hostinger") == ["BBBBBBBBBBB"]
    assert registry.pending_merge_for_tool("bluehost") == []
    assert registry.all_pending_tools() == ["hostinger"]


def test_parse_extraction_output_happy_path():
    raw = 'Here you go:\n```json\n{"tools": [{"tool_name": "Hostinger", "strengths": []}]}\n```\n'
    data = registry.parse_extraction_output(raw)
    assert data["tools"][0]["tool_name"] == "Hostinger"


def test_parse_extraction_output_no_fence_raises():
    try:
        registry.parse_extraction_output("just prose, no json block")
        assert False, "expected ParseError"
    except registry.ParseError:
        pass


def test_parse_extraction_output_missing_tool_name_raises():
    raw = '```json\n{"tools": [{"strengths": []}]}\n```'
    try:
        registry.parse_extraction_output(raw)
        assert False, "expected ParseError"
    except registry.ParseError:
        pass


def test_parse_agy_envelope_empty_response_is_failure():
    raw = json.dumps({"status": "SUCCESS", "response": ""})
    try:
        registry.parse_agy_envelope(raw)
        assert False, "expected ParseError"
    except registry.ParseError as e:
        assert "empty response" in str(e)


def test_merge_guard_passes():
    old = "# Hostinger\n(AAAAAAAAAAA @ 1:00, Jan 2026)\n"
    new = "# Hostinger\n" + "x" * len(old) + "(AAAAAAAAAAA @ 1:00, Jan 2026) (BBBBBBBBBBB @ 2:00, Feb 2026)\n"
    ok, reason = registry.merge_guard(old, new, ["AAAAAAAAAAA", "BBBBBBBBBBB"])
    assert ok, reason


def test_merge_guard_rejects_missing_source_video():
    old = "# Hostinger\n(AAAAAAAAAAA @ 1:00, Jan 2026)\n" * 5
    new = "# Hostinger\n" + old  # long enough, citation count fine, but BBBBBBBBBBB never appears
    ok, reason = registry.merge_guard(old, new, ["AAAAAAAAAAA", "BBBBBBBBBBB"])
    assert not ok
    assert "missing" in reason


def test_merge_guard_rejects_short_response():
    old = "# Hostinger\n" + ("x" * 500)
    new = "# Hostinger\nshort"
    ok, reason = registry.merge_guard(old, new, [])
    assert not ok
    assert "half" in reason


def test_match_tool_exact_and_none(tmp_path, monkeypatch):
    monkeypatch.setattr(registry, "TOOLS_DIR", tmp_path / "tools")
    d = tmp_path / "tools" / "hostinger"
    d.mkdir(parents=True)
    (d / "tool.json").write_text(json.dumps({"name": "Hostinger", "aliases": ["Hostinger VPS"]}))
    assert registry.match_tool("Hostinger") == ("exact", "hostinger")
    assert registry.match_tool("Hostinger VPS") == ("exact", "hostinger")
    kind, slug = registry.match_tool("Totally Different Tool")
    assert kind == "none"


def test_match_tool_near_duplicate(tmp_path, monkeypatch):
    monkeypatch.setattr(registry, "TOOLS_DIR", tmp_path / "tools")
    d = tmp_path / "tools" / "hostinger"
    d.mkdir(parents=True)
    (d / "tool.json").write_text(json.dumps({"name": "Hostinger", "aliases": []}))
    kind, slug = registry.match_tool("Hostinger Cloud", near_threshold=0.7)
    assert kind == "near"
    assert slug == "hostinger"
