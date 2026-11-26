# Weather (the "Living Sky")

The wall shows an illustrated house under a sky. The sky already follows the real sun and moon, worked out on
the wall itself (`shared/sun.ts`, `src/wall/sky.ts`). When a household switches the weather on, the sky also shows
the real weather: rain, snow, fog, wind, a storm, cloud or a clear sky.

It is **off** until a grown-up switches it on (`settings.sky.weather`), and it needs a location
(`settings.location`). With either missing, nothing is ever asked of any weather service.

## How it works

- Screens never talk to a weather service. The **server** does, at most about once every 20 minutes per household,
  and only while one of the family's screens is on and checking in.
- After a screen's `GET /api/sync` has had its answer, the server checks in the background whether it is time to
  ask again (`server/weather/service.ts`, `refreshWeatherIfDue`). The answer to the screen never waits for the
  weather. On Vercel the background work is handed to `waitUntil` from `@vercel/functions` so that the function is
  not frozen half way; anywhere else it simply carries on in the running process (`server/weather/background.ts`).
- Before asking, the server _claims_ the refresh in the database (a conditional insert or update of the
  `weather_cache` row), so two screens checking in at the same moment cause one request, not two.
- The reading is kept in `weather_cache` (one row per household, under the same row-level security as every
  household table). Every snapshot carries it as `snapshot.weather`: `{ state, temperature, units, at, stale }`,
  or `null`.
- Screens re-download their whole snapshot whenever the household's revision moves, so the revision is moved only
  when what a screen would draw changes: a different sky, the reading going out of date, or the temperature moving
  by 3 degrees or more in the household's units. A smaller drift is not stored either, so drifts cannot add up
  unnoticed.
- The temperature is stored as whole degrees Celsius and converted to the household's units when shown, so a
  Fahrenheit reading can be one degree off what the service said.

### Timings

| What                                   | When                                                                  |
| -------------------------------------- | --------------------------------------------------------------------- |
| Ask again after a good answer          | 20 minutes                                                            |
| Ask again after a failure              | 5, 10, 20, 40, 80 minutes, then every 2 hours                         |
| Shown as out of date (`stale: true`)   | reading older than 90 minutes                                         |
| No longer shown (`weather: null`)      | reading older than 6 hours                                            |
| Location changed                       | the old reading disappears at once; the new place is asked next time  |

When a reading crosses 90 minutes or 6 hours, the next screen check-in also counts as "time to ask", so the
screens are told straight away rather than at the next regular time.

A failure of any kind (no answer within 4 seconds, an error status, an answer that is too large, not JSON, or not
the expected shape) is noted in `weather_cache.failures` and never reaches the screens or the person using them.

## Which services

