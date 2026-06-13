"""pp-rapidapi — agent-native CLI for researching the public RapidAPI Hub.

Personal market-research tool: find gaps, spot patterns, size up competition on
the RapidAPI Hub so you can decide which API to build and monetize.

This talks to the SAME endpoint the public rapidapi.com/hub website uses
(POST https://rapidapi.com/gateway/graphql, operation `searchApis`). It is
UNOFFICIAL — it reads public catalog data only, needs no account and no API
key, but can break if Nokia/RapidAPI changes the Hub. The official GraphQL
Platform API is Enterprise-Hub-only, so this is the only path for a personal
account.

Auth handshake (handled automatically): GET /gateway/csrf returns a csrfToken
plus session cookies; the graphql POST then carries `csrf-token` +
`rapid-client: hub-service`.

Subcommands:
  search TERM [--category C] [--max N] [--sort relevance|popularity|latest]
                                        ranked APIs for a keyword
  category NAME [--max N] [--sort ...]  every API in a category (empty term)
  categories                            saturation map: API count per category
  api SLUG [--term T]                   one API's detail (best-effort from catalog)
  gaps CATEGORY [--max N]               flag openings: weak/old/slow incumbents
  competition TERM [--max N]            head-to-head table of who ranks for a term

Output is JSON by default (cheap for agents). Add --table for a human view.

Data per API: name, slug, description, pricing tier (FREE/FREEMIUM/PAID),
category, provider, updatedAt, and a score block: popularityScore (0-10),
avgLatency (ms), avgServiceLevel (%), avgSuccessRate (%). Exact $ plan prices
and endpoint lists are NOT exposed by this endpoint (server-rendered only).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone

import requests

GRAPHQL_URL = "https://rapidapi.com/gateway/graphql"
CSRF_URL = "https://rapidapi.com/gateway/csrf"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120 Safari/537.36"
)

# The exact query the Hub UI sends for search/browse.
SEARCH_QUERY = """query searchApis($searchApiWhereInput: SearchApiWhereInput!, $paginationInput: PaginationInput, $searchApiOrderByInput: SearchApiOrderByInput) {
  products: searchApis(where: $searchApiWhereInput, pagination: $paginationInput, orderBy: $searchApiOrderByInput) {
    nodes {
      id
      name
      title
      slugifiedName
      description
      pricing
      updatedAt
      categoryName
      visibility
      apiCategory { name color }
      score { popularityScore avgLatency avgServiceLevel avgSuccessRate }
      user: User { id username name type parents { name slugifiedName type } }
    }
    facets { category { key count } }
    pageInfo { endCursor hasNextPage }
    total
  }
}"""

# Server enum SearchApiSortingFieldName only accepts ByRelevance / ByUpdatedAt.
# "popularity" has no server sort, so we fetch by relevance then sort the
# collected window client-side on popularityScore.
_SORT_MAP = {
    "relevance": "ByRelevance",
    "popularity": "ByRelevance",
    "latest": "ByUpdatedAt",
    "updated": "ByUpdatedAt",
}

_TAG_RE = re.compile(r"</?em>")


def _clean(s):
    return _TAG_RE.sub("", s) if isinstance(s, str) else s


def _dump(data) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False)


class HubError(RuntimeError):
    pass


class HubClient:
    """Replays the public Hub's searchApis GraphQL call with a fresh CSRF token."""

    def __init__(self):
        self._s = requests.Session()
        self._s.headers.update({"user-agent": UA})
        self._csrf = None

    def _token(self) -> str:
        if self._csrf:
            return self._csrf
        r = self._s.get(CSRF_URL, timeout=20)
        if r.status_code != 200:
            raise HubError(f"csrf fetch failed: HTTP {r.status_code}")
        try:
            self._csrf = r.json()["csrfToken"]
        except Exception as e:
            raise HubError(f"csrf response unexpected: {r.text[:200]}") from e
        return self._csrf

    def search_page(self, term, categories, sort, first, after):
        payload = {
            "operationName": "searchApis",
            "query": SEARCH_QUERY,
            "variables": {
                "paginationInput": {"first": first, "after": after},
                "searchApiOrderByInput": {
                    "sortingFields": [{"fieldName": _SORT_MAP.get(sort, "ByRelevance"), "by": "ASC"}]
                },
                "searchApiWhereInput": {
                    "term": term or "",
                    "categoryNames": categories or [],
                    "tags": [],
                },
            },
        }
        headers = {
            "content-type": "application/json",
            "rapid-client": "hub-service",
            "csrf-token": self._token(),
        }
        r = self._s.post(GRAPHQL_URL, json=payload, headers=headers, timeout=30)
        if r.status_code != 200:
            raise HubError(f"graphql HTTP {r.status_code}: {r.text[:200]}")
        body = r.json()
        if body.get("errors"):
            raise HubError("graphql errors: " + json.dumps(body["errors"])[:300])
        return body["data"]["products"]

    def search(self, term=None, categories=None, sort="relevance", max_results=20):
        """Page through results up to max_results. Returns (records, total, facets)."""
        out, after, total, facets = [], "", None, None
        while len(out) < max_results:
            page = self.search_page(term, categories, sort, min(40, max_results - len(out)), after)
            if total is None:
                total = page.get("total")
                facets = page.get("facets")
            nodes = page.get("nodes") or []
            out.extend(_to_record(n) for n in nodes)
            info = page.get("pageInfo") or {}
            if not info.get("hasNextPage") or not nodes:
                break
            after = info.get("endCursor") or ""
            if not after:
                break
        if sort == "popularity":
            out.sort(key=lambda r: (r.get("popularity") or -1), reverse=True)
        return out[:max_results], total, facets


