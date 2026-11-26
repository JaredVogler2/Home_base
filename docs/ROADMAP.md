# Roadmap

What was planned, what has been built, and what comes next — in the order it should be done, with what each
step is waiting for. For where every requirement of the brief stands, see
[`TRACEABILITY.md`](TRACEABILITY.md); for results and evidence, [`PROGRESS.md`](PROGRESS.md).

## The plan that was followed

The brief's fifteen files (`prompt-series/00`–`14`) were treated as the minimum. They were worked through in an
order that kept something runnable at every step: look and compare first, then the part nothing else can be
right without (identity, isolation, the ledger), then the child's side, then the grown-ups', then everything
that makes it installable, safe to host and provable.

| # | Phase | Brief | State | Where to look |
| --- | --- | --- | --- | --- |
| 0 | Discovery: the brief, the existing Training Academy, the providers' and the display's documentation | 00, 01 | Done | `docs/research/PROVIDER-FACTS.md`, `docs/integrations/ACADEMY.md` |
| 1 | Three art directions as working prototypes; one chosen | 02 | Done | `design/explorations/`, [`ART_DIRECTION.md`](ART_DIRECTION.md) |
| 2 | Architecture decided and written down, deviations marked | 01 | Done | [`DECISIONS.md`](DECISIONS.md), [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| 3 | Foundation: toolchain, shared model, database with row-level security, migrations | 01, 03 | Done | `shared/`, `server/db/` |
| 4 | Identity, households, invitations, pairing a wall, PIN, sessions, the sync engine | 03 | Done | `server/auth/`, `server/ops/`, `src/sync/` |
| 5 | Missions (QUEST), stars and rewards (BANK), routines, the shopping list (TO BUY) on the server | 04, 05, 06, 10 | Done | `server/domain/` |
| 6 | The wall: the house, eight rooms, the guide, 119 drawings, speech and sound | 02, 04–10 | Done | `src/wall/`, `src/art/` |
| 7 | The grown-ups' side on a phone; grown-ups' area on the wall | 11 | Done | `src/parent/` |
| 8 | The Academy (launch and parent-mediated import), kinds of day (calendar), photos (memories) | 07, 08, 09 | Done, within what is possible | `docs/integrations/` |
| 9 | Looking back: history, charts, export, correction, deletion, retention | 11 | Done | `server/domain/history.ts`, `export.ts` |
| 10 | The sky that follows the real day and weather at home (asked for mid-way) | — | Done | `docs/integrations/WEATHER.md` |
| 11 | Installable, offline, security headers, hosting on Vercel or anywhere, CI | 13 | Done; **not yet deployed** | [`DEPLOYMENT.md`](DEPLOYMENT.md) |
| 12 | The optional planning helper (Anthropic or OpenAI) | 12 | Four of the eight jobs built | `docs/integrations/AI.md` |
| 13 | Proof: server tests, browser tests, accessibility, measurement, threat model, costs | 14 | Done here; **hardware and hosting still to be proven** | [`TEST_RESULTS.md`](TEST_RESULTS.md), [`THREAT-MODEL.md`](THREAT-MODEL.md) |
| 14 | Refinement from what the tests found; keepsakes, first-visit tour, self-tuning motion | 14 | Done | `git log` |

## What comes next, in order

Each step says what it is waiting for. Nothing below needs a paid service.

### 1. An hour with the real display — *waiting for: the display, and a grown-up with a pencil*

[`DEVICE-CHECKLIST.md`](DEVICE-CHECKLIST.md) is written for exactly this. Until it is done, everything about
the Apolosign itself is unknown: whether its browser keeps the house on screen, whether the screen saver and
Calendar Mode come and go as hoped, what voices it has, how smooth 4K is on its chip, whether a small child
can reach the bottom row. The answers decide, among other things:

- which way the wall is kept on screen (the display's own browser, an installed web app, or Fully Kiosk);
- how a child comes home from the Academy (section G3 — the thing most likely to need a change);
- whether the wall's self-chosen "light" motion is enough or the house should start still on this hardware;
- which voice Tock should use, or whether to keep him silent with words in the bubble.

### 2. Put it on the internet — *waiting for: the owner's Vercel and database accounts, and their say-so*

[`DEPLOYMENT.md`](DEPLOYMENT.md), about half an hour. Then `npm run verify:deployment -- <address>` and
`/api/health`. This is where several things written from documentation get proven or corrected:

- that the restricted database role can be created and used on a hosted database (`"isolation": "database"`);
- that the pooled connection works with this code;
- that the security headers, the daily nudge and finishing work after a response behave on Vercel as written;
- that `Secure` cookies and the offline shell work over real https.

### 3. Ten minutes with an iPhone — *waiting for: a parent's phone*

Add to Home Screen; sign in and stay signed in; the Siri Shortcut (`docs/integrations/SHORTCUTS.md`); the share
sheet; adding photos from the camera roll (the phone shrinks them and strips where they were taken); the QR
code for pairing and invitations.

### 4. If the planning helper is wanted — *waiting for: an API key and a few cents*

One real request per provider, to prove the request shapes that so far have only been checked against the
providers' documentation and exercised against fakes (`docs/integrations/AI.md`, "Verified / not verified").

### 5. Then, engineering that needs nobody's permission

In the order of how much it would matter to the family:

| What | Why it is not done yet | Size |
| --- | --- | --- |
| A read-only family calendar glance in HOMEBASE (iCloud, Google or Outlook) with parent-approved coarse labels | The brief calls it "optional later" and prefers the display's own Calendar Mode. Needs an account to build against; the tables for it exist and are unused | Large |
| The helper's other four jobs: schedule-aware mission planner, learning bridge, family briefing, story scripts | The first four were the brief's minimum; the calendar and Academy categories send nothing until these exist | Medium each |
| Text that follows the phone's own text-size setting | Sizes are fixed in pixels on the grown-ups' side | Small |
| Tests for each optimistic reducer on its own | The store is tested end to end and against the real server; the reducers are not tested one by one | Small |
| A dependency audit step in CI | Not set up | Small |
| Encrypting a device's cache with a key held by the server | A real gain only for a wall in a shared place, at the cost of starting with no signal ([`DECISIONS.md`](DECISIONS.md) §23) | Medium |
| A licence for the repository | The owner's decision ([`ASSETS.md`](ASSETS.md)) | — |

### 6. Enhancements the brief invites, once the core has lived in a real kitchen for a while

The brief lists ideas to consider "only after reliable core", preferring those that reduce screen time and
the work of co-ordinating a family. In the order they seem worth it:

| Idea | What it would be | Trade-off |
| --- | --- | --- |
| **Printable picture routines** | The morning or bedtime as a sheet of the same drawings, to stick by the bathroom mirror | Takes the routine *off* the screen, which is the point; small to build (the drawings are vectors already) |
| **A family garden** | The garden beside the house grows a little with things the family did *together* — never one child's tally | Charming and collective; must never become a streak or a scoreboard |
| **Packing by pictures** | A trip list as pictures a child can tick: toothbrush, teddy, wellies | A second kind of list; the shopping list's machinery would serve |
| **Seasonal touches** | The tree already wears the season; a little more of that for the family's own festivals | Purely decoration; cheap; easy to overdo |
| Gratitude or milestone cards on the wall | The parents' "moments worth keeping" exist on the phone; showing chosen ones on the photo wall | Needs care about what a visitor sees |
| Checklists for trips and emergencies | Grown-ups' lists | Useful, but it is a different product creeping in |
| A bulletin of fridge magnets | A place for a drawing or a note | Free-form content on a child's screen needs moderation rules first |

Two things were built in this spirit already: **keepsake badges** for things that add up (never for days in a
row), and the parents' **moments worth keeping**.

## What will not be done

The brief rules these out and so does this project: advertisements, external links or shops on a child's
screen, open-ended chat for a child, anything that listens, ranking children against each other, taking stars
away for a day that went badly, making anything a child needs depend on stars (HOMEBASE never does, and says
so when a parent writes a reward that sounds like food, sleep or comfort — the decision stays the parent's),
streaks or countdowns that keep a child at the screen, scraping Apple Notes or iCloud, undocumented device APIs,
and any paid service the family did not choose.
