# Decisions

Why HOMEBASE is built the way it is. Each entry says what was chosen, what else was looked at, and what it costs.
Where the brief suggested something and something else was done, the entry is marked **Deviation**. Facts about
outside services come from [`docs/research/PROVIDER-FACTS.md`](research/PROVIDER-FACTS.md), read on 2026-11-26.

Changing a decision later is fine. Change the entry too.

---

## 1. One app and one small API, not Next.js — **Deviation**

**Chosen.** A single-page app built by Vite (React, TypeScript) with two sides, `/wall` and `/parent`, and one API
built with Hono that runs as a single Vercel function (`api/index.ts`) or as an ordinary Node server
(`server/standalone.ts`).

**The brief** said "e.g. Next.js".

**Looked at.**

| | Next.js (App Router) | Vite SPA + one function (chosen) | Separate apps for wall and phone |
| --- | --- | --- | --- |
| Works with no signal | Server components need the server; an offline wall needs extra machinery | The app is static files; a service worker keeps all of them | Same as chosen, twice |
| Wall on a modest chip (RK3576, 4 GB) | Framework runtime and hydration on every route | Only the code for the screen in use is loaded | Same |
| Cold start of the API | Framework boot per function | One small function | Two |
| Hosting it yourself | Possible, heavier | `npm start` — one Node process | Two |
| Search engines, shared links, streaming | Its strengths | None | None |

HOMEBASE has no public pages, wants nothing indexed, and its hardest requirement is a wall that keeps working
when the Wi-Fi drops. None of Next.js's strengths are wanted and its server-first model works against the hard
requirement. The cost of this choice: no server rendering (the first paint waits for JavaScript — about 150 kB
gzipped for the wall, drawings included), and routing, data loading and caching are our own code
(`src/app/router.ts`, `src/sync/`), about a thousand lines.

## 2. PostgreSQL, with a copy of it inside the app for development — **Deviation in part**

**Chosen.** PostgreSQL through Drizzle. In production any managed Postgres works (Supabase and Neon are the two
documented in `docs/DEPLOYMENT.md`). For development, tests and the no-database demo the server uses PGlite —
PostgreSQL compiled to WebAssembly — so `npm run dev` needs no Docker, no account and no installation.

**The brief** said "managed Postgres with realtime via Supabase or equivalent".

**Why not the Supabase client in the browser.** It would put the database's rules in two languages (SQL policies
and TypeScript), tie the app to one host, and make the star ledger's guarantees depend on policies rather than
on one transaction per change. Here the browser only ever talks to HOMEBASE's own API.

**What it costs.** PGlite is one process and one connection; it is for development and the demo, not for a
family. The test suite therefore runs twice: on PGlite, and on real PostgreSQL 16 (`npm run test:pg`).

## 3. The database defends each household itself

**Chosen.** Every table is in its own schema (`homebase`), every row carries its household, row-level security is
switched on for every household table, and all household work runs in a transaction that first does
`set local role homebase_app` and sets the household's id. A query that forgets its `where household_id = …`
returns nothing from another family rather than everything. A handful of system tables (accounts, sessions,
pairing codes) are reachable only by the owner role, through one function (`asSystem`).

**Looked at.** Scoping in application code only — simpler, and one missed `where` leaks a family. A database per
household — strongest, and impractical on free tiers.

**What it costs.** Two extra statements per request. On a host where the app's login cannot `SET ROLE`, the
server says so loudly and falls back to scoping in code; `/api/health` reports which is in force.

## 4. Screens keep in step by asking, not by a held-open connection — **Deviation**

**Chosen.** A screen writes down what it wants as an *operation* with an id of its own and posts it; the server
does each once, however often it arrives, and answers with a complete snapshot of what that screen may see.
Screens ask "anything new since revision N?" every 4 seconds while in use, every 30 when nobody is at the wall,
and every 15 minutes when nobody is there and it is quiet hours or the photos are showing; any touch asks at
once. The usual answer is an empty `204`.

**The brief** said "realtime via Supabase or equivalent", and also "prefer managed realtime or polling" and
"never rely on a permanent connection".

**Why.** A parent's "yes" reaches the wall in at most four seconds, which is fast enough for a family. In return
there is no second service, no socket to keep alive on a serverless host, nothing to reconnect after sleep, and
a whole class of "the screen missed an event" bugs cannot happen: a snapshot is the whole truth, never a patch.

**What it costs.** Requests: a few thousand a day for one wall, well inside the free allowance
(`docs/COSTS.md` has the arithmetic) — but it keeps a "sleeps when idle" database awake, which is why the wall
slows down at night. Snapshots are whole (a few tens of kilobytes), not differences; fine for a household, wrong
for a school.

