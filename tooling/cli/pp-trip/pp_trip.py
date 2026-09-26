#!/usr/bin/env python3
"""
pp-trip — CLI to manage trip pins for apps/trip-planner.

Design notes:
- Truth lives in `apps/trip-planner/trips/<slug>.json` (git-tracked).
- `pp-trip deploy` mirrors a trip into the Worker's KV.
- Geocoding ladder, cheapest first (see .claude/skills/pp-trip/SKILL.md):
    0. the local cache      -> apps/trip-planner/geocache.json, zero network
    1. --lat/--lon          -> the owner right-clicked the spot himself
    2. Nominatim (bounded)  -> free, no key, OSM data
    3. Google Places (New)  -> authoritative, and free at our volume
- Google is LAST because it needs a key and the free sources usually answer.
  It is also the only source that reliably has small businesses in India:
  OSM was missing Zostel Varkala, Hope Hostels and Coffee Temple entirely.
- Reads the write token from env `PP_TRIP_TOKEN`, then apps/trip-planner/.dev.vars.
- Reads the Places key from env `GOOGLE_PLACES_KEY`, then
  infra/secrets/google-places.env. Absent key is NOT fatal — the ladder just
  stops at Nominatim, which is what happens on a fresh clone.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

# --- paths -----------------------------------------------------------------

def repo_root() -> Path:
    # Assume this file lives at <repo>/tooling/cli/pp-trip/pp_trip.py.
    return Path(__file__).resolve().parents[3]

def trips_dir() -> Path:
    return repo_root() / "apps" / "trip-planner" / "trips"

def trip_file(slug: str) -> Path:
    return trips_dir() / f"{slug}.json"

def dev_vars_path() -> Path:
    return repo_root() / "apps" / "trip-planner" / ".dev.vars"

def google_secret_path() -> Path:
    return repo_root() / "infra" / "secrets" / "google-places.env"

def cache_path() -> Path:
    return repo_root() / "apps" / "trip-planner" / "geocache.json"

def usage_log_path() -> Path:
    """Append-only call log. Not XDG-strict on purpose: os.environ.get keeps
    this from raising KeyError on Windows, where XDG_CONFIG_HOME is unset."""
    base = os.environ.get("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    return Path(base) / "pp-trip" / "google-calls.log"

# --- config ----------------------------------------------------------------

DEFAULT_URL = "https://trips.agrolloo.com"

# Self-imposed monthly ceiling on Google calls. This is a RUNAWAY-LOOP
# DETECTOR, not a spend control: the key has no billing account attached, so
# Google cannot charge it at all — calls would fail instead. Sized to the real
# need (~15/month) plus room for a full re-audit.
GOOGLE_MONTHLY_CAP = 200

def google_monthly_cap() -> int:
    raw = os.environ.get("PP_TRIP_GOOGLE_CAP")
    if raw:
        try:
            return int(raw)
        except ValueError:
            pass
    return GOOGLE_MONTHLY_CAP

def base_url() -> str:
    return os.environ.get("PP_TRIP_URL") or DEFAULT_URL

def _read_env_file(path: Path, key: str) -> str | None:
    """Pull KEY=value out of a dotenv file.

    `.strip()` also removes a trailing \\r, which is what you get when the file
    was saved by a Windows editor. Without it the value carries an invisible
    carriage return into an HTTP header and the API answers 403 for no visible
    reason.
    """
    if not path.exists():
        return None
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() == key:
            return v.strip().strip('"').strip("'")
    return None

def admin_token() -> str:
    tok = os.environ.get("PP_TRIP_TOKEN")
    if tok:
        return tok
    tok = _read_env_file(dev_vars_path(), "ADMIN_TOKEN")
    if tok:
        return tok
    print("no admin token: set PP_TRIP_TOKEN or add ADMIN_TOKEN= to apps/trip-planner/.dev.vars", file=sys.stderr)
    sys.exit(2)

def google_key() -> str | None:
    """The Places API key, or None. None is a normal state, not an error."""
    return os.environ.get("GOOGLE_PLACES_KEY") or _read_env_file(google_secret_path(), "GOOGLE_PLACES_KEY")

# --- workspace guard -------------------------------------------------------

def assert_not_main() -> None:
    """Refuse to edit a tracked trip file from the main checkout.

    `.claude/hooks/no-edits-in-main.sh` would reject the write anyway, but as an
    opaque hook rejection. Failing here means the message names the fix.
    """
    try:
        r = subprocess.run(
            ["git", "-C", str(repo_root()), "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True, timeout=10,
        )
    except (OSError, subprocess.TimeoutExpired):
        return  # not a git checkout, or git is missing: let the write proceed
    if r.returncode != 0:
        return
    if r.stdout.decode("utf-8", errors="replace").strip() == "main":
        print(
            "refusing to edit a tracked trip file on branch main.\n"
            'claim a workspace first:  cd "$(pp-work claim --kind code --slug trip-planner)"',
            file=sys.stderr,
        )
        sys.exit(2)

# --- slug helpers ----------------------------------------------------------

SLUG_RE = re.compile(r"^[a-z0-9-]{1,64}$")

def check_slug(slug: str) -> None:
    if slug == "__index" or not SLUG_RE.match(slug):
        print(f"bad slug: {slug!r} (a-z, 0-9, dash, 1-64 chars)", file=sys.stderr)
        sys.exit(2)

def make_pin_id(name: str, category: str, existing: set[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "pin"
    stem = f"{category[:5]}-{base}"[:40]
    cand = stem
    i = 2
    while cand in existing:
        cand = f"{stem}-{i}"
        i += 1
    return cand

# --- io --------------------------------------------------------------------

def read_trip(slug: str) -> dict:
    p = trip_file(slug)
    if not p.exists():
        print(f"no such trip: {slug} (looked at {p})", file=sys.stderr)
        sys.exit(1)
    return json.loads(p.read_text(encoding="utf-8"))

def write_trip(trip: dict) -> None:
    assert_not_main()
    trip["updatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    p = trip_file(trip["slug"])
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(trip, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

# --- geometry helpers (pure, unit-tested) ----------------------------------

def parse_viewbox(viewbox: str) -> tuple[float, float, float, float] | None:
    """'W,N,E,S' (lon/lat pairs, Nominatim's order) -> (west, north, east, south).

    Nominatim's viewbox puts NORTH before SOUTH, so `north` is the larger
    latitude even though it is the second field. Overpass wants (S,W,N,E) and
    Google wants low/high corners; both are derived from this, never guessed.
    """
    parts = [x.strip() for x in (viewbox or "").split(",")]
    if len(parts) != 4:
        return None
    try:
        w, n, e, s = (float(x) for x in parts)
    except ValueError:
        return None
    return w, n, e, s

def in_viewbox(lat: float, lon: float, viewbox: str | None) -> bool:
    """True if the point sits inside the box, or if there is no box to check."""
    if not viewbox:
        return True
    box = parse_viewbox(viewbox)
    if box is None:
        return True
    w, n, e, s = box
    return min(s, n) <= lat <= max(s, n) and min(w, e) <= lon <= max(w, e)

def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres. Used to report how far a re-audit moved a pin."""
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))

