# HOMEBASE API

Every HTTP route mounted by `server/app.ts`, every operation in `shared/ops.ts`, what a snapshot holds for each
kind of viewer, and the error shape. Derived from the route files; nothing here is planned-but-unbuilt unless it
says so. The architecture around it is in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Conventions

- **Base path** `/api` (`new Hono().basePath('/api')`). On Vercel every `/api/*` request is rewritten to the one
  function `api/index.ts` (`vercel.json`).
- **Bodies** are JSON (`Content-Type: application/json` is required by `readJson` in `server/http/env.ts`;
  anything else is `400 bad_request`). Default body limit 256 KB, checked against `Content-Length` and the actual
  text. Exceptions: `PUT /api/media/:id/:width` (raw image bytes, ≤ 4,000,000), `POST /api/academy/import`
  (≤ 2 MiB + 16 KiB), `POST /api/shortcuts/add` (JSON or `text/plain`, ≤ 4 KiB).
- **Sessions** are an opaque 256-bit token in an `HttpOnly; SameSite=Lax; Path=/` cookie, named `__Host-hb` with
  `Secure` over https and `hb` over http (`server/auth/sessions.ts`). Two kinds: a *phone* session (`kind:
  'guardian'`, a member signed in on their own device, any role) and a *wall* session (`kind: 'device'`, a paired
  screen). Phone sessions last 30 days after last use, wall sessions 365 days; both are renewed at most hourly.
- **Every response** carries `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer` and `Cross-Origin-Resource-Policy: same-origin` (middleware in `server/app.ts`;
  photo responses override `Cache-Control`, below).
- **Origin check.** A request that is not `GET`/`HEAD`/`OPTIONS` **and carries the session cookie** is refused
  with `403 forbidden` unless its `Origin` equals the request's own scheme and host (using `X-Forwarded-Proto` and
  `X-Forwarded-Host` when present), or, with no `Origin`, `Sec-Fetch-Site` is absent, `same-origin` or `none`.
  Requests without the cookie are not origin-checked (they have no session to abuse).
- **Access words** used below:
  - *none*: no session needed.
  - *any session*: a phone or a wall.
  - *phone*: a phone session (`requireGuardianSession`); a wall is refused even when unlocked. The role is then
    checked separately where stated.
  - *level X*: the session's access level (`accessOf` in `server/auth/sessions.ts`) must be at least X in
    `child < household < caregiver < guardian < owner`. A phone has its member role. A wall has the role of the
    grown-up who unlocked it with a PIN, until the server-side expiry; otherwise `household` (when
    `settings.wall.holdGate` is on, the default) or `child`. So "level guardian" includes **a wall unlocked by a
    parent's PIN**.
- **Rate limits** are counted in the database (`server/auth/rate-limit.ts`, fixed windows). "Per address" means
  per hash of the first `X-Forwarded-For` value (else `X-Real-IP`, else `local`; `clientKey` in
  `server/http/env.ts`). A refusal is `429 too_many` with `Retry-After` in seconds.

| Limit name | Max | Window | Key | Counted |
| --- | --- | --- | --- | --- |
| `signIn` | 8 | 15 min | e-mail | wrong passwords only (checked before, counted after a failure; cleared on success) |
| `signInAddress` | 40 | 15 min | address | every sign-in attempt |
| `signIn` (reused) | 8 | 15 min | e-mail (`recover:`) | every recovery attempt |
| `signIn` (reused) | 8 | 15 min | user + address (`delete:`) | every household-delete attempt; cleared on success |
| `pin` | 5 | 15 min | wall device + grown-up | wrong PINs only; cleared on success |
| `code` | 12 | 10 min | address | every invite peek, join, reset, pairing claim; pairing collect only for an unknown code/secret |
| `pairStart` | 30 | 10 min | address | every new pairing code |
| `signUp` | 6 | 60 min | address | every sign-up |
| `shortcut` | 60 | 10 min | Shortcut key | every call with a valid key |
| `shortcutUnknown` | 10 | 10 min | address | every call with an invalid key |
| `upload` | 300 | 10 min | household | every photo copy (`PUT /api/media/:id/:width`), after the access check |
| `ai` | 4 | 60 s | household | every AI run (`POST /api/ai/run`) |

## Routes

### Health