## 5. Sign-in without e-mail

**Chosen.** An e-mail address is only a name to sign in with. HOMEBASE never sends a message: there is no mail
service to pay for, configure or leak through. Passwords are hashed with scrypt; sessions are random tokens in
`HttpOnly` cookies with only their hash stored; a second grown-up joins with a one-use invitation code or QR;
a forgotten password is recovered with a recovery code written down at the start, a reset code made by the
household's owner, or — when the owner is the one locked out — by whoever runs the server
(`npm run admin -- reset-code`).

**Looked at.** Magic links (need a mail service and a domain), "Sign in with Apple/Google" (needs developer
accounts and ties the family to a provider), passkeys (good; worth adding later, see the roadmap).

**What it costs.** No second factor yet. A parent must keep their recovery codes.

## 6. The wall is paired, never given a password

**Chosen.** A new screen shows a short code and a QR; a parent signed in on their own phone claims it; the
screen collects its own long-lived device session. A device session can only ever do what a child may do. A
grown-up at the wall enters a PIN (four to eight digits, rate-limited, peppered with a server secret) which
lets *that screen* act as *that guardian* until a time kept on the server — two minutes without a touch by
default, fifteen at most. A parent can switch any screen off from their phone.

**Why.** "A child-facing route is not security" (the brief). What a screen may do is decided from its session on
every request, never from which profile is selected or which page is open.

## 7. Stars are a ledger, and the ledger is only ever added to

**Chosen.** Three totals per child — to spend, set aside, earned in all — each the sum of lines in one table.
Every line has a key that names what it is for (`task:<mission-day>:credit:1`); a second line with the same key
is not written. The table refuses updates and deletes at the database level. A reward asked for *reserves*
stars; yes then done *spends* them; no, or a refund, gives them back. Spending never lowers "earned in all".
Corrections are new lines that say why.

**Why.** Double taps, retries, two phones and offline queues all become harmless: the question "was this paid?"
has one answer. `GET /api/history/reconcile` adds the lines up again and compares.

**The brief's word "XP"** is "stars" throughout — a word a three-year-old has.

## 8. Days are calendar days where the family lives

**Chosen.** A mission belongs to a local date (`2026-03-08`), never to a timestamp. There is one mission per
template, child and date, enforced by a unique index. Nothing is handed out for a day nobody opened a screen —
a missed day is simply absent, not a row of failures. Each household's daily chores (today's missions, weekly
stars, tidying) are done lazily by the first request of the new local day, under the household's lock.

**Why.** Daylight-saving changes cannot duplicate or skip a day, and nothing depends on a scheduler: the free
hosting plan runs a cron job once a day at an hour of its choosing, which is too coarse to rely on. The daily
cron exists (`/api/cron/daily`) only so the morning is ready a little sooner.

## 9. The look: a storybook house — see `design/explorations/README.md`

Three directions were built as working pages and screenshots (`design/explorations/`,
`docs/review/directions/`): **A** a cutaway storybook house, **B** a friendly space station, **C** a paper
village. **A was chosen**: rooms are places a small child already understands (things to buy are in the pantry,
stars are in the piggy bank), status can be *in* the picture rather than beside it, and it is furthest from the
Training Academy's islands, so the two cannot be confused. From B came the day clock; from C, the cut-paper
flatness of the drawings.

## 10. Drawings are code, not files; motion is CSS — no Rive, Lottie or 3D

**Chosen.** All 119 pictures, the house, and Tock are inline SVG written by hand on one palette
(`src/art/`), animated with CSS transforms and opacity only.

**Looked at.** Rive (lovely, but a runtime of ~100 kB plus a proprietary editor to change anything), Lottie
(After Effects in the loop), Three.js (the display's chip is modest and the brief says not to overdraw 4K).

**Why.** Every picture can be recoloured by the sky, checked by a test (`tests/client/pictures.test.tsx`), and
edited by anyone with a text editor. There is nothing to license (see `docs/ASSETS.md`). Calm mode and quiet
hours stop all motion with one attribute.

**What it costs.** No skeletal animation; movements are simple (a drop, a scrub, a wave).

## 11. The guide speaks with the device's own voice; nobody is listened to

**Chosen.** Tock's instructions are spoken with the browser's built-in speech synthesis, on the device. No audio
is recorded or sent anywhere, ever; there is no voice input. Every instruction is also a picture and, for
readers, a line of words.

**What it costs.** The voice is whatever the display has installed; this must be checked on the real device
(`docs/DEVICE-CHECKLIST.md`). Recorded phrases by a parent would be nicer and are on the roadmap.

## 12. The Training Academy is visited, not embedded

**Chosen.** The boat on the pond navigates the whole window to the Academy's own address — an https address on a
server-side allow-list, with nothing added to it. Progress comes back only if a parent exports a player from
the Academy and imports the file here, with consent, for one child (`docs/integrations/ACADEMY.md`).

**Why not an iframe.** The Academy's hosting configuration sends `X-Frame-Options: DENY`; and a frame would not
share its storage anyway. **Why not live sync.** It needs a change to the Academy's repository, which was not
authorised. A proposal for it is written down, not built.

**What it costs.** Coming home from the Academy is the display's own "back" (or a kiosk browser's home button):
HOMEBASE cannot put a button inside another site. This is a real limitation for a three-year-old and is the
first thing to try on the real device.