def hint_tokens(hint: str) -> list[str]:
    """'Varkala, Kerala, India' -> ['varkala', 'kerala', 'india']."""
    return [t.strip().lower() for t in (hint or "").split(",") if t.strip()]

def address_matches_hint(address: str, hint: str | None) -> bool:
    """True if the returned address names at least one place from the trip hint.

    Deliberately ANY rather than ALL: Google often omits the country, or writes
    a district instead of the town. Requiring every token would reject good
    answers, which is the failure mode that caused the whole mess.
    """
    toks = hint_tokens(hint or "")
    if not toks:
        return True
    a = (address or "").lower()
    return any(t in a for t in toks)

# Words that carry no identity: two different cafes both contain "cafe".
GENERIC_NAME_WORDS = {
    "cafe", "restaurant", "hotel", "hostel", "the", "a", "an", "of", "on", "in",
    "at", "and", "by", "bar", "beach", "resort", "rooms", "room", "stay", "inn",
    "homestay", "house", "kitchen", "lounge", "varkala", "kerala", "india",
}

def name_tokens(name: str) -> set[str]:
    """Identity-bearing words of a place name, lowercased."""
    words = re.split(r"[^a-z0-9]+", (name or "").lower())
    return {w for w in words if w and len(w) > 1 and w not in GENERIC_NAME_WORDS}

def name_matches(pin_name: str, found_name: str, threshold: float = 0.6) -> bool:
    """Do these two names plausibly describe the same place?

    Guards the placeId adoption in `audit`. On 2026-09-10 a pin for
    "Holy Rabbit Cafe" was 119 m from Google's "The White Rabbit Cafe" and got
    that place's id attached, which would have sent the Directions button to
    the wrong restaurant. Distance alone cannot catch that -- on a cliff packed
    with cafes, 119 m is several doors down.

    Scored against the SHORTER token set, so a pin carrying a long
    parenthetical ("Sivagiri Mutt (Sree Narayana Guru samadhi area)") still
    matches the plain "Sivagiri Mutt".
    """
    a, b = name_tokens(pin_name), name_tokens(found_name)
    if not a or not b:
        return True  # nothing distinctive to compare; fall back to distance
    return len(a & b) / min(len(a), len(b)) >= threshold

def norm_query(query: str) -> str:
    """Cache lookup key for a free-text search. Case and spacing do not matter."""
    return re.sub(r"\s+", " ", (query or "").strip().lower())

# --- cache -----------------------------------------------------------------
#
# Keyed by `place_id` (stable, and Google's terms exempt it from the caching
# limit) with a secondary `queries` index mapping the text we searched for onto
# that id. Written sorted + indented so two concurrent workspaces conflict on a
# line rather than on the whole JSON object.

