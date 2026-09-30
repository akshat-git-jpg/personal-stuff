# Skyscanner web API, as used by pp-flights

Undocumented, unofficial, and captured from the skyscanner.co.in results page
on 2026-08-04 by recording its own XHR traffic. Both endpoints answer plain
HTTPS with no key, no cookie and no browser.

## Autosuggest: name to entity id

```
GET https://www.skyscanner.co.in/g/autosuggest-search/api/v1/search-flight/{market}/{locale}/{query}
```

`GET .../IN/en-GB/indore` returns:

```json
[{"PlaceId":"IDR","PlaceName":"Indore","CityId":"IIDR","CountryName":"India",
  "GeoId":"128667504","GeoContainerId":"27542801",
  "ResultingPhrase":"Indore (IDR), Indore|Indore District|Madhya Pradesh|India"}]
```

`GeoId` is the `entityId` the search endpoint wants. `GeoContainerId` is the
city that contains the airport. Omitting the query returns popular places for
the market. `IataCode` is usually empty, so read `PlaceId` for the code.

## Search

```
POST https://www.skyscanner.co.in/g/radar/api/v2/web-unified-search/
```

Headers that matter:

```
accept: application/json
content-type: application/json
x-skyscanner-market: IN
x-skyscanner-currency: INR
x-skyscanner-locale: en-GB
x-skyscanner-channelid: website
x-skyscanner-viewid: <uuid4>
x-skyscanner-trustedfunnelid: <same uuid4>
user-agent: <a normal desktop Chrome UA>
```

Body, one entry in `legs` per direction:

```json
{"cabinClass":"ECONOMY","childAges":[],"adults":1,
 "legs":[{"legOrigin":{"@type":"entity","entityId":"95673351"},
          "legDestination":{"@type":"entity","entityId":"128667504"},
          "dates":{"@type":"date","year":"2026","month":"08","day":"24"}}]}
```

`cabinClass` is `ECONOMY`, `PREMIUM_ECONOMY`, `BUSINESS` or `FIRST`.

Response is about 1MB:

```json
{"context":{"status":"complete","sessionId":"KLUv_SB..."},
 "itineraries":{"results":[...],"filterStats":{...},"agents":[...],"carriers":{...}}}
```

Each `results[i]` has `price.raw` / `price.formatted`, `tags` (`cheapest`,
`shortest`, `second_cheapest` and so on), and `legs[]` with `origin`,
`destination`, `departure`, `arrival`, `durationInMinutes`, `stopCount`,
`timeDeltaInDays`, `carriers.marketing[].name`, and per-hop `segments[]`.
Layover airports come from the destinations of every segment but the last.

`context.status` can be `incomplete` while Skyscanner is still polling
providers. Re-POST the identical body until it reads `complete`. In practice
BLR to IDR came back complete on the first request with 101 results.

## Two things that will surprise you

**Sending cookies breaks it.** Replaying this request with the 34 cookies a
real browser session had produced a 403. The same request with no cookies at
all returned 200. So `pp-flights` deliberately sends none.

**No TLS impersonation is needed.** `curl_cffi` with a Chrome fingerprint works,
but so does stdlib `urllib` and so does `requests`. Only the `user-agent`
header appears to be checked, which is why this tool has no exotic dependency.

Contrast with Skyscanner's *mobile* API, which the reverse-engineered clients on
GitHub target: that one sits behind PerimeterX, needs a forged
`X-Px-Authorization` token, and returns `403 {"action":"captcha"}` from this IP
every time. The website endpoints above are guarded by none of it.

## Poll calls need a cookie, so there are none

A GET or POST to `web-unified-search/<sessionId>` returns 403 without the
`__Secure-session_id` cookie the first response sets, and sending cookies is
what trips the block. So `incomplete` is handled by re-POSTing (at most 4, 5 s
apart), and searches are spaced 20 s apart. Probed 2026-09-30.

# Google Flights, as used by pp-flights

## Fast call: GetShoppingResults (via the `fli` library)

```
POST https://www.google.com/_/FlightsFrontendUi/data/travel.frontend.flights.FlightsFrontendService/GetShoppingResults?curr=INR&hl=en&gl=IN
body: f.req=<fli's encoded filters>
```

`fli` (PyPI `flights`, pinned in `requirements.txt`) builds the request and
decodes the rows, including flight numbers. After a handful of searches in a
short burst it can answer `[["wrb.fr",null,null,null,null,[13]]...]` (error 13)
with no rows, for at least tens of minutes, while the page below still works.

## Fallback: the results page

```
GET https://www.google.com/travel/flights/search?tfs=<base64url protobuf>&hl=en&gl=IN&curr=INR
```

`tfs` for a one-way search is small enough to hand-encode (see `google_page`):

| Field | Meaning |
|---|---|
| 3 (message) | the leg: 2 = date `YYYY-MM-DD`, 5 = max stops (0 = nonstop, omitted = any), 13 = `{2: origin IATA}`, 14 = `{2: dest IATA}` |
| 8 (bytes) | one `0x01` per adult |
| 9 (varint) | cabin: 1 economy, 2 premium, 3 business, 4 first |
| 19 (varint) | trip: 2 = one-way |

The page embeds the same rows as the fast call in
`AF_initDataCallback({key: 'ds:1', ... data: [...]})`, at `data[2][0]` and
`data[3][0]`, and `fli`'s `parse_flight_row` reads them. It only carries the
first screen (top ~10 itineraries), so it can miss the cheapest fare.