## 13. The calendar stays in the display's own Calendar Mode

**Chosen.** HOMEBASE does not read, copy or show the family's calendar. The calendar room shows only pictures a
parent picks for each day (school, a visitor, a birthday) and how to switch the display to its Calendar Mode.

**Why.** The manufacturer documents no way for a web page or another app to open Calendar Mode
(PROVIDER-FACTS §1), and the brief says not to invent one. A read-only "glance" through CalDAV or Google would
put private events on a child's screen unless filtered by a parent anyway — so the parent's pictures *are* the
filter. The provider adapter is on the roadmap, not built.

## 14. Photos: the display's screensaver first; our own slideshow second

**Chosen.** The first choice is the display's own Google Photos screensaver. HOMEBASE's own slideshow shows
photos a parent adds from their phone; the phone shrinks them first (which removes the camera's location and
time), and they are stored in the family's own database, with a quota, served only to that household's screens.

**Why not Google Photos in HOMEBASE.** Since March 2025 an app can only see what it created; the Picker API
gives links that expire in an hour and needs an OAuth app with review or seven-day consent (PROVIDER-FACTS §5).

**What it costs.** Photos in Postgres are fine for a few hundred pictures (the default cap is 200 MB) and wrong
for a library. Object storage is the upgrade path.

## 15. Shopping lists belong to HOMEBASE; Siri reaches them with a narrow key

**Chosen.** The lists live in HOMEBASE and merge edits field by field. An iPhone Shortcut can add to them with
a bearer token that can do nothing else and can be cancelled. Lists leave as plain text through the phone's
share sheet.

**Not done, because it cannot be:** two-way sync with an Apple Note (no API), appearing in the iOS share sheet
as a target (not offered to web apps) — PROVIDER-FACTS §6.

## 16. The look-back counts; it does not judge

**Chosen.** Small events with times to the minute; day-by-day records for 90 days, weekly totals for 12 months,
both adjustable or switchable off; every number shown with what it is out of; a child only ever beside their
own earlier weeks. No scores, no speeds, no rankings, no labels.

## 17. The sky is real, and where the family lives stays private

**Chosen.** Sunrise, sunset and the moon are worked out on the wall itself from a position rounded to about a
kilometre — no service involved. Weather, if switched on, is asked for by the *server* (US National Weather
Service, or Open-Meteo elsewhere) with only that rounded position. A US ZIP code typed by a parent is looked up
on the parent's phone from a bundled public table and is never sent or stored as an address.

**Privacy rule.** No family's place is ever written in this repository, its fixtures or its documents. The demo
family lives in a made-up town.

## 18. The planning helper is optional and can only propose

See `docs/integrations/AI.md`. Off by default; adult-only; the model's output is a draft of ordinary HOMEBASE
operations from a short allow-list, checked by ordinary code, applied only when a parent accepts, through the
same path as anything else. It cannot touch the star ledger. Everything works without it.

**Two choices inside it worth recording.**

- *The providers are called over plain HTTPS, not through their SDKs* — **Deviation** from the providers' own
  advice. Every outbound request in HOMEBASE goes through one injected `fetch`, which tests replace and
  `HOMEBASE_OFFLINE` closes; the helper adds no dependency to a feature most households never switch on; and the
  API is pinned by version header. The cost is that keeping up with the providers' APIs is this code's job
  (`server/ai/provider.ts`, one file).
- *The spending limits are enforced with a reservation.* The dearest a request could cost is written into the
  usage ledger under the household's lock before it is sent, and given back when the real cost is written. Two
  requests arriving together — even on two server instances — cannot both slip under a limit. If the server dies
  mid-request the amount stays set aside, which is the safe direction.

## 19. A deployment with no database can only ever be a demo