def load_cache() -> dict:
    p = cache_path()
    if not p.exists():
        return {"places": {}, "queries": {}}
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"places": {}, "queries": {}}
    d.setdefault("places", {})
    d.setdefault("queries", {})
    return d

def save_cache(d: dict) -> None:
    p = cache_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(d, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")

def cache_lookup(query: str, hint: str | None) -> dict | None:
    d = load_cache()
    pid = d["queries"].get(f"{norm_query(query)}|{norm_query(hint or '')}")
    if not pid:
        return None
    return d["places"].get(pid)

def cache_store(query: str, hint: str | None, place: dict) -> None:
    d = load_cache()
    d["places"][place["placeId"]] = place
    d["queries"][f"{norm_query(query)}|{norm_query(hint or '')}"] = place["placeId"]
    save_cache(d)

# --- Google call budget ----------------------------------------------------

def record_google_call(query: str, status: int) -> None:
    """Append one line per ATTEMPT, including retries and failures.

    Append-only because a read-modify-write counter silently loses increments
    when two adds run at once, and a guard that undercounts is not a guard.
    """
    p = usage_log_path()
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with p.open("a", encoding="utf-8") as fh:
            fh.write(f"{stamp}\t{status}\t{norm_query(query)[:120]}\n")
    except OSError:
        pass  # a broken log must never block the actual work

def google_calls_this_month() -> int:
    """Count attempts in the current UTC month.

    Google's own free-tier window resets on Pacific time, so this is off by a
    few hours at a month boundary. That is fine: this number is a loop detector,
    never a statement about the remaining free allowance.
    """
    p = usage_log_path()
    if not p.exists():
        return 0
    prefix = datetime.now(timezone.utc).strftime("%Y-%m")
    try:
        return sum(1 for line in p.read_text(encoding="utf-8", errors="replace").splitlines() if line.startswith(prefix))
    except OSError:
        return 0

# --- http ------------------------------------------------------------------

class HttpError(Exception):
    """A transport or protocol failure — explicitly NOT 'no such place'."""

def _curl_config(url: str, headers: dict, method: str | None, body_file: str | None) -> str:
    lines = [f'url = "{url}"']
    if method:
        lines.append(f'request = "{method}"')
    for k, v in headers.items():
        lines.append(f'header = "{k}: {v}"')
    if body_file:
        lines.append(f'data-binary = "@{body_file}"')
    lines.append("silent")
    lines.append("show-error")
    lines.append("max-time = 25")
    lines.append('write-out = "\\n__HTTP_STATUS__:%{http_code}"')
    return "\n".join(lines) + "\n"

def curl_json(url: str, headers: dict, method: str | None = None, body: dict | None = None) -> tuple[int, object]:
    """Return (http_status, parsed_json).

    Uses curl because macOS's system Python has no CA bundle. Everything goes
    through a --config file on stdin so secrets never appear in argv (and so
    never in `ps` output).

    Raises HttpError for a transport failure. That distinction is the whole
    point: an empty result body means "no such place", but a DNS error, a TLS
    error or a timeout also produce empty output, and treating those as "no
    such place" is exactly how three real places got declared nonexistent.
    """
    body_path = None
    try:
        if body is not None:
            fh = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
            json.dump(body, fh)
            fh.close()
            body_path = fh.name
        cfg = _curl_config(url, headers, method, body_path)
        try:
            r = subprocess.run(["curl", "--config", "-"], input=cfg.encode("utf-8"),
                               capture_output=True, timeout=40)
        except subprocess.TimeoutExpired as exc:
            raise HttpError("curl timed out after 40s") from exc
        except OSError as exc:
            raise HttpError(f"could not run curl: {exc}") from exc
        out = r.stdout.decode("utf-8", errors="replace")
        err = r.stderr.decode("utf-8", errors="replace").strip()
        marker = "\n__HTTP_STATUS__:"
        if marker not in out:
            raise HttpError(f"curl exit {r.returncode}: {err or 'no response'}")
        text, code_txt = out.rsplit(marker, 1)
        try:
            status = int(code_txt.strip())
        except ValueError as exc:
            raise HttpError(f"unreadable status: {code_txt!r}") from exc
        if r.returncode != 0 and status == 0:
            raise HttpError(f"curl exit {r.returncode}: {err or 'transport failure'}")
        try:
            return status, json.loads(text) if text.strip() else None
        except json.JSONDecodeError:
            return status, None
    finally:
        if body_path:
            try:
                os.unlink(body_path)
            except OSError:
                pass

def _curl(url: str, method: str, token: str, body: bytes | None) -> tuple[int, str]:
    """Worker API call. Kept separate from curl_json: it returns raw text."""
    cmd = [
        "curl", "-sS", "-X", method,
        "-H", f"x-admin-token: {token}",
        "--max-time", "30",
        "-o", "-", "-w", "\n__HTTP_STATUS__:%{http_code}",
        url,
    ]
    if body is not None:
        cmd += ["-H", "content-type: application/json", "--data-binary", "@-"]
    try:
        r = subprocess.run(cmd, input=body, capture_output=True, timeout=60)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return 0, f"transport failure: {exc}"
    out = r.stdout.decode("utf-8", errors="replace")
    marker = "\n__HTTP_STATUS__:"
    if marker in out:
        body_txt, code_txt = out.rsplit(marker, 1)
        try:
            return int(code_txt.strip()), body_txt
        except ValueError:
            return 0, out
    return 0, out or r.stderr.decode("utf-8", errors="replace")

def http_put_json(url: str, body: dict, token: str) -> tuple[int, str]:
    return _curl(url, "PUT", token, json.dumps(body).encode("utf-8"))

def http_delete(url: str, token: str) -> tuple[int, str]:
    return _curl(url, "DELETE", token, None)

# --- geocode: Nominatim (free, no key) -------------------------------------

_last_nominatim_hit = 0.0

def nominatim_search(query: str, viewbox: str | None = None) -> tuple[float, float, str] | None:
    """Return (lat, lon, display_name), or None when there is genuinely no match.

    Rate-limited to ~1 req/sec per Nominatim policy. `viewbox` bounds the search
    ('W,N,E,S' lon/lat pairs) — that is what stops "Kappil Beach" in Varkala
    from resolving to a beach 500 km away in Kasaragod.

    Raises HttpError on a transport failure rather than returning None.
    """
    global _last_nominatim_hit
    wait = 1.05 - (time.time() - _last_nominatim_hit)
    if wait > 0:
        time.sleep(wait)
    _last_nominatim_hit = time.time()

    params = {"q": query, "format": "json", "limit": "1"}
    if viewbox:
        params["viewbox"] = viewbox
        params["bounded"] = "1"
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(params)
    status, data = curl_json(url, {"User-Agent": "pp-trip/1.0 (kushal.b@zluri.com)"})
    if status != 200:
        raise HttpError(f"nominatim http {status}")
    if not data:
        return None
    return float(data[0]["lat"]), float(data[0]["lon"]), data[0].get("display_name", "")

# --- geocode: Google Places (New) ------------------------------------------

PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"

# Field mask kept to what we actually use. `displayName` is a Pro-tier field
# and `location` is Pro on Text Search (it is Essentials only on Place
# Details) — so this request bills as Text Search Pro. That tier is free to
# 35,000 calls/month under Google's India pricing, against a real need of ~15,
# and the key has no billing account so it cannot be charged regardless.
PLACES_FIELD_MASK = "places.id,places.displayName,places.location,places.formattedAddress,places.types"

_last_google_hit = 0.0

def google_places_search(query: str, viewbox: str | None = None, limit: int = 3) -> list[dict]:
    """Search Google Places by text. Returns up to `limit` candidates.

    `locationRestriction` is SENT, not just checked afterwards: bounding the
    search server-side gets the right answer first time instead of rejecting a
    wrong one after the fact.

    Raises HttpError on transport failure, a missing key, or the monthly cap.
    """
    global _last_google_hit
    key = google_key()
    if not key:
        raise HttpError(
            "no Places key. Set GOOGLE_PLACES_KEY, or add it to "
            "infra/secrets/google-places.env (see google-places.env.example)."
        )

    cap = google_monthly_cap()
    used = google_calls_this_month()
    if used >= cap:
        raise HttpError(
            f"self-imposed cap reached: {used}/{cap} Google calls this month. "
            f"This guards against a runaway loop, not a bill. Raise it for one "
            f"run with PP_TRIP_GOOGLE_CAP=<n> if this is expected."
        )

    wait = 0.35 - (time.time() - _last_google_hit)
    if wait > 0:
        time.sleep(wait)
    _last_google_hit = time.time()

    body: dict = {"textQuery": query, "maxResultCount": max(1, min(limit, 5))}
    box = parse_viewbox(viewbox) if viewbox else None
    if box:
        w, n, e, s = box
        body["locationRestriction"] = {"rectangle": {
            "low":  {"latitude": min(s, n), "longitude": min(w, e)},
            "high": {"latitude": max(s, n), "longitude": max(w, e)},
        }}

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": PLACES_FIELD_MASK,
    }

    last_err = ""
    for attempt in (1, 2):
        try:
            status, data = curl_json(PLACES_SEARCH_URL, headers, method="POST", body=body)
        except HttpError as exc:
            record_google_call(query, 0)
            last_err = str(exc)
            if attempt == 2:
                raise
            time.sleep(1.5)
            continue
        record_google_call(query, status)
        if status == 200:
            out = []
            for p in (data or {}).get("places", []):
                loc = p.get("location") or {}
                if loc.get("latitude") is None:
                    continue
                out.append({
                    "placeId": p.get("id", ""),
                    "name": (p.get("displayName") or {}).get("text", ""),
                    "lat": float(loc["latitude"]),
                    "lon": float(loc["longitude"]),
                    "address": p.get("formattedAddress", ""),
                    "types": p.get("types", []),
                })
            return out
        msg = ((data or {}).get("error") or {}).get("message", "") if isinstance(data, dict) else ""
        if status in (401, 403):
            raise HttpError(
                f"Places API rejected the key (http {status}). {msg[:160]}\n"
                "Check the key is restricted to places.googleapis.com and that "
                "the API is enabled. Do NOT cache this as 'place not found'."
            )
        if status == 429 or 500 <= status < 600:
            last_err = f"http {status}: {msg[:160]}"
            if attempt == 2:
                raise HttpError(last_err)
            time.sleep(2.0)
            continue
        raise HttpError(f"http {status}: {msg[:200]}")
    raise HttpError(last_err or "google places: unreachable")