| Method, path | Who | Request → response |
| --- | --- | --- |
| `GET /api/health` | none | → `200` (or `503` if the database is down) `{ ok, api: 1, schema: <latest migration tag>, database: 'ok'|'down', engine: 'postgres'|'pglite'|null, isolation: 'database'|'application'|null, mode: 'demo'|'family', commit: <7-char sha>|null, time }`. No household data. |

### Accounts — `server/http/routes/auth.ts`

| Method, path | Who | Request → response | Limit |
| --- | --- | --- | --- |
| `POST /api/auth/signup` | none | `{ email, password (10–200), displayName (≤30), avatar?, householdName (≤40), timeZone }` → `201 { ok, householdId, recoveryCodes: string[8] }` + cookie. `403` if a non-demo household already exists and `HOMEBASE_OPEN_SIGNUP` is not set; `409` if the e-mail is taken | `signUp` |
| `POST /api/auth/login` | none | `{ email, password }` → `{ ok }` + cookie; `401` with one message for a wrong password, unknown or disabled account; `403` if the account belongs to no household | `signInAddress`, `signIn` |
| `POST /api/auth/logout` | none / any session | → `{ ok }`; revokes the session, clears the cookie | — |
| `GET /api/auth/me` | none / any session | → `{ signedIn: false }` or `{ signedIn: true, kind, role, access, household: { id, name, demo }, me: { id, displayName, email, avatar, hasPin } \| null, deviceId, unlockedUntil }`. `me` (with the e-mail) only for a phone session | — |
| `POST /api/auth/profile` | phone | `{ displayName, avatar }` → `{ ok }`; bumps the household revision | — |
| `POST /api/auth/password` | phone | `{ current, next }` → `{ ok }` + new cookie; revokes the user's other sessions in this household and locks walls they unlocked | none (needs a session) |
| `POST /api/auth/recovery-codes` | phone | `{ password }` → `{ recoveryCodes: string[8] }` (replaces the old set) | none (needs a session) |
| `POST /api/auth/recover` | none | `{ email, recoveryCode, password }` → `{ ok }` + cookie; uses the code once, sets the password, revokes other sessions | `signIn` per e-mail |
| `POST /api/auth/pin` | phone | `{ pin }` (4–8 digits, not all one digit, not an ascending/descending run) → `{ ok }` | — |
| `DELETE /api/auth/pin` | phone | → `{ ok }` | — |
| `GET /api/auth/invites` | phone, owner or guardian | → `{ invites: [{ id, kind, role, expiresAt, createdAt }] }` (live ones) | — |
| `POST /api/auth/invites` | phone, owner or guardian | `{ role: 'guardian'|'caregiver' }` → `201 { id, code: 'XXXXX-XXXXX', role, expiresAt }` (48 h; shown once, only a hash kept) | — |
| `DELETE /api/auth/invites/:id` | phone, owner or guardian | → `{ ok }` | — |
| `POST /api/auth/invites/peek` | none | `{ code }` → `{ kind, role, householdName }` or `404` | `code` |
| `POST /api/auth/join` | none | `{ code, email, password, displayName, avatar? }` → `201 { ok }` + cookie. An existing account joins if the password matches, else `409` | `code` |
| `POST /api/auth/reset-link` | phone, owner | `{ userId }` → `201 { code, expiresAt }` (24 h) for a member of this household | — |
| `POST /api/auth/reset` | none | `{ code, password }` → `{ ok }`; sets the password and revokes that user's sessions; does **not** sign in | `code` |
| `POST /api/auth/leave` | phone, not the owner | → `{ ok }`; removes the membership, revokes sessions, clears the cookie | — |

### Pairing and the wall PIN — `server/http/routes/pair.ts`

