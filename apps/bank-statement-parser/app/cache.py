"""A tiny in-process LRU cache keyed by the SHA-256 of the uploaded bytes.

Customers re-submit the same file more often than you'd think (retries, tests,
double-clicks). Returning a cached parse is instant and costs nothing. This is a
process-local cache — good enough for a single worker; swap for Redis when you
run multiple workers.
"""
from __future__ import annotations

import hashlib
import os
import threading
from collections import OrderedDict

from .schema import Statement

_MAX = int(os.environ.get("PARSER_CACHE_SIZE", "256"))
_lock = threading.Lock()
_store: "OrderedDict[str, Statement]" = OrderedDict()


def key_for(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def get(key: str) -> Statement | None:
    with _lock:
        st = _store.get(key)
        if st is not None:
            _store.move_to_end(key)
            # Return a copy so callers can stamp meta without mutating the cache.
            return st.model_copy(deep=True)
        return None


def put(key: str, statement: Statement) -> None:
    with _lock:
        _store[key] = statement.model_copy(deep=True)
        _store.move_to_end(key)
        while len(_store) > _MAX:
            _store.popitem(last=False)