def resolve_place(query: str, viewbox: str | None, hint: str | None,
                  use_cache: bool = True, dry_run: bool = False) -> dict | None:
    """The ladder: cache -> Nominatim -> Google. Returns a place dict or None.

    A place dict is {placeId?, name, lat, lon, address, source}. `source` says
    which rung answered, and it is written onto the pin so the owner can see
    which pins rest on weaker evidence.
    """
    if use_cache:
        hit = cache_lookup(query, hint)
        if hit:
            out = dict(hit)
            out["source"] = "cache:" + out.get("source", "unknown")
            return out

    if dry_run:
        print(f"  [dry-run] would search: {query!r}  viewbox={viewbox}  hint={hint!r}", file=sys.stderr)
        return None

    # Rung 2: Nominatim. A transport error here must not be mistaken for a miss.
    try:
        got = nominatim_search(query, viewbox=viewbox)
    except HttpError as exc:
        print(f"  nominatim unavailable ({exc}) — falling through to Google", file=sys.stderr)
        got = None
    else:
        if got:
            lat, lon, display = got
            if address_matches_hint(display, hint):
                return {"name": query, "lat": lat, "lon": lon, "address": display, "source": "osm"}
            print(f"  nominatim answered outside {hint!r}: {display[:90]} — trying Google", file=sys.stderr)

    # Rung 3: Google.
    cands = google_places_search(query, viewbox=viewbox, limit=3)
    if not cands:
        return None
    good = [c for c in cands if address_matches_hint(c["address"], hint) and in_viewbox(c["lat"], c["lon"], viewbox)]
    if not good:
        print("  google returned only out-of-area results:", file=sys.stderr)
        for c in cands:
            print(f"    {c['name'][:40]:40} {c['address'][:70]}", file=sys.stderr)
        return None
    if len(good) > 1:
        # Never silently take [0]. Two 'Hope Hostel' properties in one town is
        # a real case, and picking the first is how a pin lands 1.5 km out.
        print(f"  {len(good)} candidates for {query!r} — showing all, using the first:", file=sys.stderr)
        for i, c in enumerate(good, 1):
            mark = "->" if i == 1 else "  "
            print(f"   {mark} {i}. {c['name'][:38]:38} {c['lat']:.6f},{c['lon']:.6f}  {c['address'][:60]}", file=sys.stderr)
        print("      pass --lat/--lon to pick a different one.", file=sys.stderr)
    best = dict(good[0])
    best["source"] = "google"
    cache_store(query, hint, best)
    return best