| Method, path | Who | Request → response | Limit |
| --- | --- | --- | --- |
| `POST /api/pair/start` | none | → `201 { code: 'XXXX-XXXX', secret, expiresAt }` (10 min). The wall shows the code (and a QR of `<origin>/pair?code=…`); it keeps the secret | `pairStart` |
| `POST /api/pair/claim` | phone, owner or guardian | `{ code, name (≤40), kind?: 'wall'|'tablet' }` → `{ ok }` or `404` | `code` |
| `POST /api/pair/collect` | none (the wall) | `{ code, secret }` → `{ status: 'waiting'|'used'|'expired'|'paired' }`; on `paired`, a device row is created and a wall session cookie set (once). Unknown code/secret → `404` | `code` (unknown only) |
| `POST /api/pair/forget` | wall session that is unlocked | → `{ ok }`; revokes the device and its session, clears the cookie | — |
| `POST /api/wall/unlock` | wall session | `{ userId, pin }` → `{ ok, unlockedUntil, role }`. `403` wrong PIN or no PIN set; `429` after 5 wrong in 15 min (audited as `wall.pin_locked_out`). Unlock lasts `settings.wall.relockSeconds` (30–900 s, default 120), extended by grown-up ops up to 15 min after unlocking | `pin` |
| `POST /api/wall/lock` | any session | → `{ ok }` (locks a wall; nothing for a phone) | — |

### Sync — `server/http/routes/sync.ts`

