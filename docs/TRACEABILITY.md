# Traceability: the brief against the code

Every requirement, invariant and prohibition in the brief (`README.md` as first written, and the fifteen files in
`prompt-series/`), and what the code at commit **`ad4c5e4`** actually does about it. First written 2026-11-26
against `5479df1`; refreshed the same day after the fixes that audit led to (merge `ef906d2`, then `9d866c0`, then
`ad4c5e4`, which adds `README.md` and `docs/PROGRESS.md` only). Two changes made after that refresh are folded in
by hand: the "Saving up" section in History (row 11.22) and CI keeping a trace of any failing browser test.
Statuses come from reading the code and the tests; other documents were used as a map and checked where they
made claims.

What was run for the refresh: `npx vitest run` at `ef906d2` (33 files, **453 passed, 1 skipped** — the skipped
one is the backup test, which needs PostgreSQL) and `tests/server/backup.test.ts` against a local PostgreSQL at
`9d866c0` (passed). At `5479df1`: `tsc --noEmit` and `eslint .` clean, and a search of tracked files for API keys
and tokens (none). Not re-run here: the full `npm run test:pg`, the Playwright browser tests, the production
build and `npm run verify:deployment`; where those are cited, the evidence is their code and the results
recorded in `docs/TEST_RESULTS.md` (browser: 29 passed, 1 skipped under the dev server; the skipped offline
reload passes against a production build).

## How to read the statuses

| Status | Meaning |
| --- | --- |
| **verified** | Implemented, and a test in this repo exercises it (file and test title given), or it was inspected or run for this audit (said what) |
| **built, not tested here** | Implemented — the code was read — but no automated test covers that particular promise |
| **simulated** | Works only against a fake, the made-up demo family, or a headless browser standing in for the real thing |
| **hardware-pending** | Cannot be known without the real wall display or an iPhone; the row of `docs/DEVICE-CHECKLIST.md` is named |
| **account-pending** | Needs credentials, a real deployment, or the owner's authorisation |
| **deviation** | Done differently on purpose; the `docs/DECISIONS.md` section is cited |
| **not built** | Absent (or present only in a form nobody can use). Says whether any document admits it |
| **not possible** | Cannot be done as asked, with the reason |

"XP" in the brief is "stars" in the code (DECISIONS §7). "Helper" in the code is the brief's "optional guest" /
caregiver role. Test titles are quoted exactly; `quest.test.ts` means `tests/server/quest.test.ts`, and so on.

## Summary

Counted by script from the status column of the tables below. Items are finer-grained than the brief's
sentences (one row per separately testable promise), which is why there are more than the brief has lines.

| Source | Items | verified | built, not tested | simulated | hardware-pending | account-pending | deviation | not built | not possible |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| README | 8 | 4 | 1 | 0 | 2 | 1 | 0 | 0 | 0 |
| 00 Start here | 33 | 26 | 4 | 0 | 0 | 3 | 0 | 0 | 0 |
| 01 Architecture | 25 | 19 | 3 | 0 | 0 | 1 | 2 | 0 | 0 |
| 02 Child experience | 36 | 17 | 13 | 2 | 2 | 0 | 1 | 1 | 0 |
| 03 Identity and data | 24 | 22 | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| 04 Quest | 30 | 23 | 6 | 0 | 0 | 0 | 0 | 1 | 0 |
| 05 Bank | 28 | 25 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| 06 Routines | 21 | 13 | 6 | 0 | 0 | 0 | 0 | 2 | 0 |
| 07 Academy | 20 | 12 | 4 | 0 | 0 | 1 | 0 | 2 | 1 |
| 08 Calendar | 17 | 2 | 5 | 0 | 5 | 1 | 0 | 3 | 1 |
| 09 Memories | 20 | 9 | 4 | 0 | 4 | 0 | 0 | 3 | 0 |
| 10 To buy | 34 | 21 | 6 | 1 | 2 | 0 | 0 | 3 | 1 |
| 11 Parent studio, history | 26 | 17 | 8 | 0 | 0 | 0 | 0 | 1 | 0 |
| 12 AI copilot | 29 | 17 | 2 | 3 | 0 | 1 | 1 | 5 | 0 |
| 13 Deployment, device | 40 | 23 | 4 | 2 | 5 | 3 | 0 | 3 | 0 |
| 14 Quality and release | 33 | 18 | 4 | 1 | 1 | 2 | 0 | 7 | 0 |
| **Total** | **424** | **268** | **74** | **9** | **21** | **13** | **5** | **31** | **3** |

## What is not done

Most important first, by how hard the brief leaned on it. "Undocumented" means no document other than this one
says it is missing.

1. **Coming home from the Academy without help** (07). Not possible as a web page: HOMEBASE cannot put a button
   inside another site, so return is Android's back gesture or a kiosk app (DECISIONS §12; DEVICE-CHECKLIST G3).
