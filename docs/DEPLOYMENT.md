# Putting HOMEBASE on the internet

For the parent who will run it. It takes about half an hour, costs nothing at a household's scale
([`COSTS.md`](COSTS.md)), and at no point asks you to put a secret or anything about your family into this
repository.

> **What has and has not been checked.** Everything below was built and tested on a developer's machine: the
> production build, the standalone server, the database migrations on PostgreSQL 16, and
> `npm run verify:deployment` against the built app. **A real Vercel project and a real hosted database were not
> created** — that needs your accounts and your say-so. Steps marked *(unverified on Vercel)* are written from
> Vercel's and the database hosts' current documentation and have not been run. The verification script in
> step 6 is how you find out, in one command, whether they worked.

## 0. Try it on your own computer first

```bash
npm install
```

```bash
npm run dev
```

Open the address it prints. With nothing configured this is a **demo** with a made-up family (the Maple Street
house) kept in a folder called `.data/`. "Open the demo wall" and "Look around the demo as a parent" let you
see both sides. Nothing leaves your computer.

## 1. What you will set up

| Piece | What it is | Free plan is enough? |
| --- | --- | --- |
| The app | This repository, deployed on Vercel | Yes (Hobby is for personal, non-commercial use) |
| The database | A PostgreSQL database: Supabase **or** Neon | Yes — see the differences below |
| The wall | The display's browser, pointed at your address | — |

**Choosing the database.** Both work; the code uses nothing specific to either.

- **Supabase (recommended for a wall that is always on).** The free plan has no compute meter, so a wall asking
  for news all day costs nothing. It pauses a project after about a week with no activity at all — a wall in
  daily use keeps it awake; after a long holiday you may need to press "restore" in Supabase's dashboard.
- **Neon.** The free plan allows a fixed number of compute-hours a month and the database sleeps after five
  minutes idle. HOMEBASE asks every 30 seconds while nobody is at the wall in the daytime — often enough to keep
  such a database awake — and only every 15 minutes in quiet hours or while the photos show. A wall left on all
  day can therefore still use the allowance up ([`COSTS.md`](COSTS.md) has the arithmetic). Fine for trying
  things; watch the usage page.

## 2. Create the database

**Supabase:** new project → choose a region near you and a database password → when it is ready, *Connect* →
copy the **Transaction pooler** connection string (its port is `6543`). Put your database password into it.
Vercel cannot reach Supabase's direct connection on the free plan (it is IPv6-only); the pooler is the one to
use.

**Neon:** new project → copy the **pooled** connection string (the host has `-pooler` in it).

Keep the string somewhere private. It is a password.

## 3. Create the Vercel project *(unverified on Vercel)*

1. In Vercel: *Add New → Project* → import this GitHub repository. Vercel detects Vite; `vercel.json` in the
   repository supplies the build command, the output folder, the security headers and the routing. Do not
   change them.
2. Before the first deploy, add the environment variables below.

| Name | Needed | What to put | Which environments |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | The pooled connection string from step 2 | **Production only** |
| `HOMEBASE_SECRET_KEY` | Yes | 32 random bytes — make one with the command below | Production only |
| `CRON_SECRET` | Recommended | Another random value (same command) | Production only |
| `HOMEBASE_DB_SSL` | Only if the connection fails with a TLS error | `require` | Production only |
| `HOMEBASE_OPEN_SIGNUP` | No | Leave unset: the first family to sign up owns the deployment | — |
| `HOMEBASE_WEATHER` | No | `off` to forbid weather requests entirely | — |
| `HOMEBASE_MEDIA_LIMIT_MB` | No | Megabytes of photos to allow (default 200) | — |
| `HOMEBASE_ACADEMY_HOSTS` | No | Extra hosts the Academy may be opened at | — |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | No | Only for the optional planning helper ([`integrations/AI.md`](integrations/AI.md)) | Production only |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

**Why "Production only" matters.** Vercel builds a *preview* for every pull request. A preview with no
`DATABASE_URL` cannot see your family: it becomes the made-up demo by itself and says so on every page. Never
give previews your real database.

3. Deploy.

**Node version.** `package.json` asks for Node 22, which Vercel honours.

## 4. First visit

1. Open your production address. The database is brought up to date by itself on the first request (you can
   also do it by hand: `DATABASE_URL=… npm run db:migrate`).
2. Choose **I am a grown-up, on my own phone → Start a new household**. The first household created owns the
   deployment; after that, sign-up is closed and other grown-ups join by invitation.
3. **Write down the recovery codes.** HOMEBASE sends no e-mail, so these are how you get back in.
4. Then follow [`PARENT-GUIDE.md`](PARENT-GUIDE.md): add the children, set your wall PIN, invite the other
   parent, pair the wall.

