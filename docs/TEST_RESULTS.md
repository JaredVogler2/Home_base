# Test results

What was run, what it showed, and what no test here can show. Everything on this page was run on
2026-11-26 in a Linux container (Node 22.23, headless Chromium from Playwright 1.63, PostgreSQL 16.15), against
the made-up Maple Street family. **Nothing on this page was run on the real display, on an iPhone, on Vercel, or
against a hosted database** — those are listed at the end.

## Summary

| What | Command | Result |
| --- | --- | --- |
| Formatting, lint, types | `npm run format:check`, `npm run lint`, `npm run typecheck` | Clean |
| Unit and integration tests, built-in database | `npm test` | **456 passed**, 1 skipped (34 files) |
| Server tests on real PostgreSQL 16 | `npm run test:pg` | **252 passed** (21 files), including backup and restore — on the long-lived local server and again on a brand-new one |
| Production build | `npm run build` | Built: 1.4 MB on disk, 43 files in the offline shell |
| Browser tests, four screen sizes | `npm run test:e2e` | **30 passed**, 1 skipped (needs a built app) |
| The skipped one, against the built app | `E2E_SERVER=production npx playwright test e2e/offline.spec.ts` | **2 passed** (and 6 of 6 when repeated three times) |
| A deployment, checked from outside | `npm run verify:deployment -- http://127.0.0.1:4173` | 20 checks, "All as it should be" |
| The wall, measured | `npm run measure` | Table below |
| Continuous integration on GitHub | `.github/workflows/ci.yml` | See [`PROGRESS.md`](PROGRESS.md) for the latest run |

The one skipped unit test is the backup-and-restore test, which needs a real PostgreSQL and runs under
`npm run test:pg`.

## What the tests are

Tests are written as promises to a parent, and named that way. A server test starts a whole HOMEBASE in the
test process — the real API, a real PostgreSQL (built to WebAssembly by default, or a server), a clock the test
holds, and a network that reaches nothing — and talks to it over HTTP as phones and walls do.

| File | Tests | What it promises |
| --- | :-: | --- |
| `tests/server/identity.test.ts` | 20 | Sign-up, sign-in, recovery codes, invitations, pairing a wall, the PIN, rate limits, who may do what |
| `tests/server/isolation.test.ts` | 10 | One household can never read or change another's; the session decides, never who is "selected" |
| `tests/server/quest.test.ts` | 19 | Missions: schedules, time zones and clock changes, one award however often a tick is tapped, approval, "not yet", undo, order |
| `tests/server/bank.test.ts` | 15 | Stars: an append-only ledger, rewards asked for at the same moment, refunds, corrections, lifetime never lost by spending |
| `tests/server/routines.test.ts` | 10 | Steps in order, "together", pausing, no stars unless the family chose them |
| `tests/server/shopping.test.ts` | 13 | Two phones and a wall on one list, a child's request, edits to different fields both kept, an offline queue sent twice |
| `tests/server/suggestions.test.ts` | 5 | "You often buy" |
| `tests/server/shortcuts.test.ts` | 14 | The Siri key: narrow, revocable, rate-limited, useless for anything else |
| `tests/server/history.test.ts` | 11 | The look-back's counts and denominators, export, deletion of a child and of a household, parents' moments |
| `tests/server/media.test.ts` | 13 | Photos: only real JPEG or WebP, size and count limits, a household's space, who may add and who may see |
| `tests/server/academy.test.ts` | 15 | Bringing in an Academy export: consent, checksum, limits, one child, never twice |
| `tests/server/weather.test.ts`, `weather-codes.test.ts` | 30 | The weather: only when switched on, only a rounded position sent, failures handled, both services' answers read |
| `tests/server/ai.test.ts`, `ai-units.test.ts` | 52 | The planning helper: off by default, what is sent, spending limits, what can come of a reply, both providers' request shapes (faked) |
| `tests/server/badges.test.ts` | 4 | Keepsakes: given once, kept for good |
| `tests/server/store.test.ts` | 8 | The screen's own store against the real server: offline queue through a reload, a lost answer, a refusal, a revoked screen, the demo |
| `tests/server/demo.test.ts`, `cron.test.ts`, `log.test.ts` | 12 | The made-up family; the daily nudge; nothing a family typed in the server's log |
| `tests/server/backup.test.ts` | 1 | `pg_dump` and restore into an empty database: the same household (PostgreSQL only) |
| `tests/shared/*.test.ts` | 50 | Colour and sky, deployment configuration, Academy export format, safety words, badges, the plan's fairness sums, code boundaries, migrating beside another database |
| `tests/client/pictures.test.tsx` | 129 | Every drawing a parent can choose exists and draws cleanly: no broken number, no words inside a picture, none too heavy |
| `tests/client/*` (the rest) | 26 | ZIP lookup; photo shrinking; the wall's helpers (what to wear, glad tidings, whether the display keeps up); the gentle timer |

