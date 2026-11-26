import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import * as v from 'valibot';
import { isUuid } from '../../../shared/ids.js';
import { verifyPassword } from '../../auth/crypto.js';
import { attempt, forgive, LIMITS } from '../../auth/rate-limit.js';
import { clearedCookie } from '../../auth/sessions.js';
import { asSystem } from '../../db/client.js';
import { audit, households, memberships, users } from '../../db/schema.js';
import { Reject } from '../../domain/context.js';
import { deleteProfile, eventsCsv, exportHousehold, ledgerCsv } from '../../domain/export.js';
import { healthReport } from '../../domain/health.js';
import { HISTORY_WEEKS, historySummary, recentEvents } from '../../domain/history.js';
import { listLedger, reconcile } from '../../domain/ledger.js';
import { clientKey, readJson, requireGuardianSession, withHousehold, type AppEnv } from '../env.js';
import { badRequest, forbidden, HttpError, tooMany } from '../errors.js';

/**
 * Looking back, taking records away, and deleting them.
 *
 *   GET  /history/summary?weeks=8          parents and helpers   week-by-week counts, each with its "out of"
 *   GET  /history/ledger?profileId=…       parents               a child's star lines, newest first
 *   GET  /history/events?days=14           parents               the day-by-day record
 *   GET  /history/reconcile                parents               do the kept totals agree with the lines?
 *   GET  /history/changes                  parents               who changed the set-up, and when
 *   GET  /history/health                   parents               how the connections are, and have been
 *   GET  /export/household.json            parents               everything, as one readable file
 *   GET  /export/ledger.csv, history.csv   parents               the same two tables for a spreadsheet
 *   POST /family/profiles/:id/delete       parents               a child and all their records, for good
 *   POST /family/household/delete          the owner             the whole household, for good
 *
 * None of these is open to a wall, unlocked or not: they answer only to a grown-up signed in on their own phone.
 */

const dayStamp = (now: Date): string => now.toISOString().slice(0, 10);

function attachment(body: string, type: string, name: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': `${type}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const historyRoutes = new Hono<AppEnv>();

historyRoutes.get('/summary', async (c) => {
  requireGuardianSession(c);
  const weeksText = c.req.query('weeks');
  const weeks = weeksText === undefined ? HISTORY_WEEKS.default : Number(weeksText);
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > HISTORY_WEEKS.max)
    throw badRequest(`Choose between 1 and ${HISTORY_WEEKS.max} weeks.`);
  return c.json(await withHousehold(c, 'caregiver', (ctx) => historySummary(ctx, weeks)));
});

historyRoutes.get('/ledger', async (c) => {
  requireGuardianSession(c);
  const profileId = c.req.query('profileId') ?? '';
  if (!isUuid(profileId)) throw badRequest('Choose a child.');
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? '100') || 100));
  const beforeText = c.req.query('before');
  const before = beforeText && !Number.isNaN(Date.parse(beforeText)) ? new Date(beforeText) : undefined;
  const entries = await withHousehold(c, 'guardian', (ctx) => listLedger(ctx, profileId, limit, before));
  return c.json({ entries });
});

historyRoutes.get('/events', async (c) => {
  requireGuardianSession(c);
  const profileText = c.req.query('profileId');
  if (profileText !== undefined && !isUuid(profileText)) throw badRequest('Choose a child.');
  const days = Number(c.req.query('days') ?? '14') || 14;
  const limit = Number(c.req.query('limit') ?? '100') || 100;
  const found = await withHousehold(c, 'guardian', (ctx) =>
    recentEvents(ctx, { days, profileId: profileText ?? null, limit }),
  );
  return c.json({ events: found });
});

historyRoutes.get('/reconcile', async (c) => {
  requireGuardianSession(c);
  const children = await withHousehold(c, 'guardian', (ctx) => reconcile(ctx));
  return c.json({ ok: children.every((child) => child.matches), children });
});

historyRoutes.get('/changes', async (c) => {
  requireGuardianSession(c);
  const rows = await withHousehold(c, 'guardian', (ctx) =>
    ctx.tx
      .select({ at: audit.at, action: audit.action, actor: audit.actor })
      .from(audit)
      .where(eq(audit.householdId, ctx.household.id))
      .orderBy(desc(audit.at))
      .limit(100),
  );
  return c.json({ changes: rows.map((row) => ({ ...row, at: row.at.toISOString() })) });
});

historyRoutes.get('/health', async (c) => {
  requireGuardianSession(c);
  return c.json(await withHousehold(c, 'guardian', (ctx) => healthReport(ctx)));
});