2. **No child has used it** (02, 14). The non-reader journey is proven by a headless browser only; the trial is
   written down as pending (DEVICE-CHECKLIST §I). Taps are counted from browser journeys (TEST_RESULTS "Fewest
   taps"); a real child's time is not measured.
3. **Nothing has run on the real wall, an iPhone, Vercel or a hosted database**, and no live AI provider call has
   been made. Every hardware and account row below is open; DEVICE-CHECKLIST, DEPLOYMENT and INTEGRATIONS say so.
4. **History does not say where routines take longer** (06, 11). Run minutes are stored in the completion event
   and never reported; time of day is shown for missions, not routines. Undocumented. (Reward goal progress is
   now in History, as "Saving up".)
5. **No record of integration health or sync errors in history** (11 f). Device pairing and switching off are in
   the audit trail; the Sky page notes a stale weather reading and the Helper page shows spend, but nothing is
   kept over time. Undocumented.
6. **To-buy gaps** (10): no favourites; no in-app voice input (keyboard dictation and the Siri Shortcut only); item
   "images" are bundled pictures, not photos. Undocumented.
7. **Routines have no branching and no active reminders** (06); only the day clock shows what is next.
   Undocumented.
8. **Missions have no age band of their own** (04); they are assigned to named children. Undocumented.
9. **Browsers**: no WebKit or Firefox run, Chromium only (13); no Background Sync API, foreground reconnect only
    (13). Undocumented.
10. **AI copilot: four of eight jobs not built** — schedule-aware planner, learning bridge, family briefing, story
    scripts — and shopping "staples from history". Documented (AI.md, ROADMAP §5). SDKs not used (DECISIONS §18).
11. **Calendar glance adapters and Google Photos Picker** not built — optional; documented (DECISIONS §13–14,
    ROADMAP §5).
12. **Academy Phase B live sync** not built — needs the Academy owner's permission; documented.
13. **Smaller, undocumented**: no device-side photo cache budget; no face-safe crop (09); no explicit pause of
    motion when the page is hidden (13); browser traces are kept only by CI, and only for a test that fails
    (none are committed) (02); `history.forget` has no screen; the core/bonus ribbon, the routine screens and the Academy
    import page have no browser test.
14. **Optional enhancements in file 14** not built: adventure map (ROADMAP's "family garden"), family bulletin,
    packing wizard, trip/emergency checklists, printable routines, milestone cards on the wall — all listed with
    trade-offs in ROADMAP §6.
15. **Deliberate deviations**: Vite SPA not Next.js (§1); polling not managed realtime (§2, §4); CSS/SVG only, no
    skeletal animation (§10); plain HTTPS not the providers' SDKs (§18); unencrypted device cache (§23).

Done since the first version of this file (each re-checked in the code): the mission timer on the wall; the
bonus ribbon on the child's board; parents' moments in History; mission reordering; the plan's load per child
("fairness by effort"); a warning for rewards that look like necessities; a tested backup and restore; the
missing documents except PROGRESS; screenshots at 4K, tablet and phone; a recording of the wall journey; and
the stale claims listed in the last section.

## README (the original paragraph)

| # | Requirement | Status | Where / evidence |
| --- | --- | --- | --- |
| R1 | Private family command center for a 27-inch 4K Apolosign wall and parents' iPhones | hardware-pending | Built as `/wall` and `/parent` (`src/app/router.ts`); the real display and phones are DEVICE-CHECKLIST A1–A8 |
| R2 | Pre-readers first: a living illustrated home, not a spreadsheet | verified | `e2e/non-reader.spec.ts`: `select a profile, find chores, see the balance, enter the Academy, return home and request a reward using pictures alone` |
| R3 | One modular Vercel project, shared database, two responsive modes | verified | `tests/shared/deploy-config.test.ts`: `sends the whole API to the one function and every other address to the app` (configuration only; no real deployment) |
| R4 | Keep the Training Academy deployment separate | built, not tested here | Only navigation and an import file touch it (`src/wall/scenes/Academy.tsx`, `server/domain/academy.ts`) |
| R5 | Native calendar and Google Photos as first-class device integrations; no undocumented native API | hardware-pending | No native calls in the code (inspected); DEVICE-CHECKLIST E1–E5, F1–F5 |
| R6 | Implement, test, document and commit each phase; record departures | verified | Inspected: 13 commits from foundation to docs (`git log`); `docs/DECISIONS.md` marks deviations |
| R7 | Public repo: no family names/photos, credentials, private events, child records, exports, keys, device tokens | verified | Pattern search of tracked files for key/token formats found none; `.gitignore` covers `.data/`, `.env*`; demo is the made-up "Maple Street" family (`server/domain/seed.ts`) |
| R8 | Real family data behind authentication in private storage | account-pending | Authentication and isolation verified (`identity.test.ts`, `isolation.test.ts`); no private deployment holds real data yet (13.1) |

## 00 — Mission and operating agreement

| # | Requirement | Status | Where / evidence |
| --- | --- | --- | --- |
| 00.1 | Pre-readers primary; a baby may have a profile but no independent tasks | built, not tested here | `server/domain/family.ts` forces `independent=false` for `baby`; `server/domain/quest.ts` refuses missions for a non-independent child. No test |
| 00.2 | Family data configurable at runtime, never hard-coded | built, not tested here | Profiles, settings, missions all in the database (`shared/settings.ts` defaults only); made-up family only in `seed.ts` for the demo |
| 00.3 | Record decisions and tradeoffs in `docs/DECISIONS.md` | verified | Inspected: 23 sections plus smaller choices; deviations marked |
| 00.4 | Never silently drop requirements | built, not tested here | Gaps are now written down: this file (linked from `docs/ROADMAP.md`), ROADMAP §5–6, INTEGRATIONS. Several small gaps (favourites, routine branching, Background Sync, cache budget) are recorded only here |
| 00.5 | Never claim untested integrations | verified | Inspected `docs/INTEGRATIONS.md` (each row says built/tested/needs device). One stale claim found the other way round (last section) |
| 00.6 | No paid service without documenting costs and free alternatives | verified | Inspected `docs/COSTS.md` ("Why nothing paid is required", alternatives) |
| 00.7 | Inventory requirements; tracked plan with dependencies and acceptance tests | verified | Inspected `docs/ROADMAP.md`: phases with brief file and state, then next steps each with "waiting for". Acceptance is via `docs/TEST_RESULTS.md`, not per step |
| 00.8 | Inspect Training Academy source and deployment docs | verified | `docs/integrations/ACADEMY.md` "Verified" lists the Academy files read; the export checksum is ported and tested (`tests/shared/academy.test.ts`: `the Academy’s checksum, ported > matches known values`) |
| 00.9 | Check current official provider documentation | verified | Inspected `docs/research/PROVIDER-FACTS.md`, dated 2026-11-26, with sources |
| 00.10 | Three distinct visual directions with real prototype screenshots; choose and explain | verified | Inspected `design/explorations/` (three working pages), `docs/review/directions/` (8 screenshots), DECISIONS §9 |
| 00.11 | After each phase update `docs/PROGRESS.md` with actual results and screenshots | verified | Inspected `docs/PROGRESS.md` (committed in `ad4c5e4`): status words, "At a glance", evidence, departures, "How it got here". Written once at the end, not after each phase |
| 00.12 | Live demo seeded with fictional data | account-pending | Demo mode built and tested (`demo.test.ts`: `is a family with children, missions, routines, rewards and lists, marked as made up`); no hosted demo exists |
| 00.13 | No live calendar, photo or family data exposed by public previews | account-pending | A preview without `DATABASE_URL` is forced to demo (`server/config.ts`); a preview given the production URL would serve it (ARCHITECTURE §8) — depends on Vercel settings |
| 00.14 | One-command local dev workflow | verified | `npm run dev` (Vite with the API inside); the Playwright config starts the same `vite` command for every browser run |
| 00.15 | Setup instructions for a nontechnical parent | verified | Inspected `docs/PARENT-GUIDE.md` ("First ten minutes"), `docs/DEPLOYMENT.md` |
| 00.16 | Deployed-preview verification and installation guide | account-pending | `scripts/verify-deployment.ts` exists; DEPLOYMENT §3 is marked "unverified on Vercel" |
| 00.17 | No paid infra, no change to another repo, no secrets, no real data without authorisation | verified | Inspected: no paid dependency, no secrets (pattern search), Academy untouched (ACADEMY.md Phase B is a proposal) |
| 00.18 | No reading required for child core navigation | verified | `e2e/non-reader.spec.ts` (title in R2): finds everything by picture test id, asserts no text field after every step |
| 00.19 | No ads | verified | Inspected `src/wall/**`: no third-party script, no external `href`; CSP `script-src 'self'` (`deploy-config.test.ts`: `lets nothing but the app itself be loaded, framed or posted to`) |
| 00.20 | No manipulative engagement | verified | `tests/shared/badges.test.ts`: `never needs days in a row, and has something to say for every badge` |
| 00.21 | No external links | verified | The only destination off-site is the allow-listed Academy: `e2e/non-reader.spec.ts` asserts one request, to exactly the configured address |
| 00.22 | No unrestricted child chat | verified | No chat exists; `ai.test.ts`: `is never reachable from a wall, even one unlocked with a PIN` |
| 00.23 | No punishments for skipped chores | verified | `quest.test.ts`: `never takes a star for a mission skipped or not done` |
| 00.24 | No sibling rankings | built, not tested here | `src/parent/pages/History.tsx` shows each child only beside their own weeks; the wall shows only the chosen child's bank. No test asserts the absence |
| 00.25 | No loss of lifetime accomplishment on spending | verified | `bank.test.ts`: `never lowers lifetime stars by spending` |
| 00.26 | No rewards required for food, affection, rest, learning or necessities | verified | `tests/shared/safety.test.ts`: `notices food, sleep, comfort and a grown-up’s company`; `necessitiesIn` warns in `RewardEditor.tsx`. A warning, not a block: "Ice cream", "Choose dinner", "Stay up a little" pictures remain and a parent may still save such a reward |
| 00.27 | Parents retain control | verified | `isolation.test.ts`: `is decided by the session, never by which child is “selected” or what the request claims` |
| 00.28 | Offline-friendly | verified | `e2e/offline.spec.ts`: `a mission finished offline is kept, survives a reload, and is sent exactly once` |
| 00.29 | Reversible changes | verified | `quest.test.ts`: `lets a child take back an “I did it” for a little while…`; `shopping.test.ts`: `ticks off, unticks, removes and brings back — every step undoable and on the record` |
| 00.30 | Privacy-first | verified | `ai.test.ts`: `holds no name, e-mail, note, link, shop or place…`; `weather.test.ts`: `is the rounded position and nothing else…` |
| 00.31 | Native calendar and Google Photos preferred, not invented APIs | verified | Inspected: no intents, deep links or photo APIs in the code; INTEGRATIONS rows 1–2 |
| 00.32 | Core modules: HOME, QUEST, BANK, ROUTINES, ACADEMY, CALENDAR, MEMORIES, TO BUY, PARENT STUDIO, HISTORY, AI | verified | `e2e/non-reader.spec.ts`: `every room has the same way home, and the photos go home at a touch`; `e2e/layouts.spec.ts` visits every parent page |
| 00.33 | All usable with the LLM disabled | verified | AI is off by default (`ai.test.ts`: `is off by default: refused, and nothing leaves`); every other test runs with it off |

## 01 — Architecture and project strategy

| # | Requirement | Status | Where / evidence |
| --- | --- | --- | --- |
| 01.1 | Modular monolith: one deployment with `/wall`, `/parent`, pairing, authenticated APIs, optional child route | verified | `deploy-config.test.ts` (title in R3); `e2e/pairing.spec.ts`; a paired tablet is the child route |
| 01.2 | Academy stays independent; document integration contract and release coordination | built, not tested here | `docs/integrations/ACADEMY.md` (export format contract, version handling) |
| 01.3 | Current supported stack, e.g. Next.js | deviation | DECISIONS §1: Vite SPA + one Hono function |
| 01.4 | Managed Postgres with realtime via Supabase or equivalent | deviation | DECISIONS §2 (any Postgres, PGlite for dev/demo) and §4 (polling every 4 s / 30 s / 15 min) |
| 01.5 | CSS motion/SVG (or Rive/Lottie/Three.js); evaluate licensing and bundle cost | verified | DECISIONS §10; `tests/client/pictures.test.tsx`: `has a drawing for every name in the registry` (119 drawings, counted for this audit) |
| 01.6 | Avoid duplicating the Academy's engine | built, not tested here | Launch and import only; no Academy content in this repo |
| 01.7 | Module boundaries; presentation separate from domain rules | verified | `tests/shared/boundaries.test.ts`: `keeps the rules of the household free of the web and of the database connection` |
| 01.8 | Versioned schemas and migrations | verified | `server/db/migrations/`; applied from empty at the start of every server test run (fresh apply only; no upgrade test) |
| 01.9 | Typed provider interfaces | verified | `server/weather/providers.ts`, `server/ai/provider.ts`; `ai.test.ts`: `Anthropic: Messages API, documented headers, JSON outputs, no tools` |
| 01.10 | Transactional writes and explicit error states | verified | `isolation.test.ts`: `answers each one in a batch separately, and one bad one does not undo the good ones`; `REJECTIONS` in `shared/ops.ts` |
| 01.11 | Database authoritative, not localStorage | verified | `store.test.ts`: `shows a tap at once, sends it once, and ends up agreeing with the server` |
| 01.12 | IndexedDB cache, outbox with client operation ids, reconcile, backoff, dedup | verified | `store.test.ts`: `keeps what was asked while there is no signal — through a reload — and sends it exactly once`; backoff `BACKOFF_MS` in `src/sync/store.ts` |
| 01.13 | Never rely on a function's local filesystem, in-memory timer or permanent connection | built, not tested here | Polling, lazy daily chores (DECISIONS §8); in-memory PGlite only for the no-database demo (DECISIONS §19) |
| 01.14 | Scheduled work on verified platform limits or DB scheduling | verified | `deploy-config.test.ts`: `asks for the daily nudge once a day, which is all the free plan allows`; `cron.test.ts`: `gets each household’s morning ready once, and says nothing about them` |
| 01.15 | ADRs | verified | Inspected `docs/DECISIONS.md` |
| 01.16 | Entity diagram | verified | Inspected `docs/ARCHITECTURE.md` §5 (four `erDiagram` blocks) |
| 01.17 | Route map | verified | Inspected `docs/API.md` "Routes"; `src/app/router.ts` |
| 01.18 | Integration capability matrix | verified | Inspected `docs/INTEGRATIONS.md` |
| 01.19 | Threat model | verified | Inspected `docs/THREAT-MODEL.md` (25 rows; two stale sentences, last section) |
| 01.20 | Cost estimates at low and moderate use | verified | Inspected `docs/COSTS.md` "Low use", "Moderate use" |
| 01.21 | Implementation backlog | verified | Inspected `docs/ROADMAP.md` "What comes next, in order" (§1–6, sized) |
| 01.22 | Demo/local/preview/prod environments with separate DBs and secrets | account-pending | Documented ARCHITECTURE §8; separation rests on Vercel environment settings |
| 01.23 | Production app private though repos are public | verified | `identity.test.ts`: `lets the first family sign up and turns the second away`; every household route needs a session |
| 01.24 | Least-privilege adult credentials, device-scoped sessions, no service-role credentials in the browser | verified | `boundaries.test.ts`: `keeps what the browser runs free of anything from the server`; `identity.test.ts`: `gives the wall its own session, in child mode, without it ever seeing a password` |
| 01.25 | Modules operational without integrations | verified | All server tests run with weather off and AI off; `weather.test.ts`: `is never asked for when the deployment says off` |

## 02 — HOME: visual language and navigation

| # | Requirement | Status | Where / evidence |
| --- | --- | --- | --- |
| 02.1 | Original illustrated home world, not admin SaaS; characters, guide, tactile objects | verified | `src/art/**` (house, Tock, 119 drawings); `pictures.test.tsx`: `%s draws cleanly` for every drawing; look itself judged from `docs/review/screens/` |
| 02.2 | Bespoke animated module entrances | built, not tested here | `src/wall/scenes/Frame.tsx` grows each room from its place in the house (`origin`) |
| 02.3 | Study Academy art/Glim; coordinate licensing; avoid copying its map; distinct guide | built, not tested here | `design/explorations/README.md` scores "Not the Academy's world over again"; guide is Tock. Glim is not named in any document |
| 02.4 | 27-inch 16:9 4K with varying CSS viewport/DPR; responsive iPhone and tablet | verified | `e2e/layouts.spec.ts`: `the wall home: six rooms, the boat, the attic window and the faces, all inside the screen and apart` on 1920×1080, 1280×720, 820×1180, 390×844. Real panel: DEVICE-CHECKLIST A4–A5 |
| 02.5 | Important child controls near the lower reachable portion | hardware-pending | Layout puts child rooms on the ground floor and faces on the path (`src/wall/home/layout.ts`); DEVICE-CHECKLIST B1, B2 |
| 02.6 | 64–96 CSS px targets | verified | `e2e/non-reader.spec.ts` asserts every tapped control ≥ 64×64 px at 1920×1080 |
| 02.7 | No hover-only behaviour; tap-first | verified | Same spec: every step is a press, nothing hovered |
| 02.8 | Visible back/home on every view | verified | `e2e/non-reader.spec.ts`: `every room has the same way home, and the photos go home at a touch` |
| 02.9 | No mandatory drag or text entry | verified | Same spec's `noTextEntry` after every step |
| 02.10 | Icons show the action: toothbrush, shoes, basket, piggy bank, schoolhouse, calendar, photo frame | verified | `shared/pictures.ts` (toothbrush, shoes…); rooms `room-bank`, `room-pantry`, `room-academy`, `room-calendar`, `room-memories` in the spec above |
| 02.11 | Persistent short optional labels for emerging readers | built, not tested here | `settings.labels` (default on); `Label` in `src/wall/chrome/chrome.tsx` |
| 02.12 | Spoken instructions on tap; replay speaker | hardware-pending | `src/wall/speech.ts`, `say-again` button in `Frame.tsx`; voice on the display is DEVICE-CHECKLIST A7 |
| 02.13 | Caption alternatives | built, not tested here | Tock's words shown in an `aria-live` bubble (`Guide` in `chrome.tsx`) |
| 02.14 | High contrast | built, not tested here | `settings.contrast` → `data-contrast` (`src/wall/Wall.tsx`, `src/styles/tokens.css`) |
| 02.15 | Reduced-motion mode | verified | `e2e/motion.spec.ts`: `reduced motion: still, and nothing running after a second` |
| 02.16 | Never require sound to navigate | verified | The non-reader journey runs headless with no audio and passes |
| 02.17 | Profile picker with unique avatars and accessible names, not colours alone | verified | `e2e/non-reader.spec.ts` checks every face has an accessible name; `e2e/a11y.spec.ts`: `wall home and three rooms` |
| 02.18 | Guide demonstrates navigation on first visit, skippable | verified | `e2e/tour.spec.ts`: `appears on a fresh screen; the first tap on a face ends it and chooses that child; not again after a reload` |
| 02.19 | Tiles show status (filled basket, stars, next routine) | built, not tested here | `src/wall/home/Home.tsx` (`basketOf`, `starsOf`, `clockOf`, board cards) |
| 02.20 | Quiet idle transitions | built, not tested here | `src/wall/Wall.tsx`: home after `idleHomeSeconds` (90), photos after `slideshowAfterMinutes` (10) |
| 02.21 | Clear error/offline states | verified | `e2e/offline.spec.ts` asserts the "out of touch… kept" cloud |
| 02.22 | Tactile feedback | built, not tested here | `src/wall/sound.ts` tap sounds; pressed states in CSS |
| 02.23 | Gentle celebrations under 2 seconds | built, not tested here | `src/wall/Celebration.tsx` ends at 1.7 s; none in calm/still mode |
| 02.24 | No strobing, loud surprises, excessive particles, infinite feeds, compulsive streaks | built, not tested here | Inspected; streaks covered by 00.20 |
| 02.25 | Avoid scoring speed unless useful and opt-in | built, not tested here | Nothing records or shows speed (the stored timer is never shown, 04.12) |
| 02.26 | Neutral recovery from accidental taps; one-tap undo | verified | `quest.test.ts`: `lets a child take back an “I did it” for a little while, and puts the stars back where they were` |
| 02.27 | Polished art pipeline: layered vector motion, skeletal animation or light 3D | deviation | DECISIONS §10: hand-written SVG and CSS only; no skeletal animation |
| 02.28 | Design system, motion tokens, sound palette, accessible components, illustration registry, asset licences | built, not tested here | `src/styles/tokens.css`, `src/wall/sound.ts`, `shared/pictures.ts`; inspected `docs/ASSETS.md` (fonts SIL OFL, drawings original) and `docs/ART_DIRECTION.md` |
| 02.29 | Parent-configurable voice, mute, theme, seasonal decor | built, not tested here | `shared/settings.ts` (`voice`, `sounds`, `contrast`, `decor`); `src/parent/pages/Settings.tsx` |
| 02.30 | Parent-configurable quiet hours and calm mode | verified | `e2e/motion.spec.ts`: `calm mode, switched on by a parent, makes the wall still within a few seconds`; `in quiet hours the wall is dimmed and still` |
| 02.31 | Do not send child voice to the cloud | verified | No microphone use anywhere in `src/` (searched); `Permissions-Policy: microphone=()` checked by `deploy-config.test.ts`: `sends every page with the same security headers the standalone server sends` |
| 02.32 | Screenshots at 4K, scaled landscape, portrait, iPhone | verified | Inspected `docs/review/screens/` (61 images): `wall-home-4k.jpg` and `wall-quest-4k.jpg` (3840×2160), `wall-home-small.jpg` (1280×720), `wall-home-tall.jpg` (upright tablet), `wall-home-phone.jpg`, `parent-today.jpg` |
| 02.33 | Actual browser traces | not built | No traces exist: `trace: 'off'` in `playwright.config.ts` and `--trace off` in `npm run test:e2e`; CI uploads the HTML report only on failure (`ci.yml`), which with tracing off holds no traces |
| 02.34 | Measure frame time and memory | simulated | `npm run measure` (`scripts/measure-wall.ts`), output in `docs/TEST_RESULTS.md` "The wall, measured": headless Chromium, no graphics card |
| 02.35 | Fall back to static art | verified | `tests/client/derive.test.ts`: `gives up the ambient movement on a display that cannot manage thirty`; `motion.spec.ts` |
| 02.36 | Acceptance: non-reader selects profile, finds chores, sees balance, enters Academy, returns, requests a reward, after one demonstration | simulated | A headless browser plays the child (`non-reader.spec.ts`, R2); no real child has tried it (14.10) |

## 03 — Identity, household model and sync

| # | Requirement | Status | Where / evidence |
| --- | --- | --- | --- |
| 03.1 | Accounts for two or more guardians; invite flow; membership | verified | `identity.test.ts`: `joins with a one-use code, and the code cannot be used again`; `e2e/auth.spec.ts` |
| 03.2 | Device registration by expiring one-use code or QR | verified | `identity.test.ts`: `does nothing for a stranger, a wrong secret, a used code or a code that ran out`; `e2e/pairing.spec.ts` |
| 03.3 | Revocation | verified | `identity.test.ts`: `turns an unpaired screen into a stranger from its next request`; `pairing.spec.ts` |
| 03.4 | Child profiles accessible by avatar | verified | `e2e/non-reader.spec.ts` |
| 03.5 | Adult actions need a signed-in phone or rate-limited PIN on the wall, with inactivity relock | verified | `identity.test.ts`: `opens the wall for a while and then shuts it, by the server’s clock`; `shuts the door after five wrong PINs, even to the right one, and notes it` |
| 03.6 | Permissions enforced server-side; a child route is not security | verified | `isolation.test.ts` (title in 00.27) |
| 03.7 | Separate permissions: child mode, wall device, guardian, optional guest | verified | `ACCESS_LEVELS` in `shared/model.ts`; `ai.test.ts`: `lets a helper see "how long until…?" but not run, apply or look at drafts`; `shortcuts.test.ts`: `are each person’s own…` |
| 03.8 | Child profile changes cannot enable privileged operations | verified | `isolation.test.ts`: `does not let a request that was refused while locked go through later when a grown-up unlocks` |
| 03.9 | Recovery/reset without losing household records | verified | `identity.test.ts`: `lets a grown-up back in with a recovery code, once` |
| 03.10 | Typed model: households … provider connections, media, activity events, audit | verified | `server/db/schema.ts` (all listed tables; `connections` unused); `shared/model.ts` |
| 03.11 | Profiles hold nickname, avatar, age band only | built, not tested here | `profiles` table in `schema.ts` |
| 03.12 | Household scoping and RLS for every query | verified | `isolation.test.ts`: `are kept apart by the database itself, whatever the query asks for` |
| 03.13 | Unique op keys, optimistic version checks, FKs, integer XP, local dates, tombstones | verified | `quest.test.ts`: `tells the second of two parents editing at once that the first got there`; `gives the stars once, however many times “I did it” is tapped or sent` |
| 03.14 | DST and recurrence changes without duplicate XP or rewriting history | verified | `quest.test.ts`: `hands out one day’s missions for each calendar day through a spring-forward and a fall-back`; `changes today’s untouched copies and leaves what was already done as it was` |
| 03.15 | Event outbox and idempotent endpoints | verified | `store.test.ts` (title in 01.12); op ids remembered 30 days (`server/ops/run.ts`) |
| 03.16 | Document conflict behaviour by entity | verified | Inspected ARCHITECTURE §7 |
| 03.17 | Show syncing/pending/offline on wall and parent screens | verified | Wall: `offline.spec.ts`; parent: `state` in `src/parent/Parent.tsx` (not separately tested) |
| 03.18 | Cache minimum; encrypted storage when feasible | deviation | DECISIONS §23: cache holds only the child-visible snapshot and outbox, unencrypted |
| 03.19 | Purge cache on revoke and sign-out | verified | `store.test.ts`: `forgets everything the moment the server says this screen is a stranger` |
| 03.20 | Tests: isolation, replay, expired code, concurrent redemption, profile switching, offline queue | verified | `isolation.test.ts`, `quest.test.ts`, `identity.test.ts`, `bank.test.ts`: `cannot spend the same stars twice, whatever arrives at once`, `store.test.ts` |
| 03.21 | Test backup/restore | verified | `tests/server/backup.test.ts`: `restores a household whole from a pg_dump: the same people, stars, record and list, and it carries on` — run for this audit against local PostgreSQL (passed); skipped under plain `npx vitest run` |
| 03.22 | Test migrations | verified | Every server test applies all migrations to an empty database; `npm run test:pg` on PostgreSQL 16 in CI (CI runs on GitHub not checked) |
| 03.23 | Test accessibility | verified | `e2e/a11y.spec.ts` (axe, WCAG 2.1 AA, serious/critical fail) |
| 03.24 | API/schema documentation and synthetic fixtures | verified | Inspected `docs/API.md`, ARCHITECTURE §5; `demo.test.ts`: `has stars that add up from its own record, line by line` |

## 04 — QUEST

| # | Requirement | Status | Where / evidence |
| --- | --- | --- | --- |
| 04.1 | Animated mission board for each child | verified | `e2e/non-reader.spec.ts` step 2 |
| 04.2 | Templates: picture, spoken phrase, schedule, effort, XP, verification, shared/individual, skip behaviour | verified | `TaskFields` in `shared/ops.ts`; `quest.test.ts`: `makes one mission for the family when it is shared, done by whoever does it`; `MissionEditor.tsx` |
| 04.3 | Template age band | not built | Templates have no age band; missions are assigned to named children (`assignees`). Undocumented |
| 04.4 | Template order | verified | `quest.test.ts`: `puts missions in the order a parent chooses, on today’s board at once`; arrows in `Plan.tsx` send `task.reorder`; reducer in `src/sync/optimistic.ts` |
| 04.5 | Examples: blocks away, shoes in basket, set table, brush teeth with adult, laundry | verified | Pictures `blocks`, `shoes`, `table`, `toothbrush`, `laundry` (`pictures.test.tsx`); demo missions in `seed.ts` |
| 04.6 | No dangerous tasks; guardian review for every custom template | verified | `tests/shared/safety.test.ts`: `notices heat, blades, chemicals, heights, water, traffic and fire`; only guardians may `task.create` |
| 04.7 | Daily, weekdays, weekly, one-off, flexible, paused, vacation | verified | `quest.test.ts`: `follows the schedule: weekdays, one day a week, once, and not on holiday`; `offers a flexible mission until it has been done often enough this week`; `takes a paused mission off today’s board and brings it back` |
| 04.8 | Occurrences in household timezone; no automatic backfill | verified | `quest.test.ts`: `does not hand out the days nobody opened the wall` |
| 04.9 | A handful of immediately relevant missions | built, not tested here | `quest.showAtOnce` (default 5) in `src/wall/scenes/Quest.tsx` |
| 04.10 | Tap a picture → brief demonstration → large completion button | verified | `e2e/non-reader.spec.ts`: "the picture shows the doing", exactly one `did-it` |
| 04.11 | Optional multi-step visual checklist | built, not tested here | `steps` in `Quest.tsx` (ticks are not saved) |
| 04.12 | Timer, never presented as pressure | verified | `tests/client/timer.test.tsx`: `waits to be started, runs with no numbers, and says once when the time is up`; `GentleTimer` in `Quest.tsx` mission sheet |
| 04.13 | Adult-help indicator, repeat instruction, undo, request help | verified | `needsAdult` badge, `say-again`, `quest.test.ts` (undo), `badges.test.ts`: `thanks a child for asking for a hand, the third time` |
| 04.14 | States: available → in progress → submitted → approved/credited; returned; skipped | verified | `quest.test.ts`: `waits for a grown-up where the family wants that…`; `sends a mission back with kind words and takes nothing away` |
| 04.15 | Auto-credit according to parent rules | verified | `quest.test.ts`: `holds stars for a grown-up once the day’s unchecked limit is reached` |
| 04.16 | Approve in batch | built, not tested here | `src/parent/pages/Today.tsx` sends every waiting id in one `occurrence.approve` (server accepts up to 50); no test sends more than one |
| 04.17 | Mark done on behalf | verified | `quest.test.ts`: `lets a grown-up mark a mission done for a child, and not for someone else’s mission` |
| 04.18 | Edit future tasks | verified | `quest.test.ts` (title in 03.14) |
| 04.19 | Snooze | built, not tested here | `occurrence.snooze` in `quest.ts`, button in `Today.tsx`; no test |
| 04.20 | Correct credit with reversal | verified | `occurrence.reverse` exercised in `quest.test.ts`: `lets a child take back an “I did it”…` (ledger shows grant/correction pairs) |
| 04.21 | View pending | verified | `e2e/approval.spec.ts`: `Yes: the wall shows it done and the stars go up by exactly the mission’s stars, once` |
| 04.22 | Separate mandatory household routines from optional bonus missions | built, not tested here | Plan page separates them; the wall marks bonus cards with a ribbon (`data-kind`, `.extra` in `Quest.tsx`/`Quest.module.css`) and "(an extra)" in the accessible name. No test |
| 04.23 | Friendly celebration | verified | `derive.test.ts`: `cheers when a grown-up says yes to a waiting mission — for that child only` |
| 04.24 | Collectible non-monetary badges | verified | `badges.test.ts`: `gives the first star its badge, once, to the child who earned it` |
| 04.25 | Lifetime level and progress to goals | verified | `tests/shared/badges.test.ts`: `counts stars ever earned, a step at a time`; level rosette in `Bank.tsx` |
| 04.26 | No leaderboard, comparison, shame, forced streaks or XP loss for non-completion | verified | `quest.test.ts` (00.23); `badges.test.ts` (00.20) |
| 04.27 | Spendable XP exactly once per occurrence, through taps, retries, reconnect | verified | `quest.test.ts` (03.13); `offline.spec.ts` ("one line in the record of stars, not two") |
| 04.28 | Record template version, child, timestamps, actor, approval, credit reference | built, not tested here | `task_occurrences.template_version`, ledger keys `task:<id>:credit:n` (`schema.ts`, `ledger.ts`) |
| 04.29 | Illustrated templates for a realistic starter household | verified | `MissionIdeas` in `MissionEditor.tsx`; demo household (`demo.test.ts`) |
| 04.30 | Tests: duplicate/simultaneous approval, offline, template edits, skipped, override, non-reader, isolation | verified | `quest.test.ts`: `…approving twice or on two phones is one yes`; `keeps one child’s missions out of another child’s hands`; `offline.spec.ts`; `non-reader.spec.ts` |

## 05 — BANK

| # | Requirement | Status | Where / evidence |
| --- | --- | --- | --- |
| 05.1 | One authoritative ledger for QUEST and ACADEMY | verified | `bank.test.ts`: `can be worked out again from its lines, after everything that can happen has happened`; `academy.test.ts`: `scales spendable stars by the household’s rate, the same way a mission does` |
| 05.2 | Lifetime never decreases from spending; separate spendable | verified | `bank.test.ts` (00.25) |
| 05.3 | Parent sets earning rate; default 1:1 | verified | `bank.spendRatePercent` default 100; `academy.test.ts` (05.1) |
| 05.4 | Parent sets reward prices | verified | `bank.test.ts`: `shows a changed price again instead of charging it` |
| 05.5 | Immutable, auditable transactions with references and idempotency keys | verified | `isolation.test.ts`: `keeps accounts, sessions and codes out of reach…` (UPDATE/DELETE on ledger refused); `bank.test.ts`: `gives a bonus once however often the same request arrives` |
| 05.6 | Corrections explicit and transparent | verified | `bank.test.ts`: `refuses a correction that would leave fewer than no stars, and says a correction must change something` |
| 05.7 | Integer arithmetic, locking, no overdraft, server balances, pending vs available | verified | `bank.test.ts` (03.20) |
| 05.8 | Configurable limits, deterministic rules | verified | `quest.dailyAutoCreditCap` (04.15) |
| 05.9 | Not real money or external purchases | built, not tested here | Inspected: stars only |
| 05.10 | Piggy bank; balance as visual groups of stars; numbers optional | verified | `e2e/non-reader.spec.ts`: "one star picture for each star"; `showNumbers` per child |
| 05.11 | Goal progress | verified | `bank.test.ts`: `remembers what a child is saving for until they ask for it` |
| 05.12 | Reward shop with picture cards and read-aloud descriptions | verified | `e2e/non-reader.spec.ts` step 7; `say` on each reward |
| 05.13 | Examples: family game, story, outing, toy | built, not tested here | `REWARD_PICTURES` in `shared/pictures.ts` (`game`, `storypick`, `outing`, `toy`…) |
| 05.14 | Select, see cost as tokens, confirm, get pending status | verified | `e2e/rewards.spec.ts`: `asked for, said yes to, done — and a second one declined gives the stars straight back` |
| 05.15 | Approve/decline neutrally, fulfil, refund, archive, adjust price, limited stock | verified | `bank.test.ts`: `gives the stars back when the answer is “not this time”, with neutral words`; `refunds a reward that will not happen after all`; `refuses what is paused, sold out, or not for this child` |
| 05.16 | Reserve per documented state machine; rejection releases | verified | `bank.test.ts`: `sets the stars aside at once, and a grown-up’s yes spends them` |
| 05.17 | Prevent double spends and stale-price surprise | verified | `bank.test.ts`: `answers once when two parents answer at the same moment — even differently` |
| 05.18 | Affordability and savings understandable without arithmetic | verified | `non-reader.spec.ts` picks a reward with `data-can="true"`; goal shown as filled stars |
| 05.19 | Never make basic needs contingent on points | verified | As 00.26 (`a second look at a reward`) |
| 05.20 | Cooperative family quests opt-in, no sibling pressure | verified | Shared missions: `quest.test.ts` (04.2) |
| 05.21 | Savings jars, "how close" guidance | verified | One goal per child (`goal.set`, 05.11); several jars not built |
| 05.22 | Earned/spent history | verified | Parents: `history.test.ts`: `shows a child’s star lines, and the totals agree with them`. No child-facing history |
| 05.23 | Parent-created bonuses | verified | `bank.test.ts` (05.5) |
| 05.24 | Weekly allowance-like stars | verified | `bank.test.ts`: `gives the weekly stars once on their day, however many screens wake up` |
| 05.25 | Analytics of earned/spent/fulfilled | verified | `history.test.ts`: `counts what was handed out and what was done, week by week`; "Stars in and out" chart |
| 05.26 | Fairness by effort and age without ranking | verified | `tests/shared/plan.test.ts`: `says the plan is uneven only when the same effort is worth half as much again to one child`; shown on Plan → Missions, "What the plan asks of each child" (`shared/plan.ts`). About the plan, not children's results; age is shown, not analysed separately |
| 05.27 | Tests: concurrent redemption, refunds, repeated provider events, price change, child role, disabled reward, audit reconstruction | verified | `bank.test.ts` titles above; `academy.test.ts`: `adds nothing and gives nothing more when the same file comes again`; `bank.test.ts`: `is not something a child’s screen or a helper can write to` |
| 05.28 | Test: offline reward request | built, not tested here | Goes through the generic outbox (tested for missions only) |

## 06 — ROUTINES

| # | Requirement | Status | Where / evidence |
| --- | --- | --- | --- |
| 06.1 | Visual routine builder and runner | verified | `routines.test.ts`: `goes step by step, at the child’s own speed, and knows when it is finished`; `RoutineEditor.tsx` |
| 06.2 | Initial templates: morning, bedtime, leaving, after daycare, cleanup, trip | built, not tested here | Starting points in `RoutineEditor.tsx` ("After school" stands for after daycare) |
| 06.3 | Versioned steps: picture, animation, spoken cue, duration, help flag | verified | `routines.test.ts`: `carries on with the steps it began with when a parent edits the routine half-way` |
| 06.4 | Optional branching | not built | Steps can be optional or day-specific; no branches. Undocumented |
| 06.5 | Optional link to a QUEST occurrence | verified | `routines.test.ts`: `gives the mission’s stars once, whether the step or the mission is tapped first, or both` |
| 06.6 | Create, reorder, schedule, clone, pause from iPhone | verified | `routines.test.ts`: `copies a routine with steps of its own, and pauses one without losing it`; arrows in `RoutineEditor.tsx` |
| 06.7 | Quiet hours, day-of-week variations, shared steps, gentle reminders | built, not tested here | Day variations tested (`shows only the steps that belong to the day`); reminders are only the day clock's "next" picture (`clockOf` in `src/wall/derive.ts`) — no active reminder |
| 06.8 | No mandatory countdown or punitive timer | built, not tested here | No countdown anywhere on the wall (searched) |
| 06.9 | "Now / next / finished" unmistakable | built, not tested here | `step-now`, next, `routine-finished` in `src/wall/scenes/Routines.tsx`; no browser test opens a routine |
| 06.10 | Tap next, repeat, ask for help | verified | `routines.test.ts`: `counts a tap once, lets a tap be taken back, and records help without judging it` |
| 06.11 | Skip with parent-configurable policy | verified | `routines.test.ts`: `lets a grown-up say “we did that together”, and only a grown-up leave a firm step out` |
| 06.12 | Resume a suspended routine | verified | `routines.test.ts`: `is one go per child per day, whichever screen opens it, and can be left and come back to` |
| 06.13 | Minimise screen dependence | built, not tested here | One tap per real-world step |
| 06.14 | Example steps illustrated as actions | verified | `wake`, `dress`, `toothbrush`, `breakfast`, `shoes`, `backpack`, `pajamas`, `story`, `lightsout` (`pictures.test.tsx`) |
| 06.15 | Parent marks steps done together | verified | `routines.test.ts` (06.11) |
| 06.16 | Record run/step start, end, completion, help, skip coarsely; no camera | verified | `routines.test.ts` (06.10); events in `server/domain/routines.ts` |
| 06.17 | One canonical occurrence/credit reference | verified | 06.5 |
| 06.18 | No XP for basic needs by default; optional family rule | verified | `routines.test.ts`: `gives nothing for the routine itself unless the family has decided it should` |
| 06.19 | History shows where routines need assistance (non-clinical) | built, not tested here | "Routines" section of `src/parent/pages/History.tsx` (alone / together / left out) |
| 06.20 | History shows where routines take longer | not built | Minutes are stored in the completion event and never reported. Undocumented |
| 06.21 | Tests: schedule variants, DST, interrupted run, edit while active, two devices, duplicate XP | verified | `routines.test.ts` titles above. **DST for routines is not tested** (missions only) |

## 07 — Training Academy

| # | Requirement | Status | Where / evidence |
| --- | --- | --- | --- |
| 07.1 | Inspect the Academy repository and its docs | verified | 00.8 |
| 07.2 | Do not assume the deployed URL; owner configures it | account-pending | Parent sets the address (`AcademyPage.tsx`); the allow-list defaults to one host (`DEFAULT_ACADEMY_HOSTS` in `shared/settings.ts`), to be confirmed by the owner (DEVICE-CHECKLIST G1) |
| 07.3 | Prominent animated schoolhouse/boat tile | verified | `room-academy` in `non-reader.spec.ts` |
| 07.4 | Parent-configurable allow-listed HTTPS URL | verified | `isolation.test.ts`: `will not let settings be bent into something else` |
| 07.5 | One-tap launch | verified | `non-reader.spec.ts` step 6 (`sail-button`) |
| 07.6 | Predictable return without Android settings or browser navigation | not possible | A web page cannot put a way home inside another site; return is the back gesture or a kiosk app (DECISIONS §12; DEVICE-CHECKLIST G3) |
| 07.7 | Top-level navigation preferred; iframe only if genuinely supported | verified | `window.location.assign` in `Academy.tsx`; the Academy sends `X-Frame-Options: DENY` (ACADEMY.md) |
| 07.8 | No session tokens in query strings | verified | `non-reader.spec.ts` asserts the request is exactly the configured address; `checkAcademyUrl` refuses queries |
| 07.9 | Preserve Academy's local mode and standalone deployment | built, not tested here | Nothing in this repo changes it |
| 07.10 | Phase B live progress adapter (optional, with permission) | not built | Documented as a proposal: ACADEMY.md "Phase B" |
| 07.11 | Parent-mediated export/import fallback; explicit deletion and disconnect | verified | `academy.test.ts`: `links the child, keeps a total per sitting, and gives no stars unless asked to`; `deletes the link and the sittings, and leaves every star where it is` |
| 07.12 | If launch-only, show no fake progress | built, not tested here | Summary shown only for imported sittings (`AcademyPage.tsx`) |
| 07.13 | Reward participation, not speed/correctness; capped; no duplicates; progress separate from grants | verified | `academy.test.ts`: `keeps to the daily limit across imports`; `keeps but never pays for sittings dated in the future or long ago, or left unfinished` |
| 07.14 | Child can play without linking or earning | built, not tested here | The boat needs only the address and the switch |
| 07.15 | Parent sees practice areas and supported vs independent | verified | `academy.test.ts`: `sums each island over the weeks asked for, with what each number is out of` |
| 07.16 | No new tracking by default | verified | `academy.participation.enabled` default false; `academy.test.ts`: `gives nothing while stars are off…` |
| 07.17 | Test: start and return | verified | Start: `non-reader.spec.ts`. Return: see 07.6 |
| 07.18 | Test: URL misconfiguration, replay | verified | 07.4; `academy.test.ts` (05.27) |
| 07.19 | Test: offline behaviour and disabled integration | built, not tested here | "Boat is resting" branch in `Academy.tsx`; the boat does not check for a signal before sailing |
| 07.20 | Test: origin spoofing | not built | Nothing to spoof: no `postMessage` listener or bridge exists (searched) — would arrive with Phase B |

## 08 — FAMILY CALENDAR

| # | Requirement | Status | Where / evidence |
| --- | --- | --- | --- |
| 08.1 | Native Calendar Mode as the calendar; parents' shared iCloud calendars | hardware-pending | DEVICE-CHECKLIST E1, E2 |
| 08.2 | Distinguish iCloud vs Outlook events; test the actual account | account-pending | Needs the parents' real accounts; DEVICE-CHECKLIST E2–E3 |
| 08.3 | Do not assume Outlook write-back | verified | Inspected DEVICE-CHECKLIST E2 and PROVIDER-FACTS §1 (Outlook one-way) |
| 08.4 | Verify current Apolosign documentation | verified | Inspected PROVIDER-FACTS §1 |
| 08.5 | Animated calendar door with launch/switch instructions | built, not tested here | `src/wall/scenes/Calendar.tsx` (week of day pictures + how to reach Calendar Mode); room reached in `non-reader.spec.ts` |
| 08.6 | Documented deep link if it exists; otherwise one clear manual switch; no fabricated intents | not possible | No intent or deep link is documented (PROVIDER-FACTS §1); manual route is DEVICE-CHECKLIST E4 |
| 08.7 | Native Android companion only if justified | not built | Not justified or proposed; no document discusses it directly |
| 08.8 | Test on the device; fallback in a browser-only demo | hardware-pending | Fallback text built (`Calendar.tsx`); device: E4 |
| 08.9 | Adult event visibility controls | built, not tested here | Children see only day pictures a parent sets (`calendar.setDay`, `CalendarDays.tsx`); no test |
| 08.10 | Optional read-only glance adapter (CalDAV, Graph, Google) | not built | Documented: DECISIONS §13; INTEGRATIONS "Calendar glance" |
| 08.11 | Optional writes with proven bidirectionality | not built | Optional; follows 08.10 |
| 08.12 | No credentials in client logs; no production calendar data on previews | built, not tested here | HOMEBASE holds no calendar data or credentials at all |
| 08.13 | Only parent-approved coarse labels in the child view | built, not tested here | `DAY_PICTURE_IDS` only (`shared/pictures.ts`); `calendar.rule.*` stored but "not applied by anything yet" (API.md) |
| 08.14 | Connection checklist for both parents | hardware-pending | Written: DEVICE-CHECKLIST E1–E5; not yet carried out |
| 08.15 | Test matrix: create/edit/delete on each device | hardware-pending | DEVICE-CHECKLIST E3 |
| 08.16 | Native-vs-custom limitations, failure recovery, logout/revocation | built, not tested here | INTEGRATIONS, PARENT-GUIDE "The calendar and photos" |
| 08.17 | Native calendar usable when HOMEBASE is offline | hardware-pending | DEVICE-CHECKLIST E5 |

## 09 — MEMORIES

| # | Requirement | Status | Where / evidence |
| --- | --- | --- | --- |
| 09.1 | Native Google Photos screensaver: album, orientation, fill/fit, idle, sleep, brightness | hardware-pending | DEVICE-CHECKLIST F1, F2, C4 |
| 09.2 | Does the screensaver start over the browser/kiosk, wake to HOMEBASE, conflict with lock/power settings | hardware-pending | DEVICE-CHECKLIST C2, C3, C4, F4 |
| 09.3 | 4K output, quality, cropping, album updates, sleep/wake | hardware-pending | DEVICE-CHECKLIST F2 |
| 09.4 | Do not assume videos are supported | hardware-pending | DEVICE-CHECKLIST F3 |
| 09.5 | No undocumented native photo API | verified | Inspected: none in the code |
| 09.6 | Memories tile and in-app idle slideshow from parent-selected media | verified | `non-reader.spec.ts` (00.32); `media.test.ts`: `shows the wall only what the slideshow shows` |
| 09.7 | 4K-capable responsive image sizes | verified | `media.test.ts`: `stores copies and serves the nearest width`; `tests/client/photos.test.ts`: `makes the usual three of a large photo, largest first` (the wall picks a width; no `srcset` attribute) |
| 09.8 | Modest prefetch | built, not tested here | Next photo preloaded in `src/wall/scenes/Memories.tsx` |
| 09.9 | Correct aspect ratio and orientation | built, not tested here | `createImageBitmap(…, { imageOrientation: 'from-image' })` in `src/lib/photos.ts`; fit cover/contain |
| 09.10 | Face-safe crop only if the user chooses | not built | No face crop of any kind (cover/contain only). Undocumented |
| 09.11 | Gentle crossfade, clock overlay, tap to return | verified | Tap: `non-reader.spec.ts`; fade and clock in `Memories.tsx` |
| 09.12 | Quiet hours / night dimming | verified | `motion.spec.ts`: `in quiet hours the wall is dimmed and still` |
| 09.13 | Cache budget | not built | No device-side budget; photos are cached by the browser as `immutable` for a year (THREAT-MODEL row 11). The 200 MB quota is server storage. Undocumented |
| 09.14 | No external autoplay | built, not tested here | Only `/api/media/…` images; CSP `img-src 'self' data: blob:` |
| 09.15 | Custom Google Photos via the Picker API | not built | Documented: DECISIONS §14, INTEGRATIONS "Google Photos Picker import" |
| 09.16 | No promise of full-library/album sync; no scraping | verified | Inspected DECISIONS §14, INTEGRATIONS |
| 09.17 | Media stored privately with controlled access | verified | `media.test.ts`: `never shows one household’s photo to another`; `sends a copy with headers that keep it a picture, kept privately` |
| 09.18 | No auto-upload, face recognition, biometrics, third-party AI photo access | verified | `media.test.ts`: `lets only a parent add photos — not the wall, not a helper`; AI never receives photos (`ai.test.ts`, 00.30) |
| 09.19 | Exclude/remove photos, slideshow off for visitors, delete imports | verified | `media.test.ts`: `keeps to the household’s photo space, and removing a photo frees it`; `memories.hidden` setting |
| 09.20 | No photos or personal metadata in Git, logs, analytics, previews | built, not tested here | Phone re-encodes (drops EXIF) in `src/lib/photos.ts` — untested, and the server does not check (THREAT-MODEL row 11); no analytics; logs scrubbed (`log.test.ts`) |

## 10 — TO BUY

| # | Requirement | Status | Where / evidence |
| --- | --- | --- | --- |
| 10.1 | Realtime household list, authoritative in HOMEBASE | verified | `shopping.test.ts`: `shows a thing added on one phone on the other and on the wall` |
| 10.2 | Parents use iPhone Safari/PWA and the wall | verified | `e2e/shopping.spec.ts`: `two phones and the wall keep one list; a child asks by picture and a grown-up says yes` (Chromium at phone size) |
| 10.3 | Multiple lists | verified | `list.create` in `suggestions.test.ts`: `is for one list only, and for grown-ups only` |
| 10.4 | Categories / store | built, not tested here | `category`, `store`, grouping by aisle or store in `Lists.tsx` |
| 10.5 | Free text, quantities, units | verified | `shopping.spec.ts` ("2 × milk"); `shopping.test.ts`: `takes the amount just said when something already wanted is added again…` |
| 10.6 | Optional images | built, not tested here | A picture from the bundled set only (`SHOPPING_PICTURE_IDS`); no item photos |
| 10.7 | Priority | built, not tested here | `priority` field in `shared/ops.ts`, `Lists.tsx` |
| 10.8 | Checked/purchased, undo, archive, recently purchased | verified | `shopping.test.ts` (00.29); bought tray in `shopping.spec.ts` |
| 10.9 | Favourites | not built | No favourites anywhere (searched). Undocumented |
| 10.10 | Recurring suggestions | verified | `suggestions.test.ts`: `suggests what was bought at least twice, most often first, and survives the tidy` |
| 10.11 | Large visual pantry tile on the wall | verified | `room-pantry` in `non-reader.spec.ts`; `shopping.spec.ts` |
| 10.12 | Child requests items as pictures with guardian approval; buys nothing | verified | `shopping.test.ts`: `puts a picture on the list for a grown-up to answer, and buys nothing`; `cannot type: a child’s request is a picture from the list of pictures and nothing else` |
| 10.13 | Adult quick-add by keyboard/dictation | verified | `shopping.spec.ts` typing; dictation is the phone keyboard's own |
| 10.14 | Multiline paste | verified | `shopping.spec.ts` ("Added 3 things") |
| 10.15 | URL/product link, sanitised, no auto-purchase | verified | `shopping.test.ts`: `keeps a link only if it is an ordinary web address with nothing hidden in it` |
| 10.16 | Optional voice on explicit tap | not built | No in-app voice input (by design no microphone, DECISIONS §11); Siri works through the Shortcut (10.23). Not stated as a gap |
| 10.17 | Item provenance, edit history, revisions | verified | `shopping.test.ts` (00.29); `shopping_item_history` |
| 10.18 | Two parents editing simultaneously converge, incl. offline additions | verified | `shopping.test.ts`: `keeps both changes when two phones edit different things about one item`; `adds a queued item once when a phone that was offline sends its queue twice` |
| 10.19 | Groceries vs general lists, filters, grouping | built, not tested here | `kind: 'groceries' \| 'general'`; grouping in `Lists.tsx` (no filters beyond grouping) |
| 10.20 | Shareable text and export | built, not tested here | `share-list` (`navigator.share`, else clipboard) in `Lists.tsx`; lists in the JSON export |
| 10.21 | Lists never public | verified | `isolation.test.ts`: `cannot see or touch anything of each other’s, by any request` |
| 10.22 | PWA home screen; authenticated mobile deep link | verified | `deploy-config.test.ts`: `can be installed…`; manifest shortcut `/parent/lists`; `shopping.spec.ts` lands on `/parent/lists/<id>` |
| 10.23 | Shortcuts endpoint: narrow, revocable, device-specific secret | verified | `shortcuts.test.ts`: `is not a session: nothing else in the API accepts the key`; `are made, listed by name (never the key), and taken back` |
| 10.24 | Sample Shortcut for Siri/share sheet; export to Notes/Reminders via share | hardware-pending | Written: `docs/integrations/SHORTCUTS.md`; building it on a real iPhone not done |
| 10.25 | Do not promise iOS share-target | verified | Inspected INTEGRATIONS "iOS share sheet target: not possible" |
| 10.26 | Two-way sync with an Apple Note | not possible | Apple Notes has no supported API (DECISIONS §15) |
| 10.27 | No scraping iCloud, reverse engineering Notes, storing Apple passwords | built, not tested here | Inspected: none |
| 10.28 | Optional EventKit companion for Reminders | not built | Documented: INTEGRATIONS "Apple Reminders: not built (possible)" |
| 10.29 | Document truly supported vs manual workflows | verified | Inspected SHORTCUTS.md "What HOMEBASE cannot do here, plainly" |
| 10.30 | Acceptance: phones and wall see added/checked/edited/deleted items promptly; duplicates and replay handled | verified | `shopping.spec.ts`; `shopping.test.ts`: `keeps one line when two people add the same thing, and says it was asked for again` |
| 10.31 | Expired/revoked token denied | verified | `shortcuts.test.ts`: `refuses a key that was taken back, or never was, in the same words` |
| 10.32 | Siri shortcut adds an item with confirmation | hardware-pending | Server side: `shortcuts.test.ts`: `adds what was said, as Siri on behalf of its owner, exactly as if typed`; on an iPhone: not tried |
| 10.33 | No shopping or orders performed automatically | verified | 10.12; links are never fetched (`shared/ops.ts`) |
| 10.34 | Optional AI categorisation and dedup suggestion, approved by a parent, original text kept | simulated | `ai-units.test.ts`: `never changes an item’s words, and refuses items that are not on the list` (fake provider) |

## 11 — PARENT STUDIO and history

| # | Requirement | Status | Where / evidence |
| --- | --- | --- | --- |
| 11.1 | Mobile-first adult console: settings, profiles, task/routine designer, rewards, approvals, academy, lists, devices, exports, deletion, AI | verified | `e2e/layouts.spec.ts`: `no grown-ups’ page scrolls sideways on a phone` (20 pages); `a11y.spec.ts`: `Today, To buy, Plan with the mission editor, History, Family and a settings page` |
| 11.2 | Integrations status and device logs | built, not tested here | One-line state per integration on the Family page (`More.tsx`); Sky page notes a stale weather reading; Helper page shows provider, model and spend (`/ai/status`); last seen per screen (`Screens.tsx`); audit list on Records. No test |
| 11.3 | Wall parent mode locked and easy to exit | verified | `identity.test.ts` (03.5); `src/wall/scenes/GrownUps.tsx` |
| 11.4 | Adult views text/tables; child views picture-led | verified | 00.18; parent pages |
| 11.5 | History (a): occurrences, completion, approval, skip, effort | verified | `history.test.ts`: `counts what was handed out and what was done, week by week` |
| 11.6 | History (b): routine steps, assisted vs independent, coarse duration | built, not tested here | Assisted vs alone shown (06.19); duration not shown (06.20) |
| 11.7 | History (c): ledger, redemptions, fulfilment, refunds | verified | `history.test.ts` (05.22) |
| 11.8 | History (d): Academy aggregates only with consent | verified | `academy.test.ts`: `needs a parent’s yes` |
| 11.9 | History (e): purchases and recurring items | verified | `suggestions.test.ts` (10.10) |
| 11.10 | History (f): integration health, sync errors, device changes | not built | Device pair/revoke are audited; sync errors and integration health are not recorded. Undocumented |
| 11.11 | History (g) and timeline: parent-authored milestones/notes | verified | `history.test.ts`: `are kept for the grown-ups only, are in the export, and go when removed`; `does not let a moment be given to another family’s child`; `src/parent/pages/Moments.tsx` in History. (`history.forget` still has no screen and no test) |
| 11.12 | Avoid raw touches, mic/camera, locations, medical labels, child chat logs | verified | `isolation.test.ts`: `rounds a home’s position to the middle of its area, and tells a child’s wall no more than that`; inspected Records "What is kept" |
| 11.13 | Calendar and photo metadata minimal | built, not tested here | No calendar data; photos re-encoded on the phone (09.20) |
| 11.14 | Retention: 90 days detail, 12 months trends, configurable; ledger until profile deletion | built, not tested here | `history.detailDays`/`trendMonths` in `shared/settings.ts`; pruning in `server/domain/housekeeping.ts`; no test of pruning itself |
| 11.15 | Export JSON/CSV | verified | `history.test.ts`: `exports everything in one file, with no secret in it`; `writes the ledger as a spreadsheet that cannot run a formula` |
| 11.16 | Delete a child profile and associated data | verified | `history.test.ts`: `deletes a child and every record of them, only when the nickname is typed` |
| 11.17 | Pause history | built, not tested here | `history.paused` checked in `server/domain/context.ts`; switch on Records |
| 11.18 | Correct records | verified | `ledger.correct` (05.6); `Children.tsx` "Put a mistake right" |
| 11.19 | Remove integrations | verified | `academy.test.ts` (07.11); Shortcut keys (10.23) |
| 11.20 | Weekly family recap | verified | "This week" in `History.tsx`, data from `history.test.ts` (11.5) |
| 11.21 | Charts: help needed, XP in/out, time since purchase, category practice | built, not tested here | `History.tsx` (help meters, stars in/out, "Bought again and again"); islands table in `AcademyPage.tsx` |
| 11.22 | Charts: routine completion by time of day; reward goal progress | built, not tested here | Reward goal progress: "Saving up" in `src/parent/pages/History.tsx` (each child's chosen reward against the stars they have). Routines by time of day: not built — time of day is for missions only (`server/domain/history.ts`); each routine's own completion is shown instead |
| 11.23 | Denominators, missing-data flags, observation vs inference, no rankings or diagnoses | verified | `demo.test.ts`: `has eight weeks to look back on, each with what it was out of`; "nothing kept" weeks and wording in `History.tsx` |
| 11.24 | Comparisons within one individual over time only | built, not tested here | `History.tsx` |
| 11.25 | Tests: data minimisation, deletion cascades, export fidelity, ledger reconciliation, timezone, permissions | verified | `history.test.ts` titles above; `is closed to the wall`; `keeps another household out of all of it` |
| 11.26 | Bounded summary APIs, no unrestricted LLM access | verified | `history.test.ts`: `refuses a number of weeks it will not go back` |

## 12 — Optional AI copilot

| # | Requirement | Status | Where / evidence |
| --- | --- | --- | --- |
| 12.1 | Adult-facing, disabled by default, optional | verified | `ai.test.ts`: `is off by default: refused, and nothing leaves` |
| 12.2 | Provider abstraction for OpenAI or Anthropic; owner supplies API keys | simulated | `ai.test.ts`: `OpenAI: Responses API, bearer key, strict JSON schema, not stored, no tools` (fake HTTP) |
| 12.3 | Server-side Vercel AI SDK or provider integration | deviation | DECISIONS §18: plain HTTPS, no SDK |
| 12.4 | Model IDs configurable | built, not tested here | `HOMEBASE_AI_ANTHROPIC_MODEL`, `HOMEBASE_AI_OPENAI_MODEL` (`server/config.ts`) |
| 12.5 | Structured outputs validated with a schema | verified | `ai-units.test.ts`: `is null for a reply that is not even an object, and says "high" when unsure of the uncertainty` |
| 12.6 | Typed read-only tools; bounded context | verified | Context assembled by typed server code; the model gets no tools (`… no tools` tests in 12.2) |
| 12.7 | Low-cost default, per-request token cap, timeout, retry | verified | `ai.test.ts`: `tries once more after 429, then gives up cleanly`; `writes down what every attempt cost: success, provider error, bad JSON, wrong shape and time out` |
| 12.8 | Daily and monthly spend caps | verified | `ai.test.ts`: `stops a run before any request when today’s limit would be passed`; `sets a request’s dearest cost aside while it is away, so two together cannot pass the limit` |
| 12.9 | Kill switch | verified | `settings.ai.enabled`, missing key, `HOMEBASE_OFFLINE`; `ai.test.ts`: `says which key is missing when the server has none` |
| 12.10 | No exposed secrets; no child-facing chat | verified | 00.22 |
| 12.11 | Parent chooses categories; default anonymised; no names, photos, voice, calendar, notes | verified | `ai.test.ts`: `refuses a job whose data is not shared, and sends nothing`; `turns a child’s name in a parent’s sentence into a label, and back again for the draft` |
| 12.12 | Disclose provider, retention, cost, categories | built, not tested here | `src/parent/pages/Helper.tsx`; `docs/integrations/AI.md` |
| 12.13 | No raw prompts/responses unless opted in | verified | `ai.test.ts`: `keeps no prompt or reply unless asked to` |
| 12.14 | No claim of guaranteed zero retention | verified | Inspected AI.md "Provider terms and retention" |
| 12.15 | Routine Architect | simulated | `ai.test.ts`: `marks a hazardous step “with a grown-up”, flags it, and drops pictures that do not exist` |
| 12.16 | Schedule-aware mission planner | not built | Documented: AI.md "The brief's eight jobs" |
| 12.17 | Reward economist: deterministic simulation + explanation; never changes balances | verified | `ai.test.ts`: `is worked out with no model and no key, and is right on a small example`; `may be explained by the helper in words, which can change nothing` |
| 12.18 | Weekly reflection with denominators, refs, 1–2 experiments | simulated | `ai.test.ts`: `drafts a new mission from a weekly look back as checked by a grown-up, with sensible stars` |
| 12.19 | Learning bridge | not built | Documented (AI.md) |
| 12.20 | Shopping intelligence: categorise, normalise, duplicates; staples from history | not built | Tidy built and tested (10.34); "staples from history or event plan" not built — documented (AI.md "Built in part"). Counted under its missing part |
| 12.21 | Family briefing | not built | Documented (AI.md) |
| 12.22 | Story / illustration scripts | not built | Documented (AI.md) |
| 12.23 | Proposal envelope: type, evidence, rationale, uncertainty, changes, safety flags, cost | verified | `ai-units.test.ts`: `makes fresh ids, maps children back, drops unknown pictures and children, and flags hazards` |
| 12.24 | Parent previews, edits, accepts; deterministic validators | verified | `ai.test.ts`: `applies the ticked changes through the normal runner, once however often it is asked` (ticking, not free editing) |
| 12.25 | LLM cannot mutate ledger, approve, delete, buy, contact third parties | verified | `ai.test.ts`: `cannot turn an instruction hidden in the list into anything outside the allow-list` |
| 12.26 | Diff and confirmation; typed actions with audit/idempotency | verified | `ai-units.test.ts`: `uses the same operation id each time, and a different one per change` |
| 12.27 | Untrusted text isolated; no URL fetch, no external tools, no secrets in prompts | verified | `ai-units.test.ts`: `fences data so that it cannot close its own fence` |
| 12.28 | Tests: injection, invalid JSON, budget, missing key, outage, refusal of child chat | verified | Titles above. "Unsupported inference" and "partial data" have no test of their own |
| 12.29 | A real call to a provider | account-pending | Needs an API key; never run (AI.md "Verified / not verified") |

## 13 — Deployment, wall operation and reliability

| # | Requirement | Status | Where / evidence |
| --- | --- | --- | --- |
| 13.1 | Private production deployment, one project | account-pending | Nothing deployed; DEPLOYMENT.md |
| 13.2 | Document project settings, build, runtime, DB options, env var names, migrations, preview isolation, rollback, CI | verified | Inspected `docs/DEPLOYMENT.md`, `.env.example`, `.github/workflows/ci.yml` |
| 13.3 | Git integration deploys after review | account-pending | Needs the Vercel project |
| 13.4 | No secrets or private data in logs or repo | verified | `log.test.ts`: `keeps a real failed statement’s values out of the log line`; pattern search (R7) |
| 13.5 | Previews must not expose live data; app-level auth | account-pending | App-level auth verified (01.23); preview database separation is a host setting (ARCHITECTURE §8) |
| 13.6 | CSP | verified | `deploy-config.test.ts`: `lets nothing but the app itself be loaded, framed or posted to` |
| 13.7 | Strict allowed origins | verified | `identity.test.ts`: `refuses a change that arrives with the cookie but from another site` |
| 13.8 | Secure cookies | verified | `identity.test.ts`: `keeps the session cookie from scripts and other sites` (`Secure`/`__Host-` over https untested) |
| 13.9 | CSRF protection | verified | Origin / `Sec-Fetch-Site` check (13.7); no token (THREAT-MODEL row 4) |
| 13.10 | Rate limits | verified | `identity.test.ts`: `slows down guessing a password…`; `shortcuts.test.ts`: `is slowed down when used too often`; `media.test.ts`: `stops taking copies…`; `ai.test.ts`: `turns a run down after a few in a minute` |
| 13.11 | Request validation | verified | `isolation.test.ts`: `refuses a body that is not JSON, too many at once, or nothing` |
| 13.12 | Separate read/write provider credentials; revoke workflows | built, not tested here | No third-party credentials are stored (`seal()` unused); Shortcut keys revocable (10.31) |
| 13.13 | No service worker caching of auth responses or secrets | built, not tested here | `src/sw/sw.template.js` returns early for `/api`; `deploy-config.test.ts`: `keeps built files for good and never keeps the page or the service worker` covers headers only |
| 13.14 | Secure media access and lifecycle | verified | `media.test.ts` (09.17, 09.19) |
| 13.15 | Vercel-supported schedule; cost and alternatives documented | verified | 01.14; COSTS.md |
| 13.16 | Minimal health endpoint, no PII | verified | `identity.test.ts`: `answers the health check without saying anything about anybody` |
| 13.17 | Safe telemetry | built, not tested here | No analytics or error service (DECISIONS "Smaller choices") |
| 13.18 | Device facts: model, Android, Chrome/WebView, memory, resolution/DPR, touch, audio, Wi-Fi, launcher, kiosk | hardware-pending | `/studio/device` page (`src/app/Device.tsx`); DEVICE-CHECKLIST A4 table, B, C |
| 13.19 | Browser first, then PWA or Fully Kiosk; free vs licence | hardware-pending | DEVICE-CHECKLIST D1–D3, D-a |
| 13.20 | Startup URL, landscape, screen timeout, sleep, wake, quiet hours, crash recovery, guided return | hardware-pending | DEVICE-CHECKLIST C1–C6, D-b |
| 13.21 | Native calendar/photos and kiosk coexist; settings never locked out | hardware-pending | DEVICE-CHECKLIST D-c |
| 13.22 | No silent replacement of native home; no forced device admin | verified | Inspected: no kiosk or device-admin code; DEVICE-CHECKLIST D ("will not ask to be a device administrator") |
| 13.23 | Installable manifest and icons | verified | `deploy-config.test.ts`: `can be installed: a start address, a standalone window, and icons that exist` |
| 13.24 | Offline app shell, cached safe assets | verified | `e2e/offline.spec.ts`: `a reload with no signal at all still draws the house, with the mission still sent` (production build) |
| 13.25 | IndexedDB outbox | verified | `store.test.ts` (01.12) |
| 13.26 | Background Sync where supported | not built | No Background Sync API; foreground reconnect only. Undocumented |
| 13.27 | Foreground reconnect fallback | verified | `online`/`visibilitychange` wake in `src/sync/store.ts`; `offline.spec.ts` |
| 13.28 | Service worker versioning so queued data survives updates | built, not tested here | Versioned shell cache; outbox lives in IndexedDB, independent of the worker |
| 13.29 | Pause heavy motion when hidden | not built | Nothing pauses animation on `visibilitychange`; the browser's own throttling is relied on (`pace.ts` only skips judging). Undocumented |
| 13.30 | Avoid 4K overdraw; image decode budget; profiling | simulated | Self-chosen light motion (`derive.test.ts`: `is not fooled by a few slow frames among many good ones`); figures from `npm run measure`, headless |
| 13.31 | Thermal/long-running tests; 24-hour soak or mark not run | hardware-pending | Not run; DEVICE-CHECKLIST C7, H2, H4 |
| 13.32 | Restore safe navigation after reboot, reconnect, idle | verified | 13.24; idle home in `Wall.tsx` |
| 13.33 | iPhone app-like layout | simulated | `layouts.spec.ts` (phone project is Chromium at 390×844, not Safari) |
| 13.34 | Installation guide for both parents | verified | Inspected PARENT-GUIDE "First ten minutes" (Add to Home Screen; invitation) |
| 13.35 | Test Chrome and WebKit | not built | Playwright projects are all Chromium (`playwright.config.ts`). Undocumented |
| 13.36 | Different viewports and DPR | verified | `layouts.spec.ts` four projects |
| 13.37 | No WebGL fallback | verified | Inspected: no WebGL anywhere, so nothing to fall back from |
| 13.38 | Reduced motion; interrupted internet | verified | `motion.spec.ts`; `offline.spec.ts` |
| 13.39 | `docs/DEVICE-CHECKLIST.md` and `docs/DEPLOYMENT.md` | verified | Inspected; both present |
| 13.40 | No unsupported automatic return/launch claims | verified | Inspected INTEGRATIONS, DECISIONS §12–13, PARENT-GUIDE |

## 14 — Quality and release

| # | Requirement | Status | Where / evidence |
| --- | --- | --- | --- |
| 14.1 | Release review with a traceability matrix | verified | This file |
| 14.2 | Lint, typecheck, unit/integration tests | verified | Run for this audit at `ef906d2`: `vitest run` 453 passed, 1 skipped (33 files); `backup.test.ts` on PostgreSQL passed. Lint/typecheck re-run at `5479df1` only |
| 14.3 | Build and browser E2E | verified | CI runs both (`ci.yml`); `docs/TEST_RESULTS.md` reports 29 passed / 1 skipped and 20 deployment checks. Not re-run here |
| 14.4 | Visual snapshots: wall 4K/scaled, iPhone parent, picker, task demo, bank redemption, routine, Academy, calendar, slideshow, shopping, approvals | verified | `docs/review/screens/` (61, committed): `wall-home-4k.jpg`, `parent-today.jpg`, `wall-home-who.jpg`, `wall-quest-mission.jpg`, `wall-bank-reward.jpg`, `wall-routine-step.jpg`, `wall-academy.jpg`, `wall-calendar.jpg`, `wall-memories.jpg`, `parent-lists.jpg`. Not visual-regression tests; Academy return and native calendar cannot be captured (07.6, 08.6) |
| 14.5 | Synthetic fixtures only | verified | R7 |
| 14.6 | Assistive technology where possible | verified | axe (`a11y.spec.ts`); no screen-reader session recorded |
| 14.7 | Reduced motion, no reading, no audio, large targets, keyboard | verified | `motion.spec.ts`; `non-reader.spec.ts`; `a11y.spec.ts`: `a keyboard reaches every room, Enter opens it, and the home button brings it back` |
| 14.8 | High contrast | built, not tested here | 02.14 |
| 14.9 | Screen glare and mounting reach | hardware-pending | DEVICE-CHECKLIST B1, B6 |
| 14.10 | Parent-supervised child usability trial, never claimed without evidence | not built | No trial has taken place. Now documented as pending: DEVICE-CHECKLIST §I "Ten minutes with a child" |
| 14.11 | Measure time/taps to core tasks | simulated | `docs/TEST_RESULTS.md` "Fewest taps": taps counted from the browser journeys; a real child's time is not measured |
| 14.12 | No biometric/audio/video collection in testing | verified | Inspected: tests use made-up data only |
| 14.13 | Adversarial tests (parents at once, repeated taps, replay, DST, missed days, offline, failed approval, stale price, overdraft, expired sessions, isolation, child admin, revoke, bad photo, hostile input, Academy replay, LLM injection, missing key, budget) | verified | Titles cited in 03–12; `media.test.ts`: `refuses anything that is not really a JPEG or WebP…`; `shopping.test.ts`: `stores hostile text as plain text and never as anything else`. Calendar recurrence: not applicable (08.10) |
| 14.14 | Confirm delete, export, reset | verified | `history.test.ts` (11.15–11.16); `demo.test.ts`: `can be put back to how it started` |
| 14.15 | Confirm rollback | account-pending | Documented (DEPLOYMENT §9, Instant Rollback); needs Vercel |
| 14.16 | Verify the live preview from wall and phone | account-pending | No deployment |
| 14.17 | List unresolved hardware and account items with steps | verified | DEVICE-CHECKLIST (A–H), DEPLOYMENT, this file |
| 14.18 | Enhancement: visual family adventure map | not built | — |
| 14.19 | Enhancement: magnetic-style family bulletin | not built | — |
| 14.20 | Enhancement: picture-based packing wizard | not built | Nearest: the "Getting ready for a trip" routine (`RoutineEditor.tsx`) |
| 14.21 | Enhancement: parent-approved custom reward catalogues | verified | `RewardEditor.tsx`; `bank.test.ts` |
| 14.22 | Enhancement: gratitude/milestone cards | not built | Badges exist (04.24); parents' moments exist on the phone (11.11) but are not shown as cards (ROADMAP §6) |
| 14.23 | Enhancement: rotating themed home worlds | built, not tested here | Seasonal decor only (`decor` in `src/wall/sky.ts`) |
| 14.24 | Enhancement: non-competitive collaborative projects | verified | Shared family missions (05.20) |
| 14.25 | Enhancement: household checklists for trips/emergencies | not built | Trip routine exists; nothing for emergencies |
| 14.26 | Enhancement: printable picture routines | not built | — |
| 14.27 | Explain enhancement tradeoffs; prioritised backlog | verified | Inspected `docs/ROADMAP.md` §6: each enhancement with a trade-off, ordered |
| 14.28 | Avoid bloat, ads, punitive mechanics, endless engagement, surveillance, subscriptions | built, not tested here | 00.19–00.23; COSTS.md |
| 14.29 | Deliver: production setup guide, explicit limitations, documented costs, parent handoff | verified | Inspected DEPLOYMENT, INTEGRATIONS, THREAT-MODEL "Things not done", COSTS, PARENT-GUIDE |
| 14.30 | Deliver: screen recordings | verified | `docs/review/recordings/wall-journey.webm` (`npm run record`, `scripts/record-journey.ts`); headless |
| 14.31 | Deliver: test evidence document | verified | Inspected `docs/TEST_RESULTS.md` (summary, what is not tested) |
| 14.32 | Deliver: polished, usable app | built, not tested here | The whole of the above |
| 14.33 | Do not represent the prompt series as an implemented app | verified | `README.md` (rewritten in `ad4c5e4`) describes the app and keeps the brief separate under "The brief" |

## Checked at the end

Looked for again when the refresh was finished (HEAD `ad4c5e4`):

| Document | State |
| --- | --- |
| `docs/PROGRESS.md` | present, committed in `ad4c5e4` (read for its headings and status words) |
| `docs/ROADMAP.md`, `docs/TEST_RESULTS.md`, `docs/ART_DIRECTION.md`, `docs/ASSETS.md` | present, committed |
| `docs/DEVICE-CHECKLIST.md` §I | present; says plainly no child has tried HOMEBASE |
| `README.md` | rewritten to describe the app, committed in `ad4c5e4` |
| `docs/review/screens/` | 61 images, committed |
| `docs/review/recordings/wall-journey.webm` | present, committed |
| Playwright traces | none committed; CI records them and keeps those of any failing test as an artifact (`.github/workflows/ci.yml`) |

## Claims in other documents that the code does not bear out

The five found in the first version are fixed, each re-read: `docs/integrations/ACADEMY.md` now says the import
page is built (without a browser test); `docs/THREAT-MODEL.md` row 9 cites the committed store test and the
"Things not done" bullet now agrees with row 17 on scrubbed logs; `docs/TEST_RESULTS.md` and `docs/ASSETS.md`,
linked from DECISIONS and DEVICE-CHECKLIST, now exist; `docs/PARENT-GUIDE.md` no longer says "never food".
`docs/integrations/WEATHER.md`'s attribution note matches the Open-Meteo link on the Sky page
(`src/parent/pages/Sky.tsx`).

The links to `docs/PROGRESS.md` from ROADMAP line 5 and TEST_RESULTS line 20 resolve since `ad4c5e4`.

Rewards and necessities: HOMEBASE warns and does not prevent — a parent can still save a reward that sounds
like food or sleep, and the bundled "Ice cream", "Choose dinner" and "Stay up a little" pictures remain
(`shared/pictures.ts`). `docs/ROADMAP.md` ("What will not be done") and `docs/PARENT-GUIDE.md` now say exactly
that, so nothing is claimed that the code does not do.

Spot-checked and found true: 119 drawings (DECISIONS §10); poll intervals 4 s / 30 s / 15 min (§4); PIN relock
default two minutes, at most fifteen (§6); photos re-encoded on the phone (§14); `calendar.rule.*` "not applied
by anything yet" (API.md); the AI job table (AI.md); TEST_RESULTS' unit-test count (453 passed, 1 skipped, re-run)
and its statement that the skipped test is the backup test; DEVICE-CHECKLIST §I's statement that no child has
tried it; the timer, ribbon, reorder, moments, plan-load and reward-warning features named in "Done since".