Browser tests (`e2e/`, Playwright, each starting its own server with an in-memory database):

| Spec | What it walks |
| --- | --- |
| `non-reader.spec.ts` | Choose who you are, find missions, see stars, sail to the Academy, come home, ask for a reward — using pictures and the controls' names alone; every control at least 64 px at 1080p; the same way home from every room |
| `approval.spec.ts` | A grown-up says yes from a phone and the wall shows it, with the stars counted once; "not yet" with kind words |
| `rewards.spec.ts` | Asked for, agreed, done; one declined gives the stars straight back |
| `pairing.spec.ts` | A fresh wall shows a code, a parent claims it, it becomes the house; switched off, the code comes back |
| `shopping.spec.ts` | Two phones and the wall keep one list; a child asks by picture |
| `offline.spec.ts` | A mission finished with no signal is kept, survives a reload and is sent exactly once; a reload with no signal still draws the house |
| `motion.spec.ts` | Reduced motion, calm mode and quiet hours leave nothing animating |
| `layouts.spec.ts` | The house fits, with nothing overlapping, at 1920×1080, 1280×720, an upright tablet and a phone; no grown-ups' page scrolls sideways |
| `a11y.spec.ts` | axe scans of the wall and the grown-ups' side with no rule switched off; keyboard reaches every room; Escape goes home |
| `auth.spec.ts` | Sign up, recovery codes shown once, sign out and in, a wrong password, an invitation |
| `tour.spec.ts` | The first-visit showing-round appears once, never catches a tap, and does not run in quiet hours |
| `print.spec.ts` | A routine as a sheet to print: its steps and rings; on paper only the sheet; Escape puts it away |

## Fewest taps for what a child does

Counted from the journeys the browser test walks. **How long a real child takes has not been measured**; that
needs a child ([`DEVICE-CHECKLIST.md`](DEVICE-CHECKLIST.md) section I).

| To… | Taps | Which |
| --- | :-: | --- |
| See my missions | 2 | My face, the missions room |
| Finish a mission | 4 | …a mission's picture, the tick |
| See my stars | 2 | My face, the pig |
| Ask for a reward | 4 | …a reward's picture, "ask" |
| Do the next step of a routine | 4 | My face, the day clock, the routine, the tick |
| Ask for something to buy | 3 or 4 | The pantry, the plus, a picture (and my face, if the house does not know who is asking) |
| Go home from anywhere | 1 | The house button |
| Hear it again | 1 | The loudspeaker |

No journey needs reading, typing, dragging, a double tap or a long press. The longest the wall takes to answer
a tap is a room growing open, about 0.4 s.

## The wall, measured

`npm run measure` against the production build, headless Chromium **with no graphics card and the processor
slowed four times**. These figures are for catching a change that makes things worse. They are **not** the
display's: its chip and its graphics will differ in both directions.

| | 1920×1080 | 3840×2160 |
| --- | --- | --- |
| Downloaded to draw the wall | 656 KB in 15 requests | 656 KB in 15 requests |
| House drawn after | 750 ms | 1,083 ms |
| Elements in the page (home) | 675 | 678 |
| Script memory in use | 9.5 MB | 9.5 MB |
| Frames, house idling, first 5 s | 59.6 a second | 20.3 a second |
| Motion the wall then chose for itself | full | light |
| Frames, house idling, after that | 59.3 a second | 60 a second |
| Frames, a room opening | 54.4 a second | 50.4 a second |
| Frames, a mission finished | 42.4 a second | 41.5 a second |
| Frames, a device that asks for less motion | 60 a second | 60 a second |