def _provider(node):
    u = node.get("user") or {}
    parents = u.get("parents") or []
    org = parents[0]["name"] if parents else None
    return {
        "username": u.get("username"),
        "name": _clean(u.get("name")),
        "type": u.get("type"),
        "org": org,
    }


def _to_record(node):
    sc = node.get("score") or {}
    return {
        "name": _clean(node.get("name")),
        "slug": node.get("slugifiedName"),
        "category": _clean(node.get("categoryName")),
        "pricing": node.get("pricing"),
        "popularity": sc.get("popularityScore"),
        "latencyMs": sc.get("avgLatency"),
        "serviceLevel": sc.get("avgServiceLevel"),
        "successRate": sc.get("avgSuccessRate"),
        "updatedAt": node.get("updatedAt"),
        "provider": _provider(node),
        "description": _clean(node.get("description")),
        "url": f"https://rapidapi.com/{(node.get('user') or {}).get('username','')}/api/{node.get('slugifiedName','')}",
    }


def _months_since(iso):
    if not iso:
        return None
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        delta = datetime.now(timezone.utc) - dt
        return round(delta.days / 30.4, 1)
    except Exception:
        return None


# ---------------- commands ----------------

def cmd_search(client, args):
    cats = [args.category] if getattr(args, "category", None) else []
    records, total, _ = client.search(args.term, cats, args.sort, args.max)
    _emit({"term": args.term, "category": args.category, "total": total,
           "returned": len(records), "results": records}, args, table_rows=records)


def cmd_category(client, args):
    records, total, _ = client.search(None, [args.name], args.sort, args.max)
    _emit({"category": args.name, "total": total, "returned": len(records),
           "results": records}, args, table_rows=records)


def cmd_categories(client, args):
    # Empty term, no category filter -> facets cover the whole catalog.
    _, total, facets = client.search(None, [], "popularity", 1)
    cats = sorted((facets or {}).get("category", []), key=lambda c: -c["count"])
    rows = [{"category": c["key"], "apiCount": c["count"]} for c in cats]
    _emit({"totalApis": total, "categories": rows}, args, table_rows=rows)


def cmd_api(client, args):
    term = args.term or args.slug.replace("-", " ")
    records, _, _ = client.search(term, [], "relevance", 40)
    match = next((r for r in records if r["slug"] == args.slug), None)
    if not match:
        match = next((r for r in records if args.slug in (r["slug"] or "")), None)
    if not match:
        print(_dump({"error": f"no catalog match for slug '{args.slug}'",
                     "hint": "pass --term to widen the search"}))
        sys.exit(1)
    match["ageMonths"] = _months_since(match.get("updatedAt"))
    _emit(match, args, table_rows=[match])