| Method, path | Who | Request → response |
| --- | --- | --- |
| `GET /api/sync?since=&access=&today=` | any session | `204` with no body when `since` equals the household's revision **and** `access` equals the viewer's current access **and** `today` equals the household's local date; otherwise `200` with a [snapshot](#the-snapshot). Also runs the household's daily chores on the first call of a local day, and, if the household has weather on, starts a background weather check after answering |
| `POST /api/sync/ops` | any session | `{ ops: OpEnvelope[] }` (1–25) → `{ outcomes: OpOutcome[], snapshot }`. Each op is checked and applied in its own transaction; see [Operations](#operations) |

### Demo — `server/http/routes/demo.ts` (only when `config.demo`; otherwise every path is `404`)

| Method, path | Who | Request → response |
| --- | --- | --- |
| `POST /api/demo/enter` | none | `{ as: 'guardian'|'caregiver'|'wall' }` → `{ ok, as }` + a session in the fixed demo household |
| `POST /api/demo/reset` | a session in the demo household with role owner or guardian | → `{ ok }`; deletes and re-seeds the demo household |

### Daily chores — `server/http/routes/cron.ts`

| Method, path | Who | Request → response |
| --- | --- | --- |
| any method `/api/cron/daily` | `Authorization: Bearer <CRON_SECRET>` (constant-time compare); `401` for everyone if `CRON_SECRET` is unset | → `{ ok, households, kept }`; runs `keepHouse` for up to 1,000 households and the system sweep. Nothing depends on it (the first sync of each day does the same). `vercel.json` schedules it daily at 09:17 UTC. Tested by `tests/server/cron.test.ts` |

### Look-back, export, deletion — `server/http/routes/history.ts`

All are **phone only**; a wall is refused even when unlocked (`tests/server/history.test.ts`, `is closed to the wall`).

| Method, path | Who (level) | Request → response |
| --- | --- | --- |
| `GET /api/history/summary?weeks=` | caregiver | weeks 1–26 (default 8) → week-by-week counts with their "out of" |
| `GET /api/history/ledger?profileId=&limit=&before=` | guardian | limit 1–200 (default 100), `before` an ISO time for paging → `{ entries: LedgerEntry[] }` newest first |
| `GET /api/history/events?days=&profileId=&limit=` | guardian | days clamped 1–366 (default 14), limit clamped 1–300 (default 100) → `{ events }` |
| `GET /api/history/reconcile` | guardian | → `{ ok, children: [{ profileId, wallet, fromLedger, matches }] }` |
| `GET /api/history/changes` | guardian | → `{ changes: [{ at, action, actor }] }` (latest 100 audit rows) |
| `GET /api/export/household.json` | guardian | attachment `homebase-<date>.json` (format `homebase.household-export` v1); audited |
| `GET /api/export/ledger.csv` | guardian | attachment, formula-safe CSV; audited |
| `GET /api/export/history.csv` | guardian | attachment, formula-safe CSV; audited |
| `POST /api/family/profiles/:id/delete` | guardian | `{ nickname }` (must match, case-insensitive) → `{ ok }`; deletes the child and every row that cascades from it, ledger included |
| `POST /api/family/household/delete` | phone, owner | `{ password, name }` → `{ ok }`; deletes the household (everything cascades) and the accounts of members left with no household; limited per user + address |

### Academy — `server/http/routes/academy.ts`

| Method, path | Who (level) | Request → response |
| --- | --- | --- |
| `POST /api/academy/import` | any session, level guardian (so a phone parent, **or a wall unlocked by a parent**) | `{ profileId, consent: true, file }` → counts of new / updated / unchanged sittings and stars given / held back. See [`integrations/ACADEMY.md`](integrations/ACADEMY.md) |
| `GET /api/academy/summary?profileId=&weeks=` | any session, level caregiver | weeks 1–26 (default 8) → per-island totals for one child |

### Photos — `server/http/routes/media.ts`

| Method, path | Who (level) | Request → response |
| --- | --- | --- |
| `POST /api/media` | any session, level guardian (a phone parent, or a wall unlocked by a parent, which acts as that parent) | `{ mediaId (uuid), width, height }` (≤ 4 KiB) → `{ ok, mediaId }`. Idempotent per id. `409` at 500 photos |
| `PUT /api/media/:id/:width` | any session, level guardian | raw body, `Content-Type: image/jpeg` or `image/webp`, ≤ 4,000,000 bytes, width 160–3840 → `{ ok, widths }`. The first bytes must be JPEG (`FF D8 FF`) or WebP (`RIFF…WEBP`) and match the declared type. At most 4 widths per photo; household total ≤ `HOMEBASE_MEDIA_LIMIT_MB` (default 200 MB). Limit `upload` (300 copies per 10 min per household; `media.test.ts`, `stops taking copies from a household that has sent very many in a short while`) |
| `GET /api/media/:id/:width` | any session, level child | the stored copy nearest at or above that width (else the largest), with its type, `Cache-Control: private, max-age=31536000, immutable`, `Content-Disposition: inline`, `nosniff`, `CORP: same-origin`. A locked wall gets `404` for a photo not in the slideshow, or for any photo while `settings.memories.hidden` is on |

### Shortcut keys — `server/http/routes/shortcuts.ts`

| Method, path | Who | Request → response | Limit |
| --- | --- | --- | --- |
| `GET /api/shortcuts/tokens` | phone, any role | → `{ tokens: [{ id, name, createdAt, lastUsedAt }] }` (own keys only, never the key) | — |
| `POST /api/shortcuts/tokens` | phone, any role | `{ name (≤40) }` → `201 { id, name, token: 'hbs_…' }` (shown once; ≤ 5 live per person) | — |
| `DELETE /api/shortcuts/tokens/:id` | phone; own key, or any key for a guardian/owner | → `{ ok }` | — |
| `POST /api/shortcuts/add` | `Authorization: Bearer hbs_…` (no cookie used) | JSON `{ text (1–400), list? }` or `text/plain` → `{ ok, list, added: string[], message }`. `401` (one sentence for any bad key), `409` if no list exists. Up to 20 things per call; added as the key's owner via `addItem` | `shortcut`, `shortcutUnknown` |

Full walkthrough: [`integrations/SHORTCUTS.md`](integrations/SHORTCUTS.md).

### AI helper — `server/http/routes/ai.ts`

Every route is **phone only** (`requireGuardianSession`), so a wall cannot reach it even when unlocked
(`tests/server/ai.test.ts`, `is never reachable from a wall, even one unlocked with a PIN`). Off unless the server
has the chosen provider's key and a parent has switched it on. Refusals (`off`, `no_key`, a data category not
shared, a spending cap) are `409 conflict`; provider faults, time-outs and unusable replies are `503 unavailable`,
each with `reason`. Full description: [`integrations/AI.md`](integrations/AI.md).

| Method, path | Who (level) | Request → response |
| --- | --- | --- |
| `GET /api/ai/status` | guardian | → on/off, chosen provider, which providers have keys on the server (never the keys), model, shared data categories, caps, spend today and this month, whether a run is possible and why not |
| `GET /api/ai/economist` | caregiver | → "how long until…" reward arithmetic worked out on the server, no model |
| `POST /api/ai/run` | guardian | `{ workflow: 'routine_architect'|'weekly_reflection'|'shopping_tidy'|'reward_economist', input? }` (≤ 16 KiB) → `201` a stored draft. Limit `ai`. The worst-case cost is reserved in `ai_usage` under the household lock before the request is sent and released when the real cost is written, so concurrent runs cannot pass the caps |
| `GET /api/ai/proposals` | guardian | → the latest 20 drafts and their state |
| `POST /api/ai/proposals/:id/apply` | guardian | `{ changes?: number[] }` → applies the chosen changes through `applyOps` with op ids derived from the draft (so applying twice is idempotent); only `routine.create`, `task.create`, `shopping.edit` are ever applied |
| `POST /api/ai/proposals/:id/dismiss` | guardian | → `{ ok, status: 'dismissed' }` |