What it shows: drawn in software at 4K the ambient movement costs two frames in three; the wall notices within
about eight seconds, stops it by itself, and is smooth again ([`DECISIONS.md`](DECISIONS.md) §21).

## What the tests found

Bugs found by the browser tests and the two audits, and fixed (each with a test that would catch it again):

- A finished mission vanished from the board when more were waiting than it shows at once.
- Green and blue buttons and links were under 4.5:1 contrast; a select had no name; three controls had spoken
  names that did not contain their visible words; Escape did not leave a room.
- A wall a parent had switched off could go on showing the family for minutes at night, because a sleeping wall
  asked the server too seldom and a touch did not wake it.
- In the demo, a switched-off wall walked itself back in (introduced and caught the same day).
- A failed database query could have put a nickname or a list item into the host's logs.
- The spending limit for the planning helper could be slipped past by two requests at once.
- The CSV export turned negative numbers into text; lines written in the same instant could come out in either
  order.
- Photo uploads had no rate limit.
- A mission's timer was saved and never shown; the order of missions could not be changed from the phone.
- Adding "2 milk" when milk was already on the list kept the old amount.

And two that only the first run of CI on GitHub could find, because both need a database server that has never
seen HOMEBASE before:

- **Two databases set up at the same moment on one new server both tried to create the role they share**, and all
  but one failed. Reproduced here on a fresh server (1 of 21 test files failing), fixed in the migration runner
  (it tries again), and proven on another fresh server: 252 passed, with the database's own log showing the race
  happen once and be survived.
- **A backup made with a newer `pg_dump` than the database could not be put back.** The test now insists the two
  match, CI's database matches its `pg_dump`, and the deployment guide says so.

And one that only a slower machine than this one shows:

- **A tap was shown as "sent" a few thousandths of a second before the device had finished writing it down.**
  On GitHub's runner the offline test reloaded the page inside that gap, and the mission came back as "to do".
  A request is now written to the device first and shown after, so "sent" on the screen always means "kept".

## What is not tested, and why

| Not tested | Why | Where it is tracked |
| --- | --- | --- |
| Anything on the real Apolosign display: its browser, kiosk behaviour, voices, glare, reach, heat, real frame rate | Needs the display | [`DEVICE-CHECKLIST.md`](DEVICE-CHECKLIST.md) |
| Anything on an iPhone: Add to Home Screen, Siri Shortcut, share sheet, camera-roll photos | Needs the phone | Checklist; `docs/integrations/SHORTCUTS.md` |
| A real Vercel deployment and a hosted Supabase or Neon database (the restricted role, the pooler, headers, the daily nudge, `Secure` cookies) | Needs the owner's accounts and say-so | [`DEPLOYMENT.md`](DEPLOYMENT.md); `npm run verify:deployment` is ready |
| A real request to Anthropic or OpenAI | No key; none was attempted | `docs/integrations/AI.md` |
| A real child using it | Needs a child and a willing parent | Checklist section I |
| Safari and Firefox | Only Chromium is installed here; the code uses nothing Chromium-only on purpose, but that is not proof | — |
| Each optimistic reducer on its own | The store is tested end to end and against the real server instead | [`ROADMAP.md`](ROADMAP.md) |
| Truly simultaneous requests on the built-in database | It serves one connection; the PostgreSQL run is what contends real locks | `npm run test:pg` |
| Long running: a wall left on for weeks | Not possible in a session | Checklist C7, H4 |
| Load: many households at once | Out of scope for one family; isolation is tested, capacity is not | [`COSTS.md`](COSTS.md) |

## How to run it all

```bash
npm ci
```

```bash
npm run verify
```

That runs formatting, lint, types, the unit and integration tests, the build and the browser tests. For the
PostgreSQL run, point `HOMEBASE_TEST_PG_URL` at a PostgreSQL you may create databases on, then:

```bash
npm run test:pg
```
