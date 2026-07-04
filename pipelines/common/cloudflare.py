"""Cloudflare REST API clients for D1 and KV.

Used by Python sync scripts to read/write D1 and update KV.
The Worker itself uses CF's native bindings, not this module.
"""

import os
from typing import Any
from urllib.parse import quote

import requests

CF_API_BASE = "https://api.cloudflare.com/client/v4"


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} not set in .env")
    return value


class D1Client:
    def __init__(self) -> None:
        self.account_id = _required_env("CF_ACCOUNT_ID")
        self.database_id = _required_env("CF_D1_DATABASE_ID")
        self.token = _required_env("CF_API_TOKEN")

    def query(self, sql: str, params: list[Any] | None = None) -> list[dict]:
        """Execute a parameterized SQL statement. Returns the list of result rows
        (empty list for INSERT/UPDATE/DELETE)."""
        url = f"{CF_API_BASE}/accounts/{self.account_id}/d1/database/{self.database_id}/query"
        body = {"sql": sql, "params": params or []}
        resp = requests.post(
            url,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("success"):
            errs = data.get("errors", [])
            msg = "; ".join(e.get("message", "?") for e in errs) or "unknown error"
            raise RuntimeError(f"D1 query failed: {msg}")
        return data["result"][0].get("results", [])


class KVClient:
    def __init__(self) -> None:
        self.account_id = _required_env("CF_ACCOUNT_ID")
        self.namespace_id = _required_env("CF_KV_NAMESPACE_ID")
        self.token = _required_env("CF_API_TOKEN")

    def _value_url(self, key: str) -> str:
        return (
            f"{CF_API_BASE}/accounts/{self.account_id}"
            f"/storage/kv/namespaces/{self.namespace_id}/values/{quote(key, safe='')}"
        )

    def put(self, key: str, value: str) -> None:
        resp = requests.put(
            self._value_url(key),
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "text/plain",
            },
            data=value,
            timeout=15,
        )
        resp.raise_for_status()
        if not resp.json().get("success"):
            raise RuntimeError(f"KV PUT failed for key {key!r}")

    def delete(self, key: str) -> None:
        resp = requests.delete(
            self._value_url(key),
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=15,
        )
        resp.raise_for_status()