# --- commands --------------------------------------------------------------

def cmd_new(a: argparse.Namespace) -> None:
    check_slug(a.slug)
    p = trip_file(a.slug)
    if p.exists() and not a.force:
        print(f"already exists: {p} (use --force to overwrite)", file=sys.stderr)
        sys.exit(1)
    trip = {
        "slug": a.slug,
        "name": a.name or a.slug.replace("-", " ").title(),
        "dates": a.dates or "",
        "viewbox": a.viewbox or "",
        "locationHint": a.location_hint or "",
        "pins": [],
        "updatedAt": "",
    }
    write_trip(trip)
    print(f"created {p}")
    if not trip["viewbox"] or not trip["locationHint"]:
        print("set `viewbox` and `locationHint` before adding pins — see the skill.", file=sys.stderr)

def cmd_list_trips(_a: argparse.Namespace) -> None:
    d = trips_dir()
    if not d.exists():
        print("(no trips yet)")
        return
    for f in sorted(d.glob("*.json")):
        try:
            t = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        print(f"{t.get('slug'):30s}  {t.get('name','')}  ({len(t.get('pins',[]))} pins)  {t.get('dates','')}")

def cmd_list_pins(a: argparse.Namespace) -> None:
    t = read_trip(a.slug)
    for p in t["pins"]:
        loc = f"{p['lat']:.4f},{p['lon']:.4f}"
        src = p.get("source", "?")
        print(f"{p['id']:32s}  {p.get('emoji','.')}  {p['category']:9s}  {loc}  {src:8s}  {p['name']}")

def _apply_place(pin: dict, place: dict) -> None:
    pin["lat"] = place["lat"]
    pin["lon"] = place["lon"]
    if place.get("placeId"):
        pin["placeId"] = place["placeId"]
    pin["source"] = place.get("source", "unknown").replace("cache:", "")