def cmd_gaps(client, args):
    records, total, _ = client.search(None, [args.category], "popularity", args.max)
    for r in records:
        r["ageMonths"] = _months_since(r.get("updatedAt"))
    weak = [r for r in records if (r.get("popularity") or 0) < 8.0]
    stale = [r for r in records if (r.get("ageMonths") or 0) >= 12]
    slow = [r for r in records if (r.get("latencyMs") or 0) >= 800]
    unreliable = [r for r in records if (r.get("successRate") or 100) < 95]
    free_heavy = sum(1 for r in records if r.get("pricing") in ("FREE", "FREEMIUM"))
    if not total:
        print(_dump({"category": args.category, "totalApis": 0,
                     "error": "no APIs found — category name is likely misspelled",
                     "hint": "run `pp-rapidapi categories` for exact category names"}))
        return
    signals = {
        "category": args.category,
        "totalApis": total,
        "analyzed": len(records),
        "saturation": "thin" if total < 25 else ("moderate" if total < 80 else "crowded"),
        "freemiumShare": round(free_heavy / len(records), 2) if records else None,
        "openings": {
            "lowPopularityIncumbents": [_brief(r) for r in weak[:10]],
            "staleApis_12moPlus": [_brief(r) for r in stale[:10]],
            "slowApis_800msPlus": [_brief(r) for r in slow[:10]],
            "unreliableApis_sub95pct": [_brief(r) for r in unreliable[:10]],
        },
        "note": "Openings = incumbents you could beat on reliability/latency/freshness. "
                "Thin saturation + weak leaders = best build-and-monetize signal.",
    }
    _emit(signals, args, table_rows=None)


def cmd_competition(client, args):
    records, total, _ = client.search(args.term, [], "popularity", args.max)
    for r in records:
        r["ageMonths"] = _months_since(r.get("updatedAt"))
    table = [_brief(r) for r in records]
    _emit({"term": args.term, "total": total, "competitors": table}, args, table_rows=table)


def _brief(r):
    return {
        "name": r["name"],
        "slug": r["slug"],
        "pricing": r["pricing"],
        "popularity": r["popularity"],
        "latencyMs": r["latencyMs"],
        "successRate": r["successRate"],
        "ageMonths": r.get("ageMonths"),
        "provider": (r.get("provider") or {}).get("name"),
        "url": r.get("url"),
    }


# ---------------- output ----------------

def _emit(obj, args, table_rows):
    if getattr(args, "table", False) and table_rows is not None:
        _print_table(table_rows)
    else:
        print(_dump(obj))


def _flat(v):
    if isinstance(v, dict):  # e.g. provider -> show its name
        return v.get("name") or v.get("org") or v.get("username") or ""
    return "" if v is None else str(v)


def _print_table(rows):
    if not rows:
        print("(no results)")
        return
    cols = [c for c in ("name", "slug", "pricing", "popularity", "latencyMs",
                        "successRate", "ageMonths", "provider", "category") if c in rows[0]]
    widths = {c: max(len(c), *(len(_flat(r.get(c))) for r in rows)) for c in cols}
    print("  ".join(c.ljust(widths[c]) for c in cols))
    print("  ".join("-" * widths[c] for c in cols))
    for r in rows:
        print("  ".join(_flat(r.get(c)).ljust(widths[c]) for c in cols))


def build_parser():
    p = argparse.ArgumentParser(prog="pp-rapidapi", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--table", action="store_true", help="human table instead of JSON")
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("search", help="ranked APIs for a keyword")
    sp.add_argument("term")
    sp.add_argument("--category")
    sp.add_argument("--max", type=int, default=20)
    sp.add_argument("--sort", choices=list(_SORT_MAP), default="relevance")
    sp.set_defaults(func=cmd_search)

    cp = sub.add_parser("category", help="every API in a category")
    cp.add_argument("name")
    cp.add_argument("--max", type=int, default=30)
    cp.add_argument("--sort", choices=list(_SORT_MAP), default="popularity")
    cp.set_defaults(func=cmd_category)

    lp = sub.add_parser("categories", help="API count per category (saturation map)")
    lp.set_defaults(func=cmd_categories)

    ap = sub.add_parser("api", help="one API's detail (best-effort from catalog)")
    ap.add_argument("slug")
    ap.add_argument("--term", help="search term to find it (defaults to slug words)")
    ap.set_defaults(func=cmd_api)

    gp = sub.add_parser("gaps", help="flag openings in a category")
    gp.add_argument("category")
    gp.add_argument("--max", type=int, default=60)
    gp.set_defaults(func=cmd_gaps)

    mp = sub.add_parser("competition", help="head-to-head table for a keyword")
    mp.add_argument("term")
    mp.add_argument("--max", type=int, default=20)
    mp.set_defaults(func=cmd_competition)
    return p


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        args.func(HubClient(), args)
    except HubError as e:
        print(_dump({"error": str(e)}), file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