## 5. Check that the database is defending each household

Open `https://<your address>/api/health`. It says nothing about your family. Look for:

```json
{ "database": "ok", "isolation": "database", "mode": "family" }
```

- `"isolation": "database"` — PostgreSQL itself refuses to show one household's rows to another (row-level
  security, as the restricted role `homebase_app`). This is what you want.
- `"isolation": "application"` — the app's login could not switch to that role, so only the application's own
  checks are separating households. With a single family on the deployment nothing is exposed, but fix it:
  connect as the database's owner (Supabase: the `postgres` user; Neon: the project's owner role) so the
  migration can create and use the role, then redeploy.
- `"mode": "demo"` on your production address means `DATABASE_URL` is missing there.

## 6. Verify the deployment from outside

```bash
npm run verify:deployment -- https://<your address>
```

It signs in to nothing and changes nothing. It checks that the site is up, that pages carry their security
headers, that the API refuses a stranger, that the daily nudge refuses anyone without the secret, that the
offline shell installs, and that no page complains under the security policy. It ends with
"All as it should be." or a list of what needs a look.

## 7. Keeping it private

- **The data is behind sign-in.** Every API route except `/api/health` needs a session; a wall's session can
  only do what a child may do. An unguessable address is not what protects it.
- **Previews.** Leave Vercel's *Deployment Protection → Vercel Authentication* on for previews (the default for
  new projects). It can also cover production, but then the wall's browser must sign in to Vercel too, which
  is awkward; HOMEBASE's own sign-in is the protection for production.
- **Search engines** are told not to index anything (`X-Robots-Tag`, and a `noindex` tag in the page).
- **Never** set `HOMEBASE_DEMO=1` on the deployment that has your family's database.

## 8. The daily nudge

`vercel.json` asks Vercel to call `/api/cron/daily` once a day (all the free plan allows). It is optional:
each household's morning is prepared by the first screen that wakes anyway. With `CRON_SECRET` set, Vercel
sends it with the call and nothing else is accepted. Without it the route refuses everyone and the nudge does
nothing.

## 9. Updating, going back, backing up

- **Updating.** Merge to `main`; Vercel deploys. New database migrations apply themselves on the first request,
  under a lock, once. The migrations so far only add things, and the rule for future ones is the same, so an
  older version of the app keeps working against a newer database: **going back** is Vercel's *Instant
  Rollback*, with nothing to undo in the database.
- **The wall** picks up a new version by itself when nobody has touched it for a minute.
- **Backing up.** Use your database host's own backups (check what your plan includes), and from time to time
  download *Family → Records → Everything (JSON)*. A full copy with `pg_dump`:

```bash
pg_dump "$DATABASE_URL" --schema=homebase --no-owner --file=homebase-backup.sql
```

- **Locked out?** If the owner forgets the password and has lost the recovery codes, whoever holds the
  database connection string can make a one-day reset code:

```bash
DATABASE_URL=… npm run admin -- reset-code you@example.com
```

## 10. Secrets

| Secret | If it leaks | To change it |
| --- | --- | --- |
| `DATABASE_URL` | Everything can be read. Change the database password at once | New password at the host → new string in Vercel → redeploy |
| `HOMEBASE_SECRET_KEY` | Wall PINs become guessable offline by someone who also has the database | New value → redeploy → each grown-up sets their PIN again (passwords and sessions are not affected) |
| `CRON_SECRET` | Someone could trigger the (harmless, idempotent) daily chores | New value → redeploy |
| AI provider keys | Someone could spend your API credit | Revoke at the provider → new key |

None of these belongs in the repository, in a screenshot, or in a chat. `.env` files are ignored by git.

## 11. Hosting it yourself instead

HOMEBASE is also one ordinary Node program:

```bash
npm ci
```

```bash
npm run build
```

```bash
DATABASE_URL=… HOMEBASE_SECRET_KEY=… PORT=4173 npm start
```

Put it behind something that speaks **https** (a reverse proxy, or a tunnel) and passes
`X-Forwarded-Proto: https`: sign-in cookies are only marked `Secure`, and the offline shell only installs,
over https. With no `DATABASE_URL` it keeps its own database in `.data/` — a real PostgreSQL in a file, fine
for one family on one machine if you back the folder up. This path has been run and verified locally
(`npm run verify:deployment -- http://127.0.0.1:4173`).

## 12. What runs on every pull request

`.github/workflows/ci.yml`: formatting, lint, types, every test on the built-in database, the production
build; the server tests again on PostgreSQL 16; and the browser tests.