**Chosen.** With no `DATABASE_URL` on a hosted deployment, the server keeps a made-up family in memory and says
"demo" on every page. Real sign-up is closed there. This makes "I deployed it and forgot the database" safe: no
real family's data can ever land in a place that forgets it. Because a hosted server can be replaced at any
moment (and its memory with it), the demo's client walks back in by itself when that happens; a real household
is never walked back in.

## 20. Tests are written as promises to a parent

Server tests run a whole server in-process against a real (PGlite or PostgreSQL) database with a clock the test
holds; they are named for what a parent is promised ("gives the stars once however many times yes is tapped").
Browser tests drive the built wall as a child would. `docs/TEST_RESULTS.md` has the counts and what is *not*
covered.

## 21. The wall decides for itself how much to move

**Chosen.** Three levels of motion, set on the page root: *full*; *light*, which the wall chooses for itself when
it sees its own frames arriving too slowly (`src/wall/pace.ts`: under about 30 a second, judged a few seconds
after the house is up and once more a minute later) and in which the ambient movement inside the drawings stops
but what answers a tap still moves; and *still*, for calm mode, quiet hours and a device that asks for less
motion, in which nothing animates at all.

**Why.** The display is a 4K panel driven by hardware nobody has measured yet. A house that drifts and blinks
is charming at 60 frames a second and looks broken at 15. Rather than guess, the wall measures, and gives up
decoration before it gives up responsiveness. Measured headless at 3840×2160 with no graphics card and the
processor slowed four times, the idle house went from about 20 frames a second to about 60 once it had made
that choice (`npm run measure`). **The real display is still to be measured** (`docs/DEVICE-CHECKLIST.md`).

**What "too slowly" means** was sharpened by measuring twice. Judged by the middle frame alone, a display that
drew most frames on time and a good many late — 22 a second in all — passed. The wall now needs both the middle
frame and the average frame to be quick enough: the average catches the uneven display, and the middle frame
keeps a few long hiccups among many good frames from counting as a display that cannot keep up.

## 22. What a child has finished never disappears

