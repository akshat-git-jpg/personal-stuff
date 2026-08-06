# Indian Railways data sources

Written 2026-08-04 after a search for Indore to Barnagar returned 3 trains when
the real answer was 10. This is the reference for anything that needs train
data, whichever tool ends up consuming it.

## The one thing to know

**There are two kinds of Indian Railways API, and they answer different
questions.**

A *booking* API (ConfirmTkt, IRCTC, most "seat availability" services) knows
about trains you can reserve a berth on. It is organised around quota, class
and availability. An *unreserved* train has none of those, so a booking API
cannot represent it and simply omits it.

A *timetable* API (erail) knows about trains that run. It has no fares or
availability, but it lists everything on the rails.

Roughly half the trains on a short regional route are unreserved DEMU, MEMU or
passenger services. On Indore to Barnagar, 4 of the 10 trains were invisible to
the booking API, including the one the owner actually asked about (79313). If a
result set looks suspiciously thin, this is why.

Train numbers give it away:

| Series | Kind | In a booking API? |
|---|---|---|
| 1xxxx, 2xxxx | Mail, express, superfast, Rajdhani, Shatabdi | Yes |
| 0xxxx | Special (reserved) | Yes |
| 5xxxx, 6xxxx, 7xxxx | Passenger, DEMU, MEMU, unreserved | **No** |

## Source A: erail (timetable, no key)

Everything that runs, with times and running days. No fares, no availability.

```
GET https://erail.in/rail/getTrains.aspx
    ?Station_From=INDB&Station_To=BNG&DataSource=0&Language=0&Cache=true
```

Send any normal browser `User-Agent`. The response is not JSON: it is one
string, records separated by `^`, fields within a record by `~`, and empty
fields appear as repeated `~` so **do not filter empties before indexing**.

Field positions that matter:

| Index | Meaning | Example |
|---|---|---|
| 0 | Train number | `79313` |
| 1 | Train name | `DADN-RTM DMU` |
| 2, 3 | Origin name, code | `Dr Ambedkar Ngr (Mhow)`, `DADN` |
| 4, 5 | Terminus name, code | `Ratlam Jn`, `RTM` |
| 6, 7 | Boarding name, code | `Indore Jn Bg`, `INDB` |
| 8, 9 | Alighting name, code | `Barnagar`, `BNG` |
| 10, 11 | Departure, arrival (`HH.MM`) | `15.05`, `16.32` |
| 12 | Duration (`HH.MM`) | `01.27` |
| 13 | Running days, 7 chars, **Monday first** | `1111111` = daily |
| 32 | Class of train | `ORDINARY`, `MAIL_EXPRESS`, `SUPERFAST` |
| 39, 40 | Distance km, average speed | `71`, `60` |
| 41 | Fare block, only for reserved trains | see below |

`ORDINARY` in field 32 is the unreserved marker. Those are buy-at-the-counter,
no PNR, no seat to check.

## Source B: ConfirmTkt (fares and availability, no login)

Narrower, but it has the numbers erail lacks. A fixed public web key is sent as
a header; there is no account.

```
GET https://cttrainsapi.confirmtkt.com/api/v1/trains/search
    ?sourceStationCode=INDB&destinationStationCode=BNG&dateOfJourney=04-08-2026

GET https://cttrainsapi.confirmtkt.com/api/v2/trains/stations/auto-suggestion
    ?searchString=barnagar&sourceStnCode=&popularStnListLimit=15
    &preferredStnListLimit=6&channel=mwebd&language=EN
```

```
clientid: ct-web
apikey:   ct-web!2$
deviceid: <any uuid-shaped string>
Accept:   application/json
User-Agent: <a normal desktop browser UA>
```

Date format is **DD-MM-YYYY**, unlike everything else here.

Search returns `data.trainList[]`. Each train carries `trainNumber`,
`trainName`, `departureTime`, `arrivalTime`, `duration`, `distance`, plus
`availabilityCache` keyed by class (`SL`, `3A`, `2A`, `1A`, `3E`) with `fare`,
`availabilityDisplayName` (`AVL 138`), and `predictionDisplayName`
(`Available`). The autosuggest endpoint is the better station-code lookup of
the two sources: it returns `stationCode`, full name, city and state.

## Coverage

| Need | erail | ConfirmTkt |
|---|---|---|
| All trains including unreserved | Yes | No |
| Departure and arrival times | Yes | Yes |
| Running days | Yes | Yes |
| Fares | Reserved only, in field 41 | Yes, per class |
| Seat availability and prediction | No | Yes |
| Station code lookup | Weak | Good |
| PNR status | No | Separate page, scraped |

**The extensible shape is: list from erail, then enrich from ConfirmTkt by
joining on train number.** Neither one alone answers "what can I catch, and what
does it cost".

## Station code traps

Two bit us on the first attempt.

`INDB` is Indore Junction, and ConfirmTkt's autosuggest returns it twice, once
labelled "Indore - All stations" and once "Indore Jn Bg". They carry the same
code, so take the first and move on.

`DADN` (Dr Ambedkar Nagar, formerly Mhow) is a **different station** about 20 km
from Indore, and several Indore departures are really DADN originating trains
passing through. Searching `DADN` to `BNG` returns nothing useful even though
those trains exist, because the query is asking about a leg no passenger boards.
Always search from the station you will physically stand on.

## The MCP servers, compared

| Repo | Source | Verdict |
|---|---|---|
| [rajprem4214/indian-railways-mcp](https://github.com/rajprem4214/indian-railways-mcp) | erail + ConfirmTkt for PNR | **Installed.** Only one that sees unreserved trains |
| [uditya-kumar/confirmtkt-mcp](https://github.com/uditya-kumar/confirmtkt-mcp) | ConfirmTkt only | Skipped. Blind to 4 of 10 trains, but its endpoint write-up is where Source B above came from |
| [amith-vp/indian-railway-mcp](https://github.com/amith-vp/indian-railway-mcp) | `railwayapi.amithv.xyz`, the author's own host | Skipped despite the most stars. Both the MCP and its API run on someone's personal domain, so every query leaves the machine and the whole thing dies when they stop paying |

Star count was actively misleading here. The 26-star repo is a remote
dependency on a stranger, and the 1-star repo had the most useful information in
it.

## Extending this

The installed MCP covers timetable questions. If fares or availability are ever
needed in the same answer, the join described above is the work, and both
endpoints are documented here in full. Live running status is covered by neither
source and would need a third (NTES or RailYatri).

Nothing here needs a key, so the failure mode is not billing, it is the day one
of these hosts changes its response shape. Both are unofficial.