def cmd_add(a: argparse.Namespace) -> None:
    t = read_trip(a.slug)
    vb = a.viewbox or t.get("viewbox") or None
    hint = t.get("locationHint") or None
    place: dict

    if a.lat is not None and a.lon is not None:
        # Rung 1: explicit numbers. Default provenance is "owner" (he
        # long-pressed the spot) — pass --source when they came from somewhere
        # else, so `audit` knows it may re-check them and the card tells the
        # truth about how good they are.
        place = {"name": a.name, "lat": a.lat, "lon": a.lon, "address": "", "source": a.source or "owner"}
        if a.place_id:
            place["placeId"] = a.place_id
    else:
        q = a.query or a.name
        print(f"resolving: {q}" + (f"  (viewbox {vb})" if vb else ""), file=sys.stderr)
        try:
            found = resolve_place(q, vb, hint, use_cache=not a.no_cache, dry_run=a.dry_run)
        except HttpError as exc:
            print(f"lookup failed: {exc}", file=sys.stderr)
            sys.exit(1)
        if a.dry_run:
            sys.exit(0)
        if not found:
            print(
                "no match. NEVER GUESS COORDS. Do one of:\n"
                "  1) pass --lat / --lon (long-press the spot in Google Maps, tap the coords)\n"
                '  2) refine with --query "<name> <landmark or town>"\n'
                "  3) try a SUBSTRING or a spelling variant -- OSM and Google disagree\n"
                "     (Sarwaa vs Sarva, Kurakkanni vs Kurakanni)\n"
                "  4) check the trip's `viewbox` is not excluding the place",
                file=sys.stderr,
            )
            sys.exit(1)
        place = found
        print(f"  {place['source']:8s} -> {place['lat']:.6f},{place['lon']:.6f}  |  {place.get('address','')[:100]}", file=sys.stderr)
        if not in_viewbox(place["lat"], place["lon"], vb):
            print(f"  REJECTED: outside the trip viewbox {vb}", file=sys.stderr)
            sys.exit(1)
        if not a.yes:
            print("verify the address above, then re-run with --yes to save.", file=sys.stderr)
            sys.exit(3)

    existing = {p["id"] for p in t["pins"]}
    pin_id = a.id or make_pin_id(a.name, a.category, existing)
    if pin_id in existing:
        print(f"pin id already exists: {pin_id}", file=sys.stderr)
        sys.exit(1)
    pin = {
        "id": pin_id,
        "name": a.name,
        "emoji": a.emoji or DEFAULT_EMOJI.get(a.category, "📍"),
        "category": a.category,
        "lat": 0.0,
        "lon": 0.0,
    }
    _apply_place(pin, place)
    if a.note:
        pin["note"] = a.note
    if a.gmaps_query:
        pin["gmapsQuery"] = a.gmaps_query
    t["pins"].append(pin)
    write_trip(t)
    print(f"added {pin_id}  ({pin['lat']:.4f},{pin['lon']:.4f})  source={pin['source']}")

def cmd_update(a: argparse.Namespace) -> None:
    """Change one pin in place, keeping its id, note and emoji."""
    t = read_trip(a.slug)
    pin = next((p for p in t["pins"] if p["id"] == a.pin_id), None)
    if not pin:
        print(f"no such pin: {a.pin_id}", file=sys.stderr)
        sys.exit(1)
    if a.name:
        pin["name"] = a.name
    if a.note is not None:
        pin["note"] = a.note
    if a.emoji:
        pin["emoji"] = a.emoji
    if a.lat is not None and a.lon is not None:
        _apply_place(pin, {"lat": a.lat, "lon": a.lon, "source": a.source or "owner",
                           **({"placeId": a.place_id} if a.place_id else {})})
    write_trip(t)
    print(f"updated {a.pin_id}  ({pin['lat']:.4f},{pin['lon']:.4f})  source={pin.get('source','?')}")

def cmd_remove(a: argparse.Namespace) -> None:
    t = read_trip(a.slug)
    before = len(t["pins"])
    t["pins"] = [p for p in t["pins"] if p["id"] != a.pin_id]
    if len(t["pins"]) == before:
        print(f"no such pin: {a.pin_id}", file=sys.stderr)
        sys.exit(1)
    write_trip(t)
    print(f"removed {a.pin_id}")

