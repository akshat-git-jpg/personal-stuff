# pp-bus

Local bus timetables. Regional private buses (Indore ↔ Badnagar and the like)
have no API and do not show up on redBus, so each route is a JSON file typed in
from a printed timetable. Offline, no key, standard library only.

Run `./pp-bus <cmd>`.

## Commands

```
search ORIGIN DEST [--after HH:MM|now] [--arrive-by HH:MM] [--fastest]
routes             every route on file, with its as-of date
```

`--table` for a human table; JSON is the default. Place names are matched
against each route's alias list, so `indore`, `indoor`, `idr`, `badnagar`,
`barnagar` and `bandagar` all work.

```bash
./pp-bus --table search indore badnagar
./pp-bus --table search badnagar indore --after 12:00 --fastest
./pp-bus search idr bng --arrive-by 18:00 | jq '.results[].depart'
```

## Routes on file

| Route | Source | As of |
|---|---|---|
| Indore ↔ Badnagar (72 km) | Printed timetable at Badnagar, `sources/badnagar-indore-2026-08.jpg` | 2026-08 |

Indore has two stands for this route, **Sarwate** and **Jinsi**; the
Indore → Badnagar rows say which. Shakeel buses take about 2h, most others 3-4h.

## Adding a route

1. Put the photo in `sources/<route>-<yyyy-mm>.jpg`.
2. Copy `routes/indore-badnagar.json` to `routes/<route>.json`: `places` maps
   each canonical name to its aliases, `trips` is keyed `from>to`, times are
   24-hour `HH:MM`, `stand` is optional.
3. Check it with `./pp-bus --table search <from> <to>`.

When a new timetable photo arrives for an existing route, replace the file's
trips and bump `as_of`. These are printed times, not live data.