### Shopping suggestions — `server/http/routes/shopping.ts`

| Method, path | Who (level) | Request → response |
| --- | --- | --- |
| `GET /api/shopping/suggestions?listId=` | any session, level caregiver | → `{ suggestions: [{ text, picture, category, times }] }`: things ticked off on ≥ 2 different days in the last 120 days, not on the list now; at most 12 |

## Operations

Every change a screen makes to household data (apart from the routes above) is an op sent to
`POST /api/sync/ops`:

```ts
// shared/ops.ts
interface OpEnvelope { id: string /* client-made UUID */; type: OpType; at: string /* kept, not trusted */; input }
type OpOutcome =
  | { id; status: 'applied'; data }   // done
  | { id; status: 'noop'; data }      // nothing needed doing; not an error
  | { id; status: 'rejected'; reason: Rejection; message }  // final: do not resend
  | { id; status: 'retry' }           // nothing was kept; resend the same id later
```

`Rejection` is one of `invalid`, `forbidden`, `not_found`, `conflict`, `not_allowed_now`, `not_enough_stars`,
`price_changed`, `out_of_stock`, `not_offered`, `limit_reached`. Each comes with a sentence fit to show.

### Idempotency rules

- The op id is remembered per household in `operations` with its outcome (`applied`, `noop` or `rejected`). The
  same id sent again — a double tap, a retry, a replayed offline queue — returns the stored outcome and does
  nothing. Ids are remembered for **30 days** (`sweepSystem`); an outbox held longer than that would have its ops
  applied again (domain rules such as ledger keys still prevent double credit).
- The stored outcome is returned **before** the access check, so an op refused while a wall was locked stays
  refused when it is resent after unlocking (`tests/server/isolation.test.ts`, `does not let a request that was
  refused while locked go through later when a grown-up unlocks`).
- `retry` is not stored: the transaction was rolled back, and the same id may be sent again.
- An envelope without a valid UUID id is answered `rejected/invalid` with its id echoed and is not stored.
- Separately, record ids inside inputs are client-made too (`templateId`, `itemId`, `redemptionId`, `entryId`…),
  and ledger lines carry idempotency keys, so even a new op id cannot pay the same thing twice.

### Catalogue

The table below is checked against the code by `npx tsx scripts/print-ops.ts --check docs/API.md` (it fails if an op
is missing, has a different access level, or no longer exists). `npx tsx scripts/print-ops.ts` prints the bare
table. There are 65 ops.