def cmd_audit(a: argparse.Namespace) -> None:
    """Re-resolve every pin and REPORT the drift. Only writes with --apply.

    Two very different outcomes, kept deliberately separate, because the
    2026-09-10 audit proved a blanket rewrite is dangerous:

    - **Agrees** (within --tolerance): adopt the placeId and source, and
      LEAVE THE COORDINATES ALONE. Two sources agreeing is confirmation, not
      a reason to nudge a good pin by 20 m.
    - **Disagrees** (beyond --tolerance): report it and change nothing unless
      --apply names it via --only. That audit surfaced five disagreements and
      only ONE of them was our pin being wrong; for the other four Google
      offered a nearby resort, a plus-code, or a boat club in place of a
      beach. Auto-applying would have made the map worse.

    `source: owner` pins are skipped entirely unless --include-owner.
    """
    t = read_trip(a.slug)
    vb = a.viewbox or t.get("viewbox") or None
    hint = t.get("locationHint") or None
    only = {s.strip() for s in a.only.split(",") if s.strip()} if a.only else None
    adopt: list[tuple[dict, dict]] = []
    moves: list[tuple[dict, dict, float]] = []
    skipped = 0

    for pin in t["pins"]:
        if only and pin["id"] not in only:
            continue
        if pin.get("source") == "owner" and not a.include_owner:
            print(f"  skip    {pin['name'][:40]:40} (owner-set coords)")
            skipped += 1
            continue
        q = pin.get("gmapsQuery") or pin["name"]
        try:
            found = resolve_place(q, vb, hint, use_cache=not a.no_cache)
        except HttpError as exc:
            print(f"  ERROR   {pin['name'][:40]:40} {exc}")
            continue
        if not found:
            print(f"  NOMATCH {pin['name'][:40]:40} (left as-is)")
            continue
        dist = haversine_m(pin["lat"], pin["lon"], found["lat"], found["lon"])
        verdict = "ok" if dist <= a.tolerance else "DIFFERS"
        print(f"  {verdict:7s} {pin['name'][:40]:40} {dist:7.0f}m  {found['source']:12s} {found.get('address','')[:44]}")
        if dist > a.tolerance:
            moves.append((pin, found, dist))
        else:
            # Record the confirmation even when there is no placeId to adopt:
            # an OSM-verified pin still deserves an honest `source`, and
            # without this the label silently stays missing.
            new_src = found.get("source", "unknown").replace("cache:", "")
            if not name_matches(pin["name"], found.get("name", "")):
                print(f"          ^ name mismatch vs {found.get('name','?')!r} — not adopting its placeId")
                continue
            id_new = found.get("placeId") and pin.get("placeId") != found["placeId"]
            if id_new or pin.get("source") != new_src:
                adopt.append((pin, found))

    print(f"\n{len(t['pins'])} pins | {len(adopt)} placeId to adopt | {len(moves)} disagree | {skipped} skipped")
    if moves:
        print("\ndisagreements are NOT auto-applied. Check each, then either:")
        for pin, found, dist in moves:
            print(f"  pp-trip update {a.slug} {pin['id']} --lat {found['lat']:.6f} --lon {found['lon']:.6f}"
                  f"{' --place-id ' + found['placeId'] if found.get('placeId') else ''}   # {dist:.0f}m")
        print(f"  ...or accept them wholesale with:  pp-trip audit {a.slug} --apply --only <id[,id]>")
    if not a.apply:
        if adopt:
            print(f"\nre-run with --apply to adopt {len(adopt)} placeId(s) (coordinates untouched).")
        return

    for pin, found in adopt:
        # placeId + source only. Coordinates stay exactly as they were.
        if found.get("placeId"):
            pin["placeId"] = found["placeId"]
        pin["source"] = found.get("source", "unknown").replace("cache:", "")
    applied_moves = 0
    if only:
        for pin, found, _ in moves:
            _apply_place(pin, found)
            applied_moves += 1
    if adopt or applied_moves:
        write_trip(t)
    print(f"applied: {len(adopt)} placeId(s), {applied_moves} coordinate change(s)")

def cmd_cache(a: argparse.Namespace) -> None:
    d = load_cache()
    if a.action == "stats":
        print(f"cache file : {cache_path()}")
        print(f"places     : {len(d['places'])}")
        print(f"queries    : {len(d['queries'])}")
        print(f"google log : {usage_log_path()}")
        print(f"calls this month (UTC): {google_calls_this_month()} / {google_monthly_cap()}")
    elif a.action == "list":
        for pid, p in sorted(d["places"].items(), key=lambda kv: kv[1].get("name", "")):
            print(f"{pid:32s}  {p.get('name','')[:34]:34}  {p['lat']:.6f},{p['lon']:.6f}  {p.get('source','?')}")
    elif a.action == "clear":
        save_cache({"places": {}, "queries": {}})
        print("cache cleared")

def cmd_deploy(a: argparse.Namespace) -> None:
    slugs = [a.slug] if a.slug != "all" else [f.stem for f in sorted(trips_dir().glob("*.json"))]
    token = admin_token()
    url = base_url()
    fail = 0
    for slug in slugs:
        t = read_trip(slug)
        code, body = http_put_json(f"{url}/api/trips/{urllib.parse.quote(slug)}", t, token)
        ok = code == 200
        print(f"{slug:30s}  {code}  {'OK' if ok else 'FAIL'}  {body[:120]}")
        if not ok:
            fail += 1
    sys.exit(1 if fail else 0)

