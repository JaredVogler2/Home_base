# What HOMEBASE costs to run

Limits and prices here come only from [`docs/research/PROVIDER-FACTS.md`](research/PROVIDER-FACTS.md) (read
2026-11-26; re-read the sources before relying on them). Request counts come from the polling intervals in the code
and are worked out below. Where a number is not in PROVIDER-FACTS or the code, this page says "check the
provider's current pricing page" instead of guessing.

## Short answer

- **No paid service is required by the code.** It needs a web host that can run one Node function and serve static
  files, and a Postgres database. Both have free tiers recorded in PROVIDER-FACTS. Everything else is optional or
  free (see [Why nothing paid is required](#why-nothing-paid-is-required)).
- **Hosting (Vercel Hobby):** a family at low or moderate use stays well inside the recorded monthly allowances for
  function invocations and transfer. Active CPU and memory per request have **not been measured**, so whether the
  4-hour CPU allowance holds is not proven; the break-even figures are below.
- **Database:** an always-on wall keeps a database awake for many hours a day (it asks every 30 s while the house
  is showing and nobody touches it, every 15 minutes when resting). Whether that fits **Neon's** free compute
  allowance depends on how Neon counts compute size, which PROVIDER-FACTS does not record — treat Neon as a
  caution. **Supabase's** free plan has no compute meter in PROVIDER-FACTS and its pause only bites after about a
  week with no activity.
- **Photos are stored in Postgres**, so they count against the database's size, not a file store.

## What a household uses

### Polling, from the code

| Pace | Interval | When (`src/sync/store.ts`, `src/wall/Wall.tsx`) |
| --- | --- | --- |
| `active` | 4 s | the wall was touched in the last `idleHomeSeconds` (default 90 s), at any hour; any open parent page |
| `idle` | 30 s | wall untouched for longer, in the daytime, with the house showing |
| `asleep` | 15 min | wall untouched for longer **and** inside quiet hours (default on, 19:30–06:30, i.e. 11 hours) or showing the photos; any touch asks at once |

A parent page that is in the background (hidden, nothing queued) does not poll. An unchanged poll is answered
`204` with no body; a changed one returns the whole snapshot. With the seeded demo household that snapshot was
**about 27 KB for the wall and 32 KB for a parent** (uncompressed JSON, measured through the test harness;
a real household's size depends on how many missions, items and photos it has).

Every poll is one function invocation and at least one database transaction. With the weather switched on, every
poll also starts one more short transaction in the background (`refreshWeatherIfDue` checks whether 20 minutes
have passed); the outside weather request itself happens at most about every 20 minutes per household.

### Low use: one wall, two phones, a few dozen taps a day

Assumptions: quiet hours on (default); the wall is used actively for 1 hour a day; each phone is open for
10 minutes a day; about 36 taps on the wall and 10 changes from phones.

| Source | Arithmetic | Requests a day |
| --- | --- | --- |
| Wall, active | 1 h × 3,600 s ÷ 4 s | 900 |
| Wall, idle | 12 h × 3,600 ÷ 30 | 1,440 |
| Wall, quiet hours | 11 h × 3,600 ÷ 900 | 44 |
| Two phones, open | 2 × 10 min × 60 ÷ 4 | 300 |
| Changes (`POST /api/sync/ops`) | 36 + 10 | 46 |
| **Total** | | **≈ 2,700** |

≈ 2,700 × 30 days = **≈ 82,000 function invocations a month**. This table assumes the house stays showing while
untouched (slideshow switched off, `slideshowAfterMinutes: 0`). With the default (photos after 10 untouched
minutes, `src/wall/Wall.tsx`) most of those 12 idle hours run at the fifteen-minute pace instead
(12 × 3,600 ÷ 900 = 48), plus about 17 asks at 30 s in the 8½ minutes between going idle and the photos starting
after each use, so the day comes to roughly 1,400–1,500 (≈ 42,000–45,000 a month).

### Moderate use: wall polling all day, photos, weather on

Assumptions: quiet hours switched **off** and the house left showing when untouched (slideshow off) — the most an
untouched wall asks; with the slideshow on, most of the 21 idle hours would run at 15 minutes instead. The wall is
used actively for 3 hours a day; each phone open for
30 minutes a day; about 100 changes a day; 100 photos added in the month; weather on; the optional AI helper
used weekly. Its invocations are negligible here (a weekly run is a handful of requests to HOMEBASE and one or two
to the provider); its money cost is covered under [Outside services](#outside-services).

| Source | Arithmetic | Requests a day |
| --- | --- | --- |
| Wall, active | 3 h × 3,600 ÷ 4 | 2,700 |
| Wall, idle | 21 h × 3,600 ÷ 30 | 2,520 |
| Two phones, open | 2 × 30 min × 60 ÷ 4 | 900 |
| Changes | | 100 |
| Photos | 100 a month × (1 `POST` + up to 3 `PUT`s, `src/lib/photos.ts`) + 1 fetch by the wall each, ÷ 30 | ≈ 17 |
| Weather | runs inside the poll's invocation (`waitUntil`); outside requests ≤ 72 refreshes × 2–3 calls | 0 extra invocations |
| **Total** | | **≈ 6,240** |

≈ 6,240 × 30 = **≈ 187,000 function invocations a month**.

### Upper bound worth knowing

A wall stuck at the `active` pace day and night (for example if something kept generating touch events) would make
86,400 ÷ 4 = 21,600 requests a day, **648,000 a month** on its own. Two such walls would pass 1M.

## Hosting: Vercel Hobby (free)

Recorded allowances (PROVIDER-FACTS §2): per month 1M function invocations, 4 hours active CPU, 360 GB-hours of
memory, 100 GB transfer, 1M edge requests; 300 s function limit; 4.5 MB request body; at most 12 functions outside
Next.js. For "personal or non-commercial use". **Over a limit there is no paid overage: the feature stops until
30 days pass, and compute overuse can pause the deployment.**

| Allowance | Low (≈ 82k/month) | Moderate (≈ 187k/month) | Verdict |
| --- | --- | --- | --- |
| 1M invocations | 8.2 % | 18.7 % | fits |
| 4 h active CPU = 14,400 s | fits if the average request uses under 14,400 ÷ 82,000 ≈ **176 ms** of CPU | under 14,400 ÷ 187,000 ≈ **77 ms** | **not measured** — check the usage page after a week |
| 360 GB-hours memory = 1,296,000 GB-s | fits if memory × duration per request is under ≈ 15.8 GB-s | under ≈ 6.9 GB-s | not measured; the memory size per function is a project setting |
| 100 GB transfer | snapshot pulls after changes plus `POST` replies: roughly (46 + 46) × 30 KB ≈ 2.8 MB a day ≈ 85 MB a month, plus photos | ≈ (100 + 100 + phones) × 30 KB ≈ 7 MB a day ≈ 210 MB a month, plus photos (each photo copy ≤ 4 MB, fetched once per screen and then cached for a year) | fits by a wide margin |
| 1M edge requests | whether API calls count as edge requests is not recorded in PROVIDER-FACTS — check Vercel's usage page; static files are few (the earlier local build in `dist/` was about 1.3 MB in 43 asset files, and the service worker keeps them on the device) | same | probably fits; check |
| 4.5 MB request body | largest bodies: a photo copy ≤ 4,000,000 bytes (`server/http/routes/media.ts`), an Academy import ≤ 2 MiB + 16 KiB | | fits |
| 12 functions | the whole API is one function (`api/index.ts`) | | fits |
| 300 s limit | `vercel.json` sets `maxDuration: 30` | | fits |

**What uses CPU besides polling:** each sign-in, sign-up, password change, recovery, PIN check and PIN set runs
scrypt with N = 2^15 (`server/auth/crypto.ts`; its comment estimates about a tenth of a second per guess — not
measured here). These are rare for a family. Building a full snapshot is several queries; a `204` is one small read.

**Cron.** Hobby cron runs once a day (PROVIDER-FACTS §2). The code does not need it: each household's daily
chores (`keepHouse`: today's missions, allowance, tidying, history thinning) run the first time any of its screens
asks for news on a new local day (`server/http/routes/sync.ts`). `vercel.json` schedules a daily cron call to `/api/cron/daily` (09:17 UTC) that
answers only to `CRON_SECRET`; it only makes the morning's missions exist
before the first screen wakes and sweeps old codes in a week nobody opened anything.

**Paid plan.** The Pro plan's price is not recorded in PROVIDER-FACTS — check the provider's current pricing page.

## Database

| | Neon free | Supabase free |
| --- | --- | --- |
| Size (PROVIDER-FACTS §3) | 1 GB per project | 500 MB database (plus 1 GB files, which HOMEBASE does not use) |
| Compute | 100 compute-hours per project per month; sleeps after 5 min idle, wakes in a few hundred ms | no compute meter recorded |
| Idle catch | — | paused after about a week without activity |
| Connection | pooled host has `-pooler`; `SET LOCAL` in a transaction is the documented way | direct connections are IPv6-only on free, so Vercel must use the transaction pooler (port 6543), which does not support named prepared statements |

**Neon and the wall.** Neon's free database goes to sleep after 5 minutes with nothing asked of it, and is
metered while awake. What an always-on wall does to that depends on its pace:

| The wall is… | Asks every | The database is awake |
| --- | --- | --- |
| in use | 4 s | all the time |
| untouched, daytime, house showing | 30 s | all the time (30 s is shorter than the 5-minute timer) |
| untouched in quiet hours, or showing the photos | 15 min | about 5 minutes in every 15: a third of the time |

So with quiet hours on (the default, 11 hours) and the photo slideshow off, the database is awake for about
13 + 11 ÷ 3 ≈ 16.7 hours a day, ≈ 500 hours a month. With the slideshow on as well (so that an untouched wall
rests in the daytime too) it is nearer 8–10 hours a day, ≈ 240–300 hours a month. Whether either fits the free
plan's "100 compute-hours" depends on how Neon counts its smallest compute size: if an hour awake counts as a
fraction *f* of a compute-hour, 100 ÷ *f* hours awake fit; if it counts as a whole one, none of these figures do.
PROVIDER-FACTS does not record that, so **check Neon's current pricing page before relying on it**. The
conclusion stands as a caution: for a wall that is on all day, a database with no compute meter (Supabase's free
plan) is the safer choice, and Neon is fine for trying things out.

**Supabase and the pause.** A wall that polls keeps the project active. The pause matters when every screen is off
for about a week (a holiday with the wall unplugged): the API then answers `503 unavailable` ("cannot reach its
database") until the project is resumed. How it is resumed is not recorded in PROVIDER-FACTS — check Supabase's
documentation. HOMEBASE's code is compatible with the transaction pooler in principle (household settings are
`set_config(…, true)` and `SET LOCAL ROLE`, both transaction-scoped), but running it against Supabase's pooler has
**not been verified**, and neither has creating the `homebase_app` role there (if that fails, isolation falls back
to the application; `GET /api/health` shows which).

**Photos take database space.** Copies are stored as `bytea` in `media_blobs`. The per-household cap
`HOMEBASE_MEDIA_LIMIT_MB` defaults to **200 MB, all copies counted** (`server/config.ts`), and the phone makes up to
three copies per photo (largest, 1920 and 960 pixels wide). On Supabase's 500 MB free database that default lets
photos take 40 % of the space; on Neon's 1 GB, 20 %. Lower `HOMEBASE_MEDIA_LIMIT_MB` to keep headroom. The rest of
a household's data is small and thinned daily (history older than `detailDays`, default 90, is folded into weekly
totals); its growth over a year has not been measured.

## Outside services

| Service | Needed? | Cost |
| --- | --- | --- |
| Weather (`api.weather.gov`, `api.open-meteo.com`) | optional; off by default | no key; NWS is free open data; Open-Meteo's free API is for non-commercial use with a daily call limit, as recorded (with sources) in [`integrations/WEATHER.md`](integrations/WEATHER.md). HOMEBASE makes at most about 72 refreshes a day per household, 2–3 requests each |
| AI providers | optional; off by default (`server/ai/`, [`integrations/AI.md`](integrations/AI.md)) | check the provider's current pricing page (no AI prices are in PROVIDER-FACTS). An API key from the provider's developer console is needed. Before each request the code reserves its worst-case cost under the household lock and refuses it if that would pass the household's caps, which default to 50 cents a day and 500 cents a month (`shared/settings.ts`), so with the defaults it cannot spend more than $5 a month per household, even with requests running at once (`tests/server/ai.test.ts`, `sets a request's dearest cost aside while it is away…`) — as far as its built-in price table (`server/ai/pricing.ts`) or the `HOMEBASE_AI_PRICE_*` overrides are right |
| E-mail | never used | — |
| File storage (Vercel Blob, Supabase storage) | not used | Blob: 1 GB on Hobby with private stores (PROVIDER-FACTS §2), a possible future home for photos |
| Fully Kiosk Browser | optional | free features; PLUS licence 8.90 EUR / 10.99 USD per device, once (PROVIDER-FACTS §4) |
| Apple Shortcuts | optional | part of iOS |
| Domain name | optional | not recorded — check a registrar's pricing page |

## What could start to cost money, and when

| Trigger | What happens on a free plan |
| --- | --- |
| More than one wall left at the active pace, or many walls/households on one deployment | Vercel invocations or CPU approach the monthly allowance; on Hobby the feature stops (no overage) |
| Request CPU turns out higher than ~77–176 ms on average | the 4 h active-CPU allowance runs out before the month ends; compute overuse can pause the deployment |
| Neon free with an always-on wall | compute-hours run out (see above) |
| Many photos | database size: lower `HOMEBASE_MEDIA_LIMIT_MB`, or move to a paid database tier (check pricing) |
| Commercial use | Vercel Hobby and Open-Meteo's free API are for non-commercial use |

## Cheaper or safer alternatives

- **Supabase free** rather than Neon free for an always-on wall, as the code stands.
- **Quiet hours on** (default) and **the slideshow on** (default): a resting wall asks every 15 minutes instead of
  every 30 s (44 instead of 1,320 requests over an 11-hour night).
- **Self-hosting:** `server/standalone.ts` (`npm run build && npm start`) serves the built app and the API from one Node process,
  with a local PGlite database in a folder or any Postgres. A small home server or VPS then has no per-request
  meter. Not tested on real hardware.
- **Keep photos small:** a lower `HOMEBASE_MEDIA_LIMIT_MB`; or use the Apolosign's own Google Photos screen saver
  for the photo frame and leave HOMEBASE's slideshow empty (see [`INTEGRATIONS.md`](INTEGRATIONS.md)).

## Why nothing paid is required

- **No e-mail service**: accounts use passwords, recovery codes and owner-made reset links
  (`server/http/routes/auth.ts`).
- **No file store**: photos live in Postgres (`media_blobs`).
- **No scheduler**: daily work runs on the first poll of the day; the cron route is optional.
- **No realtime service**: screens poll; there are no websockets.
- **No paid API keys**: weather providers need none; the AI helper is optional and off by default; the Academy link is plain
  navigation.
- **Database**: a free managed Postgres tier, or PGlite on a self-hosted server. (On Vercel without a
  `DATABASE_URL` the deployment is only the in-memory demo, so a real hosted family does need a Postgres.)