| Service                                                                     | Where           | Cost                                     | Key |
| --------------------------------------------------------------------------- | --------------- | ---------------------------------------- | --- |
| [National Weather Service API](https://www.weather.gov/documentation/services-web-api) (`api.weather.gov`) | US places | Free, open data, for any purpose | None |
| [Open-Meteo](https://open-meteo.com/en/docs) (`api.open-meteo.com`)         | Anywhere        | Free **for non-commercial use** only     | None |

- **NWS**: `GET /points/{lat},{lon}` gives the address of the hourly forecast (`properties.forecastHourly`), which
  is then fetched; the first hour is used (its `icon`, `temperature`, `temperatureUnit`, `startTime`). A 404 from
  `/points` means the place is not one NWS forecasts for. NWS asks every caller for a `User-Agent` that identifies
  the application; HOMEBASE sends `HOMEBASE family wall display` and nothing else (no e-mail, name or web
  address). Its rate limit is not published; one request pair per household per 20 minutes is far inside
  "typical use".
- **Open-Meteo**: `GET /v1/forecast?latitude=…&longitude=…&current=temperature_2m,weather_code,wind_speed_10m`.
  Its [terms](https://open-meteo.com/en/terms) for the free API: non-commercial use only, fewer than 10,000 calls a
  day (5,000 an hour, 600 a minute), and the data is licensed CC BY 4.0, which asks for attribution. A deployment
  that is used commercially needs Open-Meteo's paid plan, or `HOMEBASE_WEATHER=nws` (US only), or the weather off.

Codes are folded onto the wall's nine skies in `server/weather/codes.ts`: every one of the 34 icon codes NWS lists
at `https://api.weather.gov/icons`, and the WMO weather codes Open-Meteo documents. A dry sky (clear, partly or
cloudy) with wind of 40 km/h or more is drawn as wind. Anything unknown is drawn as "partly cloudy": "clear" would
promise sunshine nobody can vouch for, and anything wetter would draw weather that may not be there.

## What leaves the server

- Only the household's position, rounded to **two decimal places** (about a kilometre; the server already rounds it
  when the setting is saved). Never the label the grown-up typed, never the household's name, nobody's name or
  e-mail, no identifier of any kind.
- Only from the server, never from the wall or a phone.
- Only to `https://api.weather.gov` and `https://api.open-meteo.com`. NWS's hourly-forecast address is followed only
  if it is on `https://api.weather.gov/gridpoints/`. Redirects are refused.
- Only `GET` requests, with no body.

`tests/server/weather.test.ts` checks all of this on every request the server makes.

### ZIP code to position

A US family can type a ZIP code to set their location. It is turned into a position **on the parent's phone**
(`src/lib/zcta.ts`, `lookupZip`), from a table of every ZIP Code Tabulation Area with its middle rounded to two
decimals (`public/data/zcta.bin`, about 270 KB, loaded once from HOMEBASE's own site). The ZIP code is never sent
anywhere. The table is built from the U.S. Census Bureau's public-domain
[ZCTA gazetteer file](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html) by
`scripts/build-zcta.ts`, which documents the file layout. To rebuild it (once a year is plenty):

```sh
NODE_USE_ENV_PROXY=1 npx tsx scripts/build-zcta.ts --work /some/scratch/folder
```

(`NODE_USE_ENV_PROXY=1` only matters behind an HTTPS proxy.) A PO box or a company's own ZIP code has no area,
and so no position; the phone should then ask for a town instead.

## Turning it on and off

- **Per household**: Settings → the sky's weather switch (`settings.sky.weather`), plus a location. Units follow
  `settings.sky.units` (`us` for °F, `metric` for °C).
- **Per deployment**: the `HOMEBASE_WEATHER` environment variable.

| `HOMEBASE_WEATHER` | Behaviour                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| unset or `auto`    | NWS for places inside a rough US box (lower 48, Alaska, Hawaii, Puerto Rico and the Virgin Islands), falling back to Open-Meteo if NWS says 404 or fails; Open-Meteo elsewhere |
| `nws`              | NWS only                                                                                            |
| `open-meteo`       | Open-Meteo only                                                                                     |
| `off`              | never ask any weather service                                                                       |
| anything else      | treated as `off`, so that a mistyped "off" cannot reach out                                         |

`HOMEBASE_OFFLINE=1` also turns the weather off. A reading already in the cache stays visible until it is six
hours old.

## What was verified, and how

Verified on 2026-11-26 from the development sandbox, by hand, using only the made-up test position 39.10,-94.58:

- `GET https://api.weather.gov/points/39.1,-94.58` with the User-Agent above answered 200, with
  `properties.forecastHourly` on `https://api.weather.gov/gridpoints/…` and no redirect.
- `GET` of that hourly forecast answered 200 (about 160 KB, 156 hourly periods), each period carrying `startTime`
  (with an offset), `temperature` (a number), `temperatureUnit` (`"F"`) and a full `icon` URL.
- `GET https://api.weather.gov/icons` listed the 34 icon codes mapped in `codes.ts`.
- `GET https://api.open-meteo.com/v1/forecast?latitude=39.1&longitude=-94.58&current=temperature_2m,weather_code,wind_speed_10m`
  answered 200 with `current.time` as `"YYYY-MM-DDTHH:MM"` in GMT (`utc_offset_seconds: 0`), `temperature_2m` in
  °C, `weather_code` and `wind_speed_10m` in km/h.
- The NWS documentation page (User-Agent guidance, open data, unpublished rate limit), the Open-Meteo documentation
  (the WMO code table, the error format) and the Open-Meteo terms (non-commercial limits, CC BY 4.0) were read.
- The 2026 ZCTA gazetteer was downloaded and `public/data/zcta.bin` built from it: 33,791 areas, 270,336 bytes.
  The 2026 file separates its columns with `|` (earlier years used tabs), and Guam's and the Northern Marianas'
  longitudes carry a leading `+`; the script handles both.

Trimmed copies of the live answers are in `tests/server/fixtures/weather/` and are parsed by
`tests/server/weather-codes.test.ts`.

## What is not verified

- NWS's 404 for a place outside its area was **not** seen live (only the one test position may be used); it is
  taken from the documentation and handled the same way as any other failure, by asking Open-Meteo.
- Open-Meteo's error answer was not seen live; its shape is from the documentation.
- `waitUntil` was not exercised on a real Vercel deployment. Off Vercel it does nothing, which is what the tests
  rely on.
- The rough US box is not checked against NWS's real coverage at its edges (for example Guam, which falls outside
  the box and is asked of Open-Meteo).
- Open-Meteo's CC BY 4.0 attribution is shown on the grown-ups' side, where the weather is switched on
  (*Family → Sky and weather*: "Weather from the U.S. National Weather Service in the United States, and from
  Open-Meteo.com elsewhere"). It is not shown on the wall, which carries no words of that kind.