def cmd_delete_remote(a: argparse.Namespace) -> None:
    token = admin_token()
    url = base_url()
    code, body = http_delete(f"{url}/api/trips/{urllib.parse.quote(a.slug)}", token)
    print(f"{code}  {body}")
    sys.exit(0 if code == 200 else 1)

# --- defaults --------------------------------------------------------------

DEFAULT_EMOJI = {
    "stay": "🏠",
    "transport": "🚌",
    "beach": "🏖️",
    "sight": "🌅",
    "food": "☕",
    "utility": "🏧",
}
CATEGORIES = list(DEFAULT_EMOJI.keys())

# --- parser ----------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="pp-trip", description="Manage trip pins for apps/trip-planner.")
    sub = p.add_subparsers(dest="cmd", required=True)

    new = sub.add_parser("new", help="Create a new trip JSON.")
    new.add_argument("slug")
    new.add_argument("--name")
    new.add_argument("--dates")
    new.add_argument("--viewbox", help="Bbox 'W,N,E,S' (lon,lat pairs) around the destination. Required in practice.")
    new.add_argument("--location-hint", dest="location_hint", help='e.g. "Varkala, Kerala, India"')
    new.add_argument("--force", action="store_true")
    new.set_defaults(func=cmd_new)

    trips_ls = sub.add_parser("trips", help="List every trip file.")
    trips_ls.set_defaults(func=cmd_list_trips)

    ls = sub.add_parser("list", help="List pins in a trip.")
    ls.add_argument("slug")
    ls.set_defaults(func=cmd_list_pins)

    add = sub.add_parser("add", help="Add a pin (cache -> Nominatim -> Google Places).")
    add.add_argument("slug")
    add.add_argument("--name", required=True)
    add.add_argument("--category", choices=CATEGORIES, required=True)
    add.add_argument("--emoji")
    add.add_argument("--lat", type=float)
    add.add_argument("--lon", type=float)
    add.add_argument("--place-id", dest="place_id", help="Google place id, if you already have it")
    add.add_argument("--source", choices=["owner", "google", "osm", "overture", "unknown"],
                     help="Provenance for an explicit --lat/--lon. Defaults to 'owner'.")
    add.add_argument("--query", help="Search text if --lat/--lon are not given (defaults to --name)")
    add.add_argument("--note")
    add.add_argument("--id")
    add.add_argument("--gmaps-query", dest="gmaps_query")
    add.add_argument("--viewbox", help="Override the trip's bbox for this lookup.")
    add.add_argument("--no-cache", action="store_true", help="Ignore the cache and re-query.")
    add.add_argument("--dry-run", action="store_true", help="Print the lookup that would run, call nothing.")
    add.add_argument("--yes", action="store_true", help="Save without the confirmation stop (only after reading the address).")
    add.set_defaults(func=cmd_add)

    up = sub.add_parser("update", help="Change one pin in place (keeps id, note, emoji).")
    up.add_argument("slug")
    up.add_argument("pin_id")
    up.add_argument("--name")
    up.add_argument("--note")
    up.add_argument("--emoji")
    up.add_argument("--lat", type=float)
    up.add_argument("--lon", type=float)
    up.add_argument("--place-id", dest="place_id")
    up.add_argument("--source", choices=["owner", "google", "osm", "overture", "unknown"])
    up.set_defaults(func=cmd_update)

    rm = sub.add_parser("remove", help="Remove a pin by id.")
    rm.add_argument("slug")
    rm.add_argument("pin_id")
    rm.set_defaults(func=cmd_remove)

    au = sub.add_parser("audit", help="Re-resolve every pin and report drift. Writes only with --apply.")
    au.add_argument("slug")
    au.add_argument("--tolerance", type=float, default=150.0, help="Metres of drift to accept silently (default 150).")
    au.add_argument("--apply", action="store_true", help="Adopt placeIds. Coordinates move only for ids named by --only.")
    au.add_argument("--only", help="Restrict to these pin ids (comma-separated). Required to move any coordinate.")
    au.add_argument("--include-owner", action="store_true", help="Also re-resolve pins whose coords the owner set.")
    au.add_argument("--no-cache", action="store_true")
    au.add_argument("--viewbox")
    au.set_defaults(func=cmd_audit)

    ca = sub.add_parser("cache", help="Inspect or clear the geocode cache.")
    ca.add_argument("action", choices=["stats", "list", "clear"])
    ca.set_defaults(func=cmd_cache)

    dep = sub.add_parser("deploy", help="Push a trip (or 'all') from JSON to the Worker's KV.")
    dep.add_argument("slug", help="trip slug, or 'all' for every JSON in trips/")
    dep.set_defaults(func=cmd_deploy)

    dele = sub.add_parser("delete-remote", help="Delete a trip from the Worker's KV.")
    dele.add_argument("slug")
    dele.set_defaults(func=cmd_delete_remote)

    return p

def main() -> None:
    args = build_parser().parse_args()
    args.func(args)

if __name__ == "__main__":
    main()
