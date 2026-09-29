# pp-trains

Indian Railways from the command line: every train between two stations,
joined with fares, seats and confirm chance, plus the stop list, coach order,
PNR status and live running status. No key, no login. It cannot book.

Run `./pp-trains <cmd>`. JSON by default, `--table` for a human table.

## Commands

```
search ORIGIN DEST [DATE] [--class 3A] [--available] [--after HH:MM]
stations QUERY            station codes by name
route TRAIN               every stop, with times, km and day
train TRAIN               ends, times, days, classes, coach order
pnr PNR                   booking status, coach, berth, chart, platform
live TRAIN [--started today|yesterday|N]
```

```bash
# Everything that runs, including unreserved DEMUs
./pp-trains --table search INDB BNG

# One date, one class, with seats and confirm chance
./pp-trains --table search MMCT RTM 2026-11-01 --class 3A --after 20:00

# Names work too; they go through the station lookup
./pp-trains --table search indore barnagar "1 nov"

./pp-trains --table route 09079
./pp-trains --table train 12961
./pp-trains --table pnr 8154379047
./pp-trains --table live 12951 --started yesterday
```

Dates take `2026-11-01`, `01-11-2026`, `1 nov`, `today` or `tomorrow`.
Station codes are passed through as-is when typed in capitals (`MMCT`);
anything else is looked up by name.

## Where the data comes from

| Command | Source | Gives |
|---|---|---|
| `search` (no date) | erail | Every train that runs, with running days |
| `search DATE` | erail + ConfirmTkt, joined on train number | Adds fare, seat status and confirm chance per class |
| `stations` | ConfirmTkt autosuggest | Name to code |
| `route` | erail | The stop list |
| `train` | erail | Train summary and coach order, engine first (not published for every special) |
| `pnr` | RailYatri PNR page (HTML) | Status, coach/berth, chart status, tentative platform |
| `live` | RailYatri page JSON, relayed from NTES | Delay, current station, platform, upcoming ETAs |

Endpoints and field positions are in
[`docs/indian-railways-data-sources.md`](../../../docs/indian-railways-data-sources.md).

## Reading the output

- **UNRESERVED** trains (DEMU, MEMU, passenger, numbers 5xxxx-7xxxx) have no
  seats to book. Buy at the counter or on the UTS app. A booking API cannot
  see them at all, which is why the list starts from erail.
- **`[BDTS-RTM]`** after a name means the train leaves from a nearby station in
  the same city (Bandra Terminus, not Mumbai Central). ConfirmTkt searches a
  city as a group.
- A dated search drops trains that do not run that weekday.

## Caveats

All three sources are unofficial and public. They break the day a site
changes shape, not on billing. RailYatri says its live data can lag or be
crowd-sourced, so recheck at the station on the day.

`pnr` sends the PNR to RailYatri. It parses page HTML, so it is the command
most likely to break first.

No station board: erail's `station-live` page serves a stale snapshot (checked
2026-09-29 at 10:30, it still showed the previous night's trains), and
RailYatri has no equivalent page. Showing old data as live is worse than none.
