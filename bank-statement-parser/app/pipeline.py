"""Orchestration: bytes in, finalized Statement out.

Single pass, no retries. The flow is:
  cache -> intake (with page cap) -> textlayer -> (chunk + concurrent extract)
        -> reconcile -> meta -> cache store

Either the first pass reconciles or it doesn't; we report the result honestly
and never silently retry. Cost is therefore predictable: one model call per
chunk, output bounded by max_tokens.
"""
from __future__ import annotations

import asyncio
import os
import time

from . import cache, chunking, extractor, intake, textlayer
from .reconcile import finalize, merge_extractions
from .schema import Meta, Statement, StatementExtraction

MAX_BYTES = int(os.environ.get("PARSER_MAX_FILE_MB", "15")) * 1024 * 1024
MAX_PAGES = int(os.environ.get("PARSER_MAX_PAGES", "30"))
CHUNK_PAGES = int(os.environ.get("PARSER_CHUNK_PAGES", "8"))


async def _gather_extractions(fn, items) -> list[StatementExtraction]:
    """Run a sync extractor over each chunk concurrently (off the event loop)."""
    results = await asyncio.gather(*(asyncio.to_thread(fn, item) for item in items))
    return [extraction for extraction, _model in results]


async def _extract(item: intake.Intake) -> tuple[StatementExtraction, str, str]:
    """Return (extraction, input_type, model_used)."""
    if item.kind == "image":
        extraction, model = await asyncio.to_thread(
            extractor.extract_from_image, item.data, item.media_type
        )
        return extraction, "image", model

    has_text, pages_text = await asyncio.to_thread(textlayer.extract_pages, item.data)
    chunked = item.pages > CHUNK_PAGES

    if has_text:
        if chunked:
            groups = chunking.group_text(pages_text, CHUNK_PAGES)
            parts = await _gather_extractions(extractor.extract_from_text, groups)
            return merge_extractions(parts), "digital_pdf", extractor.TEXT_MODEL
        extraction, model = await asyncio.to_thread(
            extractor.extract_from_text, "\n".join(pages_text)
        )
        return extraction, "digital_pdf", model

    # scanned
    if chunked:
        sub_pdfs = chunking.split_pdf(item.data, CHUNK_PAGES)
        parts = await _gather_extractions(extractor.extract_from_pdf, sub_pdfs)
        return merge_extractions(parts), "scanned_pdf", extractor.VISION_MODEL
    extraction, model = await asyncio.to_thread(extractor.extract_from_pdf, item.data)
    return extraction, "scanned_pdf", model


async def run(data: bytes, include_raw: bool = False) -> Statement:
    started = time.monotonic()
    ckey = cache.key_for(data)

    cached = cache.get(ckey)
    if cached is not None:
        cached.meta.cached = True
        cached.meta.processing_ms = int((time.monotonic() - started) * 1000)
        return cached

    item = intake.classify(data, MAX_BYTES, MAX_PAGES)  # raises IntakeError -> mapped in main
    extraction, input_type, model = await _extract(item)
    statement = finalize(extraction)

    statement.meta = Meta(
        input_type=input_type,
        pages=item.pages,
        model=model,
        processing_ms=int((time.monotonic() - started) * 1000),
        cached=False,
        raw_text=(
            "\n".join(textlayer.extract_pages(item.data)[1])
            if include_raw and item.kind == "pdf"
            else None
        ),
    )

    cache.put(ckey, statement)
    return statement
