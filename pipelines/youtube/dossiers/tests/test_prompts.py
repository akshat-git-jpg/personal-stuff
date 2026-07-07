import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import prompts


def test_extraction_prompt_has_placeholders():
    for ph in ("{video_id}", "{title}", "{channel}", "{published}", "{transcript}"):
        assert ph in prompts.EXTRACTION_PROMPT


def test_extraction_prompt_formats_cleanly():
    out = prompts.EXTRACTION_PROMPT.format(
        video_id="AAAAAAAAAAA", title="T", channel="C", published="2026-01-01", transcript="hi")
    assert "AAAAAAAAAAA" in out


def test_tool_schema_required_fields():
    required = set(prompts.TOOL_SCHEMA["required"])
    assert required == {"tool_name", "identity_notes", "pricing_claims", "strengths",
                         "weaknesses", "quirks", "demos", "comparisons"}


def test_merge_prompt_formats_cleanly():
    out = prompts.MERGE_PROMPT.format(
        tool_name="Hostinger", date="2026-07-08", n=2, dossier="# old", extractions="stuff",
        total_sources=3)
    assert "Hostinger" in out


def test_dossier_skeleton_formats_cleanly():
    out = prompts.DOSSIER_SKELETON.format(tool_name="Hostinger", date="2026-07-08", n=0, newest="—")
    assert out.startswith("# Hostinger")
    assert "As-of" in out