export const exportRoutes = new Hono<AppEnv>();

exportRoutes.get('/household.json', async (c) => {
  requireGuardianSession(c);
  const data = await withHousehold(c, 'guardian', (ctx) => exportHousehold(ctx));
  return attachment(
    JSON.stringify(data, null, 2),
    'application/json',
    `homebase-${dayStamp(c.get('now'))}.json`,
  );
});

exportRoutes.get('/ledger.csv', async (c) => {
  requireGuardianSession(c);
  const csv = await withHousehold(c, 'guardian', (ctx) => ledgerCsv(ctx));
  return attachment(csv, 'text/csv', `homebase-stars-${dayStamp(c.get('now'))}.csv`);
});

exportRoutes.get('/history.csv', async (c) => {
  requireGuardianSession(c);
  const csv = await withHousehold(c, 'guardian', (ctx) => eventsCsv(ctx));
  return attachment(csv, 'text/csv', `homebase-history-${dayStamp(c.get('now'))}.csv`);
});

export const familyRoutes = new Hono<AppEnv>();

familyRoutes.post('/profiles/:id/delete', async (c) => {
  requireGuardianSession(c);
  const profileId = c.req.param('id');
  if (!isUuid(profileId)) throw badRequest('Choose a child.');
  const parsed = v.safeParse(v.object({ nickname: v.pipe(v.string(), v.maxLength(60)) }), await readJson(c));
  if (!parsed.success) throw badRequest('Type the child’s nickname, to be sure.');
  try {
    await withHousehold(c, 'guardian', (ctx) => deleteProfile(ctx, profileId, parsed.output.nickname), {
      lock: true,
    });
  } catch (error) {
    if (error instanceof Reject) {
      throw new HttpError(error.reason === 'not_found' ? 'not_found' : 'bad_request', error.message);
    }
    throw error;
  }
  return c.json({ ok: true });
});

/**
 * Delete the household: every child, mission, list, photograph and record, the screens' pairings, and the
 * accounts of grown-ups who belong to no other household. Only the owner, only with their password and the
 * household's name typed out, and never undone.
 */
familyRoutes.post('/household/delete', async (c) => {
  const session = requireGuardianSession(c);
  if (session.role !== 'owner') throw forbidden('Only the owner can delete the household.');
  const parsed = v.safeParse(
    v.object({
      password: v.pipe(v.string(), v.maxLength(200)),
      name: v.pipe(v.string(), v.maxLength(80)),
    }),
    await readJson(c),
  );
  if (!parsed.success) throw badRequest('Type your password and the household’s name.');
  const now = c.get('now');
  const database = c.get('database');
  const key = `delete:${session.userId}:${clientKey(c)}`;
  const limited = await asSystem(database, (tx) => attempt(tx, key, LIMITS.signIn, now));
  if (!limited.allowed) throw tooMany(limited.retryAfter);

  const outcome = await asSystem(database, async (tx) => {
    const found = await tx
      .select({ passwordHash: users.passwordHash, name: households.name })
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .innerJoin(households, eq(households.id, memberships.householdId))
      .where(
        and(
          eq(users.id, session.userId),
          eq(households.id, session.householdId),
          eq(memberships.role, 'owner'),
        ),
      )
      .limit(1);
    const row = found[0];
    if (!row) return 'forbidden' as const;
    if (!(await verifyPassword(parsed.output.password, row.passwordHash))) return 'password' as const;
    if (row.name.trim().toLowerCase() !== parsed.output.name.trim().toLowerCase()) return 'name' as const;
    await forgive(tx, key);
    const members = await tx
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(eq(memberships.householdId, session.householdId));
    // Everything that belongs to the household goes with it: every table hangs from this row.
    await tx.delete(households).where(eq(households.id, session.householdId));
    // A grown-up with no household left has no reason to have an account here.
    for (const member of members) {
      await tx.execute(
        sql`delete from "homebase"."users" where "id" = ${member.userId}::uuid
            and not exists (select 1 from "homebase"."memberships" where "user_id" = ${member.userId}::uuid)`,
      );
    }
    return 'deleted' as const;
  });
  if (outcome === 'forbidden') throw forbidden('Only the owner can delete the household.');
  if (outcome === 'password') throw badRequest('That is not your password.');
  if (outcome === 'name') throw badRequest('Type the household’s name exactly, to be sure.');
  c.header('Set-Cookie', clearedCookie(c.get('secure')));
  return c.json({ ok: true });
});