| Op | Least access | What it does |
| --- | --- | --- |
| `occurrence.start` | child | Mark a mission started (available/returned → in progress) for its own child |
| `occurrence.submit` | child | "I did it": auto-approve and credit if the mission trusts the child and the daily cap allows, else wait for a grown-up; today's or yesterday's only |
| `occurrence.undo` | child | "Oops, not yet" within `quest.undoSeconds`; reverses an auto credit; a grown-up can undo any time |
| `occurrence.help` | child | Flag that the child asked for help |
| `occurrence.skip` | child | "Not today", if the mission's skip policy lets a child; costs nothing |
| `run.start` | child | Start (or resume) today's run of a routine for a child |
| `run.step` | child | Mark a step done, skipped (child only if allowed), help, or undo; a step linked to a mission submits that mission |
| `run.pause` | child | Suspend a run |
| `run.resume` | child | Resume a suspended run |
| `redemption.request` | child | Ask for a reward at the version and price shown; reserves the stars |
| `redemption.cancel` | child | Withdraw a request not yet answered; releases the stars |
| `goal.set` | child | Set or clear the reward a child is saving for |
| `shopping.request` | child | Ask for something by picture; waits for a grown-up (max 5 open per child) |
| `shopping.add` | household | Add an item (merges with the same normalised text already on the list) |
| `shopping.check` | household | Tick or untick an item |
| `run.together` | household | Mark a step "done together" |
| `occurrence.approve` | caregiver | Approve up to 50 submitted missions; credits each once |
| `occurrence.return` | caregiver | Send a submitted mission back with one of four kind reasons |
| `occurrence.markDone` | caregiver | Mark a mission done for a child and credit it |
| `occurrence.snooze` | caregiver | Snooze a mission for 1–12 hours |
| `occurrence.dismiss` | caregiver | Set a mission aside for today (as skip, with a grown-up's rights) |
| `shopping.decide` | caregiver | Accept or decline a child's request |
| `shopping.edit` | caregiver | Change only the fields sent (text, quantity, unit, note, url, store, priority, category, picture, list) |
| `shopping.remove` | caregiver | Remove an item (soft; undoable) |
| `shopping.restore` | caregiver | Bring back a removed or archived item |
| `shopping.clearChecked` | caregiver | Archive every ticked item on a list |
| `occurrence.reverse` | guardian | Take back an approved mission's stars with a correction line |
| `task.create` | guardian | Create a mission template (and today's occurrences) |
| `task.update` | guardian | Edit a mission with a base-version check; re-makes today's untouched copies |
| `task.status` | guardian | Activate, pause or archive a mission |
| `task.reorder` | guardian | Reorder missions |
| `routine.create` | guardian | Create a routine |
| `routine.update` | guardian | Edit a routine with a base-version check |
| `routine.status` | guardian | Activate, pause or archive a routine |
| `routine.clone` | guardian | Copy a routine with new step ids |
| `run.finish` | guardian | Close a run as it stands |
| `reward.create` | guardian | Create a reward (price 1–500) |
| `reward.update` | guardian | Edit a reward with a base-version check |
| `reward.status` | guardian | Activate, pause or archive a reward (bumps its version; clears goals) |
| `redemption.decide` | guardian | Approve (spend the reserved stars) or decline (release them) |
| `redemption.fulfill` | guardian | Mark an approved reward as having happened |
| `redemption.refund` | guardian | Give the stars of an approved or fulfilled reward back |
| `ledger.bonus` | guardian | Give 1–100 stars with a note |
| `ledger.correct` | guardian | Add a correction line (−1000…1000 available/lifetime) with a required note |
| `profile.create` | guardian | Add a child (max 12) |
| `profile.update` | guardian | Change a child's nickname, avatar, age band, missions on/off, numbers shown |
| `profile.archive` | guardian | Put a child away or bring them back |
| `profile.reorder` | guardian | Reorder children |
| `household.rename` | guardian | Change the household's name and time zone |
| `household.settings` | guardian | Patch any part of the settings; validated whole; Academy address checked against the allow-list; location rounded to 2 decimals |
| `list.create` | guardian | Create a list |
| `list.update` | guardian | Rename or archive a list |
| `device.rename` | guardian | Rename a paired screen |
| `device.revoke` | guardian | Unpair a screen (its session stops at its next request) |
| `milestone.save` | guardian | Create or edit a milestone |
| `milestone.remove` | guardian | Delete a milestone |
| `calendar.setDay` | guardian | Set up to 3 picture labels on a day |
| `calendar.rule.save` | guardian | Save a word → picture rule (not applied by anything yet) |
| `calendar.rule.remove` | guardian | Delete a rule |
| `media.update` | guardian | Put a photo in or out of the slideshow |
| `media.remove` | guardian | Delete a photo and its copies |
| `academy.unlink` | guardian | Delete a child's Academy link and sittings (stars stay) |
| `history.forget` | guardian | Delete one look-back event |
| `member.role` | owner | Make a member guardian or caregiver (not the owner) |
| `member.remove` | owner | Remove a member (not the owner); their sessions and Shortcut keys stop working |

Text inputs are cleaned by `shared/ops.ts` (`clean`: control characters removed, runs of white space collapsed,
trimmed) and length-limited. Picture fields must be ids from `shared/pictures.ts`. Links (`shopping` `url`) must be
`http:`/`https:` with no user name or password. HTML is **not** stripped; it is stored as typed and rendered as text
by React (`tests/server/shopping.test.ts`, `stores hostile text as plain text and never as anything else`).

## The snapshot

`buildSnapshot` (`server/domain/snapshot.ts`) returns the `Snapshot` type in `shared/model.ts`. "Child view" below
means access `child` or `household` (a locked wall); "grown-up" means `caregiver` or above (a phone, or a wall
unlocked by a PIN).

| Field | Child view | Caregiver | Guardian / owner |
| --- | --- | --- | --- |
| `rev`, `serverTime`, `today`, `viewer` | yes | yes | yes |
| `household` `{ id, name, timeZone, demo }` | yes | yes | yes |
| `household.settings` | yes, but `location.label` blanked and `ai.share = []`, `ai.provider = null` | full | full |
| `profiles` | not archived | including archived | including archived |
| `wallets` | every child's three totals | same | same |
| `occurrences` | today's, plus `submitted` from the last 2 days | same | same |
| `routines` | active | not archived | not archived |
| `runs` | today's, with steps and states | same | same |
| `rewards` | active | not archived | not archived |
| `redemptions` | open (`requested`, `approved`) plus anything updated in the last 14 days | same | same |
| `goals`, `lists` (not archived), `calendar` (today + 6 days) | yes | yes | yes |
| `items` | not removed or archived; declined only for 24 h; **full text, note, url, store and `addedBy`** | same | same |
| `media` | slideshow photos only; `[]` while `memories.hidden` | all | all |
| `members` | `{ userId, displayName, avatar, role, hasPin }` — no e-mail | same | same |
| `weather` | `{ state, temperature, units, at, stale }` or `null` | same | same |
| `badges` | `{ profileId, badge, earnedOn }` for every child | same | same |
| `templates`, `milestones`, `academyLinks` | absent | yes | yes |
| `devices` | absent | absent | yes |

Never in any snapshot: e-mail addresses (only `/api/auth/me`, to that person), password or PIN hashes, tokens,
ledger lines (`/api/history/ledger`), look-back events, audit rows, Academy sittings, item history.

A locked wall's snapshot is sent to the wall's browser in full; what is "withheld" from a child is withheld from
the screen, not merely hidden by the drawing. What a locked wall *does* receive includes shopping notes and links
typed by grown-ups and grown-ups' display names.

## Errors

Every error from a route is `{ "error": { "code": ErrorCode, "message": string, ...extra } }`
(`server/http/errors.ts`, handler in `server/app.ts`). The message is a sentence for a person; nothing internal is
in it. Unexpected errors are logged on the server and answered `500 internal` with "Nothing was changed."

| Code | Status | Typical cause | Extra |
| --- | --- | --- | --- |
| `bad_request` | 400 | not JSON, wrong shape, a field out of range | `field` on account forms; `reason` on Academy file problems |
| `unauthenticated` | 401 | no or dead session; bad Shortcut key; bad cron secret | — |
| `forbidden` | 403 | not allowed for this session; foreign `Origin` | — |
| `not_found` | 404 | unknown path or record (another household's record looks the same) | — |
| `conflict` | 409 | e-mail taken, photo limit, key limit, no list for a Shortcut | — |
| `payload_too_large` | 413 | body over the route's limit | — |
| `too_many` | 429 | rate limit | `retryAfter` (also the `Retry-After` header) |
| `unavailable` | 503 | database unreachable; AI provider fault or time-out | `reason` on AI routes |
| `internal` | 500 | anything unexpected | — |

Ops never produce these: an op's problem is its `rejected` outcome inside a `200` reply. The `POST /api/sync/ops`
route itself answers `400` for a missing/empty `ops` array or more than 25 ops.

## Bounds and paging

- Ops per request: 25. Approvals per op: 50. Children per household: 12. Steps per mission checklist: 6; per
  routine: 12. Reward price: 1–500 (op) within the database's 1–1000. Mission stars: 0–20 (op) within the
  database's 0–100. Open shopping requests per child: 5. Photos: 500, 4 copies each, 4,000,000 bytes per copy,
  200 MB per household by default. Shortcut keys: 5 per person; 20 things and 400 characters per call.
- Paging exists only on `GET /api/history/ledger` (`before` = the `at` of the last line received). Everything else
  returns a bounded set (limits above). Snapshots are not paged: a household's working set is sent whole each time
  it changes (about 27 KB for the demo household's wall and 32 KB for its guardian, uncompressed JSON, measured with
  the test harness on the seeded demo data).
