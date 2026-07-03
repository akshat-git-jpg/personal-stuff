"""Gemini client wrapper. Reads GEMINI_API_KEY from root .env."""

import os
import time

from . import env  # noqa: F401  side-effect: load .env

# Lazy import so scripts that don't need Gemini don't pay the import cost
# and don't need the dep installed for unrelated work.


def get_client():
    from google import genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY missing from .env")
    return genai.Client(api_key=api_key)


def generate_json(model, prompt, schema, *, retries=1):
    """Run a structured-JSON Gemini call. Returns parsed dict.

    Retries `retries` times on any exception with a 2s backoff.
    """
    from google import genai
    from google.genai import types

    client = get_client()
    last_err = None
    for attempt in range(retries + 1):
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                ),
            )
            return resp.parsed if resp.parsed is not None else _parse_text(resp.text)
        except Exception as e:
            last_err = e
            if attempt < retries:
                time.sleep(2)
    raise last_err


def generate_text(model, prompt, *, retries=1):
    """Run a free-form Gemini call. Returns response text."""
    client = get_client()
    last_err = None
    for attempt in range(retries + 1):
        try:
            resp = client.models.generate_content(model=model, contents=prompt)
            return resp.text
        except Exception as e:
            last_err = e
            if attempt < retries:
                time.sleep(2)
    raise last_err


def _parse_text(text):
    import json

    return json.loads(text)
