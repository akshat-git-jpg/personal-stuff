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
