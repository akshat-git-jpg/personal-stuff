# Local notes (not upstream)

Installed 2026-08-04 from
[rajprem4214/indian-railways-mcp](https://github.com/rajprem4214/indian-railways-mcp),
vendored as plain source with `.git` stripped (same convention as the other
server folders here). To update, re-clone over this folder and rebuild.

```bash
npm install && npm run build     # output lands in build/
```

Registered in the repo-root `.mcp.json` as `indian-railways`. No API key, no
account, no env vars. Restart Claude Code for it to appear in `/mcp`.

## Why this one

It reads **erail**, a timetable source, so it sees unreserved DEMU, MEMU and
passenger trains. The two competing MCPs read booking APIs or a private host
and miss roughly half the trains on a regional route. The full comparison and
both API contracts are in
[`docs/indian-railways-data-sources.md`](../../../docs/indian-railways-data-sources.md).
Read that before extending anything here.

## Tools, verified working 2026-08-04

| Tool | Args | Notes |
|---|---|---|
| `get-trains-between-stations` | `from`, `to` | Station **codes**, not names. The main one |
| `get-trains-on-date` | `from`, `to`, `date` | Same, filtered to a date |
| `get-train-route` | `trainNumber` | Despite the name, returns train-level metadata (origin, terminus, type, distance, average speed), not the stop list |
| `get-train-details` | `trainNumber` | |
| `get-station-live-status` | `stationCode` | |
| `get-pnr-status` | `pnrNumber` | Scrapes a ConfirmTkt page, so expect it to be the first thing that breaks |

Smoke test: `get-trains-between-stations INDB BNG` should return 10 trains
including `79313`. If it returns 3, something has swapped the data source for a
booking API and the result is wrong even though it looks fine.

## Gotchas

`operatingDays` is a 7-character string, **Monday first**, so `0110110` is
Tue/Wed/Fri/Sat. Times come back as `HH.MM` with a dot, not a colon.

There are no station-name lookups here, only codes. ConfirmTkt's autosuggest
endpoint (documented in the doc linked above) is the practical way to resolve a
name to a code.
