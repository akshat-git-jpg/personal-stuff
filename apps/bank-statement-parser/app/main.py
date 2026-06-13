"""FastAPI service: POST /v1/parse turns a bank statement into structured JSON.

Thin HTTP layer — orchestration lives in `pipeline`. Errors carry a stable
machine-readable `code` alongside the human message.
"""
from __future__ import annotations

import os

from fastapi import Depends, FastAPI, Header, HTTPException, Query, UploadFile
from fastapi.responses import JSONResponse

from . import extractor, intake, pipeline
from .schema import Statement

# When set, every request must carry this secret in X-Parser-Secret. Leave unset
# locally; set it in production so only the RapidAPI proxy can reach /parse.
PROXY_SECRET = os.environ.get("RAPIDAPI_PROXY_SECRET")

app = FastAPI(
    title="Bank Statement Parser",
    version="1.0.0",
    description="Turn a bank statement (PDF or image, digital or scanned) into "
    "trustworthy structured JSON with a built-in balance-reconciliation check.",
)


def _require_secret(x_parser_secret: str | None = Header(default=None)) -> None:
    if PROXY_SECRET and x_parser_secret != PROXY_SECRET:
        raise HTTPException(status_code=401, detail={"error": "Invalid proxy secret.", "code": "unauthorized"})


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "text_model": extractor.TEXT_MODEL,
        "vision_model": extractor.VISION_MODEL,
    }


@app.post("/v1/parse", response_model=Statement, dependencies=[Depends(_require_secret)])
async def parse(
    file: UploadFile,
    include: str | None = Query(default=None, description="Set to 'raw_text' to include extracted text"),
) -> Statement:
    data = await file.read()
    try:
        return await pipeline.run(data, include_raw=(include == "raw_text"))
    except intake.IntakeError as e:
        raise HTTPException(status_code=e.status, detail={"error": str(e), "code": e.code}) from e
    except extractor.ExtractionError as e:
        raise HTTPException(status_code=422, detail={"error": str(e), "code": e.code}) from e
    except Exception as e:  # transport / model failure
        raise HTTPException(
            status_code=502, detail={"error": f"Extraction failed upstream: {e}", "code": "upstream_error"}
        ) from e


@app.exception_handler(HTTPException)
async def _http_exc(_request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail
    if not isinstance(detail, dict):
        detail = {"error": detail, "code": "error"}
    return JSONResponse(status_code=exc.status_code, content=detail)