**Chosen.** The mission board shows a few missions at a time (a parent's setting), to-do first. A finished
mission moves to a tray along the bottom of the board, with its tick, while there is more to do; when everything
is done the finished cards have the board to themselves. Badges are keepsakes for things that add up (never for
days in a row, speed, or beating anybody) and are never taken away, whatever a later correction does to the
stars.

**Why.** The first version filled the board with to-do cards and let finished ones fall off the end; the browser
tests caught a child's finished mission vanishing the moment it was done. For a child who cannot read, "where
did it go?" is the wrong feeling at exactly the wrong moment.

## 23. The cache on a device is not encrypted — **Deviation, with reasons**

**The brief** asked for "encrypted storage when feasible".

**Considered.** (a) Encrypt the cached snapshot and outbox with a key kept on the same device (a non-extractable
WebCrypto key in IndexedDB). Feasible, but the key sits beside the data: anything that can read the browser's
storage can use the key, so it protects against little beyond a casual look at the files. (b) Keep the key on
the server and hand it to a signed-in screen. That would make a revoked device's cache unreadable — real
protection — but a wall could then not start without a signal, which is exactly what the cache is for.

**Chosen.** Neither. Instead: the wall's cache holds only what a child's screen may see (nicknames, pictures,
today's missions, the shopping list — no e-mail addresses, no star ledger, no parents' settings, no photos:
the offline shell never stores anything from `/api`); it is wiped on sign-out and the moment the server says the
device is no longer welcome; and a parent's phone relies on the phone's own storage encryption. If (b) ever
becomes worth the trade — say, a wall in a shared building — it is a contained change in `src/sync/cache.ts`.

## 24. A routine's minutes are about the routine, never about a child

**The brief** asks that history "reports where routines take longer or require assistance without treating it
as a clinical assessment", with denominators and with missing data flagged, and elsewhere that there be no
rankings and no mandatory countdown. Minutes are the most easily misread number in the house: a timed child is
a judged child.

**Considered.** (a) Minutes for each child, beside their own earlier weeks. Honest about who, but it puts a
stopwatch on a four-year-old and invites the comparison the brief forbids. (b) No minutes at all — what the
look-back did until now; it meets "no judgement" and fails "where routines take longer". (c) Minutes for the
routine as a whole, all its goes together.

**Chosen.** (c). For each routine over four weeks the look-back says when in the day it was finished, the usual
minutes from the first tap to the last, and the step that usually has the longest gap before its tick
(`routineTiming` in `server/domain/history.ts`). Four rules keep it honest:

- **The middle go, not the average**, so one slow Tuesday cannot colour a month.
- **Nothing from fewer than three goes**, and the page says how many it has.
- **A go set aside and finished more than two hours later is left out** and counted as left out.
- **It is called what it is**: minutes between taps on a screen, to the nearest minute. A child who does
  everything and then ticks it all at once looks instant, and the page says so.

What a parent gets from it is a planning fact — "the morning usually waits at breakfast" — and nothing about how
quick anybody is.

## 25. Favourites are kept with the household's settings, not in a table of their own

**The brief** lists favourites among the shopping list's features.

**Considered.** (a) A table of favourites, with its own row-level-security policy and migration. (b) A flag on a
list item — but items are archived and deleted, and a favourite must outlive the line it came from. (c) A short
list inside the household's settings.

**Chosen.** (c): up to forty entries of words, a picture and an aisle (`settings.shopping.favourites`), changed
through a request of their own (`shopping.favourite`) that a helper may make, not only a parent. Requests about
one household never run at the same moment (the household's row is locked), so two phones starring different
things both keep theirs. It travels with the settings: every screen has it, the export has it, deleting the
household deletes it — with no new table to secure. The picture and aisle are stored as plain words and
checked where they are shown, and a damaged shelf reads as an empty shelf, so that one bad entry can never make
a household's whole settings unreadable.

A child's screen is not sent the shelf: like the label of the family's location, it is left out of the copy of
the settings a wall receives (`server/domain/snapshot.ts`), because a wall has no use for it.

## 26. Connections are read from what is already kept — and no Background Sync — **Part deviation**

**The brief** asks history to keep "integration health, sync errors and device changes", and the app to use
"background sync where supported plus foreground reconnect fallback".

**Connections.** Almost everything a parent needs to see is already kept for another reason: the answer given to
every request a screen makes (a month, so that a retry finds its first answer), the helper's own account of what
it spent, the record of set-up changes (thirteen months). So the Connections page reads those
(`server/domain/health.ts`) rather than keeping a second log beside them. Only two things are newly written
down, because nothing else would remember them: a weather service that has gone quiet for about a quarter of an
hour, and when it came back (one line each, not one per failed try); and a request the server itself could not
carry out (once a day for each screen and kind of request — a screen retrying every few seconds must not fill
the record). An ordinary "no" — not enough stars yet — is counted and not listed: that is the house working.
Nothing in the account is anything a family typed: a screen's name, a part of the house, a kind of problem.

**Background Sync is not used.** *Deviation.* Safari on an iPhone does not have it, so the parents' side could
not rely on it; the wall is always in front, so it never needs it; and a service worker replaying the queue
would be a second copy of the sync rules (order, sign-in, what to do when refused) to keep in step with the
first. The queue is kept on the device and sent when the page is next in front and has a signal, which is
tested (`e2e/offline.spec.ts`, `tests/server/store.test.ts`). The cost: a phone that queued something offline
and was then closed sends it the next time HOMEBASE is opened, not before.

---

## Smaller choices

| Choice | Why |
| --- | --- |
| Valibot, not Zod | A fraction of the size in the browser; the same schemas validate on both sides |
| CSS Modules and custom properties, no CSS framework | The wall is a drawing, not a layout of components; the phone side is ~400 lines of CSS |
| Fredoka for headings, Andika for reading | Andika was designed for people learning to read: a one-storey *a*, a clear *l* and *I* |
| Stars only ever mean stars | Decoration uses sparkles, so a child never miscounts |
| "Not today" instead of "skip", "have another go" instead of "rejected" | Words a child hears must not shame |
| `uqr` for QR codes | Drawn on the device; no request to anyone |
| No analytics, no error-reporting service | Nothing leaves the deployment. Errors are in the host's own logs, and those lines carry no family data (`server/log.ts`) |
| A first-visit tour that never catches a tap | Tock points at each thing in turn; any tap ends the tour *and* does what was tapped, so a child who already knows is never made to wait |
| The wall rests at 15 minutes, not 3 | Long enough for a sleep-when-idle database to sleep; any touch asks the server at once, so nobody ever waits for it |
| Adding "2 milk" to a list that has milk keeps one line and takes the new amount | One thing, one line; the amount just said is the amount |
| A finished routine stays in front until the child taps | "All done!" is the reward of a routine; it must be seen and heard, not flicked away |
| A wall that cannot be seen holds its animations, and stops talking and turning photographs | Nothing is drawn or said for nobody; it carries on exactly where it was |
| Ids are made by hand where the browser withholds `crypto.randomUUID` | A wall tried at a plain http address on the home network must still work |
