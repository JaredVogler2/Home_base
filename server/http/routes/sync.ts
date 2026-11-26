import { Hono } from 'hono';
import { hasAccess } from '../../../shared/model.js';
import { MAX_OPS_PER_REQUEST } from '../../../shared/ops.js';
import { sweepRateLimits } from '../../auth/rate-limit.js';
import { accessOf, extendUnlock, viewerOf } from '../../auth/sessions.js';
import { asSystem, inHousehold } from '../../db/client.js';
import { sql } from 'drizzle-orm';
import { bumpRevision, lockHousehold, makeCtx, readHousehold } from '../../domain/context.js';
import { keepHouse } from '../../domain/housekeeping.js';
import { buildSnapshot } from '../../domain/snapshot.js';
import { applyOps } from '../../ops/run.js';
import { localDateOf } from '../../../shared/time.js';
import { actorOf, readJson, requireSession, type AppEnv, type C } from '../env.js';
import { badRequest, unauthenticated } from '../errors.js';
import { afterResponse } from '../../weather/background.js';
import { refreshWeatherIfDue, wantsWeather } from '../../weather/service.js';
import { describeError } from '../../log.js';

/**
 * Keeping screens in step.
 *
 *   GET  /sync      "anything new since revision N?"  — nothing (204) or everything (a snapshot)
 *   POST /sync/ops  "please do these"                 — an answer for each, and the snapshot that results
 *
 * A wall asks every few seconds while someone is using it and slowly when nobody is. The "nothing new" answer
 * is one small read. There is no connection held open and nothing that depends on a function staying alive.
 */

export const syncRoutes = new Hono<AppEnv>();

async function snapshotFor(c: C, since: number | null, seenAccess: string | null, seenToday: string | null) {
  const session = requireSession(c);
  const database = c.get('database');
  const deps = c.get('deps');
  const now = c.get('now');
  const deploy = { academyHosts: deps.config.academyHosts };

  return inHousehold(database, session.householdId, async (tx) => {
    let household = await readHousehold(tx, session.householdId);
    if (!household) throw unauthenticated('That household is not here any more.');
    const today = localDateOf(now, household.timeZone);
    let swept = false;
    if (household.housekeptOn !== today) {
      // A new day where the family lives: lock, look again (another screen may have just done it), keep house.
      household = (await lockHousehold(tx, session.householdId)) ?? household;
      const ctx = makeCtx(
        tx,
        household,
        { level: 'owner', name: 'auto', userId: null, deviceId: null },
        now,
        deploy,
      );
      if (await keepHouse(ctx)) {
        await bumpRevision(ctx);
        swept = true;
      }
    }
    const access = accessOf(session, household.settings.wall.holdGate);
    const upToDate = since === household.revision && seenAccess === access && seenToday === today;
    const weather = wantsWeather(household.settings);
    if (upToDate) return { snapshot: null, swept, weather };
    const ctx = makeCtx(tx, household, actorOf(session, access), now, deploy);
    const snapshot = await buildSnapshot(ctx, viewerOf(session, household.settings.wall.holdGate));
    return { snapshot, swept, weather };
  });
}

/** The chores that belong to no household: yesterday's counters, codes that ran out, sessions that ended. */
export async function sweepSystem(c: C): Promise<void> {
  const now = c.get('now');
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  await asSystem(c.get('database'), async (tx) => {
    await sweepRateLimits(tx, now);
    await tx.execute(sql`delete from "homebase"."pair_codes" where "expires_at" < ${dayAgo}::timestamptz`);
    await tx.execute(sql`delete from "homebase"."invites" where "expires_at" < ${monthAgo}::timestamptz`);
    await tx.execute(
      sql`delete from "homebase"."sessions" where "expires_at" < ${monthAgo}::timestamptz or "revoked_at" < ${monthAgo}::timestamptz`,
    );
    // An answer is remembered for a month: far longer than any queue waits to be replayed.
    await tx.execute(sql`delete from "homebase"."operations" where "created_at" < ${monthAgo}::timestamptz`);
    // The record of who changed the set-up is kept for thirteen months, then let go.
    const yearAgo = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString();
    await tx.execute(sql`delete from "homebase"."audit" where "at" < ${yearAgo}::timestamptz`);
    await tx.execute(sql`delete from "homebase"."ai_usage" where "at" < ${yearAgo}::timestamptz`);
  });
}

syncRoutes.get('/', async (c) => {
  const sinceText = c.req.query('since');
  const since = sinceText !== undefined && /^\d{1,9}$/.test(sinceText) ? Number(sinceText) : null;
  const { snapshot, swept, weather } = await snapshotFor(
    c,
    since,
    c.req.query('access') ?? null,
    c.req.query('today') ?? null,
  );
  if (swept)
    await sweepSystem(c).catch((error: unknown) =>
      console.error(`[sync] sweep failed: ${describeError(error)}`),
    );
  if (weather) {
    // The answer below does not wait for this: a new reading reaches the screens on their next ask.
    const deps = c.get('deps');
    const householdId = requireSession(c).householdId;
    afterResponse('weather', () => refreshWeatherIfDue(deps, householdId));
  }
  if (!snapshot) return c.body(null, 204);
  return c.json(snapshot);
});

syncRoutes.post('/ops', async (c) => {
  const session = requireSession(c);
  const body = (await readJson(c)) as { ops?: unknown };
  if (!Array.isArray(body.ops) || body.ops.length === 0) throw badRequest('Nothing was asked.');
  if (body.ops.length > MAX_OPS_PER_REQUEST)
    throw badRequest(`At most ${MAX_OPS_PER_REQUEST} requests at a time.`);
  const deps = c.get('deps');
  const database = c.get('database');

  const applied = await applyOps(
    { database, now: () => c.get('now'), deploy: { academyHosts: deps.config.academyHosts } },
    {
      householdId: session.householdId,
      actor: actorOf(session, accessOf(session, false)),
      access: (holdGate) => accessOf(session, holdGate),
    },
    body.ops,
  );
  if (applied.usedGrownUpAccess && session.kind === 'device' && session.actingUserId) {
    // A grown-up busy at the wall keeps it open a little longer (up to the hard limit).
    const household = await inHousehold(database, session.householdId, (tx) =>
      readHousehold(tx, session.householdId),
    );
    if (household) {
      await asSystem(database, (tx) =>
        extendUnlock(tx, session.id, household.settings.wall.relockSeconds, c.get('now')),
      );
    }
  }
  const { snapshot } = await snapshotFor(c, null, null, null);
  return c.json({ outcomes: applied.outcomes, snapshot });
});

export function isGrownUp(access: Parameters<typeof hasAccess>[0]): boolean {
  return hasAccess(access, 'caregiver');
}
