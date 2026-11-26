# HOMEBASE and the Training Academy

The Training Academy is a separate children's learning game, in its own repository, on its own address. It keeps
every player and all their progress in the browser of the device it is played on. HOMEBASE does not reach into
it, and it does not reach into HOMEBASE.

This page says what joins the two today (Phase A), how a parent brings Academy progress into HOMEBASE, what a
closer link could look like one day (Phase B, a proposal only), and what has and has not been checked.

## Phase A: what exists

### Going to the Academy

- A parent turns the Academy on in HOMEBASE settings and chooses its address. Only an `https` address whose host
  is on the deployment's allow-list is accepted (`checkAcademyUrl` in `shared/settings.ts`: the Academy's public
  host by default, more with `HOMEBASE_ACADEMY_HOSTS`). No user name, password, query string or `#` part is
  allowed, so nothing about a child can ride along in the address. The server refuses anything else, and the wall
  checks it again before a tap goes anywhere.
- On the wall, the Academy room is one big boat. Tapping it navigates the whole screen to that address
  (`window.location.assign`, in `src/wall/scenes/Academy.tsx`). There is no iframe, no shared storage, no token
  and no message passing.
- The Academy cannot be framed even if we wanted to: its hosting config (`vercel.json` in the Academy repository)
  sends `X-Frame-Options: DENY` and `Content-Security-Policy: … frame-ancestors 'none'` on every path. It also sends
  `Referrer-Policy: no-referrer` and `Cross-Origin-Opener-Policy: same-origin`.

### Coming back

HOMEBASE cannot drive the other site, so it cannot bring a child back by itself. Today a child comes back by:

- the browser's back button or gesture, or
- a grown-up opening HOMEBASE again (a home-screen icon, a bookmark, or the wall's kiosk app restarting).

The Academy has no "back to HOMEBASE" button. Adding one would be a change to the Academy, which is for its owner
to decide. When the wall loads again soon after leaving, it notices (a timestamp in `sessionStorage`, kept for six
hours) and greets the child.

### Bringing Academy progress into HOMEBASE (the import)

This is the only way Academy progress reaches HOMEBASE. Nothing happens unless a parent does it.

For a parent, step by step:

1. **In the Academy**, open the grown-ups' area, choose the player and save an export. The Academy writes a JSON
   file (format `training-academy.profile-export`, `formatVersion` 1) holding that player, their sittings and
   their answers, with a checksum.
2. **In HOMEBASE**, on the parent page, choose the child the player belongs to, pick the file, and say yes to
   bringing that child's Academy progress in.
3. The phone sends `POST /api/academy/import` with `{ profileId, consent: true, file }`. Requests are limited to
   about 2 MB.
4. The server checks everything again, whatever the phone said:
   - only a parent (owner or guardian) may do it: not a carer, not a child's screen, and not the wall — unless a
     parent has unlocked the wall with their PIN, when for a few minutes it acts as that parent (the export file
     is saved on the screen the Academy was played on, which is usually the wall);
   - `consent` must be exactly `true`;
   - the child must be in this family and not put away;
   - the file must be an Academy export of a version HOMEBASE knows, the right shape, within size limits (at most
     5,000 sittings and 50,000 answers, with every id length-limited), all for one player, and its checksum must
     match. The checksum is the Academy's own (cyrb53 over a key-sorted JSON of `{ profile, sessions, attempts }`),
     ported unchanged into `shared/academy.ts`. It catches a damaged or edited file. It is not a signature: a
     family can edit its own file, which is one reason the file is never trusted for stars (below).
5. On the first import the child is **linked** to the Academy player's made-up id, with who said yes and when.
   One player can be linked to only one child in a family, and one child to only one player. To change either,
   the parent unlinks first. The error message says so.
6. Each sitting in the file becomes one row. Sending the same file again adds nothing. A later, longer export adds
   only the sittings that are new, and brings up to date any sitting that was unfinished last time. A sitting
   that is already finished never changes again.
7. The reply says how many sittings were new, updated or already there, and how many stars were given or held
   back by the daily limit.

**What is kept**, per sitting (table `academy_sessions`):

| Field | What it is |
| --- | --- |
| `session_id` | The Academy's own id for the sitting (what makes a second import add nothing). |
| `world` | The island. Sittings don't record it, so it is worked out from the activity id's first two letters, which every current Academy content pack follows (`rc` reading-cove, `ng` number-garden, `rr` robot-ridge, `mf` memory-forest, `ii` inventor-island, `eh` explorer-harbor, `ml` music-lab). An unknown prefix is stored as `other`. |
| `lesson_id` | The activity id. |
| `local_date` | The day the sitting began, in the family's own time zone. |
| `completed` | Whether the Academy marked the sitting finished. |
| `attempts` | How many answers were given, counting each try. |
| `independent` | How many of those were given alone (see the rule below). |
| `supported` | How many were given with help. |
| `credit_tx` | The star-ledger line, if the sitting earned stars. |

The link (table `academy_links`) holds the child, the player's made-up id, who consented and when, and the time
of the last import.

**The supported / independent rule.** The Academy records three kinds of help on each answer: a hint shown first
(`hintLevel` > 0, `assistance: 'hint'`), a grown-up helping (`assistance: 'adult'`), and another try after a first
answer that wasn't it (`tryIndex` > 0). By then the game has shown that the first answer was wrong, and in a
multiple-choice question it has taken that choice away. An answer with any of these is **supported**. Every other
answer is **independent**. These are the same three things the Academy counts as an assisted answer. The stage
(the Academy's "guided" practice or the child's own go) is not used. What counts is the help actually given.

**What is not kept:** the Academy nickname, the avatar, the answers given, whether they were right, any per-answer
or per-sitting timing, the Academy's diagnostic tallies, its skill ids and its settings. None of these are copied
out of the file. The file itself is not stored. No HOMEBASE history event is written per sitting, so the import
adds no new tracking. The only record of the import is one audit entry with the counts.

**Stars for taking part.** These are off unless a parent turns them on (`academy.participation` in settings:
`enabled`, `starsPerSession`, `dailyCap`).

- A sitting earns only if it is finished. Being right, being quick and doing the same thing again never earn
  anything extra.
- Each newly finished sitting earns `starsPerSession`, until the child reaches `dailyCap` stars for that day. Stars
  given in earlier imports for the same day count towards the cap. A sitting that would go over is held back
  (partly or wholly), and the reply says how many.
- Whether a sitting earns is **decided once**, at the import where HOMEBASE first sees it finished, using the
  settings at that moment. A sitting brought in while stars were off does not earn later when they are turned on.
- A sitting dated in the future, or more than 60 days before today, is kept but never earns.
- Stars go through the star ledger (`post()` in `server/domain/ledger.ts`) with the key `academy:<sittingId>`, so
  the same sitting can never be paid twice. That holds for a resent file, two phones at once, and unlinking then
  linking again. The household's `bank.spendRatePercent` scales the spendable stars exactly as for missions and
  routines. Lifetime stars are not scaled.
- The number of stars always comes from the family's own settings on the server. The file is never asked how many
  stars anything is worth.

**What parents and carers see.** `GET /api/academy/summary?profileId=…&weeks=…` (owner, guardian or carer;
`weeks` from 1 to 26, 8 by default). For each island over those weeks: sittings, how many were finished, answers,
and how many answers were independent or supported. Every count comes with what it is out of, plus the time of the
last import. It covers one child only, with no ranking and no comparison with brothers or sisters. A child with no
import shows `linked: false` and nothing else. Nothing is invented to fill the gap.

### Disconnecting and deleting

- **Unlink** (the `academy.unlink` operation, for parents) deletes the child's link and **every Academy sitting**
  stored for that child, and writes an audit entry. Stars already given stay in the ledger and in the child's
  wallet and lifetime totals. Rewards are not taken back.
- After unlinking, the same or a different player can be linked by importing again. Sittings that were paid for
  before are not paid again.
- If a child's profile is ever deleted outright, its link and sittings go with it (database cascade).
- Nothing is ever deleted in the Academy. Its data is on the child's device, under the family's control there.

### A child who never links

A child can play the Academy without any of this. HOMEBASE works the same whether or not a child is linked, and
the import can be ignored for good.

## Phase B: a proposal only

> **None of Phase B is implemented.** It would need changes to the Academy repository, which needs its owner's
> explicit permission. Nothing in HOMEBASE assumes it will happen.

The aim would be for finished sittings to reach HOMEBASE without a parent moving files, while keeping everything
Phase A promises. A minimal design:

1. **Opt-in, pseudonymous binding.** A parent starts it from the HOMEBASE parent page. HOMEBASE shows a one-time
   pairing code. A grown-up enters it in the Academy's grown-ups' area for one player. The binding links the
   Academy player's made-up id to one HOMEBASE household and child. No names or emails cross over. Either side can
   undo it, and undoing it in HOMEBASE has the same effect as today's unlink.
2. **Short-lived, scoped credentials.** Pairing gives the Academy a credential that can do one thing: post events
   for that one child of that one household. It expires within days and is renewed with the pairing, never kept
   for good. The server stores only a hash. A parent can revoke it from the parent page.
3. **A minimal, versioned event contract.** One event per finished sitting:

   ```json
   {
     "event_id": "uuid made by the Academy, unique for ever",
     "schema_version": 1,
     "binding": { "household": "…", "profile": "…", "player": "the Academy's made-up id" },
     "activity": "ng-give-01",
     "session": {
       "id": "the Academy's sitting id",
       "completed": true,
       "attempts": 7,
       "supported": 2
     },
     "occurred_at": "2026-03-09T15:04:00Z"
   }
   ```

   `supported` follows the same rule as Phase A (hint, grown-up or retry). There are no answers, correctness,
   timings or scores. Unknown `schema_version`s are refused, not guessed at.
4. **Strict origin checks.** The endpoint accepts only the Academy's allow-listed origin, uses CORS only for that
   origin, needs the scoped credential, and is rate-limited per binding. The binding in the event must match the
   one the credential was issued for.
5. **Idempotent processing.** `event_id` and the sitting id are unique per household. A replayed or duplicated
   event changes nothing, exactly like a second import of the same file. Credit uses the same ledger key
   (`academy:<sittingId>`), so a sitting that arrives once by file and once by event is still paid once.
6. **Browser-supplied stars are never trusted.** The event says what happened, never what it is worth. Anything
   running in a child's browser can be changed by whoever holds the device. The number of stars, the daily cap,
   the 60-day window and the spend rate are all decided on the HOMEBASE server from the family's own settings.
   An event that names a number of stars is refused.

Until then, the file import is the one supported path.

## Verified / not verified

**Verified** (by reading the Academy's source at the time of writing, and by HOMEBASE's tests):

- The export format: `format: 'training-academy.profile-export'`, `formatVersion: 1` (not `version`), `exportedAt`
  (ms), `app: { version, dataVersion }`, `profile`, `sessions`, `attempts`, `checksum`, from
  `src/storage/transfer.ts` (`buildBundle`, `readBundle`) and `src/storage/repository.ts` (`exportProfile`).
- The checksum: `cyrb53:` plus 14 hex digits over `stableStringify({ profile, sessions, attempts })`, with sittings
  and answers sorted by id, from `src/storage/checksum.ts`. HOMEBASE's port is tested against the Academy's own
  functions on random JSON values. A file sealed by the Academy's own `checksumOf` is accepted.
- The record shapes, from `src/engine/schema.ts` (`ProfileSchema`, `LessonSessionSchema`, `AttemptSchema`).
  HOMEBASE's synthetic fixtures pass the Academy's own `parseProfile`, `parseLessonSession` and `parseAttempt`
  unchanged.
- How help is recorded on an answer (`tryIndex`, `hintLevel`, `assistance`), from `src/engine/session.ts`.
- That a sitting record has no island field, and that every activity in `src/content/packs/*.json` and
  `src/content/lessons.lock.json` starts with its island's two-letter prefix.
- `X-Frame-Options: DENY` and `frame-ancestors 'none'`, from the Academy's `vercel.json`.

**Not verified:**

- An export made by the live, deployed Academy. HOMEBASE's tests use synthetic files built the way `buildBundle`
  builds them. The Academy's `transfer.ts` cannot be imported from HOMEBASE's tests without the Academy's own
  build setup (it uses an `@/` path alias), so `buildBundle` itself was not called.
- That the deployed site actually sends the headers in its `vercel.json` (observed earlier; re-check against the
  live site).
- That future Academy activities will keep the two-letter prefix convention. A new prefix is stored as `other`
  until the table in `shared/academy.ts` is updated.
- How large real exports get. An Academy export can be up to 5 MB by its own limit, while HOMEBASE accepts about
  2 MB.
- The parent-page UI for the import and the summary. It is not built yet.
